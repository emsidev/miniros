import Link from "next/link";
import { redirect } from "next/navigation";
import { Store } from "lucide-react";
import { AccessError, requireUser } from "@/server/services/access";
import { LogoutButton } from "./_components/logout-button";

export const dynamic = "force-dynamic";

export default async function BusinessesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let user;

  try {
    user = await requireUser();
  } catch (error) {
    if (error instanceof AccessError) {
      redirect("/login");
    }
    throw error;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/businesses"
            className="flex items-center gap-2 font-extrabold tracking-tight"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-foreground text-accent">
              <Store className="size-5" aria-hidden="true" />
            </span>
            MINIROS
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden max-w-52 truncate text-sm text-muted-foreground sm:block">
              {user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>
    </div>
  );
}
