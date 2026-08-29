"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  addCents,
  allocateDiscountCents,
  multiplyCentsByQuantity,
  percentageOfCents,
} from "@miniros/domain";
import type { PaymentMethod } from "@miniros/contracts";
import { AlertCircle, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, formatPaymentMethod } from "@/lib/format";
import {
  finalizeSaleAction,
  uploadPaymentProofAction,
} from "@/server/actions/operations";

type Product = {
  id: string;
  name: string;
  categoryName: string | null;
  priceCents: number;
  requiresRecipeDeduction: boolean;
};
type Promo = {
  id: string;
  name: string;
  discountType: "fixed_amount" | "percentage";
  discountValue: number;
};
type PaymentDraft = {
  id: string;
  proofFileId: string;
  method: PaymentMethod;
  amount: string;
  reference: string;
  file: File | null;
};

function pesosToCents(value: string) {
  const pesos = Number(value);
  return Number.isFinite(pesos) ? Math.round(pesos * 100) : Number.NaN;
}

function newPayment(method: PaymentMethod): PaymentDraft {
  return {
    id: crypto.randomUUID(),
    proofFileId: crypto.randomUUID(),
    method,
    amount: "",
    reference: "",
    file: null,
  };
}

export function PosForm({
  shiftId,
  products,
  promos,
}: {
  shiftId: string;
  products: readonly Product[];
  promos: readonly Promo[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [discount, setDiscount] = useState("0");
  const [promoId, setPromoId] = useState("none");
  const [payments, setPayments] = useState<PaymentDraft[]>(() => [
    newPayment("cash"),
  ]);
  const [saleRequestId, setSaleRequestId] = useState(() => crypto.randomUUID());
  const [inventoryEventId, setInventoryEventId] = useState(() =>
    crypto.randomUUID(),
  );
  const [error, setError] = useState<string>();
  const [receipt, setReceipt] = useState<{
    saleId: string;
    totalCents: number;
  }>();

  const categories = useMemo(
    () => [
      ...new Set(products.map((product) => product.categoryName ?? "Other")),
    ],
    [products],
  );
  const filtered = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(search.toLowerCase());
    return (
      matchesSearch &&
      (category === "all" || (product.categoryName ?? "Other") === category)
    );
  });
  const cartLines = products
    .filter((product) => cart[product.id])
    .map((product) => ({ ...product, quantity: cart[product.id] ?? 0 }));
  const subtotalCents = addCents(
    ...cartLines.map((line) =>
      multiplyCentsByQuantity(line.priceCents, line.quantity),
    ),
  );
  const discountCents = Math.max(0, pesosToCents(discount) || 0);
  const selectedPromo = promos.find((promo) => promo.id === promoId);
  const promoDiscountCents = selectedPromo
    ? selectedPromo.discountType === "fixed_amount"
      ? Math.round(selectedPromo.discountValue * 100)
      : percentageOfCents(subtotalCents, selectedPromo.discountValue)
    : 0;
  const appliedDiscountCents = selectedPromo
    ? promoDiscountCents
    : discountCents;
  const totalCents = Math.max(0, subtotalCents - appliedDiscountCents);
  const lineSubtotalsCents = cartLines.map((line) =>
    multiplyCentsByQuantity(line.priceCents, line.quantity),
  );
  const lineDiscountsCents = allocateDiscountCents(
    lineSubtotalsCents,
    appliedDiscountCents,
  );
  const cartItems = cartLines.map((line, index) => ({
    ...line,
    lineDiscountCents: lineDiscountsCents[index] ?? 0,
  }));

  function changeQuantity(productId: string, delta: number) {
    setCart((current) => {
      const next = Math.max(0, (current[productId] ?? 0) + delta);
      if (next === 0) {
        const updated = { ...current };
        delete updated[productId];
        return updated;
      }
      return { ...current, [productId]: next };
    });
  }

  function updatePayment(index: number, patch: Partial<PaymentDraft>) {
    setPayments((current) =>
      current.map((payment, paymentIndex) =>
        paymentIndex === index ? { ...payment, ...patch } : payment,
      ),
    );
  }

  function resetSale() {
    setCart({});
    setDiscount("0");
    setPromoId("none");
    setPayments([newPayment("cash")]);
    setSaleRequestId(crypto.randomUUID());
    setInventoryEventId(crypto.randomUUID());
    setReceipt(undefined);
    setError(undefined);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    const paymentRows = payments
      .map((payment) => ({
        ...payment,
        amountCents: pesosToCents(payment.amount),
      }))
      .filter((payment) => payment.amountCents > 0);
    const invalidNonCash = paymentRows.some(
      (payment) => payment.method !== "cash" && !payment.reference.trim(),
    );
    if (cartLines.length === 0 || paymentRows.length === 0 || invalidNonCash) {
      setError(
        "Add a product and payment. Non-cash payments need a reference number.",
      );
      return;
    }

    const saleId = saleRequestId;
    startTransition(async () => {
      const result = await finalizeSaleAction({
        saleId,
        shiftId,
        inventoryEventId,
        items: cartItems.map((line) => ({
          id: crypto.randomUUID(),
          productId: line.id,
          quantity: line.quantity,
          discountCents: line.lineDiscountCents,
        })),
        payments: paymentRows.map((payment) => ({
          id: payment.id,
          paymentMethod: payment.method,
          amountCents: payment.amountCents,
          referenceNumber: payment.reference || null,
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReceipt({ saleId, totalCents: result.data.totalCents });

      for (const payment of paymentRows) {
        if (!payment.file || payment.method === "cash") continue;
        const proof = new FormData();
        proof.set("paymentId", payment.id);
        proof.set("fileId", payment.proofFileId);
        proof.set("file", payment.file);
        const proofResult = await uploadPaymentProofAction(proof);
        if (!proofResult.ok) {
          setError(
            `Sale completed, but a payment proof still needs attention: ${proofResult.error}`,
          );
          router.refresh();
          return;
        }
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {receipt && !error ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
          <ShoppingBag aria-hidden="true" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Sale complete · {formatMoney(receipt.totalCents)}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={resetSale}
            >
              New sale
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products"
          className="h-12 rounded-xl"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["all", ...categories].map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={category === value ? "default" : "outline"}
              className="shrink-0 rounded-full"
              onClick={() => setCategory(value)}
            >
              {value === "all" ? "All" : value}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => changeQuantity(product.id, 1)}
              className="min-h-28 rounded-2xl border bg-card p-4 text-left transition active:scale-[0.98]"
            >
              <span className="font-bold">{product.name}</span>
              <span className="mt-2 block text-sm text-muted-foreground">
                {formatMoney(product.priceCents)}
              </span>
              {product.requiresRecipeDeduction ? (
                <Badge variant="outline" className="mt-2">
                  Recipe
                </Badge>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 className="font-extrabold">Cart</h2>
        {cartLines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tap a product to add it.
          </p>
        ) : (
          cartLines.map((line) => (
            <div
              key={line.id}
              className="flex items-center gap-3 border-b py-3 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{line.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatMoney(
                    multiplyCentsByQuantity(line.priceCents, line.quantity),
                  )}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => changeQuantity(line.id, -1)}
              >
                {line.quantity === 1 ? (
                  <Trash2 aria-hidden="true" />
                ) : (
                  <Minus aria-hidden="true" />
                )}
              </Button>
              <span className="w-7 text-center font-bold">{line.quantity}</span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => changeQuantity(line.id, 1)}
              >
                <Plus aria-hidden="true" />
              </Button>
            </div>
          ))
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="promo">Saved promo</Label>
            <select
              id="promo"
              value={promoId}
              onChange={(event) => setPromoId(event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3"
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
          <div>
            <Label htmlFor="discount">Manual discount (₱)</Label>
            <Input
              id="discount"
              type="number"
              min="0"
              step="0.01"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
              disabled={Boolean(selectedPromo)}
            />
          </div>
          <div className="rounded-xl bg-muted p-3 text-right">
            <p className="text-xs text-muted-foreground">Amount due</p>
            <p className="text-2xl font-extrabold">{formatMoney(totalCents)}</p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold">Payments</h2>
          {payments.length < 2 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setPayments((rows) => [...rows, newPayment("gcash")])
              }
            >
              <Plus aria-hidden="true" /> Split payment
            </Button>
          ) : null}
        </div>
        {payments.map((payment, index) => (
          <div
            key={payment.id}
            className="grid gap-3 rounded-xl bg-muted/60 p-3 sm:grid-cols-2"
          >
            <div>
              <Label htmlFor={`method-${payment.id}`}>Method</Label>
              <select
                id={`method-${payment.id}`}
                value={payment.method}
                onChange={(event) =>
                  updatePayment(index, {
                    method: event.target.value as PaymentMethod,
                  })
                }
                className="h-10 w-full rounded-md border bg-background px-3"
              >
                {(
                  [
                    "cash",
                    "gcash",
                    "maya",
                    "bank_transfer",
                    "card",
                    "other",
                  ] as const
                ).map((method) => (
                  <option key={method} value={method}>
                    {formatPaymentMethod(method)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor={`amount-${payment.id}`}>Amount (₱)</Label>
              <Input
                id={`amount-${payment.id}`}
                type="number"
                min="0.01"
                step="0.01"
                value={payment.amount}
                onChange={(event) =>
                  updatePayment(index, { amount: event.target.value })
                }
                required={index === 0}
              />
            </div>
            {payment.method !== "cash" ? (
              <>
                <div>
                  <Label htmlFor={`reference-${payment.id}`}>
                    Reference number
                  </Label>
                  <Input
                    id={`reference-${payment.id}`}
                    value={payment.reference}
                    onChange={(event) =>
                      updatePayment(index, { reference: event.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor={`proof-${payment.id}`}>Payment proof</Label>
                  <Input
                    id={`proof-${payment.id}`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(event) =>
                      updatePayment(index, {
                        file: event.target.files?.[0] ?? null,
                      })
                    }
                  />
                </div>
              </>
            ) : null}
          </div>
        ))}
      </section>

      <Button
        type="submit"
        size="lg"
        className="sticky bottom-24 h-12 w-full rounded-xl"
        disabled={isPending || Boolean(receipt && !error)}
      >
        {isPending ? "Completing sale…" : "Complete sale"}
      </Button>
    </form>
  );
}
