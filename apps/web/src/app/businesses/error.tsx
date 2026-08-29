"use client";

import { ErrorState } from "@/components/shared/feedback";

export default function BusinessesError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Could not load businesses"
      description="We could not load your workspaces. Check your connection and try again."
      retry={reset}
    />
  );
}
