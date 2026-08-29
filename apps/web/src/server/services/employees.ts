import { randomUUID } from "node:crypto";
import { requireDatabase } from "@miniros/db";
import { auditLogs, businessMembers, employees } from "@miniros/db/schema";
import { and, asc, eq, isNull, ne } from "drizzle-orm";

import { AccessError, requireActiveBusiness } from "./access";
import {
  employeeDto,
  nullableText,
  resolveEmployeeMember,
  type EmployeeWriteInput,
} from "./employee-member";

export type { EmployeeWriteInput } from "./employee-member";

export async function listEmployees() {
  const { business } = await requireActiveBusiness({ admin: true });
  const rows = await requireDatabase()
    .select({
      employee: employees,
      memberId: businessMembers.id,
      memberAuthUserId: businessMembers.authUserId,
      memberRole: businessMembers.role,
      memberStatus: businessMembers.status,
      invitedEmail: businessMembers.invitedEmail,
    })
    .from(employees)
    .leftJoin(
      businessMembers,
      and(
        eq(employees.memberId, businessMembers.id),
        eq(businessMembers.businessId, business.id),
      ),
    )
    .where(
      and(
        eq(employees.businessId, business.id),
        isNull(employees.deletedAt),
        ne(employees.status, "deleted"),
      ),
    )
    .orderBy(asc(employees.displayName));

  return rows.map((row) =>
    employeeDto(
      row.employee,
      row.memberId
        ? {
            id: row.memberId,
            authUserId: row.memberAuthUserId,
            role: row.memberRole!,
            status: row.memberStatus!,
            invitedEmail: row.invitedEmail,
          }
        : null,
    ),
  );
}

export async function createEmployee(input: EmployeeWriteInput) {
  const access = await requireActiveBusiness({ admin: true });
  return requireDatabase().transaction(async (tx) => {
    const member = await resolveEmployeeMember(tx, input, access.business.id);
    const normalizedEmail = nullableText(input.email)?.toLowerCase() ?? null;
    const [deletedEmployee] = normalizedEmail
      ? await tx
          .select()
          .from(employees)
          .where(
            and(
              eq(employees.businessId, access.business.id),
              eq(employees.email, normalizedEmail),
              eq(employees.status, "deleted"),
            ),
          )
          .limit(1)
      : [];

    const values = {
      memberId: member?.id ?? null,
      displayName: input.displayName.trim(),
      email: normalizedEmail,
      phone: nullableText(input.phone),
      status: input.status,
      defaultShiftRateCents: input.defaultShiftRateCents,
      canUsePos: input.canUsePos,
      canLogProduction: input.canLogProduction,
      deletedAt: null,
      updatedAt: new Date(),
    };
    const [created] = deletedEmployee
      ? await tx
          .update(employees)
          .set(values)
          .where(
            and(
              eq(employees.id, deletedEmployee.id),
              eq(employees.businessId, access.business.id),
            ),
          )
          .returning()
      : await tx
          .insert(employees)
          .values({
            id: randomUUID(),
            businessId: access.business.id,
            ...values,
          })
          .returning();
    if (!created) throw new Error("Employee write did not return a row.");

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: deletedEmployee ? "employee.restored" : "employee.created",
      entityType: "employee",
      entityId: created.id,
      metadata: {
        displayName: created.displayName,
        memberId: member?.id ?? null,
        memberStatus: member?.status ?? null,
        canUsePos: created.canUsePos,
        canLogProduction: created.canLogProduction,
      },
    });
    return employeeDto(created, member);
  });
}

export async function updateEmployee(
  employeeId: string,
  input: EmployeeWriteInput,
) {
  const access = await requireActiveBusiness({ admin: true });
  return requireDatabase().transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(employees)
      .where(
        and(
          eq(employees.id, employeeId),
          eq(employees.businessId, access.business.id),
          isNull(employees.deletedAt),
          ne(employees.status, "deleted"),
        ),
      )
      .limit(1);
    if (!existing) throw new AccessError("Employee not found.");

    const member = await resolveEmployeeMember(
      tx,
      input,
      access.business.id,
      existing.memberId,
      employeeId,
    );
    const [updated] = await tx
      .update(employees)
      .set({
        memberId: member?.id ?? null,
        displayName: input.displayName.trim(),
        email: nullableText(input.email)?.toLowerCase() ?? null,
        phone: nullableText(input.phone),
        status: input.status,
        defaultShiftRateCents: input.defaultShiftRateCents,
        canUsePos: input.canUsePos,
        canLogProduction: input.canLogProduction,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(employees.id, employeeId),
          eq(employees.businessId, access.business.id),
        ),
      )
      .returning();
    if (!updated) throw new Error("Employee update did not return a row.");

    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "employee.updated",
      entityType: "employee",
      entityId: employeeId,
      metadata: {
        previousStatus: existing.status,
        status: updated.status,
        canUsePos: updated.canUsePos,
        canLogProduction: updated.canLogProduction,
      },
    });
    return employeeDto(updated, member);
  });
}

export async function softDeleteEmployee(employeeId: string) {
  const access = await requireActiveBusiness({ admin: true });
  return requireDatabase().transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: employees.id,
        memberId: employees.memberId,
        displayName: employees.displayName,
      })
      .from(employees)
      .where(
        and(
          eq(employees.id, employeeId),
          eq(employees.businessId, access.business.id),
          isNull(employees.deletedAt),
          ne(employees.status, "deleted"),
        ),
      )
      .limit(1);
    if (!existing) throw new AccessError("Employee not found.");
    if (access.employee?.id === employeeId) {
      throw new AccessError("You cannot delete your own employee record.");
    }

    const deletedAt = new Date();
    await tx
      .update(employees)
      .set({ status: "deleted", deletedAt, updatedAt: deletedAt })
      .where(
        and(
          eq(employees.id, employeeId),
          eq(employees.businessId, access.business.id),
        ),
      );
    if (existing.memberId) {
      const [member] = await tx
        .select({ role: businessMembers.role })
        .from(businessMembers)
        .where(
          and(
            eq(businessMembers.id, existing.memberId),
            eq(businessMembers.businessId, access.business.id),
          ),
        )
        .limit(1);
      if (member?.role === "employee" || member?.role === "operator") {
        await tx
          .update(businessMembers)
          .set({ status: "disabled", deletedAt, updatedAt: deletedAt })
          .where(
            and(
              eq(businessMembers.id, existing.memberId),
              eq(businessMembers.businessId, access.business.id),
            ),
          );
      }
    }
    await tx.insert(auditLogs).values({
      id: randomUUID(),
      businessId: access.business.id,
      actorUserId: access.user.id,
      actorEmployeeId: access.employee?.id ?? null,
      action: "employee.deleted",
      entityType: "employee",
      entityId: employeeId,
      metadata: { displayName: existing.displayName },
    });
    return { id: employeeId, deletedAt: deletedAt.toISOString() };
  });
}
