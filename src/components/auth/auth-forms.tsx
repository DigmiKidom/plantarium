"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, signUp } from "@/lib/auth/actions";
import type { FormState } from "@/lib/auth/schemas";
import { Field, FormAlert, SubmitButton } from "@/components/ui/form";

const initial: FormState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, initial);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormAlert error={state.error} message={state.message} />
      <Field
        label="אימייל"
        name="email"
        type="email"
        autoComplete="email"
        ltr
        required
        defaultValue={state.values?.email}
        error={fe.email}
      />
      <Field
        label="סיסמה"
        name="password"
        type="password"
        autoComplete="current-password"
        ltr
        required
        error={fe.password}
      />
      <SubmitButton className="mt-2">התחברות</SubmitButton>
      <p className="text-center text-sm text-muted">
        אין לך חשבון?{" "}
        <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">
          להרשמה
        </Link>
      </p>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action] = useActionState(signUp, initial);
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormAlert error={state.error} message={state.message} />
      <Field label="שם מלא" name="displayName" autoComplete="name" required defaultValue={v.displayName} error={fe.displayName} />
      <Field
        label="שם משתמש"
        name="username"
        autoComplete="username"
        ltr
        required
        defaultValue={v.username}
        error={fe.username}
        hint="באנגלית: אותיות קטנות, ספרות ו-_ (יופיע בכתובת הפרופיל)"
      />
      <Field label="אימייל" name="email" type="email" autoComplete="email" ltr required defaultValue={v.email} error={fe.email} />
      <Field
        label="סיסמה"
        name="password"
        type="password"
        autoComplete="new-password"
        ltr
        required
        error={fe.password}
        hint="לפחות 8 תווים"
      />
      <Field label="אימות סיסמה" name="confirm" type="password" autoComplete="new-password" ltr required error={fe.confirm} />
      <SubmitButton className="mt-2">יצירת חשבון</SubmitButton>
      <p className="text-center text-sm text-muted">
        כבר יש לך חשבון?{" "}
        <Link href={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">
          להתחברות
        </Link>
      </p>
    </form>
  );
}
