"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LockKeyhole, Play } from "lucide-react";
import type { PaymentMethod } from "@miniros/contracts/constants";
import type { OpeningDraft } from "@/lib/offline/opening-draft";
import type { ClosingDraft } from "@/lib/offline/count-draft";
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
  openingCashCents?: number;
};
type Persistence<T extends OpeningDraft> = {
  draft: T;
  onChange: (draft: T) => Promise<void> | void;
  onSubmit: (draft: T) => Promise<void>;
};
type Props = {
  shiftId: string;
  items: readonly CountItem[];
  legacyFloat?: boolean;
  opening?: Persistence<OpeningDraft>;
  closeout?: Persistence<ClosingDraft>;
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
  closeout,
  legacyFloat = false,
}: Props) {
  const router = useRouter();
  const closing = mode === "close";
  const persistence = opening ?? closeout;
  const draft = persistence?.draft;
  const steps = [
    "Stock",
    "Cash",
    closing ? "Review & close" : "Review & start",
  ];
  const [step, setStep] = useState(draft?.step ?? 0);
  const [values, setValues] = useState(
    () => draft?.counts ?? initialCounts(items),
  );
  const [query, setQuery] = useState(draft?.query ?? "");
  const [category, setCategory] = useState(draft?.category ?? "all");
  const [uncounted, setUncounted] = useState(draft?.uncounted ?? false);
  const [cash, setCash] = useState(draft?.cash ?? "");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [saved, setSaved] = useState(false);
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
  const onOpeningChange = opening?.onChange;
  const onClosingChange = closeout?.onChange;
  useEffect(() => {
    if (!draft || submitting.current) return;
    let current = true;
    setSaved(false);
    const next = {
      ...draft,
      counts: values,
      cash,
      notes,
      step,
      query,
      category,
      uncounted,
    };
    const save = onClosingChange
      ? onClosingChange(next as ClosingDraft)
      : onOpeningChange?.(next);
    Promise.resolve(save).then(
      () => {
        if (current) setSaved(true);
      },
      () => {
        if (current)
          setError(
            "Latest entries could not be saved. Free device storage and retry before leaving.",
          );
      },
    );
    return () => {
      current = false;
    };
  }, [
    draft,
    onOpeningChange,
    onClosingChange,
    values,
    cash,
    notes,
    step,
    query,
    category,
    uncounted,
  ]);
  const review = step === 2;
  function move(next: number) {
    setStep(next);
    setErrors([]);
    setError(undefined);
    requestAnimationFrame(() => titleRef.current?.focus());
  }
  function focusField(id: string) {
    setStep(id === "actualCash" ? 1 : 0);
    setQuery("");
    setCategory("all");
    setUncounted(false);
    requestAnimationFrame(() => document.getElementById(id)?.focus());
  }
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const invalid = review
      ? [...validateCounts(items, values), ...validateCash(cash)]
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
    submitting.current = true;
    startTransition(async () => {
      try {
        const next = {
          ...draft,
          counts: values,
          cash,
          notes,
          step,
          query,
          category,
          uncounted,
        };
        if (closing && closeout) {
          await closeout.onSubmit(next as ClosingDraft);
          return;
        }
        if (!closing && opening) {
          await opening.onSubmit(next as OpeningDraft);
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
              openingCashCents: Math.round(
                numericExpressionToNumber(cash) * 100,
              ),
              notes: notes || null,
              counts,
            });
        if (!result.ok) throw new Error(result.error);
        router.replace(`/shifts/${shiftId}`);
        router.refresh();
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "This count could not be saved. Keep this screen open and retry.",
        );
        setAttempt((value) => value + 1);
      } finally {
        submitting.current = false;
      }
    });
  }
  const cashError = errors.find((item) => item.id === "actualCash");
  const expectedCash =
    (summary?.openingCashCents ?? 0) +
    (summary?.paymentSummary.find((payment) => payment.method === "cash")
      ?.amountCents ?? 0) -
    (summary?.approvedDeductionsCents ?? 0);
  return (
    <form
      noValidate
      aria-busy={isPending}
      onSubmit={handleSubmit}
      className="mx-auto max-w-3xl space-y-4 pb-6"
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
          className="rounded-md text-xl font-bold focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {review
            ? closing
              ? "Review your closeout"
              : "Ready to start selling?"
            : step === 0
              ? closing
                ? "Count remaining stock"
                : "Count opening stock"
              : closing
                ? "Count cash in the drawer"
                : "Enter opening cash float"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {review
            ? "Check actual counts and differences before confirming."
            : step === 0
              ? "Count what you have. Blank is uncounted; enter zero."
              : closing
                ? "Count all cash, including the opening float."
                : "Cash already in the drawer for change. Enter zero if none."}
        </p>
      </div>
      {step === 0 ? (
        <CountRows
          items={items}
          values={values}
          onChange={(id, value) =>
            setValues((current) => ({ ...current, [id]: value }))
          }
          query={query}
          onQuery={setQuery}
          category={category}
          onCategory={setCategory}
          uncounted={uncounted}
          onUncounted={setUncounted}
          errors={errors}
          closing={closing}
          disabled={isPending}
        />
      ) : null}
      {step === 1 ? (
        <section className="space-y-4" aria-label="Cash count">
          {closing && summary ? (
            <dl className="divide-y border-y text-sm">
              <div className="flex justify-between gap-3 py-3">
                <dt>Opening float</dt>
                <dd>{formatMoney(summary.openingCashCents ?? 0)}</dd>
              </div>
              {summary.paymentSummary.map((payment) => (
                <div
                  key={payment.method}
                  className="flex justify-between gap-3 py-3"
                >
                  <dt>{formatPaymentMethod(payment.method)} sales</dt>
                  <dd>{formatMoney(payment.amountCents)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 py-3">
                <dt>Applicable cash expenses</dt>
                <dd>{formatMoney(summary.approvedDeductionsCents)}</dd>
              </div>
              <div className="flex justify-between gap-3 py-3 font-bold">
                <dt>Expected cash</dt>
                <dd>{formatMoney(expectedCash)}</dd>
              </div>
            </dl>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="actualCash">
              {closing ? "Actual cash counted (₱)" : "Opening cash float (₱)"}
            </Label>
            <NumericExpressionInput
              id="actualCash"
              name="actualCash"
              value={cash}
              onValueChange={setCash}
              precision={2}
              min="0"
              step="0.01"
              required
              disabled={isPending || legacyFloat}
              aria-invalid={!!cashError}
              aria-describedby={cashError ? "actualCash-error" : undefined}
              className="h-12 text-lg font-bold tabular-nums"
            />
            {cashError ? (
              <p
                role="alert"
                id="actualCash-error"
                className="text-sm text-destructive"
              >
                {cashError.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              maxLength={2000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={isPending}
            />
          </div>
        </section>
      ) : null}
      {review ? (
        <section className="space-y-4">
          <dl className="divide-y border-y">
            <div className="flex justify-between gap-3 py-4">
              <dt>{closing ? "Actual cash" : "Opening float"}</dt>
              <dd className="font-bold tabular-nums">
                {formatMoney(Math.round(numericExpressionToNumber(cash) * 100))}
              </dd>
            </div>
            {closing ? (
              <div className="flex justify-between gap-3 py-4">
                <dt>Cash difference</dt>
                <dd className="font-bold tabular-nums">
                  {formatMoney(
                    Math.round(numericExpressionToNumber(cash) * 100) -
                      expectedCash,
                  )}
                </dd>
              </div>
            ) : null}
          </dl>
          <h3 className="font-bold">Actual stock · {items.length} items</h3>
          <CountReview items={items} values={values} closing={closing} />
          {notes ? (
            <p className="whitespace-pre-wrap break-words text-sm">{notes}</p>
          ) : null}
          {closing ? (
            <p className="rounded-lg bg-warning-surface p-4 text-sm text-warning">
              Confirming closes this shift on this device. Uploads and required
              owner reviews continue separately.
            </p>
          ) : null}
        </section>
      ) : null}
      {persistence ? (
        <p role="status" className="text-sm text-muted-foreground">
          {saved ? "Saved on this device" : "Saving entries…"}
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
        <Button type="submit" size="lg" disabled={isPending}>
          {review ? (
            closing ? (
              <LockKeyhole aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )
          ) : (
            <ArrowRight aria-hidden="true" />
          )}
          {isPending
            ? "Saving…"
            : review
              ? closing
                ? "Confirm & close shift"
                : "Start selling"
              : step === 0
                ? "Continue to cash"
                : "Review counts"}
        </Button>
      </WorkflowActions>
    </form>
  );
}
