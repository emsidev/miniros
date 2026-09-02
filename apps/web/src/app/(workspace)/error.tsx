"use client";

import { ErrorState } from "@/components/shared/feedback";

export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      description="We could not load this workspace. Check your connection and try again."
      retry={reset}
    />
  );
}
