"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPromoAction } from "@/server/actions/promos";
import { ActionErrorAlert, SetupInput } from "./form-controls";
import { optionalText, type ActionFeedback } from "./form-utils";

export function PromoForm() {
  const router = useRouter();
  const [discountType, setDiscountType] = useState<
    "fixed_amount" | "percentage"
  >("fixed_amount");
  const [feedback, setFeedback] = useState<ActionFeedback>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFeedback({});
    startTransition(async () => {
      const result = await createPromoAction({
        name: String(formData.get("name") ?? ""),
        discountType,
        discountValue: Number(formData.get("discountValue")),
        startsAt: optionalText(formData.get("startsAt")),
        endsAt: optionalText(formData.get("endsAt")),
      });
      if (!result.ok) {
        setFeedback({ error: result.error, fieldErrors: result.fieldErrors });
        return;
      }
      event.currentTarget.reset();
      toast.success("Promo created.");
      router.refresh();
    });
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit} noValidate>
      <ActionErrorAlert feedback={feedback} />
      <SetupInput
        label="Promo name"
        name="name"
        feedback={feedback}
        required
        maxLength={120}
        disabled={isPending}
        placeholder="Opening week"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="discount-type">Discount type</Label>
          <select
            id="discount-type"
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
          feedback={feedback}
          type="number"
          min="0.01"
          max={discountType === "percentage" ? "100" : undefined}
          step="0.01"
          required
          disabled={isPending}
          placeholder={discountType === "fixed_amount" ? "50.00" : "10"}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="starts-at">Starts</Label>
          <Input
            id="starts-at"
            name="startsAt"
            type="date"
            disabled={isPending}
            className="h-11 rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ends-at">Ends</Label>
          <Input
            id="ends-at"
            name="endsAt"
            type="date"
            disabled={isPending}
            className="h-11 rounded-xl"
          />
        </div>
      </div>
      <Button type="submit" className="h-11 rounded-xl" disabled={isPending}>
        <Plus aria-hidden="true" />
        {isPending ? "Creating…" : "Create promo"}
      </Button>
    </form>
  );
}
