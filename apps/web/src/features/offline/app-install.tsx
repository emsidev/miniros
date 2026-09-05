"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Download,
  Ellipsis,
  PlusSquare,
  Share,
  Monitor,
  Smartphone,
} from "lucide-react";
import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  clearInstallPrompt,
  pendingInstallPrompt,
  type InstallEvent,
} from "@/lib/offline/install-prompt";

type Platform = "ios" | "android" | "desktop";
const instructions = {
  ios: [
    { icon: Share, text: "In Safari, open the Share menu." },
    { icon: PlusSquare, text: "Tap Add to Home Screen." },
    { icon: Check, text: "Turn on Open as Web App if shown, then tap Add." },
  ],
  android: [
    { icon: Ellipsis, text: "In Chrome, open the browser menu." },
    { icon: PlusSquare, text: "Tap Add to Home screen." },
    { icon: Download, text: "Choose Install, then confirm." },
  ],
  desktop: [
    { icon: Monitor, text: "Open MINIROS in Chrome or Edge." },
    { icon: Download, text: "Select the install icon in the address bar." },
    { icon: Check, text: "Choose Install to add the app." },
  ],
};

export function AppInstall() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [prompt, setPrompt] = useState<InstallEvent>();
  const [installed, setInstalled] = useState(false);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(
      /iPad|iPhone|iPod/.test(ua) ||
        (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
        ? "ios"
        : /Android/.test(ua)
          ? "android"
          : "desktop",
    );
    const display = matchMedia("(display-mode: standalone)");
    const detect = () =>
      setInstalled(
        display.matches ||
          Boolean(
            (navigator as Navigator & { standalone?: boolean }).standalone,
          ),
      );
    const onInstalled = () => {
      setInstalled(true);
      clearInstallPrompt();
      setPrompt(undefined);
    };
    const available = () => setPrompt(pendingInstallPrompt());
    detect();
    available();
    display.addEventListener("change", detect);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("miniros-install-available", available);
    return () => {
      display.removeEventListener("change", detect);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("miniros-install-available", available);
    };
  }, []);

  async function install() {
    if (!prompt || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setMessage(
        choice.outcome === "accepted"
          ? "Installation requested. Follow your browser's prompt."
          : "You can install later. Keep using MINIROS in your browser.",
      );
    } catch {
      setMessage("Couldn't open the installer. Use the steps below.");
    } finally {
      clearInstallPrompt();
      setPrompt(undefined);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BrandMark className="size-12" />
        <div>
          <p className="font-semibold">MINIROS</p>
          <p className="text-sm text-muted-foreground">
            {installed
              ? "Running as an installed app"
              : "Open directly from your home screen."}
          </p>
        </div>
        {installed ? (
          <Check className="ml-auto size-5 text-success" aria-hidden="true" />
        ) : null}
      </div>
      {!installed && prompt && !manual ? (
        <div className="space-y-2">
          <Button className="w-full" disabled={busy} onClick={install}>
            <Download aria-hidden="true" />
            {busy ? "Opening installer…" : "Install app"}
          </Button>
          <Button
            className="w-full"
            variant="ghost"
            onClick={() => setManual(true)}
          >
            Other install options
          </Button>
        </div>
      ) : null}
      {!installed && (!prompt || manual) ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="install-platform">Your device</Label>
            <select
              id="install-platform"
              className="min-h-11 rounded-lg border bg-background px-3 text-sm"
              value={platform}
              onChange={(event) => setPlatform(event.target.value as Platform)}
            >
              <option value="ios">iPhone or iPad</option>
              <option value="android">Android</option>
              <option value="desktop">Computer</option>
            </select>
          </div>
          <ol className="divide-y rounded-xl border">
            {instructions[platform].map(({ icon: Icon, text }, index) => (
              <li key={text} className="flex items-start gap-3 px-4 py-4">
                <span className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <Icon
                  className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{text}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            No install option? You can keep using MINIROS in this browser.
          </p>
        </div>
      ) : null}
      <p className="flex items-start gap-2 border-t pt-4 text-sm text-muted-foreground">
        <Smartphone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        To work offline, open Start shift while connected. Your shift saves
        automatically on this device before you count opening stock.
      </p>
      <p className="text-sm text-muted-foreground">
        Owners and admins can review shift devices and recover an original
        device from Devices in the business-tools menu.
      </p>
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
