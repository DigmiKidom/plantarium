import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { myPlaces, myPlant } from "@/lib/plants/queries";
import { PlantDetail } from "@/components/plants/plant-detail";

export const metadata: Metadata = { title: "הצמח שלי", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MyPlantPage({ params }: PageProps<"/plants/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { user, supabase } = await requireUser(`/plants/${id}`);
  const [found, places] = await Promise.all([myPlant(supabase, user.id, id), myPlaces(supabase, user.id)]);
  if (!found) notFound();
  const place = places.find((p) => p.id === found.plant.placeId) ?? null;
  return <PlantDetail plant={found.plant} place={place} places={places} history={found.history} />;
}
