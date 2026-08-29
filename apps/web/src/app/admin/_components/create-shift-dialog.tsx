"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
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
  createAdminShiftAction,
  updateAdminShiftAction,
} from "@/server/actions/admin-shifts";
import { ActionErrorAlert, SoftDeleteButton } from "./form-controls";
import {
  firstFieldError,
  moneyToCents,
  optionalText,
  type ActionFeedback,
} from "./form-utils";
import { ShiftAssignmentFields } from "./shift-assignment-fields";
import {
  ShiftCostAndNotesFields,
  ShiftScheduleFields,
} from "./shift-schedule-cost-fields";
import {
  cancelledShiftInput,
  centsToInput,
  initialAssignments,
  toIsoDateTime,
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
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [locationId, setLocationId] = useState(initialLocation?.id ?? "");
  const [rentalCost, setRentalCost] = useState(
    centsToInput(
      shift?.rentalCostCents ?? initialLocation?.defaultRentalCostCents ?? 0,
    ),
  );
  const [transportCost, setTransportCost] = useState(
    centsToInput(
      shift?.transportCostCents ??
        initialLocation?.defaultTransportCostCents ??
        0,
    ),
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
    setRentalCost(
      centsToInput(
        shift?.rentalCostCents ?? location?.defaultRentalCostCents ?? 0,
      ),
    );
    setTransportCost(
      centsToInput(
        shift?.transportCostCents ?? location?.defaultTransportCostCents ?? 0,
      ),
    );
    setAssignments(initialAssignments(employees, shift));
    setFeedback({});
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) resetForm();
  }

  function changeLocation(nextLocationId: string) {
    const location = locations.find((item) => item.id === nextLocationId);
    setLocationId(nextLocationId);
    if (location) {
      setRentalCost(centsToInput(location.defaultRentalCostCents));
      setTransportCost(centsToInput(location.defaultTransportCostCents));
    }
  }

  function toggleEmployee(employee: EmployeeOption, checked: boolean) {
    setAssignments((current) => {
      if (!checked) {
        return current.filter((item) => item.employeeId !== employee.id);
      }
      if (current.some((item) => item.employeeId === employee.id))
        return current;
      const hasOperator = current.some(
        (item) => item.roleOnShift === "operator",
      );
      return [
        ...current,
        {
          employeeId: employee.id,
          roleOnShift:
            employee.canUsePos && !hasOperator ? "operator" : "employee",
          salary: centsToInput(employee.defaultShiftRateCents),
        },
      ];
    });
  }

  function updateAssignment(
    employeeId: string,
    patch: Partial<Pick<EditableAssignment, "roleOnShift" | "salary">>,
  ) {
    setAssignments((current) =>
      current.map((item) =>
        item.employeeId === employeeId ? { ...item, ...patch } : item,
      ),
    );
  }

  function valuesFrom(formData: FormData) {
    return {
      sellingLocationId: locationId,
      title: optionalText(formData.get("title")),
      shiftDate: String(formData.get("shiftDate") ?? ""),
      scheduledStartAt: toIsoDateTime(formData.get("scheduledStartAt")),
      scheduledEndAt: toIsoDateTime(formData.get("scheduledEndAt")),
      notes: optionalText(formData.get("notes")),
      assignments: assignments.map((assignment) => ({
        employeeId: assignment.employeeId,
        roleOnShift: assignment.roleOnShift,
        salaryRateCents: moneyToCents(assignment.salary),
      })),
      rentalCostCents: moneyToCents(rentalCost),
      transportCostCents: moneyToCents(transportCost),
      otherCostCents: moneyToCents(formData.get("otherCostCents")),
      otherCostLabel: optionalText(formData.get("otherCostLabel")),
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = valuesFrom(new FormData(event.currentTarget));
    setFeedback({});
    startTransition(async () => {
      const result = shift
        ? await updateAdminShiftAction({
            shiftId: shift.id,
            ...values,
            status: "scheduled",
          })
        : await createAdminShiftAction(values);
      if (!result.ok) {
        setFeedback({ error: result.error, fieldErrors: result.fieldErrors });
        return;
      }
      toast.success(
        `${result.data.title ?? result.data.locationName} was ${isEditing ? "updated" : "scheduled"}.`,
      );
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
    return updateAdminShiftAction({
      shiftId: shift.id,
      ...cancelledShiftInput(shift),
    });
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
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit shift" : "Create shift"}</DialogTitle>
          <DialogDescription>
            Schedule the venue, expected costs, and salary snapshots together.
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
            onLocationChange={changeLocation}
          />
          <ShiftAssignmentFields
            employees={employees}
            assignments={assignments}
            error={assignmentsError}
            disabled={isPending}
            onToggle={toggleEmployee}
            onUpdate={updateAssignment}
          />
          <ShiftCostAndNotesFields
            rentalCost={rentalCost}
            transportCost={transportCost}
            shift={shift}
            feedback={feedback}
            disabled={isPending}
            onRentalCostChange={setRentalCost}
            onTransportCostChange={setTransportCost}
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
                  : "Creating shift…"
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
