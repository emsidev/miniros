import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthForm } from "../_components/auth-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create your MINIROS account.",
};

export default function RegisterPage() {
  return (
    <Card className="rounded-3xl py-7 shadow-none">
      <CardHeader className="px-6 sm:px-8">
        <CardTitle className="text-2xl font-extrabold tracking-tight">
          Create your account
        </CardTitle>
        <CardDescription>
          Start with one business, then invite your team when you are ready.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-6 sm:px-8">
        <AuthForm mode="register" />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-bold text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
