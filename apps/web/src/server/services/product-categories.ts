import { randomUUID } from "node:crypto";
import { requireDatabase } from "@miniros/db";
import { auditLogs, productCategories, products } from "@miniros/db/schema";
import { and, asc, count, eq, isNull, max, ne, sql } from "drizzle-orm";
import { AccessError, requireActiveBusiness } from "./access";

export type ProductCategoryWriteInput = {
  name: string;
};

function normalizedCategoryName(value: string) {
  return value.trim();
}

function categoryDto(
  row: typeof productCategories.$inferSelect,
  productCount: number,
) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    productCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listProductCategories() {
  const { business } = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  const [categories, productCounts] = await Promise.all([
    database
      .select()
      .from(productCategories)
      .where(
        and(
          eq(productCategories.businessId, business.id),
          isNull(productCategories.deletedAt),
        ),
      )
      .orderBy(asc(productCategories.sortOrder), asc(productCategories.name)),
    database
      .select({
        categoryId: products.categoryId,
        productCount: count(products.id),
      })
      .from(products)
      .where(
        and(
          eq(products.businessId, business.id),
          isNull(products.deletedAt),
          ne(products.status, "deleted"),
        ),
      )
      .groupBy(products.categoryId),
  ]);
  const countsByCategoryId = new Map(
    productCounts.map((row) => [row.categoryId, Number(row.productCount)]),
  );

  return categories.map((category) =>
    categoryDto(category, countsByCategoryId.get(category.id) ?? 0),
  );
}

export async function createProductCategory(input: ProductCategoryWriteInput) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  const name = normalizedCategoryName(input.name);

  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(productCategories)
      .where(
        and(
          eq(productCategories.businessId, access.business.id),
          sql`lower(${productCategories.name}) = ${name.toLocaleLowerCase()}`,
        ),
      )
      .limit(1);

    if (existing && !existing.deletedAt) {
      throw new AccessError(
        "A product category with that name already exists.",
      );
    }

    const [lastCategory] = await tx
      .select({ sortOrder: max(productCategories.sortOrder) })
      .from(productCategories)
      .where(
        and(
          eq(productCategories.businessId, access.business.id),
          isNull(productCategories.deletedAt),
        ),
      );
    const sortOrder = (lastCategory?.sortOrder ?? -10) + 10;
    const now = new Date();
    const categoryId = existing?.id ?? randomUUID();
    const [saved] = existing
      ? await tx
          .update(productCategories)
          .set({ name, sortOrder, deletedAt: null, updatedAt: now })
          .where(
            and(
              eq(productCategories.id, categoryId),
              eq(productCategories.businessId, access.business.id),
            ),
          )
          .returning()
      : await tx
          .insert(productCategories)
          .values({
            id: categoryId,
            businessId: access.business.id,
            name,
            sortOrder,
          })
          .returning();

    if (!saved) throw new Error("Product category save did not return a row.");

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: existing
        ? "product_category.restored"
        : "product_category.created",
      entityType: "product_category",
      entityId: categoryId,
      metadata: { name: saved.name, sortOrder: saved.sortOrder },
    });

    return categoryDto(saved, 0);
  });
}

export async function updateProductCategory(
  categoryId: string,
  input: ProductCategoryWriteInput,
) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  const name = normalizedCategoryName(input.name);

  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(productCategories)
      .where(
        and(
          eq(productCategories.id, categoryId),
          eq(productCategories.businessId, access.business.id),
          isNull(productCategories.deletedAt),
        ),
      )
      .limit(1);
    if (!existing) throw new AccessError("Product category not found.");

    const [duplicate] = await tx
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(
        and(
          eq(productCategories.businessId, access.business.id),
          ne(productCategories.id, categoryId),
          sql`lower(${productCategories.name}) = ${name.toLocaleLowerCase()}`,
        ),
      )
      .limit(1);
    if (duplicate) {
      throw new AccessError(
        "A product category with that name already exists.",
      );
    }

    const [updated] = await tx
      .update(productCategories)
      .set({ name, updatedAt: new Date() })
      .where(
        and(
          eq(productCategories.id, categoryId),
          eq(productCategories.businessId, access.business.id),
        ),
      )
      .returning();
    if (!updated)
      throw new Error("Product category update did not return a row.");

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "product_category.updated",
      entityType: "product_category",
      entityId: categoryId,
      metadata: { previousName: existing.name, name: updated.name },
    });

    return categoryDto(updated, 0);
  });
}

export async function reorderProductCategories(categoryIds: string[]) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();

  return database.transaction(async (tx) => {
    const activeCategories = await tx
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(
        and(
          eq(productCategories.businessId, access.business.id),
          isNull(productCategories.deletedAt),
        ),
      )
      .orderBy(asc(productCategories.sortOrder), asc(productCategories.name));
    const activeIds = new Set(activeCategories.map((category) => category.id));

    if (
      categoryIds.length !== activeIds.size ||
      new Set(categoryIds).size !== categoryIds.length ||
      categoryIds.some((categoryId) => !activeIds.has(categoryId))
    ) {
      throw new AccessError(
        "The category order is no longer current. Refresh and try again.",
      );
    }

    const now = new Date();
    for (const [index, categoryId] of categoryIds.entries()) {
      await tx
        .update(productCategories)
        .set({ sortOrder: index * 10, updatedAt: now })
        .where(
          and(
            eq(productCategories.id, categoryId),
            eq(productCategories.businessId, access.business.id),
          ),
        );
    }

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "product_category.reordered",
      entityType: "product_category",
      metadata: { categoryIds },
    });

    return { categoryIds };
  });
}

export async function softDeleteProductCategory(categoryId: string) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();

  return database.transaction(async (tx) => {
    const activeCategories = await tx
      .select({ id: productCategories.id })
      .from(productCategories)
      .where(
        and(
          eq(productCategories.businessId, access.business.id),
          isNull(productCategories.deletedAt),
        ),
      );
    if (activeCategories.length <= 1) {
      throw new AccessError(
        "Create another category before archiving the last active category.",
      );
    }

    const [existing] = await tx
      .select({ id: productCategories.id, name: productCategories.name })
      .from(productCategories)
      .where(
        and(
          eq(productCategories.id, categoryId),
          eq(productCategories.businessId, access.business.id),
          isNull(productCategories.deletedAt),
        ),
      )
      .limit(1);
    if (!existing) throw new AccessError("Product category not found.");

    const [product] = await tx
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.businessId, access.business.id),
          eq(products.categoryId, categoryId),
          isNull(products.deletedAt),
          ne(products.status, "deleted"),
        ),
      )
      .limit(1);
    if (product) {
      throw new AccessError(
        "Move products to another category before archiving this category.",
      );
    }

    const deletedAt = new Date();
    await tx
      .update(productCategories)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(
        and(
          eq(productCategories.id, categoryId),
          eq(productCategories.businessId, access.business.id),
        ),
      );

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "product_category.archived",
      entityType: "product_category",
      entityId: categoryId,
      metadata: { name: existing.name },
    });

    return { id: categoryId, deletedAt: deletedAt.toISOString() };
  });
}
