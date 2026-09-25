import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, ShieldAlert } from "lucide-react";
import { createPublicClient, createUserClient, hasSupabase } from "@/lib/supabase/server";
import { ROLE_HE, isBannedNow, type Role } from "@/lib/auth/roles";
import { listPublished } from "@/lib/magazine/queries";
import { ArticleCard } from "@/components/magazine/article-card";
import { ReportButton } from "@/components/reports/report-button";
import { formatDate } from "@/lib/dates";

type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  role: Role;
  banned_until: string | null;
  created_at: string;
};

async function getProfile(username: string) {
  if (!hasSupabase() || !/^[a-z0-9_]{3,24}$/.test(username)) return null;
  const { data } = await createPublicClient()
    .from("profiles")
    .select("id, username, display_name, bio, role, banned_until, created_at")
    .eq("username", username)
    .maybeSingle<PublicProfile>();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const p = await getProfile((await params).username.toLowerCase());
  return p ? { title: `${p.display_name} (@${p.username})` } : { title: "לא נמצא" };
}

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: PageProps<"/u/[username]">) {
  const profile = await getProfile((await params).username.toLowerCase());
  if (!profile) notFound();

  const { data: auth } = await (await createUserClient()).auth.getUser();
  const viewerId = auth.user?.id;
  const banned = isBannedNow(profile.banned_until);
  const articles = banned ? [] : await listPublished({ authorId: profile.id, limit: 12 });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="flex flex-wrap items-center gap-4">
        <span className="grid size-20 shrink-0 place-items-center rounded-full bg-primary text-3xl font-bold text-on-primary" aria-hidden>
          {profile.display_name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-bold">{profile.display_name}</h1>
          <p className="ltr text-muted">@{profile.username}</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {profile.role !== "user" && <li className="rounded-full bg-leaf-soft px-2.5 py-0.5 text-primary-strong">{ROLE_HE[profile.role]}</li>}
            <li className="flex items-center gap-1">
              <CalendarDays className="size-4" aria-hidden />
              הצטרפות: {formatDate(profile.created_at)}
            </li>
          </ul>
        </div>
        {viewerId && viewerId !== profile.id && <ReportButton userId={profile.id} name={profile.display_name} />}
      </header>

      {banned ? (
        <p className="flex items-center gap-2 rounded-2xl bg-accent-soft px-4 py-3 text-accent">
          <ShieldAlert className="size-5" aria-hidden />
          החשבון הזה מושעה.
        </p>
      ) : (
        profile.bio && <p className="whitespace-pre-line">{profile.bio}</p>
      )}

      {articles.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold">כתבות במגזין</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {articles.map((a) => (
              <ArticleCard key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
