import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Droplet, Droplets, FlaskConical, Layers, Leaf, Plus, Scissors, Sprout, Sun, Thermometer, Waves } from "lucide-react";
import { allSlugs, getSpecies, relatedSpecies } from "@/lib/species/repo";
import type { Season } from "@/lib/species/types";
import { CATEGORY_HE, DIFFICULTY_HE, GROWTH_HE, LIGHT_HE, MEDIUM_HE, SEASON_HE, tagLabel } from "@/lib/labels";
import { SpeciesVisual } from "@/components/species/species-visual";
import { SpeciesCard } from "@/components/species/species-card";
import { DifficultyPill } from "@/components/species/difficulty-pill";
import { Meter, TraitBadges } from "@/components/species/trait-badges";
import { AdminEditLink } from "@/components/species/admin-edit-link";
import { PhotoGallery } from "@/components/market/photo-gallery";
import { humidityLevel, lightLevel, plantTraits, waterLevel } from "@/lib/species/traits";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await allSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/magazine/plants/[slug]">): Promise<Metadata> {
  const s = await getSpecies((await params).slug);
  if (!s) return {};
  return {
    title: `${s.common_name_he} (${s.scientific_name}) – מדריך גידול`,
    description: s.summary_he,
    alternates: { canonical: `/magazine/plants/${s.slug}` },
  };
}

const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

function CareCard({
  icon: Icon,
  title,
  value,
  note,
  tone,
}: {
  icon: typeof Sun;
  title: string;
  value: React.ReactNode;
  note?: string;
  tone: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-3xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className={`grid size-11 place-items-center rounded-2xl ${tone}`}>
          <Icon className="size-6" aria-hidden />
        </span>
        <h3 className="text-sm font-medium text-muted">{title}</h3>
      </div>
      <p className="text-lg font-semibold">{value}</p>
      {note && <p className="text-sm leading-relaxed text-muted">{note}</p>}
    </div>
  );
}

