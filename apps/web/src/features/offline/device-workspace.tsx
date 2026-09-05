"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { liveQuery } from "dexie";
import { releasePreparedShiftAction } from "@/server/actions/offline";
import { ArrowLeft, FolderClock } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { PreparedOpeningCounts } from "./prepared-opening-counts";
import {
  requestedShiftId,
  resolveSavedSession,
} from "@/lib/offline/resolve-session";
import { useDevice } from "./device-context";
import { DeviceMenuButton, SyncStatusButton } from "./device-controls";
import { synchronizePreparedShifts } from "@/lib/offline/sync";
import {
  calculatePreparedSale,
  offlineOperationSchema,
} from "@miniros/contracts";
import { calculatePosAvailableQuantity } from "@miniros/domain";
import {
  appendShiftAction,
  offlineChanged,
  shiftStore,
  type LocalAction,
  type LocalProof,
  type LocalSession,
} from "@/lib/offline/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { PosForm } from "@/app/(workspace)/pos/pos-form";

export function DeviceWorkspace() {
  const { snapshot, loading, online, error, refresh, openPanel } = useDevice();
  const sessions = snapshot.shifts.map((row) => row.session);
  const params = useSearchParams();
  const [view, setView] = useState("overview");
  const [message, setMessage] = useState("");
  const [launch, setLaunch] = useState<{ path: string; search: string }>();
  useEffect(() => {
    // A cached /offline document can be served at a /shifts/:id URL.
    // Resolve its actual browser URL before revealing any saved assignment.
    setLaunch({ path: location.pathname, search: location.search });
    const panel = params.get("panel");
    if (panel === "install" || panel === "sync") openPanel(panel);
  }, [params, openPanel]);
  const launchParams = new URLSearchParams(launch?.search);
  const target = launchParams.get("session") ?? undefined;
  const targetShift = requestedShiftId(launch?.path ?? "", launchParams);
  const session = launch
    ? resolveSavedSession(sessions, target, targetShift)
    : undefined;
  const missingTarget =
    Boolean(launch) && !loading && Boolean(target || targetShift) && !session;
  const pending = session
    ? session.nextSequence - 1 - session.acknowledgedSequence
    : 0;
  const status =
    session?.status === "closed"
      ? "Shift closed"
      : session?.status === "recovery"
        ? "Needs owner review"
        : session?.projection.state === "closing"
          ? "Closeout saved on this device"
          : session?.projection.state === "prepared"
            ? "Opening stock"
            : "Shift open on this device";
  return (
    <div className="min-h-screen bg-background pb-[env(safe-area-inset-bottom)]">
      <header className="border-b bg-card px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <Link
            className="inline-flex min-h-11 items-center gap-2 font-bold"
            href="/shifts"
          >
            <ArrowLeft className="size-4" /> Shifts
          </Link>
          <div className="flex items-center gap-1">
            {view !== "sell" ? <SyncStatusButton /> : null}
            <DeviceMenuButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-extrabold">
            {session?.snapshot.locationName ?? "Saved shifts"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {session
              ? `${session.snapshot.businessName} · ${session.snapshot.shiftDate}`
              : "Shifts available on this device."}
          </p>
        </div>
        {loading ? <p role="status">Opening saved shifts…</p> : null}
        {missingTarget ? (
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="text-lg font-bold">This shift isn’t saved here</h2>
            <p className="text-sm text-muted-foreground">
              Use the original device and account. If saving was interrupted,
              reconnect and open Start shift to retry.
            </p>
            {online ? (
              <Button asChild variant="outline">
                <Link
                  href={
                    targetShift ? `/shifts/${targetShift}/start` : "/shifts"
                  }
                >
                  Back to shifts
                </Link>
              </Button>
            ) : null}
          </section>
        ) : null}
        {!loading && !sessions.length && !missingTarget ? (
          <section className="mx-auto max-w-md space-y-4 py-10 text-center">
            <FolderClock
              className="mx-auto size-9 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="text-lg font-bold">
              {snapshot.locked
                ? "Sign in to open saved shifts"
                : "No saved shifts yet"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {snapshot.locked
                ? "Use the account and business that prepared this device."
                : "Open Start shift while connected. Your shift saves here automatically."}
            </p>
            {snapshot.locked ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href="/login">Sign in</Link>
                </Button>
                <Button variant="ghost" disabled={!online} onClick={refresh}>
                  Check access again
                </Button>
              </div>
            ) : error ? (
              <Button variant="outline" onClick={refresh}>
                Check again
              </Button>
            ) : online ? (
              <Button asChild>
                <Link href="/shifts">Choose a shift</Link>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Reconnect to choose a shift.
              </p>
            )}
          </section>
        ) : null}
        {sessions.length > 1 ? (
          <div className="space-y-2">
            <Label htmlFor="saved-shift">Saved shift</Label>
            <select
              className="h-12 w-full rounded-lg border bg-card px-3"
              id="saved-shift"
              value={session?.id ?? ""}
              onChange={(event) => {
                setLaunch({
                  path: "/offline",
                  search: `?session=${event.target.value}`,
                });
                history.replaceState(
                  history.state,
                  "",
                  `/offline?session=${event.target.value}`,
                );
                setView("overview");
              }}
            >
              <option value="">Choose a shift</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.snapshot.locationName} · {s.snapshot.shiftDate}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {session ? (
          <>
            <section
              aria-label="Shift status"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"
            >
              <div>
                <p className="font-semibold">{status}</p>
                {pending > 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {pending} {pending === 1 ? "change" : "changes"} waiting to
                    sync.
                  </p>
                ) : null}
                {session.projection.state === "closing" &&
                session.status !== "closed" ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Final results wait for sync, payment proofs, and any owner
                    review.
                  </p>
                ) : null}
              </div>
              <Button variant="ghost" onClick={() => openPanel("sync")}>
                View sync details
              </Button>
            </section>
            <ReconciledResult session={session} />
            <nav
              aria-label="Prepared shift tools"
              className="flex flex-wrap gap-2"
            >
              {["overview", "sell", "requests", "sales", "close"].map(
                (item) => (
                  <Button
                    key={item}
                    variant={view === item ? "default" : "outline"}
                    disabled={
                      (item === "sell" ||
                        item === "requests" ||
                        item === "close") &&
                      (session.projection.state !== "active" ||
                        ["recovery", "closed", "released"].includes(
                          session.status,
                        ))
                    }
                    onClick={() => setView(item)}
                  >
                    {
                      {
                        overview: "Shift",
                        sell: "New sale",
                        requests: "Inventory & cash",
                        sales: "Sales & receipts",
                        close: "Close shift",
                      }[item]
                    }
                  </Button>
                ),
              )}
            </nav>
            {view === "overview" ? (
              <section className="space-y-5">
                <h2 className="text-lg font-bold">
                  {session.projection.state === "prepared"
                    ? "Opening stock"
                    : "Shift result"}
                </h2>
                {session.projection.state === "prepared" &&
                session.status !== "recovery" ? (
                  <>
                    <PreparedOpeningCounts
                      key={session.id}
                      session={session}
                      onDone={() => setView("sell")}
                    />
                    <Button
                      variant="ghost"
                      disabled={!online}
                      onClick={async () => {
                        try {
                          if (
                            await shiftStore()
                              .shiftActions.where("sessionId")
                              .equals(session.id)
                              .count()
                          )
                            throw new Error(
                              "This shift has saved work. Synchronize and close it before releasing ownership.",
                            );
                          const result = await releasePreparedShiftAction({
                            sessionId: session.id,
                            storageId: session.snapshot.storageInstallationId,
                          });
                          if (!result.ok) throw new Error(result.error);
                          await shiftStore().sessions.update(session.id, {
                            status: "released",
                          });
                          offlineChanged();
                        } catch (error) {
                          setMessage(
                            error instanceof Error
                              ? error.message
                              : "Release failed.",
                          );
                        }
                      }}
                    >
                      Release unused preparation
                    </Button>
                  </>
                ) : (
                  <>
                    <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                      {[
                        ["Sales", session.projection.salesCents],
                        ["Product costs", session.projection.productCostCents],
                        [
                          "Expected cash before reviews",
                          session.projection.cashCents -
                            session.projection.deductionsCents,
                        ],
                        [
                          "Provisional profit",
                          session.projection.salesCents -
                            session.projection.productCostCents -
                            session.projection.deductionsCents -
                            Object.values(session.snapshot.costs).reduce(
                              (a, b) => a + b,
                              0,
                            ),
                        ],
                      ].map(([label, value]) => (
                        <div key={String(label)}>
                          <dt className="text-sm text-muted-foreground">
                            {label}
                          </dt>
                          <dd className="mt-1 text-lg font-bold tabular-nums">
                            {formatMoney(Number(value))}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="text-sm text-muted-foreground">
                      Prepared costs: rent{" "}
                      {formatMoney(session.snapshot.costs.rentCents)}, transport{" "}
                      {formatMoney(session.snapshot.costs.transportCents)},
                      staff {formatMoney(session.snapshot.costs.salaryCents)},
                      other {formatMoney(session.snapshot.costs.otherCents)}.
                      Pending requests remain estimates until reviewed. Final
                      location recommendations use reconciled server results.
                    </p>
                    <Button asChild variant="outline">
                      <Link href={`/shifts/${session.snapshot.shiftId}`}>
                        View server shift result
                      </Link>
                    </Button>
                  </>
                )}
              </section>
            ) : null}
            {view === "sell" && session.projection.state === "active" ? (
              <PreparedPos key={session.id} session={session} />
            ) : null}
            {view === "requests" ? (
              <RequestForm key={session.id} session={session} />
            ) : null}
            {view === "sales" ? <SaleHistory session={session} /> : null}
            {view === "close" ? (
              <CountForm
                key={session.id}
                session={session}
                kind="close"
                onDone={() => setView("overview")}
              />
            ) : null}
          </>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        ) : null}
      </main>
    </div>
  );
}

function PreparedPos({ session }: { session: LocalSession }) {
  const snapshot = session.snapshot;
  const inventoryBalances = Object.entries(session.projection.balances).map(
    ([inventoryItemId, quantity]) => ({ inventoryItemId, quantity }),
  );
  const catalog = snapshot.products.map((product) => {
    const recipe =
      snapshot.features.recipesEnabled &&
      product.requiresRecipeDeduction &&
      !product.producedInventoryItemId;
    return {
      ...product,
      requiresRecipeDeduction: recipe,
      stockTracked: Boolean(recipe || product.producedInventoryItemId),
      stockRequirements: product.producedInventoryItemId
        ? [
            {
              inventoryItemId: product.producedInventoryItemId,
              quantityPerUnit: "1",
            },
          ]
        : recipe
          ? snapshot.recipes
              .filter((row) => row.productId === product.id)
              .map((row) => ({
                inventoryItemId: row.inventoryItemId,
                quantityPerUnit: row.quantityPerProduct,
              }))
          : [],
    };
  });
  const products = catalog.map((product) => ({
    ...product,
    availableQuantity: calculatePosAvailableQuantity({
      productId: product.id,
      products: catalog.map((p) => ({
        productId: p.id,
        stockTracked: p.stockTracked,
        requirements: p.stockRequirements,
      })),
      balances: inventoryBalances,
      cart: [],
    }),
  }));
  return (
    <PosForm
      shiftId={snapshot.shiftId}
      offlineSessionId={session.id}
      locationName={snapshot.locationName}
      shiftSummary={session.projection}
      inventoryBalances={inventoryBalances}
      products={products}
      promosEnabled={snapshot.features.promosEnabled}
      promos={snapshot.promos}
    />
  );
}

function CountForm({
  session,
  kind,
  onDone,
}: {
  session: LocalSession;
  kind: "start" | "close";
  onDone: () => void;
}) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [cash, setCash] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const key = `counts:${session.id}:${kind}`;
  useEffect(() => {
    shiftStore()
      .drafts.get(key)
      .then((row) => {
        const saved = row?.value as
          | { counts: Record<string, string>; cash: string; notes: string }
          | undefined;
        if (saved) {
          setCounts(saved.counts);
          setCash(saved.cash);
          setNotes(saved.notes);
        }
        setReady(true);
      })
      .catch(() =>
        setError("Counts cannot be recovered. Check device storage."),
      );
  }, [key]);
  useEffect(() => {
    if (ready)
      shiftStore()
        .drafts.put({ id: key, value: { counts, cash, notes } })
        .catch(() =>
          setError(
            "Counts could not be saved. Free device storage before continuing.",
          ),
        );
  }, [key, counts, cash, notes, ready]);
  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          const lines = session.snapshot.inventory.map((item) => ({
            inventoryItemId: item.id,
            quantity: counts[item.id] ?? "",
          }));
          const payload =
            kind === "start"
              ? {
                  shiftId: session.snapshot.shiftId,
                  inventoryLocationId: session.snapshot.inventoryLocationId,
                  openingEventId: crypto.randomUUID(),
                  counts: lines,
                  notes,
                }
              : {
                  shiftId: session.snapshot.shiftId,
                  closeoutId: crypto.randomUUID(),
                  cashReconciliationId: crypto.randomUUID(),
                  profitSummaryId: crypto.randomUUID(),
                  inventoryEventId: crypto.randomUUID(),
                  actualCashCents: Math.round(Number(cash) * 100),
                  counts: lines,
                  notes,
                };
          const operation = offlineOperationSchema.parse({
            type: kind === "start" ? "START_SHIFT" : "SUBMIT_CLOSEOUT",
            payload,
          });
          await appendShiftAction(session.id, operation);
          await shiftStore().drafts.delete(key);
          void synchronizePreparedShifts();
          onDone();
        } catch (failure) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not save counts.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-sm text-muted-foreground">
        {kind === "start"
          ? "Enter the stock physically present at this booth. Preparation has already saved the catalogue and shift costs."
          : "Count your closing stock and cash. Final results wait for sync and any owner review."}
      </p>
      <div className="divide-y">
        {session.snapshot.inventory.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[minmax(0,1fr)_112px] items-center gap-4 py-3"
          >
            <Label htmlFor={`${kind}-${item.id}`}>
              {item.name}
              <span className="mt-1 block text-xs text-muted-foreground">
                {item.unit}
                {kind === "close"
                  ? ` · expected ${session.projection.balances[item.id] ?? "0"}`
                  : ""}
              </span>
            </Label>
            <Input
              id={`${kind}-${item.id}`}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.001"
              required
              value={counts[item.id] ?? ""}
              onChange={(event) =>
                setCounts({ ...counts, [item.id]: event.target.value })
              }
            />
          </div>
        ))}
      </div>
      {kind === "close" ? (
        <div className="space-y-2">
          <Label htmlFor="actual-cash">Actual cash counted (₱)</Label>
          <Input
            id="actual-cash"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            required
            value={cash}
            onChange={(event) => setCash(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Expected before reviews:{" "}
            {formatMoney(
              session.projection.cashCents - session.projection.deductionsCents,
            )}
          </p>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="count-notes">Notes (optional)</Label>
        <Input
          id="count-notes"
          value={notes}
          maxLength={2000}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy || !ready}>
        {busy
          ? "Saving on this device…"
          : kind === "start"
            ? "Start shift on this device"
            : "Submit closeout on this device"}
      </Button>
    </form>
  );
}

function RequestForm({ session }: { session: LocalSession }) {
  const [type, setType] = useState("cash");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        try {
          const reason = String(data.get("reason"));
          const operation = offlineOperationSchema.parse(
            type === "cash"
              ? {
                  type: "CREATE_CASH_DEDUCTION",
                  payload: {
                    deductionId: crypto.randomUUID(),
                    shiftId: session.snapshot.shiftId,
                    label: String(data.get("label")),
                    amountCents: Math.round(Number(data.get("amount")) * 100),
                    reason,
                  },
                }
              : {
                  type: "CREATE_INVENTORY_ADJUSTMENT",
                  payload: {
                    adjustmentId: crypto.randomUUID(),
                    inventoryEventId: crypto.randomUUID(),
                    shiftId: session.snapshot.shiftId,
                    inventoryItemId: String(data.get("item")),
                    quantityDelta: String(data.get("amount")),
                    reason,
                  },
                },
          );
          await appendShiftAction(session.id, operation);
          setMessage(
            "Request saved on this device. An owner reviews it online; it does not increase available stock.",
          );
          form.reset();
          void synchronizePreparedShifts();
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Request could not be saved.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-lg font-bold">Inventory and cash requests</h2>
      <p className="text-sm text-muted-foreground">
        Record requests here while offline. Central production, stock transfers
        and approvals need an internet connection.
      </p>
      <Label htmlFor="request-kind">Request type</Label>
      <select
        id="request-kind"
        className="h-12 w-full rounded-lg border bg-card px-3"
        value={type}
        onChange={(event) => setType(event.target.value)}
      >
        <option value="cash">Cash paid out</option>
        <option value="inventory">Stock adjustment</option>
      </select>
      {type === "cash" ? (
        <>
          <Label htmlFor="request-label">Expense name</Label>
          <Input id="request-label" name="label" required maxLength={120} />
        </>
      ) : (
        <>
          <Label htmlFor="request-item">Inventory item</Label>
          <select
            id="request-item"
            name="item"
            className="h-12 w-full rounded-lg border bg-card px-3"
          >
            {session.snapshot.inventory.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.unit})
              </option>
            ))}
          </select>
        </>
      )}
      <Label htmlFor="request-amount">
        {type === "cash"
          ? "Amount (₱)"
          : "Quantity change (negative for stock removed)"}
      </Label>
      <Input
        id="request-amount"
        name="amount"
        type="number"
        required
        step={type === "cash" ? "0.01" : "0.001"}
        min={type === "cash" ? "0.01" : undefined}
      />
      <Label htmlFor="request-reason">Reason</Label>
      <Input id="request-reason" name="reason" required maxLength={2000} />
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save request on this device"}
      </Button>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </form>
  );
}

