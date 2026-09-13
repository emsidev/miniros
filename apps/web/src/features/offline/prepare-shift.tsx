"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prepareShiftOnDevice } from "@/lib/offline/prepare";
import { OfflineReadinessError } from "@/lib/offline/readiness";
import { useReadinessProgress } from "./readiness-progress";

export function PrepareShift({ shiftId }: { shiftId: string }) {
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [diagnostics, setDiagnostics] = useState("");
  const message = useReadinessProgress();
  useEffect(() => {
    let current = true;
    setError("");
    setDiagnostics("");
    void prepareShiftOnDevice(shiftId).then(
      (session) => {
        if (current)
          location.replace(`/offline?session=${session.id}&task=overview`);
      },
      (failure) => {
        if (current) {
          if (failure instanceof OfflineReadinessError) {
            const report = failure.report;
            setDiagnostics(
              [
                `Stage: ${failure.code}`,
                report?.version && `Worker: ${report.version}`,
                report?.contractVersion &&
                  `Contract: ${report.contractVersion}`,
                report?.durationMs !== undefined &&
                  `Check: ${report.durationMs} ms`,
                report?.missingFiles?.length &&
                  `Missing: ${report.missingFiles.join(", ")}`,
                report?.error && `Detail: ${report.error}`,
              ]
                .filter(Boolean)
                .join(" · "),
            );
          }
          if (
            !(failure instanceof OfflineReadinessError) &&
            failure instanceof Error
          )
            setDiagnostics(`Stage: preparation · Detail: ${failure.message}`);
          setError(
            failure instanceof OfflineReadinessError
              ? failure.message
              : "Couldn't save this shift. Check your connection and device storage, then retry.",
          );
        }
      },
    );
    return () => {
      current = false;
    };
  }, [shiftId, attempt]);

  return (
    <section
      className="mx-auto max-w-3xl space-y-4 rounded-xl border bg-card p-5 sm:p-6"
      aria-label="Offline readiness"
    >
      <div className="flex items-start gap-3">
        {error ? (
          <CircleAlert
            className="mt-0.5 size-5 shrink-0 text-warning"
            aria-hidden="true"
          />
        ) : (
          <LoaderCircle
            className="mt-0.5 size-5 shrink-0 motion-safe:animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0">
          <h2 className="font-semibold">
            {error
              ? "Couldn't prepare this shift"
              : "Getting your shift ready…"}
          </h2>
          <p
            className="mt-1 text-sm tabular-nums text-muted-foreground"
            role={error ? "alert" : undefined}
            aria-live={error ? "assertive" : "polite"}
            aria-atomic="true"
          >
            {error || message}
          </p>
        </div>
      </div>
      {error ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-12"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Retry setup
          </Button>
          <Button asChild variant="ghost" className="min-h-12">
            <Link href={`/shifts/${shiftId}`}>Back to shift</Link>
          </Button>
        </div>
      ) : null}
      {error && diagnostics ? (
        <details className="text-sm text-muted-foreground">
          <summary className="min-h-12 cursor-pointer py-3">
            Setup details
          </summary>
          <p className="break-words">{diagnostics}</p>
        </details>
      ) : null}
    </section>
  );
}
