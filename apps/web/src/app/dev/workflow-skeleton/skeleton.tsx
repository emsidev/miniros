"use client";

import { useMemo, useState } from "react";
import {
  countFromText,
  editOpeningCount,
  transitionStaff,
  transitionPrep,
  type PrepOrderState,
  validateOwnerSchedule,
  type CountAnswer,
  type OwnerScheduleDraft,
  type StaffWorkflow,
} from "@miniros/contracts";

type Scenario = "ready" | "loading" | "missing" | "offline" | "interrupted";
type StaffView = "join" | "pack" | "count" | "sell-prep" | "close";
type OwnerView = "setup" | "schedule";
type CountCategory = "all" | "ingredients" | "packaging";

const scheduleSeed: OwnerScheduleDraft = {
  date: "2026-09-12",
  openingTime: "09:00",
  closingTime: "18:00",
  venue: "Saturday Market Hall",
  address: "18 Riverside Walk, Makati",
  cashierId: "Mika Santos",
  prepId: "Noel Cruz",
};
const countSeed: Record<string, CountAnswer> = {
  Milk: { kind: "uncounted" },
  "Paper cups": { kind: "counted", quantity: 0 },
  "Oat milk": { kind: "not-brought" },
  "Coffee beans": { kind: "counted", quantity: 2 },
};
const rawSeed: Record<string, string> = {
  Milk: "",
  "Paper cups": "0",
  "Oat milk": "",
  "Coffee beans": "2",
};
const categories: Record<string, Exclude<CountCategory, "all">> = {
  Milk: "ingredients",
  "Oat milk": "ingredients",
  "Coffee beans": "ingredients",
  "Paper cups": "packaging",
};
const baseWorkflow: StaffWorkflow = {
  state: "opening-count",
  cashierInstallationId: "walkthrough-cashier",
  authorityEpoch: 1,
  openingSealed: false,
};

