import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// The private link of a post ends in a secret key. Whoever has the key can
// change the status of that post. The key is made once, when the post is saved,
// and shown to the author once. The file with the posts keeps only a
// fingerprint of the key (a SHA-256 hash), so reading the file does not give
// anyone a working link. Only server code may use this file.

// 32 random bytes are written as 64 small hexadecimal characters: the digits
// 0 to 9 and the letters a to f. That is safe to put in an address.
const keyPattern = /^[0-9a-f]{64}$/;

// A SHA-256 fingerprint is also 32 bytes, written the same way.
const fingerprintPattern = /^[0-9a-f]{64}$/;

export function createManageKey(): string {
  return randomBytes(32).toString("hex");
}

// True for a text that has the shape of a key. It says nothing about whether
// the key opens a post.
export function isManageKey(value: unknown): value is string {
  return typeof value === "string" && keyPattern.test(value);
}

// True for a text that has the shape of a fingerprint.
export function isKeyHash(value: unknown): value is string {
  return typeof value === "string" && fingerprintPattern.test(value);
}

export function hashManageKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

// Does this key belong to this fingerprint? A post saved before private links
// existed has no fingerprint, and then no key fits. The two fingerprints are
// compared in a way that takes the same time wherever they differ.
export function keyMatches(key: unknown, fingerprint: unknown): boolean {
  if (isManageKey(key) && isKeyHash(fingerprint)) {
    const wanted = Buffer.from(fingerprint, "hex");
    const given = Buffer.from(hashManageKey(key), "hex");
    return wanted.length === given.length && timingSafeEqual(wanted, given);
  }
  return false;
}
