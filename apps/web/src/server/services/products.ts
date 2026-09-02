import { randomUUID } from "node:crypto";
import { normalizeSku, selectAvailableAutomaticSku } from "@miniros/domain";
import { requireDatabase } from "@miniros/db";
import {
  auditLogs,
  inventoryItems,
  productCategories,
  productRecipeItems,
  productProductionOutputs,
  products,
} from "@miniros/db/schema";
import { and, asc, eq, isNull, ne } from "drizzle-orm";
import { AccessError, requireActiveBusiness } from "./access";
import {
  buildProductCostBreakdown,
  loadIngredientCostSummaries,
  type ProductCostBreakdown,
} from "./product-costing";

export type ProductWriteInput = {
  categoryId: string;
  name: string;
  sku: string | null;
  description: string | null;
  priceCents: number;
  manualCostCents: number;
  costOverrideCents: number | null;
  status: "active" | "inactive";
  isSellable: boolean;
  requiresRecipeDeduction: boolean;
  inventoryMode: "none" | "recipe" | "produced";
  outputInventoryItemId: string | null;
  imageUrl: string | null;
};

function nullableText(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizedSku(value: string | null) {
  const normalized = nullableText(value);
  return normalized ? normalizeSku(normalized) : null;
}

type DatabaseTransaction = Parameters<
  Parameters<ReturnType<typeof requireDatabase>["transaction"]>[0]
>[0];

async function generateAvailableProductSku(
  tx: DatabaseTransaction,
  businessId: string,
  name: string,
  excludeProductId?: string,
) {
  try {
    return await selectAvailableAutomaticSku({
      prefix: "PRD",
      name,
      nextSuffix: () => randomUUID().replace(/-/g, "").slice(0, 4),
      isAvailable: async (sku) => {
        const [collision] = await tx
          .select({ id: products.id })
          .from(products)
          .where(
            and(
              eq(products.businessId, businessId),
              eq(products.sku, sku),
              ...(excludeProductId ? [ne(products.id, excludeProductId)] : []),
            ),
          )
          .limit(1);
        return !collision;
      },
    });
  } catch {
    throw new AccessError(
      "Could not generate a unique product SKU. Try again.",
    );
  }
}

function productDto(
  row: typeof products.$inferSelect,
  categoryName: string | null = null,
  output: { id: string; name: string; unit: string } | null = null,
  costing?: ProductCostBreakdown,
) {
  const inventoryMode: ProductWriteInput["inventoryMode"] = output
    ? "produced"
    : row.requiresRecipeDeduction
      ? "recipe"
      : "none";
  return {
    id: row.id,
    categoryId: row.categoryId,
    categoryName,
    name: row.name,
    sku: row.sku,
    description: row.description,
    priceCents: row.priceCents,
    costCents: row.costCents,
    effectiveCostCents: costing?.effectiveCostCents ?? row.costCents,
    manualCostCents: row.manualCostCents,
    laborCostCents: row.laborCostCents,
    overheadCostCents: row.overheadCostCents,
    costOverrideCents: row.costOverrideCents,
    ingredientCostCents: costing?.ingredientCostCents ?? 0,
    calculatedCostCents: costing?.calculatedCostCents ?? row.manualCostCents,
    costSource: costing?.costSource ?? ("manual" as const),
    recipeLineCount: costing?.recipeLineCount ?? 0,
    status: row.status,
    isSellable: row.isSellable,
    requiresRecipeDeduction: row.requiresRecipeDeduction,
    inventoryMode,
    outputInventoryItemId: output?.id ?? null,
    outputInventoryItemName: output?.name ?? null,
    outputInventoryItemUnit: output?.unit ?? null,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function replaceProductionOutput(
  tx: DatabaseTransaction,
  input: {
    businessId: string;
    productId: string;
    inventoryMode: ProductWriteInput["inventoryMode"];
    outputInventoryItemId: string | null;
    productionEnabled: boolean;
  },
) {
  if (input.inventoryMode !== "produced") {
    if (input.outputInventoryItemId) {
      throw new AccessError(
        "Only produced-stock products may have an output inventory item.",
      );
    }
    await tx
      .delete(productProductionOutputs)
      .where(
        and(
          eq(productProductionOutputs.productId, input.productId),
          eq(productProductionOutputs.businessId, input.businessId),
        ),
      );
    return null;
  }
  if (!input.outputInventoryItemId) {
    throw new AccessError(
      "Choose a tracked finished-good inventory item for produced stock.",
    );
  }
  const [currentOutput] = await tx
    .select({ inventoryItemId: productProductionOutputs.inventoryItemId })
    .from(productProductionOutputs)
    .where(
      and(
        eq(productProductionOutputs.businessId, input.businessId),
        eq(productProductionOutputs.productId, input.productId),
      ),
    )
    .limit(1);
  if (
    !input.productionEnabled &&
    currentOutput?.inventoryItemId !== input.outputInventoryItemId
  ) {
    throw new AccessError("Enable Production before using produced stock.");
  }
  const [output] = await tx
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      unit: inventoryItems.unit,
    })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, input.outputInventoryItemId),
        eq(inventoryItems.businessId, input.businessId),
        eq(inventoryItems.itemType, "finished_good"),
        eq(inventoryItems.trackStock, true),
        eq(inventoryItems.status, "active"),
        isNull(inventoryItems.deletedAt),
      ),
    )
    .limit(1);
  if (!output) {
    throw new AccessError(
      "Choose an active tracked finished-good inventory item.",
    );
  }
  const [existingOutput] = await tx
    .select({ productId: productProductionOutputs.productId })
    .from(productProductionOutputs)
    .where(
      and(
        eq(productProductionOutputs.businessId, input.businessId),
        eq(productProductionOutputs.inventoryItemId, output.id),
        ne(productProductionOutputs.productId, input.productId),
      ),
    )
    .limit(1);
  if (existingOutput) {
    throw new AccessError(
      "That finished-good inventory item is already mapped to another product.",
    );
  }
  await tx
    .insert(productProductionOutputs)
    .values({
      productId: input.productId,
      businessId: input.businessId,
      inventoryItemId: output.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [productProductionOutputs.productId],
      set: { inventoryItemId: output.id, updatedAt: new Date() },
    });
  return output;
}

