"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CalendarDays,
  UsersRound,
  ClipboardCheck,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  createAdminShiftAction,
  updateAdminShiftAction,
} from "@/server/actions/admin-shifts";
import {
  moneyToCents,
  type ActionFeedback,
} from "@/app/admin/_components/form-utils";
import {
  fromDateKey,
  datesFromRange,
  datesFromSelection,
} from "@/app/admin/_components/shift-date-utils";
import {
  createShiftSchema,
  updateShiftSchema,
  isValidShiftDate,
  safeShiftReturn,
} from "@/lib/shift-planning";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TeamEditor } from "./team-editor";
import { CostEditor } from "./cost-editor";
import { errorProps, FieldError, ShiftFormFeedback } from "./form-feedback";
import type {
  AdminShift,
  CostLine,
  ShiftSetupOptions,
  TeamMember,
} from "./types";

const steps = [
  { name: "Location & dates", icon: CalendarDays },
  { name: "Team & costs", icon: UsersRound },
  { name: "Review", icon: ClipboardCheck },
];
const inputClass =
  "h-11 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export function PlanningForm({
  locations,
  employees,
  shift,
  initialDate,
  initialLocationId,
  returnTo,
}: ShiftSetupOptions & {
  shift?: AdminShift;
  initialDate: string;
  initialLocationId?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const backTo = safeShiftReturn(returnTo);
  const initialLocation =
    locations.find(
      (item) => item.id === (shift?.sellingLocationId ?? initialLocationId),
    ) ??
    (locations.filter((item) => item.available).length === 1
      ? locations.find((item) => item.available)
      : undefined);
  const [locationId, setLocationId] = useState(initialLocation?.id ?? "");
  const location = locations.find((item) => item.id === locationId);
  const [title, setTitle] = useState(
    shift?.title === shift?.locationName ? "" : (shift?.title ?? ""),
  );
  const [dateMode, setDateMode] = useState<"single" | "range" | "dates">(
    "single",
  );
  const [singleDate, setSingleDate] = useState(shift?.shiftDate ?? initialDate);
  const [range, setRange] = useState<DateRange>();
  const [specificDates, setSpecificDates] = useState<Date[]>([]);
  const [team, setTeam] = useState<TeamMember[]>(
    () =>
      shift?.assignments
        .filter((item) => item.status !== "cancelled")
        .map((item) => ({
          employeeId: item.employeeId,
          roleOnShift: item.roleOnShift,
          salary: (item.salaryRateCents / 100).toFixed(2),
        })) ?? [],
  );
  const [costs, setCosts] = useState<CostLine[]>(() =>
    shift
      ? shift.costs.map((cost) => ({
          key: cost.id,
          id: cost.id,
          costType: cost.costType,
          label: cost.label,
          amount: (cost.amountCents / 100).toFixed(2),
          notes: cost.notes,
        }))
      : [
          {
            key: "rent",
            costType: "rent",
            label: "Rent",
            amount: (
              (initialLocation?.defaultRentalCostCents ?? 0) / 100
            ).toFixed(2),
            notes: null,
          },
          {
            key: "transport",
            costType: "transport",
            label: "Transport",
            amount: (
              (initialLocation?.defaultTransportCostCents ?? 0) / 100
            ).toFixed(2),
            notes: null,
          },
        ],
  );
  const [overrides, setOverrides] = useState<Set<string>>(
    () =>
      new Set(
        shift?.costs
          .filter((cost) => {
            if (cost.costType === "other") return false;
            const matching = shift.costs.filter(
              (item) => item.costType === cost.costType,
            );
            const defaultAmount =
              cost.costType === "rent"
                ? initialLocation?.defaultRentalCostCents
                : initialLocation?.defaultTransportCostCents;
            return matching.length !== 1 || cost.amountCents !== defaultAmount;
          })
          .map((cost) => cost.id) ?? [],
      ),
  );
  const [step, setStep] = useState(0);
  const [feedback, setFeedback] = useState<ActionFeedback>({});
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | undefined>(undefined);
  const submitting = useRef(false);
  const [version] = useState(shift?.updatedAt);
  const dirty = useRef(false);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const selectedDates =
    shift || dateMode === "single"
      ? singleDate
        ? [singleDate]
        : []
      : dateMode === "range"
        ? datesFromRange(range)
        : datesFromSelection(specificDates);
  const assignmentValues = team.map((member) => ({
    employeeId: member.employeeId,
    roleOnShift: member.roleOnShift,
    salaryRateCents: moneyToCents(member.salary),
  }));
  const costValues = costs.map((cost) => ({
    id: cost.id,
    costType: cost.costType,
    label: cost.label,
    amountCents: moneyToCents(cost.amount),
    notes: cost.notes,
  }));
  const pay = assignmentValues.reduce(
    (sum, item) => sum + item.salaryRateCents,
    0,
  );
  const costTotal = costValues.reduce((sum, item) => sum + item.amountCents, 0);
  const total = pay + costTotal;
  const showMoney = (amount: number) =>
    Number.isSafeInteger(amount) && amount >= 0 ? formatMoney(amount) : "—";
  const hasOperator = team.some(
    (item) =>
      item.roleOnShift === "operator" &&
      employees.some(
        (employee) =>
          employee.id === item.employeeId &&
          employee.available &&
          employee.canUsePos,
      ),
  );
  const unavailableTeam = team.some(
    (item) =>
      !employees.some(
        (employee) => employee.id === item.employeeId && employee.available,
      ),
  );
  const isEditing = Boolean(shift);
  const stale = Boolean(shift && shift.updatedAt !== version);

  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty.current) event.preventDefault();
    };
    const linkClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest?.("a[href]");
      if (
        dirty.current &&
        link &&
        !(link as HTMLAnchorElement).hash &&
        !window.confirm("Leave without saving your shift changes?")
      )
        event.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", linkClick, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", linkClick, true);
    };
  }, []);
  function changed() {
    dirty.current = true;
  }
  function changeCosts(value: CostLine[]) {
    setOverrides(
      (current) =>
        new Set([
          ...current,
          ...value
            .filter(
              (cost) =>
                cost.costType !== "other" &&
                costs.find((saved) => saved.key === cost.key)?.amount !==
                  cost.amount,
            )
            .map((cost) => cost.key),
        ]),
    );
    setCosts(value);
    changed();
  }
  function focusField(field: string) {
    if (!isEditing)
      setStep(
        field === "sellingLocationId" ||
          field === "title" ||
          field.startsWith("shiftDate")
          ? 0
          : 1,
      );
    requestAnimationFrame(() => {
      let target = document.getElementById(`field-${field}`);
      if (!target && field.startsWith("assignments."))
        target = document.getElementById(
          `field-${field.replace(/employeeId$/, "roleOnShift")}`,
        );
      target?.focus();
      target?.scrollIntoView({ block: "center", behavior: "instant" });
    });
  }
  function chooseLocation(id: string) {
    const next = locations.find((item) => item.id === id);
    setLocationId(id);
    changed();
    setCosts((current) =>
      current.map((cost) =>
        cost.costType === "other" || overrides.has(cost.key)
          ? cost
          : {
              ...cost,
              amount:
                ((cost.costType === "rent"
                  ? next?.defaultRentalCostCents
                  : next?.defaultTransportCostCents) ?? 0) /
                  100 +
                "",
            },
      ),
    );
  }
  function resetCost(key: string, type: "rent" | "transport") {
    const amount =
      ((type === "rent"
        ? location?.defaultRentalCostCents
        : location?.defaultTransportCostCents) ?? 0) / 100;
    setCosts((current) =>
      current.map((cost) =>
        cost.key === key ? { ...cost, amount: amount.toFixed(2) } : cost,
      ),
    );
    setOverrides(
      (current) => new Set([...current].filter((item) => item !== key)),
    );
    changed();
  }
  function inputValues(intent: "draft" | "publish") {
    requestId.current ??= crypto.randomUUID();
    const shared = {
      sellingLocationId: locationId,
      title,
      assignments: assignmentValues,
      costs: costValues,
      intent,
    };
    return shift
      ? {
          ...shared,
          shiftId: shift.id,
          shiftDate: singleDate,
          expectedUpdatedAt: version!,
        }
      : { ...shared, shiftDates: selectedDates, requestId: requestId.current };
  }
  function validateStep() {
    const errors: Record<string, string[]> = {};
    if (!locationId) errors.sellingLocationId = ["Choose a selling location."];
    if (
      !selectedDates.length ||
      selectedDates.some((date) => !isValidShiftDate(date))
    )
      errors.shiftDates = ["Select at least one valid date."];
    if (selectedDates.length > 366)
      errors.shiftDates = ["Select up to 366 dates at a time."];
    if (title.trim().length > 120)
      errors.title = ["Keep the title within 120 characters."];
    if (step === 1) {
      const result = createShiftSchema.safeParse({
        ...inputValues("draft"),
        shiftDates: selectedDates,
        requestId: requestId.current,
      });
      if (!result.success)
        result.error.issues.forEach((issue) => {
          errors[issue.path.join(".")] = [issue.message];
        });
    }
    if (Object.keys(errors).length) {
      setFeedback({
        error: "Review the highlighted fields.",
        fieldErrors: errors,
      });
      return false;
    }
    setFeedback({});
    return true;
  }
  function save(intent: "draft" | "publish") {
    if (submitting.current) return;
    const values = inputValues(intent);
    const result = shift
      ? updateShiftSchema.safeParse(values)
      : createShiftSchema.safeParse(values);
    if (!result.success) {
      const errors: Record<string, string[]> = {};
      result.error.issues.forEach((issue) => {
        errors[issue.path.join(".")] = [issue.message];
      });
      setFeedback({
        error: "Review the highlighted fields.",
        fieldErrors: errors,
      });
      return;
    }
    submitting.current = true;
    setFeedback({});
    startTransition(async () => {
      try {
        const response = shift
          ? await updateAdminShiftAction(values)
          : await createAdminShiftAction(values);
        if (!response.ok) {
          setFeedback(response);
          return;
        }
        dirty.current = false;
        toast.success(
          shift
            ? "Shift saved."
            : `${selectedDates.length} ${selectedDates.length === 1 ? "shift" : "shifts"} ${intent === "draft" ? "saved as draft" : "published"}.`,
        );
        const id =
          "id" in response.data ? response.data.id : response.data.shiftIds[0];
        if (selectedDates.length === 1 && id)
          router.push(
            `/admin/shifts/${id}?returnTo=${encodeURIComponent(backTo)}`,
          );
        else {
          const destination = new URLSearchParams({
            view: "agenda",
            scope: "open",
            location: locationId,
            from: selectedDates[0]!,
            to: selectedDates.at(-1)!,
          });
          router.push(`/admin/shifts?${destination}`);
        }
        router.refresh();
      } catch {
        setFeedback({
          error:
            "The connection was interrupted. Retry to check and save this same request.",
        });
      } finally {
        submitting.current = false;
      }
    });
  }
  function next(event: FormEvent) {
    event.preventDefault();
    if (isEditing || step === 2) return;
    if (validateStep()) {
      setStep(step + 1);
      requestAnimationFrame(() =>
        document.getElementById("planning-step-heading")?.focus(),
      );
    }
  }
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="-ml-2">
        <Link
          href={
            shift
              ? `/admin/shifts/${shift.id}?returnTo=${encodeURIComponent(backTo)}`
              : backTo
          }
        >
          <ArrowLeft aria-hidden="true" />
          {shift ? "Back to shift" : "Back to shifts"}
        </Link>
      </Button>
      <div>
        <h1 className="text-3xl font-extrabold">
          {isEditing ? "Edit shift" : "Plan shifts"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {isEditing
            ? "Update the plan before the team starts work."
            : "Choose the dates now. Add the team when you’re ready."}
        </p>
      </div>
      {!isEditing && selectedDates.length > 0 && (
        <div className="space-y-2 text-sm" aria-label="Selected shift dates">
          <p className="font-semibold">
            {selectedDates.length}{" "}
            {selectedDates.length === 1 ? "shift" : "shifts"} planned
          </p>
          <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
            {selectedDates.map((date) => (
              <span className="rounded-md bg-muted px-2 py-1" key={date}>
                {isValidShiftDate(date)
                  ? formatDate(date)
                  : "Choose a valid date"}
              </span>
            ))}
          </div>
        </div>
      )}
      {!isEditing && (
        <ol className="flex border-b" aria-label="Create shift progress">
          {steps.map((item, index) => (
            <li key={item.name} className="flex-1">
              <button
                type="button"
                aria-current={step === index ? "step" : undefined}
                disabled={pending || index > step}
                onClick={() => {
                  setStep(index);
                  setFeedback({});
                }}
                className={cn(
                  "flex min-h-14 w-full items-center justify-center gap-2 border-b-2 px-2 py-3 text-sm",
                  step === index
                    ? "border-foreground font-semibold"
                    : "border-transparent text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-xs",
                    index === step
                      ? "bg-foreground text-background"
                      : "bg-muted",
                  )}
                >
                  {index < step ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="hidden sm:inline">{item.name}</span>
                <span className="sm:hidden">
                  {["Dates", "Team", "Review"][index]}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {stale && (
        <div
          role="status"
          className="rounded-lg border bg-warning-surface p-4 text-sm text-warning"
        >
          This shift changed while you were editing. Your entries are kept here.{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => {
              if (
                window.confirm(
                  "Reload the latest shift? This discards your unsaved changes.",
                )
              ) {
                dirty.current = false;
                window.location.reload();
              }
            }}
          >
            Reload latest shift
          </button>{" "}
          before saving.
        </div>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <form
          className="min-w-0 space-y-6 rounded-xl border bg-card p-4 sm:p-6"
          onSubmit={next}
          noValidate
          onChange={changed}
        >
          <div ref={feedbackRef}>
            <ShiftFormFeedback feedback={feedback} onField={focusField} />
          </div>
          {!isEditing && (
            <h2
              id="planning-step-heading"
              tabIndex={-1}
              className="text-xl font-bold outline-none"
            >
              {steps[step]!.name}
            </h2>
          )}
          {(isEditing || step === 0) && (
            <fieldset disabled={pending} className="space-y-5">
              {isEditing && (
                <legend className="mb-4 text-lg font-bold">
                  Location & date
                </legend>
              )}
              <div className="space-y-2">
                <Label htmlFor="field-sellingLocationId">
                  Selling location
                </Label>
                <select
                  className={inputClass}
                  {...errorProps("sellingLocationId", feedback.fieldErrors)}
                  value={locationId}
                  onChange={(event) => chooseLocation(event.target.value)}
                >
                  <option value="">Choose a location</option>
                  {locations
                    .filter((item) => item.available || item.id === locationId)
                    .map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={!item.available}
                      >
                        {item.name}
                        {!item.available ? " (unavailable)" : ""}
                      </option>
                    ))}
                </select>
                <FieldError
                  field="sellingLocationId"
                  errors={feedback.fieldErrors}
                />
                {location && !location.available && (
                  <p className="text-sm text-destructive">
                    This location is unavailable. Choose an active location
                    before publishing.
                  </p>
                )}
                {!locations.some((item) => item.available) && (
                  <p className="text-sm text-muted-foreground">
                    <Link className="underline" href="/admin/locations">
                      Add an active location
                    </Link>{" "}
                    to start planning.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="field-title">
                  Custom title{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  {...errorProps("title", feedback.fieldErrors)}
                  className="h-11"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={location?.name ?? "Uses the location name"}
                  maxLength={120}
                />
                <FieldError field="title" errors={feedback.fieldErrors} />
              </div>
              <div className="space-y-3" id="field-shiftDates" tabIndex={-1}>
                {!isEditing && (
                  <div
                    role="group"
                    aria-label="Choose dates by"
                    className="flex flex-wrap gap-2"
                  >
                    {(
                      [
                        ["single", "One date"],
                        ["range", "Date range"],
                        ["dates", "Specific dates"],
                      ] as const
                    ).map(([value, label]) => (
                      <Button
                        key={value}
                        type="button"
                        variant={dateMode === value ? "default" : "outline"}
                        onClick={() => {
                          setDateMode(value);
                          changed();
                        }}
                        aria-pressed={dateMode === value}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                )}
                {isEditing || dateMode === "single" ? (
                  <div className="space-y-2">
                    <Label htmlFor="field-shiftDate">Shift date</Label>
                    <Input
                      {...errorProps("shiftDate", feedback.fieldErrors)}
                      type="date"
                      className="h-11 max-w-xs"
                      value={singleDate}
                      onChange={(event) => setSingleDate(event.target.value)}
                    />
                    <FieldError
                      field="shiftDate"
                      errors={feedback.fieldErrors}
                    />
                  </div>
                ) : (
                  <div className="w-fit max-w-full rounded-lg border">
                    {dateMode === "range" ? (
                      <Calendar
                        mode="range"
                        selected={range}
                        onSelect={(value) => {
                          setRange(value);
                          changed();
                        }}
                        defaultMonth={fromDateKey(initialDate)}
                      />
                    ) : (
                      <Calendar
                        mode="multiple"
                        selected={specificDates}
                        onSelect={(value) => {
                          setSpecificDates(value ?? []);
                          changed();
                        }}
                        defaultMonth={fromDateKey(initialDate)}
                      />
                    )}
                  </div>
                )}
                <FieldError field="shiftDates" errors={feedback.fieldErrors} />
                <p className="text-sm font-semibold" aria-live="polite">
                  {selectedDates.length}{" "}
                  {selectedDates.length === 1 ? "shift" : "shifts"} selected
                  {!isEditing && selectedDates.length > 1
                    ? " · one separate shift per date"
                    : ""}
                </p>
                {selectedDates.length > 1 && (
                  <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                    {selectedDates.map((date) => (
                      <span
                        key={date}
                        className="rounded-md bg-muted px-2 py-1 text-sm"
                      >
                        {formatDate(date)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </fieldset>
          )}
          {(isEditing || step === 1) && (
            <>
              <TeamEditor
                employees={employees}
                team={team}
                onChange={(value) => {
                  setTeam(value);
                  changed();
                }}
                disabled={pending}
                errors={feedback.fieldErrors}
              />
              <hr />
              <CostEditor
                costs={costs}
                location={location}
                onChange={changeCosts}
                disabled={pending}
                errors={feedback.fieldErrors}
                onReset={resetCost}
              />
            </>
          )}
          {!isEditing && step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold break-words">
                  {title.trim() || location?.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {location?.name}
                </p>
                <div className="mt-3 flex max-h-44 flex-wrap gap-2 overflow-y-auto">
                  {selectedDates.map((date) => (
                    <span
                      className="rounded-md bg-muted px-2 py-1 text-sm"
                      key={date}
                    >
                      {formatDate(date)}
                    </span>
                  ))}
                </div>
              </div>
              <section>
                <h3 className="mb-2 font-semibold">Team for each shift</h3>
                {team.length ? (
                  <ul className="divide-y">
                    {team.map((member) => (
                      <li
                        key={member.employeeId}
                        className="flex items-start justify-between gap-3 py-3 text-sm"
                      >
                        <span className="min-w-0 break-words">
                          {employees.find(
                            (item) => item.id === member.employeeId,
                          )?.displayName ?? "Unavailable employee"}
                          <span className="block text-muted-foreground">
                            {member.roleOnShift === "operator"
                              ? "POS operator"
                              : member.roleOnShift}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {showMoney(moneyToCents(member.salary))}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No staff assigned. Save as draft and add the team later.
                  </p>
                )}
              </section>
              <section>
                <h3 className="mb-2 font-semibold">Costs for each shift</h3>
                <dl className="space-y-3 text-sm">
                  {costs.map((cost) => (
                    <div
                      className="flex items-start justify-between gap-3"
                      key={cost.key}
                    >
                      <dt className="break-words">{cost.label}</dt>
                      <dd className="shrink-0 font-semibold tabular-nums">
                        {showMoney(moneyToCents(cost.amount))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
              <p className="rounded-lg bg-muted p-4 text-sm">
                Publishing makes{" "}
                {selectedDates.length === 1 ? "this shift" : "these shifts"}{" "}
                visible in the assigned employees’ schedules. Drafts are visible
                only to admins.
              </p>
              {(!hasOperator || unavailableTeam || !location?.available) && (
                <p className="text-sm text-warning">
                  {!location?.available ? "Choose an active location. " : ""}
                  {unavailableTeam ? "Replace unavailable employees. " : ""}
                  {!hasOperator
                    ? "Add a POS operator before publishing. You can save a draft now."
                    : ""}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            {!isEditing && step > 0 ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setStep(step - 1);
                  setFeedback({});
                }}
              >
                <ArrowLeft aria-hidden="true" />
                Back
              </Button>
            ) : (
              <span />
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              {(!shift || shift.status === "draft") && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    pending || !locationId || !selectedDates.length || stale
                  }
                  onClick={() => save("draft")}
                >
                  {pending ? "Saving…" : "Save draft"}
                </Button>
              )}
              {!isEditing && step < 2 ? (
                <Button type="submit" disabled={pending}>
                  Continue
                  <ArrowRight aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={pending || stale}
                  onClick={() => save("publish")}
                >
                  {pending
                    ? "Saving…"
                    : isEditing
                      ? shift?.status === "draft"
                        ? "Save & publish"
                        : "Save changes"
                      : `Publish ${selectedDates.length} ${selectedDates.length === 1 ? "shift" : "shifts"}`}
                </Button>
              )}
            </div>
          </div>
        </form>
        <aside
          className="space-y-4 rounded-xl border bg-card p-5 lg:sticky lg:top-24"
          aria-label="Shift plan summary"
        >
          <h2 className="font-bold">Your plan</h2>
          <div>
            <p className="break-words font-semibold">
              {title.trim() || location?.name || "Choose a location"}
            </p>
            <p className="text-sm text-muted-foreground">
              {selectedDates.length}{" "}
              {selectedDates.length === 1 ? "date" : "dates"} · {team.length}{" "}
              {team.length === 1 ? "person" : "people"} per shift
            </p>
          </div>
          <dl className="space-y-3 border-t pt-4 text-sm">
            <div className="flex justify-between gap-3">
              <dt>Staff pay</dt>
              <dd className="tabular-nums">{showMoney(pay)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Planned costs</dt>
              <dd className="tabular-nums">{showMoney(costTotal)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t pt-3 font-bold">
              <dt>Per shift</dt>
              <dd className="tabular-nums">{showMoney(total)}</dd>
            </div>
            {selectedDates.length > 1 && (
              <div className="flex justify-between gap-3 font-bold">
                <dt>All {selectedDates.length} shifts</dt>
                <dd className="tabular-nums">
                  {showMoney(total * selectedDates.length)}
                </dd>
              </div>
            )}
          </dl>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Planned operating costs include staff pay. Product costs and actual
            deductions are added during closeout.
          </p>
        </aside>
      </div>
    </div>
  );
}
