import "server-only";
import { notFound, redirect } from "next/navigation";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { isBannedNow, type Role } from "./roles";

export type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  role: Role;
  banned_until: string | null;
  created_at: string;
};

const PROFILE_COLUMNS = "id, username, display_name, bio, avatar_url, role, banned_until, created_at";

/** Signed-in user + profile, or redirect to /login. Banned users are signed out. Use in private pages. */
export async function requireUser(next: string) {
  if (!hasSupabase()) redirect("/login");
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(next)}`);

  const { data: profile } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", data.user.id).single<Profile>();

  if (profile && isBannedNow(profile.banned_until)) {
    await supabase.auth.signOut();
    redirect("/login?banned=1");
  }

  return { user: data.user, profile, supabase };
}

/** Like requireUser, but the page doesn't exist (404) for users without one of the roles. */
export async function requireRole(roles: readonly Role[], next: string) {
  const session = await requireUser(next);
  if (!session.profile || !roles.includes(session.profile.role)) notFound();
  return { ...session, profile: session.profile };
}
