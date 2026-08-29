"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  reviewCashDeductionAction,
  reviewInventoryAdjustmentAction,
} from "@/server/actions/operations";

export function ApprovalActions({
  id,
  type,
}: {
  id: string;
  type: "cash" | "inventory";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();

  function decide(decision: "approved" | "rejected") {
    if (
      !window.confirm(
        `${decision === "approved" ? "Approve" : "Reject"} this request?`,
      )
    )
      return;
    setError(undefined);
    startTransition(async () => {
      const result =
        type === "cash"
          ? await reviewCashDeductionAction({ deductionId: id, decision })
          : await reviewInventoryAdjustmentAction({
              adjustmentId: id,
              inventoryEventId: crypto.randomUUID(),
              decision,
            });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Request ${decision}.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="flex-1"
          disabled={isPending}
          onClick={() => decide("approved")}
        >
          <Check aria-hidden="true" /> Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={isPending}
          onClick={() => decide("rejected")}
        >
          <X aria-hidden="true" /> Reject
        </Button>
      </div>
    </div>
  );
}
