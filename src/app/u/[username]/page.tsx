import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Pencil, ShieldAlert, Store, NotebookPen, MessageSquare } from "lucide-react";
import { createPublicClient, createUserClient, hasSupabase } from "@/lib/supabase/server";
import { ROLE_HE, isBannedNow, type Role } from "@/lib/auth/roles";
import { listPublished } from "@/lib/magazine/queries";
import { listListings } from "@/lib/market/queries";
import { followCounts, isFollowing } from "@/lib/follows/queries";
import { getFeed } from "@/lib/feed/queries";
import { speciesOptions } from "@/lib/market/species-options";
import { ArticleCard } from "@/components/magazine/article-card";
import { ListingTable } from "@/components/market/listing-table";
import { ReportButton } from "@/components/reports/report-button";
import { FollowButton } from "@/components/follow/follow-button";
import { UserManage } from "@/components/admin/user-manage";
import { Composer } from "@/components/feed/composer";
import { FeedList } from "@/components/feed/feed-list";
import { PhotoButton } from "@/components/profile/photo-button";
import { Avatar } from "@/components/auth/me";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/cn";

type PublicProfile = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  role: Role;
  banned_until: string | null;
  created_at: string;
  avatar_url: string | null;
  cover_url?: string | null;
};

const BASE = "id, username, display_name, bio, role, banned_until, created_at, avatar_url";

async function getProfile(username: string) {
  if (!hasSupabase() || !/^[a-z0-9_]{3,24}$/.test(username)) return null;
  const db = createPublicClient();
  const res = await db.from("profiles").select(`${BASE}, cover_url`).eq("username", username).maybeSingle<PublicProfile>();
  if (!res.error) return res.data;
  // cover_url arrives with database update 0014 – still show the profile before it's applied
  const { data } = await db.from("profiles").select(BASE).eq("username", username).maybeSingle<PublicProfile>();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const p = await getProfile((await params).username.toLowerCase());
  return p
    ? { title: `${p.display_name} (@${p.username})`, description: p.bio ?? undefined, openGraph: p.avatar_url ? { images: [p.avatar_url] } : undefined }
    : { title: "לא נמצא" };
}

export const dynamic = "force-dynamic";

