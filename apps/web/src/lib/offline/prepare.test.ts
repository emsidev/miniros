import { afterEach, describe, expect, it, vi } from "vitest";
import { preparedFixture } from "@/test/offline-fixture";

const mocks = vi.hoisted(() => ({
  shell: vi.fn(),
  save: vi.fn(),
  get: vi.fn(),
  installation: vi.fn(),
}));
vi.mock("./readiness", () => ({ requireOfflineShell: mocks.shell }));
vi.mock("./store", () => ({
  localInstallationId: mocks.installation,
  savePreparedShift: mocks.save,
  shiftStore: () => ({ sessions: { get: mocks.get } }),
}));
import { prepareShiftOnDevice } from "./prepare";

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});
function setup() {
  const session = preparedFixture();
  mocks.shell.mockResolvedValue(undefined);
  mocks.save.mockResolvedValue(undefined);
  mocks.get.mockResolvedValue(session);
  mocks.installation.mockResolvedValue(session.snapshot.storageInstallationId);
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => session });
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("navigator", {
    storage: { persist: vi.fn().mockResolvedValue(false) },
  });
  return { session, fetch };
}
describe("automatic preparation coordinator", () => {
  it("checks app files before reserving and deduplicates concurrent mounts", async () => {
    const { session, fetch } = setup();
    const first = prepareShiftOnDevice(session.snapshot.shiftId);
    expect(prepareShiftOnDevice(session.snapshot.shiftId)).toBe(first);
    expect(await first).toBe(session);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.shell).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]![1].headers["x-miniros-storage"]).toBe(
      session.snapshot.storageInstallationId,
    );
  });
  it("never reserves a shift when the app files are unavailable", async () => {
    const { session, fetch } = setup();
    mocks.shell.mockRejectedValue(new Error("Offline files incomplete"));
    await expect(
      prepareShiftOnDevice(session.snapshot.shiftId),
    ).rejects.toThrow("incomplete");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("retries the original reservation after a failed local save", async () => {
    const { session, fetch } = setup();
    mocks.save.mockRejectedValueOnce(new Error("Storage full"));
    await expect(
      prepareShiftOnDevice(session.snapshot.shiftId),
    ).rejects.toThrow("Storage full");
    expect(await prepareShiftOnDevice(session.snapshot.shiftId)).toBe(session);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("never marks a server reservation ready if it cannot be read locally", async () => {
    const { session } = setup();
    mocks.get.mockResolvedValue(undefined);
    await expect(
      prepareShiftOnDevice(session.snapshot.shiftId),
    ).rejects.toThrow("could not be saved");
  });
  it("retries after a lost response without selecting another shift", async () => {
    const { session, fetch } = setup();
    fetch.mockRejectedValueOnce(new Error("Connection lost"));
    await expect(
      prepareShiftOnDevice(session.snapshot.shiftId),
    ).rejects.toThrow("Connection lost");
    expect(await prepareShiftOnDevice(session.snapshot.shiftId)).toBe(session);
  });
});
