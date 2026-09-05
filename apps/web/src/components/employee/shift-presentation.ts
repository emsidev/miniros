import type { ShiftStatus } from "@miniros/contracts/constants";

type Shift = {
  id: string;
  status: ShiftStatus;
  shiftDate: string;
  assignmentStatus: string;
};
export function shiftAction(
  shift: Pick<Shift, "id" | "status" | "assignmentStatus">,
  canUsePos: boolean,
) {
  if (canUsePos && ["assigned", "confirmed"].includes(shift.assignmentStatus)) {
    if (shift.status === "scheduled")
      return { label: "Start shift", href: `/shifts/${shift.id}/start` };
    if (shift.status === "active")
      return { label: "Sell", href: `/pos?shift=${shift.id}` };
    if (shift.status === "closing")
      return { label: "Continue closeout", href: `/shifts/${shift.id}/close` };
  }
  return {
    label: shift.status === "closed" ? "View summary" : "View shift",
    href: `/shifts/${shift.id}`,
  };
}

export function groupShifts<T extends Shift>(shifts: readonly T[]) {
  const ascending = (a: T, b: T) => a.shiftDate.localeCompare(b.shiftDate);
  return {
    current: shifts
      .filter(
        (shift) => shift.status === "active" || shift.status === "closing",
      )
      .sort(ascending),
    upcoming: shifts
      .filter(
        (shift) => shift.status === "scheduled" || shift.status === "draft",
      )
      .sort(ascending),
    history: shifts
      .filter(
        (shift) => shift.status === "closed" || shift.status === "cancelled",
      )
      .sort((a, b) => ascending(b, a)),
  };
}

export function shiftWorkspaceHref(
  href: string,
  shift: { id: string; status: string } | null,
  requestedShiftId: string | null,
) {
  if (href !== "/pos" && href !== "/inventory") return href;
  const shiftId = shift
    ? shift.status === "active" ||
      (href === "/inventory" && ["closing", "closed"].includes(shift.status))
      ? shift.id
      : null
    : requestedShiftId;
  return shiftId ? `${href}?shift=${encodeURIComponent(shiftId)}` : href;
}
