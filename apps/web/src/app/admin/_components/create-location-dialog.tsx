"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { locationTypes, type LocationType } from "@miniros/contracts";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createLocationAction,
  softDeleteLocationAction,
  updateLocationAction,
} from "@/server/actions/locations";
import {
  ActionErrorAlert,
  SetupInput,
  SoftDeleteButton,
} from "./form-controls";
import {
  firstFieldError,
  humanize,
  moneyToCents,
  optionalText,
  type ActionFeedback,
} from "./form-utils";
import type { LocationRecord } from "./location-form-types";

export function CreateLocationDialog({
  location,
}: {
  location?: LocationRecord;
} = {}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [locationType, setLocationType] = useState<LocationType>(
    location?.locationType ?? "booth",
  );
  const [feedback, setFeedback] = useState<ActionFeedback>({});
  const locationTypeError = firstFieldError(feedback, "locationType");
  const notesError = firstFieldError(feedback, "notes");
  const isEditing = Boolean(location);

  function resetForm() {
    formRef.current?.reset();
    setLocationType(location?.locationType ?? "booth");
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
        name: String(formData.get("name") ?? ""),
        locationType,
        address: optionalText(formData.get("address")),
        notes: optionalText(formData.get("notes")),
        defaultRentalCostCents: moneyToCents(
          formData.get("defaultRentalCostCents"),
        ),
        defaultTransportCostCents: moneyToCents(
          formData.get("defaultTransportCostCents"),
        ),
        status: location?.status === "inactive" ? "inactive" : "active",
      };
      const result = location
        ? await updateLocationAction({ locationId: location.id, ...values })
        : await createLocationAction(values);

      if (!result.ok) {
        setFeedback({
          error: result.error,
          fieldErrors: result.fieldErrors,
        });
        return;
      }

      toast.success(
        `${result.data.name} was ${isEditing ? "updated" : "added"}.`,
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
          {isEditing ? "Edit" : "Add location"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit selling location" : "Add selling location"}
          </DialogTitle>
          <DialogDescription>
            Save the typical rent and transport costs used when planning shifts.
          </DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          className="space-y-5"
          onSubmit={handleSubmit}
          noValidate
        >
          <ActionErrorAlert feedback={feedback} />
          <div className="grid gap-4 sm:grid-cols-[1fr_0.75fr]">
            <SetupInput
              label="Location name"
              feedback={feedback}
              name="name"
              minLength={2}
              maxLength={120}
              required
              autoFocus
              disabled={isPending}
              placeholder="Greenfield Weekend Bazaar"
              defaultValue={location?.name}
            />
            <div className="space-y-2">
              <Label htmlFor="location-type">Location type</Label>
              <Select
                value={locationType}
                onValueChange={(value) =>
                  setLocationType(value as LocationType)
                }
                disabled={isPending}
              >
                <SelectTrigger
                  id="location-type"
                  className="h-11 w-full rounded-xl"
                  aria-invalid={Boolean(locationTypeError)}
                  aria-describedby={
                    locationTypeError ? "location-type-error" : undefined
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locationTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {humanize(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {locationTypeError ? (
                <p
                  id="location-type-error"
                  className="text-xs font-medium text-destructive"
                >
                  {locationTypeError}
                </p>
              ) : null}
            </div>
          </div>
          <SetupInput
            label="Address"
            feedback={feedback}
            name="address"
            maxLength={500}
            disabled={isPending}
            placeholder="Mandaluyong City"
            defaultValue={location?.address ?? ""}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SetupInput
              label="Default rent (₱)"
              feedback={feedback}
              name="defaultRentalCostCents"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              defaultValue={(
                (location?.defaultRentalCostCents ?? 0) / 100
              ).toFixed(2)}
              required
              disabled={isPending}
            />
            <SetupInput
              label="Default transport (₱)"
              feedback={feedback}
              name="defaultTransportCostCents"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              defaultValue={(
                (location?.defaultTransportCostCents ?? 0) / 100
              ).toFixed(2)}
              required
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location-notes">Notes</Label>
            <Textarea
              id="location-notes"
              name="notes"
              maxLength={2000}
              disabled={isPending}
              aria-invalid={Boolean(notesError)}
              aria-describedby={notesError ? "location-notes-error" : undefined}
              className="min-h-20 rounded-xl"
              placeholder="Power access, ingress details, contact person…"
              defaultValue={location?.notes ?? ""}
            />
            {notesError ? (
              <p
                id="location-notes-error"
                className="text-xs font-medium text-destructive"
              >
                {notesError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            {location ? (
              <SoftDeleteButton
                entityName={location.name}
                onDelete={() =>
                  softDeleteLocationAction({ locationId: location.id })
                }
                onDeleted={() => {
                  toast.success(`${location.name} was deleted.`);
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
                  ? "Saving location…"
                  : "Adding location…"
                : isEditing
                  ? "Save changes"
                  : "Add location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
