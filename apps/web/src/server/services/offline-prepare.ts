import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { requireDatabase } from "@miniros/db";
import {
  offlineShiftSessions,
  products,
  productCategories,
  productProductionOutputs,
  productRecipeItems,
  inventoryItems,
  inventoryLocations,
  sellingLocations,
  shiftAssignments,
  shiftCosts,
  promoRules,
} from "@miniros/db/schema";
import type { PreparedShift, PreparedSnapshot } from "@miniros/contracts";
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { AccessError, requireActiveBusiness } from "./access";
import { lockShift } from "./offline-context";
import { insertAuditLog, requireEmployee } from "./operational-helpers";

export async function storageInstallationId() {
  const value = (await headers()).get("x-miniros-storage");
  if (
    !value ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new AccessError(
      "Open the original app or browser storage before preparing or synchronizing work.",
    );
  return value;
}
const DEVICE_COOKIE = "miniros-installation";
export async function installationId(create = false) {
  const jar = await cookies();
  let secret = jar.get(DEVICE_COOKIE)?.value;
  if (!secret && create) {
    secret = randomBytes(32).toString("hex");
    jar.set(DEVICE_COOKIE, secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 365 * 86400,
    });
  }
  return secret ? createHash("sha256").update(secret).digest("hex") : null;
}
export function publicSession(
  row: typeof offlineShiftSessions.$inferSelect,
): PreparedShift {
  return {
    id: row.id,
    deviceId: row.deviceId,
    snapshot: row.snapshot as PreparedSnapshot,
    status: row.status as PreparedShift["status"],
    acknowledgedSequence: row.acknowledgedSequence,
    lastError: row.lastError,
  };
}

export async function prepareOfflineShift(shiftId: string) {
  const access = await requireActiveBusiness({
    employeePermission: "pos",
    assignedShiftId: shiftId,
  });
  requireEmployee(access);
  const deviceId = (await installationId(true))!;
  const storageId = await storageInstallationId();
  return requireDatabase().transaction(
    async (tx) => {
      const shift = await lockShift(tx, access.business.id, shiftId);
      const [existing] = await tx
        .select()
        .from(offlineShiftSessions)
        .where(
          and(
            eq(offlineShiftSessions.businessId, access.business.id),
            eq(offlineShiftSessions.shiftId, shiftId),
            notInArray(offlineShiftSessions.status, ["closed", "released"]),
          ),
        )
        .limit(1);
      if (existing) {
        if (
          existing.deviceId !== deviceId ||
          existing.userId !== access.user.id ||
          (existing.snapshot as PreparedSnapshot).storageInstallationId !==
            storageId
        )
          throw new AccessError(
            "Another device or app/browser storage owns this shift. Synchronize and release it before preparing this device.",
          );
        return publicSession(existing);
      }
      if (shift.status !== "scheduled")
        throw new AccessError("Prepare a scheduled shift before starting it.");
      const [location] = await tx
        .select({ name: sellingLocations.name })
        .from(sellingLocations)
        .where(
          and(
            eq(sellingLocations.id, shift.sellingLocationId),
            eq(sellingLocations.businessId, access.business.id),
            eq(sellingLocations.status, "active"),
            isNull(sellingLocations.deletedAt),
          ),
        )
        .limit(1);
      if (!location)
        throw new AccessError("The selling location is unavailable.");
      const [catalog, inventory, recipes, assignments, costs, promos] =
        await Promise.all([
          tx
            .select({
              id: products.id,
              name: products.name,
              priceCents: products.priceCents,
              costCents: products.costCents,
              requiresRecipeDeduction: products.requiresRecipeDeduction,
              categoryName: productCategories.name,
              producedInventoryItemId: productProductionOutputs.inventoryItemId,
            })
            .from(products)
            .leftJoin(
              productCategories,
              and(
                eq(productCategories.id, products.categoryId),
                eq(productCategories.businessId, products.businessId),
              ),
            )
            .leftJoin(
              productProductionOutputs,
              and(
                eq(productProductionOutputs.productId, products.id),
                eq(productProductionOutputs.businessId, products.businessId),
              ),
            )
            .where(
              and(
                eq(products.businessId, access.business.id),
                eq(products.status, "active"),
                eq(products.isSellable, true),
                isNull(products.deletedAt),
              ),
            ),
          tx
            .select({
              id: inventoryItems.id,
              name: inventoryItems.name,
              unit: inventoryItems.unit,
              defaultUnitCostCents: inventoryItems.defaultUnitCostCents,
            })
            .from(inventoryItems)
            .where(
              and(
                eq(inventoryItems.businessId, access.business.id),
                eq(inventoryItems.status, "active"),
                eq(inventoryItems.trackStock, true),
                isNull(inventoryItems.deletedAt),
              ),
            ),
          tx
            .select({
              productId: productRecipeItems.productId,
              inventoryItemId: productRecipeItems.inventoryItemId,
              quantityPerProduct: productRecipeItems.quantity,
              unit: productRecipeItems.unit,
            })
            .from(productRecipeItems)
            .where(
              and(
                eq(productRecipeItems.businessId, access.business.id),
                isNull(productRecipeItems.deletedAt),
              ),
            ),
          tx
            .select({ salary: shiftAssignments.salaryRateCents })
            .from(shiftAssignments)
            .where(
              and(
                eq(shiftAssignments.businessId, access.business.id),
                eq(shiftAssignments.shiftId, shiftId),
                inArray(shiftAssignments.status, ["assigned", "confirmed"]),
              ),
            ),
          tx
            .select()
            .from(shiftCosts)
            .where(
              and(
                eq(shiftCosts.businessId, access.business.id),
                eq(shiftCosts.shiftId, shiftId),
              ),
            ),
          tx
            .select()
            .from(promoRules)
            .where(
              and(
                eq(promoRules.businessId, access.business.id),
                eq(promoRules.status, "active"),
              ),
            ),
        ]);
      if (!catalog.length)
        throw new AccessError(
          "Add a sellable product before preparing a shift.",
        );
      if (!inventory.length || inventory.length > 500)
        throw new AccessError(
          "Offline shifts need between 1 and 500 active inventory items for opening and closing counts.",
        );
      for (const product of catalog) {
        const required = product.producedInventoryItemId
          ? [{ inventoryItemId: product.producedInventoryItemId }]
          : access.business.features.recipesEnabled &&
              product.requiresRecipeDeduction
            ? recipes.filter((row) => row.productId === product.id)
            : [];
        if (
          access.business.features.recipesEnabled &&
          product.requiresRecipeDeduction &&
          !product.producedInventoryItemId &&
          !required.length
        )
          throw new AccessError(
            `Complete the recipe for ${product.name} before preparing.`,
          );
        if (
          required.some(
            (row) => !inventory.some((item) => item.id === row.inventoryItemId),
          )
        )
          throw new AccessError(
            `Activate stock tracking for the inventory used by ${product.name} before preparing.`,
          );
      }
      const [storedLocation] = await tx
        .select({ id: inventoryLocations.id })
        .from(inventoryLocations)
        .where(
          and(
            eq(inventoryLocations.businessId, access.business.id),
            eq(inventoryLocations.shiftId, shiftId),
            eq(inventoryLocations.status, "active"),
            isNull(inventoryLocations.deletedAt),
          ),
        )
        .limit(1);
      const now = new Date();
      const sumCost = (type: string) =>
        costs
          .filter((row) => row.costType === type)
          .reduce((sum, row) => sum + row.amountCents, 0);
      const snapshot: PreparedSnapshot = {
        schemaVersion: 1,
        storageInstallationId: storageId,
        id: randomUUID(),
        preparedAt: now.toISOString(),
        businessId: access.business.id,
        businessName: access.business.name,
        userId: access.user.id,
        employeeId: access.employee.id,
        shiftId,
        locationName: location.name,
        shiftDate: shift.shiftDate,
        inventoryLocationId: storedLocation?.id ?? randomUUID(),
        features: access.business.features,
        products: catalog,
        inventory,
        recipes,
        promos: access.business.features.promosEnabled
          ? promos
              .filter(
                (p) =>
                  (!p.startsAt || p.startsAt <= now) &&
                  (!p.endsAt || p.endsAt >= now),
              )
              .map((p) => ({
                id: p.id,
                name: p.name,
                requiresPhoto: p.requiresPhoto,
                discountType: p.discountType,
                discountValue: Number(p.discountValue),
              }))
          : [],
        costs: {
          rentCents: sumCost("rent"),
          transportCents: sumCost("transport"),
          otherCents: sumCost("other"),
          salaryCents: assignments.reduce((sum, row) => sum + row.salary, 0),
        },
      };
      const [row] = await tx
        .insert(offlineShiftSessions)
        .values({
          id: randomUUID(),
          businessId: access.business.id,
          shiftId,
          userId: access.user.id,
          deviceId,
          snapshotId: snapshot.id,
          snapshot,
        })
        .returning();
      if (!row) throw new Error("Preparation was not saved.");
      await insertAuditLog(tx, access, {
        action: "offline.prepared",
        entityType: "offline_shift_session",
        entityId: row.id,
        shiftId,
      });
      return publicSession(row);
    },
    { isolationLevel: "repeatable read" },
  );
}