function requiresRecipeDeductionForMode(
  input: ProductWriteInput,
  recipesEnabled: boolean,
) {
  if (input.inventoryMode === "recipe" && !recipesEnabled) {
    throw new AccessError("Enable Recipes before using recipe deduction.");
  }
  return input.inventoryMode === "recipe";
}

export async function listProducts() {
  const { business } = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  return database.transaction(async (tx) => {
    const rows = await tx
      .select({
        product: products,
        categoryName: productCategories.name,
        outputInventoryItemId: inventoryItems.id,
        outputInventoryItemName: inventoryItems.name,
        outputInventoryItemUnit: inventoryItems.unit,
      })
      .from(products)
      .leftJoin(
        productCategories,
        and(
          eq(products.categoryId, productCategories.id),
          eq(productCategories.businessId, business.id),
          isNull(productCategories.deletedAt),
        ),
      )
      .leftJoin(
        productProductionOutputs,
        and(
          eq(productProductionOutputs.productId, products.id),
          eq(productProductionOutputs.businessId, products.businessId),
        ),
      )
      .leftJoin(
        inventoryItems,
        and(
          eq(inventoryItems.id, productProductionOutputs.inventoryItemId),
          eq(inventoryItems.businessId, products.businessId),
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
    const summaries = await loadIngredientCostSummaries(
      tx,
      business.id,
      rows.map(({ product }) => product.id),
    );

    return rows.map(
      ({
        product,
        categoryName,
        outputInventoryItemId,
        outputInventoryItemName,
        outputInventoryItemUnit,
      }) => {
        const costing = buildProductCostBreakdown(
          product,
          summaries.get(product.id),
          business.features.recipesEnabled,
        );
        return productDto(
          product,
          categoryName,
          outputInventoryItemId &&
            outputInventoryItemName &&
            outputInventoryItemUnit
            ? {
                id: outputInventoryItemId,
                name: outputInventoryItemName,
                unit: outputInventoryItemUnit,
              }
            : null,
          costing,
        );
      },
    );
  });
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

    const requestedSku = normalizedSku(input.sku);
    const [matchingSku] = requestedSku
      ? await tx
          .select({ id: products.id, status: products.status })
          .from(products)
          .where(
            and(
              eq(products.businessId, access.business.id),
              eq(products.sku, requestedSku),
            ),
          )
          .limit(1)
      : [];
    if (matchingSku && matchingSku.status !== "deleted") {
      throw new AccessError("A product with that SKU already exists.");
    }

    const sku =
      requestedSku ??
      (await generateAvailableProductSku(tx, access.business.id, input.name));
    const restorable = matchingSku?.status === "deleted" ? matchingSku : null;
    const productId = restorable?.id ?? randomUUID();
    const values = {
      categoryId: input.categoryId,
      name: input.name.trim(),
      sku,
      description: nullableText(input.description),
      priceCents: input.priceCents,
      costCents: input.manualCostCents,
      manualCostCents: input.manualCostCents,
      laborCostCents: 0,
      overheadCostCents: 0,
      costOverrideCents: null,
      status: input.status,
      isSellable: input.isSellable,
      requiresRecipeDeduction: requiresRecipeDeductionForMode(
        input,
        access.business.features.recipesEnabled,
      ),
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
    const output = await replaceProductionOutput(tx, {
      businessId: access.business.id,
      productId,
      inventoryMode: input.inventoryMode,
      outputInventoryItemId: input.outputInventoryItemId,
      productionEnabled: access.business.features.productionEnabled,
    });

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
        categoryId: created.categoryId,
        sku: created.sku,
        priceCents: created.priceCents,
        costCents: created.costCents,
        inventoryMode: input.inventoryMode,
        outputInventoryItemId: output?.id ?? null,
        restored: Boolean(restorable),
      },
    });

    return productDto(
      created,
      categoryName,
      output,
      buildProductCostBreakdown(
        created,
        undefined,
        access.business.features.recipesEnabled,
      ),
    );
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

    const requestedSku = normalizedSku(input.sku);
    const sku = requestedSku
      ? requestedSku
      : await generateAvailableProductSku(
          tx,
          access.business.id,
          input.name,
          productId,
        );
    if (requestedSku) {
      const [duplicate] = await tx
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.businessId, access.business.id),
            eq(products.sku, sku),
            ne(products.id, productId),
          ),
        )
        .limit(1);
      if (duplicate) {
        throw new AccessError("A product with that SKU already exists.");
      }
    }

    const summaries = await loadIngredientCostSummaries(
      tx,
      access.business.id,
      [productId],
    );
    const previousCosting = buildProductCostBreakdown(
      existing,
      summaries.get(productId),
      access.business.features.recipesEnabled,
    );
    const proposedCosting = buildProductCostBreakdown(
      {
        ...existing,
        manualCostCents: input.manualCostCents,
        costOverrideCents: input.costOverrideCents,
      },
      summaries.get(productId),
      access.business.features.recipesEnabled,
    );
    const automatic = proposedCosting.costSource !== "manual";
    const nextOverrideCents = automatic ? input.costOverrideCents : null;
    const nextCostCents = automatic
      ? (nextOverrideCents ?? proposedCosting.calculatedCostCents)
      : input.manualCostCents;

    const [updated] = await tx
      .update(products)
      .set({
        categoryId: input.categoryId,
        name: input.name.trim(),
        sku,
        description: nullableText(input.description),
        priceCents: input.priceCents,
        costCents: nextCostCents,
        manualCostCents: input.manualCostCents,
        costOverrideCents: nextOverrideCents,
        status: input.status,
        isSellable: input.isSellable,
        requiresRecipeDeduction: requiresRecipeDeductionForMode(
          input,
          access.business.features.recipesEnabled,
        ),
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
    const updatedCosting = buildProductCostBreakdown(
      updated,
      summaries.get(productId),
      access.business.features.recipesEnabled,
    );
    const output = await replaceProductionOutput(tx, {
      businessId: access.business.id,
      productId,
      inventoryMode: input.inventoryMode,
      outputInventoryItemId: input.outputInventoryItemId,
      productionEnabled: access.business.features.productionEnabled,
    });

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
        categoryId: updated.categoryId,
        sku: updated.sku,
        priceCents: updated.priceCents,
        costCents: updated.costCents,
        manualCostCents: updated.manualCostCents,
        costOverrideCents: updated.costOverrideCents,
        costSource: automatic
          ? updated.costOverrideCents === null
            ? "recipe"
            : "override"
          : "manual",
        costBefore: previousCosting,
        costAfter: updatedCosting,
        overrideChanged:
          existing.costOverrideCents !== updated.costOverrideCents,
        inventoryMode: input.inventoryMode,
        outputInventoryItemId: output?.id ?? null,
      },
    });

    return productDto(updated, categoryName, output, updatedCosting);
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
      .delete(productProductionOutputs)
      .where(
        and(
          eq(productProductionOutputs.productId, productId),
          eq(productProductionOutputs.businessId, access.business.id),
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
