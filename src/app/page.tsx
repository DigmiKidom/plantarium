import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Search, Sprout, Store } from "lucide-react";
import { getFeed } from "@/lib/feed/queries";
import type { FeedTab } from "@/lib/feed/types";
import { listPublished } from "@/lib/magazine/queries";
import { listListings } from "@/lib/market/queries";
import { formatPrice, listingName } from "@/lib/market/types";
import { speciesOptions } from "@/lib/market/species-options";
import { createUserClient, hasSupabase } from "@/lib/supabase/server";
import { TodayBar } from "@/components/home/today-bar";
import { Composer } from "@/components/feed/composer";
import { FeedList } from "@/components/feed/feed-list";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: { absolute: "החממה | פלנטריום – הבית הדיגיטלי של הצמחים שלך" },
  description: "החממה של פלנטריום: מגדלים משתפים עדכונים, תמונות ושאלות על הצמחים שלהם.",
};
export const dynamic = "force-dynamic";

function PlantSearch() {
  return (
    <form action="/magazine/plants" className="relative">
      <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        name="q"
        aria-label="חיפוש צמח במאגר"
        placeholder="חיפוש צמח במאגר…"
        className="w-full rounded-full border border-border bg-surface py-2.5 pe-4 ps-10 text-sm outline-none focus:border-primary"
      />
    </form>
  );
}

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const tab: FeedTab = (await searchParams).tab === "following" ? "following" : "all";
  const [{ posts, viewerId, hasMore }, articles, listings] = await Promise.all([
    getFeed({ tab }),
    listPublished({ limit: 3 }),
    listListings({ limit: 4 }),
  ]);

  let me: { name: string; isAdmin: boolean; avatarUrl?: string | null } | null = null;
  if (viewerId && hasSupabase()) {
    const { data } = await (await createUserClient()).from("profiles").select("display_name, role, avatar_url").eq("id", viewerId).maybeSingle();
    me = { name: data?.display_name ?? "", isAdmin: data?.role === "admin", avatarUrl: data?.avatar_url ?? null };
  }
  const species = me ? await speciesOptions() : [];

  const tabCls = (active: boolean) =>
    cn(
      "-mb-px border-b-2 px-4 py-2.5 text-sm",
      active ? "border-primary font-semibold text-primary" : "border-transparent text-muted hover:text-text",
    );

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="flex min-w-0 flex-col gap-5">
        <TodayBar />

        <header className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">החממה</h1>
            <p className="text-muted">מה קורה אצל המגדלים של פלנטריום</p>
          </div>
        </header>

        {me ? (
          <Composer name={me.name} avatarUrl={me.avatarUrl} species={species} />
        ) : (
          <section className="relative overflow-hidden rounded-3xl bg-leaf-soft p-6">
            <div className="relative z-10 flex max-w-md flex-col gap-3">
              <h2 className="text-xl font-bold">ברוכים הבאים לחממה</h2>
              <p className="text-sm text-muted">
                מגדלים משתפים כאן עלים חדשים, פריחות, שאלות וטיפים. הצטרפו כדי לפרסם, להגיב ולעקוב אחרי מגדלים אחרים.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/signup" className="rounded-full bg-primary px-5 py-2 font-semibold text-on-primary hover:bg-primary-strong">
                  הצטרפות
                </Link>
                <Link href="/login" className="rounded-full border border-border bg-surface px-5 py-2 font-medium hover:bg-surface-2">
                  התחברות
                </Link>
              </div>
            </div>
            <Sprout className="pointer-events-none absolute -bottom-6 end-0 size-40 text-primary opacity-10" aria-hidden />
          </section>
        )}

        <nav aria-label="תצוגת החממה" className="flex border-b border-border">
          <Link href="/" aria-current={tab === "all" ? "page" : undefined} className={tabCls(tab === "all")}>
            לכולם
          </Link>
          <Link href="/?tab=following" aria-current={tab === "following" ? "page" : undefined} className={tabCls(tab === "following")}>
            במעקב
          </Link>
        </nav>

        <FeedList
          key={tab}
          initial={posts}
          hasMore={hasMore}
          tab={tab}
          viewer={viewerId ? { id: viewerId, isAdmin: me?.isAdmin ?? false } : null}
          empty={
            <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">
              {tab === "following"
                ? viewerId
                  ? "עוד אין כאן פוסטים. עקבו אחרי מגדלים כדי לראות את העדכונים שלהם."
                  : "התחברו כדי לראות פוסטים של מגדלים שאתם עוקבים אחריהם."
                : "עוד אין פוסטים בחממה. היו הראשונים לשתף!"}
            </p>
          }
        />
      </div>

      <aside className="hidden flex-col gap-6 lg:flex">
        <div className="sticky top-6 flex flex-col gap-6">
          <PlantSearch />

          {articles.length > 0 && (
            <section className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
              <h2 className="font-bold">מהמגזין</h2>
              <ul className="flex flex-col gap-3">
                {articles.map((a) => (
                  <li key={a.id}>
                    <Link href={`/magazine/${a.slug}`} className="group flex gap-3">
                      {a.cover_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.cover_url} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                      )}
                      <span className="line-clamp-3 text-sm font-medium group-hover:text-primary">{a.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/magazine" className="flex items-center gap-1 text-sm text-primary hover:underline">
                לכל הכתבות
                <ArrowLeft className="size-4" aria-hidden />
              </Link>
            </section>
          )}

          <section className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
            <h2 className="flex items-center gap-2 font-bold">
              <Store className="size-5 text-primary" aria-hidden />
              חדש בשוק
            </h2>
            {listings.length === 0 ? (
              <p className="text-sm text-muted">עוד אין מודעות. יש לכם צמח למסור?</p>
            ) : (
              <ul className="grid grid-cols-2 gap-2">
                {listings.map((l) => (
                  <li key={l.id}>
                    <Link href={`/market/l/${l.id}`} className="group flex flex-col gap-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.photos[0]} alt="" className="aspect-square w-full rounded-xl object-cover" />
                      <span className="truncate text-xs font-medium group-hover:text-primary">{listingName(l)}</span>
                      <span className="text-xs text-muted">{formatPrice(l.price)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/market" className="flex items-center gap-1 text-sm text-primary hover:underline">
              לשוק הצמחים
              <ArrowLeft className="size-4" aria-hidden />
            </Link>
          </section>
        </div>
      </aside>
    </div>
  );
}
