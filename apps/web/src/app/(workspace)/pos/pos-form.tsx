"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useReducer,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  actionSuccess,
  calculatePreparedSale,
  offlineOperationSchema,
} from "@miniros/contracts";
import { appendShiftAction, shiftStore } from "@/lib/offline/store";
import { synchronizePreparedShifts } from "@/lib/offline/sync";
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
  uploadDiscountProofAction,
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
  DiscountPhoto,
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
  offlineSessionId,
  draftOwnerKey,
  locationName,
  shiftSummary,
  inventoryBalances,
  products,
  promosEnabled,
  promos,
}: {
  shiftId: string;
  offlineSessionId?: string;
  draftOwnerKey?: string;
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
  const [discountPhoto, setDiscountPhoto] = useState<DiscountPhoto>(() => ({
    fileId: crypto.randomUUID(),
    file: null,
  }));
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

  const draftKey = `pos:${offlineSessionId ?? `${draftOwnerKey}:${shiftId}`}`;
  const [draftReady, setDraftReady] = useState(false);
  const frozenRequest = useRef<unknown>(undefined);
  useEffect(() => {
    let active = true;
    shiftStore()
      .drafts.get(draftKey)
      .then((row) => {
        if (!active) return;
        const draft = row?.value as
          | {
              cart: Record<string, number>;
              discount: string;
              promoId: string;
              discountPhoto?: DiscountPhoto;
              payments: PaymentDraft[];
              saleRequestId: string;
              inventoryEventId: string;
              receipt?: SaleReceipt;
              frozen?: unknown;
            }
          | undefined;
        if (draft) {
          dispatchCart({ type: "restore", cart: draft.cart });
          setDiscount(draft.discount);
          setPromoId(draft.promoId);
          if (draft.discountPhoto) setDiscountPhoto(draft.discountPhoto);
          setPayments(draft.payments);
          setSaleRequestId(draft.saleRequestId);
          setInventoryEventId(draft.inventoryEventId);
          setReceipt(draft.receipt);
          frozenRequest.current = draft.frozen;
          if (draft.receipt) setOrderOpen(true);
        }
        setDraftReady(true);
      })
      .catch(() =>
        setError(
          "Device storage is unavailable. Enable browser storage before taking a sale.",
        ),
      );
    return () => {
      active = false;
    };
  }, [draftKey]);
  useEffect(() => {
    if (!draftReady) return;
    const value = {
      cart,
      discount,
      promoId,
      discountPhoto,
      payments,
      saleRequestId,
      inventoryEventId,
      receipt,
      frozen: frozenRequest.current,
    };
    const write =
      Object.keys(cart).length || receipt
        ? shiftStore().drafts.put({ id: draftKey, value })
        : shiftStore().drafts.delete(draftKey);
    Promise.resolve(write).catch(() =>
      setError(
        "The checkout could not be saved on this device. Free storage before continuing.",
      ),
    );
  }, [
    cart,
    discount,
    promoId,
    discountPhoto,
    payments,
    saleRequestId,
    inventoryEventId,
    receipt,
    draftReady,
    draftKey,
  ]);

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
    if (frozenRequest.current) {
      setError(
        "Retry the saved checkout to resolve its result before changing it.",
      );
      return;
    }
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
    if (frozenRequest.current) {
      setError(
        "Retry the saved checkout to resolve its result before changing it.",
      );
      return;
    }
    setPayments((current) =>
      current.map((payment, paymentIndex) => {
        if (paymentIndex !== index) return payment;
        const next = { ...payment, ...patch };
        if (
          (patch.method || patch.amountMode === "exact") &&
          current.length === 1 &&
          (payment.amountMode === "exact" || patch.amountMode === "exact")
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
    if (frozenRequest.current) {
      setError(
        "Retry the saved checkout to resolve its result before changing it.",
      );
      return;
    }
    setPayments((current) => {
      if (current.length > 1) return current;
      return [
        { ...current[0]!, amount: "", amountMode: "manual" },
        { ...createPaymentDraft("gcash"), amount: "", amountMode: "manual" },
      ];
    });
  }

  function cancelSplitPayment() {
    if (frozenRequest.current) {
      setError(
        "Retry the saved checkout to resolve its result before changing it.",
      );
      return;
    }
    setPayments((current) =>
      syncExactTender(
        [{ ...current[0]!, amount: "", amountMode: "exact" }],
        checkout.totalCents,
      ),
    );
  }

  function resetSale() {
    if (frozenRequest.current && !receipt) {
      setError("Retry this checkout before starting another sale.");
      return;
    }
    if (receipt?.pendingProofs.length || receipt?.pendingDiscountProof) {
      setProofError("Upload the saved proofs before starting another sale.");
      return;
    }
    frozenRequest.current = undefined;
    void shiftStore().drafts.delete(draftKey);
    dispatchCart({ type: "reset" });
    setDiscount("0");
    setPromoId("none");
    setDiscountPhoto({ fileId: crypto.randomUUID(), file: null });
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
    try {
      const result = await uploadPaymentProofAction(proof);
      return result.ok ? true : result.error;
    } catch {
      return "Payment proof upload was interrupted. Please retry.";
    }
  }

  async function uploadDiscountPhoto(saleId: string, photo: DiscountPhoto) {
    if (!photo.file) return "The required promo photo is missing.";
    const form = new FormData();
    form.set("saleId", saleId);
    form.set("fileId", photo.fileId);
    form.set("file", photo.file);
    try {
      const result = await uploadDiscountProofAction(form);
      return result.ok ? true : result.error;
    } catch {
      return "Promo photo upload was interrupted. Please retry.";
    }
  }

  function retryPaymentProofs() {
    if (
      !receipt ||
      (!receipt.pendingProofs.length && !receipt.pendingDiscountProof)
    )
      return;
    setProofError(undefined);
    startTransition(async () => {
      const failed: SubmittedPayment[] = [];
      let latestError: string | undefined;
      let pendingDiscountProof = Boolean(receipt.pendingDiscountProof);
      if (pendingDiscountProof && receipt.discountPhoto) {
        const result = await uploadDiscountPhoto(
          receipt.saleId,
          receipt.discountPhoto,
        );
        pendingDiscountProof = result !== true;
        if (result !== true) latestError = result;
      }
      for (const payment of receipt.pendingProofs) {
        const result = await uploadProof(payment);
        if (result !== true) {
          failed.push(payment);
          latestError = result;
        }
      }
      setReceipt((current) =>
        current
          ? { ...current, pendingProofs: failed, pendingDiscountProof }
          : current,
      );
      setProofError(
        failed.length > 0 || pendingDiscountProof
          ? `Proof retry failed: ${latestError ?? "Please try again."}`
          : undefined,
      );
      if (failed.length === 0 && !pendingDiscountProof) router.refresh();
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || !draftReady) return;
    setError(undefined);
    if (stockError && !frozenRequest.current) {
      setError(stockError);
      return;
    }
    const paymentRows = preparePayments(payments);
    const validationError = validateCheckout({
      itemCount: checkout.cartLines.length,
      totalCents: checkout.totalCents,
      payments: paymentRows,
      requiresPhoto: checkout.selectedPromo?.requiresPhoto,
      discountPhoto: discountPhoto.file,
    });
    if (validationError && !frozenRequest.current) {
      setError(validationError);
      return;
    }

    const saleId = saleRequestId;
    startTransition(async () => {
      const request = frozenRequest.current ?? {
        saleId,
        shiftId,
        inventoryEventId,
        ...(checkout.selectedPromo?.requiresPhoto
          ? {
              discount: {
                promoId: checkout.selectedPromo.id,
                proofFileId: discountPhoto.fileId,
              },
            }
          : {}),
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
      };
      // A saved request may outlive the promo's availability. Its photo obligation
      // must survive retries even when refreshed catalog props no longer include it.
      const requiresDiscountPhoto = Boolean(
        (request as { discount?: unknown }).discount,
      );
      frozenRequest.current = request;
      let result;
      try {
        await shiftStore().drafts.put({
          id: draftKey,
          value: {
            cart,
            discount,
            promoId,
            discountPhoto,
            payments,
            saleRequestId,
            inventoryEventId,
            frozen: request,
          },
        });
        if (offlineSessionId) {
          const proofs = paymentRows
            .filter((payment) => payment.file && payment.method !== "cash")
            .map((payment) => ({
              fileId: payment.proofFileId,
              paymentId: payment.id,
              name: payment.file!.name,
              mimeType: payment.file!.type,
              size: payment.file!.size,
            }));
          const operation = offlineOperationSchema.parse({
            type: "CREATE_SALE",
            payload: request,
            proofs,
            ...(requiresDiscountPhoto && discountPhoto.file
              ? {
                  discountProof: {
                    fileId: discountPhoto.fileId,
                    name: discountPhoto.file.name,
                    mimeType: discountPhoto.file.type,
                    size: discountPhoto.file.size,
                  },
                }
              : {}),
          });
          if (operation.type !== "CREATE_SALE")
            throw new Error("Invalid sale operation.");
          const session = await shiftStore().sessions.get(offlineSessionId);
          if (!session) throw new Error("Prepared shift is missing.");
          await appendShiftAction(offlineSessionId, operation, saleId, [
            ...paymentRows
              .filter((p) => p.file && p.method !== "cash")
              .map((p) => ({
                id: p.proofFileId,
                sessionId: offlineSessionId,
                paymentId: p.id,
                file: p.file!,
                synced: 0,
              })),
            ...(requiresDiscountPhoto && discountPhoto.file
              ? [
                  {
                    id: discountPhoto.fileId,
                    sessionId: offlineSessionId,
                    saleId,
                    file: discountPhoto.file,
                    synced: 0,
                  },
                ]
              : []),
          ]);
          result = actionSuccess(
            calculatePreparedSale(session.snapshot, operation),
          );
        } else result = await finalizeSaleAction(request);
      } catch (failure) {
        if (offlineSessionId) frozenRequest.current = undefined;
        setError(
          failure instanceof Error
            ? failure.message
            : "Sale could not be saved. Retry with this checkout.",
        );
        return;
      }

      if (!result.ok) {
        frozenRequest.current = undefined;
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
        pendingProofs: offlineSessionId ? [] : proofUploads,
        savedLocally: Boolean(offlineSessionId),
        discountName:
          checkout.selectedPromo?.name ??
          (requiresDiscountPhoto ? "Promo" : undefined),
        discountPhoto: requiresDiscountPhoto ? discountPhoto : undefined,
        pendingDiscountProof:
          !offlineSessionId && Boolean(requiresDiscountPhoto),
      });
      setOrderOpen(true);

      if (offlineSessionId) {
        void synchronizePreparedShifts();
        return;
      }
      const failedProofs: SubmittedPayment[] = [];
      let latestProofError: string | undefined;
      let pendingDiscountProof = false;
      if (requiresDiscountPhoto) {
        const result = await uploadDiscountPhoto(saleId, discountPhoto);
        pendingDiscountProof = result !== true;
        if (result !== true) latestProofError = result;
      }
      for (const payment of paymentRows) {
        const proofResult = await uploadProof(payment);
        if (proofResult !== true) {
          failedProofs.push(payment);
          latestProofError = proofResult;
        }
      }
      setReceipt((current) =>
        current
          ? { ...current, pendingProofs: failedProofs, pendingDiscountProof }
          : current,
      );
      setProofError(
        failedProofs.length > 0 || pendingDiscountProof
          ? `Sale completed, but a proof still needs attention: ${latestProofError}`
          : undefined,
      );
      router.refresh();
    });
  }

  if (!draftReady)
    return (
      <p role={error ? "alert" : "status"} className="p-6">
        {error ?? "Recovering saved checkout…"}
      </p>
    );

  const order = (
    <PosOrder
      checkout={checkout}
      cart={cart}
      payments={payments}
      promosEnabled={promosEnabled}
      promos={promos}
      promoId={promoId}
      discount={discount}
      discountPhoto={discountPhoto.file}
      onDiscountPhotoChange={(file) => {
        if (!frozenRequest.current)
          setDiscountPhoto({ fileId: crypto.randomUUID(), file });
      }}
      error={error}
      stockError={stockError ?? stockNotice}
      receipt={receipt}
      proofError={proofError}
      isPending={isPending}
      onQuantityChange={changeQuantity}
      onPromoChange={(value) => {
        if (!frozenRequest.current) {
          setPromoId(value);
          setDiscountPhoto({ fileId: crypto.randomUUID(), file: null });
        }
      }}
      onDiscountChange={(value) => {
        if (!frozenRequest.current) setDiscount(value);
      }}
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
