import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { listSpecies } from "@/lib/species/repo";
import type { Category, Difficulty, LightLevel, SpeciesFilters } from "@/lib/species/types";
import { CATEGORY_HE, DIFFICULTY_HE, LIGHT_HE } from "@/lib/labels";
import { SpeciesCard } from "@/components/species/species-card";
import { cn } from "@/lib/cn";

export const metadata: Metadata = {
  title: "מאגר הצמחים",
  description: "מדריכי גידול לצמחי בית, סוקולנטים, תבלינים, ירקות וצמחי גינה – אור, השקיה, לחות, דישון ועוד.",
};

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

export default async function KnowledgePage({ searchParams }: PageProps<"/knowledge">) {
  const sp = await searchParams;
  const filters: SpeciesFilters = {
    q: typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined,
    category: pick(sp.category, Object.keys(CATEGORY_HE) as Category[]),
    light: pick(sp.light, Object.keys(LIGHT_HE) as LightLevel[]),
    difficulty: pick(sp.difficulty, Object.keys(DIFFICULTY_HE) as Difficulty[]),
    petSafe: sp.petSafe === "1",
  };
  const species = await listSpecies(filters);

  const hrefWith = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = {
      q: filters.q,
      category: filters.category,
      light: filters.light,
      difficulty: filters.difficulty,
      petSafe: filters.petSafe ? "1" : undefined,
      ...patch,
    };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/knowledge?${s}` : "/knowledge";
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">מאגר הצמחים</h1>
        <p className="text-muted">איך לגדל כל צמח: אור, השקיה, לחות, טמפרטורה, מצע ודישון.</p>
      </header>

      <form action="/knowledge" className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        {filters.category && <input type="hidden" name="category" value={filters.category} />}
        <label className="relative block">
          <span className="sr-only">חיפוש צמח</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            name="q"
            defaultValue={filters.q}
            placeholder="חיפוש: מונסטרה, לשון חמות, Ficus…"
            className="w-full rounded-xl border border-border bg-bg py-3 pe-3 ps-10 outline-none focus:border-primary"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select name="light" defaultValue={filters.light ?? ""} className="rounded-lg border border-border bg-bg px-3 py-2">
            <option value="">כל רמות האור</option>
            {Object.entries(LIGHT_HE).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select name="difficulty" defaultValue={filters.difficulty ?? ""} className="rounded-lg border border-border bg-bg px-3 py-2">
            <option value="">כל רמות הקושי</option>
            {Object.entries(DIFFICULTY_HE).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="petSafe" value="1" defaultChecked={filters.petSafe} className="size-4 accent-[var(--primary)]" />
            בטוח לחיות מחמד
          </label>
          <button className="ms-auto rounded-full bg-primary px-5 py-2 font-semibold text-on-primary hover:bg-primary-strong">
            סינון
          </button>
        </div>
      </form>

      <nav aria-label="קטגוריות" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {[["", "הכל"] as const, ...Object.entries(CATEGORY_HE)].map(([k, v]) => {
          const active = (filters.category ?? "") === k;
          return (
            <Link
              key={k || "all"}
              href={hrefWith({ category: k || undefined })}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm",
                active ? "border-primary bg-primary text-on-primary" : "border-border bg-surface hover:border-primary",
              )}
            >
              {v}
            </Link>
          );
        })}
      </nav>

      <p className="text-sm text-muted" aria-live="polite">
        {species.length} צמחים
      </p>

      {species.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {species.map((s) => (
            <li key={s.slug} className="contents">
              <SpeciesCard species={s} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
          לא מצאנו צמח שמתאים לחיפוש.{" "}
          <Link href="/knowledge" className="text-primary underline">
            ניקוי הסינון
          </Link>
        </div>
      )}
    </div>
  );
}
