import { expect, test } from "vitest";
import {
  createManageKey,
  hashManageKey,
  isKeyHash,
  isManageKey,
  keyMatches,
} from "@/lib/manage-key";

test("a new key is 64 small hexadecimal characters", () => {
  const key = createManageKey();
  expect(key.length).toBe(64);
  expect(/^[0-9a-f]+$/.test(key)).toBe(true);
  expect(isManageKey(key)).toBe(true);
});

test("keys are all different", () => {
  const seen = new Set<string>();
  for (let index = 0; index < 300; index += 1) seen.add(createManageKey());
  expect(seen.size).toBe(300);
});

test("only a text of the right shape counts as a key", () => {
  const key = createManageKey();
  expect(isManageKey(key.slice(1))).toBe(false);
  expect(isManageKey(key + "a")).toBe(false);
  expect(isManageKey(key.toUpperCase().replace(/[0-9]/g, "A"))).toBe(false);
  for (const other of ["g", "+", "/", "=", " ", ".", "-", "_"]) {
    expect(isManageKey(key.slice(1) + other)).toBe(false);
  }
  expect(isManageKey("")).toBe(false);
  for (const value of [undefined, null, 64, {}, [key]]) {
    expect(isManageKey(value)).toBe(false);
  }
});

test("the fingerprint is the SHA-256 of the key, in 64 small hexadecimal characters", () => {
  // A known answer: the SHA-256 of the three letters abc.
  expect(hashManageKey("abc")).toBe(
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
  const key = createManageKey();
  expect(hashManageKey(key)).toBe(hashManageKey(key));
  expect(hashManageKey(key)).not.toBe(hashManageKey(createManageKey()));
  expect(isKeyHash(hashManageKey(key))).toBe(true);
});

test("the fingerprint does not contain the key", () => {
  const key = createManageKey();
  expect(hashManageKey(key).includes(key)).toBe(false);
});

test("only a text of the right shape counts as a fingerprint", () => {
  const good = hashManageKey("abc");
  expect(isKeyHash(good.toUpperCase())).toBe(false);
  expect(isKeyHash(good.slice(1))).toBe(false);
  expect(isKeyHash(good + "0")).toBe(false);
  expect(isKeyHash("g" + good.slice(1))).toBe(false);
  expect(isKeyHash("")).toBe(false);
  for (const value of [undefined, null, 5, {}]) {
    expect(isKeyHash(value)).toBe(false);
  }
});

test("a key fits its own fingerprint and no other", () => {
  const key = createManageKey();
  const other = createManageKey();
  expect(keyMatches(key, hashManageKey(key))).toBe(true);
  expect(keyMatches(other, hashManageKey(key))).toBe(false);
  expect(keyMatches(key, hashManageKey(other))).toBe(false);
});

test("a post with no fingerprint cannot be opened by any key", () => {
  expect(keyMatches(createManageKey(), undefined)).toBe(false);
  expect(keyMatches(createManageKey(), "")).toBe(false);
});

test("a key or a fingerprint of the wrong shape never fits", () => {
  const key = createManageKey();
  expect(keyMatches("short", hashManageKey("short"))).toBe(false);
  expect(keyMatches(undefined, hashManageKey(key))).toBe(false);
  expect(keyMatches(key, hashManageKey(key).toUpperCase())).toBe(false);
  expect(keyMatches(key, key)).toBe(false);
});
