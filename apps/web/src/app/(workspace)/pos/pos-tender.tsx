import { ProofUpload } from "@/components/shared/proof-upload";
import { Banknote, CreditCard, Plus, Smartphone, Split } from "lucide-react";
import type { PaymentMethod } from "@miniros/contracts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericExpressionInput } from "@/components/ui/numeric-expression-input";
import { formatMoney, formatPaymentMethod } from "@/lib/format";
import { cn } from "@/lib/utils";
import { calculateTenderChangeCents } from "./pos-checkout";
import type { PaymentDraft } from "./pos-types";

const primaryMethods = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "gcash", label: "GCash", icon: Smartphone },
  { value: "card", label: "Card", icon: CreditCard },
] as const;

const moreMethods = ["maya", "bank_transfer", "other"] as const;

function PaymentMethodPicker({
  payment,
  onChange,
}: {
  payment: PaymentDraft;
  onChange: (method: PaymentMethod) => void;
}) {
  const isMore = moreMethods.includes(
    payment.method as (typeof moreMethods)[number],
  );
  return (
    <div className="grid grid-cols-4 gap-2" aria-label="Payment method">
      {primaryMethods.map(({ value, label, icon: Icon }) => {
        const selected = payment.method === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            aria-pressed={selected}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--mi-radius-md)] border px-2 text-xs font-semibold transition-colors duration-[var(--mi-motion-fast)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
              selected
                ? "border-[var(--mi-color-ink)] bg-[var(--mi-color-ink)] text-[var(--mi-color-accent)]"
                : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
      <label
        className={cn(
          "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-[var(--mi-radius-md)] border px-2 text-xs font-semibold transition-colors duration-[var(--mi-motion-fast)]",
          isMore
            ? "border-[var(--mi-color-ink)] bg-[var(--mi-color-ink)] text-[var(--mi-color-accent)]"
            : "bg-card text-muted-foreground hover:bg-muted",
        )}
      >
        <Plus className="size-4" aria-hidden="true" />
        <span>{isMore ? formatPaymentMethod(payment.method) : "More"}</span>
        <select
          value={isMore ? payment.method : ""}
          onChange={(event) => onChange(event.target.value as PaymentMethod)}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label="More payment methods"
        >
          <option value="" disabled>
            More methods
          </option>
          {moreMethods.map((method) => (
            <option key={method} value={method}>
              {formatPaymentMethod(method)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function PaymentFields({
  payment,
  index,
  isSplit,
  changeCents,
  onUpdate,
  onUseManualCash,
}: {
  payment: PaymentDraft;
  index: number;
  isSplit: boolean;
  changeCents?: number;
  onUpdate: (patch: Partial<PaymentDraft>) => void;
  onUseManualCash: () => void;
}) {
  const showAmount = isSplit || payment.amountMode === "manual";
  return (
    <div className="space-y-3">
      {isSplit ? (
        <p className="text-sm font-bold">Payment {index + 1}</p>
      ) : null}
      <PaymentMethodPicker
        payment={payment}
        onChange={(method) => onUpdate({ method, reference: "", file: null })}
      />

      {payment.method === "cash" && !showAmount ? (
        <div className="flex items-center justify-between gap-3 rounded-[var(--mi-radius-md)] bg-muted px-3 py-2 text-sm">
          <span>Exact cash</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onUseManualCash}
          >
            Enter cash received
          </Button>
        </div>
      ) : null}

      {payment.method === "cash" ? (
        <div className="flex flex-wrap gap-2" aria-label="Cash shortcuts">
          {!isSplit ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => onUpdate({ amountMode: "exact" })}
            >
              Exact
            </Button>
          ) : null}
          {[20, 50, 100, 200, 500, 1000].map((amount) => (
            <Button
              key={amount}
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() =>
                onUpdate({ amount: String(amount), amountMode: "manual" })
              }
            >
              ₱{amount}
            </Button>
          ))}
        </div>
      ) : null}
      {showAmount ? (
        <div>
          <Label htmlFor={`amount-${payment.id}`}>
            {payment.method === "cash" ? "Cash received (₱)" : "Amount (₱)"}
          </Label>
          <NumericExpressionInput
            id={`amount-${payment.id}`}
            precision={2}
            min="0.01"
            step="0.01"
            value={payment.amount}
            onValueChange={(amount) =>
              onUpdate({ amount, amountMode: "manual" })
            }
            required
          />
          {payment.method === "cash" && changeCents !== undefined ? (
            <div className="mt-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-muted-foreground">Change</span>
              <output className="ledger-nums font-bold" aria-live="polite">
                {formatMoney(changeCents)}
              </output>
            </div>
          ) : null}
        </div>
      ) : null}

      {payment.method !== "cash" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`reference-${payment.id}`}>Reference number</Label>
            <Input
              id={`reference-${payment.id}`}
              value={payment.reference}
              onChange={(event) => onUpdate({ reference: event.target.value })}
              autoComplete="off"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <ProofUpload
              label="Payment proof"
              file={payment.file}
              onChange={(file) => onUpdate({ file })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PosTenderEditor({
  payments,
  totalCents,
  onPaymentUpdate,
  onSplitPayment,
  onCancelSplit,
}: {
  payments: readonly PaymentDraft[];
  totalCents: number;
  onPaymentUpdate: (index: number, patch: Partial<PaymentDraft>) => void;
  onSplitPayment: () => void;
  onCancelSplit: () => void;
}) {
  const changeCents = calculateTenderChangeCents(payments, totalCents);
  const firstCashPaymentIndex = payments.findIndex(
    (payment) => payment.method === "cash",
  );

  return (
    <section className="space-y-4" aria-labelledby="payment-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 id="payment-title" className="text-sm font-bold">
            Payment method
          </h3>
          <p className="text-xs text-muted-foreground">
            Exact amount is selected by default.
          </p>
        </div>
        {payments.length === 1 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onSplitPayment}
          >
            <Split aria-hidden="true" /> Split
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCancelSplit}
          >
            Cancel split
          </Button>
        )}
      </div>

      {payments.map((payment, index) => (
        <div
          key={payment.id}
          className={cn(
            payments.length > 1 && "rounded-[var(--mi-radius-lg)] border p-3",
          )}
        >
          <PaymentFields
            payment={payment}
            index={index}
            isSplit={payments.length > 1}
            changeCents={
              index === firstCashPaymentIndex ? changeCents : undefined
            }
            onUpdate={(patch) => onPaymentUpdate(index, patch)}
            onUseManualCash={() =>
              onPaymentUpdate(index, { amountMode: "manual" })
            }
          />
        </div>
      ))}
    </section>
  );
}
