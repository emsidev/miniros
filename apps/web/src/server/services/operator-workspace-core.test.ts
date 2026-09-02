import { describe, expect, it } from "vitest";

import { AccessError } from "./access-error";
import {
  OperationalShiftUnavailableError,
  type OperationalShiftUnavailableReason,
} from "./operator-workspace-errors";

describe("OperationalShiftUnavailableError", () => {
  it.each([
    ["no_active_shift", "You do not have an eligible active shift."],
    ["requested_shift_unavailable", "No eligible assigned shift was found."],
  ] as const)(
    "preserves the %s reason and a safe message",
    (reason, message) => {
      const error = new OperationalShiftUnavailableError(
        reason as OperationalShiftUnavailableReason,
      );

      expect(error).toBeInstanceOf(AccessError);
      expect(error.reason).toBe(reason);
      expect(error.message).toBe(message);
    },
  );
});
