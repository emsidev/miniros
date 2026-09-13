import { afterEach, describe, expect, it, vi } from "vitest";
import {
  repairOfflineCache,
  shellBuild,
  validateAssetManifest,
} from "./cache-repair";
import { requireOfflineShell, subscribeOfflineReadiness } from "./readiness";

const mocks = vi.hoisted(() => ({ activate: vi.fn() }));
vi.mock("./app-update", () => ({ activateAppUpdate: mocks.activate }));
const version = "test-build";
const chunk =
  "/_next/static/chunks/app/(workspace)/shifts/[shiftId]/page-abc.js";
const manifest = { version, assets: [chunk], shell: "/pwa-shell.html" };
const html = `<html><head><meta name="miniros-build" content="${version}"></head></html>`;
const response = (body: string) =>
  new Response(body, {
    headers: { "Content-Type": "text/plain", Vary: "Accept-Encoding" },
  });

function fixture(
  options: {
    missing?: boolean;
    legacy?: boolean;
    delay?: number;
    old?: boolean;
  } = {},
) {
  const records = new Map<string, Response>([
    [
      "/pwa-assets.json",
      response(JSON.stringify(options.legacy ? { assets: [chunk] } : manifest)),
    ],
    ["/offline", response(html)],
    ["/manifest.webmanifest", response("{}")],
    ["/icons/icon-192.png", response("icon")],
    [chunk, response("chunk")],
  ]);
  if (options.missing) records.delete(chunk);
  const cache = {
    match: vi.fn(async (path: string, options?: CacheQueryOptions) =>
      options?.ignoreVary ? records.get(path)?.clone() : undefined,
    ),
    put: vi.fn(async (path: string, value: Response) => {
      records.set(path, value.clone());
    }),
  };
  const ports: {
    close: ReturnType<typeof vi.fn>;
    onmessage?: (event: { data: unknown }) => void;
    target?: { onmessage?: (event: { data: unknown }) => void };
  }[] = [];
  class Channel {
    port1 = {
      close: vi.fn(),
      onmessage: undefined as ((event: { data: unknown }) => void) | undefined,
    };
    port2 = { close: vi.fn(), target: this.port1 };
    constructor() {
      ports.push(this.port1, this.port2);
    }
  }
  vi.stubGlobal("MessageChannel", Channel);
  const worker = (contractVersion: number) => ({
    postMessage: vi.fn((_message: string, targets: Channel["port2"][]) => {
      const reply = () =>
        targets[0]!.target.onmessage?.({
          data: {
            ready: records.has(chunk),
            version: `miniros-${version}`,
            contractVersion,
            missingFiles: records.has(chunk) ? [] : [chunk],
          },
        });
      if (options.delay) setTimeout(reply, options.delay);
      else queueMicrotask(reply);
    }),
  });
  const current = worker(2),
    old = worker(1);
  const registration = {
    active: options.old ? old : current,
    waiting: options.old ? current : null,
    installing: null,
    update: vi.fn().mockResolvedValue(undefined),
  };
  const events = new Map<string, () => void>();
  const container = {
    getRegistration: vi.fn().mockResolvedValue(registration),
    register: vi.fn().mockResolvedValue(registration),
    ready: Promise.resolve(registration),
    addEventListener: vi.fn((name: string, callback: () => void) =>
      events.set(name, callback),
    ),
    removeEventListener: vi.fn((name: string) => events.delete(name)),
  };
  vi.stubGlobal("navigator", { serviceWorker: container });
  vi.stubGlobal("caches", { open: vi.fn().mockResolvedValue(cache) });
  const fetch = vi.fn(async (path: string) =>
    response(
      path === "/pwa-assets.json"
        ? JSON.stringify(manifest)
        : path === "/pwa-shell.html"
          ? html
          : "downloaded chunk",
    ),
  );
  vi.stubGlobal("fetch", fetch);
  mocks.activate.mockImplementation(async () => {
    registration.active = current;
    registration.waiting = null;
    events.get("controllerchange")?.();
  });
  return {
    records,
    cache,
    ports,
    registration,
    container,
    fetch,
    current,
    events,
  };
}
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
describe("offline readiness recovery", () => {
  it("repairs an evicted chunk, rechecks and deduplicates repeated start taps", async () => {
    const f = fixture({ missing: true });
    const updates: string[] = [];
    const unsubscribe = subscribeOfflineReadiness((value) =>
      updates.push(value.phase),
    );
    const first = requireOfflineShell();
    expect(requireOfflineShell()).toBe(first);
    await first;
    unsubscribe();
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(f.records.has(chunk)).toBe(true);
    expect(f.current.postMessage).toHaveBeenCalledTimes(2);
    expect(updates).toContain("repairing");
    expect(updates.at(-1)).toBe("ready");
    expect(f.ports.every((port) => port.close.mock.calls.length === 1)).toBe(
      true,
    );
  });
  it("accepts legacy worker reports only with a matching network manifest", async () => {
    const f = fixture({ missing: true, legacy: true });
    await requireOfflineShell();
    expect(f.fetch).toHaveBeenCalledWith(
      "/pwa-assets.json",
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(
      JSON.parse(await f.records.get("/pwa-assets.json")!.text()).version,
    ).toBe(version);
  });
  it("repairs a malformed manifest from the matching build", async () => {
    const f = fixture({ missing: true });
    f.records.set("/pwa-assets.json", response("invalid JSON"));
    await requireOfflineShell();
    expect(f.fetch).toHaveBeenCalledTimes(2);
    expect(f.records.has(chunk)).toBe(true);
  });
  it("normalizes public Vary responses for legacy worker verification", async () => {
    const f = fixture();
    await repairOfflineCache(
      { ready: false, version: `miniros-${version}` },
      new AbortController().signal,
      () => {},
    );
    expect(f.records.get(chunk)!.headers.has("vary")).toBe(false);
    expect(f.records.get("/offline")!.headers.has("vary")).toBe(false);
    expect(f.fetch).not.toHaveBeenCalled();
  });
  it("bounds a hung cache write and cleans readiness ports", async () => {
    vi.useFakeTimers();
    const f = fixture({ missing: true });
    f.cache.put.mockImplementation(() => new Promise(() => {}));
    const result = expect(requireOfflineShell()).rejects.toMatchObject({
      code: "timeout",
    });
    await vi.advanceTimersByTimeAsync(60000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
    expect(f.ports.every((port) => port.close.mock.calls.length === 1)).toBe(
      true,
    );
  });
  it("does not treat an eight-second Safari reply as incomplete files", async () => {
    vi.useFakeTimers();
    const f = fixture({ delay: 8000 });
    const work = requireOfflineShell();
    await vi.advanceTimersByTimeAsync(8000);
    await work;
    expect(f.fetch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("activates a compatible waiting worker through saved-work guards", async () => {
    const f = fixture({ old: true });
    await requireOfflineShell();
    expect(mocks.activate).toHaveBeenCalledWith(
      f.current,
      false,
      expect.any(AbortSignal),
    );
    expect(f.events.size).toBe(0);
  });
  it("refuses updates with unfinished work and cleans controller listeners", async () => {
    const f = fixture({ old: true });
    mocks.activate.mockRejectedValue(
      new Error(
        "Synchronize and close or release prepared shifts before updating.",
      ),
    );
    await expect(requireOfflineShell()).rejects.toMatchObject({
      code: "update",
      message: expect.stringContaining("prepared shifts"),
    });
    expect(f.events.size).toBe(0);
    expect(f.records.has(chunk)).toBe(true);
  });
  it("continues verified saved work when a compatible waiting update is guarded", async () => {
    const f = fixture({ missing: true });
    f.registration.waiting = f.current;
    mocks.activate.mockRejectedValue(
      new Error("Finish saved work before updating."),
    );
    await requireOfflineShell();
    expect(mocks.activate).toHaveBeenCalledOnce();
    expect(f.registration.update).not.toHaveBeenCalled();
    expect(f.events.size).toBe(0);
    expect(f.records.has(chunk)).toBe(true);
    expect(f.fetch).toHaveBeenCalledTimes(2);
  });
  it("registers the production worker on a first visit", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const f = fixture();
    f.container.getRegistration.mockResolvedValue(undefined);
    await requireOfflineShell();
    expect(f.container.register).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  });
  it("recovers from a failed first installation without leaking timers", async () => {
    vi.useFakeTimers();
    vi.stubEnv("NODE_ENV", "production");
    const f = fixture();
    const candidate = {
      state: "redundant",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    Object.assign(f.registration, { active: null, installing: candidate });
    await expect(requireOfflineShell()).rejects.toMatchObject({
      code: "installation",
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(candidate.removeEventListener).toHaveBeenCalled();
    Object.assign(f.registration, { active: f.current, installing: null });
    await requireOfflineShell();
  });
  it("bounds the whole operation at 60 seconds and permits another retry", async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.container.getRegistration.mockImplementation(() => new Promise(() => {}));
    const work = requireOfflineShell();
    const result = expect(work).rejects.toMatchObject({
      code: "timeout",
      message: expect.stringContaining("60 seconds"),
    });
    await vi.advanceTimersByTimeAsync(60000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
    f.container.getRegistration.mockResolvedValue(f.registration);
    await requireOfflineShell();
  });
  it("reports storage failures without resetting installation or journals", async () => {
    const f = fixture({ missing: true });
    f.cache.put.mockRejectedValue(
      new DOMException("Storage full", "QuotaExceededError"),
    );
    await expect(requireOfflineShell()).rejects.toMatchObject({
      code: "storage",
    });
    expect(f.records.get("/offline")).toBeDefined();
    expect(mocks.activate).not.toHaveBeenCalled();
  });
  it("never reports ready after an interrupted download; retry repairs it", async () => {
    const f = fixture({ missing: true });
    f.fetch.mockRejectedValueOnce(new TypeError("Connection lost"));
    await expect(requireOfflineShell()).rejects.toMatchObject({
      code: "cache",
    });
    expect(f.records.has(chunk)).toBe(false);
    await requireOfflineShell();
    expect(f.records.has(chunk)).toBe(true);
  });
  it("requests a safe update when an old build's evicted file was removed", async () => {
    const f = fixture({ missing: true });
    f.fetch.mockImplementation(
      async () => new Response("Gone", { status: 404 }),
    );
    await expect(requireOfflineShell()).rejects.toMatchObject({
      code: "build",
    });
    expect(f.registration.update).toHaveBeenCalledTimes(1);
    expect(f.records.has(chunk)).toBe(false);
  });
  it("rejects a changed shell without overwriting the original build", async () => {
    const f = fixture();
    f.records.delete("/offline");
    f.fetch.mockImplementation(async (path) =>
      response(
        path === "/pwa-assets.json"
          ? JSON.stringify(manifest)
          : '<meta name="miniros-build" content="other-build">',
      ),
    );
    await expect(
      repairOfflineCache(
        { ready: false, version: `miniros-${version}` },
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toMatchObject({ code: "build" });
    expect(f.records.has("/offline")).toBe(false);
  });
});
it("rejects private, external, and cross-build manifest paths", () => {
  for (const assets of [
    ["/admin/reports.js"],
    ["https://external.test/code.js"],
    ["/_next/static/../../api/private.js"],
  ]) {
    expect(() =>
      validateAssetManifest({ version, assets }, `miniros-${version}`),
    ).toThrow();
  }
  expect(() =>
    validateAssetManifest(
      { ...manifest, version: "other" },
      `miniros-${version}`,
    ),
  ).toThrow();
  expect(
    shellBuild('<meta name="miniros-build" content="one">"b":"two"'),
  ).toBeUndefined();
  expect(
    shellBuild('self.__next_f.push([1,"0:{\\"b\\":\\"old-build\\"}"])'),
  ).toBe("old-build");
});
