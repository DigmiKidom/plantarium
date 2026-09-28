import Link from "next/link";
import { Ban, Flag, Leaf, Newspaper, Users } from "lucide-react";
import { adminCounts } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/session";

export default async function AdminHome() {
  const { profile } = await requireRole(["admin", "editor"], "/admin");
  const c = await adminCounts();
  const editorOnly = profile.role !== "admin";
  const tiles = [
    { href: "/admin/reports", label: "דיווחים פתוחים", value: c.reports, icon: Flag, alert: c.reports > 0 },
    { href: "/admin/articles", label: "מאמרים לאישור", value: c.pending, icon: Newspaper, alert: c.pending > 0 },
    { href: "/admin/species", label: "צמחים חדשים לבדיקה", value: c.species, icon: Leaf, alert: c.species > 0 },
    { href: "/admin/users", label: "משתמשים", value: c.users, icon: Users },
    { href: "/admin/users?banned=1", label: "מושעים כרגע", value: c.banned, icon: Ban },
  ];
  const shown = editorOnly ? tiles.filter((t) => t.href === "/admin/articles" || t.href === "/admin/species") : tiles;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {shown.map(({ href, label, value, icon: Icon, alert }) => (
        <Link key={href} href={href} className="flex flex-col gap-2 rounded-3xl border border-border bg-surface p-5 hover:shadow-md">
          <Icon className={alert ? "size-6 text-accent" : "size-6 text-primary"} aria-hidden />
          <span className="text-3xl font-bold">{value.toLocaleString("he-IL")}</span>
          <span className="text-sm text-muted">{label}</span>
        </Link>
      ))}
    </div>
  );
}
