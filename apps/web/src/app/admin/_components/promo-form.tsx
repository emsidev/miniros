"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { numericExpressionToNumber } from "@/lib/numeric-expression";
import type { PromoRecord } from "@/server/services/promos";
import { createPromoAction } from "@/server/actions/promos";
import { ActionErrorAlert, SetupInput } from "./form-controls";
import { optionalText, type ActionFeedback } from "./form-utils";

export function PromoForm({ promo }: { promo?: PromoRecord }) {
  const router = useRouter();
  const fieldId = (name: string) => `${promo?.id ?? "new-promo"}-${name}`;
  const [discountType, setDiscountType] = useState<
    "fixed_amount" | "percentage"
  >(promo?.discountType ?? "fixed_amount");
  const [feedback, setFeedback] = useState<ActionFeedback>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setFeedback({});
    startTransition(async () => {
      const result = await createPromoAction({
        promoId: promo?.id,
        requiresPhoto: formData.get("requiresPhoto") === "on",
        name: String(formData.get("name") ?? ""),
        discountType,
        discountValue: numericExpressionToNumber(formData.get("discountValue")),
        startsAt: optionalText(formData.get("startsAt")),
        endsAt: optionalText(formData.get("endsAt")),
      });
      if (!result.ok) {
        setFeedback({ error: result.error, fieldErrors: result.fieldErrors });
        return;
      }
      if (!promo) {
        form.reset();
        setDiscountType("fixed_amount");
      }
      toast.success(promo ? "Promo updated." : "Promo created.");
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <ActionErrorAlert feedback={feedback} />
      <SetupInput
        label="Promo name"
        name="name"
        id={fieldId("name")}
        feedback={feedback}
        required
        maxLength={120}
        disabled={isPending}
        defaultValue={promo?.name}
        placeholder="e.g. PWD Discount"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={fieldId("discount-type")}>Discount type</Label>
          <select
            id={fieldId("discount-type")}
            name="discountType"
            value={discountType}
            onChange={(event) =>
              setDiscountType(event.target.value as typeof discountType)
            }
            disabled={isPending}
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
          >
            <option value="fixed_amount">Fixed amount (₱)</option>
            <option value="percentage">Percentage (%)</option>
          </select>
        </div>
        <SetupInput
          label={discountType === "fixed_amount" ? "Amount (₱)" : "Percent (%)"}
          name="discountValue"
          id={fieldId("discountValue")}
          feedback={feedback}
          type="number"
          min="0.01"
          max={discountType === "percentage" ? "100" : undefined}
          step="0.01"
          required
          disabled={isPending}
          defaultValue={promo?.discountValue}
          placeholder={discountType === "fixed_amount" ? "50.00" : "10"}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={fieldId("starts-at")}>Starts</Label>
          <Input
            id={fieldId("starts-at")}
            name="startsAt"
            defaultValue={promo?.startsAt?.slice(0, 10)}
            type="date"
            disabled={isPending}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={fieldId("ends-at")}>Ends</Label>
          <Input
            id={fieldId("ends-at")}
            name="endsAt"
            defaultValue={promo?.endsAt?.slice(0, 10)}
            type="date"
            disabled={isPending}
            className="h-11 rounded-xl"
          />
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-xl border p-3">
        <input
          type="checkbox"
          name="requiresPhoto"
          defaultChecked={promo?.requiresPhoto ?? false}
          disabled={isPending}
          className="mt-1 size-4"
        />
        <span>
          <span className="text-sm font-semibold">Photo required</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Require a photo at checkout when this promo is applied, such as for
            PWD or Senior discounts.
          </span>
        </span>
      </label>
      <Button type="submit" className="h-11 rounded-xl" disabled={isPending}>
        <Plus aria-hidden="true" />
        {isPending ? "Saving…" : promo ? "Save promo" : "Create promo"}
      </Button>
    </form>
  );
}
