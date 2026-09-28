"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useMe } from "@/components/auth/me";
import { isReviewer } from "@/lib/auth/roles";

/** Shown to chief editors and admins (display only – the edit page and the database check the role again). */
export function AdminEditLink({ slug }: { slug: string }) {
  const me = useMe();
  if (!isReviewer(me?.role)) return null;
  return (
    <Link
      href={`/magazine/plants/${slug}/edit`}
      className="flex items-center gap-2 rounded-full border border-border px-5 py-3 font-medium hover:bg-surface-2"
    >
      <Pencil className="size-4" aria-hidden />
      עריכת הצמח
    </Link>
  );
}
