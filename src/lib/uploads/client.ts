"use client";

const MAX_SIDE = 1800;

type SignResult = { ok: true; uploadUrl: string; publicUrl: string } | { ok: false; error: string };
/** A server action that returns a signed R2 upload URL for one image. */
export type SignUpload = (input: { contentType: "image/webp" | "image/jpeg" | "image/png"; size: number }) => Promise<SignResult>;

/** Shrinks big photos in the browser (max 1800px, WebP) so uploads are fast and pages stay light. */
async function toWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/webp", 0.85),
  );
}

/** Uploads an image to R2 through a signed URL and returns its public URL. Throws a Hebrew message. */
export async function uploadImage(file: File, sign: SignUpload): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("אפשר להעלות JPG, PNG או WebP");
  let blob: Blob = file;
  try {
    blob = await toWebp(file);
  } catch {
    // Old browser without WebP export: upload the original
  }
  const res = await sign({ contentType: blob.type as "image/webp", size: blob.size });
  if (!res.ok) throw new Error(res.error);
  const put = await fetch(res.uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": blob.type } });
  if (!put.ok) throw new Error("העלאת התמונה נכשלה");
  return res.publicUrl;
}
