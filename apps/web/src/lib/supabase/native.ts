import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";

/** Stateless public-key Auth client; native routes verify the explicit Bearer token. */
export function createNativeAuthClient() {
  const { url, publishableKey } = getSupabasePublicEnv();
  const client = createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return { auth: client.auth };
}
