import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getPlatformSetting } from "@zapstore/db";

// Storage de arquivos (imagens) — Cloudflare R2, compatível com S3.
// Chaves vêm do painel do dono (PlatformSetting) com fallback pro env:
// R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL.

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

async function loadConfig(): Promise<R2Config | null> {
  const [accountId, accessKeyId, secretAccessKey, bucket, publicUrl] = await Promise.all([
    getPlatformSetting("R2_ACCOUNT_ID"),
    getPlatformSetting("R2_ACCESS_KEY_ID"),
    getPlatformSetting("R2_SECRET_ACCESS_KEY"),
    getPlatformSetting("R2_BUCKET"),
    getPlatformSetting("R2_PUBLIC_URL"),
  ]);
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl: publicUrl.replace(/\/$/, "") };
}

export async function isStorageConfigured(): Promise<boolean> {
  return (await loadConfig()) !== null;
}

/** Sobe um arquivo e retorna a URL pública. */
export async function uploadToStorage(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const cfg = await loadConfig();
  if (!cfg) throw new Error("Storage não configurado.");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  await client.send(
    new PutObjectCommand({ Bucket: cfg.bucket, Key: key, Body: body, ContentType: contentType }),
  );
  return `${cfg.publicUrl}/${key}`;
}
