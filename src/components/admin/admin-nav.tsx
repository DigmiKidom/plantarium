"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/admin", label: "סקירה" },
  { href: "/admin/reports", label: "דיווחים" },
  { href: "/admin/articles", label: "מאמרים" },
  { href: "/admin/users", label: "משתמשים" },
  { href: "/admin/log", label: "יומן" },
];

export function AdminNav({ counts }: { counts: { reports: number; pending: number } }) {
  const pathname = usePathname();
  const badge = (href: string) => (href === "/admin/reports" ? counts.reports : href === "/admin/articles" ? counts.pending : 0);
  return (
    <nav aria-label="ניהול" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1 border-b border-border">
        {TABS.map(({ href, label }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          const n = badge(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm",
                  active ? "border-primary font-semibold text-primary" : "border-transparent text-muted hover:text-text",
                )}
              >
                {label}
                {n > 0 && <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-white">{n}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
