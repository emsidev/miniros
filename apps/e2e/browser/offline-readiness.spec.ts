import type { OfflineOperation } from "@miniros/contracts";
import { test, expect, type Page } from "@playwright/test";

type OfflineTest = typeof import("../../web/src/lib/offline/readiness") &
  typeof import("../../web/src/lib/offline/store") &
  typeof import("../../web/src/lib/offline/opening-draft") &
  typeof import("../../web/src/lib/offline/count-draft") &
  typeof import("../../web/src/lib/offline/sync") &
  typeof import("../../web/src/lib/offline/prepare");
declare global {
  interface Window {
    failInstallation: (reason: Error) => void;
    offlineTest: OfflineTest;
    harnessReady: boolean;
  }
}
async function harness(page: Page) {
  page.on("pageerror", (error) =>
    console.log("Browser script error:", error.message),
  );
  await page.goto("/__readiness");
  await page.waitForFunction(() => window.harnessReady, undefined, {
    timeout: 10000,
  });
  await page.evaluate(async () => {
    window.offlineTest = await import(
      /* webpackIgnore: true */ location.origin + "/__readiness.js"
    );
  });
}
async function check(page: Page) {
  await page.evaluate(async () => {
    await window.offlineTest.requireOfflineShell();
  });
}

test("production worker repairs an evicted chunk and cold-launches offline", async ({
  page,
  context,
  browser,
}, info) => {
  console.log(`${info.project.name}: ${browser.version()}`);
  await harness(page);
  await check(page);
  const version = await page.evaluate(async () => {
    const manifest = await (await fetch("/pwa-assets.json")).json();
    const name = `miniros-${manifest.version}`;
    await (await caches.open(name)).delete(manifest.assets[0]);
    return name;
  });
  await check(page);
  expect(
    await page.evaluate(async (version) => {
      const cache = await caches.open(version);
      const manifest = await (await cache.match("/pwa-assets.json", {
        ignoreVary: true,
      }))!.json();
      return Boolean(
        await cache.match(manifest.assets[0], { ignoreVary: true }),
      );
    }, version),
  ).toBe(true);
  await context.setOffline(true);
  await page.goto("/offline");
  await expect(
    page.getByRole("heading", { name: "My shifts", exact: true }),
  ).toBeVisible();
});

