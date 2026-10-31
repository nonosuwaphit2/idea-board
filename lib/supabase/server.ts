import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the server environment.");
  }

  // This application uses only the publishable key and anonymous database role.
  // Never substitute a service-role or secret key, which would bypass RLS.
  if (!key.startsWith("sb_publishable_")) {
    throw new Error("Use a Supabase publishable key, never a secret key.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(15000) }) },
  });
}
