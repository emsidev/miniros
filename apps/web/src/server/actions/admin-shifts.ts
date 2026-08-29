"use server";

import { actionSuccess } from "@miniros/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createAdminShift,
  listAdminShifts,
  replaceAdminShiftAssignments,
  softDeleteAdminShift,
  updateAdminShift,
} from "../services/admin-shifts";
import { actionError } from "./helpers";

const centsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const nullableText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().optional().default(null);

const shiftAssignmentSchema = z.object({
  employeeId: z.string().uuid(),
  roleOnShift: z.enum(["operator", "employee", "manager"]),
  salaryRateCents: centsSchema.default(0),
});

const assignmentsSchema = z
  .array(shiftAssignmentSchema)
  .min(1)
  .max(100)
  .superRefine((assignments, context) => {
    const seen = new Set<string>();
    assignments.forEach((assignment, index) => {
      if (seen.has(assignment.employeeId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "employeeId"],
          message: "Each employee can be assigned only once.",
        });
      }
      seen.add(assignment.employeeId);
    });
    if (!assignments.some((item) => item.roleOnShift === "operator")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Assign at least one POS operator.",
      });
    }
  });

const shiftDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day!));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month! - 1 &&
      date.getUTCDate() === day
    );
  }, "Enter a valid calendar date.");
const dateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .nullable()
  .optional()
  .default(null);

const shiftWriteShape = {
  sellingLocationId: z.string().uuid(),
  title: nullableText(120),
  shiftDate: shiftDateSchema,
  scheduledStartAt: dateTimeSchema,
  scheduledEndAt: dateTimeSchema,
  notes: nullableText(2_000),
  assignments: assignmentsSchema,
  rentalCostCents: centsSchema.optional(),
  transportCostCents: centsSchema.optional(),
  otherCostCents: centsSchema.default(0),
  otherCostLabel: nullableText(120),
};

function validateSchedule(
  value: {
    scheduledStartAt?: string | null;
    scheduledEndAt?: string | null;
    otherCostCents: number;
    rentalCostCents?: number;
    transportCostCents?: number;
    otherCostLabel?: string | null;
  },
  context: z.RefinementCtx,
) {
  if (
    value.scheduledStartAt &&
    value.scheduledEndAt &&
    new Date(value.scheduledEndAt) <= new Date(value.scheduledStartAt)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scheduledEndAt"],
      message: "Scheduled end must be after the start.",
    });
  }
  if (value.otherCostCents > 0 && !value.otherCostLabel?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["otherCostLabel"],
      message: "Add a label for the other cost.",
    });
  }
  const combinedCosts =
    BigInt(value.rentalCostCents ?? 0) +
    BigInt(value.transportCostCents ?? 0) +
    BigInt(value.otherCostCents);
  if (combinedCosts > BigInt(Number.MAX_SAFE_INTEGER)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["otherCostCents"],
      message: "The combined shift costs are too large.",
    });
  }
}

const createShiftSchema = z
  .object(shiftWriteShape)
  .superRefine(validateSchedule);
const updateShiftSchema = z
  .object({
    shiftId: z.string().uuid(),
    ...shiftWriteShape,
    status: z.enum(["scheduled", "cancelled"]).default("scheduled"),
  })
  .superRefine(validateSchedule);
const replaceAssignmentsSchema = z.object({
  shiftId: z.string().uuid(),
  assignments: assignmentsSchema,
});
const shiftIdSchema = z.object({ shiftId: z.string().uuid() });
const emptyInputSchema = z.object({}).strict();

function revalidateShiftSurfaces() {
  revalidatePath("/admin/shifts");
  revalidatePath("/schedule");
  revalidatePath("/shifts");
}

export async function listAdminShiftsAction(input: unknown = {}) {
  try {
    emptyInputSchema.parse(input);
    return actionSuccess(await listAdminShifts());
  } catch (error) {
    return actionError(error);
  }
}

export async function createAdminShiftAction(input: unknown) {
  try {
    const values = createShiftSchema.parse(input);
    const result = await createAdminShift(values);
    revalidateShiftSurfaces();
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateAdminShiftAction(input: unknown) {
  try {
    const { shiftId, ...values } = updateShiftSchema.parse(input);
    const result = await updateAdminShift(shiftId, values);
    revalidateShiftSurfaces();
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function replaceAdminShiftAssignmentsAction(input: unknown) {
  try {
    const { shiftId, assignments } = replaceAssignmentsSchema.parse(input);
    const result = await replaceAdminShiftAssignments(shiftId, assignments);
    revalidateShiftSurfaces();
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function softDeleteAdminShiftAction(input: unknown) {
  try {
    const { shiftId } = shiftIdSchema.parse(input);
    const result = await softDeleteAdminShift(shiftId);
    revalidateShiftSurfaces();
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}
