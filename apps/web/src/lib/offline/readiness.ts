import { activateAppUpdate } from "./app-update";
import {
  OfflineReadinessError,
  repairOfflineCache,
  untilAborted,
  type ReadinessProgress,
  type ReadinessReport,
} from "./cache-repair";
export { OfflineReadinessError } from "./cache-repair";
export type { ReadinessProgress } from "./cache-repair";

const listeners = new Set<(value: ReadinessProgress) => void>();
let lastProgress: ReadinessProgress | undefined;
export function subscribeOfflineReadiness(
  listener: (value: ReadinessProgress) => void,
) {
  listeners.add(listener);
  if (lastProgress) listener(lastProgress);
  return () => {
    listeners.delete(listener);
  };
}
function progress(value: ReadinessProgress) {
  lastProgress = value;
  for (const listener of listeners) listener(value);
}
const checking = new Map<number, Promise<void>>();
export function requireOfflineShell(
  requiredContract: 1 | 2 = 2,
): Promise<void> {
  const current = checking.get(requiredContract);
  if (current) return current;
  const work = ensureShell(requiredContract).finally(() =>
    checking.delete(requiredContract),
  );
  checking.set(requiredContract, work);
  return work;
}

function checkWorker(
  worker: ServiceWorker,
  signal: AbortSignal,
): Promise<ReadinessReport> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      channel.port1.close();
      channel.port2.close();
    };
    const abort = () => {
      cleanup();
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new OfflineReadinessError(
          "timeout",
          "The offline check didn't respond. Keep MINIROS open and retry.",
          { ready: false, durationMs: Date.now() - started },
        ),
      );
    }, 15000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    channel.port1.onmessage = (event) => {
      cleanup();
      if (!event.data || typeof event.data.ready !== "boolean") {
        reject(
          new OfflineReadinessError(
            "build",
            "The app returned an invalid offline check. Retry to check for an update.",
          ),
        );
        return;
      }
      resolve({ ...event.data, durationMs: Date.now() - started });
    };
    try {
      worker.postMessage("CHECK_OFFLINE_READY", [channel.port2]);
    } catch {
      cleanup();
      reject(
        new OfflineReadinessError(
          "installation",
          "The offline worker stopped. Keep MINIROS open and retry.",
        ),
      );
    }
  });
}

async function updateWorker(
  registration: ServiceWorkerRegistration,
  signal: AbortSignal,
) {
  progress({ phase: "updating" });
  if (!registration.waiting) await untilAborted(registration.update(), signal);
  // update() may return before the new worker finishes installation.
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearInterval(timer);
      signal.removeEventListener("abort", finish);
    };
    const finish = () => {
      if (signal.aborted) {
        cleanup();
        reject(signal.reason);
      } else if (!registration.installing) {
        cleanup();
        resolve();
      }
    };
    const timer = setInterval(finish, 100);
    signal.addEventListener("abort", finish, { once: true });
    finish();
  });
  if (registration.waiting) {
    const worker = registration.waiting;
    let cancel = () => {};
    const changed = new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        navigator.serviceWorker.removeEventListener("controllerchange", done);
        signal.removeEventListener("abort", abort);
      };
      cancel = cleanup;
      const done = () => {
        cleanup();
        resolve();
      };
      const abort = () => {
        cleanup();
        reject(signal.reason);
      };
      navigator.serviceWorker.addEventListener("controllerchange", done, {
        once: true,
      });
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
    });
    void changed.catch(() => {});
    try {
      await untilAborted(activateAppUpdate(worker, false, signal), signal);
      await changed;
    } catch (failure) {
      throw new OfflineReadinessError(
        "update",
        failure instanceof Error
          ? failure.message
          : "Finish saved work before updating.",
      );
    } finally {
      cancel();
    }
  }
  if (!registration.active)
    throw new OfflineReadinessError(
      "installation",
      "Offline installation failed. Check your connection and retry.",
    );
  return registration.active;
}

