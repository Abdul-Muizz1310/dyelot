import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { generateSystem } from "@/engine/generate";
import { normalizeSpec } from "@/spec/canonical";
import { specId } from "@/spec/hash";
import type { DesignSpec } from "@/spec/schema";
import { decodeSpec, encodeSpec } from "@/spec/url-codec";
import {
  anyDirection,
  anySeedText,
  defaultSpec,
  PROPERTY_TIMEOUT,
  richSpec,
  withValue,
} from "./support";

// Cases are the C-NORM-nn rows of docs/specs/02-studio.md, section 6.1, and R2-01.

function withLongLightness(): DesignSpec {
  const spec = structuredClone(defaultSpec());
  spec.color.palettes.primary.light[0].oklch.l = 0.97123456789;
  return spec;
}

describe("normalizeSpec", () => {
  it("C-NORM-01 writes a long number at six digits", () => {
    expect(normalizeSpec(withLongLightness()).color.palettes.primary.light[0].oklch.l).toBe(
      0.971235,
    );
  });

  it("C-NORM-02 round-trips through the share link", () => {
    for (const spec of [withLongLightness(), defaultSpec()]) {
      const normal = normalizeSpec(spec);
      expect(decodeSpec(encodeSpec(normal))).toEqual(normal);
    }
  });

  it("C-NORM-03 leaves a generated spec as it is", () => {
    for (const spec of [defaultSpec(), richSpec()]) expect(normalizeSpec(spec)).toEqual(spec);
  });

  it(
    "C-NORM-04 is idempotent",
    () => {
      fc.assert(
        fc.property(anyDirection, anySeedText, (params, seed) => {
          const once = normalizeSpec(generateSystem(params, seed));
          expect(normalizeSpec(once)).toEqual(once);
        }),
        { numRuns: 50 },
      );
    },
    PROPERTY_TIMEOUT,
  );

  it("C-NORM-05 keeps the id of what the store holds", () => {
    const normal = normalizeSpec(withLongLightness());
    expect(specId(normal)).toBe(specId(decodeSpec(encodeSpec(normal))));
  });

  it("C-NORM-06 returns a new object and leaves the input alone", () => {
    const input = withLongLightness();
    const before = structuredClone(input);
    const output = normalizeSpec(input);
    expect(output).not.toBe(input);
    expect(input).toEqual(before);
  });

  it("C-NORM-07 writes a hue near 360 as 0", () => {
    const spec = structuredClone(defaultSpec());
    spec.color.palettes.primary.hue = 359.9996;
    const normal = normalizeSpec(spec);
    expect(normal.color.palettes.primary.hue).toBe(0);
  });

  it.each([null, [], "x", 1])("C-NORM-08 throws TypeError for %j", (value) => {
    expect(() => normalizeSpec(value as unknown as DesignSpec)).toThrow(TypeError);
    expect(() => normalizeSpec(value as unknown as DesignSpec)).toThrow(/^normalizeSpec:/);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])("C-NORM-09 throws RangeError for %s", (n) => {
    const spec = withValue(
      defaultSpec(),
      ["color", "palettes", "primary", "light", 0, "oklch", "l"],
      n,
    ) as DesignSpec;
    expect(() => normalizeSpec(spec)).toThrow(RangeError);
    expect(() => normalizeSpec(spec)).toThrow(/^normalizeSpec: .*oklch\.l/);
  });

  it("C-NORM-10 throws RangeError listing the paths, never a ZodError", () => {
    const extra = { ...structuredClone(defaultSpec()), extra: 1 } as unknown as DesignSpec;
    const missing = structuredClone(defaultSpec());
    delete (missing.color.roles.light as Record<string, unknown>).ring;
    const short = structuredClone(defaultSpec());
    short.color.palettes.primary.light.pop();
    for (const [spec, path] of [
      [extra, "(root)"],
      [missing, "color.roles.light"],
      [short, "color.palettes.primary.light"],
    ] as const) {
      expect(() => normalizeSpec(spec)).toThrow(RangeError);
      expect(() => normalizeSpec(spec)).toThrow(
        /^normalizeSpec: spec does not match dyelot\.spec\/1 at /,
      );
      expect(() => normalizeSpec(spec)).toThrow(path);
    }
  });

  it("C-NORM-11 throws TypeError for a cycle, a function or a bigint", () => {
    const cyclic = structuredClone(defaultSpec()) as unknown as Record<string, unknown>;
    cyclic.self = cyclic;
    const fn = { ...structuredClone(defaultSpec()), f: () => 1 };
    const big = { ...structuredClone(defaultSpec()), n: BigInt(1) };
    for (const spec of [cyclic, fn, big]) {
      expect(() => normalizeSpec(spec as unknown as DesignSpec)).toThrow(TypeError);
      expect(() => normalizeSpec(spec as unknown as DesignSpec)).toThrow(/^normalizeSpec:/);
    }
  });
});
