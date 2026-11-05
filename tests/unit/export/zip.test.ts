import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildBundle } from "@/export/bundle";
import { sha256 } from "@/export/sha256";
import { zipBundle, zipName } from "@/export/zip";
import { specId } from "@/spec";
import { ZIP_ZONES_TIMEOUT } from "../support/timeouts";
import { BUNDLE, LONG_NAME } from "./bundle-support";
import { ORIGIN, SPEC } from "./golden-support";

// C-ZIP-01 to 07 of docs/specs/03-export.md, section 10.9 (R3-26). C-ZIP-04's golden half lives in golden.test.ts.

const encoder = new TextEncoder();

function named(name: string) {
  const spec = structuredClone(SPEC);
  spec.meta.name = name;
  return buildBundle({ spec, origin: ORIGIN });
}

/** Every header of a zip: the offset of each signature, read from the bytes. */
function headers(zip: Uint8Array, signature: number): number[] {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const found: number[] = [];
  for (let i = 0; i + 4 <= zip.length; i++) {
    if (view.getUint32(i, true) === signature) found.push(i);
  }
  return found;
}

describe("zipBundle", () => {
  it("C-ZIP-01: unzips to exactly the bundle's files in order", () => {
    const entries = unzipSync(zipBundle(BUNDLE));
    expect(Object.keys(entries)).toEqual(BUNDLE.files.map((f) => f.path));
    for (const file of BUNDLE.files) {
      expect(entries[file.path]).toEqual(encoder.encode(file.text));
    }
  });

  it("C-ZIP-02: DOS time 0x0000, date 0x0021, deflate, no extra field, no comment, no folders", () => {
    const zip = zipBundle(BUNDLE);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const locals = headers(zip, 0x04034b50);
    const centrals = headers(zip, 0x02014b50);
    expect(locals).toHaveLength(BUNDLE.files.length);
    expect(centrals).toHaveLength(BUNDLE.files.length);
    for (const at of locals) {
      expect(view.getUint16(at + 8, true)).toBe(8);
      expect(view.getUint16(at + 10, true)).toBe(0x0000);
      expect(view.getUint16(at + 12, true)).toBe(0x0021);
      expect(view.getUint16(at + 28, true)).toBe(0);
    }
    for (const at of centrals) {
      expect(view.getUint16(at + 10, true)).toBe(8);
      expect(view.getUint16(at + 12, true)).toBe(0x0000);
      expect(view.getUint16(at + 14, true)).toBe(0x0021);
      expect(view.getUint16(at + 30, true)).toBe(0);
      expect(view.getUint16(at + 32, true)).toBe(0);
    }
    const names = centrals.map((at) => {
      const length = view.getUint16(at + 28, true);
      return new TextDecoder().decode(zip.subarray(at + 46, at + 46 + length));
    });
    expect(names).toEqual(BUNDLE.files.map((f) => f.path));
    expect(names.some((n) => n.endsWith("/"))).toBe(false);
    const [end] = headers(zip, 0x06054b50);
    expect(view.getUint16((end as number) + 20, true)).toBe(0);
  });

  it(
    "C-ZIP-03: the same bytes in every time zone",
    () => {
      const original = process.env.TZ;
      const hash = (zone: string) => {
        process.env.TZ = zone;
        return sha256(zipBundle(BUNDLE));
      };
      try {
        const expected = hash("UTC");
        const zones = Intl.supportedValuesOf("timeZone");
        expect(zones.length).toBeGreaterThan(100);
        for (const zone of zones) expect(hash(zone), zone).toBe(expected);
      } finally {
        if (original === undefined) delete process.env.TZ;
        else process.env.TZ = original;
      }
    },
    ZIP_ZONES_TIMEOUT,
  ); // sized for the coverage run in CI

  it("C-ZIP-04: two calls give equal bytes", () => {
    expect(zipBundle(BUNDLE)).toEqual(zipBundle(BUNDLE));
  });

  it("C-BND-08: two builds are equal, in two zones too, and the zip name follows the slug", () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const a = buildBundle({ spec: SPEC, origin: ORIGIN });
      const zipA = zipBundle(a);
      process.env.TZ = "Pacific/Kiritimati";
      const b = buildBundle({ spec: SPEC, origin: ORIGIN });
      expect(b.files).toEqual(BUNDLE.files);
      expect(a.files).toEqual(BUNDLE.files);
      expect(zipBundle(b)).toEqual(zipA);
      expect(zipA).toEqual(zipBundle(BUNDLE));
    } finally {
      if (original === undefined) delete process.env.TZ;
      else process.env.TZ = original;
    }
    expect(zipName(BUNDLE)).toBe(`untitled-${specId(SPEC).slice(0, 8)}.zip`);
    const long = named(LONG_NAME);
    expect(long.slug).toHaveLength(48);
    expect(zipName(long)).toBe(`${long.slug}-${long.specId.slice(0, 8)}.zip`);
  });

  it("C-ZIP-05: the zip name follows the slug", () => {
    const cafe = named("Café Crème");
    expect(zipName(cafe)).toMatch(/^cafe-creme-[0-9a-f]{8}\.zip$/);
    expect(zipName(named("!!!"))).toMatch(/^design-[0-9a-f]{8}\.zip$/);
  });
});

describe("zipBundle failures", () => {
  it("C-ZIP-06: a non-bundle is a TypeError, bad or repeated paths a RangeError", () => {
    for (const value of [null, 5, "x", {}, { files: 3 }]) {
      expect(() => zipBundle(value as never)).toThrow(TypeError);
      expect(() => zipBundle(value as never)).toThrow(/zipBundle/);
    }
    const first = BUNDLE.files[0] as { path: string; text: string };
    const bad = (files: unknown) => () => zipBundle({ ...BUNDLE, files } as never);
    for (const files of [
      [first, first],
      [{ path: "../x", text: "a\n" }],
      [{ path: "/x", text: "a\n" }],
      [{ path: "A.txt", text: "a\n" }],
    ]) {
      expect(bad(files)).toThrow(RangeError);
      expect(bad(files)).toThrow(/zipBundle/);
    }
  });

  it("C-ZIP-07: zipName(null) and zipName({}) are TypeErrors naming zipName", () => {
    for (const value of [null, {}]) {
      expect(() => zipName(value as never)).toThrow(TypeError);
      expect(() => zipName(value as never)).toThrow(/zipName/);
    }
  });
});
