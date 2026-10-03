import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except static files, images, the uptime check and the Sentry tunnel
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)"],
};
