"use client";

import { ErrorState } from "@/components/shared/feedback";

export default function PosError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="Point of sale unavailable"
      description="We could not load the point of sale. Check your connection and try again."
      retry={reset}
    />
  );
}
