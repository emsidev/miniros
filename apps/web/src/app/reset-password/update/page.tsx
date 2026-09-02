import type { Metadata } from "next";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { PasswordUpdateForm } from "./password-update-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Choose a new password for your MINIROS account.",
};

export default function UpdatePasswordPage() {
  return (
    <AuthPageShell>
      <div className="rounded-xl border bg-card py-7 shadow-none">
        <div className="px-6 sm:px-8">
          <h1 className="text-2xl font-extrabold tracking-tight">
            Choose a new password
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Use at least 8 characters. Your new password will protect your
            MINIROS workspace.
          </p>
        </div>
        <div className="mt-6 px-6 sm:px-8">
          <PasswordUpdateForm />
        </div>
      </div>
    </AuthPageShell>
  );
}