function label(answer: CountAnswer) {
  return answer.kind === "uncounted"
    ? "Uncounted"
    : answer.kind === "not-brought"
      ? "Not brought"
      : answer.quantity === 0
        ? "Counted zero"
        : `${answer.quantity} counted`;
}
function Notice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warn" | "danger";
}) {
  const style = {
    info: "border-info/30 bg-info-surface text-info",
    warn: "border-warning/30 bg-warning-surface text-warning",
    danger: "border-destructive/30 bg-destructive-surface text-destructive",
  }[tone];
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${style}`}>
      {children}
    </div>
  );
}
function Button({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`min-h-12 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
function Card({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
function Panel({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-sm font-bold tracking-[0.14em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-2xl font-extrabold">{title}</h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">{text}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function WorkflowSkeleton() {
  const [prepState, setPrepState] = useState<PrepOrderState>("new");
  const [persona, setPersona] = useState<"owner" | "staff">("owner");
  const [ownerView, setOwnerView] = useState<OwnerView>("setup");
  const [staffView, setStaffView] = useState<StaffView>("join");
  const [scenario, setScenario] = useState<Scenario>("ready");
  const [schedule, setSchedule] = useState(scheduleSeed);
  const [counts, setCounts] = useState(countSeed);
  const [raw, setRaw] = useState(rawSeed);
  const [countErrors, setCountErrors] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "uncounted">("all");
  const [category, setCategory] = useState<CountCategory>("all");
  const [search, setSearch] = useState("");
  const [openingReviewed, setOpeningReviewed] = useState(false);
  const [suppliesResolved, setSuppliesResolved] = useState(false);
  const [message, setMessage] = useState(
    "Preview only. No action has been sent.",
  );
  const unresolved = Object.values(counts).filter(
    (value) => value.kind === "uncounted",
  ).length;
  const rows = useMemo(
    () =>
      Object.entries(counts).filter(
        ([name, value]) =>
          name.toLowerCase().includes(search.toLowerCase()) &&
          (filter === "all" || value.kind === "uncounted") &&
          (category === "all" || categories[name] === category),
      ),
    [category, counts, filter, search],
  );
  const guard = {
    installationId: "walkthrough-cashier",
    authorityEpoch: 1,
    snapshotReady: scenario === "ready",
    checklistResolved: suppliesResolved,
    counts: Object.values(counts),
    openingReviewed,
    closeReviewed: true,
    prepResolved: true,
  };
  const states: Record<StaffView, StaffWorkflow["state"]> = {
    join: "scheduled",
    pack: "packing",
    count: "opening-count",
    "sell-prep": "open",
    close: "closing-draft",
  };
  function reset() {
    setPrepState("new");
    setSchedule(scheduleSeed);
    setCounts(countSeed);
    setRaw(rawSeed);
    setCountErrors({});
    setOpeningReviewed(false);
    setSuppliesResolved(false);
    setMessage(
      "Preview reloaded. Fixture text and unsaved states were discarded.",
    );
  }
  function preview(next: Parameters<typeof transitionStaff>[1]) {
    if (next === "open" && Object.values(countErrors).some(Boolean))
      return setMessage(
        "Resolve invalid or interrupted count edits before reviewing opening.",
      );
    if (scenario === "interrupted")
      return setMessage(
        "Interrupted save demonstration. No preview action was completed, saved, or sent.",
      );
    try {
      transitionStaff(
        {
          ...baseWorkflow,
          state: states[staffView],
          openingSealed: staffView === "sell-prep" || staffView === "close",
        },
        next,
        guard,
      );
      setMessage(
        `Preview: ${next.replaceAll("-", " ")} is allowed. It is not saved or sent.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "This preview action could not continue.",
      );
    }
  }
  function update(name: string, text: string) {
    setOpeningReviewed(false);
    setCountErrors((value) => ({
      ...value,
      [name]: "Edit has not been applied.",
    }));
    setRaw((value) => ({ ...value, [name]: text }));
    if (scenario === "interrupted")
      return setMessage(
        "Interrupted edit demonstration. The typed value remains visible but was not applied or saved.",
      );
    try {
      const next = editOpeningCount(baseWorkflow, guard, countFromText(text));
      setCountErrors((value) => ({ ...value, [name]: "" }));
      setOpeningReviewed(false);
      setCounts((value) => ({ ...value, [name]: next }));
      setMessage(
        `Preview: ${name} is ${label(next).toLowerCase()}. Nothing is saved.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Count validation failed.",
      );
    }
  }
  function notBrought(name: string) {
    if (scenario === "interrupted")
      return setMessage(
        "Interrupted edit demonstration. This declaration was not applied or saved.",
      );
    try {
      const next = editOpeningCount(baseWorkflow, guard, {
        kind: "not-brought",
      });
      setCountErrors((value) => ({ ...value, [name]: "" }));
      setOpeningReviewed(false);
      setCounts((value) => ({ ...value, [name]: next }));
      setRaw((value) => ({ ...value, [name]: "" }));
      setMessage(`Preview: ${name} is marked not brought. Nothing is saved.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Count validation failed.",
      );
    }
  }
  function schedulePreview(event: React.FormEvent) {
    event.preventDefault();
    if (scenario === "interrupted")
      return setMessage(
        "Interrupted save demonstration. The schedule remains unsaved.",
      );
    try {
      validateOwnerSchedule(schedule);
      setMessage(
        "Preview: the schedule fields are valid. This walkthrough never saves a schedule.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Schedule validation failed.",
      );
    }
  }
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-5">
        <Notice tone="warn">
          <strong>
            Development walkthrough — simulated data. Nothing is saved or sent.
          </strong>
        </Notice>
        <header className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              MINIROS / EP01
            </p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
              Shift walkthrough
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Explore the proposed owner and staff flow with fixture-only
              actions.
            </p>
          </div>
          <div
            className="flex rounded-xl bg-muted p-1"
            aria-label="Walkthrough role"
          >
            {(["owner", "staff"] as const).map((role) => (
              <button
                key={role}
                onClick={() => setPersona(role)}
                className={`min-h-12 rounded-lg px-4 text-sm font-bold capitalize ${persona === role ? "bg-card shadow-sm" : "text-muted-foreground"}`}
              >
                {role}
              </button>
            ))}
          </div>
        </header>
        <section
          className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-4"
          aria-label="Demonstration state"
        >
          <span className="mr-1 text-sm font-bold">Demonstrate:</span>
          {(
            ["ready", "loading", "missing", "offline", "interrupted"] as const
          ).map((state) => (
            <button
              key={state}
              onClick={() => setScenario(state)}
              className={`min-h-12 rounded-lg border px-3 text-sm capitalize ${scenario === state ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
            >
              {state}
            </button>
          ))}
          <button
            onClick={reset}
            className="min-h-12 rounded-lg border px-3 text-sm font-bold"
          >
            Reload fixture
          </button>
        </section>
        {scenario === "loading" && (
          <Notice>
            Loading fixture data… This is a navigable loading demonstration, not
            a live request.
          </Notice>
        )}
        {scenario === "missing" && (
          <Notice tone="danger">
            Catalog unavailable in this fixture. Selling controls stay
            unavailable until a prepared catalog exists.
          </Notice>
        )}
        {scenario === "offline" && (
          <Notice tone="warn">
            Offline demonstration: a prepared preview can continue locally; no
            sync result is implied.
          </Notice>
        )}
        {scenario === "interrupted" && (
          <Notice tone="danger">
            Interrupted save demonstration. Input remains visible, but no action
            is saved, sent, or marked complete.
          </Notice>
        )}
        <p className="rounded-xl bg-muted px-4 py-3 text-sm" role="status">
          {message}
        </p>
        {persona === "owner" ? (
          <Owner
            view={ownerView}
            setView={setOwnerView}
            schedule={schedule}
            setSchedule={setSchedule}
            submit={schedulePreview}
            scenario={scenario}
          />
        ) : (
          <Staff
            prepState={prepState}
            salePreview={() =>
              setMessage(
                "Preview sale only. No sale, stock movement or payment has been saved.",
              )
            }
            prepPreview={() =>
              setPrepState(
                transitionPrep(
                  prepState,
                  prepState === "new" ? "making" : "done",
                ),
              )
            }
            view={staffView}
            setView={setStaffView}
            counts={counts}
            raw={raw}
            rows={rows}
            unresolved={unresolved}
            filter={filter}
            setFilter={setFilter}
            category={category}
            setCategory={setCategory}
            search={search}
            setSearch={setSearch}
            openingReviewed={openingReviewed}
            setOpeningReviewed={setOpeningReviewed}
            suppliesResolved={suppliesResolved}
            resolve={() => {
              setSuppliesResolved(true);
              setMessage(
                "Preview: fixture supplies are resolved. Nothing is saved or sent.",
              );
            }}
            update={update}
            notBrought={notBrought}
            preview={preview}
            scenario={scenario}
          />
        )}
      </div>
    </main>
  );
}

function Owner({
  view,
  setView,
  schedule,
  setSchedule,
  submit,
  scenario,
}: {
  view: OwnerView;
  setView: (value: OwnerView) => void;
  schedule: OwnerScheduleDraft;
  setSchedule: (value: OwnerScheduleDraft) => void;
  submit: (event: React.FormEvent) => void;
  scenario: Scenario;
}) {
  const field = (
    key: keyof OwnerScheduleDraft,
    name: string,
    type = "text",
  ) => (
    <label className="grid gap-2 text-sm font-bold">
      {name}
      <input
        required
        type={type}
        value={schedule[key]}
        onChange={(event) =>
          setSchedule({ ...schedule, [key]: event.target.value })
        }
        className="min-h-12 rounded-xl border bg-background px-3 font-normal"
      />
    </label>
  );
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {(["setup", "schedule"] as const).map((item) => (
          <button
            key={item}
            onClick={() => setView(item)}
            className={`min-h-12 rounded-xl px-4 text-sm font-bold capitalize ${view === item ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {item}
          </button>
        ))}
      </div>
      {view === "setup" ? (
        <div className="grid gap-5 py-6 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="text-sm font-bold text-muted-foreground">
              OWNER SETUP
            </p>
            <h2 className="mt-1 text-2xl font-extrabold">
              Set up the reusable selling system once.
            </h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Catalogs, prices, variants, recipes, prepared stock, units and
              pack sizes, and a packing checklist belong here. Scheduling only
              assigns a time, place and people.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Card
                title="Catalog & prices"
                text="Fixture menu and price rules"
              />
              <Card title="Variants & recipes" text="Recipe-aware options" />
              <Card
                title="Prepared stock"
                text="Units and pack sizes defined"
              />
              <Card title="Packing checklist" text="Reusable checklist ready" />
            </div>
          </div>
          <aside className="rounded-2xl bg-muted p-5">
            <h3 className="font-extrabold">Next walkthrough action</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Plan only date, planned times, venue, address, cashier and prep
              assignment.
            </p>
            <Button className="mt-5 w-full" onClick={() => setView("schedule")}>
              Preview schedule fields
            </Button>
          </aside>
        </div>
      ) : (
        <form onSubmit={submit} className="py-6">
          <p className="text-sm font-bold text-muted-foreground">SCHEDULE</p>
          <h2 className="mt-1 text-2xl font-extrabold">Plan this shift</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Planned times inform the schedule. They do not lock an active shift.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {field("date", "Date", "date")}
            {field("openingTime", "Planned open", "time")}
            {field("closingTime", "Planned close", "time")}
            {field("venue", "Venue")}
            {field("address", "Address")}
            <label className="grid gap-2 text-sm font-bold">
              Cashier
              <select
                required
                value={schedule.cashierId}
                onChange={(event) =>
                  setSchedule({ ...schedule, cashierId: event.target.value })
                }
                className="min-h-12 rounded-xl border bg-background px-3 font-normal"
              >
                <option>Mika Santos</option>
                <option>Jules Ramos</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Prep
              <select
                required
                value={schedule.prepId}
                onChange={(event) =>
                  setSchedule({ ...schedule, prepId: event.target.value })
                }
                className="min-h-12 rounded-xl border bg-background px-3 font-normal"
              >
                <option>Noel Cruz</option>
                <option>Sam Yu</option>
              </select>
            </label>
          </div>
          <Button
            disabled={scenario === "loading"}
            type="submit"
            className="mt-6"
          >
            Preview schedule validation
          </Button>
        </form>
      )}
    </section>
  );
}

function Staff({
  prepState,
  salePreview,
  prepPreview,
  view,
  setView,
  counts,
  raw,
  rows,
  unresolved,
  filter,
  setFilter,
  category,
  setCategory,
  search,
  setSearch,
  openingReviewed,
  setOpeningReviewed,
  suppliesResolved,
  resolve,
  update,
  notBrought,
  preview,
  scenario,
}: {
  prepState: PrepOrderState;
  salePreview: () => void;
  prepPreview: () => void;
  view: StaffView;
  setView: (value: StaffView) => void;
  counts: Record<string, CountAnswer>;
  raw: Record<string, string>;
  rows: [string, CountAnswer][];
  unresolved: number;
  filter: "all" | "uncounted";
  setFilter: (value: "all" | "uncounted") => void;
  category: CountCategory;
  setCategory: (value: CountCategory) => void;
  search: string;
  setSearch: (value: string) => void;
  openingReviewed: boolean;
  setOpeningReviewed: (value: boolean) => void;
  suppliesResolved: boolean;
  resolve: () => void;
  update: (name: string, text: string) => void;
  notBrought: (name: string) => void;
  preview: (next: Parameters<typeof transitionStaff>[1]) => void;
  scenario: Scenario;
}) {
  const steps: { id: StaffView; label: string }[] = [
    { id: "join", label: "Join" },
    { id: "pack", label: "Pack" },
    { id: "count", label: "Count" },
    { id: "sell-prep", label: "Sell / Prep" },
    { id: "close", label: "Close" },
  ];
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <nav
        className="flex gap-2 overflow-x-auto pb-2"
        aria-label="Staff walkthrough steps"
      >
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => setView(step.id)}
            className={`min-h-12 shrink-0 rounded-xl px-4 text-sm font-bold ${view === step.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {index + 1}. {step.label}
          </button>
        ))}
      </nav>
      <div className="py-6">
        {view === "join" && (
          <Panel
            eyebrow="JOIN"
            title="Cashier authority is explicit."
            text="Mika’s fixture installation is the assigned cashier for authority epoch 1. This view only previews the guard; it does not claim a real device."
          >
            <Button
              disabled={scenario === "loading" || scenario === "missing"}
              onClick={() => preview("prepared")}
            >
              Preview prepare while connected
            </Button>
          </Panel>
        )}
        {view === "pack" && (
          <Panel
            eyebrow="PACK"
            title="Resolve critical supplies before departure."
            text="Gloves and utensils are missing in this fixture; the heater is checked. Departure is blocked until each critical supply is explicitly resolved with evidence in the real workflow."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Card
                title="Gloves"
                text={
                  suppliesResolved
                    ? "Resolved in fixture"
                    : "Missing — blocks departure"
                }
              />
              <Card title="Heater" text="Checked" />
              <Card
                title="Utensils"
                text={
                  suppliesResolved
                    ? "Resolved in fixture"
                    : "Missing — blocks departure"
                }
              />
            </div>
            {!suppliesResolved && (
              <Button className="mt-5" onClick={resolve}>
                Preview resolve fixture supplies
              </Button>
            )}
            <Button
              disabled={!suppliesResolved || scenario === "loading"}
              className="mt-5 ml-0 sm:ml-3"
              onClick={() => preview("departure-ready")}
            >
              Preview departure check
            </Button>
          </Panel>
        )}
        {view === "count" && (
          <Counts
            counts={counts}
            raw={raw}
            rows={rows}
            unresolved={unresolved}
            filter={filter}
            setFilter={setFilter}
            category={category}
            setCategory={setCategory}
            search={search}
            setSearch={setSearch}
            openingReviewed={openingReviewed}
            setOpeningReviewed={setOpeningReviewed}
            update={update}
            notBrought={notBrought}
            preview={preview}
          />
        )}
        {view === "sell-prep" && (
          <Panel
            eyebrow="SELL / PREP"
            title="Sales and prep stay visibly separate."
            text={
              scenario === "missing"
                ? "No prepared catalog exists in this fixture, so sale preview stays unavailable."
                : "Prepared catalog fixture only. Sales and prep actions remain previews until their production flows exist."
            }
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Card title="Iced latte" text="Drinks · fixture" />
              <Card title="Rice bowl" text="Meals · fixture" />
              <Card title="Prep ticket" text={`Fixture order: ${prepState}`} />
            </div>
            <Button
              disabled={
                scenario === "loading" ||
                scenario === "missing" ||
                scenario === "interrupted"
              }
              className="mt-5"
              onClick={salePreview}
            >
              Preview sale action
            </Button>
            <Button
              className="mt-5 ml-3"
              disabled={
                prepState === "done" ||
                scenario === "loading" ||
                scenario === "missing" ||
                scenario === "interrupted"
              }
              onClick={prepPreview}
            >
              Preview prep {prepState === "new" ? "Making" : "Done"}
            </Button>
          </Panel>
        )}
        {view === "close" && (
          <Panel
            eyebrow="CLOSE"
            title="Close only after review."
            text="The walkthrough displays local closure as a preview. It does not imply a server reconciliation or booth operation."
          >
            <Button
              disabled={scenario === "loading" || scenario === "interrupted"}
              onClick={() => preview("closed-locally")}
            >
              Preview reviewed local close
            </Button>
          </Panel>
        )}
      </div>
    </section>
  );
}

function Counts({
  counts,
  raw,
  rows,
  unresolved,
  filter,
  setFilter,
  category,
  setCategory,
  search,
  setSearch,
  openingReviewed,
  setOpeningReviewed,
  update,
  notBrought,
  preview,
}: {
  counts: Record<string, CountAnswer>;
  raw: Record<string, string>;
  rows: [string, CountAnswer][];
  unresolved: number;
  filter: "all" | "uncounted";
  setFilter: (value: "all" | "uncounted") => void;
  category: CountCategory;
  setCategory: (value: CountCategory) => void;
  search: string;
  setSearch: (value: string) => void;
  openingReviewed: boolean;
  setOpeningReviewed: (value: boolean) => void;
  update: (name: string, text: string) => void;
  notBrought: (name: string) => void;
  preview: (next: Parameters<typeof transitionStaff>[1]) => void;
}) {
  return (
    <Panel
      eyebrow="COUNT"
      title="Opening counts need a review."
      text={`${unresolved} unresolved ${unresolved === 1 ? "item" : "items"}. Empty means uncounted; zero means counted at zero; Not brought is a separate declaration.`}
    >
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          aria-label="Search count items"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search inventory"
          className="min-h-12 flex-1 rounded-xl border bg-background px-3"
        />
        <select
          aria-label="Count category"
          value={category}
          onChange={(event) => setCategory(event.target.value as CountCategory)}
          className="min-h-12 rounded-xl border bg-background px-3"
        >
          <option value="all">All categories</option>
          <option value="ingredients">Ingredients</option>
          <option value="packaging">Packaging</option>
        </select>
        <select
          aria-label="Count filter"
          value={filter}
          onChange={(event) =>
            setFilter(event.target.value as "all" | "uncounted")
          }
          className="min-h-12 rounded-xl border bg-background px-3"
        >
          <option value="all">All count states</option>
          <option value="uncounted">Uncounted only</option>
        </select>
      </div>
      <div className="mt-4 grid gap-3">
        {rows.map(([name, answer]) => (
          <article
            key={name}
            className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_10rem_auto_auto] sm:items-center"
          >
            <div>
              <h3 className="font-bold">{name}</h3>
              <p className="text-sm text-muted-foreground">{label(answer)}</p>
            </div>
            <input
              aria-label={`${name} count`}
              inputMode="decimal"
              value={raw[name]}
              placeholder="Enter count"
              onChange={(event) => update(name, event.target.value)}
              className="min-h-12 rounded-xl border bg-background px-3"
            />
            <button
              onClick={() => update(name, "")}
              className="min-h-12 rounded-xl border px-3 text-sm font-bold"
            >
              Mark uncounted
            </button>
            <button
              onClick={() => notBrought(name)}
              className="min-h-12 rounded-xl border px-3 text-sm font-bold"
            >
              Mark not brought
            </button>
          </article>
        ))}
      </div>
      <label className="mt-5 flex min-h-12 items-center gap-3 rounded-xl bg-muted px-3 text-sm">
        <input
          type="checkbox"
          checked={openingReviewed}
          onChange={(event) => setOpeningReviewed(event.target.checked)}
        />{" "}
        I reviewed every opening count and declaration.
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={() => preview("open")}>Preview count review</Button>
        <button
          onClick={() => {
            const name = Object.keys(counts).find(
              (key) => counts[key].kind === "uncounted",
            );
            if (name) update(name, "0");
          }}
          className="min-h-12 rounded-xl border px-4 text-sm font-bold"
        >
          Preview zero next unresolved
        </button>
      </div>
    </Panel>
  );
}
