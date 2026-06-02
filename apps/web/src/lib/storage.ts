import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Storage de arquivos (imagens) — Cloudflare R2, compatível com S3.
// Configurado por env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// R2_BUCKET, R2_PUBLIC_URL (a URL pública pub-xxxx.r2.dev).

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicUrl = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

export function isStorageConfigured(): boolean {
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket && publicUrl);
}

let client: S3Client | null = null;
function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    });
  }
  return client;
}

/** Sobe um arquivo e retorna a URL pública. */
export async function uploadToStorage(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  if (!isStorageConfigured()) throw new Error("Storage não configurado.");
  await getClient().send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
  return `${publicUrl}/${key}`;
}
