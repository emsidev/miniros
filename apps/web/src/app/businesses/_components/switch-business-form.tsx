"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { switchBusinessAction } from "@/server/actions/businesses";

export function SwitchBusinessForm({
  businessId,
  destination,
}: {
  businessId: string;
  destination: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function handleSwitch() {
    setError(undefined);
    startTransition(async () => {
      const result = await switchBusinessAction(businessId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.replace(destination);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Could not switch business</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="button"
        size="lg"
        className="h-12 w-full rounded-xl font-bold"
        onClick={handleSwitch}
        disabled={isPending}
      >
        {!isPending ? <Check aria-hidden="true" /> : null}
        {isPending ? "Switching business…" : "Switch business"}
      </Button>
    </div>
  );
}
