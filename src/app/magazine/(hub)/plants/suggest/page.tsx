import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { canWrite } from "@/lib/auth/roles";
import { EMPTY_SPECIES } from "@/lib/species/form-schema";
import { saveSuggestion } from "@/lib/species/actions";
import { getSuggestion, suggestionToForm } from "@/lib/species/suggestions";
import { SpeciesForm } from "@/components/species/species-form";

export const metadata: Metadata = { title: "הצעת צמח חדש למאגר", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SuggestSpeciesPage({ searchParams }: PageProps<"/magazine/plants/suggest">) {
  const { profile, user } = await requireUser("/magazine/plants/suggest");
  if (!canWrite(profile?.role)) {
    return (
      <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">
        הצעת צמחים חדשים למאגר פתוחה לכותבי המגזין.{" "}
        <Link href="/magazine/plants" className="text-primary underline">
          חזרה למאגר
        </Link>
      </p>
    );
  }

  const id = (await searchParams).id;
  let initial = EMPTY_SPECIES;
  if (typeof id === "string") {
    const s = await getSuggestion(id);
    if (!s || s.author_id !== user.id || s.status !== "pending") notFound();
    initial = suggestionToForm(s);
  }

  return (
    <div className="flex flex-col gap-4">
      <SpeciesForm
        initial={initial}
        onSubmit={saveSuggestion.bind(null, typeof id === "string" ? id : null)}
        submitLabel={typeof id === "string" ? "שמירת ההצעה" : "שליחה לבדיקת מנהל"}
        doneHref="/magazine/write"
        intro={
          <header>
            <h1 className="text-3xl font-bold">הצעת צמח חדש למאגר</h1>
            <p className="text-muted">
              ממלאים כמה שיותר פרטים. מנהל יבדוק, ישלים אם צריך ויפרסם את הצמח במאגר – עם הסמלים הצבעוניים ומדריך הטיפול.
            </p>
          </header>
        }
      />
    </div>
  );
}
