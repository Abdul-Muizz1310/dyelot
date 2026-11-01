import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canonicalize } from "@/spec/canonical";
import { fnv1a64, specId } from "@/spec/hash";
import type { DesignSpec } from "@/spec/schema";
import {
  defaultSpec,
  graySpec,
  numberPaths,
  PROPERTY_TIMEOUT,
  richSpec,
  shuffled,
  stringPaths,
  valueAt,
  withValue,
} from "./support";

// Cases are the C-HASH-nn rows of docs/specs/01-color-engine.md, section 6.7, and R-21.

const as = (value: unknown): DesignSpec => value as DesignSpec;

/**
 * The id of generateSystem(DEFAULT_PARAMS, "seed-1"), recorded when the Task 1.8 suite first
 * passed (C-HASH-05). A change to this constant must be deliberate: it means every spec id moves.
 */
const DEFAULT_SPEC_ID = "f99eeb55e29ded65";

describe("fnv1a64", () => {
  it("C-HASH-02 matches the published FNV-1a 64 vectors", () => {
    expect(fnv1a64("")).toBe("cbf29ce484222325");
    expect(fnv1a64("a")).toBe("af63dc4c8601ec8c");
    expect(fnv1a64("foobar")).toBe("85944171f73967e8");
    expect(fnv1a64("dyelot")).toBe("10593ce3d8ac9214");
  });

  it("C-HASH-03 hashes a string as UTF-8", () => {
    expect(fnv1a64("é")).toBe("0ac21707b7181e01");
    expect(fnv1a64("é")).toBe(fnv1a64(new Uint8Array([0xc3, 0xa9])));
  });

  it("C-HASH-06 hashes a Uint8Array as given", () => {
    expect(fnv1a64(new Uint8Array([0x61]))).toBe("af63dc4c8601ec8c");
    expect(fnv1a64(new Uint8Array([0xc3, 0xa9]))).toBe("0ac21707b7181e01");
    expect(fnv1a64(new Uint8Array(0))).toBe("cbf29ce484222325");
    expect(fnv1a64(new TextEncoder().encode("foobar"))).toBe("85944171f73967e8");
  });

  it("writes 16 lowercase hex digits, keeping leading zeros", () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 64 }), (bytes) => {
        expect(fnv1a64(bytes)).toMatch(/^[0-9a-f]{16}$/);
      }),
      { numRuns: 500 },
    );
  });

  it("agrees with a BigInt reference on any bytes", () => {
    const prime = BigInt("0x100000001b3");
    const mask = BigInt("0xffffffffffffffff");
    const reference = (bytes: Uint8Array): string => {
      let hash = BigInt("0xcbf29ce484222325");
      for (const byte of bytes) hash = ((hash ^ BigInt(byte)) * prime) & mask;
      return hash.toString(16).padStart(16, "0");
    };
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 256 }), (bytes) => {
        expect(fnv1a64(bytes)).toBe(reference(bytes));
      }),
      { numRuns: 500 },
    );
  });

  it("throws TypeError for an input that is neither a string nor a Uint8Array", () => {
    for (const value of [undefined, null, 42, [0x61], { length: 1 }]) {
      expect(() => fnv1a64(value as unknown as string), String(value)).toThrow(TypeError);
      expect(() => fnv1a64(value as unknown as string)).toThrow("fnv1a64: input");
    }
  });
});

describe("specId", () => {
  it("C-HASH-01 is 16 hex digits: FNV-1a 64 of the canonical string", () => {
    for (const spec of [defaultSpec(), richSpec(), graySpec()]) {
      expect(specId(spec)).toMatch(/^[0-9a-f]{16}$/);
      expect(specId(spec)).toBe(fnv1a64(canonicalize(spec)));
    }
  });

  it(
    "C-HASH-04 ignores key order and changes with any stored number or string",
    () => {
      const spec = richSpec();
      const id = specId(spec);
      const numbers = numberPaths(spec);
      const strings = stringPaths(spec);
      fc.assert(
        fc.property(fc.string(), fc.nat(), fc.nat(), (order, n, s) => {
          expect(specId(as(shuffled(spec, order)))).toBe(id);
          // One code unit more in a string, or 1 more in a number (a change at 6 digits).
          const numberPath = numbers[n % numbers.length];
          const nextNumber = (valueAt(spec, numberPath) as number) + 1;
          expect(
            specId(as(withValue(spec, numberPath, nextNumber))),
            numberPath.join("."),
          ).not.toBe(id);
          const stringPath = strings[s % strings.length];
          const nextString = `${valueAt(spec, stringPath) as string}x`;
          expect(
            specId(as(withValue(spec, stringPath, nextString))),
            stringPath.join("."),
          ).not.toBe(id);
        }),
        { numRuns: 200 },
      );
    },
    PROPERTY_TIMEOUT,
  );

  it("C-HASH-05 gives the recorded id for the default spec", () => {
    expect(specId(defaultSpec())).toBe(DEFAULT_SPEC_ID);
  });
});
