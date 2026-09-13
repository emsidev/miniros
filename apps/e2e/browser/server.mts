/** Local-only production-worker harness. Never publish this server or its disposable API fixtures. */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { preparedFixture } from "../../web/src/test/offline-fixture";
import {
  emptyShiftProjection,
  offlineEnvelopeSchema,
  projectOfflineOperation,
} from "@miniros/contracts";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const bundled = await build({
  stdin: {
    contents: `
    export * from "./apps/web/src/lib/offline/readiness";
    export * from "./apps/web/src/lib/offline/store";
    export * from "./apps/web/src/lib/offline/opening-draft";
    export * from "./apps/web/src/lib/offline/count-draft";
    export * from "./apps/web/src/lib/offline/sync";
    export * from "./apps/web/src/lib/offline/prepare";
    import { requireOfflineShell } from "./apps/web/src/lib/offline/readiness";
    import { prepareShiftOnDevice } from "./apps/web/src/lib/offline/prepare";
    import { createRoot } from "react-dom/client";
    import { createElement } from "react";
    import { PrepareShift } from "./apps/web/src/features/offline/prepare-shift";
    async function workerReport() {
      const registration = await navigator.serviceWorker.ready;
      return await new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        const cleanup = () => { clearTimeout(timer); channel.port1.close(); channel.port2.close(); };
        const timer = setTimeout(() => { cleanup(); reject(new Error("Diagnostic reply timed out")); }, 15000);
        channel.port1.onmessage = (event) => { cleanup(); resolve(event.data); };
        registration.active.postMessage("CHECK_OFFLINE_READY", [channel.port2]);
      });
    }
    window.harnessReady = true;
    if (document.getElementById("check")) {
    document.getElementById("check").onclick = async () => {
      try { await requireOfflineShell(); const report = await workerReport(); document.getElementById("result").textContent = "Offline setup verified · " + report.version + " · contract " + report.contractVersion; }
      catch (failure) { document.getElementById("result").textContent = failure.code + ": " + failure.message; }
    };
    document.getElementById("evict").onclick = async () => {
      const report = await workerReport();
      const cache = await caches.open(report.version);
      const keys = await cache.keys();
      const chunk = keys.find((key) => new URL(key.url).pathname.startsWith("/_next/static/"));
      if (chunk) await cache.delete(chunk, { ignoreVary: true });
      document.getElementById("result").textContent = "Removed one offline file";
    };
    document.getElementById("prepare").onclick = async () => {
      try { const session = await prepareShiftOnDevice(crypto.randomUUID()); document.getElementById("result").textContent = "Disposable shift saved: " + session.id; }
      catch (failure) { document.getElementById("result").textContent = failure.message; }
    };
    document.getElementById("ui").onclick = () => createRoot(document.getElementById("fixture")).render(createElement(PrepareShift, { shiftId: crypto.randomUUID() }));
    }
  `,
    resolveDir: root,
    loader: "tsx",
  },
  bundle: true,
  jsx: "automatic",
  nodePaths: [root + "apps/web/node_modules"],
  plugins: [
    {
      name: "local-only-server-actions",
      setup(builder) {
        builder.onResolve({ filter: /^next\/link$/ }, () => ({
          path: "fixture-link",
          namespace: "local-link",
        }));
        builder.onLoad({ filter: /.*/, namespace: "local-link" }, () => ({
          contents:
            'import {createElement} from "react"; export default function Link(props) { return createElement("a", props); }',
          loader: "js",
          resolveDir: root + "apps/web",
        }));
        builder.onResolve(
          { filter: /^@\/server\/actions\/operations$/ },
          () => ({ path: "fixture-operations", namespace: "local-fixture" }),
        );
        builder.onLoad({ filter: /.*/, namespace: "local-fixture" }, () => ({
          contents:
            'export async function uploadPaymentProofAction() { throw new Error("Legacy uploads are outside this local fixture"); } export const uploadDiscountProofAction = uploadPaymentProofAction;',
          loader: "js",
          resolveDir: root + "apps/web",
        }));
      },
    },
  ],
  format: "esm",
  platform: "browser",
  write: false,
  alias: { "@": root + "apps/web/src" },
  define: { "process.env.NODE_ENV": '"production"' },
});
const script = bundled.outputFiles[0]!.text;
const sessions = new Map<string, ReturnType<typeof preparedFixture>>();
const acknowledgements = new Map<string, object>();
const projections = new Map<string, ReturnType<typeof emptyShiftProjection>>();
const staleSeen = new Set<string>();
const legacyWorker = `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("message", event => {
  if (event.data === "CHECK_OFFLINE_READY") event.ports[0]?.postMessage({ ready: true, contractVersion: 1, version: "miniros-disposable-old" });
});`;
const productionHtml = await readFile(
  root + "apps/web/.next/server/app/offline.html",
  "utf8",
);
const stylesheets =
  productionHtml.match(/<link[^>]+rel="stylesheet"[^>]*>/g)?.join("") ?? "";
