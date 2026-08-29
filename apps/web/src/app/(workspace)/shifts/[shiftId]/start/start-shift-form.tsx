"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Play } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { startAssignedShiftAction } from "@/server/actions/operations";

type CountItem = { id: string; name: string; unit: string };

export function StartShiftForm({
  shiftId,
  items,
}: {
  shiftId: string;
  items: readonly CountItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [requestIds] = useState(() => ({
    inventoryLocationId: crypto.randomUUID(),
    openingEventId: crypto.randomUUID(),
  }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(undefined);
    startTransition(async () => {
      const result = await startAssignedShiftAction({
        shiftId,
        inventoryLocationId: requestIds.inventoryLocationId,
        openingEventId: requestIds.openingEventId,
        notes: String(form.get("notes") ?? "") || null,
        counts: items.map((item) => ({
          inventoryItemId: item.id,
          quantity: String(form.get(`count-${item.id}`) ?? ""),
        })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(`/shifts/${shiftId}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-[1fr_9rem] items-center gap-3 rounded-xl border bg-card p-4"
          >
            <div>
              <Label htmlFor={`count-${item.id}`} className="font-bold">
                {item.name}
              </Label>
              <p className="text-sm text-muted-foreground">Unit: {item.unit}</p>
            </div>
            <Input
              id={`count-${item.id}`}
              name={`count-${item.id}`}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.001"
              defaultValue="0"
              required
              disabled={isPending}
              className="h-11 rounded-xl text-right"
            />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Opening notes</Label>
        <Textarea
          id="notes"
          name="notes"
          maxLength={2000}
          disabled={isPending}
        />
      </div>
      <Button
        type="submit"
        size="lg"
        className="sticky bottom-24 h-12 w-full rounded-xl md:bottom-4"
        disabled={isPending || items.length === 0}
      >
        <Play aria-hidden="true" />
        {isPending ? "Starting shift…" : "Confirm and start shift"}
      </Button>
    </form>
  );
}
