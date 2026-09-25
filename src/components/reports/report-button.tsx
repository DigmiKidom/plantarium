"use client";

import { useRef, useState, useTransition } from "react";
import { Flag, Loader2 } from "lucide-react";
import { reportUser } from "@/lib/reports/actions";
import { REPORT_REASONS, REPORT_REASON_HE, type ReportReason } from "@/lib/reports/reasons";
import { FormAlert } from "@/components/ui/form";

export function ReportButton({ userId, name }: { userId: string; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return setError("נא לבחור סיבה");
    setError(undefined);
    startTransition(async () => {
      const res = await reportUser({ userId, reason, details });
      if (!res.ok) return setError(res.error);
      setDone(true);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted hover:border-accent hover:text-accent"
      >
        <Flag className="size-4" aria-hidden />
        דיווח
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="report-title"
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl border border-border bg-surface p-0 text-text backdrop:bg-black/40"
      >
        {done ? (
          <div className="flex flex-col gap-4 p-6">
            <h2 id="report-title" className="text-xl font-bold">
              תודה, הדיווח התקבל
            </h2>
            <p className="text-muted">צוות האתר יבדוק אותו. לא נמסור ל{name} מי דיווח.</p>
            <button type="button" onClick={() => dialog.current?.close()} className="self-start rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary">
              סגירה
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4 p-6">
            <h2 id="report-title" className="text-xl font-bold">
              דיווח על {name}
            </h2>
            <FormAlert error={error} />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">מה הבעיה?</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5 has-[:checked]:border-primary has-[:checked]:bg-leaf-soft">
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--primary)]" />
                  {REPORT_REASON_HE[r]}
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              פרטים נוספים (לא חובה)
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={1000}
                rows={3}
                className="rounded-xl border border-border bg-bg px-3.5 py-3 font-normal outline-none focus:border-primary"
              />
            </label>
            <div className="flex gap-3">
              <button type="submit" disabled={pending} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-semibold text-white disabled:opacity-60">
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                שליחת דיווח
              </button>
              <button type="button" onClick={() => dialog.current?.close()} className="rounded-full border border-border px-5 py-2.5">
                ביטול
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
