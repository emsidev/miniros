"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Factory } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumericExpressionInput } from "@/components/ui/numeric-expression-input";
import { Textarea } from "@/components/ui/textarea";
import { normalizeNumericExpression } from "@/lib/numeric-expression";
import { logProductionAction } from "@/server/actions/operations";

export function ProductionForm({
  inventoryLocations,
  products,
}: {
  inventoryLocations: readonly { id: string; name: string }[];
  products: readonly { id: string; name: string; unit: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [requestIds, setRequestIds] = useState(() => ({
    productionLogId: crypto.randomUUID(),
    productionInputEventId: crypto.randomUUID(),
    productionOutputEventId: crypto.randomUUID(),
  }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setError(undefined);
    startTransition(async () => {
      const result = await logProductionAction({
        productionLogId: requestIds.productionLogId,
        productionInputEventId: requestIds.productionInputEventId,
        productionOutputEventId: requestIds.productionOutputEventId,
        inventoryLocationId: String(form.get("inventoryLocationId") ?? ""),
        productId: String(form.get("productId") ?? ""),
        quantityProduced: normalizeNumericExpression(
          form.get("quantityProduced"),
          3,
        ),
        notes: String(form.get("notes") ?? "") || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      formElement.reset();
      setRequestIds({
        productionLogId: crypto.randomUUID(),
        productionInputEventId: crypto.randomUUID(),
        productionOutputEventId: crypto.randomUUID(),
      });
      toast.success(
        "Production logged: inputs deducted and finished goods added.",
      );
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border bg-card p-4"
    >
      {error ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="inventoryLocationId">Central inventory location</Label>
        <select
          id="inventoryLocationId"
          name="inventoryLocationId"
          required
          className="h-12 w-full rounded-xl border bg-background px-3"
          disabled={isPending}
        >
          <option value="">Select central inventory</option>
          {inventoryLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </div>
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
              {product.name} ({product.unit})
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="quantityProduced">
          Finished-good quantity produced
        </Label>
        <NumericExpressionInput
          id="quantityProduced"
          name="quantityProduced"
          precision={3}
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
