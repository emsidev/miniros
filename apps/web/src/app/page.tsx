import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Boxes, CircleDollarSign, WalletCards } from "lucide-react";

import { BrandMark } from "@/components/shared/brand-mark";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const operatingLoop = [
  {
    icon: WalletCards,
    title: "Close the shift",
    description: "Reconcile sales, cash, proofs, and deductions.",
  },
  {
    icon: Boxes,
    title: "Account for stock",
    description: "See what moved, sold, and needs review.",
  },
  {
    icon: CircleDollarSign,
    title: "Decide with profit",
    description: "Compare revenue with product, staff, and location costs.",
  },
] as const;

export default async function HomePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/businesses");
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-extrabold">
            <BrandMark className="size-9" />
            MINIROS
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/register">Create workspace</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-6xl items-center gap-12 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.82fr)] lg:py-24">
        <div>
          <p className="mb-4 max-w-xl text-sm font-semibold text-muted-foreground">
            Retail operations for pop-ups, booths, bazaars, and kiosks.
          </p>
          <h1 className="max-w-3xl text-4xl leading-[1.02] font-extrabold tracking-[-0.03em] sm:text-6xl">
            Track profit,
            <br />
            not just sales.
          </h1>
          <p className="mt-6 max-w-[58ch] text-base leading-relaxed text-muted-foreground sm:text-lg">
            MINIROS connects selling, stock, staffing, costs, and closeout so
            you can answer one practical question: should you rent this location
            again?
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register">
                Create your workspace
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in to MINIROS</Link>
            </Button>
          </div>
        </div>

        <aside className="rounded-xl bg-foreground p-5 text-background sm:p-7">
          <div className="border-b border-background/15 pb-5">
            <p className="text-sm font-semibold text-accent">
              The Profit Ledger
            </p>
            <h2 className="mt-2 text-2xl leading-tight font-extrabold tracking-[-0.02em]">
              One shift. One clear answer.
            </h2>
          </div>
          <ul className="divide-y divide-background/15">
            {operatingLoop.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-4 py-5">
                <Icon
                  className="mt-0.5 size-5 shrink-0 text-accent"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-background/70">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-col gap-2 rounded-lg bg-accent p-4 text-accent-foreground sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-semibold">Weekend Bazaar</span>
            <strong className="text-sm">Worth renting again</strong>
          </div>
        </aside>
      </section>
    </main>
  );
}
