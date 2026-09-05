"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowRightLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NumericExpressionInput } from "@/components/ui/numeric-expression-input";
import {
  InventoryDrawer,
  InventoryField,
  InventoryToolbar,
  SearchSelect,
} from "@/components/inventory/controls";
import { WorkflowErrors } from "@/components/employee/workflow-controls";
import {
  newMovementDraft,
  inventoryFieldErrors,
  newMovementLine,
  positiveAmount,
  validateMovementDraft,
  type InventoryFormError,
  type MovementDraft,
} from "@/lib/inventory-forms";
import {
  createCentralInventoryLocationAction,
  receiveStockAction,
  transferStockAction,
} from "@/server/actions/stock";

type LocationOption = { id: string; name: string; locationType: string };
type ItemOption = { id: string; name: string; unit: string };
type Mode = "receive" | "transfer";

export function StockMovementForm({
  businessId,
  locations,
  items,
}: {
  businessId: string;
  locations: readonly LocationOption[];
  items: readonly ItemOption[];
}) {
  const [mode, setMode] = useState<Mode | "location" | null>(null);
  const [drafts, setDrafts] = useState<Record<string, MovementDraft>>({});
  const [locationNames, setLocationNames] = useState<Record<string, string>>(
    {},
  );
  const key = `${businessId}:${mode}`;
  const draft = drafts[key];
  function open(value: Mode) {
    const draftKey = `${businessId}:${value}`;
    setDrafts((current) => ({
      ...current,
      [draftKey]: current[draftKey] ?? newMovementDraft(),
    }));
    setMode(value);
  }
  function clear() {
    setDrafts((current) => ({ ...current, [key]: newMovementDraft() }));
    setMode(null);
  }
  return (
    <>
      <InventoryToolbar>
        <div className="flex flex-wrap gap-2">
          <Button
            className="min-h-11 flex-1 sm:flex-none"
            onClick={() => open("receive")}
          >
            <ArrowDownToLine aria-hidden="true" />
            Receive stock
          </Button>
          <Button
            className="min-h-11 flex-1 sm:flex-none"
            variant="outline"
            onClick={() => open("transfer")}
          >
            <ArrowRightLeft aria-hidden="true" />
            Transfer stock
          </Button>
          <Button
            className="min-h-11 sm:ml-auto"
            variant="ghost"
            onClick={() => setMode("location")}
          >
            <Plus aria-hidden="true" />
            Add location
          </Button>
        </div>
      </InventoryToolbar>
      {(mode === "receive" || mode === "transfer") && draft ? (
        <MovementDrawer
          key={key}
          mode={mode}
          draft={draft}
          locations={locations}
          items={items}
          onChange={(value) =>
            setDrafts((current) => ({ ...current, [key]: value }))
          }
          onClose={() => setMode(null)}
          onSaved={clear}
          onDiscard={clear}
        />
      ) : null}
      {mode === "location" ? (
        <CentralLocationForm
          value={locationNames[businessId] ?? ""}
          onChange={(value) =>
            setLocationNames((current) => ({ ...current, [businessId]: value }))
          }
          onClose={() => setMode(null)}
          onClear={() => {
            setLocationNames((current) => ({ ...current, [businessId]: "" }));
            setMode(null);
          }}
        />
      ) : null}
    </>
  );
}

