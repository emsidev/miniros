"use client";
import { Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, errorProps } from "./form-feedback";
import type { CostLine, PlanningLocation } from "./types";

export function CostEditor({
  costs,
  onChange,
  location,
  disabled,
  errors,
  onReset,
}: {
  costs: CostLine[];
  onChange: (costs: CostLine[]) => void;
  location?: PlanningLocation;
  disabled?: boolean;
  errors?: Record<string, string[]>;
  onReset: (key: string, type: "rent" | "transport") => void;
}) {
  return (
    <fieldset
      disabled={disabled}
      className="space-y-4"
      {...errorProps("costs", errors)}
      tabIndex={-1}
    >
      <legend className="text-lg font-bold">Planned costs</legend>
      <p className="text-sm text-muted-foreground">
        Rent and transport start from the location defaults. These amounts apply
        to each selected date.
      </p>
      <FieldError field="costs" errors={errors} />
      <div className="divide-y rounded-lg border">
        {costs.map((cost, index) => {
          const patch = (value: Partial<CostLine>) =>
            onChange(
              costs.map((item) =>
                item.key === cost.key ? { ...item, ...value } : item,
              ),
            );
          return (
            <div key={cost.key} className="space-y-3 p-4">
              <div className="flex items-start gap-3">
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`field-costs.${index}.label`}>
                      Cost name
                    </Label>
                    <Input
                      {...errorProps(`costs.${index}.label`, errors)}
                      value={cost.label}
                      onChange={(event) => patch({ label: event.target.value })}
                      className="h-11"
                      maxLength={120}
                    />
                    <FieldError
                      field={`costs.${index}.label`}
                      errors={errors}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`field-costs.${index}.amountCents`}>
                      Amount per shift (₱)
                    </Label>
                    <Input
                      {...errorProps(`costs.${index}.amountCents`, errors)}
                      value={cost.amount}
                      onChange={(event) =>
                        patch({ amount: event.target.value })
                      }
                      min="0"
                      inputMode="decimal"
                      className="h-11"
                    />
                    <FieldError
                      field={`costs.${index}.amountCents`}
                      errors={errors}
                    />
                  </div>
                </div>
                {cost.costType === "other" && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="mt-6"
                    aria-label={`Remove ${cost.label || "other cost"}`}
                    onClick={() =>
                      onChange(costs.filter((item) => item.key !== cost.key))
                    }
                  >
                    <X aria-hidden="true" />
                  </Button>
                )}
              </div>
              {cost.costType !== "other" && location?.available && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 text-muted-foreground"
                  onClick={() =>
                    onReset(cost.key, cost.costType as "rent" | "transport")
                  }
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Use location default
                </Button>
              )}
              {cost.notes && (
                <p className="text-sm text-muted-foreground">{cost.notes}</p>
              )}
            </div>
          );
        })}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange([
            ...costs,
            {
              key: crypto.randomUUID(),
              costType: "other",
              label: "",
              amount: "0.00",
              notes: null,
            },
          ])
        }
      >
        <Plus aria-hidden="true" />
        Add other cost
      </Button>
    </fieldset>
  );
}
