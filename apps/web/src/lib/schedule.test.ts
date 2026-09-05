import { describe, expect, it } from "vitest";
import { isAssigned, joinEligibility, monthDays, moveMonth } from "./schedule";
import { manilaToday } from "./shift-planning";

describe("schedule calendar", () => {
  it("navigates year boundaries and fills complete weeks including leap days", () => {
    expect(moveMonth("2026-12-31", 1)).toBe("2027-01-01");
    expect(moveMonth("2026-01-31", -1)).toBe("2025-12-01");
    const days = monthDays("2028-02-15");
    expect(days).toContain("2028-02-29");
    expect(days.length % 7).toBe(0);
    expect(new Set(days).size).toBe(days.length);
    expect(monthDays("2026-08-01")).toHaveLength(42);
    expect(manilaToday(new Date("2026-09-04T16:00:00Z"))).toBe("2026-09-05");
  });
  it("recognizes personal assignments without treating drafts or cancellations as conflicts", () => {
    for (const status of ["assigned", "confirmed", "completed"])
      expect(isAssigned(status)).toBe(true);
    for (const status of ["draft", "cancelled", null])
      expect(isAssigned(status)).toBe(false);
  });
});
describe("join eligibility", () => {
  const shift = {
    status: "scheduled" as const,
    shiftDate: "2026-09-05",
    actualStartAt: null,
    scheduledStartAt: null,
  };
  const options = {
    assigned: false,
    conflict: false,
    reserved: false,
    employeeEligible: true,
    today: "2026-09-05",
    now: new Date("2026-09-05T00:00:00Z"),
  };
  it("allows today and later only before start", () => {
    expect(joinEligibility(shift, options).canJoin).toBe(true);
    expect(
      joinEligibility({ ...shift, shiftDate: "2026-09-06" }, options).canJoin,
    ).toBe(true);
    for (const change of [
      { shiftDate: "2026-09-04" },
      { actualStartAt: options.now },
      { scheduledStartAt: options.now },
      { deletedAt: options.now },
      ...(["draft", "active", "closing", "closed", "cancelled"] as const).map(
        (status) => ({ status }),
      ),
    ]) {
      expect(joinEligibility({ ...shift, ...change }, options).canJoin).toBe(
        false,
      );
    }
  });
  it("explains conflicts, assignments, offline reservations, and employee eligibility", () => {
    for (const change of [
      { assigned: true },
      { conflict: true },
      { reserved: true },
      { employeeEligible: false },
    ]) {
      const result = joinEligibility(shift, { ...options, ...change });
      expect(result.canJoin).toBe(false);
      expect(result.reason).toBeTruthy();
    }
  });
});
