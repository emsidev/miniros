"use client";

import {
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  cancelAdminShiftAction,
  createAdminShiftAction,
  updateAdminShiftAction,
} from "@/server/actions/admin-shifts";
import { ActionErrorAlert, SoftDeleteButton } from "./form-controls";
import { ensureOperator } from "./shift-assignment-utils";
import {
  datesFromRange,
  datesFromSelection,
  fromDateKey,
  toDateKey,
} from "./shift-date-utils";
import {
  firstFieldError,
  moneyToCents,
  type ActionFeedback,
} from "./form-utils";
import { ShiftAssignmentFields } from "./shift-assignment-fields";
import {
  ShiftScheduleFields,
  type DateSelectionMode,
} from "./shift-schedule-cost-fields";
import {
  centsToInput,
  initialAssignments,
  type EditableAssignment,
  type EmployeeOption,
  type LocationOption,
  type ShiftRecord,
} from "./shift-form-types";

export function CreateShiftDialog({
  locations,
  employees,
  shift,
}: {
  locations: LocationOption[];
  employees: EmployeeOption[];
  shift?: ShiftRecord;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const initialLocation =
    locations.find((location) => location.id === shift?.sellingLocationId) ??
    locations[0];
  const employeeById = useMemo(
    () => new Map(employees.map((employee) => [employee.id, employee])),
    [employees],
  );
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [locationId, setLocationId] = useState(initialLocation?.id ?? "");
  const [dateMode, setDateMode] = useState<DateSelectionMode>("range");
  const [dateRange, setDateRange] = useState<DateRange>();
  const [specificDates, setSpecificDates] = useState<Date[]>([]);
  const [editDate, setEditDate] = useState<Date | undefined>(() =>
    shift ? fromDateKey(shift.shiftDate) : undefined,
  );
  const [assignments, setAssignments] = useState<EditableAssignment[]>(
    initialAssignments(employees, shift),
  );
  const [feedback, setFeedback] = useState<ActionFeedback>({});
  const assignmentsError = firstFieldError(feedback, "assignments");
  const isEditing = Boolean(shift);

  function resetForm() {
    const location =
      locations.find((item) => item.id === shift?.sellingLocationId) ??
      locations[0];
    formRef.current?.reset();
    setLocationId(location?.id ?? "");
    setDateMode("range");
    setDateRange(undefined);
    setSpecificDates([]);
    setEditDate(shift ? fromDateKey(shift.shiftDate) : undefined);
    setAssignments(initialAssignments(employees, shift));
    setFeedback({});
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) resetForm();
  }

  function toggleEmployee(employee: EmployeeOption, checked: boolean) {
    setAssignments((current) => {
      if (!checked) {
        return ensureOperator(
          current.filter((item) => item.employeeId !== employee.id),
          employeeById,
        );
      }
      if (current.some((item) => item.employeeId === employee.id)) {
        return current;
      }
      const hasOperator = current.some(
        (item) => item.roleOnShift === "operator",
      );
      const roleOnShift: EditableAssignment["roleOnShift"] =
        employee.canUsePos && !hasOperator ? "operator" : "employee";
      return [
        ...current,
        {
          employeeId: employee.id,
          roleOnShift,
          salary: centsToInput(employee.defaultShiftRateCents),
        },
      ];
    });
  }

  function updateAssignment(
    employeeId: string,
    patch: Partial<Pick<EditableAssignment, "roleOnShift" | "salary">>,
  ) {
    setAssignments((current) => {
      const next = current.map((item) =>
        item.employeeId === employeeId ? { ...item, ...patch } : item,
      );
      return patch.roleOnShift && patch.roleOnShift !== "operator"
        ? ensureOperator(next, employeeById, employeeId)
        : next;
    });
  }

  function handleDateModeChange(mode: DateSelectionMode) {
    setDateMode(mode);
    setDateRange(undefined);
    setSpecificDates([]);
  }

  function assignmentValues() {
    return assignments.map((assignment) => ({
      employeeId: assignment.employeeId,
      roleOnShift: assignment.roleOnShift,
      salaryRateCents: moneyToCents(assignment.salary),
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const sharedValues = {
      sellingLocationId: locationId,
      title: String(formData.get("title") ?? "").trim(),
      assignments: assignmentValues(),
    };
    setFeedback({});

    startTransition(async () => {
      if (shift) {
        const result = await updateAdminShiftAction({
          shiftId: shift.id,
          ...sharedValues,
          shiftDate: editDate ? toDateKey(editDate) : "",
        });
        if (!result.ok) {
          setFeedback({ error: result.error, fieldErrors: result.fieldErrors });
          return;
        }
        toast.success(`${result.data.title} was updated.`);
      } else {
        const shiftDates =
          dateMode === "range"
            ? datesFromRange(dateRange)
            : datesFromSelection(specificDates);
        const result = await createAdminShiftAction({
          ...sharedValues,
          shiftDates,
        });
        if (!result.ok) {
          setFeedback({ error: result.error, fieldErrors: result.fieldErrors });
          return;
        }
        toast.success(
          result.data.createdCount === 1
            ? "Shift created."
            : `${result.data.createdCount} shifts created.`,
        );
      }
      setOpen(false);
      router.refresh();
    });
  }

  function cancelShift() {
    if (!shift) {
      return Promise.resolve({
        ok: false as const,
        error: "Shift form unavailable.",
      });
    }
    return cancelAdminShiftAction({ shiftId: shift.id });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant={isEditing ? "outline" : "default"}
          size={isEditing ? "sm" : "default"}
          className={isEditing ? "" : "h-11 rounded-xl"}
        >
          {isEditing ? (
            <Pencil aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          {isEditing ? "Edit" : "Create shift"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit shift" : "Create shift"}</DialogTitle>
          <DialogDescription>
            Choose the location, dates, and employees for this shift.
          </DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          className="space-y-6"
          onSubmit={handleSubmit}
          noValidate
        >
          <ActionErrorAlert feedback={feedback} />
          <ShiftScheduleFields
            locations={locations}
            locationId={locationId}
            shift={shift}
            feedback={feedback}
            disabled={isPending}
            dateMode={dateMode}
            dateRange={dateRange}
            specificDates={specificDates}
            editDate={editDate}
            onLocationChange={setLocationId}
            onDateModeChange={handleDateModeChange}
            onDateRangeChange={setDateRange}
            onSpecificDatesChange={setSpecificDates}
            onEditDateChange={setEditDate}
          />
          <ShiftAssignmentFields
            employees={employees}
            assignments={assignments}
            error={assignmentsError}
            disabled={isPending}
            onToggle={toggleEmployee}
            onUpdate={updateAssignment}
          />
          <DialogFooter>
            {shift ? (
              <SoftDeleteButton
                entityName={shift.title ?? shift.locationName}
                triggerLabel="Cancel shift"
                title="Cancel this shift?"
                description="The shift and its salary snapshots will remain in history, but employees will no longer be scheduled to work it."
                confirmLabel="Cancel shift"
                onDelete={cancelShift}
                onDeleted={() => {
                  toast.success("Shift cancelled.");
                  setOpen(false);
                  router.refresh();
                }}
              />
            ) : null}
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Close
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEditing
                  ? "Saving shift…"
                  : "Creating shifts…"
                : isEditing
                  ? "Save changes"
                  : "Create shift"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
