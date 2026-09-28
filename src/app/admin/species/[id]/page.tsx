import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { getSuggestion, suggestionToForm } from "@/lib/species/suggestions";
import { approveSuggestion } from "@/lib/species/actions";
import { SpeciesForm } from "@/components/species/species-form";
import { RejectSuggestion } from "@/components/species/reject-suggestion";

export const metadata = { title: "בדיקת הצעה" };

export default async function ReviewSuggestionPage({ params }: PageProps<"/admin/species/[id]">) {
  const { id } = await params;
  await requireRole(["admin", "editor"], `/admin/species/${id}`);
  const s = await getSuggestion(id);
  if (!s) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/species" className="flex w-fit items-center gap-1 text-sm text-muted hover:text-primary">
        <ArrowRight className="size-4" aria-hidden />
        לכל ההצעות
      </Link>
      {s.status !== "pending" ? (
        <p className="rounded-2xl bg-surface-2 p-4">ההצעה כבר נבדקה.</p>
      ) : (
        <>
          <p className="text-sm text-muted">
            הצעה של {s.author?.display_name}. אפשר לתקן כל שדה לפני האישור. אישור יוצר את הצמח במאגר ומפרסם אותו.
          </p>
          <SpeciesForm initial={suggestionToForm(s)} onSubmit={approveSuggestion.bind(null, id)} submitLabel="אישור והוספה למאגר" />
          <RejectSuggestion id={id} />
        </>
      )}
    </div>
  );
}
