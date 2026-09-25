"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Newspaper, NotebookPen, Plus, Sprout, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { MeProvider } from "@/components/auth/me";
import { CompactUserMenu, SidebarUserMenu } from "@/components/nav/user-menu";

type NavItem = { href: string; label: string; icon: LucideIcon };

/**
 * Main nav = the places everyone goes. Personal pages (profile, garden, my articles, admin,
 * settings) are in the account menu under the user's name, on both desktop and mobile.
 */
const DESKTOP_NAV: NavItem[] = [
  { href: "/", label: "בית", icon: Home },
  { href: "/plants", label: "הצמחים שלי", icon: Sprout },
  { href: "/knowledge", label: "ידע", icon: BookOpen },
  { href: "/magazine", label: "מגזין", icon: NotebookPen },
  { href: "/blog", label: "בלוג", icon: Newspaper },
];

const MOBILE_NAV: NavItem[] = [
  { href: "/", label: "בית", icon: Home },
  { href: "/plants", label: "צמחים", icon: Sprout },
  { href: "/knowledge", label: "ידע", icon: BookOpen },
  { href: "/magazine", label: "מגזין", icon: NotebookPen },
  { href: "/blog", label: "בלוג", icon: Newspaper },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/plants") return pathname === "/plants" || (pathname.startsWith("/plants/") && pathname !== "/plants/new");
  // The writer area belongs to the account menu, not to "Magazine"
  if (href === "/magazine") return pathname.startsWith("/magazine") && !pathname.startsWith("/magazine/write");
  return pathname === href || pathname.startsWith(href + "/");
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 font-bold text-primary", className)}>
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <circle cx="16" cy="16" r="15" fill="currentColor" opacity="0.14" />
        <path
          d="M16 25c0-7 3-12 9-14-1 7-4 11-9 14Zm0 0c0-5-2-9-7-11 0 6 3 9 7 11Z"
          fill="currentColor"
        />
        <path d="M16 25v-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="text-xl tracking-tight">פלנטריום</span>
    </Link>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <MeProvider>
      <div className="mx-auto flex min-h-dvh max-w-7xl">
        {/* Desktop sidebar – first in DOM, so it sits on the right in RTL */}
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-e border-border px-4 py-6 md:flex">
          <Logo />
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
          <div className="mt-auto">
            <SidebarUserMenu />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur md:hidden">
            <Logo />
            <CompactUserMenu />
          </header>

          <main className="flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12">{children}</main>
        </div>

        {/* Mobile bottom bar */}
        <nav
          aria-label="ניווט ראשי"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        >
          {MOBILE_NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-1 py-2 text-[11px]", active ? "font-semibold text-primary" : "text-muted")}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile "add plant" – floating button above the bottom bar (bottom-left in RTL).
            Hidden where a page has its own sticky action bar (the article editor). */}
        {pathname !== "/plants/new" && !pathname.startsWith("/magazine/write") && (
          <Link
            href="/plants/new"
            aria-label="הוספת צמח"
            className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] end-4 z-30 grid size-14 place-items-center rounded-full bg-primary text-on-primary shadow-lg hover:bg-primary-strong md:hidden"
          >
            <Plus className="size-7" aria-hidden />
          </Link>
        )}
      </div>
    </MeProvider>
  );
}
