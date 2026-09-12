import { randomUUID } from "node:crypto";
import { requireDatabase } from "@miniros/db";
import { employees, auditLogs, businessMembers } from "@miniros/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { AccessError, requireActiveBusiness } from "./access";

export async function enableMySellingAccess() {
  const access = await requireActiveBusiness({ admin: true });
  if (access.membership.role !== "owner")
    throw new AccessError("Only the owner can enable Sell myself.");
  return requireDatabase().transaction(async (tx) => {
    await tx
      .select({ id: businessMembers.id })
      .from(businessMembers)
      .where(
        and(
          eq(businessMembers.id, access.membership.id),
          eq(businessMembers.businessId, access.business.id),
        ),
      )
      .for("update");
    const [existing] = await tx
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.businessId, access.business.id),
          eq(employees.memberId, access.membership.id),
        ),
      )
      .limit(1);
    if (existing && (existing.deletedAt || existing.status !== "active"))
      throw new AccessError(
        "Reactivate your staff record in People before selling.",
      );
    const id = existing?.id ?? randomUUID();
    if (existing)
      await tx
        .update(employees)
        .set({ canUsePos: true, updatedAt: new Date() })
        .where(
          and(
            eq(employees.id, id),
            eq(employees.businessId, access.business.id),
            isNull(employees.deletedAt),
          ),
        );
    else
      await tx
        .insert(employees)
        .values({
          id,
          businessId: access.business.id,
          memberId: access.membership.id,
          displayName: String(access.user.user_metadata?.full_name ?? "Owner"),
          email: access.user.email ?? null,
          canUsePos: true,
          canLogProduction: false,
          defaultShiftRateCents: 0,
        });
    if (!existing?.canUsePos)
      await tx
        .insert(auditLogs)
        .values({
          id: randomUUID(),
          businessId: access.business.id,
          actorUserId: access.user.id,
          actorEmployeeId: id,
          action: "owner.selling_enabled",
          entityType: "employee",
          entityId: id,
        });
    return {
      id,
      displayName:
        existing?.displayName ??
        String(access.user.user_metadata?.full_name ?? "Owner"),
      defaultShiftRateCents: existing?.defaultShiftRateCents ?? 0,
      canUsePos: true,
      available: true,
    };
  });
}
