import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { pendingSuggestions } from "@/lib/species/suggestions";
import { CATEGORY_HE } from "@/lib/labels";
import { formatDateTime } from "@/lib/dates";

export const metadata = { title: "הצעות לצמחים" };

export default async function AdminSpeciesPage() {
  await requireRole(["admin", "editor"], "/admin/species");
  const list = await pendingSuggestions();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        כותבים מציעים צמחים שחסרים במאגר. פותחים הצעה, משלימים או מתקנים פרטים, ומאשרים – הצמח נוסף למאגר מיד. כדי לערוך צמח קיים
        פותחים את דף הצמח ולוחצים ״עריכת הצמח״.
      </p>
      {list.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border p-10 text-center text-muted">אין הצעות שממתינות לבדיקה</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-3xl border border-border bg-surface">
          {list.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/species/${s.id}`} className="flex items-center gap-4 p-4 hover:bg-surface-2">
                {s.photos[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.photos[0]} alt="" className="size-12 rounded-xl object-cover" />
                ) : (
                  <span className="size-12 rounded-xl bg-leaf-soft" aria-hidden />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {s.common_name_he} <span className="ltr text-sm font-normal italic text-muted">{s.scientific_name}</span>
                  </span>
                  <span className="text-xs text-muted">
                    {CATEGORY_HE[s.category]} · {s.author?.display_name} · {formatDateTime(s.created_at)}
                  </span>
                </span>
                <span className="text-sm text-primary">לבדיקה</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
