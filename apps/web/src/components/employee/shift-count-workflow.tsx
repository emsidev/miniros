"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import type { OpeningDraft } from "@/lib/offline/opening-draft";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LockKeyhole, Play } from "lucide-react";
import { toast } from "sonner";
import type { PaymentMethod } from "@miniros/contracts/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumericExpressionInput } from "@/components/ui/numeric-expression-input";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, formatPaymentMethod } from "@/lib/format";
import { numericExpressionToNumber } from "@/lib/numeric-expression";
import {
  startAssignedShiftAction,
  submitShiftCloseoutAction,
} from "@/server/actions/operations";
import { CountRows, CountReview } from "./count-rows";
import {
  countsPayload,
  initialCounts,
  validateCash,
  validateCounts,
  type CountItem,
  type FieldError,
} from "./count-model";
import {
  WorkflowSteps,
  WorkflowErrors,
  WorkflowActions,
} from "./workflow-controls";

export type CloseoutSummary = {
  saleSummary: { grossSalesCents: number; discountsCents: number };
  paymentSummary: readonly { method: PaymentMethod; amountCents: number }[];
  approvedDeductionsCents: number;
};
type Props = {
  shiftId: string;
  items: readonly CountItem[];
  opening?: {
    draft: OpeningDraft;
    onChange: (draft: OpeningDraft) => void;
    onSubmit: (draft: OpeningDraft) => Promise<void>;
  };
} & (
  | { mode: "start"; summary?: never }
  | { mode: "close"; summary: CloseoutSummary }
);

