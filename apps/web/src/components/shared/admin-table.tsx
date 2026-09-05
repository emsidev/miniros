import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminTable({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="w-full overflow-x-auto rounded-xl border bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <table
        className={cn(
          "w-full text-sm [&_thead]:bg-muted/60 [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3 [&_td]:tabular-nums",
          className,
        )}
      >
        <caption className="sr-only">{label}</caption>
        {children}
      </table>
    </div>
  );
}
