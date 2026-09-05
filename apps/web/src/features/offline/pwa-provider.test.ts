import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  effect: undefined as undefined | (() => () => void),
  visibleSessions: vi.fn(),
  synchronize: vi.fn(),
}));
vi.mock("react", () => ({
  useEffect: (effect: () => () => void) => {
    mocks.effect = effect;
  },
}));
vi.mock("@/lib/offline/store", () => ({
  visibleSessions: mocks.visibleSessions,
}));
vi.mock("@/lib/offline/sync", () => ({
  synchronizePreparedShifts: mocks.synchronize,
}));
vi.mock("@/lib/offline/install-prompt", () => ({
  captureInstallPrompt: vi.fn(),
}));
import { PwaProvider } from "./pwa-provider";

let cleanup: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { visibilityState: "visible" }),
  );
  vi.stubGlobal("navigator", {});
  mocks.visibleSessions.mockReset().mockResolvedValue([{ id: "prepared" }]);
  mocks.synchronize.mockReset().mockResolvedValue(undefined);
  PwaProvider();
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each(["storage", "sync"])(
  "continues automatic retries after a transient %s failure",
  async (failure) => {
    (failure === "storage"
      ? mocks.visibleSessions
      : mocks.synchronize
    ).mockRejectedValueOnce(new Error("Temporary failure"));
    cleanup = mocks.effect!();
    await vi.advanceTimersByTimeAsync(0);
    const attempts = mocks.synchronize.mock.calls.length;
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mocks.synchronize).toHaveBeenCalledTimes(attempts + 1);
    expect(vi.getTimerCount()).toBe(1);
    cleanup();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(mocks.synchronize).toHaveBeenCalledTimes(attempts + 1);
  },
);

it("keeps one polling loop when resume events overlap an in-flight sync", async () => {
  let finish!: () => void;
  mocks.synchronize.mockReturnValueOnce(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  cleanup = mocks.effect!();
  await vi.advanceTimersByTimeAsync(0);
  window.dispatchEvent(new Event("online"));
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.synchronize).toHaveBeenCalledTimes(1);
  finish();
  await vi.advanceTimersByTimeAsync(0);
  expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(30_000);
  expect(mocks.synchronize).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(1);
});