test("disposable shift keeps opening drafts and full journal through recovery and replay", async ({
  page,
  context,
}) => {
  await harness(page);
  const session = await page.evaluate(async () => {
    const api = window.offlineTest;
    return await api.prepareShiftOnDevice(crypto.randomUUID());
  });
  await context.setOffline(true);
  await page.evaluate(async (session) => {
    const api = window.offlineTest;
    const draft = await api.loadOpeningDraft(session.id);
    draft.counts[session.snapshot.inventory[0].id] = "10";
    draft.cash = "500";
    draft.notes = "Draft survives repair";
    draft.step = 2;
    await api.saveOpeningDraft(session.id, draft);
  }, session);
  await page.goto(`/offline?session=${session.id}&task=overview`);
  // Public shell uses actual production opening/count UI and real IndexedDB.
  await expect(
    page
      .getByRole("button", { name: /Start shift|Count opening stock/i })
      .first(),
  ).toBeVisible();
  await context.setOffline(false);
  // Let the public app's reconnect sync finish before unloading its page.
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const api = await import(
            /* webpackIgnore: true */ location.origin + "/__readiness.js"
          );
          return Boolean(await api.shiftStore().meta.get("syncLease"));
        }),
      { timeout: 65000 },
    )
    .toBe(false);
  await harness(page);
  const result = await page.evaluate(async (session) => {
    const api = window.offlineTest;
    const db = api.shiftStore();
    const draft = await api.loadOpeningDraft(session.id);
    await api.requireOfflineShell();
    const local = await db.sessions.get(session.id);
    if (!local) throw new Error("Prepared session missing");
    await Promise.all([
      api.submitPreparedOpening(local, draft),
      api.submitPreparedOpening(local, draft),
    ]);
    const saleId = crypto.randomUUID();
    const sale: OfflineOperation = {
      type: "CREATE_SALE",
      payload: {
        shiftId: session.snapshot.shiftId,
        saleId,
        inventoryEventId: crypto.randomUUID(),
        items: [
          {
            id: crypto.randomUUID(),
            productId: session.snapshot.products[0].id,
            quantity: 2,
            discountCents: 0,
          },
        ],
        payments: [
          {
            id: crypto.randomUUID(),
            paymentMethod: "cash",
            amountCents: 20000,
            referenceNumber: null,
          },
        ],
      },
      proofs: [],
    };
    await Promise.all([
      api.appendShiftAction(session.id, sale, saleId),
      api.appendShiftAction(session.id, sale, saleId),
    ]);
    await api.appendShiftAction(
      session.id,
      {
        type: "CREATE_INVENTORY_ADJUSTMENT",
        payload: {
          shiftId: session.snapshot.shiftId,
          adjustmentId: crypto.randomUUID(),
          inventoryEventId: crypto.randomUUID(),
          inventoryItemId: session.snapshot.inventory[0]!.id,
          quantityDelta: -1,
          reason: "Disposable damaged stock",
        },
      },
      crypto.randomUUID(),
    );
    const current = await db.sessions.get(session.id);
    if (!current) throw new Error("Started session missing");
    const closing = await api.loadClosingDraft(session.id);
    closing.counts[session.snapshot.inventory[0].id] = "7";
    closing.cash = "700";
    closing.step = 2;
    await api.saveClosingDraft(session.id, closing);
    await api.submitPreparedClosing(current, closing);
    await api.synchronizePreparedShifts();
    await api.synchronizePreparedShifts();
    const actions = await db.shiftActions
      .where("sessionId")
      .equals(session.id)
      .sortBy("sequence");
    return {
      draft,
      balance: current.projection.balances[session.snapshot.inventory[0]!.id],
      state: (await db.sessions.get(session.id))!.projection.state,
      actions: actions.map((action) => ({
        type: action.operation.type,
        status: action.status,
      })),
    };
  }, session);
  expect(result.draft.notes).toBe("Draft survives repair");
  expect(result.draft.cash).toBe("500");
  expect(result.actions.map((action) => action.type)).toEqual([
    "START_SHIFT",
    "CREATE_SALE",
    "CREATE_INVENTORY_ADJUSTMENT",
    "SUBMIT_CLOSEOUT",
  ]);
  await expect
    .poll(
      () =>
        page.evaluate(async (id) => {
          const api = window.offlineTest;
          await api.synchronizePreparedShifts();
          const actions = await api
            .shiftStore()
            .shiftActions.where("sessionId")
            .equals(id)
            .toArray();
          return actions.filter((action) => action.status !== "synced").length;
        }, session.id),
      { timeout: 65000 },
    )
    .toBe(0);
  expect(result.balance).toBe("7");
  expect(result.state).toBe("closing");
});

test("[render] preparation failure stays readable with reachable recovery", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        getRegistration: () =>
          new Promise((_resolve, reject) => {
            window.failInstallation = reject;
          }),
      },
    }),
  );
  await harness(page);
  await page
    .getByRole("button", { name: "Test preparation UI", exact: true })
    .click();
  const spinner = page.locator("svg.motion-safe\\:animate-spin");
  await expect(spinner).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await spinner.evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");
  await page.evaluate(() =>
    window.failInstallation(new Error("Disposable storage failure")),
  );
  await expect(
    page.getByRole("heading", { name: "Couldn't prepare this shift" }),
  ).toBeVisible({ timeout: 10000 });
  const retry = page.getByRole("button", { name: "Retry setup" });
  for (const width of [360, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(retry).toBeVisible();
    expect((await retry.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByText("Setup details", { exact: true }).click();
  await expect(page.getByText(/Stage: installation/)).toBeVisible();
  await retry.click();
  await expect(spinner).toBeVisible();
  await page.evaluate(() =>
    window.failInstallation(new Error("Disposable retry failure")),
  );
  await expect(page.getByRole("alert")).toContainText(
    "Offline installation couldn't complete",
  );
});

test("[worker] stale protocol updates to the production worker before readiness", async ({
  page,
}) => {
  await harness(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register(
      `/__stale-worker.js?test=${crypto.randomUUID()}`,
      { scope: "/", updateViaCache: "none" },
    );
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
    )
    .toContain("/__stale-worker.js");
  await check(page);
  expect(
    await page.evaluate(
      async () =>
        (
          await (
            await caches.open(
              `miniros-${(await (await fetch("/pwa-assets.json")).json()).version}`,
            )
          ).match("/pwa-assets.json")
        )?.ok,
    ),
  ).toBe(true);
});

test("[worker] compatible waiting update activates through existing guards", async ({
  page,
}) => {
  await harness(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register(
      `/__stale-worker.js?test=${crypto.randomUUID()}`,
      { scope: "/", updateViaCache: "none" },
    );
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
    )
    .toContain("/__stale-worker.js");
  await page.evaluate(() =>
    navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    }),
  );
  await expect
    .poll(() =>
      page.evaluate(async () =>
        Boolean((await navigator.serviceWorker.getRegistration("/"))?.waiting),
      ),
    )
    .toBe(true);
  await check(page);
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
    )
    .toContain("/sw.js");
});

