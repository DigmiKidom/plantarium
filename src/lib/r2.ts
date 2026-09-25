import "server-only";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const hasR2 = () =>
  Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.NEXT_PUBLIC_IMAGES_URL,
  );

let client: S3Client | null = null;
function r2() {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
  return client;
}

export const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** A short-lived (5 min) URL the browser can PUT one image to, plus the public URL it will have. */
export async function presignImageUpload(key: string, contentType: ImageType, size: number) {
  const uploadUrl = await getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { expiresIn: 300 },
  );
  const publicUrl = `${process.env.NEXT_PUBLIC_IMAGES_URL!.replace(/\/+$/, "")}/${key}`;
  return { uploadUrl, publicUrl };
}
