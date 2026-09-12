import Link from "next/link";
import { ThisDevice } from "@/features/offline/device-controls";
import { Button } from "@/components/ui/button";
export default function MorePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold">More</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Account, saved work, and app settings.
        </p>
      </div>
      <ThisDevice />
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Account & help</h2>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/profile">Profile & sign out</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/help">Shift help</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
