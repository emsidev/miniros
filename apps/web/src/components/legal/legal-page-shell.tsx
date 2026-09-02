import Link from "next/link";
import { BrandMark } from "@/components/shared/brand-mark";
import { LegalLinks } from "@/components/shared/legal-links";

type LegalPageShellProps = Readonly<{
  eyebrow: string;
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}>;

export function LegalPageShell({
  eyebrow,
  title,
  lastUpdated,
  children,
}: LegalPageShellProps) {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-extrabold">
            <BrandMark className="size-9" />
            MINIROS
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Back to home
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <header className="border-b pb-8">
          <p className="text-sm font-semibold text-accent-foreground">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Last updated: {lastUpdated}
          </p>
        </header>

        <div className="mt-10 space-y-10 text-base leading-relaxed text-muted-foreground [&_h2]:scroll-mt-8 [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:pt-2 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-foreground [&_a]:font-semibold [&_a]:text-foreground [&_a]:underline-offset-4 [&_a:hover]:underline [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </div>
      </article>

      <footer className="border-t">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© 2026 MINIROS. Operated by Mc Joseph Agbanlog.</p>
          <LegalLinks className="flex items-center gap-4" />
        </div>
      </footer>
    </main>
  );
}
