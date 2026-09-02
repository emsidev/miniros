import {
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  ShoppingBag,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatMoney, formatPaymentMethod } from "@/lib/format";
import type { SaleReceipt } from "./pos-types";

export function PosReceipt({
  receipt,
  proofError,
  isPending,
  onRetryProofs,
  onNewSale,
}: {
  receipt: SaleReceipt;
  proofError?: string;
  isPending: boolean;
  onRetryProofs: () => void;
  onNewSale: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-[var(--mi-radius-md)] bg-success-surface text-success">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-extrabold">Sale completed</h2>
          <p className="text-sm text-muted-foreground">
            Sale {receipt.saleId.slice(0, 8)}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 rounded-[var(--mi-radius-lg)] bg-muted p-4">
        {[
          ["Total", receipt.totalCents],
          ["Paid", receipt.amountPaidCents],
          ["Change", receipt.changeCents],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="ledger-nums mt-1 font-extrabold">
              {formatMoney(value as number)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2">
        <h3 className="text-sm font-bold">Payment breakdown</h3>
        {receipt.payments.map((payment) => (
          <div
            key={payment.id}
            className="flex items-center justify-between gap-3 border-b py-2 text-sm last:border-0"
          >
            <span>
              {formatPaymentMethod(payment.method)}
              {payment.reference ? ` · ${payment.reference}` : ""}
            </span>
            <strong className="ledger-nums">
              {formatMoney(payment.amountCents)}
            </strong>
          </div>
        ))}
      </div>

      {receipt.pendingProofs.length > 0 ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription className="space-y-3">
            <p>
              {proofError ??
                "The sale is complete, but a payment proof still needs to be uploaded."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetryProofs}
              disabled={isPending}
            >
              <RotateCcw aria-hidden="true" />
              {isPending ? "Retrying proof…" : "Retry payment proof"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {receipt.pendingProofs.length === 0 &&
      receipt.payments.some((payment) => payment.file) ? (
        <p
          className="flex items-center gap-2 text-sm text-success"
          role="status"
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Payment proof uploaded.
        </p>
      ) : null}

      <Button
        type="button"
        size="lg"
        className="h-12 w-full bg-[var(--mi-color-accent)] text-[var(--mi-color-ink)] hover:bg-[var(--mi-color-accent-hover)]"
        onClick={onNewSale}
      >
        <ShoppingBag aria-hidden="true" /> New sale
      </Button>
    </div>
  );
}
