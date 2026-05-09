import { readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { app, safeStorage } from 'electron';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import logger from '../logger';

/**
 * Secrets service.
 *
 * Two layers:
 * 1. Electron `safeStorage` (Keychain on macOS, DPAPI on Windows, libsecret on
 *    Linux when available) is preferred.
 * 2. When the OS keyring is unavailable (headless Linux, some VMs) we fall back
 *    to AES-256-GCM with a key derived from a user-supplied master passphrase
 *    using scrypt. We DO NOT silently store secrets in plain text.
 */

const SECRET_FILE = 'secure-store.json';
const STATE_FILE = 'secure-state.json';

type Encoded = { kind: 'safe'; data: string } | { kind: 'aesgcm'; iv: string; tag: string; data: string };

type SecretStore = Record<string, Encoded>;

type State = {
  // scrypt salt + verifier hash (for unlock)
  salt?: string;
  verifier?: string;
};

let inMemoryKey: Buffer | null = null;

function userDataPath(name: string): string {
  return path.join(app.getPath('userData'), name);
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const text = await readFile(file, 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 });
}

export async function hasMasterPassphrase(): Promise<boolean> {
  const state = await readJson<State>(userDataPath(STATE_FILE), {});
  return !!state.salt && !!state.verifier;
}

export async function setMasterPassphrase(passphrase: string): Promise<void> {
  const salt = randomBytes(16);
  const key = deriveKey(passphrase, salt);
  const verifier = encryptAesGcm(key, Buffer.from('aetherforge-verify', 'utf8'));
  const state: State = {
    salt: salt.toString('base64'),
    verifier: JSON.stringify(verifier)
  };
  await writeJson(userDataPath(STATE_FILE), state);
  inMemoryKey = key;
}

export async function unlock(passphrase: string): Promise<boolean> {
  const state = await readJson<State>(userDataPath(STATE_FILE), {});
  if (!state.salt || !state.verifier) return false;
  const salt = Buffer.from(state.salt, 'base64');
  const key = deriveKey(passphrase, salt);
  try {
    const enc = JSON.parse(state.verifier) as { iv: string; tag: string; data: string };
    decryptAesGcm(key, enc);
    inMemoryKey = key;
    return true;
  } catch {
    return false;
  }
}

export function lock(): void {
  inMemoryKey = null;
}

function encryptAesGcm(key: Buffer, value: Buffer): { iv: string; tag: string; data: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(value), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: data.toString('base64')
  };
}

function decryptAesGcm(key: Buffer, enc: { iv: string; tag: string; data: string }): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(enc.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(enc.data, 'base64')), decipher.final()]);
}

async function readStore(): Promise<SecretStore> {
  return readJson<SecretStore>(userDataPath(SECRET_FILE), {});
}
async function writeStore(store: SecretStore): Promise<void> {
  await writeJson(userDataPath(SECRET_FILE), store);
}

function isLockedAesgcm(): boolean {
  return inMemoryKey === null && !safeStorage.isEncryptionAvailable();
}

export async function setSecret(key: string, value: string): Promise<void> {
  const store = await readStore();
  if (safeStorage.isEncryptionAvailable()) {
    const data = safeStorage.encryptString(value).toString('base64');
    store[key] = { kind: 'safe', data };
  } else {
    if (!inMemoryKey) {
      throw new Error('Secret store is locked. Set or unlock master passphrase first.');
    }
    const enc = encryptAesGcm(inMemoryKey, Buffer.from(value, 'utf8'));
    store[key] = { kind: 'aesgcm', ...enc };
  }
  await writeStore(store);
}

export async function getSecret(key: string): Promise<{ value: string | null; locked: boolean }> {
  const store = await readStore();
  const entry = store[key];
  if (!entry) return { value: null, locked: false };

  if (entry.kind === 'safe') {
    if (!safeStorage.isEncryptionAvailable()) {
      logger.warn('Secret encrypted with safeStorage but safeStorage now unavailable');
      return { value: null, locked: true };
    }
    return { value: safeStorage.decryptString(Buffer.from(entry.data, 'base64')), locked: false };
  }

  if (entry.kind === 'aesgcm') {
    if (!inMemoryKey) return { value: null, locked: true };
    const buf = decryptAesGcm(inMemoryKey, entry);
    return { value: buf.toString('utf8'), locked: false };
  }

  return { value: null, locked: false };
}

export async function deleteSecret(key: string): Promise<void> {
  const store = await readStore();
  if (key in store) {
    delete store[key];
    await writeStore(store);
  }
}

export async function destroyAll(): Promise<void> {
  try {
    await rm(userDataPath(SECRET_FILE), { force: true });
  } catch {
    // ignore
  }
}

export function isLocked(): boolean {
  return isLockedAesgcm();
}
