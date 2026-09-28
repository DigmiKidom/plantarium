"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { banUser, deleteUser, dismissReports, setPlan, setRole, unbanUser, type AdminResult } from "@/lib/admin/actions";
import { BAN_DURATIONS, BAN_DURATION_HE, type BanDuration } from "@/lib/admin/bans";
import { ROLES, ROLE_DESC, ROLE_HE, type Role } from "@/lib/auth/roles";
import { FormAlert } from "@/components/ui/form";
import { cn } from "@/lib/cn";

export type ManagedUser = {
  id: string;
  username: string | null;
  display_name: string;
  role: Role;
  plan: "free" | "plus";
  banned: boolean;
};

type Panel = null | "role" | "ban" | "delete";

const inputCls = "w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-primary";

export function UserManage({ user, isSelf, withDismiss }: { user: ManagedUser; isSelf: boolean; withDismiss?: boolean }) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [role, setRoleValue] = useState<Role>(user.role);
  const [plan, setPlanValue] = useState(user.plan);
  const [duration, setDuration] = useState<BanDuration>("7d");
  const [reason, setReason] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const confirmWord = user.username ? user.username.toLowerCase() : "מחיקה";
  const [result, setResult] = useState<AdminResult>();
  const [pending, startTransition] = useTransition();

  if (isSelf || user.role === "admin") {
    return <p className="text-xs text-muted">{isSelf ? "זה החשבון שלך" : "מנהל – ניהול דרך Supabase בלבד"}</p>;
  }

  const run = (fn: () => Promise<AdminResult>) =>
    startTransition(async () => {
      const res = await fn();
      setResult(res);
      if (res.ok) {
        setPanel(null);
        setReason("");
        setConfirmName("");
        router.refresh();
      }
    });

  const tab = (p: Exclude<Panel, null>, label: string, Icon: typeof Ban, danger?: boolean) => (
    <button
      type="button"
      onClick={() => {
        setResult(undefined);
        setPanel(panel === p ? null : p);
      }}
      aria-expanded={panel === p}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm",
        panel === p ? "border-primary bg-leaf-soft" : "border-border hover:bg-surface-2",
        danger && "hover:border-accent hover:text-accent",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {tab("role", "תפקיד וחבילה", UserCog)}
        {user.banned ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => unbanUser(user.id))}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
          >
            <ShieldCheck className="size-4" aria-hidden />
            ביטול השעיה
          </button>
        ) : (
          tab("ban", "השעיה", Ban, true)
        )}
        {tab("delete", "מחיקה", Trash2, true)}
        {withDismiss && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => dismissReports(user.id))}
            className="rounded-full border border-border px-3 py-1.5 text-sm hover:bg-surface-2"
          >
            סגירת הדיווחים (אין בעיה)
          </button>
        )}
        {pending && <Loader2 className="size-5 animate-spin self-center text-muted" aria-label="מעבד" />}
      </div>

      {result && <FormAlert error={result.ok ? undefined : result.error} message={result.ok ? result.message : undefined} />}

      {panel === "role" && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-surface-2 p-3">
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm">
            תפקיד
            <select value={role} onChange={(e) => setRoleValue(e.target.value as Role)} className={inputCls}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_HE[r]}
                </option>
              ))}
            </select>
            <span className="text-xs text-muted">{ROLE_DESC[role]}</span>
          </label>
          <button
            type="button"
            disabled={pending || role === user.role}
            onClick={() => {
              if (role === "admin" && !confirm("מנהל יוכל להשעות ולמחוק משתמשים, ולא ניתן לשנות אותו מהאתר. להמשיך?")) return;
              run(() => setRole(user.id, role));
            }}
            className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            שמירה
          </button>
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm">
            חבילה (מכסת מודעות בשוק)
            <select value={plan} onChange={(e) => setPlanValue(e.target.value as "free" | "plus")} className={inputCls}>
              <option value="free">חינם – עד 5 מודעות</option>
              <option value="plus">פלוס – עד 50 מודעות</option>
            </select>
          </label>
          <button
            type="button"
            disabled={pending || plan === user.plan}
            onClick={() => run(() => setPlan(user.id, plan))}
            className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary disabled:opacity-50"
          >
            שמירה
          </button>
        </div>
      )}

      {panel === "ban" && (
        <div className="flex flex-col gap-2 rounded-2xl bg-accent-soft p-3">
          <label className="flex flex-col gap-1 text-sm">
            משך ההשעיה
            <select value={duration} onChange={(e) => setDuration(e.target.value as BanDuration)} className={inputCls}>
              {(Object.keys(BAN_DURATIONS) as BanDuration[]).map((d) => (
                <option key={d} value={d}>
                  {BAN_DURATION_HE[d]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            סיבה (נשמרת ביומן הניהול)
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={inputCls} />
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => banUser({ userId: user.id, duration, reason }))}
            className="self-start rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            השעיית {user.display_name}
          </button>
        </div>
      )}

      {panel === "delete" && (
        <div className="flex flex-col gap-2 rounded-2xl bg-accent-soft p-3">
          <p className="text-sm">
            מחיקה מוחקת לצמיתות את החשבון, הפרופיל, הצמחים, המאמרים והדיווחים שלו. אי אפשר לשחזר.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            סיבה
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            לאישור, הקלידו: <span className={cn("font-semibold", user.username && "ltr")}>{confirmWord}</span>
            <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} dir={user.username ? "ltr" : undefined} className={cn(inputCls, "text-start")} />
          </label>
          <button
            type="button"
            disabled={pending || confirmName.trim().toLowerCase() !== confirmWord}
            onClick={() => run(() => deleteUser({ userId: user.id, confirm: confirmName, reason }))}
            className="self-start rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            מחיקה לצמיתות
          </button>
        </div>
      )}
    </div>
  );
}
