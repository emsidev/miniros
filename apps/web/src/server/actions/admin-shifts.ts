"use server";

import { actionSuccess } from "@miniros/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  cancelAdminShift,
  createAdminShifts,
  listAdminShifts,
  replaceAdminShiftAssignments,
  softDeleteAdminShift,
  updateAdminShift,
} from "../services/admin-shifts";
import { actionError } from "./helpers";

const centsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const titleSchema = z.string().trim().min(1, "Enter a shift title.").max(120);

const shiftAssignmentSchema = z.object({
  employeeId: z.string().uuid(),
  roleOnShift: z.enum(["operator", "employee", "manager"]),
  salaryRateCents: centsSchema.default(0),
});

const assignmentsSchema = z
  .array(shiftAssignmentSchema)
  .min(1)
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

const shiftDatesSchema = z
  .array(shiftDateSchema)
  .min(1, "Select at least one shift date.")
  .superRefine((dates, context) => {
    if (new Set(dates).size !== dates.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each shift date can be selected only once.",
      });
    }
    const sortedDates = [...dates].sort();
    if (sortedDates.some((date, index) => date !== dates[index])) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Shift dates must be in ascending order.",
      });
    }
  });

const shiftDetailsShape = {
  sellingLocationId: z.string().uuid(),
  title: titleSchema,
  assignments: assignmentsSchema,
};

const createShiftSchema = z.object({
  ...shiftDetailsShape,
  shiftDates: shiftDatesSchema,
});
const updateShiftSchema = z.object({
  shiftId: z.string().uuid(),
  ...shiftDetailsShape,
  shiftDate: shiftDateSchema,
});
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
    const result = await createAdminShifts(values);
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

export async function cancelAdminShiftAction(input: unknown) {
  try {
    const { shiftId } = shiftIdSchema.parse(input);
    const result = await cancelAdminShift(shiftId);
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
