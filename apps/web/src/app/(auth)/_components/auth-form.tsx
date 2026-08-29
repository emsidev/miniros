"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CircleCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, registerAction } from "@/server/actions/auth";

type AuthMode = "login" | "register";

type FormFeedback = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: string;
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FormFeedback>({});
  const isRegister = mode === "register";

  function fieldError(name: string) {
    return feedback.fieldErrors?.[name]?.[0];
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const input = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      ...(isRegister
        ? { fullName: String(formData.get("fullName") ?? "") }
        : {}),
    };

    setFeedback({});
    startTransition(async () => {
      const result = isRegister
        ? await registerAction(input)
        : await loginAction(input);

      if (!result.ok) {
        setFeedback({
          error: result.error,
          fieldErrors: result.fieldErrors,
        });
        return;
      }

      if (
        isRegister &&
        "requiresEmailConfirmation" in result.data &&
        result.data.requiresEmailConfirmation
      ) {
        setFeedback({
          success:
            "Account created. Check your inbox to confirm your email, then sign in.",
        });
        return;
      }

      router.replace("/businesses");
      router.refresh();
    });
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      {feedback.error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Could not continue</AlertTitle>
          <AlertDescription>{feedback.error}</AlertDescription>
        </Alert>
      ) : null}

      {feedback.success ? (
        <Alert className="rounded-xl border-emerald-200 bg-emerald-50 text-emerald-900">
          <CircleCheck aria-hidden="true" />
          <AlertTitle>Registration successful</AlertTitle>
          <AlertDescription>
            <p>{feedback.success}</p>
            <Button asChild variant="outline" className="mt-3">
              <Link href="/login">Go to sign in</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {isRegister ? (
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            minLength={2}
            maxLength={100}
            required
            disabled={isPending}
            aria-invalid={Boolean(fieldError("fullName"))}
            aria-describedby={
              fieldError("fullName") ? "fullName-error" : undefined
            }
            className="h-12 rounded-xl"
            placeholder="Juan dela Cruz"
          />
          {fieldError("fullName") ? (
            <p
              id="fullName-error"
              className="text-xs font-medium text-destructive"
            >
              {fieldError("fullName")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          disabled={isPending}
          aria-invalid={Boolean(fieldError("email"))}
          aria-describedby={fieldError("email") ? "email-error" : undefined}
          className="h-12 rounded-xl"
          placeholder="you@example.com"
        />
        {fieldError("email") ? (
          <p id="email-error" className="text-xs font-medium text-destructive">
            {fieldError("email")}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          minLength={8}
          maxLength={128}
          required
          disabled={isPending}
          aria-invalid={Boolean(fieldError("password"))}
          aria-describedby={
            fieldError("password") ? "password-error" : "password-hint"
          }
          className="h-12 rounded-xl"
          placeholder="At least 8 characters"
        />
        {fieldError("password") ? (
          <p
            id="password-error"
            className="text-xs font-medium text-destructive"
          >
            {fieldError("password")}
          </p>
        ) : isRegister ? (
          <p id="password-hint" className="text-xs text-muted-foreground">
            Use at least 8 characters.
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full rounded-xl font-bold"
        disabled={isPending || Boolean(feedback.success)}
      >
        {isPending
          ? isRegister
            ? "Creating account…"
            : "Signing in…"
          : isRegister
            ? "Create account"
            : "Sign in"}
        {!isPending ? <ArrowRight aria-hidden="true" /> : null}
      </Button>
    </form>
  );
}
