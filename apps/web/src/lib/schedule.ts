import type { ShiftStatus } from "@miniros/contracts/constants";

export const publishedShiftStatuses = [
  "scheduled",
  "active",
  "closing",
  "closed",
] as const;
export const assignedStatuses = ["assigned", "confirmed", "completed"] as const;

export function isAssigned(status: string | null): boolean {
  return assignedStatuses.some((candidate) => candidate === status);
}

export function joinEligibility(
  shift: {
    status: ShiftStatus;
    shiftDate: string;
    actualStartAt: Date | null;
    scheduledStartAt: Date | null;
    deletedAt?: Date | null;
  },
  options: {
    assigned: boolean;
    conflict: boolean;
    reserved: boolean;
    employeeEligible: boolean;
    today: string;
    now: Date;
  },
) {
  if (options.assigned)
    return { canJoin: false, reason: "You are assigned to this shift." };
  if (!options.employeeEligible)
    return {
      canJoin: false,
      reason: "An eligible employee record is required to join.",
    };
  if (
    shift.deletedAt ||
    !publishedShiftStatuses.some((status) => status === shift.status)
  )
    return { canJoin: false, reason: "This shift is unavailable." };
  if (
    shift.status !== "scheduled" ||
    shift.actualStartAt ||
    (shift.scheduledStartAt && shift.scheduledStartAt <= options.now)
  )
    return {
      canJoin: false,
      reason: "This shift has already started or ended.",
    };
  if (shift.shiftDate < options.today)
    return { canJoin: false, reason: "Past shifts cannot be joined." };
  if (options.conflict)
    return {
      canJoin: false,
      reason: "You already have an assignment on this date.",
    };
  if (options.reserved)
    return {
      canJoin: false,
      reason: "This shift is reserved for an offline device.",
    };
  return { canJoin: true, reason: null };
}

export type ScheduleShift = {
  id: string;
  title: string | null;
  shiftDate: string;
  locationName: string;
  status: ShiftStatus;
  assignmentStatus:
    "draft" | "assigned" | "confirmed" | "completed" | "cancelled" | null;
  assigned: boolean;
  conflict: boolean;
  canJoin: boolean;
  reason: string | null;
};

// UTC arithmetic keeps calendar dates independent of the device time zone/DST.
export function calendarDate(date: string) {
  return new Date(`${date}T00:00:00Z`);
}
export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
export function moveMonth(date: string, offset: number) {
  const value = calendarDate(date);
  return dateKey(
    new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + offset, 1)),
  );
}
export function monthDays(date: string) {
  const first = calendarDate(`${date.slice(0, 7)}-01`);
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  const daysInMonth =
    (calendarDate(moveMonth(date, 1)).getTime() - first.getTime()) / 86400000;
  const count = Math.ceil((first.getUTCDay() + daysInMonth) / 7) * 7;
  return Array.from({ length: count }, (_, index) =>
    dateKey(new Date(start.getTime() + index * 86400000)),
  );
}
