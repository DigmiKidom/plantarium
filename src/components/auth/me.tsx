"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { PROFILE_CHANGED, applyTheme, currentTheme } from "@/lib/settings/client";
import { parseSettings } from "@/lib/settings/schema";
import type { Role } from "@/lib/auth/roles";

export type Me = { name: string; username: string | null; role: Role; avatarUrl: string | null } | null;

const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** undefined = still loading, null = signed out. */
const MeContext = createContext<Me | undefined>(undefined);

/**
 * Loads the signed-in user once for the whole shell (nav, menus), in the browser,
 * so public pages stay static. Display only – access control happens on the server (proxy + RLS).
 */
export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | undefined>(configured ? undefined : null);
  // Re-check on navigation: login/logout happen in server actions that end with a redirect.
  const pathname = usePathname();

  useEffect(() => {
    if (!configured) return;
    const supabase = createBrowserSupabase();
    let active = true;

    const load = async (userId: string | undefined, fallbackName: string) => {
      if (!userId) return active && setMe(null);
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (!active) return;
      setMe({
        name: data?.display_name || fallbackName,
        username: data?.username ?? null,
        role: (data?.role as Role) ?? "user",
        avatarUrl: data?.avatar_url ?? null,
      });
      // Signed-in users get their saved theme on every device.
      if (data && "settings" in data) {
        const saved = parseSettings(data.settings).theme;
        if (saved !== currentTheme()) applyTheme(saved);
      }
    };
    const reload = () =>
      supabase.auth.getSession().then(({ data }) => load(data.session?.user.id, data.session?.user.email ?? ""));

    reload();
    window.addEventListener(PROFILE_CHANGED, reload);
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user.id, session?.user.email ?? "");
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener(PROFILE_CHANGED, reload);
    };
  }, [pathname]);

  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

export const useMe = () => useContext(MeContext);

/** Profile photo, or the first letter of the name on a green circle. */
export function Avatar({ name, url, className }: { name: string; url?: string | null; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`size-9 shrink-0 rounded-full bg-surface-2 object-cover ${className ?? ""}`} aria-hidden />;
  }
  // Default letter size only when the caller didn't choose one (Tailwind can't tell which class wins)
  const text = /(^|\s)(md:)?text-(xs|sm|base|lg|xl|\d?xl|\[)/.test(className ?? "") ? "" : "text-sm";
  return (
    <span
      className={`grid size-9 shrink-0 place-items-center rounded-full bg-primary font-bold text-on-primary ${text} ${className ?? ""}`}
      aria-hidden
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}
