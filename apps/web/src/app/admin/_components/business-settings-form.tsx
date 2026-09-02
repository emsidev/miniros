"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBusinessSettingsAction } from "@/server/actions/businesses";
import { ActionErrorAlert } from "../_components/form-controls";
import type { ActionFeedback } from "../_components/form-utils";

export function BusinessSettingsForm({ name }: { name: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ActionFeedback>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFeedback({});

    startTransition(async () => {
      const result = await updateBusinessSettingsAction({
        name: String(formData.get("name") ?? ""),
      });
      if (!result.ok) {
        setFeedback({ error: result.error, fieldErrors: result.fieldErrors });
        return;
      }
      toast.success("Business settings saved.");
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <ActionErrorAlert feedback={feedback} />
      <div className="space-y-2">
        <Label htmlFor="business-name">Business name</Label>
        <Input
          id="business-name"
          name="name"
          defaultValue={name}
          minLength={2}
          maxLength={100}
          required
          disabled={isPending}
          className="h-11 rounded-xl"
        />
        {feedback.fieldErrors?.name?.[0] ? (
          <p className="text-xs font-medium text-destructive">
            {feedback.fieldErrors.name[0]}
          </p>
        ) : null}
      </div>
      <Button type="submit" className="h-11 rounded-xl" disabled={isPending}>
        <Save aria-hidden="true" />
        {isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
