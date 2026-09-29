"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, Pencil, RotateCcw, ShieldX, Trash2 } from "lucide-react";
import { adminRemoveListing, deleteListing, setListingStatus } from "@/lib/market/actions";
import type { ListingStatus } from "@/lib/market/types";
import { FormAlert } from "@/components/ui/form";

type R = { ok: true } | { ok: false; error: string };

/** Seller controls: edit, mark sold / back to sale, delete. */
export function SellerActions({ id, status, afterDelete = "/market/mine" }: { id: string; status: ListingStatus; afterDelete?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<R>, then?: () => void) =>
    startTransition(async () => {
      setError(undefined);
      const res = await fn();
      if (!res.ok) return setError(res.error);
      if (then) then();
      else router.refresh();
    });

  const btn = "flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-surface-2 disabled:opacity-60";
  if (status === "removed") return null;
  return (
    <div className="flex flex-col gap-2">
      <FormAlert error={error} />
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/market/edit/${id}`} className={btn}>
          <Pencil className="size-4" aria-hidden />
          עריכה
        </Link>
        {status === "active" ? (
          <button type="button" disabled={pending} onClick={() => run(() => setListingStatus(id, "sold"))} className={btn}>
            <CheckCircle2 className="size-4" aria-hidden />
            סימון כנמכר
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => run(() => setListingStatus(id, "active"))} className={btn}>
            <RotateCcw className="size-4" aria-hidden />
            החזרה למכירה
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm("למחוק את המודעה? אי אפשר לשחזר.")) run(() => deleteListing(id), () => router.push(afterDelete));
          }}
          className={`${btn} hover:border-accent hover:text-accent`}
        >
          <Trash2 className="size-4" aria-hidden />
          מחיקה
        </button>
        {pending && <Loader2 className="size-4 animate-spin text-muted" aria-label="מעדכן" />}
      </div>
    </div>
  );
}

/** Admin: take a listing down (with a reason that goes to the admin log). */
export function AdminRemoveListing({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-accent p-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 self-start text-sm font-medium text-accent">
        <ShieldX className="size-4" aria-hidden />
        הסרת המודעה (מנהל)
      </button>
      {open && (
        <>
          <FormAlert error={error} />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="סיבה (תוצג למוכר/ת)"
            maxLength={500}
            className="rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await adminRemoveListing(id, reason);
                if (!res.ok) return setError(res.error);
                router.refresh();
              })
            }
            className="self-start rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-60"
          >
            הסרה
          </button>
        </>
      )}
    </div>
  );
}
