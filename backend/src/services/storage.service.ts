import fs from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';

const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl } = config.r2;

/** Cloudflare R2 (S3-compatible) is used only when fully configured; otherwise local disk. */
const remote = Boolean(accountId && accessKeyId && secretAccessKey && bucket && publicBaseUrl);

const s3 = remote
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    })
  : null;

export function isRemoteStorage(): boolean {
  return remote;
}

/** The public URL a stored object is served from (R2 public bucket / custom domain). */
export function publicUrl(key: string): string {
  return `${publicBaseUrl.replace(/\/+$/, '')}/${encodeURIComponent(key)}`;
}

/** Persist an uploaded file to R2 (when configured) or the local uploads dir. */
export async function putUpload(key: string, body: Buffer, contentType: string): Promise<void> {
  if (remote && s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return;
  }
  await fs.promises.writeFile(path.join(uploadsDir, key), body);
}

export const localUploadsDir = uploadsDir;
