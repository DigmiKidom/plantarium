import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabase = () => Boolean(url && anon);

/** Cookie-less client for public, cacheable reads (species, articles). */
export function createPublicClient() {
  return createClient(url!, anon!, { auth: { persistSession: false } });
}

/** Per-request client that carries the signed-in user's session (RLS applies as that user). */
export async function createUserClient() {
  const store = await cookies();
  return createServerClient(url!, anon!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there; the proxy refreshes them.
        }
      },
    },
  });
}
