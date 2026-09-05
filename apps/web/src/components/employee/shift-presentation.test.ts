import { describe, expect, it } from "vitest";
import {
  groupShifts,
  shiftAction,
  shiftWorkspaceHref,
} from "./shift-presentation";
import type { ShiftStatus } from "@miniros/contracts/constants";
const shift = (status: ShiftStatus, date = "2026-09-05") => ({
  id: status,
  status,
  shiftDate: date,
  assignmentStatus: "assigned",
});
describe("employee shift presentation", () => {
  it("routes each operational state to its next action", () => {
    expect(shiftAction(shift("scheduled"), true).href).toBe(
      "/shifts/scheduled/start",
    );
    expect(shiftAction(shift("active"), true).href).toBe("/pos?shift=active");
    expect(shiftAction(shift("closing"), true).href).toBe(
      "/shifts/closing/close",
    );
    expect(shiftAction(shift("closed"), true).label).toBe("View summary");
  });
  it("does not expose operational actions to non-POS or completed assignments", () => {
    for (const status of ["scheduled", "active", "closing"] as const) {
      expect(shiftAction(shift(status), false).href).toBe(`/shifts/${status}`);
      expect(
        shiftAction({ ...shift(status), assignmentStatus: "completed" }, true)
          .href,
      ).toBe(`/shifts/${status}`);
    }
    expect(shiftAction(shift("cancelled"), true).label).toBe("View shift");
  });
  it("groups in-progress work and sorts upcoming dates and history independently", () => {
    const data = [
      shift("closed", "2026-09-01"),
      shift("scheduled", "2026-09-07"),
      shift("active"),
      shift("scheduled", "2026-09-06"),
      shift("closing"),
      shift("closed", "2026-09-03"),
    ];
    const groups = groupShifts(data);
    expect(groups.current.map((item) => item.status)).toEqual([
      "active",
      "closing",
    ]);
    expect(groups.upcoming.map((item) => item.shiftDate)).toEqual([
      "2026-09-06",
      "2026-09-07",
    ]);
    expect(groups.history.map((item) => item.shiftDate)).toEqual([
      "2026-09-03",
      "2026-09-01",
    ]);
    expect(data[0].shiftDate).toBe("2026-09-01");
  });
});

describe("shift navigation context", () => {
  it("carries active shifts and retains closing inventory context", () => {
    expect(shiftWorkspaceHref("/pos", shift("active"), null)).toBe(
      "/pos?shift=active",
    );
    expect(shiftWorkspaceHref("/inventory", shift("closing"), null)).toBe(
      "/inventory?shift=closing",
    );
    expect(shiftWorkspaceHref("/pos", shift("closing"), null)).toBe("/pos");
  });
  it("keeps closed inventory history separate from selling", () => {
    expect(shiftWorkspaceHref("/inventory", shift("closed"), "old")).toBe(
      "/inventory?shift=closed",
    );
    expect(shiftWorkspaceHref("/pos", shift("closed"), "old")).toBe("/pos");
    for (const status of ["scheduled", "cancelled"] as const) {
      expect(shiftWorkspaceHref("/pos", shift(status), "old")).toBe("/pos");
      expect(shiftWorkspaceHref("/inventory", shift(status), "old")).toBe(
        "/inventory",
      );
    }
    expect(shiftWorkspaceHref("/profile", shift("active"), null)).toBe(
      "/profile",
    );
    expect(shiftWorkspaceHref("/inventory", null, "explicit")).toBe(
      "/inventory?shift=explicit",
    );
  });
});