export function ShiftCountWorkflow({
  shiftId,
  items,
  mode,
  summary,
  opening,
}: Props) {
  const router = useRouter();
  const closing = mode === "close";
  const steps = closing
    ? ["Count stock", "Count cash", "Review & close"]
    : ["Count stock", "Review & start"];
  const [step, setStep] = useState(opening?.draft.step ?? 0);
  const [values, setValues] = useState(
    () => opening?.draft.counts ?? initialCounts(items),
  );
  const [query, setQuery] = useState("");
  const [cash, setCash] = useState("");
  const [notes, setNotes] = useState(opening?.draft.notes ?? "");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [isPending, startTransition] = useTransition();
  const submitting = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [ids] = useState(() => ({
    inventoryLocationId: crypto.randomUUID(),
    openingEventId: crypto.randomUUID(),
    closeoutId: crypto.randomUUID(),
    cashReconciliationId: crypto.randomUUID(),
    profitSummaryId: crypto.randomUUID(),
    inventoryEventId: crypto.randomUUID(),
  }));
  const review = step === steps.length - 1;
  const draft = opening?.draft;
  const onDraftChange = opening?.onChange;
  useEffect(() => {
    if (draft && onDraftChange)
      onDraftChange({ ...draft, counts: values, notes, step });
  }, [draft, onDraftChange, values, notes, step]);

  function move(next: number) {
    setStep(next);
    setQuery("");
    setError(undefined);
    requestAnimationFrame(() => titleRef.current?.focus());
  }
  function focusField(id: string) {
    setStep(id === "actualCash" ? 1 : 0);
    setQuery("");
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const invalid = review
      ? [
          ...validateCounts(items, values),
          ...(closing ? validateCash(cash) : []),
        ]
      : step === 0
        ? validateCounts(items, values)
        : validateCash(cash);
    setErrors(invalid);
    setError(undefined);
    if (invalid.length) {
      setAttempt((value) => value + 1);
      return;
    }
    if (!review) {
      move(step + 1);
      return;
    }
    if (!items.length) return;
    submitting.current = true;
    startTransition(async () => {
      try {
        if (!closing && opening) {
          await opening.onSubmit({
            ...opening.draft,
            counts: values,
            notes,
            step,
          });
          toast.success("Shift started. You’re ready to sell.");
          return;
        }
        const counts = countsPayload(items, values);
        const result = closing
          ? await submitShiftCloseoutAction({
              closeoutId: ids.closeoutId,
              cashReconciliationId: ids.cashReconciliationId,
              profitSummaryId: ids.profitSummaryId,
              inventoryEventId: ids.inventoryEventId,
              shiftId,
              actualCashCents: Math.round(
                numericExpressionToNumber(cash) * 100,
              ),
              notes: notes || null,
              counts,
            })
          : await startAssignedShiftAction({
              inventoryLocationId: ids.inventoryLocationId,
              openingEventId: ids.openingEventId,
              shiftId,
              notes: notes || null,
              counts,
            });
        if (!result.ok) {
          setError(result.error);
          setAttempt((value) => value + 1);
          return;
        }
        toast.success(
          closing
            ? "Shift closed. Profit summary is ready."
            : "Shift started. You’re ready to sell.",
        );
        router.replace(`/shifts/${shiftId}`);
        router.refresh();
      } catch (failure) {
        setError(
          opening
            ? failure instanceof Error
              ? failure.message
              : "Couldn't save your opening stock. Check device storage and retry."
            : "Couldn’t reach the server. Your entries are still here. Try again.",
        );
        setAttempt((value) => value + 1);
      } finally {
        submitting.current = false;
      }
    });
  }
  const cashError = errors.find((item) => item.id === "actualCash");
  return (
    <form
      noValidate
      aria-busy={isPending}
      onSubmit={handleSubmit}
      className="mx-auto max-w-3xl space-y-6"
    >
      <WorkflowSteps steps={steps} current={step} />
      <WorkflowErrors
        errors={errors}
        message={error}
        attempt={attempt}
        onField={focusField}
      />
      <div>
        <h2
          ref={titleRef}
          tabIndex={-1}
          className="text-xl font-bold outline-none"
        >
          {review
            ? closing
              ? "Review your closeout"
              : "Ready to start?"
            : step === 0
              ? closing
                ? "Count your remaining stock"
                : "Count your opening stock"
              : "Count the cash you have"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {review
            ? "Check every entry. You can go back to make changes before submitting."
            : step === 0
              ? "Enter the quantity you can physically count. Calculations such as 12 + 6 are supported."
              : "Enter the actual cash counted. Review recorded payments and approved deductions below."}
        </p>
      </div>
      {step === 0 ? (
        <>
          <CountRows
            items={items}
            values={values}
            onChange={(id, value) =>
              setValues((current) => ({ ...current, [id]: value }))
            }
            query={query}
            onQuery={setQuery}
            errors={errors}
            closing={closing}
            disabled={isPending}
          />
          <div className="space-y-2">
            <Label htmlFor="notes">
              {closing ? "Closeout notes" : "Opening notes"}{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="notes"
              maxLength={2000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={isPending}
              placeholder={
                closing
                  ? "Explain stock differences or anything the next team should know."
                  : "Anything to note before selling?"
              }
            />
          </div>
        </>
      ) : null}
      {closing && summary && step > 0 ? (
        <section className="space-y-4" aria-label="Cash reconciliation">
          <dl className="divide-y rounded-xl border bg-card px-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2 py-3">
              <dt>Gross sales</dt>
              <dd className="font-semibold tabular-nums">
                {formatMoney(summary.saleSummary.grossSalesCents)}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-3">
              <dt>Discounts</dt>
              <dd className="font-semibold tabular-nums">
                {formatMoney(summary.saleSummary.discountsCents)}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-3">
              <dt>Approved deductions</dt>
              <dd className="font-semibold tabular-nums">
                {formatMoney(summary.approvedDeductionsCents)}
              </dd>
            </div>
            {summary.paymentSummary.map((payment) => (
              <div
                key={payment.method}
                className="flex flex-wrap justify-between gap-2 py-3"
              >
                <dt>{formatPaymentMethod(payment.method)} payments</dt>
                <dd className="font-semibold tabular-nums">
                  {formatMoney(payment.amountCents)}
                </dd>
              </div>
            ))}
          </dl>
          {!summary.paymentSummary.length ? (
            <p className="text-sm text-muted-foreground">
              No completed payments recorded for this shift.
            </p>
          ) : null}
          {!review ? (
            <div className="space-y-2 rounded-xl border bg-card p-4">
              <Label htmlFor="actualCash">Actual cash counted (₱)</Label>
              <NumericExpressionInput
                id="actualCash"
                name="actualCash"
                value={cash}
                onValueChange={setCash}
                precision={2}
                min="0"
                step="0.01"
                required
                disabled={isPending}
                aria-invalid={!!cashError}
                aria-describedby={cashError ? "actualCash-error" : undefined}
                className="h-12 text-lg font-bold tabular-nums"
              />
              {cashError ? (
                <p id="actualCash-error" className="text-sm text-destructive">
                  {cashError.message}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-wrap justify-between gap-2 rounded-xl bg-foreground p-4 text-background">
              <span>Actual cash counted</span>
              <strong className="text-xl tabular-nums">
                {formatMoney(Math.round(numericExpressionToNumber(cash) * 100))}
              </strong>
            </div>
          )}
        </section>
      ) : null}
      {review ? (
        <section className="space-y-4">
          <h3 className="font-bold">
            {closing ? "Closing" : "Opening"} inventory · {items.length} items
          </h3>
          <CountReview items={items} values={values} />
          {notes ? (
            <div>
              <h3 className="text-sm font-semibold">Notes</h3>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {notes}
              </p>
            </div>
          ) : null}
          {closing ? (
            <p className="rounded-lg bg-warning-surface p-4 text-sm text-warning">
              Submitting this closeout permanently closes the shift and records
              its final inventory, cash, and profit summary.
            </p>
          ) : null}
        </section>
      ) : null}
      {!items.length ? (
        <p className="text-sm text-muted-foreground">
          No inventory items are available. Ask an admin to check the shift
          inventory before continuing.
        </p>
      ) : null}
      <WorkflowActions>
        {step > 0 ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => move(step - 1)}
          >
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
        ) : null}
        <Button
          type="submit"
          size="lg"
          disabled={isPending || !items.length}
          className="min-w-0 flex-1 whitespace-normal sm:flex-none"
        >
          {isPending
            ? closing
              ? "Closing shift…"
              : "Starting shift…"
            : review
              ? closing
                ? "Submit closeout & close shift"
                : "Confirm & start shift"
              : "Continue"}
          {review ? (
            closing ? (
              <LockKeyhole aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )
          ) : (
            <ArrowRight aria-hidden="true" />
          )}
        </Button>
      </WorkflowActions>
    </form>
  );
}
