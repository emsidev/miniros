"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Boxes, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericExpressionInput } from "@/components/ui/numeric-expression-input";
import { Textarea } from "@/components/ui/textarea";
import {
  normalizeNumericExpression,
  numericExpressionToNumber,
} from "@/lib/numeric-expression";
import {
  submitCashDeductionAction,
  submitInventoryAdjustmentAction,
} from "@/server/actions/operations";

function pesosToCents(value: FormDataEntryValue | null) {
  const amount = numericExpressionToNumber(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN;
}

export function RequestForms({
  shiftId,
  items,
  approvalsEnabled,
}: {
  shiftId: string;
  items: readonly { inventoryItemId: string; name: string; unit: string }[];
  approvalsEnabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [cashRequestId, setCashRequestId] = useState(() => crypto.randomUUID());
  const [adjustmentRequestId, setAdjustmentRequestId] = useState(() =>
    crypto.randomUUID(),
  );
  const [adjustmentEventId, setAdjustmentEventId] = useState(() =>
    crypto.randomUUID(),
  );

  function submitCash(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError(undefined);
    startTransition(async () => {
      const result = await submitCashDeductionAction({
        deductionId: cashRequestId,
        shiftId,
        label: String(form.get("label") ?? ""),
        amountCents: pesosToCents(form.get("amount")),
        reason: String(form.get("reason") ?? "") || null,
      });
      if (!result.ok) return setError(result.error);
      formElement.reset();
      setCashRequestId(crypto.randomUUID());
      toast.success(
        result.data.status === "approved"
          ? "Cash deduction approved immediately."
          : "Cash deduction sent for admin approval.",
      );
      router.refresh();
    });
  }

  function submitAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError(undefined);
    startTransition(async () => {
      const result = await submitInventoryAdjustmentAction({
        adjustmentId: adjustmentRequestId,
        inventoryEventId: adjustmentEventId,
        shiftId,
        inventoryItemId: String(form.get("inventoryItemId") ?? ""),
        quantityDelta: normalizeNumericExpression(form.get("quantityDelta"), 3),
        reason: String(form.get("adjustmentReason") ?? ""),
      });
      if (!result.ok) return setError(result.error);
      formElement.reset();
      setAdjustmentRequestId(crypto.randomUUID());
      setAdjustmentEventId(crypto.randomUUID());
      toast.success(
        result.data.status === "applied"
          ? "Inventory adjustment applied immediately."
          : "Inventory adjustment sent for admin approval.",
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={submitCash}
          className="space-y-4 rounded-xl border bg-card p-4"
        >
          <h2 className="flex items-center gap-2 font-extrabold">
            <WalletCards aria-hidden="true" />
            {approvalsEnabled
              ? "Request cash deduction"
              : "Record cash deduction"}
          </h2>
          <div>
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              name="label"
              required
              maxLength={120}
              disabled={isPending}
              placeholder="Ice delivery"
            />
          </div>
          <div>
            <Label htmlFor="amount">Amount (₱)</Label>
            <NumericExpressionInput
              id="amount"
              name="amount"
              precision={2}
              min="0.01"
              step="0.01"
              required
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              name="reason"
              maxLength={2000}
              disabled={isPending}
            />
          </div>
          <Button
            type="submit"
            className="w-full rounded-xl"
            disabled={isPending}
          >
            {approvalsEnabled ? "Submit cash request" : "Record cash deduction"}
          </Button>
        </form>
        <form
          onSubmit={submitAdjustment}
          className="space-y-4 rounded-xl border bg-card p-4"
        >
          <h2 className="flex items-center gap-2 font-extrabold">
            <Boxes aria-hidden="true" />
            {approvalsEnabled
              ? "Request inventory adjustment"
              : "Record inventory adjustment"}
          </h2>
          <div>
            <Label htmlFor="inventoryItemId">Inventory item</Label>
            <select
              id="inventoryItemId"
              name="inventoryItemId"
              required
              disabled={isPending}
              className="h-10 w-full rounded-md border bg-background px-3"
            >
              <option value="">Select item</option>
              {items.map((item) => (
                <option key={item.inventoryItemId} value={item.inventoryItemId}>
                  {item.name} ({item.unit})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="quantityDelta">Quantity change</Label>
            <NumericExpressionInput
              id="quantityDelta"
              name="quantityDelta"
              precision={3}
              step="0.001"
              required
              disabled={isPending}
              placeholder="-1.000 or 2.000"
            />
          </div>
          <div>
            <Label htmlFor="adjustmentReason">Reason</Label>
            <Textarea
              id="adjustmentReason"
              name="adjustmentReason"
              required
              maxLength={2000}
              disabled={isPending}
            />
          </div>
          <Button
            type="submit"
            className="w-full rounded-xl"
            disabled={isPending || items.length === 0}
          >
            {approvalsEnabled ? "Submit adjustment" : "Record adjustment"}
          </Button>
        </form>
      </div>
    </div>
  );
}
