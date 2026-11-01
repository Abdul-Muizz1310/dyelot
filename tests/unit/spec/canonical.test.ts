import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { generateSystem } from "@/engine/generate";
import { canonicalize } from "@/spec/canonical";
import type { DesignSpec } from "@/spec/schema";
import {
  anyDirection,
  anySeedText,
  defaultSpec,
  graySpec,
  PROPERTY_TIMEOUT,
  richSpec,
  shuffled,
  valueAt,
  withValue,
} from "./support";

// Cases are the C-CANON-nn rows of docs/specs/01-color-engine.md, section 6.7, and R-21.

const as = (value: unknown): DesignSpec => value as DesignSpec;
const reparsed = (text: string): unknown => JSON.parse(text);
const PRIMARY_L0 = ["color", "palettes", "primary", "light", 0, "oklch", "l"] as const;

/** Every object in `value`, depth first. */
function objects(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value.flatMap(objects);
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).flatMap(objects)];
}

describe("canonicalize", () => {
  it(
    "C-CANON-01 writes the same string for any key order at every level",
    () => {
      const pool = [defaultSpec(), richSpec(), graySpec()];
      fc.assert(
        fc.property(fc.constantFrom(0, 1, 2), fc.string(), fc.string(), (index, first, second) => {
          const spec = pool[index];
          const a = canonicalize(as(shuffled(spec, first)));
          const b = canonicalize(as(shuffled(spec, second)));
          expect(a).toBe(b);
          expect(a).toBe(canonicalize(spec));
        }),
        { numRuns: 200 },
      );
    },
    PROPERTY_TIMEOUT,
  );

  it("C-CANON-01 sorts the keys of every object", () => {
    const parsed = reparsed(canonicalize(richSpec()));
    for (const object of objects(parsed)) {
      const keys = Object.keys(object);
      expect(keys).toEqual([...keys].sort());
    }
  });

  it("C-CANON-02 keeps 6 significant digits and writes -0 as 0", () => {
    const cases: ReadonlyArray<readonly [readonly (string | number)[], number, string, number]> = [
      [PRIMARY_L0, 0.7002508346689501, '"l":0.700251', 0.700251],
      [["color", "palettes", "primary", "hue"], 22.0638415289496, '"hue":22.0638', 22.0638],
      [["space", "scale", 0], -0, '"scale":[0,', 0],
      [["motion", "durations", "slowest"], 1234567, '"slowest":1234570', 1234570],
      [["motion", "durations", "base"], 4e-7, '"base":4e-7', 4e-7],
    ];
    for (const [path, value, text, stored] of cases) {
      const canonical = canonicalize(as(withValue(defaultSpec(), path, value)));
      expect(canonical).toContain(text);
      expect(Object.is(valueAt(reparsed(canonical), path), stored)).toBe(true);
    }
    // Negative numbers such as a tracking of -0.0109598 keep their sign; only -0 loses it.
    const negativeZero = canonicalize(as(withValue(defaultSpec(), ["space", "scale", 0], -0)));
    expect(negativeZero).not.toContain('"scale":[-0');
    expect(canonicalize(defaultSpec())).toContain('"trackingEm":-0.0109598');
  });

  it("C-CANON-03 writes no whitespace and keeps array order", () => {
    const canonical = canonicalize(defaultSpec());
    expect(canonical).not.toMatch(/\s/);
    const ordered = as(withValue(defaultSpec(), ["rules", "do"], ["second", "first", "third"]));
    expect(canonicalize(ordered)).toContain('"do":["second","first","third"]');
    const steps = (reparsed(canonical) as DesignSpec).type.steps.map((step) => step.name);
    expect(steps).toEqual(defaultSpec().type.steps.map((step) => step.name));
  });

  it("C-CANON-03 omits undefined properties and keeps null", () => {
    const base = canonicalize(defaultSpec());
    expect(canonicalize(as(withValue(defaultSpec(), ["meta", "extra"], undefined)))).toBe(base);
    expect(canonicalize(as(withValue(defaultSpec(), ["type", "ratio"], undefined)))).toBe(base);
    const gray = canonicalize(graySpec());
    expect(gray).toContain('"h":null');
    const step = (reparsed(gray) as DesignSpec).color.palettes.neutral.light[0];
    expect(step.oklch.h).toBeNull();
  });

  it("C-CANON-03 JSON-escapes strings, and they read back unchanged", () => {
    // U+2028 is built from its code so no invisible character sits in the source.
    const lineSeparator = String.fromCharCode(0x2028);
    const name = `Quote " backslash \\ newline \n tab \t ${lineSeparator} \u00e9 \u0000 lone \ud800`;
    const canonical = canonicalize(as(withValue(defaultSpec(), ["meta", "name"], name)));
    expect(canonical).toContain(`"name":${JSON.stringify(name)}`);
    expect((reparsed(canonical) as DesignSpec).meta.name).toBe(name);
    const outside = canonical.replace(/"(?:[^"\\]|\\.)*"/g, '""');
    expect(outside).not.toMatch(/\s/);
  });

  it(
    "C-CANON-04 and C-CANON-07 are fixed points on generated specs",
    () => {
      fc.assert(
        fc.property(anyDirection, anySeedText, (params, seed) => {
          const spec = generateSystem(params, seed);
          const canonical = canonicalize(spec);
          // C-CANON-04: canonicalizing the canonical text again changes nothing.
          expect(canonicalize(as(reparsed(canonical)))).toBe(canonical);
          // C-CANON-07: reading the canonical text back gives the spec itself.
          expect(reparsed(canonical)).toEqual(spec);
        }),
        { numRuns: 50 },
      );
    },
    PROPERTY_TIMEOUT,
  );

  it("C-CANON-05 throws RangeError on NaN, Infinity or -Infinity, and never writes null", () => {
    const paths = [
      PRIMARY_L0,
      ["color", "palettes", "primary", "hue"],
      ["space", "scale", 3],
      ["components", "icons", "strokePx"],
    ];
    for (const path of paths) {
      for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        const spec = as(withValue(defaultSpec(), path, value));
        expect(() => canonicalize(spec), `${path.join(".")} ${value}`).toThrow(RangeError);
        expect(() => canonicalize(spec)).toThrow(String(path[path.length - 1]));
      }
    }
  });

  it("C-CANON-06 changes with any field, but not below the sixth significant digit", () => {
    const base = canonicalize(defaultSpec());
    expect(canonicalize(as(withValue(defaultSpec(), ["meta", "name"], "untitled2")))).not.toBe(
      base,
    );
    expect(canonicalize(as(withValue(defaultSpec(), ["motion", "feel"], "calm")))).not.toBe(base);
    const atSeven = canonicalize(as(withValue(defaultSpec(), PRIMARY_L0, 0.7)));
    expect(atSeven).not.toBe(base);
    expect(canonicalize(as(withValue(defaultSpec(), PRIMARY_L0, 0.7 + 1e-9)))).toBe(atSeven);
    expect(canonicalize(as(withValue(defaultSpec(), PRIMARY_L0, 0.700001)))).not.toBe(atSeven);
  });

  it("rounds hue fields with roundHue, so a hue in [359.9995, 360) wraps to 0", () => {
    const hue = ["color", "palettes", "primary", "hue"];
    const stepHue = ["color", "palettes", "primary", "light", 4, "oklch", "h"];
    const seedHue = ["color", "params", "primary", "h"];
    const shadowHue = ["depth", "shadows", 3, 0, "color", "h"];
    for (const path of [hue, stepHue, seedHue, shadowHue]) {
      for (const value of [359.9995, 359.9997, 359.99999999999994]) {
        const canonical = canonicalize(as(withValue(richSpec(), path, value)));
        expect(valueAt(reparsed(canonical), path), `${path.join(".")} ${value}`).toBe(0);
      }
      const below = canonicalize(as(withValue(richSpec(), path, 359.9994999)));
      expect(valueAt(reparsed(below), path)).toBe(359.999);
    }
    // A number that is not a hue keeps round6, which writes 360.
    const base = ["motion", "durations", "base"];
    const canonical = canonicalize(as(withValue(defaultSpec(), base, 359.9997)));
    expect(valueAt(reparsed(canonical), base)).toBe(360);
  });

  it("throws TypeError for a spec or a value that JSON cannot carry", () => {
    for (const value of [null, undefined, 42, "spec", []]) {
      expect(() => canonicalize(as(value)), String(value)).toThrow(TypeError);
    }
    const strange: ReadonlyArray<readonly [string, unknown]> = [
      ["a function", () => 1],
      ["a symbol", Symbol("x")],
      ["a bigint", BigInt(1)],
      ["a map", new Map()],
      ["a date", new Date(0)],
    ];
    for (const [label, value] of strange) {
      const spec = as(withValue(defaultSpec(), ["meta", "name"], "x"));
      (spec.meta as Record<string, unknown>).name = value;
      expect(() => canonicalize(spec), label).toThrow(TypeError);
      expect(() => canonicalize(spec), label).toThrow("meta.name");
    }
    const holes = as(withValue(defaultSpec(), ["space", "scale"], [0, undefined, 8]));
    expect(() => canonicalize(holes)).toThrow(TypeError);
    expect(() => canonicalize(holes)).toThrow("space.scale[1]");
  });

  it("throws TypeError for a cycle instead of overflowing the stack", () => {
    const spec = as(structuredClone(defaultSpec()));
    (spec.meta as Record<string, unknown>).self = spec;
    expect(() => canonicalize(spec)).toThrow(TypeError);
    expect(() => canonicalize(spec)).toThrow("meta.self");
  });

  it("writes booleans, and a value shared in two places twice (no false cycle)", () => {
    const shared = { a: 1 };
    const spec = as(withValue(defaultSpec(), ["meta", "flags"], [true, false]));
    (spec.meta as Record<string, unknown>).left = shared;
    (spec.meta as Record<string, unknown>).right = shared;
    const canonical = canonicalize(spec);
    expect(canonical).toContain('"flags":[true,false]');
    expect(canonical).toContain('"left":{"a":1}');
    expect(canonical).toContain('"right":{"a":1}');
  });

  it("does not mutate its argument", () => {
    const spec = structuredClone(defaultSpec());
    const before = structuredClone(spec);
    canonicalize(as(withValue(spec, PRIMARY_L0, 0.7002508346689501)));
    canonicalize(spec);
    expect(spec).toEqual(before);
  });
});
