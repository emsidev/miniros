import { randomUUID } from "node:crypto";
import { requireDatabase } from "@miniros/db";
import { auditLogs, businessMembers, employees } from "@miniros/db/schema";
import type { User } from "@supabase/supabase-js";
import { and, eq, isNull, sql } from "drizzle-orm";

export async function claimMembershipInvitations(user: User) {
  const email = user.email?.trim().toLowerCase();
  if (!email) return [];

  const database = requireDatabase();
  return database.transaction(async (tx) => {
    const invitations = await tx
      .select({
        id: businessMembers.id,
        businessId: businessMembers.businessId,
      })
      .from(businessMembers)
      .where(
        and(
          isNull(businessMembers.authUserId),
          isNull(businessMembers.deletedAt),
          eq(businessMembers.status, "pending"),
          sql`lower(${businessMembers.invitedEmail}) = ${email}`,
        ),
      );

    const claimed: string[] = [];
    for (const invitation of invitations) {
      const [existing] = await tx
        .select({ id: businessMembers.id })
        .from(businessMembers)
        .where(
          and(
            eq(businessMembers.businessId, invitation.businessId),
            eq(businessMembers.authUserId, user.id),
            isNull(businessMembers.deletedAt),
          ),
        )
        .limit(1);

      const memberId = existing?.id ?? invitation.id;
      if (existing) {
        await tx
          .update(employees)
          .set({ memberId, updatedAt: new Date() })
          .where(
            and(
              eq(employees.businessId, invitation.businessId),
              eq(employees.memberId, invitation.id),
            ),
          );
        await tx
          .update(businessMembers)
          .set({
            status: "disabled",
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(businessMembers.id, invitation.id),
              eq(businessMembers.businessId, invitation.businessId),
              eq(businessMembers.status, "pending"),
            ),
          );
      } else {
        await tx
          .update(businessMembers)
          .set({
            authUserId: user.id,
            status: "active",
            approvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(businessMembers.id, invitation.id),
              eq(businessMembers.businessId, invitation.businessId),
              isNull(businessMembers.authUserId),
              eq(businessMembers.status, "pending"),
            ),
          );
      }

      await tx.insert(auditLogs).values({
        id: randomUUID(),
        businessId: invitation.businessId,
        actorUserId: user.id,
        action: "membership.invitation_claimed",
        entityType: "business_member",
        entityId: memberId,
        metadata: { email },
      });
      claimed.push(invitation.businessId);
    }

    return claimed;
  });
}
