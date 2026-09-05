export type InventoryShiftOption = {
  id: string;
  title: string | null;
  locationName: string;
  shiftDate: string;
  status: string;
  assignmentStatus: string;
  createdAt: Date;
};

export function eligibleInventoryShift(
  shift: Pick<InventoryShiftOption, "status" | "assignmentStatus">,
) {
  return shift.status === "closed"
    ? ["assigned", "confirmed", "completed"].includes(shift.assignmentStatus)
    : ["active", "closing"].includes(shift.status) &&
        ["assigned", "confirmed"].includes(shift.assignmentStatus);
}

export function selectInventoryShift<T extends InventoryShiftOption>(
  shifts: readonly T[],
  requestedId?: string,
) {
  const eligible = shifts.filter(eligibleInventoryShift);
  const priority = (status: string) =>
    status === "active" ? 0 : status === "closing" ? 1 : 2;
  const options = [...eligible].sort(
    (a, b) =>
      priority(a.status) - priority(b.status) ||
      b.shiftDate.localeCompare(a.shiftDate) ||
      b.createdAt.getTime() - a.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );
  return {
    options,
    selected:
      requestedId !== undefined
        ? (options.find((shift) => shift.id === requestedId) ?? null)
        : (options[0] ?? null),
  };
}

export function historyPage(value?: string) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, 100000)
    : 1;
}
