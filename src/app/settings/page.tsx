import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { THEME_COOKIE, parseSettings, type Settings } from "@/lib/settings/schema";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "הגדרות", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let signedIn = false;
  let account: Settings | null = null;

  if (hasSupabase()) {
    const supabase = await createUserClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      signedIn = true;
      // Own settings are private (not readable from the profiles table) – read them through my_settings().
      const { data: row, error } = await supabase.rpc("my_settings");
      // error = database not updated yet → fall back to browser settings
      account = error ? null : parseSettings(row);
    }
  }

  // Account settings win; otherwise what this browser saved; otherwise defaults.
  const browser = parseSettings({ theme: (await cookies()).get(THEME_COOKIE)?.value });
  const initial: Settings = account ?? browser;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold">הגדרות</h1>
        <p className="mt-1 text-muted">כאן יתווספו הגדרות חדשות לאתר.</p>
      </header>
      <SettingsView signedIn={signedIn} initial={initial} />
    </div>
  );
}
