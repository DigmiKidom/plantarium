import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Pages that need a signed-in user. Everything else (knowledge, blog, home) is public. */
const PROTECTED = ["/plants", "/garden", "/profile"];
/** Pages a signed-in user shouldn't see. */
const GUEST_ONLY = ["/login", "/signup"];

const matches = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(p + "/"));

/**
 * Refreshes the Supabase session cookie on every request and guards private pages.
 * Must run before Server Components read the session.
 */
export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Verifies the JWT and refreshes it when needed. Don't put code between createServerClient and this call.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!signedIn && matches(path, PROTECTED)) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(to);
  }
  if (signedIn && matches(path, GUEST_ONLY)) {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = "";
    return NextResponse.redirect(to);
  }

  return response;
}
