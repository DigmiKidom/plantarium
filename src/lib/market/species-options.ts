import "server-only";
import { listSpecies } from "@/lib/species/repo";
import type { SpeciesOption } from "@/components/market/listing-form";

export async function speciesOptions(): Promise<SpeciesOption[]> {
  return (await listSpecies({})).map((s) => ({ slug: s.slug, name: s.common_name_he, scientific: s.scientific_name, category: s.category }));
}
