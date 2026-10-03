"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, NotebookPen, Plus, Sprout, Store, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { MeProvider } from "@/components/auth/me";
import { CompactUserMenu, SidebarUserMenu } from "@/components/nav/user-menu";

type NavItem = { href: string; label: string; icon: LucideIcon };

/**
 * Main nav = the places everyone goes. Personal pages (profile, garden, my articles, admin,
 * settings) are in the account menu under the user's name, on both desktop and mobile.
 */
const DESKTOP_NAV: NavItem[] = [
  { href: "/", label: "החממה", icon: Home },
  { href: "/plants", label: "הצמחים שלי", icon: Sprout },
  { href: "/magazine", label: "מגזין", icon: NotebookPen },
  { href: "/market", label: "שוק הצמחים", icon: Store },
];

/** Two on each side of the raised + button. */
const MOBILE_NAV: NavItem[] = [
  { href: "/", label: "החממה", icon: Home },
  { href: "/plants", label: "צמחים", icon: Sprout },
  { href: "/plants/new", label: "הוספה", icon: Plus },
  { href: "/magazine", label: "מגזין", icon: NotebookPen },
  { href: "/market", label: "שוק", icon: Store },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/plants") return pathname === "/plants" || (pathname.startsWith("/plants/") && pathname !== "/plants/new");
  // Personal areas (writer area, my listings) belong to the account menu
  if (href === "/magazine") return pathname.startsWith("/magazine") && !pathname.startsWith("/magazine/write");
  if (href === "/market") return pathname.startsWith("/market") && !pathname.startsWith("/market/mine");
  return pathname === href || pathname.startsWith(href + "/");
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="פלנטריום – לדף הבית" className={cn("block w-fit", className)}>
      {/* The full brand logo (public/brand/logo.png) everywhere */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo.png" alt="פלנטריום" width={1200} height={279} className="h-full w-auto object-contain dark:brightness-150" />
    </Link>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <MeProvider>
      <a
        href="#main"
        className="sr-only z-50 whitespace-nowrap rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary shadow-lg focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:px-5 focus:py-2.5"
      >
        דלג לתוכן
      </a>
      <div className="mx-auto flex min-h-dvh max-w-7xl">
        {/* Desktop sidebar – first in DOM, so it sits on the right in RTL */}
        <aside aria-label="תפריט האתר" className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-e border-border px-4 py-6 md:flex">
          <Logo className="h-12" />
          <nav aria-label="ניווט ראשי" className="flex flex-col gap-1">
            {DESKTOP_NAV.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors",
                    active ? "bg-leaf-soft font-semibold text-primary-strong" : "text-text hover:bg-surface-2",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/plants/new"
            className="mt-2 flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 font-semibold text-on-primary hover:bg-primary-strong"
          >
            <Plus className="size-5" aria-hidden />
            הוספת צמח
          </Link>
          <div className="mt-auto flex flex-col gap-3">
            <SidebarUserMenu />
            <Link href="/privacy" className="px-3 text-xs text-muted hover:text-text hover:underline">
              מדיניות פרטיות
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur md:hidden">
            <Logo className="h-9" />
            <CompactUserMenu />
          </header>

          <main id="main" tabIndex={-1} className="flex-1 px-4 pb-28 pt-6 outline-none md:px-8 md:pb-12">
            {children}
          </main>
        </div>

        {/* Mobile bottom bar */}
        <nav
          aria-label="תפריט תחתון"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            const isAdd = href === "/plants/new";
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-1 py-2 text-[11px]", active ? "font-semibold text-primary" : "text-muted")}
              >
                {isAdd ? (
                  <span className="-mt-5 grid size-12 place-items-center rounded-full bg-primary text-on-primary shadow-lg">
                    <Icon className="size-6" aria-hidden />
                  </span>
                ) : (
                  <Icon className="size-5" aria-hidden />
                )}
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </MeProvider>
  );
}
