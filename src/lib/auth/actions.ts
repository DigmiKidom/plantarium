"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { createAdminClient, hasAdmin } from "@/lib/supabase/admin";
import {
  authErrorHe,
  profileSchema,
  signInSchema,
  signUpSchema,
  toFieldErrors,
  type FormState,
} from "./schemas";

const NOT_CONFIGURED: FormState = { error: "Supabase לא מוגדר (.env.local)" };

/** Only allow redirects to local paths, never to other sites. */
function safeNext(raw: FormDataEntryValue | null): string {
  const s = typeof raw === "string" ? raw : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

const pick = (fd: FormData, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "")]));

export async function signUp(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!hasSupabase()) return NOT_CONFIGURED;
  const values = pick(fd, ["displayName", "username", "email"]);
  const parsed = signUpSchema.safeParse(pick(fd, ["displayName", "username", "email", "password", "confirm"]));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };

  const { displayName, username, email, password } = parsed.data;
  const supabase = await createUserClient();

  const { data: taken } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
  if (taken) return { fieldErrors: { username: "שם המשתמש תפוס" }, values };

  // No email verification for now: create the user already confirmed (no email is sent),
  // then sign in. Works whatever the "Confirm email" setting in Supabase is.
  if (!hasAdmin()) return { error: "חסר SUPABASE_SERVICE_ROLE_KEY ב-.env.local", values };
  const admin = createAdminClient();
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, username },
  });
  if (createError) return { error: authErrorHe(createError.message), values };

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
