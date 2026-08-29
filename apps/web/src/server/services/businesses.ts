import { randomUUID } from "node:crypto";
import { requireDatabase } from "@miniros/db";
import {
  auditLogs,
  businessMembers,
  businesses,
  employees,
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

function businessSlug(name: string, id: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${base || "business"}-${id.slice(0, 8)}`;
}

async function setActiveBusinessCookie(businessId: string) {
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
    })
    .from(businessMembers)
    .innerJoin(businesses, eq(businessMembers.businessId, businesses.id))
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
