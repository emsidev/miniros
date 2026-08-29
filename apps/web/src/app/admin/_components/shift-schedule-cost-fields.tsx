"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SetupInput } from "./form-controls";
import type { ActionFeedback } from "./form-utils";
import { firstFieldError } from "./form-utils";
import type { LocationOption, ShiftRecord } from "./shift-form-types";
import { toLocalDateTime } from "./shift-form-types";

export function ShiftScheduleFields({
  locations,
  locationId,
  shift,
  feedback,
  disabled,
  onLocationChange,
}: {
  locations: LocationOption[];
  locationId: string;
  shift?: ShiftRecord;
  feedback: ActionFeedback;
  disabled: boolean;
  onLocationChange: (locationId: string) => void;
}) {
  const locationError = firstFieldError(feedback, "sellingLocationId");

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-bold">Schedule</legend>
      <div className="space-y-2">
        <Label htmlFor="shift-location">Selling location</Label>
        <Select
          value={locationId}
          onValueChange={onLocationChange}
          disabled={disabled}
        >
          <SelectTrigger
            id="shift-location"
            className="h-11 w-full rounded-xl"
            aria-invalid={Boolean(locationError)}
            aria-describedby={
              locationError ? "shift-location-error" : undefined
            }
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {locationError ? (
          <p
            id="shift-location-error"
            className="text-xs font-medium text-destructive"
          >
            {locationError}
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_0.7fr]">
        <SetupInput
          label="Shift title"
          feedback={feedback}
          name="title"
          maxLength={120}
          disabled={disabled}
          placeholder="Saturday market"
          defaultValue={shift?.title ?? ""}
        />
        <SetupInput
          label="Shift date"
          feedback={feedback}
          name="shiftDate"
          type="date"
          required
          disabled={disabled}
          defaultValue={shift?.shiftDate}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SetupInput
          label="Scheduled start"
          feedback={feedback}
          name="scheduledStartAt"
          type="datetime-local"
          disabled={disabled}
          defaultValue={toLocalDateTime(shift?.scheduledStartAt ?? null)}
        />
        <SetupInput
          label="Scheduled end"
          feedback={feedback}
          name="scheduledEndAt"
          type="datetime-local"
          disabled={disabled}
          defaultValue={toLocalDateTime(shift?.scheduledEndAt ?? null)}
        />
      </div>
    </fieldset>
  );
}

export function ShiftCostAndNotesFields({
  rentalCost,
  transportCost,
  shift,
  feedback,
  disabled,
  onRentalCostChange,
  onTransportCostChange,
}: {
  rentalCost: string;
  transportCost: string;
  shift?: ShiftRecord;
  feedback: ActionFeedback;
  disabled: boolean;
  onRentalCostChange: (value: string) => void;
  onTransportCostChange: (value: string) => void;
}) {
  const notesError = firstFieldError(feedback, "notes");
  const otherCostLabel =
    shift?.costs.find((cost) => cost.costType === "other")?.label ?? "";

  return (
    <>
      <fieldset className="space-y-4">
        <legend className="text-sm font-bold">Expected location costs</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="shift-rent">Rental cost (₱)</Label>
            <Input
              id="shift-rent"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={rentalCost}
              onChange={(event) => onRentalCostChange(event.target.value)}
              disabled={disabled}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shift-transport">Transport cost (₱)</Label>
            <Input
              id="shift-transport"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={transportCost}
              onChange={(event) => onTransportCostChange(event.target.value)}
              disabled={disabled}
              className="h-11 rounded-xl"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SetupInput
            label="Other cost (₱)"
            feedback={feedback}
            name="otherCostCents"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            defaultValue={((shift?.otherCostCents ?? 0) / 100).toFixed(2)}
            required
            disabled={disabled}
          />
          <SetupInput
            label="Other cost label"
            feedback={feedback}
            name="otherCostLabel"
            maxLength={120}
            disabled={disabled}
            placeholder="Event fee"
            defaultValue={otherCostLabel}
          />
        </div>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="shift-notes">Notes</Label>
        <Textarea
          id="shift-notes"
          name="notes"
          maxLength={2000}
          disabled={disabled}
          aria-invalid={Boolean(notesError)}
          aria-describedby={notesError ? "shift-notes-error" : undefined}
          className="min-h-20 rounded-xl"
          placeholder="Ingress, special setup, or team reminders…"
          defaultValue={shift?.notes ?? ""}
        />
        {notesError ? (
          <p
            id="shift-notes-error"
            className="text-xs font-medium text-destructive"
          >
            {notesError}
          </p>
        ) : null}
      </div>
    </>
  );
}
