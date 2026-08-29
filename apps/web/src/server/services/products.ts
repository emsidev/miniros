import { randomUUID } from "node:crypto";
import { requireDatabase } from "@miniros/db";
import {
  auditLogs,
  productCategories,
  productRecipeItems,
  products,
} from "@miniros/db/schema";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { AccessError, requireActiveBusiness } from "./access";

export type ProductWriteInput = {
  categoryId: string | null;
  name: string;
  sku: string | null;
  description: string | null;
  priceCents: number;
  costCents: number;
  status: "active" | "inactive";
  isSellable: boolean;
  requiresRecipeDeduction: boolean;
  imageUrl: string | null;
};

function nullableText(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function productDto(
  row: typeof products.$inferSelect,
  categoryName: string | null = null,
) {
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName,
    name: row.name,
    sku: row.sku,
    description: row.description,
    priceCents: row.priceCents,
    costCents: row.costCents,
    status: row.status,
    isSellable: row.isSellable,
    requiresRecipeDeduction: row.requiresRecipeDeduction,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listProducts() {
  const { business } = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  const rows = await database
    .select({ product: products, categoryName: productCategories.name })
    .from(products)
    .leftJoin(
      productCategories,
      and(
        eq(products.categoryId, productCategories.id),
        eq(productCategories.businessId, business.id),
        isNull(productCategories.deletedAt),
      ),
    )
    .where(
      and(
        eq(products.businessId, business.id),
        isNull(products.deletedAt),
        ne(products.status, "deleted"),
      ),
    )
    .orderBy(asc(products.name));

  return rows.map(({ product, categoryName }) =>
    productDto(product, categoryName),
  );
}

export async function createProduct(input: ProductWriteInput) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();

  return database.transaction(async (tx) => {
    let categoryName: string | null = null;
    if (input.categoryId) {
      const [category] = await tx
        .select({ name: productCategories.name })
        .from(productCategories)
        .where(
          and(
            eq(productCategories.id, input.categoryId),
            eq(productCategories.businessId, access.business.id),
            isNull(productCategories.deletedAt),
          ),
        )
        .limit(1);

      if (!category) {
        throw new AccessError("The selected product category is unavailable.");
      }
      categoryName = category.name;
    }

    const sku = nullableText(input.sku);
    const [restorable] = sku
      ? await tx
          .select({ id: products.id })
          .from(products)
          .where(
            and(
              eq(products.businessId, access.business.id),
              eq(products.sku, sku),
              eq(products.status, "deleted"),
            ),
          )
          .limit(1)
      : [];
    const productId = restorable?.id ?? randomUUID();
    const values = {
      categoryId: input.categoryId,
      name: input.name.trim(),
      sku,
      description: nullableText(input.description),
      priceCents: input.priceCents,
      costCents: input.costCents,
      status: input.status,
      isSellable: input.isSellable,
      requiresRecipeDeduction: input.requiresRecipeDeduction,
      imageUrl: nullableText(input.imageUrl),
      deletedAt: null,
      updatedAt: new Date(),
    };
    const [created] = restorable
      ? await tx
          .update(products)
          .set(values)
          .where(
            and(
              eq(products.id, productId),
              eq(products.businessId, access.business.id),
              eq(products.status, "deleted"),
            ),
          )
          .returning()
      : await tx
          .insert(products)
          .values({
            id: productId,
            businessId: access.business.id,
            ...values,
          })
          .returning();

    if (!created) {
      throw new Error("Product insert did not return a row.");
    }

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: restorable ? "product.restored" : "product.created",
      entityType: "product",
      entityId: productId,
      metadata: {
        name: created.name,
        priceCents: created.priceCents,
        costCents: created.costCents,
        restored: Boolean(restorable),
      },
    });

    return productDto(created, categoryName);
  });
}

export async function updateProduct(
  productId: string,
  input: ProductWriteInput,
) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();

  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(products)
      .where(
        and(
          eq(products.id, productId),
          eq(products.businessId, access.business.id),
          isNull(products.deletedAt),
          ne(products.status, "deleted"),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new AccessError("Product not found.");
    }

    let categoryName: string | null = null;
    if (input.categoryId) {
      const [category] = await tx
        .select({ name: productCategories.name })
        .from(productCategories)
        .where(
          and(
            eq(productCategories.id, input.categoryId),
            eq(productCategories.businessId, access.business.id),
            isNull(productCategories.deletedAt),
          ),
        )
        .limit(1);

      if (!category) {
        throw new AccessError("The selected product category is unavailable.");
      }
      categoryName = category.name;
    }

    const [updated] = await tx
      .update(products)
      .set({
        categoryId: input.categoryId,
        name: input.name.trim(),
        sku: nullableText(input.sku),
        description: nullableText(input.description),
        priceCents: input.priceCents,
        costCents: input.costCents,
        status: input.status,
        isSellable: input.isSellable,
        requiresRecipeDeduction: input.requiresRecipeDeduction,
        imageUrl: nullableText(input.imageUrl),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(products.id, productId),
          eq(products.businessId, access.business.id),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error("Product update did not return a row.");
    }

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "product.updated",
      entityType: "product",
      entityId: productId,
      metadata: {
        previousStatus: existing.status,
        status: updated.status,
        priceCents: updated.priceCents,
        costCents: updated.costCents,
      },
    });

    return productDto(updated, categoryName);
  });
}

export async function softDeleteProduct(productId: string) {
  const access = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();

  return database.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(
        and(
          eq(products.id, productId),
          eq(products.businessId, access.business.id),
          isNull(products.deletedAt),
          ne(products.status, "deleted"),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new AccessError("Product not found.");
    }

    const deletedAt = new Date();
    await tx
      .update(productRecipeItems)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(
        and(
          eq(productRecipeItems.productId, productId),
          eq(productRecipeItems.businessId, access.business.id),
          isNull(productRecipeItems.deletedAt),
        ),
      );

    await tx
      .update(products)
      .set({
        status: "deleted",
        isSellable: false,
        requiresRecipeDeduction: false,
        deletedAt,
        updatedAt: deletedAt,
      })
      .where(
        and(
          eq(products.id, productId),
          eq(products.businessId, access.business.id),
        ),
      );

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "product.deleted",
      entityType: "product",
      entityId: productId,
      metadata: { name: existing.name },
    });

    return { id: productId, deletedAt: deletedAt.toISOString() };
  });
}
