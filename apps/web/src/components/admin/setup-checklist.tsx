import Link from "next/link";
import type { getSetupReadiness } from "@/server/services/setup-readiness";
export function SetupChecklist({
  readiness,
}: {
  readiness: Awaited<ReturnType<typeof getSetupReadiness>>;
}) {
  if (readiness.complete) return null;
  const done = readiness.steps.filter((step) => step.done).length;
  return (
    <section
      aria-labelledby="setup-heading"
      className="rounded-xl border bg-card p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="setup-heading" className="text-lg font-bold">
          Get to your first location result
        </h2>
        <p className="text-sm text-muted-foreground">
          {done} of {readiness.steps.length} ready
        </p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Your progress follows the business records. Recipes and central
        production are optional; add them when your products need them.
      </p>
      <ol className="mt-4 divide-y">
        {readiness.steps.map((step) => (
          <li key={step.href}>
            <Link
              className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm"
              href={step.href}
            >
              <span>{step.label}</span>
              <span className="shrink-0 font-semibold">
                {step.done ? "Ready ✓" : "Continue →"}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
