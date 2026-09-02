"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CircleCheck,
  LoaderCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type PageState = "checking" | "ready" | "invalid" | "complete";

export function PasswordUpdateForm() {
  const supabase = useMemo(() => createClient(), []);
  const [pageState, setPageState] = useState<PageState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isMounted = true;

    async function checkRecoverySession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (isMounted) {
        setPageState(session ? "ready" : "invalid");
      }
    }

    void checkRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "PASSWORD_RECOVERY" || session) {
        setPageState("ready");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      await supabase.auth.signOut();
      setPageState("complete");
    });
  }

  if (pageState === "checking") {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Checking your reset link…
      </div>
    );
  }

  if (pageState === "invalid") {
    return (
      <div className="space-y-5">
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Reset link unavailable</AlertTitle>
          <AlertDescription>
            This reset link is invalid or has expired. Request a new link to
            continue.
          </AlertDescription>
        </Alert>
        <Button asChild className="h-12 w-full rounded-xl font-bold">
          <Link href="/reset-password">
            Request a new link
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  }

  if (pageState === "complete") {
    return (
      <div className="space-y-5">
        <Alert className="rounded-xl border-success/20 bg-success-surface text-success">
          <CircleCheck aria-hidden="true" />
          <AlertTitle>Password updated</AlertTitle>
          <AlertDescription>
            Your password has been changed. Sign in with your new password to
            continue.
          </AlertDescription>
        </Alert>
        <Button asChild className="h-12 w-full rounded-xl font-bold">
          <Link href="/login">
            Go to sign in
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Could not update password</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          disabled={isPending}
          className="h-12 rounded-xl"
          placeholder="At least 8 characters"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm new password</Label>
        <Input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          disabled={isPending}
          className="h-12 rounded-xl"
          placeholder="Repeat your new password"
        />
      </div>

      <Button
        type="submit"
        size="lg"
        className="h-12 w-full rounded-xl font-bold"
        disabled={isPending}
      >
        {isPending ? "Updating password…" : "Update password"}
        {!isPending ? <ArrowRight aria-hidden="true" /> : null}
      </Button>
    </form>
  );
}
