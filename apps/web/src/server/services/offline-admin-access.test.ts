import { beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the real access policy; only authentication and database I/O are seams.
const context = vi.hoisted(() => ({
  role: "employee",
  signedIn: true,
  reads: 0,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: context.signedIn ? { id: "user" } : null },
        error: null,
      }),
    },
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "business" }) }),
}));
vi.mock("@miniros/db", async (original) => ({
  ...(await original<typeof import("@miniros/db")>()),
  requireDatabase: () => ({
    select: () => {
      const membership = context.reads++ % 2 === 0;
      const query = {
        from: () => query,
        innerJoin: () => query,
        where: () => query,
        limit: async () =>
          membership
            ? [
                {
                  memberId: "member",
                  role: context.role,
                  businessId: "business",
                  businessName: "Fixture",
                  recipesEnabled: false,
                  productionEnabled: false,
                  approvalsEnabled: false,
                  promosEnabled: false,
                },
              ]
            : [{ id: "employee", canUsePos: true, canLogProduction: false }],
      };
      return query;
    },
  }),
}));

import { requireActiveBusiness } from "./access";
import {
  getOfflineAdministration,
  offlineRecoveryJournal,
  recoverOfflineDevice,
} from "./offline-admin";

beforeEach(() => {
  context.role = "employee";
  context.signedIn = true;
  context.reads = 0;
});

describe("Devices authorization", () => {
  it.each([
    ["list", () => getOfflineAdministration()],
    ["journal", () => offlineRecoveryJournal("session")],
    [
      "freeze",
      () =>
        recoverOfflineDevice("session", "freeze", "Compare original receipts"),
    ],
    [
      "restore",
      () =>
        recoverOfflineDevice("session", "restore", "Original device recovered"),
    ],
  ] as const)(
    "rejects an operator before reading or mutating device %s data",
    async (_, work) => {
      await expect(work()).rejects.toThrow("Owner or admin access is required");
      expect(context.reads).toBe(2); // Only membership and employee access lookups.
    },
  );
  it("rejects an unauthenticated device listing before database access", async () => {
    context.signedIn = false;
    await expect(getOfflineAdministration()).rejects.toThrow("sign in");
    expect(context.reads).toBe(0);
  });
  it.each(["owner", "admin"])(
    "allows the shared Devices policy for %s",
    async (role) => {
      context.role = role;
      expect(
        (await requireActiveBusiness({ admin: true })).membership.role,
      ).toBe(role);
    },
  );
});
