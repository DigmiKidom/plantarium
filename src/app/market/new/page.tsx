import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listingQuota } from "@/lib/market/queries";
import { speciesOptions } from "@/lib/market/species-options";
import { ListingForm } from "@/components/market/listing-form";

export const metadata: Metadata = { title: "פרסום מודעה | שוק הצמחים", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const { user } = await requireUser("/market/new");
  const [species, quota] = await Promise.all([speciesOptions(), listingQuota(user.id)]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold">פרסום צמח למכירה</h1>
        <p className="text-muted">בוחרים את הזן מהמאגר, מוסיפים תמונה, מחיר ודרך ליצירת קשר.</p>
      </header>
      <ListingForm
        species={species}
        quota={quota}
        initial={{ speciesSlug: "", price: "", size: "", city: "", description: "", photos: [], phone: "", whatsapp: true, email: "" }}
      />
    </div>
  );
}
