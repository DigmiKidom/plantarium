"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { notifyProfileChanged } from "@/lib/settings/client";
import { updateProfile } from "@/lib/auth/actions";
import type { FormState } from "@/lib/auth/schemas";
import { Field, FormAlert, SubmitButton } from "@/components/ui/form";

export function ProfileForm({ initial }: { initial: { displayName: string; username: string; bio: string } }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, { values: initial });
  const router = useRouter();
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? initial;

  // After a successful save: refresh the page header and the name/@username in the menu.
  useEffect(() => {
    if (state.message) {
      notifyProfileChanged();
      router.refresh();
    }
  }, [state, router]);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormAlert error={state.error} message={state.message} />
      <Field label="שם מלא" name="displayName" required defaultValue={v.displayName} error={fe.displayName} />
      <Field
        label="שם משתמש"
        name="username"
        ltr
        required
        defaultValue={v.username}
        error={fe.username}
        hint="באנגלית: אותיות קטנות, ספרות ו-_"
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="f-bio" className="text-sm font-medium">
          קצת עליי
        </label>
        <textarea
          id="f-bio"
          name="bio"
          rows={3}
          maxLength={300}
          defaultValue={v.bio}
          placeholder="מה אתם מגדלים? איפה? כמה זמן?"
          className="w-full resize-y rounded-xl border border-border bg-bg px-3.5 py-3 outline-none focus:border-primary"
        />
        {fe.bio && <p className="text-sm text-accent">{fe.bio}</p>}
      </div>
      <SubmitButton className="self-start">שמירה</SubmitButton>
    </form>
  );
}
