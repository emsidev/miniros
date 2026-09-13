"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { liveQuery } from "dexie";
import { releasePreparedShiftAction } from "@/server/actions/offline";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronDown,
  MapPin,
} from "lucide-react";
import { ThisDevice } from "./device-controls";
import { ShiftCountWorkflow } from "@/components/employee/shift-count-workflow";
import {
  loadClosingDraft,
  saveClosingDraft,
  submitPreparedClosing,
  type ClosingDraft,
} from "@/lib/offline/count-draft";
import {
  loadRequestDraft,
  saveRequestDraft,
  submitRequestDraft,
  type RequestDraft,
} from "@/lib/offline/request-draft";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { PreparedOpeningCounts } from "./prepared-opening-counts";
import {
  requestedShiftId,
  resolveSavedSession,
} from "@/lib/offline/resolve-session";
import { useDevice } from "./device-context";
import { synchronizePreparedShifts } from "@/lib/offline/sync";
import { calculatePreparedSale } from "@miniros/contracts";
import { calculatePosAvailableQuantity } from "@miniros/domain";
import {
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
  const identity = snapshot.shifts[0]?.session.snapshot;
  const identityKey = identity
    ? `${identity.businessId}:${identity.userId}`
    : undefined;
  const [selectedShift, setSelectedShift] = useState<string>();
  useEffect(() => {
    if (!identityKey) {
      setSelectedShift(undefined);
      return;
    }
    try {
      setSelectedShift(
        JSON.parse(
          localStorage.getItem("miniros:selected-shift:" + identityKey) ??
            "null",
        )?.id,
      );
    } catch {
      setSelectedShift(undefined);
    }
  }, [identityKey]);
  const target = launchParams.get("session") ?? undefined;
  const targetShift = requestedShiftId(launch?.path ?? "", launchParams);
  const listRoute =
    launch?.path === "/shifts" && launchParams.get("all") === "1";
  const session =
    launch && !listRoute
      ? resolveSavedSession(sessions, target, targetShift ?? selectedShift)
      : undefined;
  const missingTarget =
    Boolean(launch) && !loading && Boolean(target || targetShift) && !session;

  useEffect(() => {
    if (!launch || loading || launch.path !== "/offline") return;
    const selected = resolveSavedSession(
      sessions,
      target,
      targetShift ?? selectedShift,
    );
    const shift = selected?.snapshot.shiftId;
    const task = new URLSearchParams(launch.search).get("task");
    const href = shift
      ? task === "sell"
        ? `/pos?shift=${shift}`
        : task === "close"
          ? `/shifts/${shift}/close`
          : task === "sales"
            ? `/shifts/${shift}/sales`
            : task === "inventory"
              ? `/inventory?shift=${shift}`
              : `/shifts/${shift}`
      : "/shifts?all=1";
    const next = parseLocalWorkspaceRoute(href, location.origin);
    history.replaceState(history.state, "", href);
    setLaunch(next);
  }, [launch, loading, sessions, target, targetShift, selectedShift]);

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
        const active = resolveSavedSession(
          sessions.filter((saved) => canOpenLocalTask(saved, "sell")),
          undefined,
          selectedShift,
        );
        if (!active) {
          destination = { path: "/shifts", search: "" };
          setMessage("Choose a shift before selling.");
        } else {
          destination.search = `?shift=${encodeURIComponent(active.snapshot.shiftId)}`;
        }
      }
      const id = requestedShiftId(
        destination.path,
        new URLSearchParams(destination.search),
      );
      const chosen = sessions.find((saved) => saved.snapshot.shiftId === id);
      if (chosen && identityKey) {
        setSelectedShift(id);
        try {
          localStorage.setItem(
            "miniros:selected-shift:" + identityKey,
            JSON.stringify({ id, status: localShiftStatus(chosen) }),
          );
        } catch {}
      }
      const url = `${destination.path}${destination.search}`;
      history.pushState(history.state, "", url);
      setLaunch(destination);
      window.scrollTo({ top: 0, behavior: "auto" });
    },
    [online, sessions, selectedShift, identityKey],
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
      route={{
        pathname: path,
        shift: shiftRoute,
        onNavigate: navigate,
        identityKey,
      }}
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
        ) : path === "/more" || path === "/help" ? (
          <section className="space-y-6">
            <PageHeader title={path === "/help" ? "Shift help" : "More"} />
            <ThisDevice />
            <div className="divide-y border-y">
              <p className="py-4 text-sm">
                Prepare online. Count stock and opening float. Sell, record
                expenses, then count actual stock and cash to close.
              </p>
              <p className="py-4 text-sm text-muted-foreground">
                Saved work stays on this device. Keep this app installed until
                all transactions and photos are uploaded.
              </p>
              <Button
                className="my-3"
                variant="outline"
                disabled={!online}
                onClick={() => location.assign("/profile")}
              >
                Account & sign out
              </Button>
            </div>
          </section>
        ) : listRoute || !session ? (
          <SavedShiftsScreen
            sessions={sessions}
            locked={snapshot.locked}
            online={online}
            onNavigate={navigate}
            onRefresh={refresh}
            onLoadOnline={() => location.assign("/shifts")}
          />
        ) : session ? (
          <>
            <SavedShiftRoute
              key={session.id}
              path={path}
              session={session}
              online={online}
              onNavigate={navigate}
              onMessage={setMessage}
            />
            {path === `/shifts/${session.snapshot.shiftId}` ? (
              <section className="space-y-4 border-t pt-6">
                <h2 className="text-lg font-bold">Other shifts</h2>
                {sessions
                  .filter((saved) => saved.id !== session.id)
                  .slice(0, 5)
                  .map((saved) => (
                    <SavedShiftRow
                      key={saved.id}
                      session={saved}
                      onNavigate={navigate}
                    />
                  ))}
                <Button
                  variant="outline"
                  onClick={() => navigate("/shifts?all=1")}
                >
                  Upcoming shifts & history
                </Button>
              </section>
            ) : null}
          </>
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
          title="Stock & expenses"
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
          title="Opening count"
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
    const opening = (
      await shiftStore().drafts.get("counts:" + session.id + ":start")
    )?.value as
      | { counts?: Record<string, string>; cash?: string; notes?: string }
      | undefined;
    if (
      opening &&
      (Object.values(opening.counts ?? {}).some((value) => value !== "") ||
        opening.cash ||
        opening.notes)
    )
      throw new Error(
        "This shift has saved counts. Keep this device and finish the shift; it cannot be released as unused.",
      );
    const result = await releasePreparedShiftAction({
      sessionId: session.id,
      storageId: session.snapshot.storageInstallationId,
    });
    if (!result.ok) throw new Error(result.error);
    await shiftStore().sessions.update(session.id, { status: "released" });
    offlineChanged();
    onNavigate("/shifts?all=1");
  } catch (error) {
    onMessage(error instanceof Error ? error.message : "Release failed.");
  }
}

