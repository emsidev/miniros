"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AssignmentRole,
  EditableAssignment,
  EmployeeOption,
} from "./shift-form-types";

export function ShiftAssignmentFields({
  employees,
  assignments,
  error,
  disabled,
  onToggle,
  onUpdate,
}: {
  employees: EmployeeOption[];
  assignments: EditableAssignment[];
  error?: string;
  disabled: boolean;
  onToggle: (employee: EmployeeOption, checked: boolean) => void;
  onUpdate: (
    employeeId: string,
    patch: Partial<Pick<EditableAssignment, "roleOnShift" | "salary">>,
  ) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-bold">Assigned team</legend>
      <p className="text-xs text-muted-foreground">
        Select at least one employee and keep a POS-enabled employee in the
        operator role.
      </p>
      <div className="space-y-3">
        {employees.map((employee) => {
          const assignment = assignments.find(
            (item) => item.employeeId === employee.id,
          );
          return (
            <div key={employee.id} className="rounded-xl border p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`shift-employee-${employee.id}`}
                  checked={Boolean(assignment)}
                  onCheckedChange={(value) =>
                    onToggle(employee, value === true)
                  }
                  disabled={disabled}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <Label htmlFor={`shift-employee-${employee.id}`}>
                    {employee.displayName}
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {employee.canUsePos ? "POS enabled" : "No POS access"}
                  </p>
                </div>
              </div>
              {assignment ? (
                <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`shift-role-${employee.id}`}>Role</Label>
                    <Select
                      value={assignment.roleOnShift}
                      onValueChange={(value) =>
                        onUpdate(employee.id, {
                          roleOnShift: value as AssignmentRole,
                        })
                      }
                      disabled={disabled}
                    >
                      <SelectTrigger
                        id={`shift-role-${employee.id}`}
                        className="h-11 w-full rounded-xl"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          value="operator"
                          disabled={!employee.canUsePos}
                        >
                          Operator
                        </SelectItem>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`shift-salary-${employee.id}`}>
                      Salary snapshot (₱)
                    </Label>
                    <Input
                      id={`shift-salary-${employee.id}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={assignment.salary}
                      onChange={(event) =>
                        onUpdate(employee.id, { salary: event.target.value })
                      }
                      disabled={disabled}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </fieldset>
  );
}
