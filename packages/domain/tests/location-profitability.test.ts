import { describe, expect, it } from "vitest";
import { calculateLocationProfitability } from "../src/location-profitability";

const date = (day: number) =>
  new Date(`2026-08-${String(day).padStart(2, "0")}T00:00:00.000Z`);

describe("location profitability", () => {
  it("aggregates shifts and returns the best, worst, and trend", () => {
    const result = calculateLocationProfitability({
      locationId: "booth-a",
      shifts: [
        {
          shiftId: "third",
          closedAt: date(3),
          grossSalesCents: 1_300,
          totalCostsCents: 1_000,
        },
        {
          shiftId: "first",
          closedAt: date(1),
          grossSalesCents: 900,
          totalCostsCents: 1_000,
        },
        {
          shiftId: "second",
          closedAt: date(2),
          grossSalesCents: 1_200,
          totalCostsCents: 1_000,
        },
      ],
    });

    expect(result).toMatchObject({
      locationId: "booth-a",
      totalShifts: 3,
      grossSalesCents: 3_400,
      totalCostsCents: 3_000,
      netProfitCents: 400,
      averageProfitPerShiftCents: 133,
      recommendation: "worth_renting_again",
      recommendationWindowShiftCount: 3,
      profitableShiftsInRecommendationWindow: 2,
      trendDirection: "improving",
    });
    expect(result.bestShift).toMatchObject({
      shiftId: "third",
      profitCents: 300,
      result: "profit",
    });
    expect(result.worstShift).toMatchObject({
      shiftId: "first",
      profitCents: -100,
      result: "loss",
    });
    expect(result.trend.map((point) => point.shiftId)).toEqual([
      "first",
      "second",
      "third",
    ]);
  });

  it("uses only the last three chronological shifts for the majority test", () => {
    const result = calculateLocationProfitability({
      locationId: "booth-a",
      shifts: [
        {
          shiftId: "recent-loss",
          closedAt: date(4),
          grossSalesCents: 0,
          totalCostsCents: 100,
        },
        {
          shiftId: "old-loss",
          closedAt: date(1),
          grossSalesCents: 0,
          totalCostsCents: 100,
        },
        {
          shiftId: "recent-profit-1",
          closedAt: date(2),
          grossSalesCents: 300,
          totalCostsCents: 100,
        },
        {
          shiftId: "recent-profit-2",
          closedAt: date(3),
          grossSalesCents: 300,
          totalCostsCents: 100,
        },
      ],
    });

    expect(result.netProfitCents).toBe(200);
    expect(result.profitableShiftsInRecommendationWindow).toBe(2);
    expect(result.recommendation).toBe("worth_renting_again");
  });

  it("needs review when positive average shifts are inconsistent", () => {
    const result = calculateLocationProfitability({
      locationId: "booth-a",
      shifts: [
        {
          shiftId: "profit",
          closedAt: date(1),
          grossSalesCents: 200,
          totalCostsCents: 100,
        },
        {
          shiftId: "loss",
          closedAt: date(2),
          grossSalesCents: 50,
          totalCostsCents: 100,
        },
      ],
    });

    expect(result.averageProfitPerShiftCents).toBe(25);
    expect(result.recommendation).toBe("needs_review");
  });

  it("marks negative average locations as not worth renting again", () => {
    const result = calculateLocationProfitability({
      locationId: "booth-a",
      shifts: [
        {
          shiftId: "profit",
          closedAt: date(1),
          grossSalesCents: 150,
          totalCostsCents: 100,
        },
        {
          shiftId: "loss",
          closedAt: date(2),
          grossSalesCents: 0,
          totalCostsCents: 100,
        },
      ],
    });

    expect(result.netProfitCents).toBe(-50);
    expect(result.recommendation).toBe("not_worth_renting_again");
    expect(result.trendDirection).toBe("declining");
  });

  it("treats an exact break-even location as needing review", () => {
    const result = calculateLocationProfitability({
      locationId: "booth-a",
      shifts: [
        {
          shiftId: "break-even",
          closedAt: date(1),
          grossSalesCents: 100,
          totalCostsCents: 100,
        },
      ],
    });

    expect(result.averageProfitPerShiftCents).toBe(0);
    expect(result.recommendation).toBe("needs_review");
  });

  it("returns a review verdict and null extrema when there is no data", () => {
    expect(
      calculateLocationProfitability({ locationId: "booth-a", shifts: [] }),
    ).toMatchObject({
      totalShifts: 0,
      grossSalesCents: 0,
      totalCostsCents: 0,
      netProfitCents: 0,
      averageProfitPerShiftCents: 0,
      bestShift: null,
      worstShift: null,
      trend: [],
      trendDirection: "insufficient_data",
      recommendation: "needs_review",
    });
  });

  it("rejects invalid location, date, and cents inputs", () => {
    expect(() =>
      calculateLocationProfitability({ locationId: " ", shifts: [] }),
    ).toThrow(/locationId must not be empty/);
    expect(() =>
      calculateLocationProfitability({
        locationId: "booth-a",
        shifts: [
          {
            shiftId: "shift",
            closedAt: new Date("invalid"),
            grossSalesCents: 100,
            totalCostsCents: 0,
          },
        ],
      }),
    ).toThrow(/valid date/);
    expect(() =>
      calculateLocationProfitability({
        locationId: "booth-a",
        shifts: [
          {
            shiftId: "shift",
            closedAt: date(1),
            grossSalesCents: -1,
            totalCostsCents: 0,
          },
        ],
      }),
    ).toThrow(/must not be negative/);
  });
});
