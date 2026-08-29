import { requireDatabase } from "@miniros/db";
import {
  payments,
  products,
  saleItems,
  sales,
  shifts,
} from "@miniros/db/schema";
import {
  addCents,
  assertNonNegativeCents,
  multiplyCentsByQuantity,
  normalizeQuantity,
} from "@miniros/domain";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { AccessError, requireActiveBusiness } from "./access";
import { databaseQuantity } from "./inventory-ledger";
import {
  getShiftInventoryLocation,
  insertAuditLog,
  requireCurrentAssignment,
  requireEmployee,
} from "./operational-helpers";
import {
  calculateSaleTender,
  type FinalizeSaleInput,
} from "./sale-calculations";
import { findExistingSale } from "./sale-idempotency";
import { deductSaleInventory } from "./sale-inventory";
export async function finalizeSale(input: FinalizeSaleInput) {
  const access = await requireActiveBusiness({
    employeePermission: "pos",
    assignedShiftId: input.shiftId,
  });
  requireEmployee(access);
  const database = requireDatabase();
  return database.transaction(async (tx) => {
    const existing = await findExistingSale(
      tx,
      access.business.id,
      input.saleId,
    );
    if (existing) {
      if (existing.shiftId !== input.shiftId) {
        throw new AccessError("The sale request ID is already in use.");
      }
      return { ...existing, idempotent: true };
    }

    const [shift] = await tx
      .select({
        id: shifts.id,
        sellingLocationId: shifts.sellingLocationId,
        status: shifts.status,
      })
      .from(shifts)
      .where(
        and(
          eq(shifts.id, input.shiftId),
          eq(shifts.businessId, access.business.id),
          isNull(shifts.deletedAt),
        ),
      )
      .for("update")
      .limit(1);

    if (!shift) throw new AccessError("Shift not found.");
    if (shift.status !== "active") {
      const raced = await findExistingSale(
        tx,
        access.business.id,
        input.saleId,
      );
      if (raced?.shiftId === input.shiftId) {
        return { ...raced, idempotent: true };
      }
      throw new AccessError("Sales require an active shift.");
    }
    await requireCurrentAssignment(
      tx,
      access.business.id,
      shift.id,
      access.employee.id,
    );
    const inventoryLocation = await getShiftInventoryLocation(
      tx,
      access.business.id,
      shift.id,
    );
    if (inventoryLocation.sellingLocationId !== shift.sellingLocationId) {
      throw new AccessError("The shift inventory location is inconsistent.");
    }

    const productIds = [...new Set(input.items.map((item) => item.productId))];
    if (input.items.length === 0 || productIds.length === 0) {
      throw new AccessError("At least one sale item is required.");
    }
    if (
      new Set(input.items.map((item) => item.id)).size !== input.items.length
    ) {
      throw new AccessError("Each sale item ID must be unique.");
    }

    const productRows = await tx
      .select({
        id: products.id,
        name: products.name,
        priceCents: products.priceCents,
        costCents: products.costCents,
        requiresRecipeDeduction: products.requiresRecipeDeduction,
      })
      .from(products)
      .where(
        and(
          eq(products.businessId, access.business.id),
          inArray(products.id, productIds),
          eq(products.status, "active"),
          eq(products.isSellable, true),
          isNull(products.deletedAt),
        ),
      );
    if (productRows.length !== productIds.length) {
      throw new AccessError("One or more products are unavailable for sale.");
    }
    const productById = new Map(productRows.map((row) => [row.id, row]));

    const itemRows = input.items.map((item) => {
      const product = productById.get(item.productId);
      if (!product) throw new AccessError("Product not found.");
      const quantity = normalizeQuantity(item.quantity);
      if (quantity <= 0) {
        throw new AccessError("Sale item quantities must be positive.");
      }
      const discountCents = item.discountCents ?? 0;
      assertNonNegativeCents(discountCents, "discountCents");
      const beforeDiscount = multiplyCentsByQuantity(
        product.priceCents,
        quantity,
      );
      if (discountCents > beforeDiscount) {
        throw new AccessError("A line discount exceeds its line subtotal.");
      }

      return {
        id: item.id,
        businessId: access.business.id,
        saleId: input.saleId,
        productId: product.id,
        productNameSnapshot: product.name,
        quantity: databaseQuantity(quantity),
        unitPriceCents: product.priceCents,
        unitCostCents: product.costCents,
        discountCents,
        lineTotalCents: beforeDiscount - discountCents,
        beforeDiscount,
        requiresRecipeDeduction: product.requiresRecipeDeduction,
      };
    });
    const subtotalCents = addCents(
      ...itemRows.map((item) => item.beforeDiscount),
    );
    const discountCents = addCents(
      ...itemRows.map((item) => item.discountCents),
    );
    const totalCents = subtotalCents - discountCents;
    if (totalCents <= 0) {
      throw new AccessError("A completed sale must have a positive total.");
    }

    const { amountPaidCents, changeCents } = calculateSaleTender(
      input.payments,
      totalCents,
    );

    const [createdSale] = await tx
      .insert(sales)
      .values({
        id: input.saleId,
        businessId: access.business.id,
        shiftId: shift.id,
        sellingLocationId: shift.sellingLocationId,
        saleNumber: `SALE-${input.saleId}`,
        status: "completed",
        subtotalCents,
        discountCents,
        totalCents,
        amountPaidCents,
        changeCents,
        soldBy: access.employee.id,
        clientGeneratedId: input.saleId,
      })
      .onConflictDoNothing({
        target: [sales.businessId, sales.clientGeneratedId],
      })
      .returning({ id: sales.id });

    if (!createdSale) {
      const raced = await findExistingSale(
        tx,
        access.business.id,
        input.saleId,
      );
      if (raced?.shiftId === input.shiftId) {
        return { ...raced, idempotent: true };
      }
      throw new AccessError("The sale request ID is already in use.");
    }

    await tx.insert(saleItems).values(
      itemRows.map((item) => ({
        id: item.id,
        businessId: item.businessId,
        saleId: item.saleId,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        unitCostCents: item.unitCostCents,
        discountCents: item.discountCents,
        lineTotalCents: item.lineTotalCents,
      })),
    );
    await tx.insert(payments).values(
      input.payments.map((payment) => ({
        id: payment.id,
        businessId: access.business.id,
        saleId: input.saleId,
        paymentMethod: payment.paymentMethod,
        amountCents: payment.amountCents,
        referenceNumber: payment.referenceNumber?.trim() || null,
        status: "completed" as const,
        clientGeneratedId: payment.id,
      })),
    );

    await deductSaleInventory(tx, {
      businessId: access.business.id,
      shiftId: shift.id,
      inventoryLocationId: inventoryLocation.id,
      inventoryEventId: input.inventoryEventId,
      saleId: input.saleId,
      employeeId: access.employee.id,
      items: itemRows,
    });

    await insertAuditLog(tx, access, {
      action: "sale.finalized",
      entityType: "sale",
      entityId: input.saleId,
      shiftId: shift.id,
      metadata: {
        subtotalCents,
        discountCents,
        totalCents,
        amountPaidCents,
        changeCents,
        itemCount: input.items.length,
        paymentCount: input.payments.length,
      },
    });

    return {
      id: input.saleId,
      shiftId: shift.id,
      totalCents,
      amountPaidCents,
      changeCents,
      idempotent: false,
    };
  });
}
