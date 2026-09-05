"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NumericExpressionInput } from "@/components/ui/numeric-expression-input";
import {
  InventoryDrawer,
  InventoryField,
  SearchSelect,
} from "@/components/inventory/controls";
import { WorkflowErrors } from "@/components/employee/workflow-controls";
import {
  adjustmentDelta,
  inventoryFieldErrors,
  positiveAmount,
  validateAdjustmentDraft,
  validateCashDraft,
  type AdjustmentDraft,
  type CashDraft,
  type InventoryFormError,
} from "@/lib/inventory-forms";
import { formatDate, formatMoney, formatQuantity } from "@/lib/format";
import {
  submitCashDeductionAction,
  submitInventoryAdjustmentAction,
} from "@/server/actions/operations";
import type { InventorySelection } from "@/server/services/inventory-workspace";

export function RequestForms({
  selection,
  mode,
  cash,
  adjustment,
  onCashChange,
  onAdjustmentChange,
  onClose,
  onSaved,
  onDiscard,
  approvalsEnabled,
}: {
  selection: InventorySelection;
  mode: "cash" | "adjustment";
  cash: CashDraft;
  adjustment: AdjustmentDraft;
  onCashChange: (draft: CashDraft) => void;
  onAdjustmentChange: (draft: AdjustmentDraft) => void;
  onClose: () => void;
  onSaved: () => void;
  onDiscard: () => void;
  approvalsEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<InventoryFormError[]>([]);
  const [message, setMessage] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const isCash = mode === "cash";
  const uncertain = Boolean(isCash ? cash.uncertain : adjustment.uncertain);
  const setUncertain = (value: boolean) =>
    isCash
      ? onCashChange({ ...cash, uncertain: value })
      : onAdjustmentChange({ ...adjustment, uncertain: value });
  const item = selection.items.find(
    (item) => item.inventoryItemId === adjustment.inventoryItemId,
  );
  const delta = adjustmentDelta(adjustment.direction, adjustment.quantity);
  const amount = positiveAmount(cash.amount, 2);
  const disabled = pending || uncertain || !selection.canRecord;
  const errorFor = (id: string) =>
    errors.find((error) => error.id === id)?.message;
  const fieldProps = (id: string) => ({
    id,
    disabled,
    "aria-invalid": Boolean(errorFor(id)),
    "aria-describedby": errorFor(id) ? `${id}-error` : undefined,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !selection.canRecord) return;
    const issues = uncertain
      ? []
      : isCash
        ? validateCashDraft(cash)
        : validateAdjustmentDraft(
            adjustment,
            selection.items,
            approvalsEnabled,
          );
    setErrors(issues);
    setMessage(undefined);
    setAttempt((value) => value + 1);
    if (issues.length) return;
    startTransition(async () => {
      try {
        const result = isCash
          ? await submitCashDeductionAction({
              deductionId: cash.id,
              shiftId: selection.shift.id,
              label: cash.label,
              amountCents: Math.round(amount! * 100),
              reason: cash.reason || null,
            })
          : await submitInventoryAdjustmentAction({
              adjustmentId: adjustment.id,
              inventoryEventId: adjustment.eventId,
              shiftId: selection.shift.id,
              inventoryItemId: adjustment.inventoryItemId,
              quantityDelta: delta!.toFixed(3),
              reason: adjustment.reason,
            });
        if (!result.ok) {
          setUncertain(false);
          setErrors(
            inventoryFieldErrors(
              result.fieldErrors,
              isCash
                ? {
                    label: { id: "cash-purpose", label: "Purpose" },
                    amountCents: { id: "cash-amount", label: "Amount" },
                    reason: { id: "cash-notes", label: "Notes" },
                  }
                : {
                    inventoryItemId: {
                      id: "adjustment-item",
                      label: "Inventory item",
                    },
                    quantityDelta: {
                      id: "adjustment-quantity",
                      label: "Quantity",
                    },
                    reason: { id: "adjustment-reason", label: "Reason" },
                  },
            ),
          );
          setMessage(
            selection.items.reduce(
              (text, item) => text.replaceAll(item.inventoryItemId, item.name),
              result.error,
            ),
          );
          setAttempt((value) => value + 1);
          return;
        }
        toast.success(
          result.data.status === "pending"
            ? "Request sent for approval."
            : isCash
              ? "Cash deduction recorded."
              : "Stock adjustment recorded.",
        );
        onSaved();
        router.refresh();
      } catch {
        setUncertain(true);
        setMessage(
          "The connection was interrupted. Retry this same entry to check whether it was saved. Your entries are still here.",
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
      title={isCash ? "Cash deduction" : "Adjust stock"}
      description={`${selection.shift.title ? `${selection.shift.title} · ` : ""}${selection.shift.locationName} · ${formatDate(selection.shift.shiftDate)}`}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={onDiscard}
            disabled={pending || uncertain}
            className="mr-auto min-h-11"
          >
            Discard
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={pending}
            className="min-h-11"
          >
            Cancel
          </Button>
          <Button
            form="inventory-request"
            type="submit"
            disabled={pending || !selection.canRecord}
            className="min-h-11"
          >
            {pending
              ? "Saving…"
              : uncertain
                ? "Retry entry"
                : approvalsEnabled
                  ? "Submit request"
                  : isCash && amount
                    ? `Record ${formatMoney(Math.round(amount * 100))}`
                    : "Save adjustment"}
          </Button>
        </>
      }
    >
      <form
        id="inventory-request"
        onSubmit={submit}
        noValidate
        className="space-y-5"
      >
        <WorkflowErrors
          errors={errors}
          message={
            message ??
            (uncertain
              ? "Retry this entry to check whether it was saved before making changes."
              : undefined)
          }
          attempt={attempt}
          onField={(id) => document.getElementById(id)?.focus()}
        />
        <p className="rounded-lg bg-muted p-3 text-sm">
          {approvalsEnabled
            ? "An admin reviews this request before it changes this shift’s records."
            : "This change will be recorded immediately for this shift."}
        </p>
        {!selection.canRecord ? (
          <p role="alert" className="text-sm text-destructive">
            This shift is now read-only. Your unsaved entry has been kept.
          </p>
        ) : null}
        {isCash ? (
          <>
            <InventoryField
              id="cash-purpose"
              label="What was the cash used for?"
              error={errorFor("cash-purpose")}
            >
              <Input
                {...fieldProps("cash-purpose")}
                value={cash.label}
                onChange={(event) =>
                  onCashChange({ ...cash, label: event.target.value })
                }
                required
                maxLength={120}
                placeholder="Ice delivery"
              />
            </InventoryField>
            <InventoryField
              id="cash-amount"
              label="Amount (₱)"
              error={errorFor("cash-amount")}
            >
              <NumericExpressionInput
                {...fieldProps("cash-amount")}
                value={cash.amount}
                onValueChange={(amount) => onCashChange({ ...cash, amount })}
                precision={2}
                min="0.01"
                clearOnFirstFocus={false}
                required
                placeholder="0.00"
              />
            </InventoryField>
            <InventoryField
              id="cash-notes"
              label="Notes (optional)"
              error={errorFor("cash-notes")}
            >
              <Textarea
                {...fieldProps("cash-notes")}
                value={cash.reason}
                onChange={(event) =>
                  onCashChange({ ...cash, reason: event.target.value })
                }
                disabled={disabled}
                maxLength={2000}
              />
            </InventoryField>
          </>
        ) : (
          <>
            <SearchSelect
              id="adjustment-item"
              label="Inventory item"
              value={adjustment.inventoryItemId}
              disabled={disabled}
              error={errorFor("adjustment-item")}
              options={selection.items.map((item) => ({
                value: item.inventoryItemId,
                label: item.name,
                detail: `${formatQuantity(item.quantityOnHand)} ${item.unit} on hand`,
              }))}
              onChange={(inventoryItemId) =>
                onAdjustmentChange({ ...adjustment, inventoryItemId })
              }
              placeholder="Search inventory…"
            />
            <fieldset className="space-y-2" disabled={disabled}>
              <legend className="mb-2 text-sm font-medium">
                What changed?
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(["add", "remove"] as const).map((direction) => (
                  <label
                    key={direction}
                    className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 text-sm font-semibold ${adjustment.direction === direction ? "border-foreground bg-muted" : "bg-card"}`}
                  >
                    <input
                      type="radio"
                      name="direction"
                      value={direction}
                      checked={adjustment.direction === direction}
                      onChange={() =>
                        onAdjustmentChange({ ...adjustment, direction })
                      }
                    />
                    {direction === "add" ? "Add stock" : "Remove stock"}
                  </label>
                ))}
              </div>
            </fieldset>
            <InventoryField
              id="adjustment-quantity"
              label={`Quantity${item ? ` (${item.unit})` : ""}`}
              error={errorFor("adjustment-quantity")}
            >
              <NumericExpressionInput
                {...fieldProps("adjustment-quantity")}
                value={adjustment.quantity}
                onValueChange={(quantity) =>
                  onAdjustmentChange({ ...adjustment, quantity })
                }
                precision={3}
                min="0.001"
                clearOnFirstFocus={false}
                required
                placeholder="Enter a positive quantity"
              />
            </InventoryField>
            {item ? (
              <dl
                className="space-y-2 border-y py-3 text-sm"
                aria-live="polite"
              >
                <div className="flex justify-between gap-3">
                  <dt>Current stock</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatQuantity(item.quantityOnHand)} {item.unit}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>
                    {approvalsEnabled ? "After approval" : "After this change"}
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {delta === null
                      ? "—"
                      : `${formatQuantity(Number(item.quantityOnHand) + delta)} ${item.unit}`}
                  </dd>
                </div>
              </dl>
            ) : null}
            <InventoryField
              id="adjustment-reason"
              label="Reason"
              error={errorFor("adjustment-reason")}
            >
              <Textarea
                {...fieldProps("adjustment-reason")}
                value={adjustment.reason}
                onChange={(event) =>
                  onAdjustmentChange({
                    ...adjustment,
                    reason: event.target.value,
                  })
                }
                required
                maxLength={2000}
                placeholder="For example: damaged cups or a stock count correction"
              />
            </InventoryField>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Cancel keeps this draft while you stay in Inventory. Discard clears
          it.
        </p>
      </form>
    </InventoryDrawer>
  );
}
