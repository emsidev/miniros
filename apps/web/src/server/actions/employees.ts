"use server";

import { actionSuccess } from "@miniros/contracts";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createEmployee,
  listEmployees,
  softDeleteEmployee,
  updateEmployee,
} from "../services/employees";
import { actionError } from "./helpers";

const centsSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const nullableEmailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase())
  .nullable()
  .optional()
  .default(null);

const employeeWriteSchema = z.object({
  memberId: z.string().uuid().nullable().optional().default(null),
  memberRole: z.enum(["admin", "employee"]).default("employee"),
  displayName: z.string().trim().min(2).max(100),
  email: nullableEmailSchema,
  phone: z.string().trim().max(40).nullable().optional().default(null),
  status: z.enum(["active", "inactive"]).default("active"),
  defaultShiftRateCents: centsSchema.default(0),
  canUsePos: z.boolean().default(false),
  canLogProduction: z.boolean().default(true),
});

const updateEmployeeSchema = employeeWriteSchema.extend({
  employeeId: z.string().uuid(),
});

const employeeIdSchema = z.object({ employeeId: z.string().uuid() });
const emptyInputSchema = z.object({}).strict();

export async function listEmployeesAction(input: unknown = {}) {
  try {
    emptyInputSchema.parse(input);
    return actionSuccess(await listEmployees());
  } catch (error) {
    return actionError(error);
  }
}

export async function createEmployeeAction(input: unknown) {
  try {
    const values = employeeWriteSchema.parse(input);
    const result = await createEmployee(values);
    revalidatePath("/admin/employees");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function updateEmployeeAction(input: unknown) {
  try {
    const { employeeId, ...values } = updateEmployeeSchema.parse(input);
    const result = await updateEmployee(employeeId, values);
    revalidatePath("/admin/employees");
    revalidatePath("/admin/shifts");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}

export async function softDeleteEmployeeAction(input: unknown) {
  try {
    const { employeeId } = employeeIdSchema.parse(input);
    const result = await softDeleteEmployee(employeeId);
    revalidatePath("/admin/employees");
    revalidatePath("/admin/shifts");
    return actionSuccess(result);
  } catch (error) {
    return actionError(error);
  }
}
