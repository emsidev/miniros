"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBusinessAction } from "@/server/actions/businesses";

export function CreateBusinessForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [nameError, setNameError] = useState<string>();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "");

    setError(undefined);
    setNameError(undefined);
    startTransition(async () => {
      const result = await createBusinessAction({ name });

      if (!result.ok) {
        setError(result.error);
        setNameError(result.fieldErrors?.name?.[0]);
        return;
      }

      router.replace("/businesses");
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Could not create business</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="name">Business name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          autoComplete="organization"
          minLength={2}
          maxLength={100}
          required
          autoFocus
          disabled={isPending}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? "name-error" : "name-hint"}
          className="h-12 rounded-xl"
          placeholder="Bettercup"
        />
        {nameError ? (
          <p id="name-error" className="text-xs font-medium text-destructive">
            {nameError}
          </p>
        ) : (
          <p id="name-hint" className="text-xs text-muted-foreground">
            This is the name your team will see throughout MINIROS.
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full rounded-xl font-bold"
        disabled={isPending}
      >
        {isPending ? "Creating business…" : "Create business"}
        {!isPending ? <ArrowRight aria-hidden="true" /> : null}
      </Button>
    </form>
  );
}
