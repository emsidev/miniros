export type LocationOption = {
  id: string;
  name: string;
  defaultRentalCostCents: number;
  defaultTransportCostCents: number;
};

export type EmployeeOption = {
  id: string;
  displayName: string;
  defaultShiftRateCents: number;
  canUsePos: boolean;
};

export type AssignmentRole = "operator" | "employee" | "manager";

export type EditableAssignment = {
  employeeId: string;
  roleOnShift: AssignmentRole;
  salary: string;
};

export type ShiftRecord = {
  id: string;
  sellingLocationId: string;
  locationName: string;
  title: string | null;
  shiftDate: string;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  status: "scheduled" | "active" | "closing" | "closed" | "cancelled";
  notes: string | null;
  rentalCostCents: number;
  transportCostCents: number;
  otherCostCents: number;
  assignments: Array<{
    employeeId: string;
    roleOnShift: AssignmentRole;
    salaryRateCents: number;
    status: "assigned" | "confirmed" | "cancelled" | "completed";
  }>;
  costs: Array<{
    costType: string;
    label: string;
  }>;
};

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1_000;

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
}

export function toIsoDateTime(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(`${text}:00+08:00`);
  return Number.isNaN(date.getTime()) ? text : date.toISOString();
}

export function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 16);
}

export function initialAssignments(
  employees: EmployeeOption[],
  shift?: ShiftRecord,
): EditableAssignment[] {
  if (shift) {
    const activeEmployeeIds = new Set(employees.map((employee) => employee.id));
    return shift.assignments
      .filter(
        (assignment) =>
          assignment.status !== "cancelled" &&
          activeEmployeeIds.has(assignment.employeeId),
      )
      .map((assignment) => ({
        employeeId: assignment.employeeId,
        roleOnShift: assignment.roleOnShift,
        salary: centsToInput(assignment.salaryRateCents),
      }));
  }

  const operator = employees.find((employee) => employee.canUsePos);
  return operator
    ? [
        {
          employeeId: operator.id,
          roleOnShift: "operator",
          salary: centsToInput(operator.defaultShiftRateCents),
        },
      ]
    : [];
}

export function cancelledShiftInput(shift: ShiftRecord) {
  return {
    sellingLocationId: shift.sellingLocationId,
    title: shift.title,
    shiftDate: shift.shiftDate,
    scheduledStartAt: shift.scheduledStartAt,
    scheduledEndAt: shift.scheduledEndAt,
    notes: shift.notes,
    assignments: shift.assignments
      .filter((assignment) => assignment.status !== "cancelled")
      .map((assignment) => ({
        employeeId: assignment.employeeId,
        roleOnShift: assignment.roleOnShift,
        salaryRateCents: assignment.salaryRateCents,
      })),
    rentalCostCents: shift.rentalCostCents,
    transportCostCents: shift.transportCostCents,
    otherCostCents: shift.otherCostCents,
    otherCostLabel:
      shift.costs.find((cost) => cost.costType === "other")?.label ?? null,
    status: "cancelled" as const,
  };
}
