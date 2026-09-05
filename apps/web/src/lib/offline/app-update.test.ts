import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { activateAppUpdate } from "./app-update";
import { clearLocalAccount, shiftStore } from "./store";
import { preparedFixture, uuid } from "@/test/offline-fixture";
import { emptyShiftProjection } from "@miniros/contracts";

const postMessage = vi.fn();
const addEventListener = vi.fn();
const worker = { postMessage } as unknown as ServiceWorker;
beforeEach(() => {
  vi.stubGlobal("navigator", { serviceWorker: { addEventListener } });
  vi.clearAllMocks();
});
afterEach(async () => {
  await clearLocalAccount();
  vi.unstubAllGlobals();
});

describe("app updates preserve local work", () => {
  it("does not activate while a prepared shift is unfinished", async () => {
    await shiftStore().sessions.add({
      ...preparedFixture(),
      projection: emptyShiftProjection(),
      nextSequence: 1,
    });
    await expect(activateAppUpdate(worker)).rejects.toThrow("prepared shifts");
    expect(postMessage).not.toHaveBeenCalled();
  });
  it("does not activate while payment proofs are queued", async () => {
    await shiftStore().proofs.add({
      id: uuid(),
      sessionId: uuid(),
      paymentId: uuid(),
      synced: 0,
      file: new File(["proof"], "proof.txt"),
    });
    await expect(activateAppUpdate(worker)).rejects.toThrow("proofs");
    expect(postMessage).not.toHaveBeenCalled();
  });
  it("preserves checkout drafts, including drafts outside the active checkout", async () => {
    await shiftStore().drafts.add({ id: "saved-checkout", value: {} });
    await expect(activateAppUpdate(worker)).rejects.toThrow("checkout drafts");
    expect(await shiftStore().drafts.count()).toBe(1);
    expect(postMessage).not.toHaveBeenCalled();
  });
  it("activates only after guarding work and reloads on the new controller", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { reload });
    await activateAppUpdate(worker);
    expect(postMessage).toHaveBeenCalledWith("ACTIVATE_UPDATE");
    expect(addEventListener).toHaveBeenCalledWith(
      "controllerchange",
      expect.any(Function),
      { once: true },
    );
    addEventListener.mock.calls[0]![1]();
    expect(reload).toHaveBeenCalledOnce();
  });
});
