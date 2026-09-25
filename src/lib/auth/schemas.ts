import { z } from "zod";

export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

const email = z.email({ error: "כתובת אימייל לא תקינה" }).trim().toLowerCase();
const password = z
  .string()
  .min(8, { error: "הסיסמה צריכה להכיל לפחות 8 תווים" })
  .max(72, { error: "הסיסמה ארוכה מדי" });
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_RE, { error: "שם משתמש: 3–24 תווים באנגלית, ספרות או _" });
const displayName = z
  .string()
  .trim()
  .min(2, { error: "השם צריך להכיל לפחות 2 תווים" })
  .max(40, { error: "השם ארוך מדי" });

export const signUpSchema = z
  .object({ displayName, username, email, password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], error: "הסיסמאות לא תואמות" });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "נא להזין סיסמה" }),
});

export const profileSchema = z.object({
  displayName,
  username,
  bio: z.string().trim().max(300, { error: "עד 300 תווים" }).optional().default(""),
});

export type FieldErrors = Partial<Record<string, string>>;

export type FormState = {
  error?: string;
  fieldErrors?: FieldErrors;
  message?: string;
  values?: Record<string, string>;
};

export function toFieldErrors(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const k = String(issue.path[0] ?? "form");
    out[k] ??= issue.message;
  }
  return out;
}

/** Supabase Auth error → Hebrew message */
export function authErrorHe(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("banned")) return "החשבון הושעה על ידי צוות האתר";
  if (m.includes("invalid login credentials")) return "אימייל או סיסמה שגויים";
  if (m.includes("already registered") || m.includes("already been registered")) return "כבר קיים חשבון עם האימייל הזה";
  if (m.includes("email not confirmed"))
    return "החשבון נוצר לפני שבוטל אימות האימייל. (מנהל: להריץ supabase/snippets/confirm-existing-users.sql)";
  if (m.includes("password")) return "הסיסמה לא עומדת בדרישות – לפחות 8 תווים";
  if (m.includes("rate limit")) return "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות";
  if (m.includes("signups not allowed")) return "ההרשמה סגורה כרגע";
  if (m.includes("database error")) return "לא הצלחנו ליצור את הפרופיל. נסו שם משתמש אחר";
  return "משהו השתבש. נסו שוב";
}
