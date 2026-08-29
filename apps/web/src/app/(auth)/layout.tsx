import Link from "next/link";
import { redirect } from "next/navigation";
import { Store } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/businesses");
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-[1fr_0.9fr]">
      <section className="hidden bg-foreground p-12 text-background lg:flex lg:flex-col lg:justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 text-xl font-extrabold"
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
            <Store className="size-6" aria-hidden="true" />
          </span>
          MINIROS
        </Link>
        <div className="max-w-xl space-y-5">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent">
            Location-first retail operations
          </p>
          <h1 className="text-5xl font-extrabold leading-[1.03] tracking-tight">
            Know if the booth was worth it.
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-background/70">
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
            <span className="grid size-9 place-items-center rounded-xl bg-foreground text-accent">
              <Store className="size-5" aria-hidden="true" />
            </span>
            MINIROS
          </Link>
          {children}
        </div>
      </section>
    </main>
  );
}
