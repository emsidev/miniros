"use client";
import { useState } from "react";
import { Search, Plus, X, UserRound, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { FieldError, errorProps } from "./form-feedback";
import type { PlanningEmployee, TeamMember } from "./types";

const selectClass =
  "h-11 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
export function TeamEditor({
  employees,
  team,
  onChange,
  disabled,
  errors,
}: {
  employees: PlanningEmployee[];
  team: TeamMember[];
  onChange: (team: TeamMember[]) => void;
  disabled?: boolean;
  errors?: Record<string, string[]>;
}) {
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(team.length === 0);
  const selected = new Set(team.map((item) => item.employeeId));
  const matches = employees.filter(
    (employee) =>
      employee.available &&
      !selected.has(employee.id) &&
      employee.displayName
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const hasOperator = team.some(
    (member) =>
      member.roleOnShift === "operator" &&
      employees.some(
        (employee) =>
          employee.id === member.employeeId &&
          employee.available &&
          employee.canUsePos,
      ),
  );
  function add(employee: PlanningEmployee) {
    onChange([
      ...team,
      {
        employeeId: employee.id,
        roleOnShift:
          employee.canUsePos && !hasOperator ? "operator" : "employee",
        salary: (employee.defaultShiftRateCents / 100).toFixed(2),
      },
    ]);
  }
  return (
    <fieldset
      disabled={disabled}
      className="space-y-4"
      {...errorProps("assignments", errors)}
      tabIndex={-1}
    >
      <legend className="text-lg font-bold">Assigned team</legend>
      <p className="text-sm text-muted-foreground">
        Plan with any team. Publishing needs at least one person with POS access
        assigned as an operator.
      </p>
      <FieldError field="assignments" errors={errors} />
      {team.length ? (
        <div className="divide-y rounded-lg border">
          {team.map((member, index) => {
            const employee = employees.find(
              (item) => item.id === member.employeeId,
            );
            const name = employee?.displayName ?? "Unavailable employee";
            const update = (patch: Partial<TeamMember>) =>
              onChange(
                team.map((item) =>
                  item.employeeId === member.employeeId
                    ? { ...item, ...patch }
                    : item,
                ),
              );
            return (
              <div key={member.employeeId} className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <UserRound
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold">{name}</p>
                    <p
                      className={`text-sm ${!employee?.available ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {!employee?.available
                        ? "Unavailable · remove or replace before publishing"
                        : employee.canUsePos
                          ? "POS access enabled"
                          : "No POS access"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove ${name}`}
                    onClick={() =>
                      onChange(
                        team.filter(
                          (item) => item.employeeId !== member.employeeId,
                        ),
                      )
                    }
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
                <FieldError
                  field={`assignments.${index}.employeeId`}
                  errors={errors}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`field-assignments.${index}.roleOnShift`}>
                      Role on shift
                    </Label>
                    <select
                      {...errorProps(
                        `assignments.${index}.roleOnShift`,
                        errors,
                      )}
                      className={selectClass}
                      value={member.roleOnShift}
                      onChange={(event) =>
                        update({
                          roleOnShift: event.target
                            .value as TeamMember["roleOnShift"],
                        })
                      }
                    >
                      <option value="operator" disabled={!employee?.canUsePos}>
                        POS operator
                      </option>
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                    </select>
                    <FieldError
                      field={`assignments.${index}.roleOnShift`}
                      errors={errors}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor={`field-assignments.${index}.salaryRateCents`}
                    >
                      Pay for this shift (₱)
                    </Label>
                    <Input
                      {...errorProps(
                        `assignments.${index}.salaryRateCents`,
                        errors,
                      )}
                      value={member.salary}
                      onChange={(event) =>
                        update({ salary: event.target.value })
                      }
                      min="0"
                      inputMode="decimal"
                      className="h-11"
                    />
                    <FieldError
                      field={`assignments.${index}.salaryRateCents`}
                      errors={errors}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          No staff assigned yet. You can save this shift as a draft.
        </p>
      )}
      {hasOperator && (
        <p className="flex items-center gap-2 text-sm text-success">
          <Check className="size-4" aria-hidden="true" />
          POS operator assigned
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={() => setShowPicker(!showPicker)}
        aria-expanded={showPicker}
      >
        <Plus aria-hidden="true" />
        {showPicker ? "Hide employee picker" : "Add employees"}
      </Button>
      {showPicker && (
        <div className="space-y-2">
          <Label htmlFor="shift-employee-search">Find employees</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="shift-employee-search"
              className="h-11 pl-9"
              placeholder="Search by name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div
            className="max-h-64 overflow-y-auto rounded-lg border"
            aria-label="Available employees"
          >
            {matches.slice(0, 50).map((employee) => (
              <button
                type="button"
                key={employee.id}
                className="flex min-h-14 w-full items-center gap-3 border-b px-3 py-2 text-left last:border-0 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => add(employee)}
              >
                <div className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold">
                    {employee.displayName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {employee.canUsePos ? "POS access" : "Employee"} · Default
                    pay {formatMoney(employee.defaultShiftRateCents)}
                  </span>
                </div>
                <Plus className="size-4 shrink-0" aria-hidden="true" />
                <span className="sr-only">Add {employee.displayName}</span>
              </button>
            ))}
            {!matches.length && (
              <p className="p-4 text-sm text-muted-foreground">
                {employees.some((employee) => employee.available)
                  ? "No more matching employees."
                  : "Add an active employee in Employees before publishing."}
              </p>
            )}
            {matches.length > 50 && (
              <p className="p-3 text-sm text-muted-foreground">
                Showing 50 of {matches.length}. Search to narrow the list.
              </p>
            )}
          </div>
        </div>
      )}
    </fieldset>
  );
}
