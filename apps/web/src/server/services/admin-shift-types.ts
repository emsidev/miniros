import { AccessError } from "./access";

export type ShiftAssignmentInput = {
  employeeId: string;
  roleOnShift: "operator" | "employee" | "manager";
  salaryRateCents: number;
};

export type ShiftWriteInput = {
  sellingLocationId: string;
  title: string | null;
  shiftDate: string;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  notes: string | null;
  assignments: ShiftAssignmentInput[];
  rentalCostCents?: number;
  transportCostCents?: number;
  otherCostCents: number;
  otherCostLabel: string | null;
};

export type ShiftUpdateInput = ShiftWriteInput & {
  status: "scheduled" | "cancelled";
};

export function nullableText(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function assertAssignments(assignments: ShiftAssignmentInput[]) {
  if (assignments.length === 0) {
    throw new AccessError("Assign at least one employee to the shift.");
  }
  if (!assignments.some((item) => item.roleOnShift === "operator")) {
    throw new AccessError("Assign at least one POS operator to the shift.");
  }

  const employeeIds = new Set<string>();
  for (const assignment of assignments) {
    if (employeeIds.has(assignment.employeeId)) {
      throw new AccessError("An employee can be assigned only once per shift.");
    }
    employeeIds.add(assignment.employeeId);
  }
}

function isValidShiftDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function assertShiftInput(input: ShiftWriteInput) {
  const start = input.scheduledStartAt
    ? new Date(input.scheduledStartAt)
    : null;
  const end = input.scheduledEndAt ? new Date(input.scheduledEndAt) : null;

  if (start && Number.isNaN(start.getTime())) {
    throw new AccessError("Scheduled start time is invalid.");
  }
  if (end && Number.isNaN(end.getTime())) {
    throw new AccessError("Scheduled end time is invalid.");
  }
  if (start && end && end <= start) {
    throw new AccessError("Scheduled end time must be after the start time.");
  }
  if (!isValidShiftDate(input.shiftDate)) {
    throw new AccessError("Shift date must be a valid YYYY-MM-DD date.");
  }
  assertAssignments(input.assignments);

  if (input.otherCostCents > 0 && !nullableText(input.otherCostLabel)) {
    throw new AccessError("Add a label for the other shift cost.");
  }
}
