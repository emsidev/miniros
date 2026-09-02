"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { NumericExpressionInput } from "@/components/ui/numeric-expression-input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { filterEmployeeOptions } from "./shift-assignment-utils";
import type {
  AssignmentRole,
  EditableAssignment,
  EmployeeOption,
} from "./shift-form-types";

const MAX_VISIBLE_RESULTS = 50;

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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );
  const assignmentByEmployeeId = useMemo(
    () =>
      new Map(
        assignments.map((assignment) => [assignment.employeeId, assignment]),
      ),
    [assignments],
  );
  const { matches: matchingEmployees, visible: visibleEmployees } = useMemo(
    () => filterEmployeeOptions(employees, query, MAX_VISIBLE_RESULTS),
    [employees, query],
  );

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-bold">Assigned team</legend>
      <p className="text-xs text-muted-foreground">
        Search by name and select at least one employee, including a POS
        operator.
      </p>

      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "shift-team-error" : undefined}
            disabled={disabled}
            className="h-11 w-full justify-between rounded-xl px-3 font-normal"
          >
            <span
              className={cn(
                "flex min-w-0 items-center gap-2 truncate",
                assignments.length === 0 && "text-muted-foreground",
              )}
            >
              <UsersRound className="size-4 shrink-0" aria-hidden="true" />
              {assignments.length === 0
                ? "Select employees"
                : `${assignments.length} ${assignments.length === 1 ? "employee" : "employees"} selected`}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search employees…"
              autoFocus
            />
            <CommandList aria-label="Employees">
              {visibleEmployees.length === 0 ? (
                <CommandEmpty>No employees found.</CommandEmpty>
              ) : (
                visibleEmployees.map((employee) => {
                  const selected = assignmentByEmployeeId.has(employee.id);
                  return (
                    <CommandItem
                      key={employee.id}
                      value={employee.id}
                      data-checked={selected}
                      aria-selected={selected}
                      onSelect={() => onToggle(employee, !selected)}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {employee.displayName}
                      </span>
                      <span className="mr-6 shrink-0 text-xs text-muted-foreground">
                        {employee.canUsePos ? "POS enabled" : "Employee"}
                      </span>
                    </CommandItem>
                  );
                })
              )}
            </CommandList>
            {matchingEmployees.length > MAX_VISIBLE_RESULTS ? (
              <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                Showing the first {MAX_VISIBLE_RESULTS} of{" "}
                {matchingEmployees.length}. Type more of the name to narrow the
                list.
              </p>
            ) : null}
          </Command>
        </PopoverContent>
      </Popover>

      {assignments.length > 0 ? (
        <div className="space-y-2">
          {assignments.map((assignment) => {
            const employee = employeeById.get(assignment.employeeId);
            if (!employee) return null;
            return (
              <div
                key={employee.id}
                className="rounded-xl border bg-muted/20 p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {employee.displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {employee.canUsePos ? "POS enabled" : "No POS access"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    aria-label={`Remove ${employee.displayName}`}
                    onClick={() => onToggle(employee, false)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
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
                        className="h-10 w-full rounded-xl"
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
                    <NumericExpressionInput
                      id={`shift-salary-${employee.id}`}
                      precision={2}
                      min="0"
                      step="0.01"
                      value={assignment.salary}
                      onValueChange={(salary) =>
                        onUpdate(employee.id, { salary })
                      }
                      disabled={disabled}
                      className="h-10 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <p
          id="shift-team-error"
          className="text-xs font-medium text-destructive"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
