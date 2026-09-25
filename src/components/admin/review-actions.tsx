"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Undo2 } from "lucide-react";
import { approveArticle, rejectArticle, unpublishArticle, type AdminResult } from "@/lib/admin/actions";
import { FormAlert } from "@/components/ui/form";

export function ReviewActions({ id, published }: { id: string; published: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<AdminResult>();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<AdminResult>, then?: string) =>
    startTransition(async () => {
      const res = await fn();
      setResult(res);
      if (res.ok) {
        if (then) router.push(then);
        else router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
      {result && <FormAlert error={result.ok ? undefined : result.error} message={result.ok ? result.message : undefined} />}
      <div className="flex flex-wrap gap-2">
        {!published && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => approveArticle(id), "/admin/articles")}
            className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary disabled:opacity-60"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
            אישור ופרסום
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-2 rounded-full border border-border px-5 py-2.5 hover:border-accent hover:text-accent"
        >
          <Undo2 className="size-4" aria-hidden />
          {published ? "הורדה מהמגזין" : "החזרה לתיקון"}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-2">
          <label htmlFor="note" className="text-sm font-medium">
            הערה לכותב/ת – מה צריך לתקן?
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            className="rounded-xl border border-border bg-bg px-3.5 py-3 outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => (published ? unpublishArticle(id, note) : rejectArticle(id, note)), "/admin/articles")}
            className="self-start rounded-full bg-accent px-5 py-2.5 font-semibold text-white disabled:opacity-60"
          >
            שליחה לכותב/ת
          </button>
        </div>
      )}
    </div>
  );
}
