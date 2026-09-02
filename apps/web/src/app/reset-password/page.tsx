import type { Metadata } from "next";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { PasswordResetRequestForm } from "./password-reset-request-form";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Request a link to reset your MINIROS password.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthPageShell>
      <div className="rounded-xl border bg-card py-7 shadow-none">
        <div className="px-6 sm:px-8">
          <h1 className="text-2xl font-extrabold tracking-tight">
            Reset your password
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Enter your email and we&apos;ll send you a secure link to choose a
            new password.
          </p>
        </div>
        <div className="mt-6 px-6 sm:px-8">
          <PasswordResetRequestForm
            initialError={params.error === "expired" ? "expired" : undefined}
          />
        </div>
      </div>
    </AuthPageShell>
  );
}