function SaleHistory({ session }: { session: LocalSession }) {
  const [actions, setActions] = useState<LocalAction[]>([]);
  useEffect(() => {
    const subscription = liveQuery(() =>
      shiftStore()
        .shiftActions.where("sessionId")
        .equals(session.id)
        .sortBy("sequence"),
    ).subscribe(setActions);
    return () => subscription.unsubscribe();
  }, [session.id]);
  const sales = actions.filter((a) => a.operation.type === "CREATE_SALE");
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold">Sales and receipts</h2>
      {sales.length ? (
        sales.map((action) => {
          if (action.operation.type !== "CREATE_SALE") return null;
          const receipt = calculatePreparedSale(
            session.snapshot,
            action.operation,
          );
          return (
            <details key={action.id} className="rounded-xl border bg-card p-4">
              <summary className="min-h-11 cursor-pointer font-semibold">
                {formatMoney(receipt.totalCents)} ·{" "}
                {new Date(action.occurredAt).toLocaleTimeString()} ·{" "}
                {action.status === "synced" ? "Synced" : "Saved on device"}
              </summary>
              <p className="mt-3 break-all text-xs text-muted-foreground">
                Sale {receipt.saleId}
              </p>
              <dl className="mt-3 space-y-2">
                {receipt.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-4">
                    <dt>
                      {item.name} × {item.quantity}
                    </dt>
                    <dd>{formatMoney(item.totalCents)}</dd>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-3">
                  <dt>Change</dt>
                  <dd>{formatMoney(receipt.changeCents)}</dd>
                </div>
              </dl>
              <ProofStatus sessionId={session.id} action={action} />
              {receipt.payments.map((p) => (
                <p key={p.id} className="mt-2 text-sm">
                  {p.paymentMethod}: {formatMoney(p.amountCents)}
                  {p.referenceNumber ? ` · ${p.referenceNumber}` : ""}
                </p>
              ))}
            </details>
          );
        })
      ) : (
        <p>
          No sales yet. Start the shift and make a sale to see its receipt here.
        </p>
      )}
    </section>
  );
}

