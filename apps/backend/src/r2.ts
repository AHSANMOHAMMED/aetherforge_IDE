import { createHmac } from 'node:crypto';

/**
 * Cloudflare R2 (S3-compatible) presigned PUT URL generator.
 *
 * AWS Signature V4 is implemented inline so the backend has no hard dependency on the AWS SDK.
 * When the required env vars are missing we fall back to a deterministic stub URL (the same path
 * shape as the previous hand-coded stub), which keeps local dev and tests deterministic.
 */

type R2Config = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
};

function loadConfig(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    return null;
  }
  return { accountId, bucket, accessKeyId, secretAccessKey, region: process.env.R2_REGION ?? 'auto' };
}

function sha256Hex(input: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('node:crypto') as typeof import('node:crypto');
  return crypto.createHash('sha256').update(input).digest('hex');
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest() as unknown as Buffer;
}

function signingKey(secret: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

export type PresignedPut = {
  path: string;
  url: string;
  method: 'PUT';
  expiresAt: number;
  stub: boolean;
};

export function presignPut(path: string, expiresIn = 900): PresignedPut {
  const config = loadConfig();
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  if (!config) {
    return {
      path,
      url: `https://r2-presigned.invalid/${encodeURIComponent(path)}?expires=${expiresAt}`,
      method: 'PUT',
      expiresAt,
      stub: true
    };
  }

  const host = `${config.bucket}.${config.accountId}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now
    .toISOString()
    .replace(/[:-]/g, '')
    .replace(/\.\d{3}/, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const credential = `${config.accessKeyId}/${credentialScope}`;
  const canonicalUri = `/${encodeURIComponent(path).replace(/%2F/g, '/')}`;

  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'host'
  };

  const canonicalQuery = Object.keys(queryParams)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalRequest = `PUT\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\nhost\n${payloadHash}`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${sha256Hex(canonicalRequest)}`;
  const key = signingKey(config.secretAccessKey, dateStamp, config.region, 's3');
  const signature = createHmac('sha256', key).update(stringToSign).digest('hex');

  const url = `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  return { path, url, method: 'PUT', expiresAt, stub: false };
}
