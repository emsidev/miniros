import { guardLocalExit, shiftStore } from "./store";

export async function activateAppUpdate(
  worker: ServiceWorker,
  reload = true,
  signal?: AbortSignal,
) {
  await guardLocalExit();
  if (await shiftStore().drafts.count()) {
    throw new Error("Finish or clear saved checkout drafts before updating.");
  }
  signal?.throwIfAborted();
  if (reload)
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => location.reload(),
      { once: true },
    );
  worker.postMessage("ACTIVATE_UPDATE");
}