export async function offlineIdentity() {
  const storageId = await storageInstallationId();
  const access = await requireActiveBusiness();
  const deviceId = await installationId();
  const sessions = deviceId
    ? await requireDatabase()
        .select()
        .from(offlineShiftSessions)
        .where(
          and(
            eq(offlineShiftSessions.businessId, access.business.id),
            eq(offlineShiftSessions.userId, access.user.id),
            eq(offlineShiftSessions.deviceId, deviceId),
            notInArray(offlineShiftSessions.status, ["released"]),
          ),
        )
    : [];
  for (const session of sessions.filter(
    (row) => !["closed", "released"].includes(row.status),
  ))
    await requireActiveBusiness({
      employeePermission: "pos",
      assignedShiftId: session.shiftId,
    });
  return {
    userId: access.user.id,
    businessId: access.business.id,
    deviceId,
    sessions: sessions
      .filter(
        (row) =>
          (row.snapshot as PreparedSnapshot).storageInstallationId ===
          storageId,
      )
      .map(publicSession),
  };
}

export async function reservedShiftDevice(shiftId: string) {
  const access = await requireActiveBusiness({ assignedShiftId: shiftId });
  const [session] = await requireDatabase()
    .select({
      id: offlineShiftSessions.id,
      userId: offlineShiftSessions.userId,
      deviceId: offlineShiftSessions.deviceId,
      status: offlineShiftSessions.status,
    })
    .from(offlineShiftSessions)
    .where(
      and(
        eq(offlineShiftSessions.businessId, access.business.id),
        eq(offlineShiftSessions.shiftId, shiftId),
        notInArray(offlineShiftSessions.status, ["closed", "released"]),
      ),
    )
    .limit(1);
  if (!session) return null;
  return {
    id: session.id,
    status: session.status,
    ownsDevice:
      session.userId === access.user.id &&
      session.deviceId === (await installationId()),
  };
}
