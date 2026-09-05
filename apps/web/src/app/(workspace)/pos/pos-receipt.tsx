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
  const pending =
    receipt.pendingProofs.length > 0 || receipt.pendingDiscountProof;
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-[var(--mi-radius-md)] bg-success-surface text-success">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-extrabold">
            {receipt.savedLocally ? "Saved on this device" : "Sale completed"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Sale {receipt.saleId.slice(0, 8)}
          </p>
        </div>
      </div>

      {receipt.savedLocally ? (
        <p role="status" className="text-sm text-muted-foreground">
          Receipt and attached proofs are saved locally. See Sync status for
          server confirmation.
        </p>
      ) : null}
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

      {receipt.discountName ? (
        <p className="text-sm">
          Promo: <strong>{receipt.discountName}</strong>
        </p>
      ) : null}
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

      {pending ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription className="space-y-3">
            <p>
              {proofError ??
                "The sale is complete, but a proof still needs to be uploaded."}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetryProofs}
              disabled={isPending}
            >
              <RotateCcw aria-hidden="true" />
              {isPending ? "Retrying proof…" : "Retry proofs"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!receipt.savedLocally &&
      !pending &&
      (receipt.discountPhoto?.file ||
        receipt.payments.some((payment) => payment.file)) ? (
        <p
          className="flex items-center gap-2 text-sm text-success"
          role="status"
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Proofs uploaded.
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
