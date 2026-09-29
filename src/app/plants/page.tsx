import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { NeedsDbUpdate, myPlaces, myPlants, speciesPicks } from "@/lib/plants/queries";
import { PlantsHub } from "@/components/plants/plants-hub";
import { PLANT_TABS, type PlantTab } from "@/lib/plants/types";

export const metadata: Metadata = { title: "הצמחים שלי", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MyPlantsPage({ searchParams }: PageProps<"/plants">) {
  const { user, supabase } = await requireUser("/plants");
  const { tab } = await searchParams;
  const initialTab: PlantTab = typeof tab === "string" && tab in PLANT_TABS ? (tab as PlantTab) : "plants";

  const data = await Promise.all([myPlants(supabase, user.id), myPlaces(supabase, user.id), speciesPicks()]).catch((e) => {
    if (e instanceof NeedsDbUpdate) return null;
    throw e;
  });
  if (!data) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl bg-accent-soft p-6 text-center text-accent">
        <h1 className="text-xl font-bold">צריך לעדכן את מסד הנתונים</h1>
        <p className="mt-2 text-sm">
          הריצו בטרמינל: <code className="ltr rounded bg-surface px-1.5 py-0.5">npm run db:push</code>
        </p>
      </div>
    );
  }
  const [plants, places, species] = data;
  return <PlantsHub plants={plants} places={places} species={species} initialTab={initialTab} />;
}
