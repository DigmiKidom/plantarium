import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BookOpen, MapPin, MessageCircle, Phone, Ruler } from "lucide-react";
import { getListing } from "@/lib/market/queries";
import { LISTING_STATUS_HE, OTHER_SPECIES, SIZE_HE, categoryHe, formatPrice, listingName, whatsappNumber } from "@/lib/market/types";
import { isFollowing } from "@/lib/follows/queries";
import { createUserClient } from "@/lib/supabase/server";
import { PhotoGallery } from "@/components/market/photo-gallery";
import { AdminRemoveListing, SellerActions } from "@/components/market/listing-actions";
import { ReportButton } from "@/components/reports/report-button";
import { FollowButton } from "@/components/follow/follow-button";
import { Avatar } from "@/components/auth/me";
import { formatDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/market/l/[id]">): Promise<Metadata> {
  const res = await getListing((await params).id);
  if (!res) return { title: "לא נמצא" };
  const { listing: l } = res;
  return {
    title: `${listingName(l)} – ${formatPrice(l.price)} | שוק הצמחים`,
    description: l.description?.slice(0, 160) ?? undefined,
    openGraph: { images: [l.photos[0]] },
  };
}

export default async function ListingPage({ params }: PageProps<"/market/l/[id]">) {
  const { id } = await params;
  const res = await getListing(id);
  if (!res) notFound();
  const { listing: l, contact, viewerId } = res;

  const isOwner = viewerId === l.seller_id;
  let isAdmin = false;
  if (viewerId) {
    const { data } = await (await createUserClient()).from("profiles").select("role").eq("id", viewerId).maybeSingle();
    isAdmin = data?.role === "admin";
  }
  const following = viewerId && !isOwner ? await isFollowing(viewerId, l.seller_id) : false;
  const sellerName = l.seller?.display_name ?? "מוכר/ת";

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <nav aria-label="פירורי לחם" className="flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link href="/market" className="hover:text-primary">
          שוק הצמחים
        </Link>
        <ArrowRight className="size-4 rotate-180" aria-hidden />
        <Link href={`/market/${l.category}`} className="hover:text-primary">
          {categoryHe(l.category)}
        </Link>
        <ArrowRight className="size-4 rotate-180" aria-hidden />
        <Link href={`/market/${l.category}?species=${l.species?.slug ?? OTHER_SPECIES}`} className="hover:text-primary">
          {l.species ? l.species.common_name_he : "אחר"}
        </Link>
      </nav>

      {l.status !== "active" && (
        <p className="rounded-2xl bg-sun-soft px-4 py-3 text-sm">
          <span className="font-semibold">{LISTING_STATUS_HE[l.status]}.</span>{" "}
          {l.status === "removed" && l.removed_reason ? `סיבה: ${l.removed_reason}` : "המודעה לא מוצגת לאחרים."}
        </p>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        <PhotoGallery photos={l.photos} alt={listingName(l)} />

        <div className="flex flex-col gap-5">
          <header className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold">{listingName(l)}</h1>
            {l.species ? (
              <p className="ltr text-start italic text-muted">{l.species.scientific_name}</p>
            ) : (
              <p className="text-sm text-muted">צמח שעדיין לא במאגר שלנו</p>
            )}
            <p className={`mt-2 text-3xl font-bold ${l.price === 0 ? "text-primary" : ""}`}>{formatPrice(l.price)}</p>
          </header>

          <ul className="flex flex-wrap gap-2 text-sm">
            {l.size && (
              <li className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1">
                <Ruler className="size-4" aria-hidden />
                {SIZE_HE[l.size]}
              </li>
            )}
            {l.city && (
              <li className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1">
                <MapPin className="size-4" aria-hidden />
                {l.city}
              </li>
            )}
            <li className="rounded-full bg-surface-2 px-3 py-1 text-muted">פורסם {formatDate(l.created_at)}</li>
          </ul>

          {l.description && <p className="whitespace-pre-line leading-relaxed">{l.description}</p>}

          {l.species && (
            <Link href={`/magazine/plants/${l.species.slug}`} className="flex items-center gap-2 text-sm font-medium text-primary hover:underline">
              <BookOpen className="size-4" aria-hidden />
              מדריך הגידול ל{l.species.common_name_he} במגזין
            </Link>
          )}

          {/* Contact */}
          <section aria-labelledby="contact" className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-5">
            <h2 id="contact" className="font-bold">
              יצירת קשר
            </h2>
            {!viewerId ? (
              <p className="text-sm">
                <Link href={`/login?next=${encodeURIComponent(`/market/l/${l.id}`)}`} className="font-semibold text-primary underline">
                  התחברו
                </Link>{" "}
                כדי לראות את פרטי הקשר של המוכר/ת.
              </p>
            ) : contact?.phone ? (
              <div className="flex flex-wrap gap-2">
                {contact.phone && (
                  <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-semibold text-on-primary">
                    <Phone className="size-4" aria-hidden />
                    <span className="ltr">{contact.phone}</span>
                  </a>
                )}
                {contact.phone && contact.whatsapp && (
                  <a
                    href={`https://wa.me/${whatsappNumber(contact.phone)}?text=${encodeURIComponent(`היי, ראיתי את המודעה על ${listingName(l)} בפלנטריום`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-full border border-border px-4 py-2 font-semibold hover:bg-surface-2"
                  >
                    <MessageCircle className="size-4" aria-hidden />
                    וואטסאפ
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">פרטי הקשר לא זמינים.</p>
            )}
          </section>

          {/* Seller */}
          <section aria-label="המוכר/ת" className="flex flex-wrap items-center gap-3">
            <Avatar name={sellerName} />
            <span className="min-w-0 flex-1">
              {l.seller?.username ? (
                <Link href={`/u/${l.seller.username}`} className="font-semibold hover:text-primary">
                  {sellerName}
                </Link>
              ) : (
                <span className="font-semibold">{sellerName}</span>
              )}
              {l.seller?.username && <span className="ltr block text-xs text-muted">@{l.seller.username}</span>}
            </span>
            {!isOwner && (
              <FollowButton userId={l.seller_id} following={following} signedIn={Boolean(viewerId)} loginNext={`/market/l/${l.id}`} size="sm" />
            )}
            {viewerId && !isOwner && <ReportButton userId={l.seller_id} listingId={l.id} name={sellerName} />}
          </section>

          {isOwner && <SellerActions id={l.id} status={l.status} />}
          {isAdmin && !isOwner && l.status !== "removed" && <AdminRemoveListing id={l.id} />}
          <p className="text-xs text-muted">
            פלנטריום לא צד לעסקה. מומלץ להיפגש במקום ציבורי ולבדוק את הצמח לפני תשלום.
          </p>
        </div>
      </div>
    </div>
  );
}
