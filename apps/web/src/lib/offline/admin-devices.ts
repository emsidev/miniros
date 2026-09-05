export type AdminDeviceSession = {
  id: string;
  shiftId: string;
  title: string;
  locationName: string;
  shiftDate: string;
  operator: string;
  deviceLabel: string;
  status: string;
  acknowledgedSequence: number;
  lastError: string | null;
  lastAcknowledgedAt: string | null;
};

export function deviceNeedsAttention(
  session: Pick<AdminDeviceSession, "status" | "lastError">,
) {
  return (
    session.status === "recovery" ||
    session.status === "closing" ||
    Boolean(session.lastError)
  );
}

export function deviceStatusLabel(
  session: Pick<AdminDeviceSession, "status" | "lastError">,
) {
  if (session.status === "recovery") return "Frozen";
  if (session.lastError) return "Needs attention";
  return (
    (
      {
        prepared: "Assigned to device",
        active: "Shift in progress",
        closing: "Closeout pending",
        closed: "Closed",
        released: "Released",
      } as Record<string, string>
    )[session.status] ?? "Needs attention"
  );
}

export type DeviceJournalEntry = {
  sequence: number | null;
  status: string;
  actionType: string;
  errorMessage: string | null;
  conflictCode: string | null;
  payloadDigest: string | null;
  payload: unknown;
  result: unknown;
  syncedAt: string | null;
  createdAt: string;
};

export function journalActionLabel(type: string) {
  return (
    (
      {
        start_shift: "Opening stock recorded",
        create_sale: "Sale recorded",
        submit_cash_deduction: "Cash request",
        submit_inventory_adjustment: "Stock adjustment request",
        submit_closeout: "Closeout submitted",
      } as Record<string, string>
    )[type.toLowerCase()] ?? type.toLowerCase().replaceAll("_", " ")
  );
}
