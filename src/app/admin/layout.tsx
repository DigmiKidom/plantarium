import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { adminCounts, missingDbUpdates } from "@/lib/admin/queries";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = { title: { default: "ניהול", template: "%s | ניהול | פלנטריום" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole(["admin", "editor"], "/admin"); // everyone else gets a 404
  const [counts, missing] = await Promise.all([adminCounts(), missingDbUpdates()]);
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1 className="text-3xl font-bold">{profile.role === "admin" ? "ניהול האתר" : "אישור תוכן"}</h1>
      {missing.length > 0 && (
        <p role="alert" className="rounded-2xl bg-sun-soft px-4 py-3 text-sm">
          <span className="font-semibold">חסרים עדכוני מסד נתונים:</span> {missing.join(", ")}. חלק מהמסכים לא יעבדו עד שמריצים{" "}
          <code className="ltr rounded bg-surface px-1.5 py-0.5">npm run db:push</code>.
        </p>
      )}
      <AdminNav counts={counts} role={profile.role} />
      {children}
    </div>
  );
}
