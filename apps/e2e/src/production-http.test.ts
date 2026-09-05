import { describe, expect, it } from "vitest";
const base = process.env.MINIROS_PREVIEW_URL;
describe.skipIf(!base)("production public shell and API boundary", () => {
  it("serves installable PNG assets and a versioned service worker", async () => {
    const manifest = await (await fetch(`${base}/manifest.webmanifest`)).json();
    expect(manifest).toMatchObject({
      id: "/",
      scope: "/",
      start_url: "/",
      display: "standalone",
    });
    for (const icon of manifest.icons) {
      const response = await fetch(new URL(icon.src, base));
      expect(response.status).toBe(200);
      expect([
        ...new Uint8Array(await response.arrayBuffer()).slice(0, 8),
      ]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    }
    const worker = await fetch(`${base}/sw.js`);
    expect(worker.status).toBe(200);
    expect(worker.headers.get("cache-control")).toContain("no-store");
    expect(await worker.text()).not.toContain("__BUILD_ID__");
    const assets = await (await fetch(`${base}/pwa-assets.json`)).json();
    expect(assets.assets.length).toBeGreaterThan(0);
    expect(
      assets.assets.every((path: string) => path.startsWith("/_next/static/")),
    ).toBe(true);
  });
  it("renders the public offline shell without an authenticated page cache", async () => {
    for (const path of [
      "/offline",
      "/offline?panel=install",
      "/offline?panel=sync",
    ]) {
      const response = await fetch(`${base}${path}`);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("<main");
      expect(html).not.toContain("user-scalable=no");
    }
  });
  it("redirects retired help pages to their integrated destinations", async () => {
    for (const [path, destination] of [
      ["/help", "/shifts"],
      ["/install?session=test", "/offline?panel=install&session=test"],
      ["/sync?session=test", "/offline?panel=sync&session=test"],
    ]) {
      const response = await fetch(`${base}${path}`, { redirect: "manual" });
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(destination);
    }
  });
  it("rejects cross-origin preparation before any mutation", async () => {
    const response = await fetch(`${base}/api/offline/prepare`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://unrelated.example",
      },
      body: JSON.stringify({ shiftId: "00000000-0000-4000-8000-000000000000" }),
    });
    expect(response.status).toBe(403);
    expect((await response.json()).ok).toBe(false);
  });
});
