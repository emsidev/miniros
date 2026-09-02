import { eachDayOfInterval } from "date-fns";
import type { DateRange } from "react-day-picker";

const dateLabelFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
});

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function fromDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return toDateKey(date) === value ? date : undefined;
}

export function datesFromRange(range: DateRange | undefined) {
  if (!range?.from) return [];
  return eachDayOfInterval({
    start: range.from,
    end: range.to ?? range.from,
  }).map(toDateKey);
}

export function datesFromSelection(dates: Date[] | undefined) {
  return [...new Set((dates ?? []).map(toDateKey))].sort();
}

export function formatDateSelection(dateKeys: string[]) {
  const dates = dateKeys
    .map(fromDateKey)
    .filter((date): date is Date => Boolean(date));
  if (dates.length === 0) return "Choose dates";
  if (dates.length === 1) return dateLabelFormatter.format(dates[0]);
  if (dates.length === 2) {
    return `${dateLabelFormatter.format(dates[0])} and ${dateLabelFormatter.format(dates[1])}`;
  }
  return `${dateLabelFormatter.format(dates[0])} – ${dateLabelFormatter.format(dates.at(-1)!)} · ${dates.length} shifts`;
}
