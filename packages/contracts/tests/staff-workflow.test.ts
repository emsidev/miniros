import { describe, expect, it } from "vitest";
import {
  claimCashier,
  staffWorkflowStates,
  staffTransitions,
  transitionStaff,
  editOpeningCount,
  countFromText,
  transitionPrep,
  validateOwnerSchedule,
  type StaffWorkflow,
  type WorkflowGuard,
} from "../src/staff-workflow";
const guard: WorkflowGuard = {
  installationId: "cashier-a",
  authorityEpoch: 1,
  snapshotReady: true,
  checklistResolved: true,
  counts: [{ kind: "counted", quantity: 0 }, { kind: "not-brought" }],
  openingReviewed: true,
  closeReviewed: true,
  prepResolved: true,
};
const at = (state: StaffWorkflow["state"]): StaffWorkflow => ({
  state,
  cashierInstallationId: "cashier-a",
  authorityEpoch: 1,
  openingSealed: ["open", "closing-draft", "closed-locally"].includes(state),
});
// Independent acceptance oracle from the product contract, not the reducer table.
const expectedEdges = new Set([
  "scheduled:prepared",
  "scheduled:cancelled",
  "prepared:packing",
  "packing:departure-ready",
  "departure-ready:opening-count",
  "opening-count:open",
  "open:closing-draft",
  "closing-draft:open",
  "closing-draft:closed-locally",
]);
describe("EP01-T01 workflow and authority contract", () => {
  it("matches the independently specified transition graph", () => {
    const edges = Object.entries(staffTransitions).flatMap(([from, targets]) =>
      targets.map((to) => `${from}:${to}`),
    );
    expect(new Set(edges)).toEqual(expectedEdges);
  });
  it("a serialized cashier claim has one winner and retries preserve it", () => {
    const claimed = claimCashier(undefined, "cashier-a");
    expect(claimCashier(claimed, "cashier-a")).toBe(claimed);
    expect(() => claimCashier(claimed, "cashier-b")).toThrow();
    expect(() => claimCashier(undefined, "")).toThrow();
  });
  it("rejects impossible seal state", () => {
    expect(() =>
      transitionStaff(
        { ...at("opening-count"), openingSealed: true },
        "open",
        guard,
      ),
    ).toThrow("seal state");
    expect(() =>
      transitionStaff(
        { ...at("open"), openingSealed: false },
        "closing-draft",
        guard,
      ),
    ).toThrow("seal state");
  });
  for (const from of staffWorkflowStates)
    for (const to of staffWorkflowStates) {
      it(`${from} → ${to} ${expectedEdges.has(`${from}:${to}`) ? "allowed with guards" : "rejected"}`, () => {
        if (expectedEdges.has(`${from}:${to}`))
          expect(transitionStaff(at(from), to, guard).state).toBe(to);
        else
          expect(() => transitionStaff(at(from), to, guard)).toThrow("Illegal");
      });
    }
  it.each(["cashier-b", "prep", ""])(
    "rejects competing writer %s",
    (installationId) => {
      expect(() =>
        transitionStaff(at("scheduled"), "prepared", {
          ...guard,
          installationId,
        }),
      ).toThrow("assigned cashier");
      expect(() =>
        editOpeningCount(
          at("opening-count"),
          { ...guard, installationId },
          { kind: "counted", quantity: 1 },
        ),
      ).toThrow("assigned cashier");
    },
  );
  it.each([0, 2, NaN, Infinity])(
    "rejects wrong authority epoch %s",
    (authorityEpoch) => {
      expect(() =>
        transitionStaff(at("scheduled"), "prepared", {
          ...guard,
          authorityEpoch,
        }),
      ).toThrow();
    },
  );
  it.each(["open", "closing-draft", "closed-locally"] as const)(
    "never rewrites sealed opening in %s",
    (state) => {
      expect(() =>
        editOpeningCount(at(state), guard, { kind: "counted", quantity: 20 }),
      ).toThrow("sealed");
    },
  );
  it("guards preparation, supplies, unresolved opening and closing review", () => {
    expect(() =>
      transitionStaff(at("scheduled"), "prepared", {
        ...guard,
        snapshotReady: false,
      }),
    ).toThrow("snapshot");
    expect(() =>
      transitionStaff(at("packing"), "departure-ready", {
        ...guard,
        checklistResolved: false,
      }),
    ).toThrow("supplies");
    expect(() =>
      transitionStaff(at("opening-count"), "open", {
        ...guard,
        counts: [{ kind: "uncounted" }],
      }),
    ).toThrow("every opening count");
    expect(() =>
      transitionStaff(at("opening-count"), "open", { ...guard, counts: [] }),
    ).toThrow();
    expect(() =>
      transitionStaff(at("opening-count"), "open", {
        ...guard,
        openingReviewed: false,
      }),
    ).toThrow();
    expect(() =>
      transitionStaff(at("closing-draft"), "closed-locally", {
        ...guard,
        prepResolved: false,
      }),
    ).toThrow();
    expect(() =>
      transitionStaff(at("closing-draft"), "closed-locally", {
        ...guard,
        closeReviewed: false,
      }),
    ).toThrow();
  });
  it("seals opening and preserves seal when returning from closing draft", () => {
    const opened = transitionStaff(at("opening-count"), "open", guard);
    expect(opened.openingSealed).toBe(true);
    expect(
      transitionStaff(
        transitionStaff(opened, "closing-draft", guard),
        "open",
        guard,
      ).openingSealed,
    ).toBe(true);
  });
  it("has no network, media, cloud token or planned-end-time closing dependency", () => {
    expect(
      transitionStaff(at("closing-draft"), "closed-locally", guard).state,
    ).toBe("closed-locally");
    expect(transitionStaff(at("opening-count"), "open", guard).state).toBe(
      "open",
    );
  });
  it("keeps blank, counted zero and not brought distinct", () => {
    expect(countFromText(" ")).toEqual({ kind: "uncounted" });
    expect(countFromText("0")).toEqual({ kind: "counted", quantity: 0 });
    expect(
      editOpeningCount(at("opening-count"), guard, { kind: "not-brought" }),
    ).toEqual({ kind: "not-brought" });
  });
  it.each(["-1", "NaN", "Infinity", "1e309", "no"])(
    "rejects invalid count text %s",
    (value) => expect(() => countFromText(value)).toThrow(),
  );
  it("delayed prep Start cannot undo Done and cancellation requires explicit resolution", () => {
    expect(transitionPrep("making", "done")).toBe("done");
    expect(transitionPrep("done", "done")).toBe("done");
    expect(() => transitionPrep("done", "making")).toThrow();
    expect(() => transitionPrep("new", "cancelled")).toThrow();
    expect(transitionPrep("new", "cancelled", true)).toBe("cancelled");
  });
  it("owner scheduling has only essentials and no allocation requirement", () => {
    const schedule = {
      date: "2026-09-07",
      openingTime: "09:00",
      closingTime: "18:00",
      venue: "Fixture venue",
      address: "Fixture address",
      cashierId: "a",
      prepId: "b",
    };
    expect(() => validateOwnerSchedule(schedule)).not.toThrow();
    for (const key of Object.keys(schedule))
      expect(() => validateOwnerSchedule({ ...schedule, [key]: "" })).toThrow();
    expect(() => validateOwnerSchedule({ ...schedule, prepId: "a" })).toThrow();
    expect(() =>
      validateOwnerSchedule({ ...schedule, date: "2026-02-30" }),
    ).toThrow();
  });
});
