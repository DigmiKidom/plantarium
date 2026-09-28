"use client";

const MAX_SIDE = 1800;

type SignResult = { ok: true; uploadUrl: string; publicUrl: string } | { ok: false; error: string };
/** A server action that returns a signed R2 upload URL for one image. */
export type SignUpload = (input: { contentType: "image/webp" | "image/jpeg" | "image/png"; size: number }) => Promise<SignResult>;

export type ResizeOptions = { maxSide?: number; square?: boolean };

/** Shrinks big photos in the browser (max 1800px, WebP) so uploads are fast and pages stay light. `square` crops the center. */
async function toWebp(file: File, { maxSide = MAX_SIDE, square = false }: ResizeOptions = {}): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = square ? (bitmap.width - side) / 2 : 0;
  const sy = square ? (bitmap.height - side) / 2 : 0;
  const sw = square ? side : bitmap.width;
  const sh = square ? side : bitmap.height;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext("2d")!.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/webp", 0.85),
  );
}

/** Uploads an image to R2 through a signed URL and returns its public URL. Throws a Hebrew message. */
export async function uploadImage(file: File, sign: SignUpload, resize?: ResizeOptions): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("אפשר להעלות JPG, PNG או WebP");
  let blob: Blob = file;
  try {
    blob = await toWebp(file, resize);
  } catch {
    // Old browser without WebP export: upload the original
  }
  const res = await sign({ contentType: blob.type as "image/webp", size: blob.size });
  if (!res.ok) throw new Error(res.error);
  const put = await fetch(res.uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": blob.type } });
  if (!put.ok) throw new Error("העלאת התמונה נכשלה");
  return res.publicUrl;
}
