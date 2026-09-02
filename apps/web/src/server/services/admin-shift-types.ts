import { AccessError } from "./access";

export type ShiftAssignmentInput = {
  employeeId: string;
  roleOnShift: "operator" | "employee" | "manager";
  salaryRateCents: number;
};

type ShiftDetailsInput = {
  sellingLocationId: string;
  title: string;
  assignments: ShiftAssignmentInput[];
};

export type ShiftCreateInput = ShiftDetailsInput & {
  shiftDates: string[];
};

export type ShiftUpdateInput = ShiftDetailsInput & {
  shiftDate: string;
};

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

export function isValidShiftDate(value: string) {
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

function assertShiftDetails(input: ShiftDetailsInput) {
  if (!input.title.trim()) {
    throw new AccessError("Enter a shift title.");
  }
  assertAssignments(input.assignments);
}

export function assertShiftCreateInput(input: ShiftCreateInput) {
  assertShiftDetails(input);
  if (input.shiftDates.length === 0) {
    throw new AccessError("Select at least one shift date.");
  }
  if (new Set(input.shiftDates).size !== input.shiftDates.length) {
    throw new AccessError("Each shift date can be selected only once.");
  }
  if (input.shiftDates.some((date) => !isValidShiftDate(date))) {
    throw new AccessError("Every shift date must be a valid YYYY-MM-DD date.");
  }
  const sortedDates = [...input.shiftDates].sort();
  if (sortedDates.some((date, index) => date !== input.shiftDates[index])) {
    throw new AccessError("Shift dates must be in ascending order.");
  }
}

export function assertShiftUpdateInput(input: ShiftUpdateInput) {
  assertShiftDetails(input);
  if (!isValidShiftDate(input.shiftDate)) {
    throw new AccessError("Shift date must be a valid YYYY-MM-DD date.");
  }
}
