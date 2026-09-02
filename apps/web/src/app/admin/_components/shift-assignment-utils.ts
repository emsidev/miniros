import type { EditableAssignment, EmployeeOption } from "./shift-form-types";

export function filterEmployeeOptions(
  employees: EmployeeOption[],
  query: string,
  limit: number,
) {
  const search = query.trim().toLocaleLowerCase();
  const matches = employees.filter((employee) =>
    employee.displayName.toLocaleLowerCase().includes(search),
  );
  return { matches, visible: matches.slice(0, limit) };
}

export function ensureOperator(
  assignments: EditableAssignment[],
  employeeById: ReadonlyMap<string, EmployeeOption>,
  excludedId?: string,
): EditableAssignment[] {
  if (assignments.some((assignment) => assignment.roleOnShift === "operator")) {
    return assignments;
  }
  const replacement = assignments.find(
    (assignment) =>
      assignment.employeeId !== excludedId &&
      employeeById.get(assignment.employeeId)?.canUsePos,
  );
  if (!replacement) return assignments;
  return assignments.map((assignment) =>
    assignment.employeeId === replacement.employeeId
      ? { ...assignment, roleOnShift: "operator" as const }
      : assignment,
  );
}
