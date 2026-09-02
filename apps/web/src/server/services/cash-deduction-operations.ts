import { requireDatabase } from "@miniros/db";
import { cashDeductions, shifts } from "@miniros/db/schema";
import { assertNonNegativeCents } from "@miniros/domain";
import { and, eq, isNull } from "drizzle-orm";

import { AccessError, requireActiveBusiness } from "./access";
import {
  insertAuditLog,
  requireCurrentAssignment,
  requireEmployee,
} from "./operational-helpers";

export type SubmitCashDeductionInput = {
  deductionId: string;
  shiftId: string;
  label: string;
  amountCents: number;
  reason?: string | null;
};

export async function submitCashDeduction(input: SubmitCashDeductionInput) {
  const access = await requireActiveBusiness({
    employeePermission: "pos",
    assignedShiftId: input.shiftId,
  });
  requireEmployee(access);
  assertNonNegativeCents(input.amountCents, "amountCents");
  if (input.amountCents === 0) {
    throw new AccessError("A cash deduction must be positive.");
  }

  return requireDatabase().transaction(async (tx) => {
    const approvalsEnabled = access.business.features.approvalsEnabled;
    const [existing] = await tx
      .select({
        id: cashDeductions.id,
        shiftId: cashDeductions.shiftId,
        status: cashDeductions.status,
        amountCents: cashDeductions.amountCents,
      })
      .from(cashDeductions)
      .where(
        and(
          eq(cashDeductions.id, input.deductionId),
          eq(cashDeductions.businessId, access.business.id),
        ),
      )
      .limit(1);
    if (existing) {
      if (existing.shiftId !== input.shiftId) {
        throw new AccessError("The cash deduction ID is already in use.");
      }
      return { ...existing, idempotent: true };
    }

    const [shift] = await tx
      .select({ id: shifts.id, status: shifts.status })
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
    if (!shift || (shift.status !== "active" && shift.status !== "closing")) {
      throw new AccessError("Cash deductions require an open shift.");
    }
    await requireCurrentAssignment(
      tx,
      access.business.id,
      shift.id,
      access.employee.id,
    );

    const reviewedAt = approvalsEnabled ? null : new Date();
    const status = approvalsEnabled ? "pending" : "approved";

    const [created] = await tx
      .insert(cashDeductions)
      .values({
        id: input.deductionId,
        businessId: access.business.id,
        shiftId: shift.id,
        label: input.label.trim(),
        amountCents: input.amountCents,
        reason: input.reason?.trim() || null,
        status,
        requestedBy: access.employee.id,
        reviewedAt,
      })
      .onConflictDoNothing()
      .returning({ id: cashDeductions.id });
    if (!created) {
      const [raced] = await tx
        .select({
          id: cashDeductions.id,
          shiftId: cashDeductions.shiftId,
          status: cashDeductions.status,
          amountCents: cashDeductions.amountCents,
        })
        .from(cashDeductions)
        .where(
          and(
            eq(cashDeductions.id, input.deductionId),
            eq(cashDeductions.businessId, access.business.id),
          ),
        )
        .limit(1);
      if (raced?.shiftId === input.shiftId) {
        return { ...raced, idempotent: true };
      }
      throw new AccessError("The cash deduction ID is already in use.");
    }
    await insertAuditLog(tx, access, {
      action: approvalsEnabled
        ? "cash_deduction.submitted"
        : "cash_deduction.approved_without_approval",
      entityType: "cash_deduction",
      entityId: input.deductionId,
      shiftId: shift.id,
      metadata: { amountCents: input.amountCents, approvalsEnabled },
    });
    return {
      id: input.deductionId,
      shiftId: shift.id,
      status,
      amountCents: input.amountCents,
      idempotent: false,
    };
  });
}

export async function reviewCashDeduction(input: {
  deductionId: string;
  decision: "approved" | "rejected";
}) {
  const access = await requireActiveBusiness({
    admin: true,
    feature: "approvals",
  });
  return requireDatabase().transaction(async (tx) => {
    const [deduction] = await tx
      .select({
        id: cashDeductions.id,
        shiftId: cashDeductions.shiftId,
        status: cashDeductions.status,
        amountCents: cashDeductions.amountCents,
      })
      .from(cashDeductions)
      .where(
        and(
          eq(cashDeductions.id, input.deductionId),
          eq(cashDeductions.businessId, access.business.id),
        ),
      )
      .for("update")
      .limit(1);
    if (!deduction) throw new AccessError("Cash deduction not found.");
    if (deduction.status === input.decision) {
      return { ...deduction, idempotent: true };
    }
    if (deduction.status !== "pending") {
      throw new AccessError("This cash deduction was already reviewed.");
    }

    const [shift] = await tx
      .select({ status: shifts.status })
      .from(shifts)
      .where(
        and(
          eq(shifts.id, deduction.shiftId),
          eq(shifts.businessId, access.business.id),
          isNull(shifts.deletedAt),
        ),
      )
      .for("update")
      .limit(1);
    if (!shift || (shift.status !== "active" && shift.status !== "closing")) {
      throw new AccessError("The shift is no longer open for review.");
    }

    const reviewedAt = new Date();
    const [reviewed] = await tx
      .update(cashDeductions)
      .set({
        status: input.decision,
        reviewedBy: access.employee?.id ?? null,
        reviewedAt,
        updatedAt: reviewedAt,
      })
      .where(
        and(
          eq(cashDeductions.id, deduction.id),
          eq(cashDeductions.businessId, access.business.id),
          eq(cashDeductions.status, "pending"),
        ),
      )
      .returning({ id: cashDeductions.id });
    if (!reviewed) throw new AccessError("The deduction review conflicted.");
    await insertAuditLog(tx, access, {
      action: `cash_deduction.${input.decision}`,
      entityType: "cash_deduction",
      entityId: deduction.id,
      shiftId: deduction.shiftId,
      metadata: { amountCents: deduction.amountCents },
    });
    return { ...deduction, status: input.decision, idempotent: false };
  });
}
