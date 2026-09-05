"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { guardLocalExit, clearLocalAccount } from "@/lib/offline/store";
import { logoutAction } from "@/server/actions/auth";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      try {
        await guardLocalExit();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Finish pending work first.",
        );
        return;
      }
      const result = await logoutAction();

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      await clearLocalAccount();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={isPending}
    >
      <LogOut aria-hidden="true" />
      {isPending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
