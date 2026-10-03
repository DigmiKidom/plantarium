import "server-only";
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
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
  const publicUrl = `${process.env.NEXT_PUBLIC_IMAGES_URL!.trim().replace(/\/+$/, "")}/${key}`;
  return { uploadUrl, publicUrl };
}

/**
 * Deletes every photo under a folder such as `market/<user id>/`. Returns how many were removed.
 * The prefix must end with "/" and contain a folder name, so a mistake can never empty the whole bucket.
 */
export async function deletePrefix(prefix: string): Promise<number> {
  if (!/^[a-z]+\/[0-9a-f-]{36}\/$/.test(prefix)) throw new Error(`refusing to delete prefix ${prefix}`);
  let removed = 0;
  let token: string | undefined;
  do {
    const page = await r2().send(
      new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET!, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }),
    );
    const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (keys.length) {
      const out = await r2().send(new DeleteObjectsCommand({ Bucket: process.env.R2_BUCKET!, Delete: { Objects: keys, Quiet: true } }));
      if (out.Errors?.length) throw new Error(`R2 delete failed for ${out.Errors.length} files under ${prefix}`);
      removed += keys.length;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return removed;
}

