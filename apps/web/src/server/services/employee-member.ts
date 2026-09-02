import { randomUUID } from "node:crypto";
import type { Database } from "@miniros/db";
import { businessMembers, employees } from "@miniros/db/schema";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import { AccessError } from "./access";

export type EmployeeWriteInput = {
  memberId: string | null;
  memberRole: "admin" | "employee";
  displayName: string;
  email: string | null;
  phone: string | null;
  status: "active" | "inactive";
  defaultShiftRateCents: number;
  canUsePos: boolean;
  canLogProduction: boolean;
};
export type MemberSummary = {
  id: string;
  authUserId: string | null;
  role: (typeof businessMembers.$inferSelect)["role"];
  status: (typeof businessMembers.$inferSelect)["status"];
  invitedEmail: string | null;
};
type DatabaseTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

const memberSelection = {
  id: businessMembers.id,
  authUserId: businessMembers.authUserId,
  role: businessMembers.role,
  status: businessMembers.status,
  invitedEmail: businessMembers.invitedEmail,
};

export function nullableText(value: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

export function employeeDto(
  row: typeof employees.$inferSelect,
  member: MemberSummary | null = null,
) {
  return {
    id: row.id,
    memberId: row.memberId,
    displayName: row.displayName,
    email: row.email,
    phone: row.phone,
    status: row.status,
    defaultShiftRateCents: row.defaultShiftRateCents,
    canUsePos: row.canUsePos,
    canLogProduction: row.canLogProduction,
    memberRole: member?.role ?? null,
    memberStatus: member?.status ?? null,
    invitedEmail: member?.invitedEmail ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function resolveEmployeeMember(
  tx: DatabaseTransaction,
  input: EmployeeWriteInput,
  businessId: string,
  currentMemberId: string | null = null,
  excludeEmployeeId: string | null = null,
): Promise<MemberSummary | null> {
  const requestedMemberId = input.memberId ?? currentMemberId;
  let member: MemberSummary | null = null;

  if (requestedMemberId) {
    const [scopedMember] = await tx
      .select(memberSelection)
      .from(businessMembers)
      .where(
        and(
          eq(businessMembers.id, requestedMemberId),
          eq(businessMembers.businessId, businessId),
          inArray(businessMembers.status, ["active", "pending"]),
          isNull(businessMembers.deletedAt),
        ),
      )
      .limit(1);
    if (!scopedMember)
      throw new AccessError("The selected member is not available.");
    member = scopedMember;

    if (
      member.status === "pending" &&
      !member.authUserId &&
      input.email &&
      member.invitedEmail?.toLowerCase() !== input.email.trim().toLowerCase()
    ) {
      const [updated] = await tx
        .update(businessMembers)
        .set({
          invitedEmail: input.email.trim().toLowerCase(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(businessMembers.id, member.id),
            eq(businessMembers.businessId, businessId),
          ),
        )
        .returning(memberSelection);
      if (!updated)
        throw new Error("Employee invitation update did not return a row.");
      member = updated;
    }

    if (member.role !== "owner" && member.role !== input.memberRole) {
      const [updated] = await tx
        .update(businessMembers)
        .set({ role: input.memberRole, updatedAt: new Date() })
        .where(
          and(
            eq(businessMembers.id, member.id),
            eq(businessMembers.businessId, businessId),
          ),
        )
        .returning(memberSelection);
      if (!updated)
        throw new Error("Employee role update did not return a row.");
      member = updated;
    }
  } else if (input.email) {
    const email = input.email.trim().toLowerCase();
    const matches = await tx
      .select(memberSelection)
      .from(businessMembers)
      .where(
        and(
          eq(businessMembers.businessId, businessId),
          sql`lower(${businessMembers.invitedEmail}) = ${email}`,
        ),
      );
    member =
      matches.find((candidate) => candidate.status === "active") ??
      matches.find((candidate) => candidate.status === "pending") ??
      matches[0] ??
      null;

    if (!member) {
      const [created] = await tx
        .insert(businessMembers)
        .values({
          id: randomUUID(),
          businessId,
          role: input.memberRole,
          status: "pending",
          invitedEmail: email,
        })
        .returning(memberSelection);
      if (!created)
        throw new Error("Employee invitation insert did not return a row.");
      member = created;
    } else if (member.status === "rejected" || member.status === "disabled") {
      const hasAccount = Boolean(member.authUserId);
      const [reopened] = await tx
        .update(businessMembers)
        .set({
          role: member.role === "owner" ? "owner" : input.memberRole,
          status: hasAccount ? "active" : "pending",
          invitedEmail: email,
          approvedBy: null,
          approvedAt: hasAccount ? new Date() : null,
          deletedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(businessMembers.id, member.id),
            eq(businessMembers.businessId, businessId),
          ),
        )
        .returning(memberSelection);
      if (!reopened)
        throw new Error("Employee invitation update did not return a row.");
      member = reopened;
    }

    if (member && member.role !== "owner" && member.role !== input.memberRole) {
      const [updated] = await tx
        .update(businessMembers)
        .set({ role: input.memberRole, updatedAt: new Date() })
        .where(
          and(
            eq(businessMembers.id, member.id),
            eq(businessMembers.businessId, businessId),
          ),
        )
        .returning(memberSelection);
      if (!updated)
        throw new Error("Employee role update did not return a row.");
      member = updated;
    }
  }

  if (!member && input.canUsePos) {
    throw new AccessError(
      "A POS operator needs an email address or a member link.",
    );
  }
  if (member) {
    const conditions = [
      eq(employees.businessId, businessId),
      eq(employees.memberId, member.id),
      isNull(employees.deletedAt),
      ne(employees.status, "deleted"),
    ];
    if (excludeEmployeeId) conditions.push(ne(employees.id, excludeEmployeeId));
    const [linked] = await tx
      .select({ id: employees.id })
      .from(employees)
      .where(and(...conditions))
      .limit(1);
    if (linked)
      throw new AccessError("That member already has an employee record.");
  }
  return member;
}
