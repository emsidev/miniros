import Link from "next/link";
import { cn } from "@/lib/utils";
import { ShiftNavigationScope } from "./navigation-context";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/shared/feedback";
import { formatDate } from "@/lib/format";

export function ShiftContext({
  shift,
  title,
  backHref,
  backLabel = "Back to shift",
  onBack,
  compact = false,
}: {
  shift: {
    id: string;
    locationName: string;
    shiftDate?: string | Date;
    status: string;
    title?: string | null;
    assignmentStatus?: string;
  };
  title: string;
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
  compact?: boolean;
}) {
  return (
    <header
      className={
        compact
          ? "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2 border-b pb-3"
          : "space-y-2 border-b pb-4"
      }
    >
      <ShiftNavigationScope
        id={shift.id}
        status={
          shift.assignmentStatus &&
          !["assigned", "confirmed"].includes(shift.assignmentStatus)
            ? "unavailable"
            : shift.status
        }
      />
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground",
            compact && "row-span-2",
          )}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {backLabel}
        </button>
      ) : (
        <Link
          href={backHref ?? `/shifts/${shift.id}`}
          className={cn(
            "inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground",
            compact && "row-span-2",
          )}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {backLabel}
        </Link>
      )}
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 break-words text-xl font-extrabold tracking-tight sm:text-2xl">
          {title}
        </h1>
        <StatusBadge status={shift.status} />
      </div>
      <div
        className={cn(
          "flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground",
          compact && "col-start-2",
        )}
      >
        <p className="flex min-w-0 items-center gap-2">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span className="break-words">{shift.locationName}</span>
        </p>
        <p className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
          {shift.shiftDate ? formatDate(shift.shiftDate) : "Date unavailable"}
        </p>
      </div>
    </header>
  );
}
