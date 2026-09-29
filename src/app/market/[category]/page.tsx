import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { listListings, otherCount, speciesCounts } from "@/lib/market/queries";
import { OTHER_SPECIES, SORTS, categoryHe, formatPrice, isMarketCategory, isSupplyCategory, type Sort } from "@/lib/market/types";
import { ListingTable } from "@/components/market/listing-table";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/market/[category]">): Promise<Metadata> {
  const { category } = await params;
  return isMarketCategory(category) ? { title: `${categoryHe(category)} | שוק הצמחים` } : { title: "לא נמצא" };
}

export default async function MarketCategoryPage({ params, searchParams }: PageProps<"/market/[category]">) {
  const { category } = await params;
  if (!isMarketCategory(category)) notFound();
  const sp = await searchParams;
  const speciesSlug = typeof sp.species === "string" && /^[a-z0-9-]+$/.test(sp.species) ? sp.species : undefined;
  const sort: Sort = typeof sp.sort === "string" && sp.sort in SORTS ? (sp.sort as Sort) : "new";

  const supply = isSupplyCategory(category);
  const [species, others, listings] = await Promise.all([
    supply ? Promise.resolve([]) : speciesCounts(category),
    supply ? Promise.resolve(0) : otherCount(category),
    listListings({ category, speciesSlug, sort }),
  ]);
  const chosen = species.find((s) => s.slug === speciesSlug);
  const isOther = speciesSlug === OTHER_SPECIES;

  const href = (patch: { species?: string | null; sort?: Sort }) => {
    const p = new URLSearchParams();
    const sSlug = patch.species === null ? undefined : (patch.species ?? speciesSlug);
    const sSort = patch.sort ?? sort;
    if (sSlug) p.set("species", sSlug);
    if (sSort !== "new") p.set("sort", sSort);
    const q = p.toString();
    return `/market/${category}${q ? `?${q}` : ""}`;
  };

  const chip = (active: boolean) =>
    cn(
      "flex items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors",
      active ? "border-primary bg-primary font-semibold text-on-primary" : "border-border bg-surface hover:bg-surface-2",
    );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link href="/market" className="flex w-fit items-center gap-1 text-sm text-muted hover:text-primary">
        <ArrowRight className="size-4" aria-hidden />
        שוק הצמחים
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{categoryHe(category)}</h1>
          <p className="text-muted">{supply ? "ציוד וחומרים יד שנייה" : "בחרו זן כדי לראות את המודעות שלו"}</p>
        </div>
        <Link
          href="/market/new"
          className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary hover:bg-primary-strong"
        >
          <Plus className="size-5" aria-hidden />
          פרסום מודעה
        </Link>
      </header>

      {/* Species within the category */}
      {!supply && (
      <nav aria-label="זנים" className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex gap-2 md:flex-wrap">
          <li>
            <Link href={href({ species: null })} aria-current={!speciesSlug ? "page" : undefined} className={chip(!speciesSlug)}>
              הכל
              <span className="tabular-nums opacity-80">{species.reduce((n, s) => n + s.active_count, 0) + others}</span>
            </Link>
          </li>
          {species.map((s) => (
            <li key={s.slug}>
              <Link href={href({ species: s.slug })} aria-current={s.slug === speciesSlug ? "page" : undefined} className={chip(s.slug === speciesSlug)}>
                {s.common_name_he}
                <span className="tabular-nums opacity-80">{s.active_count}</span>
              </Link>
            </li>
          ))}
          {others > 0 && (
            <li>
              <Link href={href({ species: OTHER_SPECIES })} aria-current={isOther ? "page" : undefined} className={chip(isOther)}>
                אחר
                <span className="tabular-nums opacity-80">{others}</span>
              </Link>
            </li>
          )}
        </ul>
      </nav>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">
          {chosen ? chosen.common_name_he : isOther ? "צמחים נוספים (לא במאגר)" : `כל ה${categoryHe(category)}`}
          <span className="ms-2 text-base font-normal text-muted">
            {listings.length} מודעות{chosen ? ` · החל מ-${formatPrice(chosen.min_price)}` : ""}
          </span>
        </h2>
        <div className="flex gap-1 text-sm" role="group" aria-label="מיון">
          {(Object.keys(SORTS) as Sort[]).map((k) => (
            <Link key={k} href={href({ sort: k })} aria-current={k === sort ? "true" : undefined} className={cn("rounded-full px-3 py-1", k === sort ? "bg-leaf-soft font-semibold text-primary-strong" : "text-muted hover:bg-surface-2")}>
              {SORTS[k]}
            </Link>
          ))}
        </div>
      </div>
      {chosen && (
        <p className="-mt-3 text-sm">
          <Link href={`/magazine/plants/${chosen.slug}`} className="text-primary underline">
            איך מגדלים {chosen.common_name_he}? למדריך הגידול במגזין
          </Link>
        </p>
      )}

      <ListingTable listings={listings} showSpecies={!chosen} />
    </div>
  );
}
