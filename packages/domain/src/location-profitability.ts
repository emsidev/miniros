import {
  addCents,
  assertNonNegativeCents,
  divideCents,
  subtractCents,
  type Cents,
} from "./money";
import { classifyProfit, type ProfitResult } from "./shift-profit";

export const LOCATION_RECOMMENDATION_WINDOW_SIZE = 3;

export const locationRecommendations = [
  "worth_renting_again",
  "needs_review",
  "not_worth_renting_again",
] as const;

export type LocationRecommendation = (typeof locationRecommendations)[number];

export type ProfitTrendDirection =
  "insufficient_data" | "improving" | "stable" | "declining";

export type ClosedShiftProfitInput = Readonly<{
  closedAt: Date;
  grossSalesCents: Cents;
  shiftId: string;
  totalCostsCents: Cents;
}>;

export type LocationProfitabilityInput = Readonly<{
  locationId: string;
  shifts: readonly ClosedShiftProfitInput[];
}>;

export type LocationShiftProfit = Readonly<{
  closedAt: Date;
  grossSalesCents: Cents;
  profitCents: Cents;
  result: ProfitResult;
  shiftId: string;
  totalCostsCents: Cents;
}>;

export type LocationProfitTrendPoint = Readonly<{
  closedAt: Date;
  profitCents: Cents;
  shiftId: string;
}>;

export type LocationProfitabilitySummary = Readonly<{
  averageProfitPerShiftCents: Cents;
  bestShift: LocationShiftProfit | null;
  grossSalesCents: Cents;
  locationId: string;
  netProfitCents: Cents;
  profitableShiftsInRecommendationWindow: number;
  recommendation: LocationRecommendation;
  recommendationWindowShiftCount: number;
  totalCostsCents: Cents;
  totalShifts: number;
  trend: readonly LocationProfitTrendPoint[];
  trendDirection: ProfitTrendDirection;
  worstShift: LocationShiftProfit | null;
}>;

function requireNonBlank(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new TypeError(`${label} must not be empty.`);
  }

  return trimmed;
}

function getTrendDirection(
  shifts: readonly LocationShiftProfit[],
): ProfitTrendDirection {
  if (shifts.length < 2) {
    return "insufficient_data";
  }

  const firstProfit = shifts[0]?.profitCents ?? 0;
  const lastProfit = shifts.at(-1)?.profitCents ?? 0;
  if (lastProfit > firstProfit) {
    return "improving";
  }

  if (lastProfit < firstProfit) {
    return "declining";
  }

  return "stable";
}

function getRecommendation(
  netProfitCents: Cents,
  recommendationWindow: readonly LocationShiftProfit[],
): LocationRecommendation {
  if (netProfitCents < 0) {
    return "not_worth_renting_again";
  }

  if (netProfitCents === 0 || recommendationWindow.length === 0) {
    return "needs_review";
  }

  const profitableCount = recommendationWindow.filter(
    (shift) => shift.profitCents > 0,
  ).length;

  return profitableCount > recommendationWindow.length / 2
    ? "worth_renting_again"
    : "needs_review";
}

export function calculateLocationProfitability(
  input: LocationProfitabilityInput,
): LocationProfitabilitySummary {
  const locationId = requireNonBlank(input.locationId, "locationId");
  const orderedShifts = input.shifts
    .map((shift, index) => {
      const shiftId = requireNonBlank(
        shift.shiftId,
        `shifts[${index}].shiftId`,
      );
      const closedAt = new Date(shift.closedAt.getTime());
      if (Number.isNaN(closedAt.getTime())) {
        throw new TypeError(`shifts[${index}].closedAt must be a valid date.`);
      }

      assertNonNegativeCents(
        shift.grossSalesCents,
        `shifts[${index}].grossSalesCents`,
      );
      assertNonNegativeCents(
        shift.totalCostsCents,
        `shifts[${index}].totalCostsCents`,
      );

      const profitCents = subtractCents(
        shift.grossSalesCents,
        shift.totalCostsCents,
      );

      return {
        closedAt,
        grossSalesCents: shift.grossSalesCents,
        profitCents,
        result: classifyProfit(profitCents),
        shiftId,
        totalCostsCents: shift.totalCostsCents,
        inputIndex: index,
      };
    })
    .sort(
      (left, right) =>
        left.closedAt.getTime() - right.closedAt.getTime() ||
        left.inputIndex - right.inputIndex,
    )
    .map((shift) => ({
      closedAt: shift.closedAt,
      grossSalesCents: shift.grossSalesCents,
      profitCents: shift.profitCents,
      result: shift.result,
      shiftId: shift.shiftId,
      totalCostsCents: shift.totalCostsCents,
    }));

  const grossSalesCents = addCents(
    ...orderedShifts.map((shift) => shift.grossSalesCents),
  );
  const totalCostsCents = addCents(
    ...orderedShifts.map((shift) => shift.totalCostsCents),
  );
  const netProfitCents = subtractCents(grossSalesCents, totalCostsCents);
  const totalShifts = orderedShifts.length;
  const averageProfitPerShiftCents =
    totalShifts === 0 ? 0 : divideCents(netProfitCents, totalShifts);
  const recommendationWindow = orderedShifts.slice(
    // The MVP default is the last three closed shifts in chronological order.
    -LOCATION_RECOMMENDATION_WINDOW_SIZE,
  );
  const profitableShiftsInRecommendationWindow = recommendationWindow.filter(
    (shift) => shift.profitCents > 0,
  ).length;
  const bestShift = orderedShifts.reduce<LocationShiftProfit | null>(
    (best, shift) =>
      !best || shift.profitCents >= best.profitCents ? shift : best,
    null,
  );
  const worstShift = orderedShifts.reduce<LocationShiftProfit | null>(
    (worst, shift) =>
      !worst || shift.profitCents <= worst.profitCents ? shift : worst,
    null,
  );

  return {
    averageProfitPerShiftCents,
    bestShift,
    grossSalesCents,
    locationId,
    netProfitCents,
    profitableShiftsInRecommendationWindow,
    recommendation: getRecommendation(netProfitCents, recommendationWindow),
    recommendationWindowShiftCount: recommendationWindow.length,
    totalCostsCents,
    totalShifts,
    trend: orderedShifts.map(({ closedAt, profitCents, shiftId }) => ({
      closedAt: new Date(closedAt.getTime()),
      profitCents,
      shiftId,
    })),
    trendDirection: getTrendDirection(orderedShifts),
    worstShift,
  };
}