const TABS = [
  { key: "posts", label: "פוסטים", icon: MessageSquare },
  { key: "market", label: "בשוק", icon: Store },
  { key: "articles", label: "כתבות", icon: NotebookPen },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default async function PublicProfilePage({ params, searchParams }: PageProps<"/u/[username]">) {
  const profile = await getProfile((await params).username.toLowerCase());
  if (!profile) notFound();
  const sp = await searchParams;
  const tab: Tab = sp.tab === "market" || sp.tab === "articles" ? sp.tab : "posts";

  const db = await createUserClient();
  const { data: auth } = await db.auth.getUser();
  const viewerId = auth.user?.id ?? null;
  const isOwn = viewerId === profile.id;
  let viewer: { role: Role; name: string; avatar: string | null } | null = null;
  if (viewerId) {
    const { data: me } = await db.from("profiles").select("role, display_name, avatar_url").eq("id", viewerId).maybeSingle();
    viewer = { role: (me?.role as Role) ?? "user", name: me?.display_name ?? "", avatar: me?.avatar_url ?? null };
  }
  const viewerIsAdmin = viewer?.role === "admin";
  let targetPlan: "free" | "plus" = "free";
  if (viewerIsAdmin) {
    const { data: p, error } = await db.from("profiles").select("plan").eq("id", profile.id).maybeSingle();
    if (!error && p?.plan === "plus") targetPlan = "plus";
  }

  const banned = isBannedNow(profile.banned_until);
  const pub = createPublicClient();
  const [counts, following, postCount, listings, articles, feed, species] = await Promise.all([
    followCounts(profile.id),
    viewerId && !isOwn ? isFollowing(viewerId, profile.id) : Promise.resolve(false),
    pub.from("posts").select("id", { count: "exact", head: true }).eq("author_id", profile.id).is("deleted_at", null).then((r) => r.count ?? 0),
    banned ? Promise.resolve([]) : listListings({ sellerId: profile.id, limit: 30 }),
    banned ? Promise.resolve([]) : listPublished({ authorId: profile.id, limit: 24 }),
    banned || tab !== "posts" ? Promise.resolve(null) : getFeed({ authorId: profile.id }),
    isOwn && tab === "posts" ? speciesOptions() : Promise.resolve([]),
  ]);

  const tabCount: Record<Tab, number> = { posts: postCount, market: listings.length, articles: articles.length };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* ---------- Header: cover + avatar ---------- */}
      <section className="overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="relative h-40 bg-gradient-to-l from-leaf-soft via-surface-2 to-water-soft sm:h-56 md:h-64">
          {profile.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.cover_url} alt="" className="absolute inset-0 size-full object-cover" />
          )}
          {isOwn && (
            <div className="absolute bottom-3 end-3">
              <PhotoButton kind="cover" label={profile.cover_url ? "החלפת תמונת נושא" : "הוספת תמונת נושא"} showLabel />
            </div>
          )}
        </div>

        <div className="relative flex flex-col gap-4 px-4 pb-4 md:flex-row md:items-end md:gap-6 md:px-8">
          <div className="relative -mt-16 w-fit md:-mt-20">
            <Avatar
              name={profile.display_name}
              url={profile.avatar_url}
              className="size-32 border-4 border-surface text-5xl md:size-40 md:text-6xl"
            />
            {isOwn && (
              <div className="absolute bottom-1 end-1">
                <PhotoButton kind="avatar" label="החלפת תמונת פרופיל" className="p-2.5" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 md:pb-2">
            <h1 className="truncate text-3xl font-bold">{profile.display_name}</h1>
            <p className="text-muted">
              <span className="ltr">@{profile.username}</span>
            </p>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <li>
                <span className="font-bold tabular-nums">{postCount}</span> <span className="text-muted">פוסטים</span>
              </li>
              <li>
                <Link href={`/u/${profile.username}/followers`} className="hover:text-primary">
                  <span className="font-bold tabular-nums">{counts.followers}</span> <span className="text-muted">עוקבים</span>
                </Link>
              </li>
              <li>
                <Link href={`/u/${profile.username}/following`} className="hover:text-primary">
                  <span className="font-bold tabular-nums">{counts.following}</span> <span className="text-muted">במעקב</span>
                </Link>
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:pb-2">
            {isOwn ? (
              <Link href="/profile" className="flex items-center gap-2 rounded-full border border-border px-5 py-2 font-medium hover:bg-surface-2">
                <Pencil className="size-4" aria-hidden />
                עריכת פרופיל
              </Link>
            ) : (
              !banned && <FollowButton userId={profile.id} following={following} signedIn={Boolean(viewerId)} loginNext={`/u/${profile.username}`} />
            )}
            {viewerId && !isOwn && <ReportButton userId={profile.id} name={profile.display_name} />}
          </div>
        </div>

        {/* Tabs */}
        <nav aria-label="תוכן הפרופיל" className="flex overflow-x-auto border-t border-border px-2 md:px-6">
          {TABS.map(({ key, label, icon: Icon }) => (
            <Link
              key={key}
              href={key === "posts" ? `/u/${profile.username}` : `/u/${profile.username}?tab=${key}`}
              aria-current={tab === key ? "page" : undefined}
              className={cn(
                "-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm",
                tab === key ? "border-primary font-semibold text-primary" : "border-transparent text-muted hover:text-text",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
              <span className="rounded-full bg-surface-2 px-1.5 text-xs tabular-nums">{tabCount[key]}</span>
            </Link>
          ))}
        </nav>
      </section>

      {viewerIsAdmin && !isOwn && (
        <section aria-label="ניהול" className="flex flex-col gap-3 rounded-3xl border border-dashed border-accent p-4">
          <h2 className="text-sm font-semibold text-accent">ניהול החשבון (מנהל)</h2>
          <UserManage
            isSelf={false}
            user={{ id: profile.id, username: profile.username, display_name: profile.display_name, role: profile.role, plan: targetPlan, banned }}
          />
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* ---------- About (right column in RTL) ---------- */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <section className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-5">
            <h2 className="text-lg font-bold">אודות</h2>
            {banned ? (
              <p className="flex items-center gap-2 text-sm text-accent">
                <ShieldAlert className="size-4" aria-hidden />
                החשבון הזה מושעה.
              </p>
            ) : profile.bio ? (
              <p className="whitespace-pre-line text-sm leading-relaxed">{profile.bio}</p>
            ) : (
              <p className="text-sm text-muted">{isOwn ? "עוד לא כתבת כלום על עצמך." : "עוד לא נכתב כלום."}</p>
            )}
            <ul className="flex flex-col gap-2 text-sm text-muted">
              {profile.role !== "user" && (
                <li>
                  <span className="rounded-full bg-leaf-soft px-2.5 py-0.5 text-primary-strong">{ROLE_HE[profile.role]}</span>
                </li>
              )}
              <li className="flex items-center gap-2">
                <CalendarDays className="size-4" aria-hidden />
                הצטרפות: {formatDate(profile.created_at)}
              </li>
            </ul>
            {isOwn && !profile.bio && (
              <Link href="/profile" className="text-sm text-primary underline">
                הוספת תיאור
              </Link>
            )}
          </section>
        </aside>

        {/* ---------- Content ---------- */}
        <div className="flex min-w-0 flex-col gap-4">
          {tab === "posts" &&
            (banned ? null : (
              <>
                {isOwn && viewer && <Composer name={viewer.name} avatarUrl={viewer.avatar} species={species} />}
                {feed && (
                  <FeedList
                    key={profile.id}
                    initial={feed.posts}
                    hasMore={feed.hasMore}
                    tab="all"
                    authorId={profile.id}
                    viewer={viewerId ? { id: viewerId, isAdmin: viewerIsAdmin } : null}
                    empty={
                      <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">
                        {isOwn ? "עוד לא פרסמת כלום. שתפו את הצמח הראשון שלכם!" : "עוד אין פוסטים."}
                      </p>
                    }
                  />
                )}
              </>
            ))}

          {tab === "market" &&
            (listings.length ? (
              <ListingTable listings={listings} />
            ) : (
              <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">אין מודעות פעילות בשוק.</p>
            ))}

          {tab === "articles" &&
            (articles.length ? (
              <div className="grid gap-5 sm:grid-cols-2">
                {articles.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
            ) : (
              <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">אין כתבות במגזין.</p>
            ))}
        </div>
      </div>
    </div>
  );
}
