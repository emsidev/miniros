"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Boxes, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  submitCashDeductionAction,
  submitInventoryAdjustmentAction,
} from "@/server/actions/operations";

function pesosToCents(value: FormDataEntryValue | null) {
  const amount = Number(String(value ?? ""));
  return Number.isFinite(amount) ? Math.round(amount * 100) : Number.NaN;
}

export function RequestForms({
  shiftId,
  items,
}: {
  shiftId: string;
  items: readonly { inventoryItemId: string; name: string; unit: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [cashRequestId, setCashRequestId] = useState(() => crypto.randomUUID());
  const [adjustmentRequestId, setAdjustmentRequestId] = useState(() =>
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
      toast.success("Cash deduction sent for admin approval.");
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
        shiftId,
        inventoryItemId: String(form.get("inventoryItemId") ?? ""),
        quantityDelta: String(form.get("quantityDelta") ?? ""),
        reason: String(form.get("adjustmentReason") ?? ""),
      });
      if (!result.ok) return setError(result.error);
      formElement.reset();
      setAdjustmentRequestId(crypto.randomUUID());
      toast.success("Inventory adjustment sent for admin approval.");
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
          className="space-y-4 rounded-2xl border bg-card p-4"
        >
          <h2 className="flex items-center gap-2 font-extrabold">
            <WalletCards aria-hidden="true" /> Request cash deduction
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
            <Input
              id="amount"
              name="amount"
              type="number"
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
            Submit cash request
          </Button>
        </form>
        <form
          onSubmit={submitAdjustment}
          className="space-y-4 rounded-2xl border bg-card p-4"
        >
          <h2 className="flex items-center gap-2 font-extrabold">
            <Boxes aria-hidden="true" /> Request inventory adjustment
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
            <Input
              id="quantityDelta"
              name="quantityDelta"
              type="number"
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
            Submit adjustment
          </Button>
        </form>
      </div>
    </div>
  );
}
