import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listingQuota, myListings } from "@/lib/market/queries";
import { LISTING_STATUS_HE, formatPrice } from "@/lib/market/types";
import { SellerActions } from "@/components/market/listing-actions";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "המודעות שלי", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MyListingsPage() {
  const { user } = await requireUser("/market/mine");
  const [listings, quota] = await Promise.all([myListings(user.id), listingQuota(user.id)]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">המודעות שלי</h1>
          <p className="text-muted">
            מודעות פעילות: {quota.used} מתוך {quota.limit}
          </p>
        </div>
        <Link href="/market/new" className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-semibold text-on-primary hover:bg-primary-strong">
          <Plus className="size-5" aria-hidden />
          מודעה חדשה
        </Link>
      </header>

      {listings.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">עוד לא פרסמת צמחים למכירה.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {listings.map((l) => (
            <li key={l.id} className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4">
              <Link href={`/market/l/${l.id}`} className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.photos[0]} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{l.species?.common_name_he}</span>
                  <span className="text-xs text-muted">פורסם {formatDate(l.created_at)}</span>
                </span>
                <span className="font-bold">{formatPrice(l.price)}</span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs",
                    l.status === "active" ? "bg-leaf-soft text-primary-strong" : l.status === "sold" ? "bg-surface-2 text-muted" : "bg-accent-soft text-accent",
                  )}
                >
                  {LISTING_STATUS_HE[l.status]}
                </span>
              </Link>
              {l.status === "removed" && l.removed_reason && <p className="text-sm text-accent">סיבת ההסרה: {l.removed_reason}</p>}
              <SellerActions id={l.id} status={l.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
