import { z } from "zod";

const MAX_SHIFT_ASSIGNMENTS = 100;
const MAX_SHIFT_COSTS = 50;
const MAX_PLANNED_ROWS = 5_000;

export const centsSchema = z
  .number()
  .int("Enter a valid amount.")
  .nonnegative("Amount cannot be negative.")
  .max(Number.MAX_SAFE_INTEGER);
export const assignmentSchema = z.object({
  employeeId: z.string().uuid(),
  roleOnShift: z.enum(["operator", "employee", "manager"]),
  salaryRateCents: centsSchema,
});
const assignmentsSchema = z
  .array(assignmentSchema)
  .max(MAX_SHIFT_ASSIGNMENTS, "Assign up to 100 people to a shift.");
export const plannedCostSchema = z.object({
  id: z.string().uuid().optional(),
  costType: z.enum(["rent", "transport", "other"]),
  label: z.string().trim().min(1, "Name this cost.").max(120),
  amountCents: centsSchema,
  notes: z.string().max(2_000).nullable().optional(),
});
export const calendarDateSchema = z
  .string()
  .refine(isValidShiftDate, "Choose a valid calendar date.");
export const shiftVersionSchema = z.object({
  id: z.string().uuid(),
  updatedAt: z.string().datetime(),
});

export function isValidShiftDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export const shiftDetailsShape = {
  sellingLocationId: z.string().uuid("Choose a selling location."),
  title: z.string().trim().max(120).default(""),
  assignments: assignmentsSchema,
  costs: z
    .array(plannedCostSchema)
    .max(MAX_SHIFT_COSTS, "Add up to 50 costs to a shift."),
  intent: z.enum(["draft", "publish"]).default("draft"),
};

type PlanningValues = {
  assignments: z.infer<typeof assignmentSchema>[];
  costs: z.infer<typeof plannedCostSchema>[];
  intent: "draft" | "publish";
};

export function validatePlanning(
  values: PlanningValues,
  context: z.RefinementCtx,
) {
  const ids = new Set<string>();
  values.assignments.forEach((assignment, index) => {
    if (ids.has(assignment.employeeId))
      context.addIssue({
        code: "custom",
        path: ["assignments", index, "employeeId"],
        message: "This employee is already selected.",
      });
    ids.add(assignment.employeeId);
  });
  if (
    values.intent === "publish" &&
    !values.assignments.some((item) => item.roleOnShift === "operator")
  ) {
    context.addIssue({
      code: "custom",
      path: ["assignments"],
      message: "Add at least one POS operator before publishing.",
    });
  }
  const costIds = values.costs.flatMap((cost) => (cost.id ? [cost.id] : []));
  if (new Set(costIds).size !== costIds.length)
    context.addIssue({
      code: "custom",
      path: ["costs"],
      message: "Each saved cost can appear only once.",
    });
  const total =
    values.costs.reduce((sum, item) => sum + item.amountCents, 0) +
    values.assignments.reduce((sum, item) => sum + item.salaryRateCents, 0);
  if (!Number.isSafeInteger(total))
    context.addIssue({
      code: "custom",
      path: ["costs"],
      message: "The combined planned cost is too large.",
    });
}

export const createShiftSchema = z
  .object({
    ...shiftDetailsShape,
    shiftDates: z
      .array(calendarDateSchema)
      .min(1, "Select at least one date.")
      .max(366, "Create up to 366 dates at a time."),
    requestId: z.string().uuid(),
  })
  .superRefine((values, context) => {
    validatePlanning(values, context);
    if (
      values.shiftDates.length *
        (1 + values.assignments.length + values.costs.length) >
      MAX_PLANNED_ROWS
    )
      context.addIssue({
        code: "custom",
        path: ["shiftDates"],
        message: "This plan is too large. Create fewer dates at a time.",
      });
    const total =
      values.assignments.reduce((sum, item) => sum + item.salaryRateCents, 0) +
      values.costs.reduce((sum, item) => sum + item.amountCents, 0);
    if (!Number.isSafeInteger(total * values.shiftDates.length))
      context.addIssue({
        code: "custom",
        path: ["costs"],
        message: "The combined cost across all selected dates is too large.",
      });
    if (
      values.shiftDates.some(
        (date, index) => index > 0 && date <= values.shiftDates[index - 1]!,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["shiftDates"],
        message: "Select distinct dates in ascending order.",
      });
    }
  });

export const updateShiftSchema = z
  .object({
    ...shiftDetailsShape,
    shiftId: z.string().uuid(),
    expectedUpdatedAt: z.string().datetime(),
    shiftDate: calendarDateSchema,
  })
  .superRefine(validatePlanning);

export const bulkShiftSchema = z
  .object({
    shifts: z
      .array(shiftVersionSchema)
      .min(1, "Select a shift first.")
      .max(366),
    operation: z.enum(["team", "publish", "cancel"]),
    assignments: assignmentsSchema.optional(),
  })
  .superRefine((values, context) => {
    if (
      new Set(values.shifts.map((shift) => shift.id)).size !==
      values.shifts.length
    )
      context.addIssue({
        code: "custom",
        path: ["shifts"],
        message: "Select each shift only once.",
      });
    if (values.operation === "team") {
      if (
        values.shifts.length * (1 + (values.assignments?.length ?? 0)) >
        MAX_PLANNED_ROWS
      )
        context.addIssue({
          code: "custom",
          path: ["shifts"],
          message:
            "This team change is too large. Select fewer shifts at a time.",
        });
      validatePlanning(
        { assignments: values.assignments ?? [], costs: [], intent: "draft" },
        context,
      );
      if (!values.assignments)
        context.addIssue({
          code: "custom",
          path: ["assignments"],
          message: "Choose the replacement team.",
        });
    }
  });

export type ShiftAssignmentInput = z.infer<typeof assignmentSchema>;
export type PlannedCostInput = z.infer<typeof plannedCostSchema>;
export type ShiftCreateInput = z.infer<typeof createShiftSchema>;
export type ShiftUpdateInput = z.infer<typeof updateShiftSchema>;
export type BulkShiftInput = z.infer<typeof bulkShiftSchema>;

export function planningTotals(
  assignments: Array<{ salaryRateCents: number; status?: string }>,
  costs: Array<{ amountCents: number }>,
) {
  const payCents = assignments
    .filter((item) => item.status !== "cancelled")
    .reduce((total, item) => total + item.salaryRateCents, 0);
  const locationCostCents = costs.reduce(
    (total, item) => total + item.amountCents,
    0,
  );
  const totalCents = payCents + locationCostCents;
  if (!Number.isSafeInteger(totalCents) || totalCents < 0)
    throw new Error("Planned costs exceed the supported amount.");
  return { payCents, locationCostCents, totalCents };
}

export function editableShift(status: string) {
  return status === "draft" || status === "scheduled";
}

export function bulkDisabledReason(
  operation: BulkShiftInput["operation"],
  shifts: Array<{ status: string }>,
) {
  if (!shifts.length) return "Select at least one shift.";
  if (
    operation === "publish" &&
    shifts.some((shift) => shift.status !== "draft")
  )
    return "Select only drafts to publish.";
  if (shifts.some((shift) => !editableShift(shift.status)))
    return "Only draft and scheduled shifts can be changed.";
  return undefined;
}

export function safeShiftReturn(value?: string) {
  return value === "/admin/shifts" || value?.startsWith("/admin/shifts?")
    ? value
    : "/admin/shifts";
}

export function manilaToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
