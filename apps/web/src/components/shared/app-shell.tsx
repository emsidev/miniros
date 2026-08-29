import Link from "next/link";
import type { ReactNode } from "react";
import { Store } from "lucide-react";
import { MobileBottomNav } from "./mobile-bottom-nav";

export function AppShell({
  children,
  businessName,
}: {
  children: ReactNode;
  businessName?: string;
}) {
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/shifts"
            className="flex items-center gap-2 font-extrabold tracking-tight"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-foreground text-accent">
              <Store className="size-5" aria-hidden="true" />
            </span>
            MINIROS
          </Link>
          {businessName ? (
            <Link
              href="/businesses"
              className="rounded-full bg-card px-3 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-border"
            >
              {businessName}
            </Link>
          ) : null}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  );
}
