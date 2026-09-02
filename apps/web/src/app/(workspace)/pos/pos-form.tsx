"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { calculatePosAvailableQuantity } from "@miniros/domain";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  finalizeSaleAction,
  uploadPaymentProofAction,
} from "@/server/actions/operations";
import {
  calculateCheckout,
  createPaymentDraft,
  preparePayments,
  syncExactTender,
  validateCheckout,
} from "./pos-checkout";
import { PosCatalog } from "./pos-catalog";
import { PosHeader } from "./pos-header";
import { PosOrder } from "./pos-order";
import { posCartReducer } from "./pos-state";
import type {
  PaymentDraft,
  PosProduct,
  PosPromo,
  SaleReceipt,
  SubmittedPayment,
} from "./pos-types";

function useDesktopCheckout() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

export function PosForm({
  shiftId,
  locationName,
  shiftSummary,
  inventoryBalances,
  products,
  promosEnabled,
  promos,
}: {
  shiftId: string;
  locationName: string;
  shiftSummary: { saleCount: number; itemCount: number; salesCents: number };
  inventoryBalances: readonly {
    inventoryItemId: string;
    quantity: string;
  }[];
  products: readonly PosProduct[];
  promosEnabled: boolean;
  promos: readonly PosPromo[];
}) {
  const router = useRouter();
  const isDesktop = useDesktopCheckout();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [cart, dispatchCart] = useReducer(posCartReducer, {});
  const [discount, setDiscount] = useState("0");
  const [promoId, setPromoId] = useState("none");
  const [payments, setPayments] = useState<PaymentDraft[]>(() => [
    createPaymentDraft("cash"),
  ]);
  const [saleRequestId, setSaleRequestId] = useState(() => crypto.randomUUID());
  const [inventoryEventId, setInventoryEventId] = useState(() =>
    crypto.randomUUID(),
  );
  const [error, setError] = useState<string>();
  const [stockNotice, setStockNotice] = useState<string>();
  const [receipt, setReceipt] = useState<SaleReceipt>();
  const [proofError, setProofError] = useState<string>();

  const categories = useMemo(
    () => [
      ...new Set(products.map((product) => product.categoryName ?? "Other")),
    ],
    [products],
  );
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        !query || product.name.toLowerCase().includes(query);
      return (
        matchesSearch &&
        (category === "all" || (product.categoryName ?? "Other") === category)
      );
    });
  }, [category, products, search]);
  const checkout = useMemo(
    () => calculateCheckout({ products, cart, discount, promoId, promos }),
    [cart, discount, products, promoId, promos],
  );
  const stockProducts = useMemo(
    () =>
      products.map((product) => ({
        productId: product.id,
        stockTracked: product.stockTracked,
        requirements: product.stockRequirements,
      })),
    [products],
  );
  const cartQuantities = useMemo(
    () =>
      Object.entries(cart).map(([productId, quantity]) => ({
        productId,
        quantity,
      })),
    [cart],
  );
  const getAvailability = useCallback(
    (productId: string) =>
      calculatePosAvailableQuantity({
        productId,
        products: stockProducts,
        balances: inventoryBalances,
        cart: cartQuantities,
      }),
    [cartQuantities, inventoryBalances, stockProducts],
  );
  const stockError = useMemo(() => {
    for (const line of checkout.cartLines) {
      const available = getAvailability(line.id);
      if (available !== null && line.quantity > available) {
        return `${line.name} now has only ${available} available. Reduce its quantity before charging.`;
      }
    }
    return undefined;
  }, [checkout.cartLines, getAvailability]);
  const cartCount = checkout.cartLines.reduce(
    (sum, line) => sum + line.quantity,
    0,
  );

  useEffect(() => {
    setPayments((current) => {
      const next = syncExactTender(current, checkout.totalCents);
      const unchanged = next.every(
        (payment, index) => payment.amount === current[index]?.amount,
      );
      return unchanged ? current : next;
    });
  }, [checkout.totalCents]);

  function changeQuantity(productId: string, delta: number) {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) return;
    setStockNotice(undefined);
    setError(undefined);
    const currentQuantity = cart[productId] ?? 0;
    const nextQuantity = Math.max(0, currentQuantity + delta);
    if (delta > 0) {
      const available = getAvailability(productId);
      if (available !== null && nextQuantity > available) {
        setStockNotice(
          available === 0
            ? `${product.name} is sold out.`
            : `Only ${available} ${product.name} available for this order.`,
        );
        return;
      }
    }
    dispatchCart({ type: "set_quantity", productId, quantity: nextQuantity });
  }

  function updatePayment(index: number, patch: Partial<PaymentDraft>) {
    setPayments((current) =>
      current.map((payment, paymentIndex) => {
        if (paymentIndex !== index) return payment;
        const next = { ...payment, ...patch };
        if (
          patch.method &&
          current.length === 1 &&
          payment.amountMode === "exact"
        ) {
          return syncExactTender(
            [{ ...next, amount: "", amountMode: "exact" }],
            checkout.totalCents,
          )[0]!;
        }
        return next;
      }),
    );
  }

  function splitPayment() {
    setPayments((current) => {
      if (current.length > 1) return current;
      return [
        { ...current[0]!, amount: "", amountMode: "manual" },
        { ...createPaymentDraft("gcash"), amount: "", amountMode: "manual" },
      ];
    });
  }

  function cancelSplitPayment() {
    setPayments((current) =>
      syncExactTender(
        [{ ...current[0]!, amount: "", amountMode: "exact" }],
        checkout.totalCents,
      ),
    );
  }

  function resetSale() {
    dispatchCart({ type: "reset" });
    setDiscount("0");
    setPromoId("none");
    setPayments([createPaymentDraft("cash")]);
    setSaleRequestId(crypto.randomUUID());
    setInventoryEventId(crypto.randomUUID());
    setReceipt(undefined);
    setError(undefined);
    setStockNotice(undefined);
    setProofError(undefined);
    setOrderOpen(false);
  }

  async function uploadProof(payment: SubmittedPayment) {
    if (!payment.file || payment.method === "cash") return true;
    const proof = new FormData();
    proof.set("paymentId", payment.id);
    proof.set("fileId", payment.proofFileId);
    proof.set("file", payment.file);
    const result = await uploadPaymentProofAction(proof);
    return result.ok ? true : result.error;
  }

  function retryPaymentProofs() {
    if (!receipt || receipt.pendingProofs.length === 0) return;
    setProofError(undefined);
    startTransition(async () => {
      const failed: SubmittedPayment[] = [];
      let latestError: string | undefined;
      for (const payment of receipt.pendingProofs) {
        const result = await uploadProof(payment);
        if (result !== true) {
          failed.push(payment);
          latestError = result;
        }
      }
      setReceipt((current) =>
        current ? { ...current, pendingProofs: failed } : current,
      );
      setProofError(
        failed.length > 0
          ? `Payment proof retry failed: ${latestError ?? "Please try again."}`
          : undefined,
      );
      if (failed.length === 0) router.refresh();
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    setError(undefined);
    if (stockError) {
      setError(stockError);
      return;
    }
    const paymentRows = preparePayments(payments);
    const validationError = validateCheckout({
      itemCount: checkout.cartLines.length,
      totalCents: checkout.totalCents,
      payments: paymentRows,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    const saleId = saleRequestId;
    startTransition(async () => {
      const result = await finalizeSaleAction({
        saleId,
        shiftId,
        inventoryEventId,
        items: checkout.cartItems.map((line) => ({
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

      const proofUploads = paymentRows.filter(
        (payment) => payment.method !== "cash" && payment.file,
      );
      setReceipt({
        saleId,
        totalCents: result.data.totalCents,
        amountPaidCents: result.data.amountPaidCents,
        changeCents: result.data.changeCents,
        payments: paymentRows,
        pendingProofs: proofUploads,
      });
      setOrderOpen(true);

      const failedProofs: SubmittedPayment[] = [];
      let latestProofError: string | undefined;
      for (const payment of paymentRows) {
        const proofResult = await uploadProof(payment);
        if (proofResult !== true) {
          failedProofs.push(payment);
          latestProofError = proofResult;
        }
      }
      setReceipt((current) =>
        current ? { ...current, pendingProofs: failedProofs } : current,
      );
      setProofError(
        failedProofs.length > 0
          ? `Sale completed, but ${failedProofs.length} payment proof${failedProofs.length === 1 ? "" : "s"} still need attention: ${latestProofError}`
          : undefined,
      );
      router.refresh();
    });
  }

  const order = (
    <PosOrder
      checkout={checkout}
      cart={cart}
      payments={payments}
      promosEnabled={promosEnabled}
      promos={promos}
      promoId={promoId}
      discount={discount}
      error={error}
      stockError={stockError ?? stockNotice}
      receipt={receipt}
      proofError={proofError}
      isPending={isPending}
      onQuantityChange={changeQuantity}
      onPromoChange={setPromoId}
      onDiscountChange={setDiscount}
      onPaymentUpdate={updatePayment}
      onSplitPayment={splitPayment}
      onCancelSplit={cancelSplitPayment}
      onSubmit={handleSubmit}
      onRetryProofs={retryPaymentProofs}
      onNewSale={resetSale}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      <PosHeader
        shiftId={shiftId}
        locationName={locationName}
        saleCount={shiftSummary.saleCount}
        itemCount={shiftSummary.itemCount}
        salesCents={shiftSummary.salesCents}
        cartCount={cartCount}
        onOpenCart={() => setOrderOpen(true)}
      />
      <div className="mx-auto grid w-full max-w-[1440px] gap-8 px-4 py-5 pb-28 sm:px-6 lg:grid-cols-[minmax(0,1fr)_390px] lg:px-8 lg:py-8 lg:pb-8">
        <PosCatalog
          products={filteredProducts}
          categories={categories}
          search={search}
          category={category}
          cart={cart}
          mobileSearchOpen={mobileSearchOpen}
          onSearchChange={setSearch}
          onCategoryChange={setCategory}
          onToggleMobileSearch={() => setMobileSearchOpen((open) => !open)}
          onAdd={(product) => changeQuantity(product.id, 1)}
          getAvailability={getAvailability}
        />

        {isDesktop ? (
          <aside
            aria-label="Current order"
            className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto rounded-[var(--mi-radius-xl)] bg-card p-5 shadow-[var(--mi-shadow-overlay)]"
          >
            {order}
          </aside>
        ) : (
          <Sheet open={orderOpen} onOpenChange={setOrderOpen}>
            <SheetContent
              side="bottom"
              className="max-h-[calc(100dvh-5rem)] gap-0 rounded-t-[var(--mi-radius-xl)] p-0"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Current order</SheetTitle>
                <SheetDescription>
                  Review products, discounts, and payment before charging.
                </SheetDescription>
              </SheetHeader>
              <div className="safe-bottom overflow-y-auto p-4 pt-5 sm:p-6">
                {order}
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
}
