"use client";

const MAX_SIDE = 1800;

type SignResult = { ok: true; uploadUrl: string; publicUrl: string } | { ok: false; error: string };
/** A server action that returns a signed R2 upload URL for one image. */
export type SignUpload = (input: { contentType: "image/webp" | "image/jpeg" | "image/png"; size: number }) => Promise<SignResult>;

export type ResizeOptions = { maxSide?: number; square?: boolean };

type ImageType = "image/webp" | "image/jpeg" | "image/png";
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * What kind of image a file is. Browsers don't always agree: some report "image/jpg" or "image/pjpeg",
 * some give no type at all (then the file extension decides).
 */
function imageType(file: File): ImageType | "heic" | null {
  const t = file.type.toLowerCase();
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (t === "image/jpeg" || t === "image/jpg" || t === "image/pjpeg" || ["jpg", "jpeg", "jfif"].includes(ext)) return "image/jpeg";
  if (t === "image/png" || ext === "png") return "image/png";
  if (t === "image/webp" || ext === "webp") return "image/webp";
  if (t === "image/heic" || t === "image/heif" || ext === "heic" || ext === "heif") return "heic";
  return null;
}

/** Decodes any image the browser understands (createImageBitmap, or an <img> on older Safari). */
async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  try {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  }
}

/** Shrinks big photos in the browser (max 1800px, WebP) so uploads are fast and pages stay light. `square` crops the center. */
async function toWebp(file: File, { maxSide = MAX_SIDE, square = false }: ResizeOptions = {}): Promise<Blob> {
  const img = await decode(file);
  const side = Math.min(img.width, img.height);
  const sx = square ? (img.width - side) / 2 : 0;
  const sy = square ? (img.height - side) / 2 : 0;
  const sw = square ? side : img.width;
  const sh = square ? side : img.height;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  canvas.getContext("2d")!.drawImage(img.source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  img.done();
  // Browsers that can't make WebP (older Safari) return PNG instead – also fine.
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  if (!blob) throw new Error("toBlob failed");
  if (blob.type !== "image/webp" && blob.size > 2 * 1024 * 1024) {
    // Big PNG fallback → JPEG is much smaller
    const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (jpeg) return jpeg;
  }
  return blob;
}

/** Uploads an image to R2 through a signed URL and returns its public URL. Throws a Hebrew message. */
export async function uploadImage(file: File, sign: SignUpload, resize?: ResizeOptions): Promise<string> {
  const kind = imageType(file);
  if (!kind) throw new Error(`הקובץ ״${file.name}״ אינו תמונה בפורמט שאפשר להעלות (JPG, PNG או WebP)`);

  let blob: Blob;
  try {
    blob = await toWebp(file, resize);
  } catch {
    // The browser couldn't read the image (e.g. iPhone HEIC photo in Chrome): upload the original if we can.
    if (kind === "heic") throw new Error("תמונות HEIC מהאייפון לא נתמכות בדפדפן הזה. שמרו את התמונה כ-JPG ונסו שוב");
    blob = new Blob([file], { type: kind });
  }
  if (blob.size > MAX_BYTES) throw new Error("התמונה גדולה מדי (עד 10MB)");
  const type = (["image/webp", "image/jpeg", "image/png"].includes(blob.type) ? blob.type : kind === "heic" ? "image/jpeg" : kind) as ImageType;

  const res = await sign({ contentType: type, size: blob.size });
  if (!res.ok) throw new Error(res.error);
  let put: Response;
  try {
    put = await fetch(res.uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": type } });
  } catch (e) {
    // Usually the storage's CORS rule doesn't allow this site's address
    console.error("[upload] PUT to storage was blocked", new URL(res.uploadUrl).host, e);
    throw new Error("שירות התמונות חסם את ההעלאה מהאתר הזה (הגדרת CORS ב-R2)");
  }
  if (!put.ok) {
    console.error("[upload] storage answered", put.status, await put.text().catch(() => ""));
    throw new Error(`העלאת התמונה נכשלה (${put.status}). נסו שוב`);
  }
  return res.publicUrl;
}
