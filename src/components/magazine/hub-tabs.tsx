"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Newspaper, NotebookPen, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/magazine", label: "כתבות", icon: NotebookPen },
  { href: "/magazine/plants", label: "מאגר הצמחים", icon: BookOpen },
  { href: "/magazine/blog", label: "בלוג", icon: Newspaper },
];

export function HubTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="מדורי המגזין" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/magazine" ? pathname === "/magazine" : pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm transition-colors",
                  active ? "border-primary bg-primary font-semibold text-on-primary" : "border-border hover:bg-surface-2",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
