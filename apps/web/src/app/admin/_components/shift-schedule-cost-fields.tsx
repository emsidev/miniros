"use client";

import { CalendarDays, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { SetupInput } from "./form-controls";
import {
  datesFromRange,
  datesFromSelection,
  formatDateSelection,
} from "./shift-date-utils";
import type { ActionFeedback } from "./form-utils";
import { firstFieldError } from "./form-utils";
import type { LocationOption, ShiftRecord } from "./shift-form-types";

export type DateSelectionMode = "range" | "dates";

export function ShiftScheduleFields({
  locations,
  locationId,
  shift,
  feedback,
  disabled,
  dateMode,
  dateRange,
  specificDates,
  editDate,
  onLocationChange,
  onDateModeChange,
  onDateRangeChange,
  onSpecificDatesChange,
  onEditDateChange,
}: {
  locations: LocationOption[];
  locationId: string;
  shift?: ShiftRecord;
  feedback: ActionFeedback;
  disabled: boolean;
  dateMode: DateSelectionMode;
  dateRange: DateRange | undefined;
  specificDates: Date[];
  editDate: Date | undefined;
  onLocationChange: (locationId: string) => void;
  onDateModeChange: (mode: DateSelectionMode) => void;
  onDateRangeChange: (range: DateRange | undefined) => void;
  onSpecificDatesChange: (dates: Date[]) => void;
  onEditDateChange: (date: Date | undefined) => void;
}) {
  const locationError = firstFieldError(feedback, "sellingLocationId");
  const dateError = firstFieldError(
    feedback,
    shift ? "shiftDate" : "shiftDates",
  );
  const selectedDateKeys = shift
    ? editDate
      ? datesFromSelection([editDate])
      : []
    : dateMode === "range"
      ? datesFromRange(dateRange)
      : datesFromSelection(specificDates);

  return (
    <fieldset className="space-y-5">
      <legend className="sr-only">Shift details</legend>
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
            <SelectValue placeholder="Select a location" />
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

      <SetupInput
        label="Shift title"
        feedback={feedback}
        name="title"
        maxLength={120}
        required
        disabled={disabled}
        placeholder="Manila City Events"
        defaultValue={shift?.title ?? ""}
      />

      <div className="space-y-2">
        <Label htmlFor="shift-dates">
          {shift ? "Shift date" : "Shift dates"}
        </Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="shift-dates"
              type="button"
              variant="outline"
              disabled={disabled}
              aria-invalid={Boolean(dateError)}
              aria-describedby={dateError ? "shift-dates-error" : undefined}
              className={cn(
                "h-11 w-full justify-between rounded-xl px-3 font-normal",
                selectedDateKeys.length === 0 && "text-muted-foreground",
              )}
            >
              <span className="flex min-w-0 items-center gap-2 truncate">
                <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {formatDateSelection(selectedDateKeys)}
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[calc(100vw-3rem)] max-w-sm gap-3 p-3 sm:w-auto"
          >
            {!shift ? (
              <ToggleGroup
                type="single"
                value={dateMode}
                onValueChange={(value) => {
                  if (value === "range" || value === "dates") {
                    onDateModeChange(value);
                  }
                }}
                variant="outline"
                spacing={0}
                className="grid w-full grid-cols-2"
              >
                <ToggleGroupItem value="range">Date range</ToggleGroupItem>
                <ToggleGroupItem value="dates">Specific dates</ToggleGroupItem>
              </ToggleGroup>
            ) : null}

            {shift ? (
              <Calendar
                mode="single"
                selected={editDate}
                onSelect={onEditDateChange}
                defaultMonth={editDate}
                className="mx-auto"
              />
            ) : dateMode === "range" ? (
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={onDateRangeChange}
                defaultMonth={dateRange?.from}
                className="mx-auto"
              />
            ) : (
              <Calendar
                mode="multiple"
                selected={specificDates}
                onSelect={(dates) => onSpecificDatesChange(dates ?? [])}
                defaultMonth={specificDates[0]}
                className="mx-auto"
              />
            )}

            <p className="border-t pt-3 text-xs text-muted-foreground">
              {selectedDateKeys.length === 0
                ? "Select at least one date."
                : `${selectedDateKeys.length} ${selectedDateKeys.length === 1 ? "shift" : "shifts"} will be ${shift ? "updated" : "created"}.`}
            </p>
          </PopoverContent>
        </Popover>
        {dateError ? (
          <p
            id="shift-dates-error"
            className="text-xs font-medium text-destructive"
          >
            {dateError}
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
