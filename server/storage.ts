// Storage helpers backed by Cloudflare R2 (S3-compatible) via @aws-sdk/client-s3.
// Uploads via PutObjectCommand; downloads resolve to public R2_PUBLIC_URL links.

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getR2Config() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) {
    throw new Error(
      "Storage config missing: set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_URL",
    );
  }

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicUrl: publicUrl.replace(/\/+$/, ""),
  };
}

let _client: S3Client | null = null;

function getR2Client(): S3Client {
  if (_client) return _client;
  const { endpoint, accessKeyId, secretAccessKey } = getR2Config();
  _client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _client;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { bucket, publicUrl } = getR2Config();
  const client = getR2Client();
  const key = appendHashSuffix(normalizeKey(relKey));

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    }),
  );

  return { key, url: `${publicUrl}/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const { publicUrl } = getR2Config();
  const key = normalizeKey(relKey);
  return { key, url: `${publicUrl}/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { bucket } = getR2Config();
  const client = getR2Client();
  const key = normalizeKey(relKey);

  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: 3600,
  });
}
