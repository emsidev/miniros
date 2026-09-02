import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  variant = "primary",
}: {
  className?: string;
  variant?: "primary" | "inverse";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-[var(--mi-radius-md)]",
        variant === "primary"
          ? "bg-[var(--mi-color-ink)] text-[var(--mi-color-accent)]"
          : "bg-[var(--mi-color-accent)] text-[var(--mi-color-ink)]",
        className,
      )}
    >
      <svg viewBox="0 0 512 512" className="size-7" role="presentation">
        <path
          d="M112 344V168h62l82 94 82-94h62v176h-64v-82l-80 88-80-88v82z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