export function SavedShiftOverview({
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
        backHref="/shifts?all=1"
        backLabel="Back to shifts"
        onBack={() => onNavigate("/shifts?all=1")}
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
                  : "Continue selling"}
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
              Stock & expenses
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
        Receipts
      </Button>
      <dl className="grid grid-cols-2 gap-x-6 border-y text-sm">
        <div className="py-4">
          <dt className="text-muted-foreground">Sales</dt>
          <dd className="mt-1 text-xl font-bold">
            {formatMoney(session.projection.salesCents)}
          </dd>
        </div>
        <div className="py-4">
          <dt className="text-muted-foreground">Recorded expenses</dt>
          <dd className="mt-1 text-xl font-bold">
            {formatMoney(session.projection.deductionsCents)}
          </dd>
        </div>
        <div className="py-4">
          <dt className="text-muted-foreground">Receipts</dt>
          <dd className="mt-1 font-bold">{session.projection.saleCount}</dd>
        </div>
        <div className="py-4">
          <dt className="text-muted-foreground">Remaining stock</dt>
          <dd className="mt-1 font-bold">
            {
              Object.values(session.projection.balances).filter(
                (value) => Number(value) > 0,
              ).length
            }{" "}
            stock items
          </dd>
        </div>
      </dl>
      {session.projection.state === "closing" || session.status === "closed" ? (
        <LocalCloseoutResult session={session} />
      ) : null}
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
    const stockItem =
      product.stockInventoryItemId ?? product.producedInventoryItemId;
    const recipe =
      snapshot.features.recipesEnabled &&
      product.requiresRecipeDeduction &&
      !stockItem;
    return {
      ...product,
      requiresRecipeDeduction: recipe,
      stockTracked: Boolean(recipe || stockItem),
      stockRequirements: stockItem
        ? [
            {
              inventoryItemId: stockItem,
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
      key={session.id}
      shiftId={snapshot.shiftId}
      offlineSessionId={session.id}
      locationName={snapshot.locationName}
      shiftDate={snapshot.shiftDate}
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
  const [draft, setDraft] = useState<ClosingDraft>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadClosingDraft(session.id).then(
      (value) => {
        if (active) setDraft(value);
      },
      () => {
        if (active)
          setError("Counts could not be recovered. Check storage and retry.");
      },
    );
    return () => {
      active = false;
    };
  }, [session.id]);
  const persist = useCallback(
    (value: ClosingDraft) => saveClosingDraft(session.id, value),
    [session.id],
  );
  const submit = async (value: ClosingDraft) => {
    await saveClosingDraft(session.id, value);
    await submitPreparedClosing(session, value);
    void synchronizePreparedShifts();
    onDone();
  };
  return error ? (
    <p role="alert">
      {error}
      <Button onClick={() => location.reload()}>Retry</Button>
    </p>
  ) : draft ? (
    <ShiftCountWorkflow
      mode="close"
      shiftId={session.snapshot.shiftId}
      items={session.snapshot.inventory.map((item) => ({
        ...item,
        initialQuantity: session.projection.balances[item.id] ?? "0",
      }))}
      summary={{
        openingCashCents: session.projection.openingCashCents ?? 0,
        saleSummary: {
          grossSalesCents: session.projection.salesCents,
          discountsCents: 0,
        },
        paymentSummary: [
          { method: "cash", amountCents: session.projection.cashCents },
        ],
        approvedDeductionsCents: session.projection.deductionsCents,
      }}
      closeout={{ draft, onChange: persist, onSubmit: submit }}
    />
  ) : (
    <p role="status">Recovering counts…</p>
  );
}

function RequestForm({ session }: { session: LocalSession }) {
  const [kind, setKind] = useState<"cash" | "inventory">();
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Record cash paid out or request a stock correction. Existing owner
        approvals still apply.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => setKind("cash")}>Add expense</Button>
        <Button variant="outline" onClick={() => setKind("inventory")}>
          Adjust stock
        </Button>
      </div>
      <dl className="divide-y border-y">
        {session.snapshot.inventory.map((item) => (
          <div key={item.id} className="flex justify-between gap-4 py-4">
            <dt>
              {item.name}
              <span className="block text-sm text-muted-foreground">
                {item.unit}
              </span>
            </dt>
            <dd className="font-bold tabular-nums">
              {session.projection.balances[item.id] ?? "0"}
            </dd>
          </div>
        ))}
      </dl>
      <Sheet
        open={Boolean(kind)}
        onOpenChange={(open) => {
          if (!open) setKind(undefined);
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader>
            <SheetTitle>
              {kind === "cash" ? "Add expense" : "Adjust stock"}
            </SheetTitle>
            <SheetDescription>
              Entries stay with this shift on this device.
            </SheetDescription>
          </SheetHeader>
          {kind ? (
            <DurableRequest
              key={session.id + kind}
              session={session}
              kind={kind}
              onDone={() => setKind(undefined)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
function DurableRequest({
  session,
  kind,
  onDone,
}: {
  session: LocalSession;
  kind: "cash" | "inventory";
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<RequestDraft>();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    let active = true;
    loadRequestDraft(session.id, kind).then(
      (value) => {
        if (active) setDraft(value);
      },
      () => {
        if (active)
          setError("Draft cannot be recovered. Check device storage.");
      },
    );
    return () => {
      active = false;
    };
  }, [session.id, kind]);
  useEffect(() => {
    if (!draft || submitting.current) return;
    let active = true;
    setSaved(false);
    saveRequestDraft(session.id, kind, draft).then(
      () => {
        if (active) setSaved(true);
      },
      () => {
        if (active)
          setError("Draft was not saved. Free device storage and retry.");
      },
    );
    return () => {
      active = false;
    };
  }, [draft, session.id, kind]);
  function change(field: keyof RequestDraft, value: string) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }
  return (
    <form
      className="mx-auto mt-5 max-w-xl space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!draft || submitting.current) return;
        submitting.current = true;
        setBusy(true);
        setError("");
        try {
          await submitRequestDraft(
            session.id,
            session.snapshot.shiftId,
            kind,
            draft,
          );
          void synchronizePreparedShifts();
          onDone();
        } catch (failure) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Request could not be saved.",
          );
        } finally {
          submitting.current = false;
          setBusy(false);
        }
      }}
    >
      {draft ? (
        <>
          {kind === "cash" ? (
            <div className="space-y-2">
              <Label htmlFor="expense-name">Expense name</Label>
              <Input
                id="expense-name"
                required
                maxLength={120}
                value={draft.label}
                onChange={(event) => change("label", event.target.value)}
                className="h-12"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="stock-item">Stock item</Label>
              <select
                id="stock-item"
                required
                value={draft.item}
                onChange={(event) => change("item", event.target.value)}
                className="h-12 w-full rounded-lg border bg-card px-3"
              >
                <option value="">Choose item</option>
                {session.snapshot.inventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.unit}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="expense-amount">
              {kind === "cash"
                ? "Amount paid (₱)"
                : "Quantity change (negative removes stock)"}
            </Label>
            <Input
              id="expense-amount"
              required
              type="number"
              inputMode="decimal"
              min={kind === "cash" ? "0.01" : undefined}
              step={kind === "cash" ? "0.01" : "0.001"}
              value={draft.amount}
              onChange={(event) => change("amount", event.target.value)}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense-reason">Reason</Label>
            <Input
              id="expense-reason"
              required
              maxLength={2000}
              value={draft.reason}
              onChange={(event) => change("reason", event.target.value)}
              className="h-12"
            />
          </div>
          <p role="status" className="text-sm text-muted-foreground">
            {saved ? "Saved on this device" : "Saving entries…"}
          </p>
          <Button type="submit" disabled={busy} size="lg" className="w-full">
            {busy
              ? "Saving…"
              : kind === "cash"
                ? "Save expense"
                : "Save stock request"}
          </Button>
        </>
      ) : (
        <p role="status">Recovering draft…</p>
      )}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function LocalCloseoutResult({ session }: { session: LocalSession }) {
  const [action, setAction] = useState<LocalAction>();
  useEffect(() => {
    const sub = liveQuery(() =>
      shiftStore()
        .shiftActions.where("sessionId")
        .equals(session.id)
        .filter((a) => a.operation.type === "SUBMIT_CLOSEOUT")
        .first(),
    ).subscribe(setAction);
    return () => sub.unsubscribe();
  }, [session.id]);
  if (action?.operation.type !== "SUBMIT_CLOSEOUT") return null;
  const actual = action.operation.payload;
  const expected =
    (session.projection.openingCashCents ?? 0) +
    session.projection.cashCents -
    session.projection.deductionsCents;
  return (
    <section className="space-y-4 border-y py-5">
      <h2 className="text-lg font-bold">
        {action.status === "synced"
          ? "Closeout uploaded"
          : "Closed on this device"}
      </h2>
      <p className="text-sm text-muted-foreground">
        Owner reviews and attachment uploads are separate. This device retains
        the entered counts.
      </p>
      <dl className="divide-y">
        <div className="flex justify-between gap-3 py-3">
          <dt>Cash difference · device estimate</dt>
          <dd className="font-bold">
            {formatMoney(actual.actualCashCents - expected)}
          </dd>
        </div>
        {actual.counts.map((count) => (
          <div
            key={count.inventoryItemId}
            className="flex justify-between gap-3 py-3"
          >
            <dt>
              {
                session.snapshot.inventory.find(
                  (item) => item.id === count.inventoryItemId,
                )?.name
              }
            </dt>
            <dd className="tabular-nums">
              {Number(count.quantity) -
                Number(
                  session.projection.balances[count.inventoryItemId] ?? 0,
                )}{" "}
              difference · {count.quantity} counted
            </dd>
          </div>
        ))}
      </dl>
    </section>
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
