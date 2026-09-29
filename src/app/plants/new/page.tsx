import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { NeedsDbUpdate, myPlaces } from "@/lib/plants/queries";
import { speciesOptions } from "@/lib/market/species-options";
import { PlantForm } from "@/components/plants/plant-form";

export const metadata: Metadata = { title: "הוספת צמח", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewPlantPage({ searchParams }: PageProps<"/plants/new">) {
  const { user, supabase } = await requireUser("/plants/new");
  const { species: pre } = await searchParams;
  const [places, species] = await Promise.all([
    myPlaces(supabase, user.id).catch((e) => {
      if (e instanceof NeedsDbUpdate) return [];
      throw e;
    }),
    speciesOptions(),
  ]);
  const slug = typeof pre === "string" && species.some((s) => s.slug === pre) ? pre : "";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold">הוספת צמח</h1>
        <p className="text-muted">בוחרים צמח ומקום בבית – ואנחנו בונים לו לוח השקיה ודישון ובודקים שהמקום מתאים לו.</p>
      </header>
      <PlantForm
        species={species}
        places={places}
        initial={{ speciesSlug: slug, otherName: "", nickname: "", placeId: places.length === 1 ? places[0].id : "", potCm: "", medium: "", acquiredOn: "", waterEveryDays: "", notes: "", photoUrl: null }}
      />
    </div>
  );
}
