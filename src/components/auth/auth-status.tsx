"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { signOut } from "@/lib/auth/actions";
import { PROFILE_CHANGED, applyTheme, currentTheme } from "@/lib/settings/client";
import { parseSettings } from "@/lib/settings/schema";
import type { Role } from "@/lib/auth/roles";

type Me = { name: string; username: string | null; role: Role } | null;

const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Signed-in state for the nav, loaded in the browser so public pages stay static.
 * undefined = still loading, null = signed out.
 */
export function useMe(): Me | undefined {
  const [me, setMe] = useState<Me | undefined>(configured ? undefined : null);
  // Re-check on navigation: login/logout happen in server actions that end with a redirect.
  const pathname = usePathname();

  useEffect(() => {
    if (!configured) return;
    const supabase = createBrowserSupabase();

    const load = async (userId: string | undefined, fallbackName: string) => {
      if (!userId) return setMe(null);
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      setMe({ name: data?.display_name || fallbackName, username: data?.username ?? null, role: (data?.role as Role) ?? "user" });
      // Signed-in users get their saved theme on every device.
      if (data && "settings" in data) {
        const saved = parseSettings(data.settings).theme;
        if (saved !== currentTheme()) applyTheme(saved);
      }
    };
    const reload = () =>
      supabase.auth.getSession().then(({ data }) => load(data.session?.user.id, data.session?.user.email ?? ""));

    // Display only – reads the local session cookie. Access control happens on the server (proxy + RLS).
    reload();
    window.addEventListener(PROFILE_CHANGED, reload);
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user.id, session?.user.email ?? "");
    });
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener(PROFILE_CHANGED, reload);
    };
  }, [pathname]);

  return me;
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-on-primary" aria-hidden>
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

/** Desktop sidebar block */
export function AuthStatusSidebar() {
  const me = useMe();
  if (me === undefined) return <div className="h-14 animate-pulse rounded-2xl bg-surface-2" />;

  if (!me) {
    return (
      <div className="flex flex-col gap-2">
        <Link href="/signup" className="rounded-full bg-primary px-4 py-2.5 text-center font-semibold text-on-primary hover:bg-primary-strong">
          הרשמה
        </Link>
        <Link href="/login" className="rounded-full border border-border px-4 py-2.5 text-center font-medium hover:bg-surface-2">
          התחברות
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl p-2 hover:bg-surface-2">
      <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={me.name} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{me.name}</span>
          {me.username && <span className="ltr block truncate text-xs text-muted">@{me.username}</span>}
        </span>
      </Link>
      <form action={signOut}>
        <button type="submit" title="התנתקות" aria-label="התנתקות" className="rounded-full p-2 text-muted hover:bg-bg hover:text-accent">
          <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
        </button>
      </form>
    </div>
  );
}

/** Mobile top bar */
export function AuthStatusCompact() {
  const me = useMe();
  if (me === undefined) return <div className="size-9 animate-pulse rounded-full bg-surface-2" />;
  if (!me) {
    return (
      <Link href="/login" className="rounded-full border border-border px-4 py-1.5 text-sm font-medium">
        התחברות
      </Link>
    );
  }
  return (
    <Link href="/profile" aria-label="הפרופיל שלי">
      <Avatar name={me.name} />
    </Link>
  );
}
