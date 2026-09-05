export type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
let pending: InstallEvent | undefined;
export const pendingInstallPrompt = () => pending;
export function captureInstallPrompt(event: Event) {
  event.preventDefault();
  pending = event as InstallEvent;
  window.dispatchEvent(new Event("miniros-install-available"));
}
export function clearInstallPrompt() {
  pending = undefined;
}
