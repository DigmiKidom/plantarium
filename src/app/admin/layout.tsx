import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { adminCounts } from "@/lib/admin/queries";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = { title: { default: "ניהול", template: "%s | ניהול | פלנטריום" }, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["admin"], "/admin"); // everyone else gets a 404
  const counts = await adminCounts();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <h1 className="text-3xl font-bold">ניהול האתר</h1>
      <AdminNav counts={counts} />
      {children}
    </div>
  );
}
