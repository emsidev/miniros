import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

export const dynamic = "force-dynamic";

export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    redirect("/businesses");
  }

  return <AuthPageShell>{children}</AuthPageShell>;
}
