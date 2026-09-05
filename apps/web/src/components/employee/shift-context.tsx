import Link from "next/link";
import { ShiftNavigationScope } from "./navigation-context";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/shared/feedback";
import { formatDate } from "@/lib/format";

export function ShiftContext({
  shift,
  title,
  backHref,
  backLabel = "Back to shift",
}: {
  shift: {
    id: string;
    locationName: string;
    shiftDate: string | Date;
    status: string;
    title?: string | null;
    assignmentStatus?: string;
  };
  title: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="space-y-4">
      <ShiftNavigationScope
        id={shift.id}
        status={
          shift.assignmentStatus &&
          !["assigned", "confirmed"].includes(shift.assignmentStatus)
            ? "unavailable"
            : shift.status
        }
      />
      <Link
        href={backHref ?? `/shifts/${shift.id}`}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {backLabel}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 break-words text-2xl font-extrabold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <StatusBadge status={shift.status} />
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <p className="flex min-w-0 items-center gap-2">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span className="break-words">{shift.locationName}</span>
        </p>
        <p className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
          {formatDate(shift.shiftDate)}
        </p>
      </div>
    </header>
  );
}
