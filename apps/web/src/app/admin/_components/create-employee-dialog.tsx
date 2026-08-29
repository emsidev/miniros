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
  createEmployeeAction,
  softDeleteEmployeeAction,
  updateEmployeeAction,
} from "@/server/actions/employees";
import {
  ActionErrorAlert,
  FieldGroup,
  SetupInput,
  SoftDeleteButton,
  ToggleField,
} from "./form-controls";
import { moneyToCents, optionalText, type ActionFeedback } from "./form-utils";

type EmployeeRecord = {
  id: string;
  memberId: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: "active" | "inactive" | "deleted";
  defaultShiftRateCents: number;
  canUsePos: boolean;
  canLogProduction: boolean;
};

export function CreateEmployeeDialog({
  employee,
}: {
  employee?: EmployeeRecord;
} = {}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [canUsePos, setCanUsePos] = useState(employee?.canUsePos ?? false);
  const [canLogProduction, setCanLogProduction] = useState(
    employee?.canLogProduction ?? true,
  );
  const [feedback, setFeedback] = useState<ActionFeedback>({});
  const isEditing = Boolean(employee);

  function resetForm() {
    formRef.current?.reset();
    setCanUsePos(employee?.canUsePos ?? false);
    setCanLogProduction(employee?.canLogProduction ?? true);
    setFeedback({});
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) resetForm();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setFeedback({});
    startTransition(async () => {
      const values = {
        memberId: employee?.memberId ?? null,
        displayName: String(formData.get("displayName") ?? ""),
        email: optionalText(formData.get("email")),
        phone: optionalText(formData.get("phone")),
        status: employee?.status === "inactive" ? "inactive" : "active",
        defaultShiftRateCents: moneyToCents(
          formData.get("defaultShiftRateCents"),
        ),
        canUsePos,
        canLogProduction,
      };
      const result = employee
        ? await updateEmployeeAction({ employeeId: employee.id, ...values })
        : await createEmployeeAction(values);

      if (!result.ok) {
        setFeedback({
          error: result.error,
          fieldErrors: result.fieldErrors,
        });
        return;
      }

      toast.success(
        `${result.data.displayName} was ${isEditing ? "updated" : "added"}.`,
      );
      setOpen(false);
      resetForm();
      router.refresh();
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
          {isEditing ? "Edit" : "Add employee"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit employee" : "Add employee"}
          </DialogTitle>
          <DialogDescription>
            Set the employee&apos;s access and default pay per shift.
          </DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          className="space-y-5"
          onSubmit={handleSubmit}
          noValidate
        >
          <ActionErrorAlert feedback={feedback} />
          <SetupInput
            label="Display name"
            feedback={feedback}
            name="displayName"
            autoComplete="name"
            minLength={2}
            maxLength={100}
            required
            autoFocus
            disabled={isPending}
            placeholder="Mika Santos"
            defaultValue={employee?.displayName}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SetupInput
              label="Email"
              feedback={feedback}
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              disabled={isPending}
              placeholder="mika@example.com"
              hint="Required when POS access is enabled."
              defaultValue={employee?.email ?? ""}
            />
            <SetupInput
              label="Phone"
              feedback={feedback}
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={40}
              disabled={isPending}
              placeholder="0917 123 4567"
              defaultValue={employee?.phone ?? ""}
            />
          </div>
          <SetupInput
            label="Default pay per shift"
            feedback={feedback}
            name="defaultShiftRateCents"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            defaultValue={(
              (employee?.defaultShiftRateCents ?? 0) / 100
            ).toFixed(2)}
            required
            disabled={isPending}
            hint="This becomes the starting salary snapshot when assigned."
          />
          <FieldGroup label="Permissions">
            <ToggleField
              id="employee-pos-access"
              label="Can use POS"
              description="Allows this employee to finalize sales on assigned shifts."
              checked={canUsePos}
              onCheckedChange={setCanUsePos}
              disabled={isPending}
            />
            <ToggleField
              id="employee-production-access"
              label="Can log production"
              description="Allows this employee to record prepared or manufactured stock."
              checked={canLogProduction}
              onCheckedChange={setCanLogProduction}
              disabled={isPending}
            />
          </FieldGroup>
          <DialogFooter>
            {employee ? (
              <SoftDeleteButton
                entityName={employee.displayName}
                onDelete={() =>
                  softDeleteEmployeeAction({ employeeId: employee.id })
                }
                onDeleted={() => {
                  toast.success(`${employee.displayName} was deleted.`);
                  setOpen(false);
                  router.refresh();
                }}
              />
            ) : null}
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEditing
                  ? "Saving employee…"
                  : "Adding employee…"
                : isEditing
                  ? "Save changes"
                  : "Add employee"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