export default async function SpeciesPage({ params }: PageProps<"/magazine/plants/[slug]">) {
  const { slug } = await params;
  const s = await getSpecies(slug);
  if (!s) notFound();
  const related = await relatedSpecies(s);
  const c = s.care;
  const mid = (c.water_interval_min_days + c.water_interval_max_days) / 2;
  const traits = plantTraits(s);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "מאגר הצמחים", item: "/magazine/plants" },
      { "@type": "ListItem", position: 2, name: s.common_name_he, item: `/magazine/plants/${s.slug}` },
    ],
  };

  return (
    <article className="flex flex-col gap-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="פירורי לחם" className="flex items-center gap-1 text-sm text-muted">
        <Link href="/magazine/plants" className="hover:text-primary">מאגר הצמחים</Link>
        <ChevronRight className="size-4 rotate-180" aria-hidden />
        <Link href={`/magazine/plants?category=${s.category}`} className="hover:text-primary">
          {CATEGORY_HE[s.category]}
        </Link>
      </nav>

      <header className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {s.images.length > 0 ? (
          <PhotoGallery photos={s.images.map((i) => i.url)} alt={s.common_name_he} />
        ) : (
          <SpeciesVisual species={s} className="aspect-square w-full rounded-3xl" />
        )}
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <DifficultyPill value={s.difficulty} label={`קושי: ${DIFFICULTY_HE[s.difficulty]}`} />
          </div>
          <div>
            <h1 className="text-4xl font-bold">{s.common_name_he}</h1>
            <p className="mt-1 text-lg italic text-muted"><span className="ltr">{s.scientific_name}</span></p>
            {s.other_names_he.length > 0 && (
              <p className="mt-2 text-sm text-muted">שמות נוספים: {s.other_names_he.join(", ")}</p>
            )}
          </div>
          <p className="text-lg leading-relaxed">{s.summary_he}</p>
          <div className="grid grid-cols-3 gap-2 rounded-3xl bg-surface-2 p-4 text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-muted">אור</span>
              <Meter icon={Sun} level={lightLevel(s)} tone="text-amber-500" label="אור" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted">מים</span>
              <Meter icon={Droplet} level={waterLevel(s)} tone="text-sky-500" label="מים" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-muted">לחות</span>
              <Meter icon={Leaf} level={humidityLevel(s)} tone="text-emerald-500" label="לחות" />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ["משפחה", <span key="f" className="ltr">{s.family}</span>],
              ["מוצא", s.native_region_he],
              ["קצב גדילה", GROWTH_HE[s.growth_rate]],
              ["גובה מרבי", `עד ${s.max_height_cm} ס״מ`],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-xl bg-surface-2 p-3">
                <dt className="text-muted">{k}</dt>
                <dd className="mt-0.5 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-3">
            <AdminEditLink slug={s.slug} />
            <Link
              href={`/plants/new?species=${s.slug}`}
              className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-semibold text-on-primary hover:bg-primary-strong"
            >
              <Plus className="size-5" aria-hidden /> הוספה לצמחים שלי
            </Link>
          </div>
        </div>
      </header>

      {traits.length > 0 && (
        <section aria-labelledby="traits" className="flex flex-col gap-4">
          <h2 id="traits" className="text-2xl font-bold">האופי של {s.common_name_he}</h2>
          <TraitBadges traits={traits} />
        </section>
      )}

      <section aria-labelledby="care" className="flex flex-col gap-4">
        <h2 id="care" className="text-2xl font-bold">מדריך טיפול</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CareCard icon={Sun} title="אור" value={LIGHT_HE[c.light]} note={c.light_notes_he} tone="bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300" />
          <CareCard
            icon={Droplets}
            title="השקיה"
            value={`כל ${c.water_interval_min_days}–${c.water_interval_max_days} ימים באביב`}
            note={c.water_notes_he}
            tone="bg-sky-100 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300"
          />
          <CareCard icon={Waves} title="לחות" value={<span className="ltr">{c.humidity_min}–{c.humidity_max}%</span>} tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300" />
          <CareCard icon={Thermometer} title="טמפרטורה" value={<span className="ltr">{c.temp_min_c}–{c.temp_max_c}°C</span>} tone="bg-red-100 text-red-500 dark:bg-red-400/15 dark:text-red-300" />
          <CareCard
            icon={FlaskConical}
            title="דישון"
            value={`כל ${c.fertilize_interval_days} ימים`}
            note={c.fertilize_season === "spring_summer" ? "בעונת הגדילה – אביב וקיץ. בחורף להפסיק או לצמצם." : "לאורך עונת הגידול."}
            tone="bg-lime-100 text-lime-700 dark:bg-lime-400/15 dark:text-lime-300"
          />
          <CareCard
            icon={Layers}
            title="מצע"
            value={c.medium.map((m) => MEDIUM_HE[m] ?? m).join(" / ")}
            note={c.medium_notes_he}
            tone="bg-stone-200 text-stone-600 dark:bg-stone-400/15 dark:text-stone-300"
          />
          {c.pruning_he && (
            <CareCard icon={Scissors} title="גיזום" value="מתי ואיך" note={c.pruning_he} tone="bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300" />
          )}
          {c.propagation_he && (
            <CareCard icon={Sprout} title="ריבוי" value="איך מרבים" note={c.propagation_he} tone="bg-green-100 text-green-700 dark:bg-green-400/15 dark:text-green-300" />
          )}
        </div>
      </section>

      <section aria-labelledby="seasons" className="flex flex-col gap-4">
        <h2 id="seasons" className="text-2xl font-bold">השקיה לפי עונה</h2>
        <p className="text-sm text-muted">הערכה לתנאי ישראל. בפועל בודקים את יובש המצע לפני כל השקיה.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SEASONS.map((season) => {
            const days = Math.max(1, Math.round(mid * c.seasonal[season].water_factor));
            return (
              <div key={season} className="rounded-2xl border border-border bg-surface p-4 text-center">
                <p className="text-sm text-muted">{SEASON_HE[season]}</p>
                <p className="mt-1 text-2xl font-bold text-primary">{days}</p>
                <p className="text-xs text-muted">ימים בין השקיות</p>
              </div>
            );
          })}
        </div>
      </section>

      {s.tags.length > 0 && (
        <section aria-label="תגיות" className="flex flex-wrap gap-2">
          {s.tags.map((t) => (
            <span key={t} className="rounded-full bg-surface-2 px-3 py-1 text-sm text-muted">
              #{tagLabel(t)}
            </span>
          ))}
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related" className="flex flex-col gap-4">
          <h2 id="related" className="text-2xl font-bold">צמחים דומים</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {related.map((r) => (
              <SpeciesCard key={r.slug} species={r} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
