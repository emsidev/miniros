"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CircleCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { loginAction, registerAction } from "@/server/actions/auth";

type AuthMode = "login" | "register";

type FormFeedback = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  success?: string;
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
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

  function handleGoogleSignIn() {
    setFeedback({});
    startTransition(async () => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/businesses`,
        },
      });

      if (error) {
        setFeedback({ error: error.message });
      }
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
        <Alert className="rounded-xl border-success/20 bg-success-surface text-success">
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

      <Button
        type="button"
        size="lg"
        variant="outline"
        className="h-12 w-full rounded-xl font-bold"
        onClick={handleGoogleSignIn}
        disabled={isPending || Boolean(feedback.success)}
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      <p className="-mt-2 text-center text-xs leading-relaxed text-muted-foreground">
        Google sign-in shares your name, email address, and profile image with
        MINIROS to create or access your account. See our{" "}
        <Link
          href="/privacy"
          className="font-semibold text-foreground underline-offset-4 hover:underline"
        >
          Privacy Policy
        </Link>
        .
      </p>

      <div className="relative flex items-center" aria-hidden="true">
        <div className="h-px flex-1 bg-border" />
        <span className="px-3 text-xs font-medium text-muted-foreground">
          or continue with email
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

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

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21.6 12.227c0-.709-.064-1.4-.182-2.064H12v3.905h5.377a4.59 4.59 0 0 1-1.996 3.011v2.504h3.23c1.892-1.742 2.989-4.31 2.989-7.356Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.964-.895 6.619-2.417l-3.23-2.504c-.895.6-2.037.955-3.389.955-2.605 0-4.814-1.76-5.604-4.127H3.057v2.585A9.999 9.999 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.396 13.907A6.01 6.01 0 0 1 6.082 12c0-.663.114-1.309.314-1.907V7.508H3.057A10.002 10.002 0 0 0 2 12c0 1.614.386 3.14 1.057 4.492l3.339-2.585Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.966c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.96 2.98 14.7 2 12 2a9.999 9.999 0 0 0-8.943 5.508l3.339 2.585C7.186 7.726 9.395 5.966 12 5.966Z"
        fill="#EA4335"
      />
    </svg>
  );
}
