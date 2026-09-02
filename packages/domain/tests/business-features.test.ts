import { describe, expect, it } from "vitest";
import {
  defaultBusinessFeatureFlags,
  isBusinessFeatureEnabled,
  validateBusinessFeatureFlags,
} from "../src/business-features";

describe("business feature flags", () => {
  it("enables every feature by default", () => {
    expect(defaultBusinessFeatureFlags).toEqual({
      recipesEnabled: true,
      productionEnabled: true,
      approvalsEnabled: true,
      promosEnabled: true,
    });
  });

  it("resolves feature access from the corresponding flag", () => {
    const features = {
      ...defaultBusinessFeatureFlags,
      approvalsEnabled: false,
      promosEnabled: false,
    };

    expect(isBusinessFeatureEnabled(features, "recipes")).toBe(true);
    expect(isBusinessFeatureEnabled(features, "approvals")).toBe(false);
    expect(isBusinessFeatureEnabled(features, "promos")).toBe(false);
  });

  it("requires Recipe before Production can be enabled", () => {
    expect(() =>
      validateBusinessFeatureFlags({
        ...defaultBusinessFeatureFlags,
        recipesEnabled: false,
        productionEnabled: true,
      }),
    ).toThrow("Production requires the Recipe feature to be enabled.");

    expect(
      validateBusinessFeatureFlags({
        ...defaultBusinessFeatureFlags,
        recipesEnabled: false,
        productionEnabled: false,
      }),
    ).toMatchObject({ productionEnabled: false });
  });
});
