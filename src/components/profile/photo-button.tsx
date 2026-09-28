"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { createProfilePhotoUpload, setProfilePhoto, type PhotoKind } from "@/lib/auth/photo-actions";
import { uploadImage } from "@/lib/uploads/client";
import { notifyProfileChanged } from "@/lib/settings/client";
import { cn } from "@/lib/cn";

/** Camera button that uploads a new profile or cover photo (avatar is cropped square, 512px). */
export function PhotoButton({ kind, label, className, showLabel }: { kind: PhotoKind; label: string; className?: string; showLabel?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      const url = await uploadImage(
        file,
        createProfilePhotoUpload.bind(null, kind),
        kind === "avatar" ? { maxSide: 512, square: true } : { maxSide: 1800 },
      );
      const res = await setProfilePhoto(kind, url);
      if (!res.ok) throw new Error(res.error);
      notifyProfileChanged();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ההעלאה נכשלה");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        title={label}
        aria-label={label}
        className={cn(
          "flex items-center gap-2 rounded-full bg-surface/90 px-3 py-2 text-sm font-medium text-text shadow-md backdrop-blur hover:bg-surface disabled:opacity-70",
          className,
        )}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />}
        {showLabel && label}
      </button>
      {error && (
        <span role="alert" className="absolute inset-x-0 -bottom-7 text-center text-xs text-accent">
          {error}
        </span>
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}

export function RemovePhotoButton({ kind, label }: { kind: PhotoKind; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await setProfilePhoto(kind, null);
          if (res.ok) {
            notifyProfileChanged();
            router.refresh();
          }
        })
      }
      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-muted hover:border-accent hover:text-accent disabled:opacity-60"
    >
      <Trash2 className="size-4" aria-hidden />
      {label}
    </button>
  );
}
