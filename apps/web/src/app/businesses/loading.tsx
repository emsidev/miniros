import { Skeleton } from "@/components/ui/skeleton";

export default function BusinessesLoading() {
  return (
    <div aria-label="Loading businesses">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-9 w-60" />
          <Skeleton className="h-5 w-full max-w-md" />
        </div>
        <Skeleton className="h-11 w-40 rounded-xl" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="space-y-5 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
