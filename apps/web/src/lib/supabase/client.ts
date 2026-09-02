import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/env";

export function createClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  const client = createBrowserClient(url, publishableKey);

  // Database access belongs to Drizzle. Keep browser callers limited to the
  // Supabase products that cannot be provided by the ORM.
  return client as Pick<typeof client, "auth" | "channel" | "removeChannel">;
}
