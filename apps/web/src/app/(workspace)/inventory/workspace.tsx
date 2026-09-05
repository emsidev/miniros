"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Boxes, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/feedback";
import {
  SearchSelect,
  InventoryToolbar,
} from "@/components/inventory/controls";
import { ShiftNavigationScope } from "@/components/employee/navigation-context";
import { StockList } from "@/components/employee/stock-list";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatQuantity,
} from "@/lib/format";
import {
  newAdjustmentDraft,
  newCashDraft,
  type CashDraft,
  type AdjustmentDraft,
} from "@/lib/inventory-forms";
import type {
  InventoryWorkspaceData,
  InventorySelection,
} from "@/server/services/inventory-workspace";
import { RequestForms } from "./request-forms";

type Drafts = { cash: CashDraft; adjustment: AdjustmentDraft };
export function InventoryWorkspace({
  workspace,
  tab,
}: {
  workspace: InventoryWorkspaceData;
  tab?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [switching, startTransition] = useTransition();
  const [mode, setMode] = useState<"cash" | "adjustment" | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Drafts>>({});
  const selection = workspace.selected;
  const selectedId = selection?.shift.id;
  const key = `${workspace.businessId}:${selectedId ?? ""}`;
  const draft = drafts[key];
  const activeTab = tab === "movements" || tab === "cash" ? tab : "stock";
  const requestedId = params.get("shift");
  useEffect(() => {
    if (selectedId && requestedId === null) {
      const next = new URLSearchParams(params.toString());
      next.set("shift", selectedId);
      router.replace(`/inventory?${next}`, { scroll: false });
    }
  }, [params, requestedId, router, selectedId]);

  function navigate(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    if (selectedId) next.set("shift", selectedId);
    for (const [name, value] of Object.entries(changes)) {
      if (value === null) next.delete(name);
      else next.set(name, value);
    }
    startTransition(() => router.push(`/inventory?${next}`, { scroll: false }));
  }
  function open(action: "cash" | "adjustment", itemId?: string) {
    if (!selection?.canRecord || switching) return;
    setDrafts((current) => {
      const value = current[key] ?? {
        cash: newCashDraft(),
        adjustment: newAdjustmentDraft(),
      };
      return {
        ...current,
        [key]:
          itemId && !value.adjustment.uncertain
            ? {
                ...value,
                adjustment: { ...value.adjustment, inventoryItemId: itemId },
              }
            : value,
      };
    });
    setMode(action);
  }
  function clearDraft() {
    if (mode)
      setDrafts((current) => ({
        ...current,
        [key]: {
          ...current[key]!,
          [mode]: mode === "cash" ? newCashDraft() : newAdjustmentDraft(),
        },
      }));
    setMode(null);
  }
  return (
    <div className="inventory-workspace space-y-5">
      {selection ? (
        <ShiftNavigationScope
          id={selection.shift.id}
          status={selection.shift.status}
        />
      ) : null}
      <header className="space-y-3">
        <Link
          href={selection ? `/shifts/${selection.shift.id}` : "/shifts"}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {selection ? "Back to shift" : "My shifts"}
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Inventory & cash
        </h1>
      </header>
      <InventoryToolbar>
        <div className="grid items-end gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <SearchSelect
            id="inventory-shift"
            label="Shift"
            value={selectedId ?? ""}
            disabled={switching || !workspace.shiftOptions.length}
            placeholder={
              workspace.shiftOptions.length
                ? "Choose a shift"
                : "No shifts available"
            }
            options={workspace.shiftOptions.map((shift) => ({
              value: shift.id,
              label: `${shift.title ? `${shift.title} · ` : ""}${shift.locationName} · ${formatDate(shift.shiftDate)}`,
              detail:
                shift.status === "closed"
                  ? "Closed · Read-only"
                  : shift.status === "closing"
                    ? "Closing"
                    : "Active",
              group: shift.status === "closed" ? "Past shifts" : "Open shifts",
            }))}
            onChange={(shift) => {
              setMode(null);
              navigate({ shift, page: null });
            }}
          />
          {selection?.canRecord ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                className="min-h-11"
                disabled={switching}
                onClick={() => open("cash")}
              >
                <WalletCards aria-hidden="true" />
                Cash deduction
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={switching || !selection.items.length}
                onClick={() => open("adjustment")}
              >
                <Boxes aria-hidden="true" />
                Adjust stock
              </Button>
            </div>
          ) : selection ? (
            <div className="flex min-h-11 items-center gap-2 text-sm">
              <StatusBadge status={selection.shift.status} />
              <span>Read-only</span>
            </div>
          ) : null}
        </div>
        {switching ? (
          <p role="status" className="mt-2 text-sm text-muted-foreground">
            Loading inventory…
          </p>
        ) : null}
      </InventoryToolbar>
      {!selection ? (
        <section className="space-y-3 rounded-xl border border-dashed bg-card p-6">
          <h2 className="text-lg font-bold">
            {workspace.unavailable === "requested_shift_unavailable"
              ? "Shift unavailable"
              : "No inventory shifts yet"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {workspace.unavailable === "requested_shift_unavailable"
              ? "This shift is no longer available to you. Choose another shift above."
              : "Start an assigned shift to record stock and cash. Your completed shifts will also appear here."}
          </p>
          <Button asChild variant="outline">
            <Link href="/shifts">View my shifts</Link>
          </Button>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <StatusBadge status={selection.shift.status} />
            <p className="text-muted-foreground">
              {selection.closed
                ? "Recorded closing stock. This shift can no longer be changed."
                : selection.canRecord
                  ? workspace.approvalsEnabled
                    ? "Cash and stock requests need admin approval."
                    : "Cash and stock changes are recorded immediately."
                  : "Recording is unavailable for your access or this shift’s inventory setup."}
            </p>
          </div>
          <Tabs
            value={activeTab}
            onValueChange={(value) => navigate({ tab: value })}
          >
            <TabsList
              aria-label="Inventory records"
              className="grid w-full grid-cols-3 group-data-horizontal/tabs:h-12"
            >
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="movements">Movements</TabsTrigger>
              <TabsTrigger value="cash">Cash deductions</TabsTrigger>
            </TabsList>
            <TabsContent value="stock" className="pt-4">
              <StockList
                balances={selection.stock}
                historical={selection.closed}
                onAdjust={
                  selection.canRecord && !switching
                    ? (id) => open("adjustment", id)
                    : undefined
                }
              />
            </TabsContent>
            <TabsContent value="movements" className="space-y-6 pt-4">
              <MovementHistory
                selection={selection}
                adminVisibility={workspace.adminVisibility}
              />
              <nav
                aria-label="Stock movement pages"
                className="flex items-center justify-between gap-3"
              >
                <Button
                  variant="outline"
                  disabled={switching || selection.movementPage <= 1}
                  onClick={() =>
                    navigate({ page: String(selection.movementPage - 1) })
                  }
                >
                  Newer
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {selection.movementPage}
                </span>
                <Button
                  variant="outline"
                  disabled={switching || !selection.hasMoreMovements}
                  onClick={() =>
                    navigate({ page: String(selection.movementPage + 1) })
                  }
                >
                  Older
                </Button>
              </nav>
            </TabsContent>
            <TabsContent value="cash" className="space-y-3 pt-4">
              <h2 className="text-lg font-bold">
                {workspace.adminVisibility
                  ? "Cash deductions"
                  : "My cash deductions"}
              </h2>
              {!selection.cashDeductions.length ? (
                <p className="text-sm text-muted-foreground">
                  No cash deductions recorded for this shift.
                </p>
              ) : (
                <ul className="divide-y rounded-xl border bg-card">
                  {selection.cashDeductions.map((record) => (
                    <li key={record.id} className="space-y-2 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <p className="min-w-0 break-words font-semibold">
                          {record.label}
                        </p>
                        <span className="shrink-0 font-bold tabular-nums">
                          {formatMoney(record.amountCents)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={record.status} />
                        <time className="text-xs text-muted-foreground">
                          {formatDateTime(record.createdAt)}
                        </time>
                      </div>
                      {record.reason ? (
                        <p className="break-words text-sm text-muted-foreground">
                          {record.reason}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
          {mode && draft ? (
            <RequestForms
              key={`${key}:${mode}`}
              selection={selection}
              mode={mode}
              cash={draft.cash}
              adjustment={draft.adjustment}
              onCashChange={(cash) =>
                setDrafts((current) => ({
                  ...current,
                  [key]: { ...current[key]!, cash },
                }))
              }
              onAdjustmentChange={(adjustment) =>
                setDrafts((current) => ({
                  ...current,
                  [key]: { ...current[key]!, adjustment },
                }))
              }
              onClose={() => setMode(null)}
              onSaved={clearDraft}
              onDiscard={clearDraft}
              approvalsEnabled={workspace.approvalsEnabled}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function MovementHistory({
  selection,
  adminVisibility,
}: {
  selection: InventorySelection;
  adminVisibility: boolean;
}) {
  return (
    <>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          Stock movements{selection.closed ? " through closeout" : ""}
        </h2>
        {!selection.recentEvents.length ? (
          <p className="text-sm text-muted-foreground">
            No stock movements on this page.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {selection.recentEvents.map((record) => (
              <li key={record.id} className="space-y-1 p-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="min-w-0 break-words font-semibold">
                    {record.itemName}
                  </p>
                  <p className="shrink-0 font-bold tabular-nums">
                    {Number(record.quantityDelta) > 0 ? "+" : ""}
                    {formatQuantity(record.quantityDelta)} {record.unit}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="capitalize">
                    {record.eventType.replaceAll("_", " ")}
                  </span>{" "}
                  · {formatDateTime(record.createdAt)}
                </p>
                {record.notes ? (
                  <p className="break-words text-sm text-muted-foreground">
                    {record.notes}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">
          {adminVisibility
            ? "Stock adjustment requests"
            : "My stock adjustment requests"}
        </h2>
        <p className="text-sm text-muted-foreground">
          Pending requests do not change the stock balance.
        </p>
        {!selection.adjustments.length ? (
          <p className="text-sm text-muted-foreground">
            No stock adjustment requests for this shift.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {selection.adjustments.map((record) => (
              <li key={record.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="min-w-0 break-words font-semibold">
                    {record.itemName}
                  </p>
                  <p className="shrink-0 font-bold tabular-nums">
                    {Number(record.quantityDelta) > 0 ? "+" : ""}
                    {formatQuantity(record.quantityDelta)} {record.unit}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={record.status} />
                  <time className="text-xs text-muted-foreground">
                    {formatDateTime(record.createdAt)}
                  </time>
                </div>
                <p className="break-words text-sm text-muted-foreground">
                  {record.reason}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