test("[worker] recovery refuses waiting updates while saved work exists", async ({
  page,
}) => {
  await harness(page);
  const saved = await page.evaluate(async () => {
    const api = window.offlineTest;
    const session = await api.prepareShiftOnDevice(crypto.randomUUID());
    const draft = await api.loadOpeningDraft(session.id);
    draft.notes = "Keep this work";
    await api.saveOpeningDraft(session.id, draft);
    await navigator.serviceWorker.register(
      `/__stale-worker.js?test=${crypto.randomUUID()}`,
      { scope: "/", updateViaCache: "none" },
    );
    return { id: session.id, identity: await api.localInstallationId() };
  });
  await expect
    .poll(() =>
      page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
    )
    .toContain("/__stale-worker.js");
  await page.evaluate(() =>
    navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    }),
  );
  await expect
    .poll(() =>
      page.evaluate(async () =>
        Boolean((await navigator.serviceWorker.getRegistration("/"))?.waiting),
      ),
    )
    .toBe(true);
  const result = await page.evaluate(async (saved) => {
    const api = window.offlineTest;
    let code;
    try {
      await api.requireOfflineShell();
    } catch (failure) {
      code = (failure as { code: string }).code;
    }
    return {
      code,
      notes: (await api.loadOpeningDraft(saved.id)).notes,
      identity: await api.localInstallationId(),
      session: Boolean(await api.shiftStore().sessions.get(saved.id)),
    };
  }, saved);
  expect(result).toEqual({
    code: "update",
    notes: "Keep this work",
    identity: saved.identity,
    session: true,
  });
});

test("[worker] interrupted repair and storage failure stay retryable with repeated taps", async ({
  page,
}) => {
  await harness(page);
  await check(page);
  const result = await page.evaluate(async () => {
    const api = window.offlineTest;
    const manifest = await (await fetch("/pwa-assets.json")).json();
    const cache = await caches.open(`miniros-${manifest.version}`);
    const chunk = manifest.assets[0];
    await cache.delete(chunk, { ignoreVary: true });
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      if (input === chunk)
        throw new TypeError("Interrupted disposable download");
      return originalFetch(input, init);
    };
    let interrupted;
    try {
      await api.requireOfflineShell();
    } catch (failure) {
      interrupted = (failure as { code: string }).code;
    }
    window.fetch = originalFetch;
    const originalPut = Cache.prototype.put;
    Cache.prototype.put = async () => {
      throw new DOMException("Disposable quota", "QuotaExceededError");
    };
    let quota;
    try {
      await api.requireOfflineShell();
    } catch (failure) {
      quota = (failure as { code: string }).code;
    }
    Cache.prototype.put = originalPut;
    const first = api.requireOfflineShell();
    const shared = first === api.requireOfflineShell();
    await first;
    return {
      interrupted,
      quota,
      shared,
      saved: Boolean(await cache.match(chunk, { ignoreVary: true })),
    };
  });
  expect(result).toEqual({
    interrupted: "cache",
    quota: "storage",
    shared: true,
    saved: true,
  });
});

test("[worker] production readiness reply delayed eight seconds still succeeds", async ({
  page,
}) => {
  await harness(page);
  await check(page);
  await page.evaluate(() => {
    const Original = window.MessageChannel;
    window.MessageChannel = class extends Original {
      constructor() {
        super();
        const port = this.port1;
        Object.defineProperty(port, "onmessage", {
          set(handler) {
            port.addEventListener("message", (event) =>
              setTimeout(() => handler(event), 8000),
            );
            port.start();
          },
        });
      }
    };
  });
  await check(page);
});

