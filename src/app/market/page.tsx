import type { Metadata } from "next";
import Link from "next/link";
import { Apple, Carrot, Flower2, Leaf, Plus, Sprout, Store, type LucideIcon } from "lucide-react";
import { categoryCounts, listListings } from "@/lib/market/queries";
import { MARKET_CATEGORIES } from "@/lib/market/types";
import type { Category } from "@/lib/species/types";
import { ListingTable } from "@/components/market/listing-table";

export const metadata: Metadata = {
  title: "שוק הצמחים",
  description: "קנייה, מכירה ומסירה של צמחים יד שנייה – צמחי בית, עצי פרי, תבלינים ועוד.",
};
export const dynamic = "force-dynamic";

const ICON: Record<Category, LucideIcon> = {
  houseplant: Leaf,
  garden: Flower2,
  fruit_tree: Apple,
  succulent: Sprout,
  herb: Sprout,
  vegetable: Carrot,
};

export default async function MarketPage() {
  const [counts, latest] = await Promise.all([categoryCounts(), listListings({ limit: 10 })]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold md:text-4xl">
            <Store className="size-8 text-primary" aria-hidden />
            שוק הצמחים
          </h1>
          <p className="mt-1 text-muted">צמחים יד שנייה מגדלים אחרים – לקנות, למכור או למסור</p>
        </div>
        <Link
          href="/market/new"
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary hover:bg-primary-strong"
        >
          <Plus className="size-5" aria-hidden />
          פרסום מודעה
        </Link>
      </header>

      <section aria-labelledby="cats" className="flex flex-col gap-3">
        <h2 id="cats" className="text-xl font-bold">
          בחרו קטגוריה
        </h2>
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {MARKET_CATEGORIES.map(({ key, he, hint }) => {
            const Icon = ICON[key];
            const n = counts[key] ?? 0;
            return (
              <li key={key}>
                <Link
                  href={`/market/${key}`}
                  className="flex h-full flex-col gap-2 rounded-3xl border border-border bg-surface p-4 transition hover:border-primary hover:shadow-md md:p-5"
                >
                  <span className="grid size-11 place-items-center rounded-2xl bg-leaf-soft text-primary">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className="font-bold">{he}</span>
                  <span className="text-xs text-muted">{hint}</span>
                  <span className="mt-auto text-sm font-medium text-primary">{n > 0 ? `${n} מודעות` : "אין מודעות עדיין"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="latest" className="flex flex-col gap-3">
        <h2 id="latest" className="text-xl font-bold">
          מודעות אחרונות
        </h2>
        <ListingTable listings={latest} />
      </section>
    </div>
  );
}
