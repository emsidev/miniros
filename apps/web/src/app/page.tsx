import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  MapPin,
  Store,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const highlights = [
  {
    icon: WalletCards,
    title: "Close every shift cleanly",
    description: "Reconcile sales, cash, payment proofs, and deductions.",
  },
  {
    icon: Boxes,
    title: "Know what stock moved",
    description: "Track inventory and recipe-based deductions by location.",
  },
  {
    icon: BarChart3,
    title: "See real location profit",
    description: "Compare revenue against product, staffing, and rental costs.",
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
      <header className="border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 font-extrabold tracking-tight"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-foreground text-accent">
              <Store className="size-5" aria-hidden="true" />
            </span>
            MINIROS
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="hidden sm:inline-flex">
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:py-32">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em]">
            <MapPin className="size-3.5" aria-hidden="true" />
            Built for location-based selling
          </p>
          <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
            Track profit,
            <br />
            not just sales.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            MINIROS helps pop-ups, booths, bazaars, and kiosks answer the one
            question that matters: should you rent this location again?
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-xl px-5 font-bold"
            >
              <Link href="/register">
                Create your workspace
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 rounded-xl px-5"
            >
              <Link href="/login">Sign in to MINIROS</Link>
            </Button>
          </div>
        </div>

        <Card className="rounded-3xl border-foreground bg-foreground py-0 text-background shadow-none">
          <CardContent className="p-5 sm:p-7">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-background/50">
                  Location result
                </p>
                <p className="mt-1 text-xl font-extrabold">Weekend Bazaar</p>
              </div>
              <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground">
                Worth renting again
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-background/8 p-4">
                <p className="text-xs text-background/55">Net sales</p>
                <p className="mt-1 text-2xl font-extrabold">₱42,850</p>
              </div>
              <div className="rounded-2xl bg-accent p-4 text-accent-foreground">
                <p className="text-xs opacity-65">Location profit</p>
                <p className="mt-1 text-2xl font-extrabold">₱11,240</p>
              </div>
              <div className="col-span-2 rounded-2xl bg-background/8 p-4">
                <div className="mb-3 flex justify-between text-xs text-background/55">
                  <span>Sales</span>
                  <span>Costs</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-background/10">
                  <div className="h-full w-[74%] rounded-full bg-accent" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:px-6 md:grid-cols-3">
          {highlights.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex gap-4 rounded-2xl p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-bold">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
