import { createHash } from "node:crypto";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { sha256 } from "@/export/sha256";

// Cases are the C-SHA-nn rows of docs/specs/03-export.md, section 10.2.

describe("C-SHA-01 known digests", () => {
  it("hashes the FIPS 180-4 vectors", () => {
    expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256("a".repeat(1_000_000))).toBe(
      "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0",
    );
  });

  it("hashes a string as its UTF-8 bytes", () => {
    expect(sha256("é")).toBe(sha256(new Uint8Array([0xc3, 0xa9])));
  });
});

describe("C-SHA-02 agrees with node:crypto", () => {
  const reference = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

  it("matches on strings and byte arrays", () => {
    const lengths = fc.constantFrom(55, 56, 63, 64, 65);
    const input = fc.oneof(
      fc.string({ unit: "binary", maxLength: 1500 }).map((text) => ({
        text,
        bytes: new Uint8Array(Buffer.from(text, "utf8")),
      })),
      fc.uint8Array({ maxLength: 4096 }).map((bytes) => ({ text: undefined, bytes })),
      lengths.chain((length) =>
        fc.uint8Array({ minLength: length, maxLength: length }).map((bytes) => ({
          text: undefined,
          bytes,
        })),
      ),
    );
    fc.assert(
      fc.property(input, ({ text, bytes }) => {
        const expected = reference(bytes);
        expect(sha256(bytes)).toBe(expected);
        if (text !== undefined) expect(sha256(text)).toBe(expected);
      }),
      { numRuns: 500, seed: 3004 },
    );
  });

  it("matches at the padding boundaries", () => {
    for (const length of [0, 1, 54, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128]) {
      const bytes = new Uint8Array(length).fill(0x61);
      expect(sha256(bytes), String(length)).toBe(reference(bytes));
    }
  });
});

describe("C-SHA-03 the input check", () => {
  it.each([5, null, [1, 2], undefined, {}])("throws TypeError naming sha256 for %j", (value) => {
    expect(() => sha256(value as never)).toThrow(TypeError);
    expect(() => sha256(value as never)).toThrow(/sha256/);
  });

  it("returns 64 lowercase hex digits", () => {
    for (const input of ["", "x", new Uint8Array(100)])
      expect(sha256(input)).toMatch(/^[0-9a-f]{64}$/);
  });
});
