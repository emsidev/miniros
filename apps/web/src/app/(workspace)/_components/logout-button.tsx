"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { guardLocalExit, clearLocalAccount } from "@/lib/offline/store";
import { logoutAction } from "@/server/actions/auth";

export function LogoutButton() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full rounded-xl"
        disabled={isPending}
        onClick={() => {
          setError(undefined);
          startTransition(async () => {
            try {
              await guardLocalExit();
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Finish pending work first.",
              );
              return;
            }
            const result = await logoutAction();
            if (!result.ok) {
              setError(result.error);
              return;
            }
            await clearLocalAccount();
            router.replace("/login");
            router.refresh();
          });
        }}
      >
        <LogOut aria-hidden="true" />
        {isPending ? "Signing out…" : "Sign out"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
