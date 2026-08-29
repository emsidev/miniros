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
  title: "Sign in",
  description: "Sign in to your MINIROS workspace.",
};

export default function LoginPage() {
  return (
    <Card className="rounded-3xl py-7 shadow-none">
      <CardHeader className="px-6 sm:px-8">
        <CardTitle className="text-2xl font-extrabold tracking-tight">
          Welcome back
        </CardTitle>
        <CardDescription>
          Sign in to continue managing your selling locations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-6 sm:px-8">
        <AuthForm mode="login" />
        <p className="text-center text-sm text-muted-foreground">
          New to MINIROS?{" "}
          <Link
            href="/register"
            className="font-bold text-foreground underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
