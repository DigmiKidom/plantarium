import "server-only";
import { redirect } from "next/navigation";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
};

/** Signed-in user + profile, or redirect to /login. Use in private pages. */
export async function requireUser(next: string) {
  if (!hasSupabase()) redirect("/login");
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(next)}`);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, created_at")
    .eq("id", data.user.id)
    .single<Profile>();

  return { user: data.user, profile, supabase };
}
