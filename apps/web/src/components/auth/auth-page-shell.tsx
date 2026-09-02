import Link from "next/link";
import { BrandMark } from "@/components/shared/brand-mark";
import { LegalLinks } from "@/components/shared/legal-links";

export function AuthPageShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1fr_0.9fr]">
      <section className="hidden bg-foreground p-12 text-background lg:flex lg:flex-col lg:justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 text-xl font-extrabold"
        >
          <BrandMark variant="inverse" className="size-11" />
          MINIROS
        </Link>
        <div className="max-w-xl space-y-5">
          <p className="text-sm font-semibold text-accent">
            Location-first retail operations
          </p>
          <h1 className="text-5xl leading-[1.03] font-extrabold tracking-[-0.03em]">
            Know if the booth was worth it.
          </h1>
          <p className="max-w-[60ch] text-lg leading-relaxed text-background/70">
            Bring sales, stock, staffing, rent, and closeout into one clear
            profitability view.
          </p>
        </div>
        <p className="text-sm text-background/50">
          Built for pop-ups, bazaars, kiosks, and small retail teams.
        </p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-10 flex items-center justify-center gap-2 font-extrabold lg:hidden"
          >
            <BrandMark className="size-9" />
            MINIROS
          </Link>
          {children}
          <LegalLinks className="mt-8 flex justify-center gap-4 text-xs text-muted-foreground" />
        </div>
      </section>
    </main>
  );
}
