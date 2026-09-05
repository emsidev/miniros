"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
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
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const [productId, setProductId] = useState("");
  const product = products.find((item) => item.id === productId);
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
      try {
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
        setProductId("");
        setRequestIds({
          productionLogId: crypto.randomUUID(),
          productionInputEventId: crypto.randomUUID(),
          productionOutputEventId: crypto.randomUUID(),
        });
        toast.success(
          "Production logged: inputs deducted and finished goods added.",
        );
        router.refresh();
      } catch {
        setError(
          "Couldn’t reach the server. Your entries are still here. Try again.",
        );
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-xl border bg-card p-5 sm:p-6"
    >
      <div>
        <h2 className="text-lg font-bold">Log a production batch</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose where you’re making stock, then enter the finished quantity.
        </p>
      </div>
      {error ? (
        <div ref={errorRef} tabIndex={-1}>
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="inventoryLocationId">Central inventory location</Label>
        <select
          id="inventoryLocationId"
          name="inventoryLocationId"
          defaultValue={
            inventoryLocations.length === 1 ? inventoryLocations[0].id : ""
          }
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
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
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
          Quantity produced{product ? ` (${product.unit})` : ""}
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
      <details className="rounded-lg border">
        <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold">
          Add notes (optional)
        </summary>
        <div className="space-y-2 px-3 pb-3">
          <Label htmlFor="notes">Batch notes</Label>
          <Textarea
            id="notes"
            name="notes"
            maxLength={2000}
            disabled={isPending}
          />
        </div>
      </details>
      <p className="text-sm text-muted-foreground">
        Logging deducts recipe inputs and adds finished goods to the selected
        central inventory.
      </p>
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
