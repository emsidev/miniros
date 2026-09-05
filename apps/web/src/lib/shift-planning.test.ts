import { describe, expect, it } from "vitest";
import {
  bulkDisabledReason,
  bulkShiftSchema,
  createShiftSchema,
  isValidShiftDate,
  manilaToday,
  planningTotals,
  safeShiftReturn,
  updateShiftSchema,
} from "./shift-planning";
import {
  filterWorkspaceShifts,
  readWorkspaceFilters,
  weekDates,
} from "./shift-workspace";

const location = "11111111-1111-4111-a111-111111111111";
const employee = "22222222-2222-4222-a222-222222222222";
const requestId = "33333333-3333-4333-a333-333333333333";
const plan = {
  sellingLocationId: location,
  title: "",
  shiftDates: ["2026-09-05"],
  intent: "draft" as const,
  assignments: [],
  costs: [],
  requestId,
};

describe("shift planning validation", () => {
  it("bounds per-shift costs and staff before expanding a plan", () => {
    const cost = { costType: "other", label: "Cost", amountCents: 0 };
    expect(
      createShiftSchema.safeParse({ ...plan, costs: Array(51).fill(cost) })
        .success,
    ).toBe(false);
    const staff = Array.from({ length: 101 }, (_, index) => ({
      employeeId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      roleOnShift: "employee",
      salaryRateCents: 0,
    }));
    expect(
      createShiftSchema.safeParse({ ...plan, assignments: staff }).success,
    ).toBe(false);
    expect(
      updateShiftSchema.safeParse({
        ...plan,
        shiftId: requestId,
        shiftDate: "2026-09-05",
        expectedUpdatedAt: "2026-09-05T00:00:00.000Z",
        costs: Array(51).fill(cost),
      }).success,
    ).toBe(false);
  });
  it("bounds expanded create and team batches while preserving normal year plans", () => {
    const shiftDates = Array.from({ length: 366 }, (_, index) =>
      new Date(Date.UTC(2028, 0, index + 1)).toISOString().slice(0, 10),
    );
    const costs = Array(14).fill({
      costType: "other",
      label: "Permit",
      amountCents: 0,
    });
    expect(
      createShiftSchema.safeParse({ ...plan, shiftDates, costs }).success,
    ).toBe(false);
    expect(
      createShiftSchema.safeParse({
        ...plan,
        shiftDates,
        costs: costs.slice(0, 3),
      }).success,
    ).toBe(true);
    const assignments = Array.from({ length: 14 }, (_, index) => ({
      employeeId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      roleOnShift: "employee",
      salaryRateCents: 0,
    }));
    const shifts = shiftDates.map((_, index) => ({
      id: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      updatedAt: "2026-09-05T00:00:00.000Z",
    }));
    expect(
      bulkShiftSchema.safeParse({ operation: "team", shifts, assignments })
        .success,
    ).toBe(false);
    expect(
      bulkShiftSchema.safeParse({
        operation: "team",
        shifts: shifts.slice(0, 30),
        assignments,
      }).success,
    ).toBe(true);
  });
  it("allows an unstaffed draft and normalizes an optional name", () => {
    expect(createShiftSchema.parse({ ...plan, title: "   " }).title).toBe("");
  });
  it("requires an operator only for publication", () => {
    const result = createShiftSchema.safeParse({ ...plan, intent: "publish" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.path).toEqual(["assignments"]);
    expect(
      createShiftSchema.safeParse({
        ...plan,
        intent: "publish",
        assignments: [
          {
            employeeId: employee,
            roleOnShift: "operator",
            salaryRateCents: 65000,
          },
        ],
      }).success,
    ).toBe(true);
  });
  it("accepts one or multiple distinct ordered dates", () => {
    expect(createShiftSchema.safeParse(plan).success).toBe(true);
    expect(
      createShiftSchema.safeParse({
        ...plan,
        shiftDates: ["2026-09-05", "2026-09-07"],
      }).success,
    ).toBe(true);
    for (const dates of [
      [],
      ["2026-09-05", "2026-09-05"],
      ["2026-09-06", "2026-09-05"],
    ])
      expect(
        createShiftSchema.safeParse({ ...plan, shiftDates: dates }).success,
      ).toBe(false);
  });
  it("rejects impossible dates, including non-leap February", () => {
    expect(isValidShiftDate("2026-02-29")).toBe(false);
    expect(isValidShiftDate("2024-02-29")).toBe(true);
    expect(isValidShiftDate("2026-04-31")).toBe(false);
    expect(isValidShiftDate("05/09/2026")).toBe(false);
  });
  it("links duplicate staff errors to their individual entries", () => {
    const member = {
      employeeId: employee,
      roleOnShift: "operator",
      salaryRateCents: 65000,
    };
    const result = createShiftSchema.safeParse({
      ...plan,
      assignments: [member, member],
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.some(
          (issue) => issue.path.join(".") === "assignments.1.employeeId",
        ),
      ).toBe(true);
  });
  it("rejects negative, fractional, and unsafe combined costs", () => {
    for (const amount of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1])
      expect(
        createShiftSchema.safeParse({
          ...plan,
          costs: [{ costType: "rent", label: "Rent", amountCents: amount }],
        }).success,
      ).toBe(false);
    expect(
      createShiftSchema.safeParse({
        ...plan,
        costs: [
          {
            costType: "rent",
            label: "Rent",
            amountCents: Number.MAX_SAFE_INTEGER,
          },
          { costType: "other", label: "Permit", amountCents: 1 },
        ],
      }).success,
    ).toBe(false);
  });
  it("requires a saved version for editing", () => {
    expect(
      updateShiftSchema.safeParse({
        ...plan,
        shiftId: requestId,
        shiftDate: "2026-09-05",
      }).success,
    ).toBe(false);
  });
  it("includes pay and itemized costs while excluding cancelled assignments", () => {
    expect(
      planningTotals(
        [
          { salaryRateCents: 65000, status: "draft" },
          { salaryRateCents: 90000, status: "cancelled" },
        ],
        [
          { amountCents: 150000 },
          { amountCents: 50000 },
          { amountCents: 1234 },
        ],
      ),
    ).toEqual({
      payCents: 65000,
      locationCostCents: 201234,
      totalCents: 266234,
    });
  });
  it("explains incompatible bulk selections", () => {
    expect(
      bulkDisabledReason("publish", [
        { status: "draft" },
        { status: "scheduled" },
      ]),
    ).toContain("only drafts");
    expect(
      bulkDisabledReason("team", [
        { status: "scheduled" },
        { status: "active" },
      ]),
    ).toContain("Only draft and scheduled");
    expect(
      bulkDisabledReason("team", [
        { status: "draft" },
        { status: "scheduled" },
      ]),
    ).toBeUndefined();
    expect(
      bulkShiftSchema.safeParse({
        operation: "team",
        shifts: [{ id: requestId, updatedAt: "2026-09-05T00:00:00.000Z" }],
        assignments: [],
      }).success,
    ).toBe(true);
  });
});

describe("shift workspace navigation", () => {
  const base = {
    sellingLocationId: location,
    locationName: "Market",
    title: "Morning",
    assignments: [
      { employeeId: employee, employeeName: "Alex Rivera", status: "assigned" },
    ],
  };
  const shifts = [
    { ...base, status: "scheduled" as const, shiftDate: "2026-09-04" },
    { ...base, status: "active" as const, shiftDate: "2026-09-05" },
    { ...base, status: "draft" as const, shiftDate: "2026-09-06" },
    { ...base, status: "closed" as const, shiftDate: "2026-09-03" },
  ];
  it("defaults to open agenda, with live shifts before planning dates", () => {
    const filters = readWorkspaceFilters(new URLSearchParams(), "2026-09-05");
    expect(filters.view).toBe("agenda");
    expect(
      filterWorkspaceShifts(shifts, filters).map((shift) => shift.status),
    ).toEqual(["active", "scheduled", "draft"]);
  });
  it("combines search, people, location, status, and date filters", () => {
    const filters = readWorkspaceFilters(
      new URLSearchParams({
        q: "rivera",
        employee,
        location,
        status: "draft",
        from: "2026-09-06",
        to: "2026-09-06",
      }),
      "2026-09-05",
    );
    expect(filterWorkspaceShifts(shifts, filters)).toEqual([shifts[2]]);
    expect(filterWorkspaceShifts(shifts, { ...filters, q: "missing" })).toEqual(
      [],
    );
  });
  it("keeps history separate and retains return filters safely", () => {
    expect(
      filterWorkspaceShifts(
        shifts,
        readWorkspaceFilters(
          new URLSearchParams("scope=history"),
          "2026-09-05",
        ),
      ),
    ).toEqual([shifts[3]]);
    expect(safeShiftReturn("/admin/shifts?scope=history&q=Market")).toBe(
      "/admin/shifts?scope=history&q=Market",
    );
    expect(safeShiftReturn("https://example.com")).toBe("/admin/shifts");
  });
  it("uses Manila day boundaries and Monday-based weeks across months", () => {
    expect(manilaToday(new Date("2026-09-04T16:30:00Z"))).toBe("2026-09-05");
    expect(weekDates("2026-09-05")).toEqual([
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
    ]);
  });
});
