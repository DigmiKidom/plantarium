import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client: bypasses RLS and can manage users.
 * Server-only – never import this from a client component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing in .env.local");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const hasAdmin = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
