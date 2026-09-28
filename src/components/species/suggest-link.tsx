"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useMe } from "@/components/auth/me";
import { canWrite } from "@/lib/auth/roles";

/** "Suggest a new plant" – shown to magazine writers (the page itself checks the role). */
export function SuggestSpeciesLink() {
  const me = useMe();
  if (!me || !canWrite(me.role)) return null;
  return (
    <Link href="/magazine/plants/suggest" className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface-2">
      <Plus className="size-4" aria-hidden />
      הצעת צמח חדש
    </Link>
  );
}
