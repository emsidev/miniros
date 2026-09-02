import { describe, expect, it } from "vitest";
import {
  ensureOperator,
  filterEmployeeOptions,
} from "./shift-assignment-utils";
import type { EditableAssignment, EmployeeOption } from "./shift-form-types";

const employees: EmployeeOption[] = [
  {
    id: "employee-1",
    displayName: "Alex Employee",
    defaultShiftRateCents: 50000,
    canUsePos: false,
  },
  {
    id: "operator-1",
    displayName: "Bailey Operator",
    defaultShiftRateCents: 60000,
    canUsePos: true,
  },
  {
    id: "operator-2",
    displayName: "Casey Operator",
    defaultShiftRateCents: 65000,
    canUsePos: true,
  },
];

const employeeById = new Map(
  employees.map((employee) => [employee.id, employee]),
);

function assignment(employeeId: string): EditableAssignment {
  return { employeeId, roleOnShift: "employee", salary: "500.00" };
}

describe("shift assignment helpers", () => {
  it("limits a large directory without preventing exact search", () => {
    const directory = Array.from({ length: 1_000 }, (_, index) => ({
      id: `employee-${index}`,
      displayName: `Employee ${String(index).padStart(4, "0")}`,
      defaultShiftRateCents: 50000,
      canUsePos: index === 0,
    }));

    expect(filterEmployeeOptions(directory, "", 50)).toMatchObject({
      matches: { length: 1_000 },
      visible: { length: 50 },
    });
    expect(
      filterEmployeeOptions(directory, "Employee 0999", 50).visible,
    ).toEqual([directory[999]]);
  });

  it("promotes the first selected POS-capable employee", () => {
    const result = ensureOperator(
      [assignment("employee-1"), assignment("operator-1")],
      employeeById,
    );
    expect(
      result.map(({ employeeId, roleOnShift }) => [employeeId, roleOnShift]),
    ).toEqual([
      ["employee-1", "employee"],
      ["operator-1", "operator"],
    ]);
  });

  it("promotes another operator when the current operator is removed", () => {
    const result = ensureOperator(
      [assignment("employee-1"), assignment("operator-2")],
      employeeById,
    );
    expect(
      result.find((item) => item.employeeId === "operator-2")?.roleOnShift,
    ).toBe("operator");
  });

  it("does not immediately re-promote an employee being demoted", () => {
    const result = ensureOperator(
      [assignment("operator-1"), assignment("operator-2")],
      employeeById,
      "operator-1",
    );
    expect(
      result.find((item) => item.employeeId === "operator-1")?.roleOnShift,
    ).toBe("employee");
    expect(
      result.find((item) => item.employeeId === "operator-2")?.roleOnShift,
    ).toBe("operator");
  });
});
