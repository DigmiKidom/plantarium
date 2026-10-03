import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Uptime check: answers 200 when the site and the database work, 503 when the database doesn't.
// Point an uptime monitor (e.g. UptimeRobot) at /api/health. Never cached.
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 3000;

export async function GET() {
  const started = Date.now();
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let db: "ok" | "error" | "not-configured" = "not-configured";
  if (url && key) {
    try {
      const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await supabase.from("species").select("id").limit(1).abortSignal(AbortSignal.timeout(TIMEOUT_MS));
      db = error ? "error" : "ok";
      if (error) console.error(JSON.stringify({ at: "health.db", code: error.code, error: error.message }));
    } catch (e) {
      db = "error";
      console.error(JSON.stringify({ at: "health.db", error: e instanceof Error ? e.message : String(e) }));
    }
  }

  const ok = db !== "error";
  return NextResponse.json(
    { status: ok ? "ok" : "error", db, version, ms: Date.now() - started },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
