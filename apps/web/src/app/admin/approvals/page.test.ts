import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureUnavailable } from "@/components/shared/feature-unavailable";
import { requireActiveBusiness } from "@/server/services/access";
import { listPendingApprovals } from "@/server/services/approval-read";
import { ApprovalActions } from "./approval-actions";
import ApprovalsPage from "./page";

vi.mock("@/server/services/access", () => ({ requireActiveBusiness: vi.fn() }));
vi.mock("@/server/services/approval-read", () => ({
  listPendingApprovals: vi.fn(),
}));
vi.mock("./approval-actions", () => ({ ApprovalActions: () => null }));

beforeEach(() => {
  vi.mocked(requireActiveBusiness).mockResolvedValue({
    business: { features: { approvalsEnabled: false } },
  } as Awaited<ReturnType<typeof requireActiveBusiness>>);
  vi.mocked(listPendingApprovals).mockResolvedValue({
    cash: [],
    inventory: [],
  });
});
afterEach(() => {
  vi.clearAllMocks();
});

function reviewControls(node: React.ReactNode): unknown[] {
  if (!React.isValidElement<{ children?: React.ReactNode }>(node)) return [];
  if (node.type === ApprovalActions) return [node.props];
  return React.Children.toArray(node.props.children).flatMap(reviewControls);
}

describe("existing approvals when the feature is disabled", () => {
  it.each(["cash", "inventory"] as const)(
    "renders pending %s review controls",
    async (type) => {
      const shared = {
        id: "request-id",
        shiftId: "shift-id",
        reason: "Prepared shift request",
        requestedByName: "Operator",
        locationName: "Booth",
        createdAt: new Date(),
      };
      vi.mocked(listPendingApprovals).mockResolvedValue({
        cash:
          type === "cash"
            ? [{ ...shared, label: "Ice", amountCents: 1000 }]
            : [],
        inventory:
          type === "inventory"
            ? [{ ...shared, itemName: "Cup", unit: "pcs", quantityDelta: "-1" }]
            : [],
      });
      const page = await ApprovalsPage();
      expect(page.type).not.toBe(FeatureUnavailable);
      expect(reviewControls(page)).toContainEqual({ id: "request-id", type });
      expect(requireActiveBusiness).toHaveBeenCalledWith({ admin: true });
    },
  );

  it("keeps feature setup guidance when there are no pending requests", async () => {
    expect((await ApprovalsPage()).type).toBe(FeatureUnavailable);
  });
});
