"use server";
import { actionSuccess } from "@miniros/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  bulkShiftSchema,
  createShiftSchema,
  updateShiftSchema,
} from "@/lib/shift-planning";
import {
  bulkAdminShifts,
  createAdminShifts,
  listAdminShifts,
  updateAdminShift,
} from "../services/admin-shifts";
import { ShiftPlanningError } from "../services/shift-planning-error";
import { actionError } from "./helpers";

function revalidateShiftSurfaces(ids: string[] = []) {
  ["/admin/shifts", "/admin/dashboard", "/schedule", "/shifts"].forEach(
    (path) => revalidatePath(path),
  );
  ids.forEach((id) => {
    revalidatePath(`/admin/shifts/${id}`);
    revalidatePath(`/admin/shifts/${id}/edit`);
    revalidatePath(`/shifts/${id}`);
  });
}
function shiftError(error: unknown) {
  if (error instanceof ShiftPlanningError)
    return {
      ok: false as const,
      error: error.message,
      fieldErrors: error.fieldErrors,
    };
  if (error instanceof z.ZodError) {
    const fields: Record<string, string[]> = {};
    error.issues.forEach((issue) => {
      (fields[issue.path.join(".")] ??= []).push(issue.message);
    });
    return {
      ok: false as const,
      error: "Review the highlighted fields.",
      fieldErrors: fields,
    };
  }
  return actionError(error);
}
export async function listAdminShiftsAction() {
  try {
    return actionSuccess(await listAdminShifts());
  } catch (error) {
    return shiftError(error);
  }
}
export async function createAdminShiftAction(input: unknown) {
  try {
    const result = await createAdminShifts(createShiftSchema.parse(input));
    revalidateShiftSurfaces(result.shiftIds);
    return actionSuccess(result);
  } catch (error) {
    return shiftError(error);
  }
}
export async function updateAdminShiftAction(input: unknown) {
  try {
    const result = await updateAdminShift(updateShiftSchema.parse(input));
    revalidateShiftSurfaces([result.id]);
    return actionSuccess(result);
  } catch (error) {
    return shiftError(error);
  }
}
export async function bulkAdminShiftsAction(input: unknown) {
  try {
    const result = await bulkAdminShifts(bulkShiftSchema.parse(input));
    revalidateShiftSurfaces(result.shiftIds);
    return actionSuccess(result);
  } catch (error) {
    return shiftError(error);
  }
}
