"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, CircleCheck, Mail } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function PasswordResetRequestForm({
  initialError,
}: {
  initialError?: "expired";
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(
    initialError
      ? "That reset link is invalid or has expired. Request a new one below."
      : null,
  );
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();

    if (!email || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password/update")}`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo },
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setSubmittedEmail(email);
    });
  }

  if (submittedEmail) {
    return (
      <div className="space-y-5">
        <Alert className="rounded-xl border-success/20 bg-success-surface text-success">
          <CircleCheck aria-hidden="true" />
          <AlertTitle>Check your inbox</AlertTitle>
          <AlertDescription>
            If an account exists for {submittedEmail}, we&apos;ve sent a reset
            link. The link will be valid for one hour.
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="h-12 w-full rounded-xl">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Could not send reset link</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="reset-email">Email address</Label>
        <Input
          id="reset-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          disabled={isPending}
          className="h-12 rounded-xl"
          placeholder="you@example.com"
        />
      </div>

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full rounded-xl font-bold"
        disabled={isPending}
      >
        {isPending ? "Sending link…" : "Send reset link"}
        {!isPending ? (
          <ArrowRight aria-hidden="true" />
        ) : (
          <Mail aria-hidden="true" />
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Remembered your password?{" "}
        <Link
          href="/login"
          className="font-bold text-foreground underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