async function ensureShell(requiredContract: 1 | 2) {
  if (!("serviceWorker" in navigator) || !("caches" in globalThis))
    throw new OfflineReadinessError(
      "unsupported",
      "This browser cannot save MINIROS offline. Open Safari or another supported browser with website storage enabled.",
    );
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new OfflineReadinessError(
          "timeout",
          "Offline setup took longer than 60 seconds. Keep MINIROS open, check your connection, then retry.",
        ),
      ),
    60000,
  );
  const { signal } = controller;
  try {
    progress({ phase: "installing" });
    let registration = await untilAborted(
      navigator.serviceWorker.getRegistration("/"),
      signal,
    );
    if (
      (!registration || !registration.active) &&
      process.env.NODE_ENV === "production"
    )
      registration = await untilAborted(
        navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        }),
        signal,
      );
    if (!registration)
      throw new OfflineReadinessError(
        "installation",
        "Offline installation requires the production app. Open the deployed MINIROS app and retry.",
      );
    if (!registration.active) {
      const candidate = registration.installing ?? registration.waiting;
      if (!candidate)
        throw new OfflineReadinessError(
          "installation",
          "Offline installation stopped before saving its files. Check your connection and retry setup.",
        );
      registration = await new Promise<ServiceWorkerRegistration>(
        (resolve, reject) => {
          const cleanup = () => {
            clearInterval(poll);
            candidate.removeEventListener("statechange", changed);
            signal.removeEventListener("abort", changed);
          };
          const changed = () => {
            if (signal.aborted) {
              cleanup();
              reject(signal.reason);
            } else if (registration!.active) {
              cleanup();
              resolve(registration!);
            } else if (candidate.state === "redundant") {
              cleanup();
              reject(
                new OfflineReadinessError(
                  "installation",
                  "Offline installation couldn't save all files. Keep MINIROS open, check your connection and device storage, then retry setup.",
                ),
              );
            }
          };
          const poll = setInterval(changed, 100);
          candidate.addEventListener("statechange", changed);
          signal.addEventListener("abort", changed, { once: true });
          changed();
        },
      );
    }

    let worker = registration.active;
    if (!worker)
      throw new OfflineReadinessError(
        "installation",
        "Offline installation failed. Check your connection and retry.",
      );
    let updated = false;
    for (;;) {
      progress({ phase: "checking" });
      try {
        let report = await checkWorker(worker, signal);
        if ((report.contractVersion ?? 1) < requiredContract)
          throw new OfflineReadinessError(
            "build",
            "This app needs a newer offline version before starting this shift.",
            report,
          );
        if (report.code === "storage")
          throw new OfflineReadinessError(
            "storage",
            "Offline storage is unavailable. Enable website storage and free device space, then retry. Keep MINIROS saved data.",
            report,
          );
        if (!report.ready) {
          await repairOfflineCache(report, signal, progress);
          const verified = await checkWorker(worker, signal);
          if (verified.code === "storage")
            throw new OfflineReadinessError(
              "storage",
              "Offline storage couldn't retain the repaired files. Enable website storage and free device space, then retry. Keep MINIROS saved data.",
              verified,
            );
          if (
            !verified.ready ||
            (verified.contractVersion ?? 1) < requiredContract
          )
            throw new OfflineReadinessError(
              "build",
              "Offline files are saved, but this worker cannot verify them. A safe app update is required.",
              verified,
            );
          report = verified;
        }
        if (registration.waiting && !updated) {
          updated = true;
          try {
            worker = await updateWorker(registration, signal);
            continue;
          } catch (failure) {
            if (signal.aborted) throw signal.reason;
            // An update guard must not strand saved work on a complete build.
            // Incomplete or incompatible old workers still require recovery.
            if (
              !(failure instanceof OfflineReadinessError) ||
              failure.code !== "update" ||
              !report.ready ||
              (report.contractVersion ?? 1) < requiredContract
            )
              throw failure;
          }
        }
        progress({ phase: "ready", version: report.version });
        return;
      } catch (failure) {
        if (signal.aborted) throw signal.reason;
        if (
          !updated &&
          failure instanceof OfflineReadinessError &&
          ["build", "timeout", "installation"].includes(failure.code)
        ) {
          updated = true;
          worker = await updateWorker(registration, signal);
          continue;
        }
        throw failure;
      }
    }
  } catch (failure) {
    if (signal.aborted) throw signal.reason;
    if (failure instanceof OfflineReadinessError) throw failure;
    throw new OfflineReadinessError(
      "installation",
      "Offline installation couldn't complete. Check your connection and retry.",
      {
        ready: false,
        error: failure instanceof Error ? failure.message : String(failure),
      },
    );
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}
