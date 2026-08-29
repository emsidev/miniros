"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Factory } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { logShiftProductionAction } from "@/server/actions/operations";

export function ProductionForm({
  shiftId,
  products,
}: {
  shiftId: string;
  products: readonly { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [requestIds, setRequestIds] = useState(() => ({
    productionLogId: crypto.randomUUID(),
    inventoryEventId: crypto.randomUUID(),
  }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError(undefined);
    startTransition(async () => {
      const result = await logShiftProductionAction({
        productionLogId: requestIds.productionLogId,
        inventoryEventId: requestIds.inventoryEventId,
        shiftId,
        productId: String(form.get("productId") ?? ""),
        quantityProduced: String(form.get("quantityProduced") ?? ""),
        notes: String(form.get("notes") ?? "") || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      formElement.reset();
      setRequestIds({
        productionLogId: crypto.randomUUID(),
        inventoryEventId: crypto.randomUUID(),
      });
      toast.success("Production logged and recipe inputs deducted.");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border bg-card p-4"
    >
      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="productId">Product</Label>
        <select
          id="productId"
          name="productId"
          required
          className="h-12 w-full rounded-xl border bg-background px-3"
          disabled={isPending}
        >
          <option value="">Select product</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="quantityProduced">Quantity produced</Label>
        <Input
          id="quantityProduced"
          name="quantityProduced"
          type="number"
          inputMode="decimal"
          min="0.001"
          step="0.001"
          required
          disabled={isPending}
          className="h-12 rounded-xl"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
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
        className="h-12 w-full rounded-xl"
        disabled={isPending || products.length === 0}
      >
        <Factory aria-hidden="true" />{" "}
        {isPending ? "Logging…" : "Log production"}
      </Button>
    </form>
  );
}