function ProofStatus({
  sessionId,
  action,
}: {
  sessionId: string;
  action: LocalAction;
}) {
  const [proofs, setProofs] = useState<LocalProof[]>([]);
  useEffect(() => {
    const sub = liveQuery(() =>
      shiftStore().proofs.where("sessionId").equals(sessionId).toArray(),
    ).subscribe(setProofs);
    return () => sub.unsubscribe();
  }, [sessionId]);
  if (action.operation.type !== "CREATE_SALE") return null;
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {action.operation.proofs.map((declared) => {
        const proof = proofs.find((p) => p.id === declared.fileId);
        return (
          <li key={declared.fileId}>
            {declared.name}:{" "}
            {proof?.synced
              ? "Uploaded"
              : proof
                ? "Saved on this device; upload pending"
                : "Local attachment unavailable—owner review required"}
            {proof?.error ? (
              <p className="text-destructive">{proof.error}</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
function ReconciledResult({ session }: { session: LocalSession }) {
  const [result, setResult] = useState<Record<string, unknown>>();
  useEffect(() => {
    const sub = liveQuery(() =>
      shiftStore()
        .shiftActions.where("sessionId")
        .equals(session.id)
        .filter(
          (a) =>
            a.operation.type === "SUBMIT_CLOSEOUT" && a.status === "synced",
        )
        .first(),
    ).subscribe((action) => setResult(action?.result));
    return () => sub.unsubscribe();
  }, [session.id]);
  if (!result) return null;
  return (
    <section className="space-y-2 rounded-xl border bg-card p-4">
      <h2 className="font-bold">Final reconciled result</h2>
      <p>
        Profit: <strong>{formatMoney(Number(result.profitCents))}</strong>
      </p>
      <p className="text-sm">
        Expected cash {formatMoney(Number(result.expectedCashCents))} · counted{" "}
        {formatMoney(Number(result.actualCashCents))} · difference{" "}
        {formatMoney(Number(result.cashDifferenceCents))}
      </p>
      <p className="text-sm text-muted-foreground">
        This server-confirmed result is included in the location report. The
        device estimates below retain the original record.
      </p>
    </section>
  );
}
