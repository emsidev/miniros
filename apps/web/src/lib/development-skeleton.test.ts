import { expect, it } from "vitest";
import { developmentSkeletonEnabled } from "./development-skeleton";
it("EP01 dev walkthrough is inaccessible in production and requires explicit opt-in in development", () => {
  for (const environment of ["production", "test", undefined])
    for (const flag of ["1", "0", undefined])
      expect(developmentSkeletonEnabled(environment, flag)).toBe(false);
  expect(developmentSkeletonEnabled("development", undefined)).toBe(false);
  expect(developmentSkeletonEnabled("development", "1")).toBe(true);
});
