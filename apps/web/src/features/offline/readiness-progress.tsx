"use client";
import { useEffect, useState } from "react";
import {
  subscribeOfflineReadiness,
  type ReadinessProgress,
} from "@/lib/offline/readiness";

export function useReadinessProgress() {
  const [progress, setProgress] = useState<ReadinessProgress>();
  useEffect(() => subscribeOfflineReadiness(setProgress), []);
  if (progress?.phase === "repairing")
    return `Saving offline files${progress.total ? ` (${progress.completed ?? 0} of ${progress.total})` : ""}… Keep MINIROS open.`;
  if (progress?.phase === "installing")
    return "Installing offline files… Keep MINIROS open.";
  if (progress?.phase === "updating")
    return "Checking for a safe app update… Your saved work stays on this device.";
  if (progress?.phase === "checking")
    return "Verifying offline files on this device…";
  return "Saving your shift on this device…";
}
