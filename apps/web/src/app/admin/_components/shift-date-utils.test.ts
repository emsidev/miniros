import { describe, expect, it } from "vitest";
import {
  datesFromRange,
  datesFromSelection,
  fromDateKey,
  toDateKey,
} from "./shift-date-utils";

describe("shift date helpers", () => {
  it("keeps calendar dates free from timezone conversion", () => {
    const date = new Date(2026, 8, 2);
    expect(toDateKey(date)).toBe("2026-09-02");
    expect(toDateKey(fromDateKey("2026-09-02")!)).toBe("2026-09-02");
  });

  it("rejects impossible calendar dates", () => {
    expect(fromDateKey("2026-02-29")).toBeUndefined();
    expect(fromDateKey("09/02/2026")).toBeUndefined();
  });

  it("expands a range inclusively", () => {
    expect(
      datesFromRange({
        from: new Date(2026, 8, 2),
        to: new Date(2026, 8, 5),
      }),
    ).toEqual(["2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"]);
  });

  it("treats an unfinished range as one shift", () => {
    expect(datesFromRange({ from: new Date(2026, 8, 2) })).toEqual([
      "2026-09-02",
    ]);
  });

  it("deduplicates and sorts specific dates", () => {
    expect(
      datesFromSelection([
        new Date(2026, 8, 9),
        new Date(2026, 8, 2),
        new Date(2026, 8, 9),
      ]),
    ).toEqual(["2026-09-02", "2026-09-09"]);
  });
});
