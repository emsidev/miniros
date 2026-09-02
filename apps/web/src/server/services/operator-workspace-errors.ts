import { AccessError } from "./access-error";

export type OperationalShiftUnavailableReason =
  "no_active_shift" | "requested_shift_unavailable";

export class OperationalShiftUnavailableError extends AccessError {
  constructor(public readonly reason: OperationalShiftUnavailableReason) {
    super(
      reason === "requested_shift_unavailable"
        ? "No eligible assigned shift was found."
        : "You do not have an eligible active shift.",
    );
    this.name = "OperationalShiftUnavailableError";
  }
}
