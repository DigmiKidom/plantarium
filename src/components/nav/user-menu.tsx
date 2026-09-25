"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronUp,
  LogIn,
  LogOut,
  Menu,
  PenLine,
  Settings,
  ShieldCheck,
  Trees,
  User,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { canWrite } from "@/lib/auth/roles";
import { Avatar, useMe, type Me } from "@/components/auth/me";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: LucideIcon };

/** Personal pages live in the account menu, not in the main nav. */
function accountItems(me: NonNullable<Me>): Item[] {
  return [
    { href: "/profile", label: "הפרופיל שלי", icon: User },
    { href: "/garden", label: "הגינה שלי", icon: Trees },
    ...(canWrite(me.role) ? [{ href: "/magazine/write", label: "המאמרים שלי", icon: PenLine }] : []),
    ...(me.role === "admin" ? [{ href: "/admin", label: "ניהול האתר", icon: ShieldCheck }] : []),
    { href: "/settings", label: "הגדרות", icon: Settings },
  ];
}

const guestItems: Item[] = [
  { href: "/login", label: "התחברות", icon: LogIn },
  { href: "/signup", label: "הרשמה", icon: UserPlus },
  { href: "/settings", label: "הגדרות", icon: Settings },
];

const ACCOUNT_PATHS = ["/profile", "/garden", "/settings", "/admin", "/magazine/write"];
export const isAccountPath = (p: string) => ACCOUNT_PATHS.some((a) => p === a || p.startsWith(a + "/"));

/** Open/close state that closes on navigation, outside click and Escape. */
function useDisclosure() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);

  // Close when the route changes (adjusting state during render, per React docs)
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (root.current?.contains(t) || panel.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, root, panel, trigger };
}

function MenuList({ items, pathname, withSignOut }: { items: Item[]; pathname: string; withSignOut: boolean }) {
  return (
    <ul className="flex flex-col p-1.5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px]",
                active ? "bg-leaf-soft font-semibold text-primary-strong" : "hover:bg-surface-2",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
      {withSignOut && (
        <li className="mt-1 border-t border-border pt-1">
          <form action={signOut}>
            <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-muted hover:bg-accent-soft hover:text-accent">
              <LogOut className="size-5 shrink-0 rtl:-scale-x-100" aria-hidden />
              התנתקות
            </button>
          </form>
        </li>
      )}
    </ul>
  );
}

/** Desktop sidebar: the user's name opens the account menu (upwards). */
export function SidebarUserMenu() {
  const me = useMe();
  const pathname = usePathname();
  const { open, setOpen, root, trigger } = useDisclosure();
  const menuId = useId();

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
        <Link href="/settings" className="flex items-center justify-center gap-1.5 py-1 text-sm text-muted hover:text-primary">
          <Settings className="size-4" aria-hidden />
          הגדרות
        </Link>
      </div>
    );
  }

  const highlighted = open || isAccountPath(pathname);

  return (
    <div ref={root} className="relative">
      {open && (
        <div
          id={menuId}
          className="absolute inset-x-0 bottom-full mb-2 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
        >
          <MenuList items={accountItems(me)} pathname={pathname} withSignOut />
        </div>
      )}
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl p-2 text-start transition-colors",
          highlighted ? "bg-leaf-soft" : "hover:bg-surface-2",
        )}
      >
        <Avatar name={me.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{me.name}</span>
          {me.username && <span className="ltr block truncate text-xs text-muted">@{me.username}</span>}
        </span>
        <ChevronUp className={cn("size-4 shrink-0 text-muted transition-transform", !open && "rotate-180")} aria-hidden />
        <span className="sr-only">תפריט החשבון</span>
      </button>
    </div>
  );
}

/** Mobile top bar: avatar (or a menu icon for guests) opens a panel under the header. */
export function CompactUserMenu() {
  const me = useMe();
  const pathname = usePathname();
  const { open, setOpen, root, panel, trigger } = useDisclosure();
  const menuId = useId();

  if (me === undefined) return <div className="size-9 animate-pulse rounded-full bg-surface-2" />;

  return (
    <div ref={root}>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? "סגירת התפריט" : me ? "תפריט החשבון" : "תפריט"}
        onClick={() => setOpen(!open)}
        className={cn(
          "grid size-10 place-items-center rounded-full",
          !me && "border border-border",
          (open || isAccountPath(pathname)) && !me && "bg-leaf-soft",
        )}
      >
        {open ? (
          <X className="size-5" aria-hidden />
        ) : me ? (
          <Avatar name={me.name} className={cn(isAccountPath(pathname) && "ring-2 ring-primary ring-offset-2 ring-offset-bg")} />
        ) : (
          <Menu className="size-5" aria-hidden />
        )}
      </button>
      {open &&
        // Portal: the header uses backdrop-blur, which would trap `position: fixed` children inside it
        createPortal(
          <div ref={panel} dir="rtl" className="md:hidden">
            <div className="fixed inset-x-0 bottom-0 top-16 z-30 bg-black/20" aria-hidden onClick={() => setOpen(false)} />
            <div
              id={menuId}
              className="fixed inset-x-3 top-18 z-50 max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-2xl border border-border bg-surface text-text shadow-xl"
            >
            {me && (
              <Link href="/profile" className="flex items-center gap-3 border-b border-border p-4">
                <Avatar name={me.name} className="size-11 text-base" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{me.name}</span>
                  {me.username && <span className="ltr block truncate text-sm text-muted">@{me.username}</span>}
                </span>
              </Link>
            )}
              <MenuList items={me ? accountItems(me) : guestItems} pathname={pathname} withSignOut={Boolean(me)} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
