import { LoadingSkeleton } from "@/components/shared";

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <LoadingSkeleton rows={4} />
    </main>
  );
}
