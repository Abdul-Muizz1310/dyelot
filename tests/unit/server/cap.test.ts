import { describe, expect, it } from "vitest";
import { deriveCapKey, signCap, verifyCap } from "@/server/ai/cap";
import { TODAY } from "../ai/fixtures";
import { oracleMac, SECRET_BYTES } from "./cap-oracle";

// C-CAP-01 of docs/specs/04-ai.md, section 14.7: the visitor cap cookie's signature (R4-18, section
// 11.2). The oracle is node:crypto (hkdfSync, then createHmac), apart from the Web Crypto the code uses.

const YESTERDAY = "2026-11-04";
const BASE64URL = /^[A-Za-z0-9_-]{43}$/;

/** A base64url character other than `char`, for a changed MAC. */
const otherChar = (char: string) => (char === "A" ? "B" : "A");

describe("C-CAP-01 deriveCapKey, signCap and verifyCap", () => {
  it("C-CAP-01 signs TODAY's count 1 with the MAC node:crypto gives (hkdfSync, then createHmac)", async () => {
    const key = await deriveCapKey(SECRET_BYTES);
    const value = await signCap(key, TODAY, 1);
    expect(value).toBe(`v1.${TODAY}.1.${oracleMac(TODAY, 1)}`);
    expect(value.split(".")[3]).toMatch(BASE64URL);
  });

  it("C-CAP-01 signs every count from 0 to 3 as the oracle does, and verifies each", async () => {
    const key = await deriveCapKey(SECRET_BYTES);
    for (const count of [0, 1, 2, 3]) {
      const value = await signCap(key, TODAY, count);
      expect(value, String(count)).toBe(`v1.${TODAY}.${count}.${oracleMac(TODAY, count)}`);
      await expect(verifyCap(key, value, TODAY), String(count)).resolves.toBe(count);
    }
  });

  it("C-CAP-01 verifyCap returns 1 for the cookie signCap gave", async () => {
    const key = await deriveCapKey(SECRET_BYTES);
    await expect(verifyCap(key, await signCap(key, TODAY, 1), TODAY)).resolves.toBe(1);
  });

  it("C-CAP-01 returns 0 for another day's cookie", async () => {
    const key = await deriveCapKey(SECRET_BYTES);
    await expect(verifyCap(key, await signCap(key, YESTERDAY, 3), TODAY)).resolves.toBe(0);
  });

  it("C-CAP-01 returns 0 for a changed MAC character, at the start, the middle and the end", async () => {
    const key = await deriveCapKey(SECRET_BYTES);
    const value = await signCap(key, TODAY, 1);
    const head = value.slice(0, value.lastIndexOf(".") + 1);
    const mac = value.slice(head.length);
    for (const at of [0, 21, 42]) {
      const changed = mac.slice(0, at) + otherChar(mac[at] as string) + mac.slice(at + 1);
      await expect(verifyCap(key, head + changed, TODAY), String(at)).resolves.toBe(0);
    }
  });

  it("C-CAP-01 returns 0 for a last MAC character that differs only in the bits the 32 bytes leave unused", async () => {
    // 43 characters carry 258 bits for 256: the last character's two low bits decode to nothing.
    const key = await deriveCapKey(SECRET_BYTES);
    const value = await signCap(key, TODAY, 1);
    const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const last = ALPHABET.indexOf(value.at(-1) as string);
    const sibling = ALPHABET[last ^ 1] as string;
    const forged = value.slice(0, -1) + sibling;
    expect(Buffer.from(forged.split(".")[3] as string, "base64url")).toEqual(
      Buffer.from(value.split(".")[3] as string, "base64url"),
    );
    await expect(verifyCap(key, forged, TODAY)).resolves.toBe(0);
  });

  it("C-CAP-01 returns 0 for a count changed without signing", async () => {
    const key = await deriveCapKey(SECRET_BYTES);
    const value = await signCap(key, TODAY, 1);
    for (const count of ["0", "2", "3"]) {
      const changed = value.replace(`.${TODAY}.1.`, `.${TODAY}.${count}.`);
      await expect(verifyCap(key, changed, TODAY), count).resolves.toBe(0);
    }
  });

  it("C-CAP-01 returns 0 for undefined and for values that are not a cap cookie", async () => {
    const key = await deriveCapKey(SECRET_BYTES);
    const value = await signCap(key, TODAY, 1);
    for (const bad of [
      undefined,
      "",
      "garbage",
      `v2${value.slice(2)}`,
      `${value}x`,
      ` ${value}`,
      value.replace(".1.", ".4."),
      value.slice(0, -1),
    ]) {
      await expect(verifyCap(key, bad, TODAY), String(bad)).resolves.toBe(0);
    }
  });

  it("C-CAP-01 returns 0 for a cookie signed with another secret", async () => {
    const other = await deriveCapKey(new Uint8Array(32).fill(7));
    const key = await deriveCapKey(SECRET_BYTES);
    await expect(verifyCap(key, await signCap(other, TODAY, 1), TODAY)).resolves.toBe(0);
  });

  it("C-CAP-01 derives a key that cannot be exported", async () => {
    const key = await deriveCapKey(SECRET_BYTES);
    expect(key.extractable).toBe(false);
    expect(key.algorithm).toMatchObject({ name: "HMAC", hash: { name: "SHA-256" }, length: 256 });
    expect([...key.usages].sort()).toEqual(["sign", "verify"]);
  });

  it("C-CAP-01 deriveCapKey refuses a secret that is not bytes (TypeError) or under 32 bytes (RangeError)", async () => {
    await expect(deriveCapKey("secret" as never)).rejects.toThrow(
      new TypeError("deriveCapKey: secret must be a Uint8Array, got string"),
    );
    await expect(deriveCapKey(null as never)).rejects.toThrow(/^deriveCapKey: secret .* null$/);
    await expect(deriveCapKey(new Uint8Array(31))).rejects.toThrow(RangeError);
    await expect(deriveCapKey(new Uint8Array(31))).rejects.toThrow(/^deriveCapKey: /);
  });

  it("C-CAP-01 signCap and verifyCap check their arguments, naming themselves", async () => {
    const key = await deriveCapKey(SECRET_BYTES);
    await expect(signCap({} as never, TODAY, 1)).rejects.toThrow(TypeError);
    await expect(signCap({} as never, TODAY, 1)).rejects.toThrow(/^signCap: key /);
    await expect(signCap(key, 20261105 as never, 1)).rejects.toThrow(TypeError);
    await expect(signCap(key, "2026-11-5", 1)).rejects.toThrow(RangeError);
    await expect(signCap(key, TODAY, "1" as never)).rejects.toThrow(TypeError);
    await expect(signCap(key, TODAY, 4)).rejects.toThrow(RangeError);
    await expect(signCap(key, TODAY, 1.5)).rejects.toThrow(/^signCap: count /);
    await expect(verifyCap({} as never, undefined, TODAY)).rejects.toThrow(/^verifyCap: key /);
    await expect(verifyCap(key, 5 as never, TODAY)).rejects.toThrow(TypeError);
    await expect(verifyCap(key, 5 as never, TODAY)).rejects.toThrow(/^verifyCap: value /);
    await expect(verifyCap(key, undefined, "today")).rejects.toThrow(RangeError);
    await expect(verifyCap(key, undefined, null as never)).rejects.toThrow(/^verifyCap: today /);
  });

  it("C-CAP-01 refuses a key of another algorithm or one that cannot sign and verify", async () => {
    const aes = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
      "encrypt",
    ]);
    await expect(signCap(aes, TODAY, 1)).rejects.toThrow(RangeError);
    await expect(signCap(aes, TODAY, 1)).rejects.toThrow(/^signCap: key /);
    const signOnly = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(32),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    await expect(verifyCap(signOnly, undefined, TODAY)).rejects.toThrow(RangeError);
  });
});
