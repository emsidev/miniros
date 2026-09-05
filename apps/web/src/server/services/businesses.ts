import { assertDeviceCanLeave } from "./offline-context";
import { randomUUID } from "node:crypto";
import { defaultProductCategories } from "@miniros/contracts";
import { requireDatabase } from "@miniros/db";
import {
  validateBusinessFeatureFlags,
  type BusinessFeatureFlags,
} from "@miniros/domain";
import {
  auditLogs,
  businessMembers,
  businesses,
  cashDeductions,
  employees,
  inventoryAdjustments,
  productCategories,
} from "@miniros/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import {
  ACTIVE_BUSINESS_COOKIE,
  AccessError,
  requireActiveBusiness,
  requireUser,
} from "./access";
import { claimMembershipInvitations } from "./invitations";
import {
  loadProductCostBreakdowns,
  recalculateProductCosts,
} from "./product-costing";

function businessSlug(name: string, id: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${base || "business"}-${id.slice(0, 8)}`;
}

async function setActiveBusinessCookie(businessId: string) {
  const user = await requireUser();
  await assertDeviceCanLeave(user.id);
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, businessId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function listBusinesses() {
  const user = await requireUser();
  await claimMembershipInvitations(user);
  const database = requireDatabase();
  const cookieStore = await cookies();
  const activeBusinessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;

  const rows = await database
    .select({
      id: businesses.id,
      name: businesses.name,
      role: businessMembers.role,
      canUsePos: employees.canUsePos,
      canLogProduction: employees.canLogProduction,
    })
    .from(businessMembers)
    .innerJoin(businesses, eq(businessMembers.businessId, businesses.id))
    .leftJoin(
      employees,
      and(
        eq(employees.businessId, businesses.id),
        eq(employees.memberId, businessMembers.id),
        eq(employees.status, "active"),
        isNull(employees.deletedAt),
      ),
    )
    .where(
      and(
        eq(businessMembers.authUserId, user.id),
        eq(businessMembers.status, "active"),
        isNull(businessMembers.deletedAt),
        eq(businesses.status, "active"),
        isNull(businesses.deletedAt),
      ),
    )
    .orderBy(asc(businesses.name));

  return rows.map((row) => ({
    ...row,
    isActive: row.id === activeBusinessId,
  }));
}

export async function createBusiness(input: { name: string }) {
  const user = await requireUser();
  const database = requireDatabase();
  const businessId = randomUUID();
  const memberId = randomUUID();
  const employeeId = randomUUID();
  const name = input.name.trim();

  const business = await database.transaction(async (tx) => {
    const [created] = await tx
      .insert(businesses)
      .values({
        id: businessId,
        name,
        slug: businessSlug(name, businessId),
        createdBy: user.id,
      })
      .returning({ id: businesses.id, name: businesses.name });

    await tx.insert(businessMembers).values({
      id: memberId,
      businessId,
      authUserId: user.id,
      role: "owner",
      status: "active",
      approvedBy: user.id,
      approvedAt: new Date(),
    });

    await tx.insert(employees).values({
      id: employeeId,
      businessId,
      memberId,
      displayName:
        typeof user.user_metadata.full_name === "string"
          ? user.user_metadata.full_name
          : (user.email ?? "Owner"),
      email: user.email,
      canUsePos: true,
      canLogProduction: true,
    });

    await tx.insert(productCategories).values(
      defaultProductCategories.map((category) => ({
        id: randomUUID(),
        businessId,
        name: category.name,
        sortOrder: category.sortOrder,
      })),
    );

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId,
      actorUserId: user.id,
      actorEmployeeId: employeeId,
      action: "business.created",
      entityType: "business",
      entityId: businessId,
      metadata: { name },
    });

    return created;
  });

  await setActiveBusinessCookie(businessId);
  return business;
}

export async function switchActiveBusiness(businessId: string) {
  const user = await requireUser();
  const database = requireDatabase();
  const [membership] = await database
    .select({ id: businessMembers.id })
    .from(businessMembers)
    .innerJoin(businesses, eq(businessMembers.businessId, businesses.id))
    .where(
      and(
        eq(businessMembers.businessId, businessId),
        eq(businessMembers.authUserId, user.id),
        eq(businessMembers.status, "active"),
        isNull(businessMembers.deletedAt),
        eq(businesses.status, "active"),
        isNull(businesses.deletedAt),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new AccessError("You do not have access to this business.");
  }

  await setActiveBusinessCookie(businessId);
  return { businessId };
}

export async function getBusinessSettings() {
  const { business } = await requireActiveBusiness({ admin: true });
  const database = requireDatabase();
  const [record] = await database
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      status: businesses.status,
      recipesEnabled: businesses.recipesEnabled,
      productionEnabled: businesses.productionEnabled,
      approvalsEnabled: businesses.approvalsEnabled,
      promosEnabled: businesses.promosEnabled,
      createdAt: businesses.createdAt,
      updatedAt: businesses.updatedAt,
    })
    .from(businesses)
    .where(
      and(
        eq(businesses.id, business.id),
        eq(businesses.status, "active"),
        isNull(businesses.deletedAt),
      ),
    )
    .limit(1);

  if (!record) throw new AccessError("Business not found.");
  return record;
}

function toFeatureFlags(record: {
  recipesEnabled: boolean;
  productionEnabled: boolean;
  approvalsEnabled: boolean;
  promosEnabled: boolean;
}): BusinessFeatureFlags {
  return {
    recipesEnabled: record.recipesEnabled,
    productionEnabled: record.productionEnabled,
    approvalsEnabled: record.approvalsEnabled,
    promosEnabled: record.promosEnabled,
  };
}

export async function updateBusinessFeatures(input: BusinessFeatureFlags) {
  const access = await requireActiveBusiness({ admin: true });
  let features: BusinessFeatureFlags;
  try {
    features = validateBusinessFeatureFlags(input);
  } catch (error) {
    throw new AccessError(
      error instanceof Error ? error.message : "Invalid feature settings.",
    );
  }

  const database = requireDatabase();
  return database.transaction(async (tx) => {
    if (!features.approvalsEnabled) {
      const [pendingCash, pendingInventory] = await Promise.all([
        tx
          .select({ id: cashDeductions.id })
          .from(cashDeductions)
          .where(
            and(
              eq(cashDeductions.businessId, access.business.id),
              eq(cashDeductions.status, "pending"),
            ),
          )
          .limit(1),
        tx
          .select({ id: inventoryAdjustments.id })
          .from(inventoryAdjustments)
          .where(
            and(
              eq(inventoryAdjustments.businessId, access.business.id),
              eq(inventoryAdjustments.status, "pending"),
            ),
          )
          .limit(1),
      ]);

      if (pendingCash[0] || pendingInventory[0]) {
        throw new AccessError(
          "Review or reject all pending approvals before turning Approvals off.",
        );
      }
    }

    const [current] = await tx
      .select({
        recipesEnabled: businesses.recipesEnabled,
        productionEnabled: businesses.productionEnabled,
        approvalsEnabled: businesses.approvalsEnabled,
        promosEnabled: businesses.promosEnabled,
      })
      .from(businesses)
      .where(
        and(
          eq(businesses.id, access.business.id),
          eq(businesses.status, "active"),
          isNull(businesses.deletedAt),
        ),
      )
      .for("update")
      .limit(1);

    if (!current) throw new AccessError("Business not found.");
    const previousBreakdowns =
      current.recipesEnabled !== features.recipesEnabled
        ? await loadProductCostBreakdowns(tx, {
            businessId: access.business.id,
            recipesEnabled: current.recipesEnabled,
          })
        : undefined;
    const updatedAt = new Date();
    const [updated] = await tx
      .update(businesses)
      .set({ ...features, updatedAt })
      .where(eq(businesses.id, access.business.id))
      .returning({
        recipesEnabled: businesses.recipesEnabled,
        productionEnabled: businesses.productionEnabled,
        approvalsEnabled: businesses.approvalsEnabled,
        promosEnabled: businesses.promosEnabled,
        updatedAt: businesses.updatedAt,
      });

    if (!updated) throw new AccessError("Business not found.");
    const costRecalculations =
      current.recipesEnabled !== updated.recipesEnabled
        ? await recalculateProductCosts(tx, {
            businessId: access.business.id,
            recipesEnabled: updated.recipesEnabled,
            previousRecipesEnabled: current.recipesEnabled,
            trigger: updated.recipesEnabled
              ? "recipes_feature_enabled"
              : "recipes_feature_disabled",
            actorUserId: access.user.id,
            actorEmployeeId: access.employee?.id ?? null,
            previousBreakdowns,
          })
        : [];
    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "business.features_updated",
      entityType: "business",
      entityId: access.business.id,
      metadata: {
        before: toFeatureFlags(current),
        after: toFeatureFlags(updated),
        recalculatedProductCount: costRecalculations.length,
      },
    });

    return { ...toFeatureFlags(updated), updatedAt: updated.updatedAt };
  });
}

export async function updateBusinessSettings(input: { name: string }) {
  const access = await requireActiveBusiness({ admin: true });
  const name = input.name.trim();
  const database = requireDatabase();

  return database.transaction(async (tx) => {
    const [updated] = await tx
      .update(businesses)
      .set({ name, updatedAt: new Date() })
      .where(
        and(
          eq(businesses.id, access.business.id),
          eq(businesses.status, "active"),
          isNull(businesses.deletedAt),
        ),
      )
      .returning({
        id: businesses.id,
        name: businesses.name,
        slug: businesses.slug,
        status: businesses.status,
        updatedAt: businesses.updatedAt,
      });

    if (!updated) throw new AccessError("Business not found.");

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "business.settings_updated",
      entityType: "business",
      entityId: access.business.id,
      metadata: { name: updated.name },
    });

    return updated;
  });
}
