#!/usr/bin/env node
// Checks the Cloudflare R2 setup from .env.local.  Usage: npm run r2:check
// Uploads a tiny test file, reads it back through the public URL, checks CORS, then deletes it.
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, NEXT_PUBLIC_IMAGES_URL, NEXT_PUBLIC_SITE_URL } =
  process.env;

const ok = (m) => console.log(`✅ ${m}`);
const fail = (m, hint) => {
  console.log(`❌ ${m}${hint ? `\n   → ${hint}` : ""}`);
  process.exitCode = 1;
};

const missing = Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, NEXT_PUBLIC_IMAGES_URL })
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  fail(`Missing in .env.local: ${missing.join(", ")}`);
  process.exit();
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});
const key = `_healthcheck/${Date.now()}.txt`;
const body = `plantarium ok ${new Date().toISOString()}`;

// 1. Upload with the API keys
try {
  await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: "text/plain" }));
  ok(`Upload to bucket "${R2_BUCKET}" works (keys are valid)`);
} catch (e) {
  fail(`Upload failed: ${e.name} – ${e.message}`, {
    InvalidAccessKeyId: "R2_ACCESS_KEY_ID is wrong",
    SignatureDoesNotMatch: "R2_SECRET_ACCESS_KEY is wrong",
    NoSuchBucket: "R2_BUCKET name doesn't match the bucket in Cloudflare",
    AccessDenied: "The API token needs 'Object Read & Write' on this bucket",
  }[e.name]);
  process.exit();
}

// 2. Read back through the public r2.dev / custom-domain URL
try {
  const res = await fetch(`${NEXT_PUBLIC_IMAGES_URL.replace(/\/$/, "")}/${key}`);
  const text = res.ok ? await res.text() : "";
  if (text === body) ok(`Public URL works: ${NEXT_PUBLIC_IMAGES_URL}`);
  else fail(`Public URL returned HTTP ${res.status}`, "Bucket → Settings → Public Development URL → Allow");
} catch (e) {
  fail(`Public URL unreachable: ${e.message}`);
}

// 3. CORS: can the browser upload from the site?
const origin = NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
try {
  const putUrl = await getSignedUrl(r2, new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: "image/webp" }), {
    expiresIn: 60,
  });
  const res = await fetch(putUrl, {
    method: "OPTIONS",
    headers: { Origin: origin, "Access-Control-Request-Method": "PUT", "Access-Control-Request-Headers": "content-type" },
  });
  const allowed = res.headers.get("access-control-allow-origin");
  if (allowed === origin || allowed === "*") ok(`CORS allows browser uploads from ${origin}`);
  else fail(`CORS does not allow PUT from ${origin}`, "Bucket → Settings → CORS Policy (see README)");
} catch (e) {
  fail(`CORS check failed: ${e.message}`);
}

// 4. Clean up
await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => {});
