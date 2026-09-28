import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getSpecies } from "@/lib/species/repo";
import { speciesToForm } from "@/lib/species/form-schema";
import { updateSpecies } from "@/lib/species/actions";
import { SpeciesForm } from "@/components/species/species-form";

export const metadata: Metadata = { title: "עריכת צמח", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditSpeciesPage({ params }: PageProps<"/magazine/plants/[slug]/edit">) {
  const { slug } = await params;
  await requireRole(["admin", "editor"], `/magazine/plants/${slug}/edit`);
  const s = await getSpecies(slug);
  if (!s) notFound();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">עריכת {s.common_name_he}</h1>
      <SpeciesForm initial={speciesToForm(s)} onSubmit={updateSpecies.bind(null, slug)} submitLabel="שמירת השינויים" />
    </div>
  );
}