const page = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>MINIROS local browser test</title>${stylesheets}</head><body><h1>MINIROS local browser test</h1><p>Disposable data only. Production worker and app files; simulated financial API.</p><button id="check">Check offline setup</button><button id="evict">Remove one offline file</button><button id="prepare">Prepare disposable shift</button><button id="ui">Test preparation UI</button><p id="result" role="status"></p><div id="fixture"></div><script type="module" src="/__readiness.js"></script></body></html>`;
const server = createServer(async (request, response) => {
  try {
    const path = request.url!;
    const json = (body: unknown) => {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(body));
    };
    if (path === "/__readiness") {
      response.setHeader("Content-Type", "text/html");
      response.setHeader("Cache-Control", "no-store");
      response.end(page);
      return;
    }
    if (path === "/__readiness.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.setHeader("Cache-Control", "no-store");
      response.end(script);
      return;
    }
    if (path.startsWith("/__compatible-worker.js")) {
      response.setHeader("Content-Type", "application/javascript");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Service-Worker-Allowed", "/");
      response.end(
        (await readFile(root + "apps/web/public/sw.js", "utf8")) +
          `\n// Disposable waiting update: ${path}`,
      );
      return;
    }
    if (path.startsWith("/__stale-worker.js")) {
      response.setHeader("Content-Type", "application/javascript");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Service-Worker-Allowed", "/");
      // Each test URL starts with a legacy protocol, then serves the actual
      // production worker on update. No disposable worker is shipped by the app.
      response.end(
        staleSeen.has(path)
          ? await readFile(root + "apps/web/public/sw.js", "utf8")
          : legacyWorker,
      );
      staleSeen.add(path);
      return;
    }
    const storage = String(request.headers["x-miniros-storage"] ?? "");
    if (path.startsWith("/api/offline/")) {
      if (!storage) {
        response.statusCode = 400;
        json({ error: "Local fixture needs storage identity" });
        return;
      }
      let body = "";
      for await (const chunk of request) body += chunk;
      if (path === "/api/offline/prepare") {
        const target = JSON.parse(body).shiftId;
        let session = sessions.get(storage);
        if (!session) {
          session = preparedFixture();
          session.snapshot.schemaVersion = 2;
          session.snapshot.features = {
            recipesEnabled: false,
            promosEnabled: false,
            approvalsEnabled: false,
          };
          session.snapshot.recipes = [];
          session.snapshot.shiftId = target;
          session.snapshot.storageInstallationId = storage;
          session.snapshot.products[0]!.stockInventoryItemId =
            session.snapshot.inventory[0]!.id;
          sessions.set(storage, session);
        }
        json(session);
        return;
      }
      const session = sessions.get(storage);
      if (path === "/api/offline/status" && session) {
        json({
          userId: session.snapshot.userId,
          businessId: session.snapshot.businessId,
          deviceId: session.deviceId,
          sessions: [session],
        });
        return;
      }
      if (path === "/api/offline/sync" && session) {
        const envelope = offlineEnvelopeSchema.parse(JSON.parse(body));
        let reply = acknowledgements.get(envelope.id);
        if (!reply) {
          const projection = projectOfflineOperation(
            session.snapshot,
            projections.get(storage) ?? emptyShiftProjection(),
            envelope.operation,
          );
          projections.set(storage, projection);
          const expectedCashCents =
            (projection.openingCashCents ?? 0) +
            projection.cashCents -
            projection.deductionsCents;
          session.status =
            envelope.operation.type === "SUBMIT_CLOSEOUT" ? "closed" : "active";
          session.acknowledgedSequence = envelope.sequence;
          reply = {
            ok: true,
            sequence: envelope.sequence,
            sessionStatus: session.status,
            result:
              envelope.operation.type === "SUBMIT_CLOSEOUT"
                ? {
                    profitCents:
                      projection.salesCents -
                      projection.productCostCents -
                      projection.deductionsCents -
                      Object.values(session.snapshot.costs).reduce(
                        (total, cost) => total + cost,
                        0,
                      ),
                    expectedCashCents,
                    actualCashCents: envelope.operation.payload.actualCashCents,
                    cashDifferenceCents:
                      envelope.operation.payload.actualCashCents -
                      expectedCashCents,
                  }
                : {},
          };
          acknowledgements.set(envelope.id, reply);
        }
        json(reply);
        return;
      }
      response.statusCode = 401;
      json({ error: "No disposable session", code: "AUTH" });
      return;
    }
    const upstream = await fetch("http://127.0.0.1:4320" + path, {
      redirect: "manual",
    });
    response.statusCode = upstream.status;
    upstream.headers.forEach((value, name) => {
      if (
        !["content-encoding", "content-length", "transfer-encoding"].includes(
          name,
        )
      )
        response.setHeader(name, value);
    });
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (failure) {
    response.statusCode = 500;
    response.end(String(failure));
  }
});
const port = Number(process.env.MINIROS_BROWSER_TEST_PORT ?? 4321);
server.listen(port, "127.0.0.1", () =>
  console.log(`Local browser harness: http://127.0.0.1:${port}/__readiness`),
);