function MovementDrawer({
  mode,
  draft,
  locations,
  items,
  onChange,
  onClose,
  onSaved,
  onDiscard,
}: {
  mode: Mode;
  draft: MovementDraft;
  locations: readonly LocationOption[];
  items: readonly ItemOption[];
  onChange: (draft: MovementDraft) => void;
  onClose: () => void;
  onSaved: () => void;
  onDiscard: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const uncertain = Boolean(draft.uncertain);
  const setUncertain = (value: boolean) =>
    onChange({ ...draft, uncertain: value });
  const [errors, setErrors] = useState<InventoryFormError[]>([]);
  const [message, setMessage] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const disabled = pending || uncertain;
  const canSubmit =
    items.length > 0 && locations.length >= (mode === "receive" ? 1 : 2);
  const errorFor = (id: string) =>
    errors.find((error) => error.id === id)?.message;
  const update = (value: Partial<MovementDraft>) =>
    onChange({ ...draft, ...value });
  const locationOptions = locations.map((location) => ({
    value: location.id,
    label: location.name,
    detail:
      location.locationType === "central"
        ? "Central storage"
        : "Shift inventory",
  }));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const issues = uncertain
      ? []
      : validateMovementDraft(draft, mode, locations, items);
    setErrors(issues);
    setMessage(undefined);
    setAttempt((value) => value + 1);
    if (issues.length) return;
    startTransition(async () => {
      try {
        const lines = draft.lines.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          quantity: positiveAmount(line.quantity, 3)!.toFixed(3),
        }));
        const result =
          mode === "receive"
            ? await receiveStockAction({
                receivingId: draft.id,
                inventoryEventId: draft.eventId,
                inventoryLocationId: draft.locationId,
                referenceNumber: draft.referenceNumber.trim() || null,
                notes: draft.notes.trim() || null,
                lines,
              })
            : await transferStockAction({
                transferId: draft.id,
                transferOutEventId: draft.eventId,
                transferInEventId: draft.secondEventId,
                fromInventoryLocationId: draft.fromLocationId,
                toInventoryLocationId: draft.toLocationId,
                notes: draft.notes.trim() || null,
                lines,
              });
        if (!result.ok) {
          setUncertain(false);
          setErrors(
            inventoryFieldErrors(result.fieldErrors, {
              inventoryLocationId: {
                id: "receiving-location",
                label: "Receive into",
              },
              fromInventoryLocationId: { id: "transfer-from", label: "From" },
              toInventoryLocationId: { id: "transfer-to", label: "To" },
              lines: { id: "movement-lines", label: "Items" },
              referenceNumber: {
                id: "movement-reference",
                label: "Invoice or reference",
              },
              notes: { id: "movement-notes", label: "Notes" },
            }),
          );
          setMessage(
            items.reduce(
              (text, item) => text.replaceAll(item.id, item.name),
              result.error,
            ),
          );
          setAttempt((value) => value + 1);
          return;
        }
        toast.success(
          `${draft.lines.length} ${draft.lines.length === 1 ? "item" : "items"} ${mode === "receive" ? "received" : "transferred"}.`,
        );
        onSaved();
        router.refresh();
      } catch {
        setUncertain(true);
        setMessage(
          "The connection was interrupted. Retry this same batch to check whether it was saved. Your entries are still here.",
        );
        setAttempt((value) => value + 1);
      }
    });
  }
  return (
    <InventoryDrawer
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
      title={mode === "receive" ? "Receive stock" : "Transfer stock"}
      description={
        mode === "receive"
          ? "Record supplies arriving at one inventory location."
          : "Move stock between two locations in one entry."
      }
      footer={
        <>
          <Button
            variant="ghost"
            disabled={disabled}
            onClick={onDiscard}
            className="mr-auto min-h-11"
          >
            Discard
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={onClose}
            className="min-h-11"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="stock-movement"
            disabled={pending || !canSubmit}
            className="min-h-11"
          >
            {pending
              ? "Saving…"
              : uncertain
                ? "Retry batch"
                : `Save ${draft.lines.length} ${draft.lines.length === 1 ? "item" : "items"}`}
          </Button>
        </>
      }
    >
      <form
        id="stock-movement"
        className="space-y-5"
        onSubmit={submit}
        noValidate
      >
        <WorkflowErrors
          errors={errors}
          message={
            message ??
            (uncertain
              ? "Retry this batch to check whether it was saved before making changes."
              : undefined)
          }
          attempt={attempt}
          onField={(id) => document.getElementById(id)?.focus()}
        />
        {!canSubmit ? (
          <p className="rounded-lg bg-muted p-3 text-sm">
            {!items.length
              ? "Add an active inventory item first."
              : mode === "transfer"
                ? "Add at least two inventory locations before transferring stock."
                : "Add a location before receiving stock."}
          </p>
        ) : null}
        {mode === "receive" ? (
          <SearchSelect
            id="receiving-location"
            label="Receive into"
            value={draft.locationId}
            disabled={disabled}
            options={locationOptions}
            error={errorFor("receiving-location")}
            onChange={(locationId) => update({ locationId })}
            placeholder="Choose a location"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <SearchSelect
              id="transfer-from"
              label="From"
              value={draft.fromLocationId}
              disabled={disabled}
              options={locationOptions}
              error={errorFor("transfer-from")}
              onChange={(fromLocationId) =>
                update({
                  fromLocationId,
                  toLocationId:
                    draft.toLocationId === fromLocationId
                      ? ""
                      : draft.toLocationId,
                })
              }
              placeholder="Source location"
            />
            <SearchSelect
              id="transfer-to"
              label="To"
              value={draft.toLocationId}
              disabled={disabled}
              options={locationOptions.map((option) => ({
                ...option,
                disabled: option.value === draft.fromLocationId,
              }))}
              error={errorFor("transfer-to")}
              onChange={(toLocationId) => update({ toLocationId })}
              placeholder="Destination location"
            />
          </div>
        )}
        <fieldset
          id="movement-lines"
          tabIndex={-1}
          className="min-w-0 space-y-4"
          disabled={disabled}
          aria-describedby={
            errorFor("movement-lines") ? "movement-lines-error" : undefined
          }
        >
          <legend className="mb-3 text-base font-bold">
            Items · {draft.lines.length} of 100
          </legend>
          {errorFor("movement-lines") ? (
            <p id="movement-lines-error" className="text-sm text-destructive">
              {errorFor("movement-lines")}
            </p>
          ) : null}
          {draft.lines.map((line, index) => {
            const item = items.find((item) => item.id === line.inventoryItemId);
            const updateLine = (values: Partial<typeof line>) =>
              update({
                lines: draft.lines.map((row) =>
                  row.id === line.id ? { ...row, ...values } : row,
                ),
              });
            return (
              <div key={line.id} className="space-y-3 border-b pb-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">Item {index + 1}</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    disabled={disabled || draft.lines.length === 1}
                    aria-label={`Remove item ${index + 1}`}
                    onClick={() =>
                      update({
                        lines: draft.lines.filter((row) => row.id !== line.id),
                      })
                    }
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                  <SearchSelect
                    id={`item-${line.id}`}
                    label={`Inventory item ${index + 1}`}
                    value={line.inventoryItemId}
                    disabled={disabled}
                    error={errorFor(`item-${line.id}`)}
                    placeholder="Search inventory…"
                    options={items.map((item) => ({
                      value: item.id,
                      label: item.name,
                      detail: item.unit,
                      disabled: draft.lines.some(
                        (row) =>
                          row.id !== line.id && row.inventoryItemId === item.id,
                      ),
                    }))}
                    onChange={(inventoryItemId) =>
                      updateLine({ inventoryItemId })
                    }
                  />
                  <InventoryField
                    id={`quantity-${line.id}`}
                    label={`Quantity${item ? ` (${item.unit})` : ""}`}
                    error={errorFor(`quantity-${line.id}`)}
                  >
                    <NumericExpressionInput
                      id={`quantity-${line.id}`}
                      value={line.quantity}
                      onValueChange={(quantity) => updateLine({ quantity })}
                      disabled={disabled}
                      precision={3}
                      min="0.001"
                      clearOnFirstFocus={false}
                      required
                      aria-invalid={Boolean(errorFor(`quantity-${line.id}`))}
                      aria-describedby={
                        errorFor(`quantity-${line.id}`)
                          ? `quantity-${line.id}-error`
                          : undefined
                      }
                      placeholder="0.000"
                    />
                  </InventoryField>
                </div>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full"
            disabled={
              disabled || draft.lines.length >= Math.min(100, items.length)
            }
            onClick={() =>
              update({ lines: [...draft.lines, newMovementLine()] })
            }
          >
            <Plus aria-hidden="true" />
            Add item
          </Button>
        </fieldset>
        {mode === "receive" ? (
          <InventoryField
            id="movement-reference"
            label="Invoice or reference (optional)"
            error={errorFor("movement-reference")}
          >
            <Input
              id="movement-reference"
              value={draft.referenceNumber}
              onChange={(event) =>
                update({ referenceNumber: event.target.value })
              }
              disabled={disabled}
              maxLength={120}
              aria-invalid={Boolean(errorFor("movement-reference"))}
              aria-describedby={
                errorFor("movement-reference")
                  ? "movement-reference-error"
                  : undefined
              }
            />
          </InventoryField>
        ) : null}
        <InventoryField
          id="movement-notes"
          label="Notes (optional)"
          error={errorFor("movement-notes")}
        >
          <Textarea
            id="movement-notes"
            value={draft.notes}
            onChange={(event) => update({ notes: event.target.value })}
            disabled={disabled}
            maxLength={2000}
            aria-invalid={Boolean(errorFor("movement-notes"))}
            aria-describedby={
              errorFor("movement-notes") ? "movement-notes-error" : undefined
            }
          />
        </InventoryField>
        <p className="text-xs text-muted-foreground">
          All items are saved together. Cancel keeps this draft while you stay
          on this page.
        </p>
      </form>
    </InventoryDrawer>
  );
}

function CentralLocationForm({
  value,
  onChange,
  onClose,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onClear: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  return (
    <InventoryDrawer
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
      title="Add inventory location"
      description="Create central storage for receiving and transferring stock."
      footer={
        <>
          <Button
            variant="ghost"
            className="mr-auto min-h-11"
            disabled={pending}
            onClick={onClear}
          >
            Discard
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="central-location"
            className="min-h-11"
            disabled={pending}
          >
            {pending ? "Creating…" : "Add location"}
          </Button>
        </>
      }
    >
      <form
        id="central-location"
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          setMessage(undefined);
          setAttempt((current) => current + 1);
          if (value.trim().length < 2) {
            setMessage("Enter a location name with at least two characters.");
            return;
          }
          startTransition(async () => {
            try {
              const result = await createCentralInventoryLocationAction({
                name: value,
              });
              if (!result.ok) {
                setMessage(result.error);
                setAttempt((current) => current + 1);
                return;
              }
              toast.success("Inventory location created.");
              onClear();
              router.refresh();
            } catch {
              setMessage(
                "Could not reach the server. Your location name has been kept.",
              );
              setAttempt((current) => current + 1);
            }
          });
        }}
      >
        <WorkflowErrors
          errors={
            message
              ? [
                  {
                    id: "central-location-name",
                    label: "Location name",
                    message,
                  },
                ]
              : []
          }
          attempt={attempt}
          onField={(id) => document.getElementById(id)?.focus()}
        />
        <InventoryField
          id="central-location-name"
          label="Location name"
          error={message}
        >
          <Input
            id="central-location-name"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            required
            minLength={2}
            maxLength={120}
            disabled={pending}
            aria-invalid={Boolean(message)}
            aria-describedby={
              message ? "central-location-name-error" : undefined
            }
            placeholder="Main storage"
          />
        </InventoryField>
      </form>
    </InventoryDrawer>
  );
}
