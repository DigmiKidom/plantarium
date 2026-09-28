"use client";

import Link from "next/link";
import { PenLine } from "lucide-react";
import { useMe } from "@/components/auth/me";
import { canWrite } from "@/lib/auth/roles";

/** "אזור הכותבים" – only for accounts with writing permission (authors, editors, admins). */
export function WriterZoneLink() {
  const me = useMe();
  if (!me || !canWrite(me.role)) return null;
  return (
    <Link href="/magazine/write" className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-primary">
      <PenLine className="size-4" aria-hidden />
      אזור הכותבים
    </Link>
  );
}
