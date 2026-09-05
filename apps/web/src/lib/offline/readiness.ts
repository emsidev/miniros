export async function requireOfflineShell() {
  if (!("serviceWorker" in navigator))
    throw new Error(
      "This browser does not support offline installation. Open MINIROS in a supported browser.",
    );
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Offline files are not ready. Load the production app online and try again.",
            ),
          ),
        15000,
      ),
    ),
  ]);
  const worker = registration.active;
  if (!worker) throw new Error("Offline files are not ready yet.");
  const ready = await new Promise<boolean>((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      resolve(false);
    }, 5000);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data?.ready === true);
    };
    worker.postMessage("CHECK_OFFLINE_READY", [channel.port2]);
  });
  if (!ready)
    throw new Error(
      "Offline files are incomplete. Stay online and reload before preparing this device.",
    );
}
