import { afterEach, describe, expect, it } from 'vitest';
import { presignPut } from './r2.js';

const ENV_KEYS = ['R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_REGION'];

afterEach(() => {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
});

describe('presignPut', () => {
  it('returns a stub URL when env vars are missing', () => {
    const out = presignPut('workspaces/file.txt');
    expect(out.stub).toBe(true);
    expect(out.method).toBe('PUT');
    expect(out.url).toContain('r2-presigned.invalid');
    expect(out.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('signs a real URL when env vars are present', () => {
    process.env.R2_ACCOUNT_ID = 'acct';
    process.env.R2_BUCKET = 'bucket';
    process.env.R2_ACCESS_KEY_ID = 'AKIAEXAMPLE';
    process.env.R2_SECRET_ACCESS_KEY = 'sekrit';
    const out = presignPut('workspace/file.txt', 60);
    expect(out.stub).toBe(false);
    expect(out.url).toContain('bucket.acct.r2.cloudflarestorage.com');
    expect(out.url).toContain('X-Amz-Signature=');
    expect(out.url).toContain('X-Amz-Expires=60');
  });
});
