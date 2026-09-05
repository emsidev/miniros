"use client";
import { useCallback, useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { releasePreparedShiftAction } from "@/server/actions/offline";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronDown,
  MapPin,
} from "lucide-react";
import { PreparedOpeningCounts } from "./prepared-opening-counts";
import {
  requestedShiftId,
  resolveSavedSession,
} from "@/lib/offline/resolve-session";
import { useDevice } from "./device-context";
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
import { formatDate, formatMoney } from "@/lib/format";
import { PosForm } from "@/app/(workspace)/pos/pos-form";
import { EmployeeShellFrame } from "@/components/shared/employee-shell-frame";
import { WorkspaceSelector } from "@/components/shared/workspace-selector";
import { PageHeader } from "@/components/shared/layout";
import { EmptyState, StatusBadge } from "@/components/shared/feedback";
import { ShiftContext } from "@/components/employee/shift-context";
import {
  canOpenLocalTask,
  localResumeHref,
  localShiftStatus,
  parseLocalWorkspaceRoute,
  requiresConnection,
  type LocalWorkspaceRoute,
} from "@/lib/offline/workspace-route";

export function DeviceWorkspace() {
  const { snapshot, loading, online, error, refresh, openPanel } = useDevice();
  const sessions = snapshot.shifts.map((row) => row.session);
  const [message, setMessage] = useState("");
  const [launch, setLaunch] = useState<LocalWorkspaceRoute>();

  useEffect(() => {
    // A cached /offline document can be served at a /shifts/:id URL.
    // Resolve its actual browser URL before revealing any saved assignment.
    const readLocation = () =>
      setLaunch({ path: location.pathname, search: location.search });
    readLocation();
    const panel = new URLSearchParams(location.search).get("panel");
    if (panel === "install" || panel === "sync") openPanel(panel);
    window.addEventListener("popstate", readLocation);
    return () => window.removeEventListener("popstate", readLocation);
  }, [openPanel]);

  const launchParams = new URLSearchParams(launch?.search);
  const target = launchParams.get("session") ?? undefined;
  const targetShift = requestedShiftId(launch?.path ?? "", launchParams);
  const listRoute = launch?.path === "/shifts";
  const session =
    launch && !listRoute
      ? resolveSavedSession(sessions, target, targetShift)
      : undefined;
  const missingTarget =
    Boolean(launch) && !loading && Boolean(target || targetShift) && !session;

  useEffect(() => {
    if (!launch || loading || launch.path !== "/offline") return;
    const selected = resolveSavedSession(sessions, target, targetShift);
    const href = selected ? localResumeHref(selected) : "/shifts";
    const next = parseLocalWorkspaceRoute(href, location.origin);
    history.replaceState(history.state, "", href);
    setLaunch(next);
  }, [launch, loading, sessions, target, targetShift]);

  const navigate = useCallback(
    (href: string) => {
      setMessage("");
      const next = parseLocalWorkspaceRoute(href, location.origin);
      if (requiresConnection(next.path)) {
        if (online) {
          location.assign(href);
        } else {
          const label =
            next.path === "/schedule"
              ? "Schedule"
              : next.path === "/profile"
                ? "Profile"
                : "Production";
          setMessage(
            `${label} needs a connection. Your current shift is still available here.`,
          );
        }
        return;
      }

      let destination = next;
      if (
        (next.path === "/pos" || next.path === "/inventory") &&
        !next.search
      ) {
        const active = sessions.find(
          (saved) =>
            saved.projection.state === "active" &&
            !["recovery", "closed", "released"].includes(saved.status),
        );
        if (!active) {
          destination = { path: "/shifts", search: "" };
          setMessage("Start a saved shift before opening this workspace.");
        } else {
          destination.search = `?shift=${encodeURIComponent(active.snapshot.shiftId)}`;
        }
      }
      const url = `${destination.path}${destination.search}`;
      history.pushState(history.state, "", url);
      setLaunch(destination);
      window.scrollTo({ top: 0, behavior: "auto" });
    },
    [online, sessions],
  );

  const path = launch?.path ?? "/shifts";
  const currentBusiness = session?.snapshot ?? sessions[0]?.snapshot;
  const shiftRoute = session
    ? { id: session.snapshot.shiftId, status: localShiftStatus(session) }
    : null;

  return (
    <EmployeeShellFrame
      workspaceHome="/shifts"
      employeePermissions={{ canUsePos: true, canLogProduction: false }}
      businessControl={
        <WorkspaceSelector
          value={currentBusiness?.businessId ?? "device"}
          onValueChange={() => {}}
          options={[
            {
              value: currentBusiness?.businessId ?? "device",
              label: currentBusiness?.businessName ?? "Employee workspace",
              icon: Building2,
            },
          ]}
          icon={Building2}
          ariaLabel="Current business"
          placeholder="Employee workspace"
          className="h-11 min-w-0 flex-1 shadow-none sm:max-w-64 [&_[data-slot=select-value]]:min-w-0"
        />
      }
      route={{ pathname: path, shift: shiftRoute, onNavigate: navigate }}
    >
      <div className={path === "/pos" ? "" : "space-y-6"}>
        {message ? (
          <p
            role="status"
            aria-atomic="true"
            className="rounded-xl border bg-card px-4 py-3 text-sm"
          >
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {loading || !launch ? (
          <p role="status">Opening your workspace…</p>
        ) : missingTarget ? (
          <EmptyState
            title="This shift isn’t available on this device"
            description="Use the device that started this shift, or reconnect and return to My shifts."
            action={
              <Button variant="outline" onClick={() => navigate("/shifts")}>
                Back to shifts
              </Button>
            }
          />
        ) : path === "/shifts" || !sessions.length ? (
          <SavedShiftsScreen
            sessions={sessions}
            locked={snapshot.locked}
            online={online}
            onNavigate={navigate}
            onRefresh={refresh}
            onLoadOnline={() => location.assign("/shifts")}
          />
        ) : session ? (
          <SavedShiftRoute
            path={path}
            session={session}
            online={online}
            onNavigate={navigate}
            onMessage={setMessage}
          />
        ) : (
          <OfflineUnavailable path={path} onBack={() => navigate("/shifts")} />
        )}
      </div>
    </EmployeeShellFrame>
  );
}

function SavedShiftsScreen({
  sessions,
  locked,
  online,
  onNavigate,
  onRefresh,
  onLoadOnline,
}: {
  sessions: LocalSession[];
  locked: boolean;
  online: boolean;
  onNavigate: (href: string) => void;
  onRefresh: () => Promise<void>;
  onLoadOnline: () => void;
}) {
  const current = sessions.filter((session) =>
    ["active", "closing"].includes(localShiftStatus(session)),
  );
  const upcoming = sessions.filter(
    (session) => localShiftStatus(session) === "scheduled",
  );
  const history = sessions.filter(
    (session) => localShiftStatus(session) === "closed",
  );
  return (
    <>
      <PageHeader
        title="My shifts"
        description="Your assignments, your next action, and the day’s results."
        action={
          <Button variant="outline" onClick={() => onNavigate("/schedule")}>
            <CalendarDays aria-hidden="true" />
            Schedule
          </Button>
        }
      />
      {!sessions.length ? (
        <EmptyState
          title={locked ? "Sign in to open your shifts" : "No shifts available"}
          description={
            locked
              ? "Use the account and business that prepared this device."
              : online
                ? "Load your current assignments from MINIROS."
                : "Your assigned shift must be opened once while connected before it is available offline."
          }
          action={
            locked ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => location.assign("/login")}>
                  Sign in
                </Button>
                <Button
                  variant="outline"
                  disabled={!online}
                  onClick={onRefresh}
                >
                  Check access again
                </Button>
              </div>
            ) : online ? (
              <Button variant="outline" onClick={onLoadOnline}>
                Load my shifts
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="current-shifts">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="current-shifts" className="text-lg font-bold">
                In progress
              </h2>
              <span className="text-sm text-muted-foreground">
                {current.length} {current.length === 1 ? "shift" : "shifts"}
              </span>
            </div>
            {current.length ? (
              <div className="divide-y rounded-xl border bg-card">
                {current.map((saved) => (
                  <SavedShiftRow
                    key={saved.id}
                    session={saved}
                    onNavigate={onNavigate}
                    current
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                No shift in progress. Review your next assignment below.
              </p>
            )}
          </section>
          <section aria-labelledby="upcoming-shifts">
            <h2 id="upcoming-shifts" className="mb-3 text-lg font-bold">
              Upcoming shifts
            </h2>
            {upcoming.length ? (
              <div className="divide-y rounded-xl border bg-card">
                {upcoming.map((saved) => (
                  <SavedShiftRow
                    key={saved.id}
                    session={saved}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                You have no upcoming assignments. An admin can schedule your
                next shift.
              </p>
            )}
          </section>
          {history.length ? (
            <details className="group rounded-xl border bg-card">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold">
                Shift history
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {history.length}
                </span>
                <ChevronDown
                  className="size-4 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="divide-y border-t">
                {history.map((saved) => (
                  <SavedShiftRow
                    key={saved.id}
                    session={saved}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </>
  );
}

function SavedShiftRow({
  session,
  onNavigate,
  current = false,
}: {
  session: LocalSession;
  onNavigate: (href: string) => void;
  current?: boolean;
}) {
  const status = localShiftStatus(session);
  const shiftPath = `/shifts/${session.snapshot.shiftId}`;
  const action =
    status === "scheduled"
      ? { label: "Start shift", href: `${shiftPath}/start` }
      : status === "active"
        ? {
            label: "Sell",
            href: `/pos?shift=${session.snapshot.shiftId}`,
          }
        : {
            label: status === "closed" ? "View summary" : "View shift",
            href: shiftPath,
          };
  return (
    <article className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          <span className="text-sm text-muted-foreground">
            {formatDate(session.snapshot.shiftDate)}
          </span>
        </div>
        <h3
          className={
            current ? "break-words text-xl font-bold" : "break-words font-bold"
          }
        >
          <button
            type="button"
            className="text-left hover:underline"
            onClick={() => onNavigate(shiftPath)}
          >
            {session.snapshot.locationName}
          </button>
        </h3>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          {session.snapshot.locationName}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action.href !== shiftPath ? (
          <Button variant="ghost" onClick={() => onNavigate(shiftPath)}>
            Details
          </Button>
        ) : null}
        <Button
          variant={current || status === "scheduled" ? "default" : "outline"}
          className="flex-1 sm:flex-none"
          onClick={() => onNavigate(action.href)}
        >
          {action.label}
          <ArrowRight aria-hidden="true" />
        </Button>
      </div>
    </article>
  );
}

function SavedShiftRoute({
  path,
  session,
  online,
  onNavigate,
  onMessage,
}: {
  path: string;
  session: LocalSession;
  online: boolean;
  onNavigate: (href: string) => void;
  onMessage: (message: string) => void;
}) {
  const shiftPath = `/shifts/${session.snapshot.shiftId}`;
  if (path === "/pos" && canOpenLocalTask(session, "sell"))
    return (
      <PreparedPos
        key={session.id}
        session={session}
        onBack={() => onNavigate(shiftPath)}
      />
    );
  if (path === "/inventory" && canOpenLocalTask(session, "inventory"))
    return (
      <>
        <ShiftContext
          shift={localShiftContext(session)}
          title="Inventory & cash"
          onBack={() => onNavigate(shiftPath)}
        />
        <RequestForm key={session.id} session={session} />
      </>
    );
  if (path.endsWith("/start") && canOpenLocalTask(session, "start"))
    return (
      <>
        <ShiftContext
          shift={localShiftContext(session)}
          title="Start shift"
          onBack={() => onNavigate(shiftPath)}
        />
        <PreparedOpeningCounts
          key={session.id}
          session={session}
          onDone={() => onNavigate(`/pos?shift=${session.snapshot.shiftId}`)}
        />
        <Button
          variant="ghost"
          disabled={!online}
          onClick={() => releaseUnusedSession(session, onNavigate, onMessage)}
        >
          Release unused preparation
        </Button>
      </>
    );
  if (path.endsWith("/sales"))
    return (
      <>
        <ShiftContext
          shift={localShiftContext(session)}
          title="Sales and receipts"
          onBack={() => onNavigate(shiftPath)}
        />
        <SaleHistory session={session} />
      </>
    );
  if (path.endsWith("/close") && canOpenLocalTask(session, "close"))
    return (
      <>
        <ShiftContext
          shift={localShiftContext(session)}
          title="Close shift"
          onBack={() => onNavigate(shiftPath)}
        />
        <PreparedCloseoutForm
          key={session.id}
          session={session}
          onDone={() => onNavigate(shiftPath)}
        />
      </>
    );
  return <SavedShiftOverview session={session} onNavigate={onNavigate} />;
}

function localShiftContext(session: LocalSession) {
  return {
    id: session.snapshot.shiftId,
    locationName: session.snapshot.locationName,
    shiftDate: session.snapshot.shiftDate,
    status: localShiftStatus(session),
    assignmentStatus: "assigned",
  };
}

async function releaseUnusedSession(
  session: LocalSession,
  onNavigate: (href: string) => void,
  onMessage: (message: string) => void,
) {
  try {
    if (
      await shiftStore()
        .shiftActions.where("sessionId")
        .equals(session.id)
        .count()
    )
      throw new Error(
        "This shift has saved work. Sync and close it before releasing it.",
      );
    const result = await releasePreparedShiftAction({
      sessionId: session.id,
      storageId: session.snapshot.storageInstallationId,
    });
    if (!result.ok) throw new Error(result.error);
    await shiftStore().sessions.update(session.id, { status: "released" });
    offlineChanged();
    onNavigate("/shifts");
  } catch (error) {
    onMessage(error instanceof Error ? error.message : "Release failed.");
  }
}

function SavedShiftOverview({
  session,
  onNavigate,
}: {
  session: LocalSession;
  onNavigate: (href: string) => void;
}) {
  const shiftPath = `/shifts/${session.snapshot.shiftId}`;
  const status = localShiftStatus(session);
  const blocked =
    session.projection.state === "closing" ||
    ["recovery", "closed", "released"].includes(session.status);
  return (
    <div className="space-y-6">
      <ShiftContext
        shift={localShiftContext(session)}
        title={session.snapshot.locationName}
        backHref="/shifts"
        backLabel="Back to shifts"
        onBack={() => onNavigate("/shifts")}
      />
      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-lg font-bold">
              {session.status === "closed"
                ? "Shift complete"
                : session.status === "recovery"
                  ? "Needs owner review"
                  : session.projection.state === "closing"
                    ? "Closeout saved"
                    : "Your next step"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {session.status === "recovery"
                ? "This shift needs owner review before more work can be recorded."
                : status === "scheduled"
                  ? "Count the stock you have before you begin selling."
                  : status === "active"
                    ? "Ready to sell. Keep stock movements and cash deductions up to date as you work."
                    : status === "closing"
                      ? "Your closeout is safe on this device. Reconnect for the final result."
                      : "Review the shift result and receipts below."}
            </p>
          </div>
          {!blocked ? (
            <Button
              size="lg"
              className="shrink-0"
              onClick={() =>
                onNavigate(
                  status === "scheduled"
                    ? `${shiftPath}/start`
                    : status === "closing"
                      ? `${shiftPath}/close`
                      : `/pos?shift=${session.snapshot.shiftId}`,
                )
              }
            >
              {status === "scheduled"
                ? "Start shift"
                : status === "closing"
                  ? "Continue closeout"
                  : "Sell"}
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : null}
        </div>
        {status === "active" ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={() =>
                onNavigate(`/inventory?shift=${session.snapshot.shiftId}`)
              }
            >
              Inventory & cash
            </Button>
            <Button
              variant="ghost"
              onClick={() => onNavigate(`${shiftPath}/close`)}
            >
              Close shift
            </Button>
          </div>
        ) : null}
      </section>
      <Button
        variant="outline"
        onClick={() => onNavigate(`${shiftPath}/sales`)}
      >
        Sales and receipts
      </Button>
      <ReconciledResult session={session} />
    </div>
  );
}

function OfflineUnavailable({
  path,
  onBack,
}: {
  path: string;
  onBack: () => void;
}) {
  const title = path.startsWith("/profile")
    ? "Profile"
    : path.startsWith("/schedule")
      ? "Schedule"
      : path.startsWith("/production")
        ? "Production"
        : "This page";
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        title={`${title} needs a connection`}
        description="Your current shift remains available. Reconnect to load this page."
        action={<Button onClick={onBack}>Back to shifts</Button>}
      />
    </>
  );
}

function PreparedPos({
  session,
  onBack,
}: {
  session: LocalSession;
  onBack: () => void;
}) {
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
      onBack={onBack}
    />
  );
}

function PreparedCloseoutForm({
  session,
  onDone,
}: {
  session: LocalSession;
  onDone: () => void;
}) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [cash, setCash] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const key = `counts:${session.id}:close`;
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
          const payload = {
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
            type: "SUBMIT_CLOSEOUT",
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
        Count your closing stock and cash. Your entries save automatically on
        this device until you submit.
      </p>
      <div className="divide-y">
        {session.snapshot.inventory.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[minmax(0,1fr)_112px] items-center gap-4 py-3"
          >
            <Label htmlFor={`close-${item.id}`}>
              {item.name}
              <span className="mt-1 block text-xs text-muted-foreground">
                {item.unit} · expected{" "}
                {session.projection.balances[item.id] ?? "0"}
              </span>
            </Label>
            <Input
              id={`close-${item.id}`}
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
        {busy ? "Saving…" : "Submit closeout"}
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
        Record cash paid out or correct an inventory count. Requests save
        immediately and sync automatically when a connection is available.
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
        {busy ? "Saving…" : "Save request"}
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
