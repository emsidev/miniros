import { ProofUpload } from "@/components/shared/proof-upload";
import type { FormEvent } from "react";
import { Plus, Tag, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumericExpressionInput } from "@/components/ui/numeric-expression-input";
import { formatMoney } from "@/lib/format";
import type { calculateCheckout } from "./pos-checkout";
import type { PaymentDraft, PosPromo, SaleReceipt } from "./pos-types";
import { PosReceipt } from "./pos-receipt";
import { PosTenderEditor } from "./pos-tender";

type Checkout = ReturnType<typeof calculateCheckout>;

export function PosOrder({
  checkout,
  cart,
  payments,
  promosEnabled,
  promos,
  promoId,
  discount,
  discountPhoto,
  onDiscountPhotoChange,
  error,
  stockError,
  receipt,
  proofError,
  isPending,
  onQuantityChange,
  onPromoChange,
  onDiscountChange,
  onPaymentUpdate,
  onSplitPayment,
  onCancelSplit,
  onSubmit,
  onRetryProofs,
  onNewSale,
}: {
  checkout: Checkout;
  cart: Readonly<Record<string, number>>;
  payments: readonly PaymentDraft[];
  promosEnabled: boolean;
  promos: readonly PosPromo[];
  promoId: string;
  discount: string;
  discountPhoto: File | null;
  onDiscountPhotoChange: (file: File | null) => void;
  error?: string;
  stockError?: string;
  receipt?: SaleReceipt;
  proofError?: string;
  isPending: boolean;
  onQuantityChange: (productId: string, delta: number) => void;
  onPromoChange: (promoId: string) => void;
  onDiscountChange: (value: string) => void;
  onPaymentUpdate: (index: number, patch: Partial<PaymentDraft>) => void;
  onSplitPayment: () => void;
  onCancelSplit: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRetryProofs: () => void;
  onNewSale: () => void;
}) {
  if (receipt) {
    return (
      <PosReceipt
        receipt={receipt}
        proofError={proofError}
        isPending={isPending}
        onRetryProofs={onRetryProofs}
        onNewSale={onNewSale}
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold">Current order</h2>
        <p className="text-sm text-muted-foreground">
          {checkout.cartLines.length === 0
            ? "Your order is empty."
            : `${checkout.cartLines.length} ${checkout.cartLines.length === 1 ? "product" : "products"}`}
        </p>
      </div>

      {error || stockError ? (
        <Alert variant="destructive">
          <AlertDescription>{error ?? stockError}</AlertDescription>
        </Alert>
      ) : null}

      {checkout.cartLines.length === 0 ? (
        <div className="rounded-[var(--mi-radius-lg)] bg-muted p-5 text-center text-sm text-muted-foreground">
          Tap products in the catalog to begin.
        </div>
      ) : (
        <div className="divide-y">
          {checkout.cartLines.map((line) => (
            <div
              key={line.id}
              className="flex items-center gap-3 py-3 first:pt-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{line.name}</p>
                <p className="ledger-nums text-xs text-muted-foreground">
                  {formatMoney(line.priceCents)} each
                </p>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                onClick={() => onQuantityChange(line.id, -1)}
                aria-label={`Remove one ${line.name}`}
              >
                {line.quantity === 1 ? (
                  <Trash2 aria-hidden="true" />
                ) : (
                  <span aria-hidden="true">−</span>
                )}
              </Button>
              <span className="w-5 text-center text-sm font-bold">
                {cart[line.id]}
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="default"
                onClick={() => onQuantityChange(line.id, 1)}
                aria-label={`Add one ${line.name}`}
              >
                <Plus aria-hidden="true" />
              </Button>
              <strong className="ledger-nums w-16 text-right text-sm">
                {formatMoney(line.priceCents * line.quantity)}
              </strong>
            </div>
          ))}
        </div>
      )}

      <details
        className="group rounded-[var(--mi-radius-md)] bg-muted/70"
        open={Boolean(checkout.selectedPromo || Number(discount) > 0)}
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold">
          <Tag className="size-4" aria-hidden="true" />
          Promo or discount
          {checkout.appliedDiscountCents > 0 ? (
            <span className="ledger-nums ml-auto text-xs text-muted-foreground">
              −{formatMoney(checkout.appliedDiscountCents)}
            </span>
          ) : null}
        </summary>
        <div className="grid gap-3 border-t p-3 sm:grid-cols-2">
          {promosEnabled ? (
            <div>
              <Label htmlFor="pos-promo">Saved promo</Label>
              <select
                id="pos-promo"
                value={promoId}
                onChange={(event) => onPromoChange(event.target.value)}
                className="h-11 w-full rounded-lg border bg-card px-3 text-sm"
              >
                <option value="none">No promo</option>
                {promos.map((promo) => (
                  <option key={promo.id} value={promo.id}>
                    {promo.name} ·{" "}
                    {promo.discountType === "fixed_amount"
                      ? `₱${promo.discountValue.toFixed(2)}`
                      : `${promo.discountValue}%`}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <Label htmlFor="pos-discount">Manual discount (₱)</Label>
            <NumericExpressionInput
              id="pos-discount"
              precision={2}
              min="0"
              step="0.01"
              value={discount}
              onValueChange={onDiscountChange}
              disabled={Boolean(checkout.selectedPromo)}
            />
          </div>
          {checkout.selectedPromo?.requiresPhoto ? (
            <div className="sm:col-span-2">
              <ProofUpload
                key={promoId}
                label={`${checkout.selectedPromo.name} photo`}
                file={discountPhoto}
                onChange={onDiscountPhotoChange}
                photoOnly
                required
              />
            </div>
          ) : null}
        </div>
      </details>

      <dl className="space-y-2 border-y py-4 text-sm">
        <div className="flex justify-between gap-3 text-muted-foreground">
          <dt>Subtotal</dt>
          <dd className="ledger-nums">{formatMoney(checkout.subtotalCents)}</dd>
        </div>
        {checkout.appliedDiscountCents > 0 ? (
          <div className="flex justify-between gap-3 text-muted-foreground">
            <dt>Discount</dt>
            <dd className="ledger-nums">
              −{formatMoney(checkout.appliedDiscountCents)}
            </dd>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-3 pt-1">
          <dt className="font-bold">Total</dt>
          <dd className="ledger-nums text-2xl font-extrabold">
            {formatMoney(checkout.totalCents)}
          </dd>
        </div>
      </dl>

      <PosTenderEditor
        payments={payments}
        totalCents={checkout.totalCents}
        onPaymentUpdate={onPaymentUpdate}
        onSplitPayment={onSplitPayment}
        onCancelSplit={onCancelSplit}
      />

      <Button
        type="submit"
        size="lg"
        disabled={isPending || checkout.cartLines.length === 0}
        className="h-13 w-full bg-[var(--mi-color-accent)] text-base text-[var(--mi-color-ink)] hover:bg-[var(--mi-color-accent-hover)]"
      >
        {isPending
          ? "Completing sale…"
          : `Charge ${formatMoney(checkout.totalCents)}`}
      </Button>
    </form>
  );
}
