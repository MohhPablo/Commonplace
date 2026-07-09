import { db } from "./db";

/**
 * Optional app password, stored as a PBKDF2 hash (never plaintext).
 * This only gates the UI — app data in IndexedDB remains stored as-is.
 * Forgotten passwords can only be cleared by wiping local data ("Reset app").
 */

const AUTH_KEY = "authHash";
const ITERATIONS = 100_000;

interface StoredHash {
  salt: number[];
  hash: number[];
}

async function derive(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256,
  );
}

export async function isPasswordSet(): Promise<boolean> {
  const row = await db.meta.where("key").equals(AUTH_KEY).first();
  return !!row;
}

export async function setPassword(password: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt);
  const value: StoredHash = {
    salt: Array.from(salt),
    hash: Array.from(new Uint8Array(bits)),
  };
  await db.meta.put({ key: AUTH_KEY, value });
}

export async function verifyPassword(password: string): Promise<boolean> {
  const row = await db.meta.where("key").equals(AUTH_KEY).first();
  if (!row) return false;
  const { salt, hash } = row.value as StoredHash;
  const bits = await derive(password, Uint8Array.from(salt));
  const given = Array.from(new Uint8Array(bits));
  if (given.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given[i] ^ hash[i];
  return diff === 0;
}

export async function clearPassword(): Promise<void> {
  const row = await db.meta.where("key").equals(AUTH_KEY).first();
  if (row?.id != null) await db.meta.delete(row.id);
}

/** Wipe all local data (last resort for a forgotten password). */
export async function resetAllData(): Promise<void> {
  await db.transaction(
    "rw",
    [db.entries, db.tasks, db.priorities, db.habits, db.habitLogs, db.meta],
    async () => {
      await Promise.all([
        db.entries.clear(),
        db.tasks.clear(),
        db.priorities.clear(),
        db.habits.clear(),
        db.habitLogs.clear(),
        db.meta.clear(),
      ]);
    },
  );
}
