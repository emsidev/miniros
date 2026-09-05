"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prepareShiftOnDevice } from "@/lib/offline/prepare";

export function PrepareShift({ shiftId }: { shiftId: string }) {
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    setError("");
    void prepareShiftOnDevice(shiftId).then(
      (session) => {
        if (current) location.replace(`/offline?session=${session.id}`);
      },
      (failure) => {
        if (current)
          setError(
            failure instanceof Error
              ? failure.message
              : "Couldn't save this shift. Check your connection and device storage, then retry.",
          );
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
            className="mt-0.5 size-5 shrink-0 motion-safe:animate-spin"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0">
          <h2 className="font-semibold" role="status">
            {error ? "This shift isn't ready yet" : "Getting your shift ready…"}
          </h2>
          <p
            className="mt-1 text-sm text-muted-foreground"
            role={error ? "alert" : undefined}
          >
            {error ||
              "Saving what you need to count stock, sell, and close out on this device."}
          </p>
        </div>
      </div>
      {error ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAttempt((value) => value + 1)}>
            Retry
          </Button>
          <Button asChild variant="ghost">
            <Link href={`/shifts/${shiftId}`}>Back to shift</Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
