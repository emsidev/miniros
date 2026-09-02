export type LocationOption = {
  id: string;
  name: string;
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
  status: "scheduled" | "active" | "closing" | "closed" | "cancelled";
  assignments: Array<{
    employeeId: string;
    roleOnShift: AssignmentRole;
    salaryRateCents: number;
    status: "assigned" | "confirmed" | "cancelled" | "completed";
  }>;
};

export function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
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

  return [];
}
