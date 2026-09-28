import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getListing } from "@/lib/market/queries";
import { speciesOptions } from "@/lib/market/species-options";
import { ListingForm } from "@/components/market/listing-form";
import { OTHER_SPECIES } from "@/lib/market/types";

export const metadata: Metadata = { title: "עריכת מודעה | שוק הצמחים", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditListingPage({ params }: PageProps<"/market/edit/[id]">) {
  const { id } = await params;
  const { user } = await requireUser(`/market/edit/${id}`);
  const res = await getListing(id);
  if (!res || res.listing.seller_id !== user.id || res.listing.status === "removed") notFound();
  const { listing: l, contact } = res;
  const species = await speciesOptions();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-3xl font-bold">עריכת מודעה</h1>
      <ListingForm
        species={species}
        initial={{
          id: l.id,
          category: l.category,
          speciesSlug: l.species?.slug ?? OTHER_SPECIES,
          otherName: l.other_species ?? "",
          price: String(l.price),
          size: l.size ?? "",
          city: l.city ?? "",
          description: l.description ?? "",
          photos: l.photos,
          phone: contact?.phone ?? "",
          whatsapp: contact?.whatsapp ?? false,
        }}
      />
    </div>
  );
}
