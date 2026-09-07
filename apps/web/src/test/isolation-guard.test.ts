import { describe, expect, it, vi } from "vitest";
import {
  assertDisposableDatabase,
  withDisposableDatabase,
} from "./isolation-guard";
describe("EP00-T02 destructive fixture isolation", () => {
  it.each([
    "postgres://secret:secret@production.invalid:5432/business",
    "postgres://localhost:55432/miniros_ep00_disposable",
    "postgres://127.0.0.1:5432/miniros_ep00_disposable",
    "postgres://127.0.0.1:55432/business",
    "postgres://127.0.0.1:55432/miniros_ep00_disposable?host=production.invalid",
    "not a URL",
  ])(
    "rejects non-allowlisted target before invoking destructive callback (%#)",
    async (target) => {
      const destructiveCommand = vi.fn(async () => "would delete fixture rows");
      await expect(
        withDisposableDatabase(target, destructiveCommand),
      ).rejects.toThrow("Test database target rejected");
      expect(destructiveCommand).not.toHaveBeenCalled();
    },
  );
  it("allows only the dedicated disposable target", () => {
    expect(() =>
      assertDisposableDatabase(
        "postgres://127.0.0.1:55432/miniros_ep00_disposable",
      ),
    ).not.toThrow();
  });
});
