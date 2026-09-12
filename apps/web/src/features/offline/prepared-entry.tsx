"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useDevice } from "./device-context";
export function PreparedEntry({
  shiftId,
  task = "overview",
  fallback,
}: {
  fallback?: ReactNode;
  shiftId: string;
  task?: "overview" | "sell" | "close" | "inventory" | "sales";
}) {
  const { snapshot, loading, error, refresh } = useDevice();
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (loading) return;
    const row = snapshot.shifts.find(
      (row) => row.session.snapshot.shiftId === shiftId,
    );
    if (row)
      location.replace(`/offline?session=${row.session.id}&task=${task}`);
    else
      setMessage(
        "Open this shift on the device that prepared it. If saved data is missing, ask the owner to recover it.",
      );
  }, [snapshot, loading, shiftId, task]);
  if (message && !error && fallback)
    return (
      <>
        <p className="mb-4 border-y py-3 text-sm text-muted-foreground">
          Legacy online shift. Reconnect to save transactions; this shift is not
          prepared offline.
        </p>
        {fallback}
      </>
    );
  return (
    <section className="mx-auto max-w-3xl space-y-4 py-6">
      <h1 className="text-xl font-bold">Opening your shift</h1>
      <p role={message || error ? "alert" : "status"}>
        {error || message || "Checking saved work on this device…"}
      </p>
      {message || error ? (
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => {
              void refresh();
            }}
          >
            Retry
          </Button>
          <Button
            variant="outline"
            onClick={() => location.assign("/shifts?all=1")}
          >
            All shifts
          </Button>
        </div>
      ) : null}
    </section>
  );
}
