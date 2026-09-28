"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [i, setI] = useState(0);
  return (
    <div className="flex flex-col gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photos[i]} alt={`${alt} – תמונה ${i + 1}`} className="aspect-square w-full rounded-3xl bg-surface-2 object-cover" />
      {photos.length > 1 && (
        <ul className="flex gap-2 overflow-x-auto">
          {photos.map((p, n) => (
            <li key={p}>
              <button
                type="button"
                onClick={() => setI(n)}
                aria-label={`תמונה ${n + 1}`}
                aria-pressed={n === i}
                className={cn("block overflow-hidden rounded-xl ring-offset-2 ring-offset-bg", n === i && "ring-2 ring-primary")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" className="size-16 object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
