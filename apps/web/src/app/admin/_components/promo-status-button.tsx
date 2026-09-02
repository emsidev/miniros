"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setPromoStatusAction } from "@/server/actions/promos";
import { toast } from "sonner";

export function PromoStatusButton({
  promoId,
  status,
}: {
  promoId: string;
  status: "active" | "inactive" | "expired";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const nextStatus = status === "active" ? "inactive" : "active";

  function toggle() {
    setError(undefined);
    startTransition(async () => {
      const result = await setPromoStatusAction({
        promoId,
        status: nextStatus,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(
        `Promo ${nextStatus === "active" ? "activated" : "paused"}.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-xl"
        disabled={isPending || status === "expired"}
        onClick={toggle}
      >
        {isPending ? "Working…" : status === "active" ? "Pause" : "Activate"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
