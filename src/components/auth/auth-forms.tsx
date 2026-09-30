"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/lib/auth/actions";
import { Captcha } from "./captcha";
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
      <Link href="/forgot-password" className="-mt-2 self-start text-sm text-primary hover:underline">
        שכחתי סיסמה
      </Link>
      <Captcha resetKey={state} />
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
      <Captcha resetKey={state} />
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

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
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
      <Captcha resetKey={state} />
      <SubmitButton className="mt-2">שליחת קישור לאיפוס</SubmitButton>
      <p className="text-center text-sm text-muted">
        נזכרת?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          חזרה להתחברות
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, initial);
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormAlert error={state.error} message={state.message} />
      <Field
        label="סיסמה חדשה"
        name="password"
        type="password"
        autoComplete="new-password"
        ltr
        required
        error={fe.password}
        hint="לפחות 8 תווים"
      />
      <Field label="אימות סיסמה" name="confirm" type="password" autoComplete="new-password" ltr required error={fe.confirm} />
      <SubmitButton className="mt-2">שמירת הסיסמה</SubmitButton>
    </form>
  );
}
