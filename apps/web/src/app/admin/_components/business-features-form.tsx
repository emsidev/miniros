"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { updateBusinessFeaturesAction } from "@/server/actions/businesses";
import { ActionErrorAlert } from "../_components/form-controls";
import type { ActionFeedback } from "../_components/form-utils";

type BusinessFeatures = {
  recipesEnabled: boolean;
  productionEnabled: boolean;
  approvalsEnabled: boolean;
  promosEnabled: boolean;
};

const featureRows: readonly {
  key: keyof BusinessFeatures;
  title: string;
  description: string;
}[] = [
  {
    key: "recipesEnabled",
    title: "Recipe",
    description: "Manage recipes and deduct their ingredients during sales.",
  },
  {
    key: "productionEnabled",
    title: "Production",
    description: "Let assigned employees log products made during a shift.",
  },
  {
    key: "approvalsEnabled",
    title: "Approvals",
    description:
      "Require admin review for cash deductions and stock adjustments.",
  },
  {
    key: "promosEnabled",
    title: "Promos",
    description:
      "Create saved discounts for operators to use in Point of sale.",
  },
];

export function BusinessFeaturesForm({
  features,
}: {
  features: BusinessFeatures;
}) {
  const router = useRouter();
  const [values, setValues] = useState(features);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionFeedback>({});

  function setFeature(key: keyof BusinessFeatures, checked: boolean) {
    setValues((current) => {
      if (key === "recipesEnabled") {
        return {
          ...current,
          recipesEnabled: checked,
          productionEnabled: checked ? current.productionEnabled : false,
        };
      }
      return { ...current, [key]: checked };
    });
  }

  function saveFeatures() {
    setFeedback({});
    startTransition(async () => {
      const result = await updateBusinessFeaturesAction(values);
      if (!result.ok) {
        setFeedback({ error: result.error, fieldErrors: result.fieldErrors });
        return;
      }
      setValues(result.data);
      toast.success("Feature settings saved.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <ActionErrorAlert feedback={feedback} />
      <div className="divide-y rounded-xl border">
        {featureRows.map(({ key, title, description }) => {
          const isProduction = key === "productionEnabled";
          const disabled =
            isPending || (isProduction && !values.recipesEnabled);
          return (
            <div
              key={key}
              className="flex items-start gap-3 px-4 py-4 first:rounded-t-xl last:rounded-b-xl"
            >
              <Checkbox
                id={`business-feature-${key}`}
                checked={values[key]}
                onCheckedChange={(checked) => setFeature(key, checked === true)}
                disabled={disabled}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <Label
                  htmlFor={`business-feature-${key}`}
                  className={
                    disabled
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer"
                  }
                >
                  {title}
                </Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isProduction && !values.recipesEnabled
                    ? "Enable Recipe before enabling Production."
                    : description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <Button
        type="button"
        className="h-11 rounded-xl"
        disabled={isPending}
        onClick={saveFeatures}
      >
        <Save aria-hidden="true" />
        {isPending ? "Saving…" : "Save feature settings"}
      </Button>
    </div>
  );
}
