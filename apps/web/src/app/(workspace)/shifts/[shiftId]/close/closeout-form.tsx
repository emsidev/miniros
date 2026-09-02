"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumericExpressionInput } from "@/components/ui/numeric-expression-input";
import { Textarea } from "@/components/ui/textarea";
import {
  normalizeNumericExpression,
  numericExpressionToNumber,
} from "@/lib/numeric-expression";
import { submitShiftCloseoutAction } from "@/server/actions/operations";

function pesosToCents(value: FormDataEntryValue | null) {
  const amount = numericExpressionToNumber(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN;
}

export function CloseoutForm({
  shiftId,
  balances,
}: {
  shiftId: string;
  balances: readonly {
    inventoryItemId: string;
    name: string;
    unit: string;
    quantityOnHand: string;
  }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !window.confirm("Submit this closeout and permanently close the shift?")
    )
      return;
    const form = new FormData(event.currentTarget);
    setError(undefined);
    startTransition(async () => {
      const result = await submitShiftCloseoutAction({
        closeoutId: crypto.randomUUID(),
        cashReconciliationId: crypto.randomUUID(),
        profitSummaryId: crypto.randomUUID(),
        inventoryEventId: crypto.randomUUID(),
        shiftId,
        actualCashCents: pesosToCents(form.get("actualCash")),
        notes: String(form.get("notes") ?? "") || null,
        counts: balances.map((balance) => ({
          inventoryItemId: balance.inventoryItemId,
          quantity: normalizeNumericExpression(
            form.get(`count-${balance.inventoryItemId}`),
            3,
          ),
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Shift closed. Profit summary is ready.");
      router.replace(`/shifts/${shiftId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2 rounded-xl border bg-card p-4">
        <Label htmlFor="actualCash">Actual cash counted (₱)</Label>
        <NumericExpressionInput
          id="actualCash"
          name="actualCash"
          precision={2}
          min="0"
          step="0.01"
          required
          disabled={isPending}
          className="h-12 rounded-xl text-lg font-bold"
        />
      </div>
      <section className="space-y-3">
        <h2 className="font-extrabold">Closing inventory counts</h2>
        {balances.map((balance) => (
          <div
            key={balance.inventoryItemId}
            className="grid grid-cols-[1fr_9rem] items-center gap-3 rounded-xl border bg-card p-4"
          >
            <div>
              <Label
                htmlFor={`count-${balance.inventoryItemId}`}
                className="font-bold"
              >
                {balance.name}
              </Label>
              <p className="text-sm text-muted-foreground">
                Estimated {balance.quantityOnHand} {balance.unit}
              </p>
            </div>
            <NumericExpressionInput
              id={`count-${balance.inventoryItemId}`}
              name={`count-${balance.inventoryItemId}`}
              precision={3}
              min="0"
              step="0.001"
              defaultValue={balance.quantityOnHand}
              required
              disabled={isPending}
              className="h-11 rounded-xl text-right"
            />
          </div>
        ))}
      </section>
      <div className="space-y-2">
        <Label htmlFor="notes">Closeout notes</Label>
        <Textarea
          id="notes"
          name="notes"
          maxLength={2000}
          disabled={isPending}
        />
      </div>
      <Button
        type="submit"
        size="lg"
        className="sticky bottom-24 h-12 w-full rounded-xl"
        disabled={isPending || balances.length === 0}
      >
        <LockKeyhole aria-hidden="true" />{" "}
        {isPending ? "Closing shift…" : "Submit closeout and close shift"}
      </Button>
    </form>
  );
}
