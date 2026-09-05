"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ShiftCountWorkflow } from "@/components/employee/shift-count-workflow";
import { Button } from "@/components/ui/button";
import {
  loadOpeningDraft,
  saveOpeningDraft,
  submitPreparedOpening,
  type OpeningDraft,
} from "@/lib/offline/opening-draft";
import { requireOfflineShell } from "@/lib/offline/readiness";
import { synchronizePreparedShifts } from "@/lib/offline/sync";
import type { LocalSession } from "@/lib/offline/store";

export function PreparedOpeningCounts({
  session,
  onDone,
}: {
  session: LocalSession;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<OpeningDraft>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    let current = true;
    setError("");
    setDraft(undefined);
    void Promise.all([
      requireOfflineShell(),
      loadOpeningDraft(session.id),
    ]).then(
      ([, saved]) => {
        if (current) setDraft(saved);
      },
      (failure) => {
        if (current)
          setError(
            failure instanceof Error
              ? failure.message
              : "Check device storage and retry.",
          );
      },
    );
    return () => {
      current = false;
    };
  }, [session.id, attempt]);
  const persist = useCallback(
    (next: OpeningDraft) => {
      void saveOpeningDraft(session.id, next).then(
        () => setSaveError(""),
        () =>
          setSaveError(
            "Your latest entries couldn't be saved. Free device storage and retry before leaving.",
          ),
      );
    },
    [session.id],
  );

  if (!draft)
    return (
      <div className="mx-auto max-w-3xl space-y-3 py-4">
        <p role={error ? "alert" : "status"} className="text-sm">
          {error || "Checking your saved shift…"}
        </p>
        {error ? (
          <Button
            variant="outline"
            onClick={() => setAttempt((value) => value + 1)}
          >
            <RefreshCw aria-hidden="true" />
            Retry
          </Button>
        ) : null}
      </div>
    );
  return (
    <div className="space-y-5">
      {saveError ? (
        <p role="alert" className="mx-auto max-w-3xl text-sm text-destructive">
          {saveError}
        </p>
      ) : null}
      <ShiftCountWorkflow
        mode="start"
        shiftId={session.snapshot.shiftId}
        items={session.snapshot.inventory.map((item) => ({
          ...item,
          initialQuantity: "",
        }))}
        opening={{
          draft,
          onChange: persist,
          onSubmit: async (next) => {
            await requireOfflineShell();
            await saveOpeningDraft(session.id, next);
            await submitPreparedOpening(session, next);
            void synchronizePreparedShifts().catch(() => {});
            onDone();
          },
        }}
      />
    </div>
  );
}
