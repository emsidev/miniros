import {
  addCents,
  assertCents,
  assertNonNegativeCents,
  subtractCents,
  type Cents,
} from "./money";

export const profitResults = ["profit", "break_even", "loss"] as const;
export type ProfitResult = (typeof profitResults)[number];

export type ShiftProfitInput = Readonly<{
  approvedDeductionsCents?: Cents;
  cashSalesCents?: Cents;
  grossSalesCents: Cents;
  netSalesCents?: Cents;
  nonCashSalesCents?: Cents;
  otherCostsCents?: Cents;
  rentalCostCents?: Cents;
  salaryCostCents?: Cents;
  totalDiscountsCents?: Cents;
  transportCostCents?: Cents;
}>;

export type ShiftProfitSummary = Readonly<{
  approvedDeductionsCents: Cents;
  cashSalesCents: Cents;
  grossSalesCents: Cents;
  netSalesCents: Cents;
  nonCashSalesCents: Cents;
  otherCostsCents: Cents;
  profitCents: Cents;
  rentalCostCents: Cents;
  result: ProfitResult;
  salaryCostCents: Cents;
  totalCostsCents: Cents;
  totalDiscountsCents: Cents;
  transportCostCents: Cents;
}>;

export function classifyProfit(profitCents: Cents): ProfitResult {
  assertCents(profitCents, "profitCents");

  if (profitCents > 0) {
    return "profit";
  }

  if (profitCents < 0) {
    return "loss";
  }

  return "break_even";
}

export function calculateShiftProfit(
  input: ShiftProfitInput,
): ShiftProfitSummary {
  const summaryValues = {
    approvedDeductionsCents: input.approvedDeductionsCents ?? 0,
    cashSalesCents: input.cashSalesCents ?? 0,
    grossSalesCents: input.grossSalesCents,
    netSalesCents: input.netSalesCents ?? input.grossSalesCents,
    nonCashSalesCents: input.nonCashSalesCents ?? 0,
    otherCostsCents: input.otherCostsCents ?? 0,
    rentalCostCents: input.rentalCostCents ?? 0,
    salaryCostCents: input.salaryCostCents ?? 0,
    totalDiscountsCents: input.totalDiscountsCents ?? 0,
    transportCostCents: input.transportCostCents ?? 0,
  };

  Object.entries(summaryValues).forEach(([field, value]) => {
    assertNonNegativeCents(value, field);
  });

  const totalCostsCents = addCents(
    summaryValues.salaryCostCents,
    summaryValues.rentalCostCents,
    summaryValues.transportCostCents,
    summaryValues.approvedDeductionsCents,
    summaryValues.otherCostsCents,
  );
  // The MVP brief defines completed-sale totals as the authoritative gross value.
  const profitCents = subtractCents(
    summaryValues.grossSalesCents,
    totalCostsCents,
  );

  return {
    ...summaryValues,
    totalCostsCents,
    profitCents,
    result: classifyProfit(profitCents),
  };
}
