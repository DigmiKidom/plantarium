import Link from "next/link";
import { MapPin } from "lucide-react";
import { CONDITION_HE, SIZE_SHORT_HE, categoryHe, formatPrice, isSupplyCategory, listingName, type ListingRow } from "@/lib/market/types";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/cn";

/** Listings as a table on wide screens and as compact rows on phones. */
export function ListingTable({ listings, showSpecies = true }: { listings: ListingRow[]; showSpecies?: boolean }) {
  if (listings.length === 0) {
    return <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">אין כרגע מודעות כאן.</p>;
  }
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-3xl border border-border bg-surface md:block">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted">
            <tr className="text-start">
              <th scope="col" className="w-20 px-4 py-3 text-start font-medium">
                <span className="sr-only">תמונה</span>
              </th>
              {showSpecies && (
                <th scope="col" className="px-4 py-3 text-start font-medium">
                  צמח
                </th>
              )}
              <th scope="col" className="px-4 py-3 text-start font-medium">
                מחיר
              </th>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                גודל / מצב
              </th>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                עיר
              </th>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                מוכר/ת
              </th>
              <th scope="col" className="px-4 py-3 text-start font-medium">
                פורסם
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {listings.map((l) => (
              <tr key={l.id} className="relative hover:bg-surface-2">
                <td className="px-4 py-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={l.photos[0]} alt="" loading="lazy" className="size-14 rounded-xl object-cover" />
                </td>
                {showSpecies && (
                  <td className="px-4 py-2">
                    <Link href={`/market/l/${l.id}`} className="font-semibold after:absolute after:inset-0 hover:text-primary">
                      {listingName(l)}
                    </Link>
                    {l.species ? (
                      <span className="ltr block text-xs italic text-muted">{l.species.scientific_name}</span>
                    ) : (
                      <span className="block text-xs text-muted">{isSupplyCategory(l.category) ? categoryHe(l.category) : "לא במאגר"}</span>
                    )}
                  </td>
                )}
                <td className={cn("px-4 py-2 font-bold", l.price === 0 && "text-primary")}>
                  {showSpecies ? (
                    formatPrice(l.price)
                  ) : (
                    <Link href={`/market/l/${l.id}`} className="after:absolute after:inset-0">
                      {formatPrice(l.price)}
                    </Link>
                  )}
                </td>
                <td className="px-4 py-2">{l.size ? SIZE_SHORT_HE[l.size] : l.condition ? CONDITION_HE[l.condition] : "—"}</td>
                <td className="px-4 py-2">{l.city ?? "—"}</td>
                <td className="px-4 py-2">{l.seller?.display_name}</td>
                <td className="px-4 py-2 text-muted">{formatDate(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone list */}
      <ul className="flex flex-col divide-y divide-border rounded-3xl border border-border bg-surface md:hidden">
        {listings.map((l) => (
          <li key={l.id}>
            <Link href={`/market/l/${l.id}`} className="flex items-center gap-3 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.photos[0]} alt="" loading="lazy" className="size-16 shrink-0 rounded-xl object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{listingName(l)}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                  {l.size && <span>{SIZE_SHORT_HE[l.size]}</span>}
                  {l.condition && <span>{CONDITION_HE[l.condition]}</span>}
                  {l.city && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="size-3" aria-hidden />
                      {l.city}
                    </span>
                  )}
                  <span>{formatDate(l.created_at)}</span>
                </span>
              </span>
              <span className={cn("shrink-0 font-bold", l.price === 0 && "text-primary")}>{formatPrice(l.price)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
