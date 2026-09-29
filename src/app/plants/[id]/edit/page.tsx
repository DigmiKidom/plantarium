import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { myPlaces, myPlant } from "@/lib/plants/queries";
import { speciesOptions } from "@/lib/market/species-options";
import { OTHER_PLANT } from "@/lib/plants/types";
import { PlantForm } from "@/components/plants/plant-form";

export const metadata: Metadata = { title: "עריכת צמח", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditPlantPage({ params }: PageProps<"/plants/[id]/edit">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { user, supabase } = await requireUser(`/plants/${id}/edit`);
  const [found, places, species] = await Promise.all([myPlant(supabase, user.id, id), myPlaces(supabase, user.id), speciesOptions()]);
  if (!found) notFound();
  const p = found.plant;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-3xl font-bold">עריכת {p.name}</h1>
      <PlantForm
        species={species}
        places={places}
        initial={{
          id: p.id,
          speciesSlug: p.speciesSlug ?? OTHER_PLANT,
          otherName: p.speciesSlug ? "" : p.speciesName,
          nickname: p.name !== p.speciesName ? p.name : "",
          placeId: p.placeId ?? "",
          potCm: p.potCm ? String(p.potCm) : "",
          medium: p.medium ?? "",
          acquiredOn: p.acquiredOn ?? "",
          waterEveryDays: p.waterEveryDays ? String(p.waterEveryDays) : "",
          notes: p.notes ?? "",
          photoUrl: p.ownPhotoUrl,
        }}
      />
    </div>
  );
}
