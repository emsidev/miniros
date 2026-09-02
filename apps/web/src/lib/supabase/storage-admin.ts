import { createClient } from "@supabase/supabase-js";

import { getSupabaseSecretEnv } from "@/lib/env";

export function createStorageAdmin() {
  const { url, secretKey } = getSupabaseSecretEnv();
  const client = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Keep the secret-key client incapable (at the type boundary) of becoming a
  // second database access layer alongside Drizzle.
  return client as Pick<typeof client, "storage">;
}
