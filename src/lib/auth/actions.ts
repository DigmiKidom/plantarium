"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { safeNext } from "@/lib/safe-next";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { createAdminClient, hasAdmin } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";
import { CAPTCHA_FAILED, TOO_MANY, clientIp, rateLimit, verifyCaptcha } from "./guard";
import {
  authErrorHe,
  forgotSchema,
  profileSchema,
  resetSchema,
  signInSchema,
  signUpSchema,
  toFieldErrors,
  type FormState,
} from "./schemas";

const NOT_CONFIGURED: FormState = { error: "Supabase לא מוגדר (.env.local)" };


const pick = (fd: FormData, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "")]));

export async function signUp(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!hasSupabase()) return NOT_CONFIGURED;
  const values = pick(fd, ["displayName", "username", "email"]);
  const parsed = signUpSchema.safeParse(pick(fd, ["displayName", "username", "email", "password", "confirm"]));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const { displayName, username, email, password } = parsed.data;
  const ip = await clientIp();
  if (!(await verifyCaptcha(fd.get("cf-turnstile-response"), ip))) return { error: CAPTCHA_FAILED, values };
  // 5 new accounts per IP per hour
  if (!(await rateLimit(`signup:ip:${ip}`, 5, 3600))) return { error: TOO_MANY, values };
  const supabase = await createUserClient();

  const { data: taken } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
  if (taken) return { fieldErrors: { username: "שם המשתמש תפוס" }, values };

  // No email verification for now: create the user already confirmed (no email is sent),
  // then sign in. Works whatever the "Confirm email" setting in Supabase is.
  if (!hasAdmin()) return { error: "חסר SUPABASE_SERVICE_ROLE_KEY ב-.env.local", values };
  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, username },
  });
  if (createError) return { error: authErrorHe(createError.message), values };

  // The database trigger creates the profile; set the name and username explicitly too,
  // so the account never ends up named after the email address.
  if (created.user) {
    const { error: profileError } = await admin
      .from("profiles")
      .upsert({ id: created.user.id, display_name: displayName, username }, { onConflict: "id" });
    if (profileError) console.error(JSON.stringify({ at: "auth.signUp.profile", error: profileError.message }));
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: authErrorHe(signInError.message), values };

  revalidatePath("/", "layout");
  redirect(safeNext(fd.get("next")));
}

export async function signIn(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!hasSupabase()) return NOT_CONFIGURED;
  const values = pick(fd, ["email"]);
  const parsed = signInSchema.safeParse(pick(fd, ["email", "password"]));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const ip = await clientIp();
  if (!(await verifyCaptcha(fd.get("cf-turnstile-response"), ip))) return { error: CAPTCHA_FAILED, values };
  // Brute force: 30 tries per IP and 10 per account in 15 minutes
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`login:ip:${ip}`, 30, 900),
    rateLimit(`login:email:${parsed.data.email}`, 10, 900),
  ]);
  if (!byIp || !byEmail) return { error: TOO_MANY, values };

  const supabase = await createUserClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorHe(error.message), values };

  revalidatePath("/", "layout");
  redirect(safeNext(fd.get("next")));
}

export async function signOut() {
  if (hasSupabase()) {
    const supabase = await createUserClient();
    await supabase.auth.signOut();
  }
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!hasSupabase()) return NOT_CONFIGURED;
  const values = pick(fd, ["displayName", "username", "bio"]);
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/profile");

  const { data: banned } = await supabase.rpc("is_banned");
  if (banned === true) return { error: "החשבון מושעה ולא ניתן לערוך אותו", values };

  const { displayName, username, bio } = parsed.data;
  const { data: taken } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", auth.user.id)
    .maybeSingle();
  if (taken) return { fieldErrors: { username: "שם המשתמש תפוס" }, values };

  const { data: saved, error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, username, bio: bio || null })
    .eq("id", auth.user.id)
    .select("id");
  if (error?.code === "23505") return { fieldErrors: { username: "שם המשתמש תפוס" }, values };
  // No error but no row = blocked by a security rule or no profile row – don't pretend it saved.
  if (error || !saved?.length) return { error: "השמירה נכשלה. נסו שוב", values };

  revalidatePath("/profile");
  return { message: "הפרופיל נשמר", values };
}

// ---------- forgotten password ----------
const RESET_SENT = "אם הכתובת רשומה אצלנו, שלחנו אליה קישור לאיפוס הסיסמה. הקישור תקף לשעה.";

export async function requestPasswordReset(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!hasSupabase()) return NOT_CONFIGURED;
  const values = pick(fd, ["email"]);
  const parsed = forgotSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const ip = await clientIp();
  if (!(await verifyCaptcha(fd.get("cf-turnstile-response"), ip))) return { error: CAPTCHA_FAILED, values };
  const [byIp, byEmail] = await Promise.all([
    rateLimit(`reset:ip:${ip}`, 5, 3600),
    rateLimit(`reset:email:${parsed.data.email}`, 3, 3600),
  ]);
  if (!byIp) return { error: TOO_MANY, values };
  // Same answer whether or not the address exists (no account discovery).
  if (!byEmail) return { message: RESET_SENT, values };

  const supabase = await createUserClient();
  const redirectTo = new URL("/auth/callback?next=/reset-password", getSiteUrl()).toString();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
  if (error) {
    console.error(JSON.stringify({ at: "auth.reset.request", code: error.code, error: error.message }));
    if (error.message.toLowerCase().includes("rate limit")) return { error: TOO_MANY, values };
  }
  return { message: RESET_SENT, values };
}

export async function updatePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!hasSupabase()) return NOT_CONFIGURED;
  const parsed = resetSchema.safeParse(pick(fd, ["password", "confirm"]));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createUserClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "הקישור פג תוקף. בקשו קישור חדש" };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error(JSON.stringify({ at: "auth.reset.update", code: error.code, error: error.message }));
    if (error.message.toLowerCase().includes("different from the old")) return { error: "הסיסמה החדשה צריכה להיות שונה מהקודמת" };
    return { error: authErrorHe(error.message) };
  }
  revalidatePath("/", "layout");
  redirect("/profile?password=changed");
}
