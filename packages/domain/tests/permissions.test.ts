import { describe, expect, it } from "vitest";
import {
  getOperationalPermissions,
  hasAdminAccess,
  hasOperationalPermission,
  isAdminMemberRole,
} from "../src/permissions";

describe("permission helpers", () => {
  it("gates admin access only by owner/admin membership roles", () => {
    expect(isAdminMemberRole("owner")).toBe(true);
    expect(isAdminMemberRole("admin")).toBe(true);
    expect(hasAdminAccess("operator")).toBe(false);
    expect(hasAdminAccess("employee")).toBe(false);
    expect(hasAdminAccess(undefined)).toBe(false);
  });

  it("checks POS capabilities from employee flags, not member roles", () => {
    const posEmployee = { canUsePos: true, canLogProduction: false };
    const regularEmployee = { canUsePos: false, canLogProduction: false };

    expect(hasOperationalPermission(posEmployee, "pos.use")).toBe(true);
    expect(hasOperationalPermission(posEmployee, "shift.start")).toBe(true);
    expect(hasOperationalPermission(posEmployee, "shift.close")).toBe(true);
    expect(hasOperationalPermission(regularEmployee, "pos.use")).toBe(false);
  });

  it("checks production independently from POS access", () => {
    const productionEmployee = {
      canUsePos: false,
      canLogProduction: true,
    };

    expect(hasOperationalPermission(productionEmployee, "production.log")).toBe(
      true,
    );
    expect(hasOperationalPermission(productionEmployee, "pos.use")).toBe(false);
    expect(getOperationalPermissions(productionEmployee)).toEqual([
      "production.log",
    ]);
  });

  it("denies operational actions when employee flags are unavailable", () => {
    expect(hasOperationalPermission(undefined, "pos.use")).toBe(false);
    expect(hasOperationalPermission(null, "production.log")).toBe(false);
    expect(getOperationalPermissions(undefined)).toEqual([]);
  });
});
