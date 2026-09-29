"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deletePlace } from "@/lib/plants/actions";
import { placeLightHe } from "@/lib/plants/care";
import type { MyPlant, Place } from "@/lib/plants/types";
import { PLACE_ICON, placeLabel } from "./bits";
import { PlaceForm } from "./place-form";

export function PlacesView({ places, plants }: { places: Place[]; plants: MyPlant[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(places.length ? null : "new");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  const remove = (p: Place, count: number) => {
    if (!confirm(count ? `למחוק את ״${p.name}״? ${count} הצמחים שבו יישארו, בלי מקום.` : `למחוק את ״${p.name}״?`)) return;
    start(async () => {
      const res = await deletePlace(p.id);
      if (!res.ok) return setError(res.error);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">המקומות שלי</h2>
        <p className="text-sm text-muted">חדרים, חלונות, מרפסות וגינה – ולאן כל אחד פונה. ככה נדע כמה אור וחום כל צמח מקבל.</p>
      </div>
      {error && <p className="rounded-xl bg-accent-soft px-4 py-2 text-sm text-accent">{error}</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {places.map((p) => {
          const count = plants.filter((x) => x.placeId === p.id).length;
          const Icon = PLACE_ICON[p.kind];
          if (editing === p.id)
            return (
              <li key={p.id} className="md:col-span-2">
                <PlaceForm
                  initial={p}
                  onSaved={() => {
                    setEditing(null);
                    router.refresh();
                  }}
                  onCancel={() => setEditing(null)}
                />
              </li>
            );
          return (
            <li key={p.id} className="flex items-start gap-3 rounded-3xl border border-border bg-surface p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-leaf-soft text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-bold">{p.name}</div>
                <div className="text-sm text-muted">{placeLabel(p)}</div>
                <div className="text-sm">{placeLightHe(p)}</div>
                <div className="mt-1 text-xs text-muted">{count ? `${count} צמחים` : "אין צמחים עדיין"}</div>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => setEditing(p.id)} aria-label={`עריכת ${p.name}`} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-primary">
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button type="button" disabled={pending} onClick={() => remove(p, count)} aria-label={`מחיקת ${p.name}`} className="grid size-9 place-items-center rounded-full text-muted hover:bg-accent-soft hover:text-accent">
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {editing === "new" ? (
        <PlaceForm
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
          onCancel={places.length ? () => setEditing(null) : undefined}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border p-4 font-medium text-muted hover:border-primary hover:text-primary"
        >
          <Plus className="size-5" aria-hidden />
          הוספת מקום
        </button>
      )}
    </div>
  );
}
