import Link from "next/link";
import { EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <EmptyState
        title="Page not found"
        description="This MINIROS page does not exist or is no longer available."
        action={
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        }
      />
    </main>
  );
}
