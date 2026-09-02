"use client";

import { ErrorState } from "@/components/shared";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <ErrorState
        description={error.message || "The page could not be loaded."}
        retry={reset}
      />
    </main>
  );
}