test("[worker] opening confirmation reports repair failure and retains entered counts", async ({
  page,
}) => {
  await harness(page);
  const session = await page.evaluate(() =>
    window.offlineTest.prepareShiftOnDevice(crypto.randomUUID()),
  );
  await page.goto(`/offline?session=${session.id}&task=overview`);
  await page.getByRole("button", { name: "Start shift", exact: true }).click();
  await page.getByRole("textbox", { name: "Cup", exact: true }).fill("10");
  await page
    .getByRole("button", { name: "Continue to cash", exact: true })
    .click();
  await page.getByRole("textbox", { name: /Opening cash/i }).fill("500");
  await page
    .getByRole("button", {
      name: "Review counts",
      exact: true,
    })
    .click();
  await page.evaluate(async () => {
    const manifest = await (await fetch("/pwa-assets.json")).json();
    await (
      await caches.open(`miniros-${manifest.version}`)
    ).delete(manifest.assets[0], { ignoreVary: true });
    (
      window as unknown as { originalPut: typeof Cache.prototype.put }
    ).originalPut = Cache.prototype.put;
    Cache.prototype.put = async () => {
      throw new DOMException(
        "Disposable opening failure",
        "QuotaExceededError",
      );
    };
  });
  await page
    .getByRole("button", { name: "Start selling", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: /storage is full/ }),
  ).toBeVisible();
  await page.evaluate(() => {
    Cache.prototype.put = (
      window as unknown as { originalPut: typeof Cache.prototype.put }
    ).originalPut;
  });
  const saved = await page.evaluate(async (id) => {
    const api: OfflineTest = await import(
      /* webpackIgnore: true */ location.origin + "/__readiness.js"
    );
    return {
      draft: await api.loadOpeningDraft(id),
      state: (await api.shiftStore().sessions.get(id))!.projection.state,
    };
  }, session.id);
  expect(saved.state).toBe("prepared");
  expect(Number(saved.draft.counts[session.snapshot.inventory[0]!.id])).toBe(
    10,
  );
  expect(Number(saved.draft.cash)).toBe(500);
  await page
    .getByRole("button", { name: "Start selling", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sell", exact: true }),
  ).toBeVisible();
});

test("[worker] interrupted first installation retries without clearing storage", async ({
  page,
  context,
}) => {
  let interrupted = false;
  await context.route("**/_next/static/**", async (route) => {
    if (!interrupted && route.request().serviceWorker()) {
      interrupted = true;
      await route.abort("connectionfailed");
    } else await route.continue();
  });
  await harness(page);
  const failed = await page.evaluate(async () => {
    try {
      await window.offlineTest.requireOfflineShell();
      return "ready";
    } catch (failure) {
      return (failure as { code: string }).code;
    }
  });
  expect(interrupted).toBe(true);
  expect(failed).toBe("installation");
  await context.unroute("**/_next/static/**");
  await check(page);
});

test("[worker] failed durable readback cannot report a prepared session", async ({
  page,
}) => {
  await harness(page);
  const result = await page.evaluate(async () => {
    const api = window.offlineTest;
    const db = api.shiftStore();
    const get = db.sessions.get;
    db.sessions.get = (async () => undefined) as unknown as typeof get;
    let code;
    try {
      await api.prepareShiftOnDevice(crypto.randomUUID());
      code = "ready";
    } catch (failure) {
      code = (failure as { code: string }).code;
    } finally {
      db.sessions.get = get;
    }
    return { code, saved: await db.sessions.count() };
  });
  expect(result).toEqual({ code: "storage", saved: 1 });
});

test("[worker] guarded compatible update lets verified saved work continue", async ({
  page,
}) => {
  await harness(page);
  const session = await page.evaluate(async () => {
    const api = window.offlineTest;
    const saved = await api.prepareShiftOnDevice(crypto.randomUUID());
    const draft = await api.loadOpeningDraft(saved.id);
    draft.notes = "Continue this saved work";
    await api.saveOpeningDraft(saved.id, draft);
    await navigator.serviceWorker.register(
      `/__compatible-worker.js?test=${crypto.randomUUID()}`,
      { scope: "/", updateViaCache: "none" },
    );
    return saved;
  });
  await expect
    .poll(() =>
      page.evaluate(async () =>
        Boolean((await navigator.serviceWorker.getRegistration("/"))?.waiting),
      ),
    )
    .toBe(true);
  await page.evaluate(async () => {
    const manifest = await (await fetch("/pwa-assets.json")).json();
    await (
      await caches.open(`miniros-${manifest.version}`)
    ).delete(manifest.assets[0], { ignoreVary: true });
  });
  await check(page);
  const result = await page.evaluate(
    async (id) => ({
      notes: (await window.offlineTest.loadOpeningDraft(id)).notes,
      controller: new URL(navigator.serviceWorker.controller!.scriptURL)
        .pathname,
      waiting: Boolean(
        (await navigator.serviceWorker.getRegistration("/"))?.waiting,
      ),
    }),
    session.id,
  );
  expect(result).toEqual({
    notes: "Continue this saved work",
    controller: "/sw.js",
    waiting: true,
  });
});
