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
      requireOfflineShell(session.snapshot.schemaVersion),
      loadOpeningDraft(session.id),
    ]).then(
      ([, saved]) => {
        if (current)
          setDraft(
            session.snapshot.schemaVersion === 1
              ? { ...saved, cash: "0" }
              : saved,
          );
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
  }, [session.id, session.snapshot.schemaVersion, attempt]);
  const persist = useCallback(
    async (next: OpeningDraft) => {
      await saveOpeningDraft(session.id, next).then(
        () => setSaveError(""),
        () => {
          const message =
            "Your latest entries couldn't be saved. Free device storage and retry before leaving.";
          setSaveError(message);
          throw new Error(message);
        },
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
      {session.snapshot.schemaVersion === 1 ? (
        <p className="mx-auto max-w-3xl border-y py-3 text-sm text-muted-foreground">
          Legacy shift: opening float remains zero. Its original journal version
          is unchanged.
        </p>
      ) : null}
      {saveError ? (
        <p role="alert" className="mx-auto max-w-3xl text-sm text-destructive">
          {saveError}
        </p>
      ) : null}
      <ShiftCountWorkflow
        mode="start"
        legacyFloat={session.snapshot.schemaVersion === 1}
        shiftId={session.snapshot.shiftId}
        items={session.snapshot.inventory.map((item) => ({
          ...item,
          initialQuantity: "",
        }))}
        opening={{
          draft,
          onChange: persist,
          onSubmit: async (next) => {
            await requireOfflineShell(session.snapshot.schemaVersion);
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
