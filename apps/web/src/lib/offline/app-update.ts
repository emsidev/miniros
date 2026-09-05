import { guardLocalExit, shiftStore } from "./store";

export async function activateAppUpdate(worker: ServiceWorker) {
  await guardLocalExit();
  if (await shiftStore().drafts.count()) {
    throw new Error("Finish or clear saved checkout drafts before updating.");
  }
  navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => location.reload(),
    { once: true },
  );
  worker.postMessage("ACTIVATE_UPDATE");
}
