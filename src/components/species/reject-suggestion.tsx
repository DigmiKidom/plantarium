"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rejectSuggestion } from "@/lib/species/actions";
import { FormAlert } from "@/components/ui/form";

export function RejectSuggestion({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2 rounded-3xl border border-dashed border-accent p-4">
      <button type="button" onClick={() => setOpen((o) => !o)} className="self-start text-sm font-medium text-accent">
        לא לאשר את ההצעה
      </button>
      {open && (
        <>
          <FormAlert error={error} />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="למה? (הכותב/ת יראו את ההערה)"
            className="rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await rejectSuggestion(id, note);
                if (!res.ok) return setError(res.error);
                router.push("/admin/species");
                router.refresh();
              })
            }
            className="self-start rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-60"
          >
            דחיית ההצעה
          </button>
        </>
      )}
    </div>
  );
}
