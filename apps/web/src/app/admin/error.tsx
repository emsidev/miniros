"use client";

import { ErrorState } from "@/components/shared/feedback";

export default function AdminError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Could not load admin setup"
      description="We could not load this business workspace. Check your connection and try again."
      retry={reset}
    />
  );
}
