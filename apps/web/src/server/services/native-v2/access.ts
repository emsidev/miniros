import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  businessMembers,
  businesses,
  employees,
  shiftAssignments,
} from "@miniros/db/schema";
import {
  NativeAccessError,
  assertNativeIdentity,
  type NativeIdentity,
} from "./auth";
import type { NativeTransaction } from "./types";

export async function requireNativeMember(
  tx: NativeTransaction,
  identity: NativeIdentity,
  businessId: string,
  owner = false,
) {
  assertNativeIdentity(identity);
  const [member] = await tx
    .select({ id: businessMembers.id, role: businessMembers.role })
    .from(businessMembers)
    .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
    .where(
      and(
        eq(businessMembers.businessId, businessId),
        eq(businessMembers.authUserId, identity.userId),
        eq(businessMembers.status, "active"),
        isNull(businessMembers.deletedAt),
        eq(businesses.status, "active"),
        isNull(businesses.deletedAt),
      ),
    )
    .for("share")
    .limit(1);
  if (!member || (owner && !["owner", "admin"].includes(member.role)))
    throw new NativeAccessError();
  return member;
}
export async function requireNativeAssignment(
  tx: NativeTransaction,
  businessId: string,
  shiftId: string,
  userId: string,
  role: "cashier" | "prep",
) {
  const [row] = await tx
    .select({
      employeeId: employees.id,
      assignmentId: shiftAssignments.id,
      canUsePos: employees.canUsePos,
      canLogProduction: employees.canLogProduction,
      roleOnShift: shiftAssignments.roleOnShift,
    })
    .from(businessMembers)
    .innerJoin(
      employees,
      and(
        eq(employees.memberId, businessMembers.id),
        eq(employees.businessId, businessMembers.businessId),
      ),
    )
    .innerJoin(
      shiftAssignments,
      and(
        eq(shiftAssignments.employeeId, employees.id),
        eq(shiftAssignments.businessId, employees.businessId),
      ),
    )
    .where(
      and(
        eq(businessMembers.businessId, businessId),
        eq(businessMembers.authUserId, userId),
        eq(businessMembers.status, "active"),
        isNull(businessMembers.deletedAt),
        eq(employees.status, "active"),
        isNull(employees.deletedAt),
        eq(shiftAssignments.shiftId, shiftId),
        inArray(shiftAssignments.status, ["assigned", "confirmed"]),
      ),
    )
    .for("share")
    .limit(1);
  if (
    !row ||
    (role === "cashier"
      ? !row.canUsePos || row.roleOnShift !== "operator"
      : !row.canLogProduction || row.roleOnShift !== "employee")
  ) {
    throw new NativeAccessError(
      "ASSIGNMENT",
      "The current shift assignment does not permit this device role.",
    );
  }
  return row;
}
