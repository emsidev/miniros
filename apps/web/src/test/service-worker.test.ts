import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
function worker() {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const records = new Map<string, Response>();
  let offline = false;
  let serverDown = false;
  const cache = {
    addAll: async (paths: string[]) => {
      if (offline) throw new Error("Interrupted install");
      for (const path of paths) records.set(path, new Response(path));
    },
    put: async (path: string, response: Response) => {
      records.set(path, response);
    },
    match: async (path: string | Request) =>
      records
        .get(typeof path === "string" ? path : new URL(path.url).pathname)
        ?.clone(),
  };
  const self = {
    addEventListener: (
      name: string,
      handler: (event: Record<string, unknown>) => void,
    ) => listeners.set(name, handler),
    location: { origin: "https://test.miniros.local" },
    clients: { claim: async () => {} },
    skipWaiting: () => {},
  };
  runInNewContext(
    readFileSync(
      fileURLToPath(new URL("../../pwa/sw.js", import.meta.url)),
      "utf8",
    ),
    {
      self,
      AbortController,
      setTimeout,
      clearTimeout,
      URL,
      Response,
      caches: { open: async () => cache, match: cache.match },
      fetch: async (input: string | Request) => {
        if (offline) throw new TypeError("Network unavailable");
        if (serverDown)
          return new Response("Server unavailable", { status: 503 });
        return new Response(
          typeof input === "string" && input.includes("pwa-assets")
            ? JSON.stringify({ assets: ["/_next/static/test.js"] })
            : "PRIVATE NETWORK RESPONSE",
        );
      },
    },
  );
  const install = async () => {
    let result: Promise<unknown> | undefined;
    listeners.get("install")!({
      waitUntil: (value: Promise<unknown>) => {
        result = value;
      },
    });
    await result;
  };
  const navigate = (path: string, mode = "navigate") => {
    let result: Promise<Response> | undefined;
    listeners.get("fetch")!({
      request: {
        url: `https://test.miniros.local${path}`,
        method: "GET",
        mode,
      },
      respondWith: (value: Promise<Response>) => {
        result = value;
      },
    });
    return result;
  };
  const ready = async () => {
    let result: Promise<unknown> | undefined;
    let value: { ready: boolean } | undefined;
    listeners.get("message")!({
      data: "CHECK_OFFLINE_READY",
      ports: [
        {
          postMessage: (reply: { ready: boolean }) => {
            value = reply;
          },
        },
      ],
      waitUntil: (promise: Promise<unknown>) => {
        result = promise;
      },
    });
    await result;
    return value?.ready;
  };
  return {
    install,
    navigate,
    ready,
    records,
    serverUnavailable: () => {
      serverDown = true;
    },
    disconnect: () => {
      offline = true;
    },
  };
}
describe("production offline shell boundaries", () => {
  it("cold-launches the installed root and operational URLs from the public shell", async () => {
    const sw = worker();
    await sw.install();
    sw.disconnect();
    expect(await (await sw.navigate("/"))?.text()).toBe("/offline");
    expect(await (await sw.navigate("/shifts/test/start"))?.text()).toBe(
      "/offline",
    );
  });
  it("does not intercept authenticated API or admin pages", async () => {
    const sw = worker();
    await sw.install();
    expect(sw.navigate("/api/offline/status", "cors")).toBeUndefined();
    expect(sw.navigate("/admin/reports")).toBeUndefined();
    expect([...sw.records.keys()]).not.toContain("/admin/reports");
  });
  it("keeps legacy device links available offline without caching private pages", async () => {
    const sw = worker();
    await sw.install();
    sw.disconnect();
    for (const path of [
      "/install?session=test",
      "/sync?session=test",
      "/offline?panel=sync&session=test",
      "/help",
    ]) {
      expect(await (await sw.navigate(path))?.text()).toBe("/offline");
    }
    expect([...sw.records.keys()]).not.toContain("/install");
    expect([...sw.records.keys()]).not.toContain("/sync");
  });
  it("withdraws readiness if any required chunk is missing", async () => {
    const sw = worker();
    await sw.install();
    expect(await sw.ready()).toBe(true);
    sw.records.delete("/_next/static/test.js");
    expect(await sw.ready()).toBe(false);
  });
  it("never reports ready after an interrupted installation", async () => {
    const sw = worker();
    sw.disconnect();
    await expect(sw.install()).rejects.toThrow();
    expect(await sw.ready()).toBe(false);
  });
  it("preserves server failures so they are not mistaken for offline navigation", async () => {
    const sw = worker();
    await sw.install();
    sw.serverUnavailable();
    const response = await sw.navigate("/");
    expect(response?.status).toBe(503);
    expect(await response?.text()).toBe("Server unavailable");
  });
});
