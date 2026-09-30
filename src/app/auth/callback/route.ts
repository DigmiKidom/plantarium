import { NextResponse, type NextRequest } from "next/server";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

/**
 * Links from Supabase emails (password reset) land here with ?code=… .
 * The code is exchanged for a session (PKCE – only works in the browser that asked for it), then we continue to ?next.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next") ?? "/");
  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));

  if (!code || !hasSupabase()) return to("/login?error=link");
  const supabase = await createUserClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error(JSON.stringify({ at: "auth.callback", code: error.code, error: error.message }));
    return to("/login?error=link");
  }
  return to(next);
}
