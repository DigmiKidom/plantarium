"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Download, Loader2, Trash2 } from "lucide-react";
import { deleteMyAccount, exportMyData } from "@/lib/account/actions";
import { DELETE_WORD } from "@/lib/account/data";
import { Field, FormAlert } from "@/components/ui/form";

/** "Download my data" and "Delete my account" – on the settings page, signed-in users only. */
export function AccountData() {
  const [exporting, startExport] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [exportError, setExportError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const download = () =>
    startExport(async () => {
      setExportError("");
      const res = await exportMyData();
      if (!res.ok) return setExportError(res.error);
      const url = URL.createObjectURL(new Blob([res.json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

  const remove = (e: React.FormEvent) => {
    e.preventDefault();
    startDelete(async () => {
      setDeleteError("");
      // On success the server signs out and moves to the home page; we only get here on failure.
      const res = await deleteMyAccount({ password, confirm });
      if (res && !res.ok) setDeleteError(res.error);
    });
  };

  const ready = password.length > 0 && confirm.trim() === DELETE_WORD;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">הורדת המידע שלי</h3>
        <p className="text-sm text-muted">
          קובץ אחד (JSON) עם כל מה ששמרתם בפלנטריום: פרופיל, צמחים, השקיות, פוסטים, מודעות ותגובות.
        </p>
        <button
          type="button"
          onClick={download}
          disabled={exporting}
          className="flex w-fit items-center gap-2 rounded-full border border-border px-5 py-2 font-medium hover:bg-surface-2 disabled:opacity-60"
        >
          {exporting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
          הורדת הקובץ
        </button>
        <FormAlert error={exportError || undefined} />
      </div>

      <details className="group rounded-2xl border border-accent/40 p-4">
        <summary className="cursor-pointer font-semibold text-accent">מחיקת החשבון</summary>
        <form onSubmit={remove} className="mt-4 flex flex-col gap-4">
          <p className="text-sm">
            המחיקה סופית ואי אפשר לבטל אותה: החשבון, הצמחים, ההיסטוריה, הפוסטים, המודעות, התגובות והתמונות שלכם יימחקו.
            כדאי להוריד קודם את המידע. פרטים ב
            <Link href="/privacy" className="font-medium text-primary hover:underline">
              מדיניות הפרטיות
            </Link>
            .
          </p>
          <Field
            label="הסיסמה שלכם"
            name="delete-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            ltr
            required
          />
          <Field
            label={`כדי לאשר, כתבו ״${DELETE_WORD}״`}
            name="delete-confirm"
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <FormAlert error={deleteError || undefined} />
          <button
            type="submit"
            disabled={!ready || deleting}
            className="flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-2 font-semibold text-on-accent hover:opacity-90 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
            מחיקת החשבון לצמיתות
          </button>
        </form>
      </details>
    </div>
  );
}
