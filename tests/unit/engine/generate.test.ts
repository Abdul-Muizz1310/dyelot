import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { pickChartColors } from "@/engine/color/chart";
import { buildPalettes, type ColorParams } from "@/engine/color/palette";
import { parseColor } from "@/engine/color/parse";
import { resolveRoles } from "@/engine/color/roles";
import type { Oklch } from "@/engine/color/types";
import { ENGINE_VERSION, generateSystem } from "@/engine/generate";
import { seededRandom } from "@/engine/random";
import { shadows } from "@/engine/tokens/depth";
import { motionTokens } from "@/engine/tokens/motion";
import { radiusScale } from "@/engine/tokens/shape";
import { spaceScale } from "@/engine/tokens/space";
import { typeScale } from "@/engine/tokens/type";
import { canonicalize } from "@/spec/canonical";
import { specId } from "@/spec/hash";
import { type DesignSpec, DesignSpecSchema, type DirectionParams } from "@/spec/schema";
import {
  anyDirection,
  anySeedText,
  DEFAULT_PARAMS,
  deepFreeze,
  defaultSpec,
  expectAllFinite,
  grayParams,
  graySpec,
  MODES,
  PROPERTY_TIMEOUT,
  RICH_PARAMS,
  richSpec,
  rounded,
} from "../spec/support";

// Cases are the C-GEN-nn rows of docs/specs/01-color-engine.md, section 6.7, and the
// `color.params` half of C-PAL-19.

/** The color part of a direction, as `buildPalettes` takes it. */
function colorPart(params: DirectionParams): ColorParams {
  const {
    type: _type,
    radius: _radius,
    depth: _depth,
    motion: _motion,
    name: _name,
    ...color
  } = params;
  return color;
}

/** Every stored Oklch of the palettes, with where it sits. */
function storedColors(spec: DesignSpec): Array<readonly [string, Oklch]> {
  const found: Array<readonly [string, Oklch]> = [];
  for (const [name, palette] of Object.entries(spec.color.palettes)) {
    for (const mode of MODES) {
      for (const entry of palette[mode]) found.push([`${name}.${mode}.${entry.step}`, entry.oklch]);
    }
  }
  return found;
}

/** I-04: an achromatic color has h null, and every other h is finite and in [0, 360). */
function expectHues(spec: DesignSpec): void {
  for (const [where, color] of storedColors(spec)) {
    if (color.c <= 4e-6) expect(color.h, where).toBeNull();
    else {
      expect(color.h, where).not.toBeNull();
      expect(color.h as number, where).toBeGreaterThanOrEqual(0);
      expect(color.h as number, where).toBeLessThan(360);
    }
  }
  for (const palette of Object.values(spec.color.palettes)) {
    expect(palette.hue).toBeGreaterThanOrEqual(0);
    expect(palette.hue).toBeLessThan(360);
  }
}

describe("generateSystem", () => {
  it("C-GEN-01 gives the same canonical spec twice", () => {
    const again = generateSystem(DEFAULT_PARAMS, "seed-1");
    expect(canonicalize(again)).toBe(canonicalize(defaultSpec()));
    expect(again).toEqual(defaultSpec());
  });

  it("C-GEN-01 does not depend on what ran before it (no state leaks between calls)", () => {
    const first = canonicalize(generateSystem(RICH_PARAMS, "order"));
    generateSystem({ ...DEFAULT_PARAMS, neutralTint: "warm", gamut: "p3" }, "other");
    generateSystem(grayParams(), "third");
    expect(canonicalize(generateSystem(RICH_PARAMS, "order"))).toBe(first);
  });

  it("C-GEN-02 gives different specs for seed-1 and seed-2 when no color is passed", () => {
    const one = defaultSpec();
    const two = generateSystem(DEFAULT_PARAMS, "seed-2");
    expect(one.color.palettes.primary.hue).toBe(289);
    expect(two.color.palettes.primary.hue).toBe(69);
    expect(canonicalize(two)).not.toBe(canonicalize(one));
  });

  it("C-GEN-03 gives the same color section for seed-1 and seed-2 when primary is passed", () => {
    const params = { ...DEFAULT_PARAMS, primary: parseColor("#f66c6d") };
    const one = generateSystem(params, "seed-1");
    const two = generateSystem(params, "seed-2");
    expect(two.color.palettes.primary).toEqual(one.color.palettes.primary);
    expect(two.color).toEqual(one.color);
    expect({ ...two, meta: { ...two.meta, seed: "seed-1" } }).toEqual(one);
    expect(two.meta.seed).toBe("seed-2");
    expect(specId(two)).not.toBe(specId(one));
  });

  it(
    "C-GEN-04 and C-GEN-05 store no NaN or Infinity and always pass the schema",
    () => {
      fc.assert(
        fc.property(anyDirection, anySeedText, (params, seed) => {
          const spec = generateSystem(params, seed);
          expectAllFinite(spec);
          expectHues(spec);
          const parsed = DesignSpecSchema.safeParse(spec);
          expect(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues)).toBe(
            true,
          );
        }),
        { numRuns: 200 },
      );
    },
    PROPERTY_TIMEOUT,
  );

  it("C-GEN-06 fills meta from the parameters and the seed", () => {
    expect(defaultSpec().meta).toEqual({
      name: "untitled",
      seed: "seed-1",
      engineVersion: "dyelot.engine/1",
      createdWith: "controls",
    });
    expect(ENGINE_VERSION).toBe("dyelot.engine/1");
    expect(richSpec().meta.name).toBe("Rich fixture");
    expect(defaultSpec().version).toBe("dyelot.spec/1");
  });

  it("C-GEN-07 wires the tokens, rounded, and records the choices", () => {
    const spec = defaultSpec();
    expect(spec.type.context).toBe("product");
    expect("ratio" in spec.type).toBe(false);
    expect(spec.type.steps).toEqual(rounded(typeScale({ context: "product" })));
    expect(spec.space).toEqual({ basePx: 4, scale: spaceScale(4) });
    expect(spec.shape).toEqual({ radiusSet: "soft", radii: radiusScale("soft") });
    const neutral950 = spec.color.palettes.neutral.light[10].oklch;
    expect(spec.depth).toEqual({ style: "soft", shadows: rounded(shadows(neutral950)) });
    expect(spec.motion).toEqual({ feel: "brisk", ...motionTokens() });

    const rich = richSpec();
    expect(rich.type.ratio).toBe(1.25);
    expect(rich.type.steps).toEqual(rounded(typeScale({ context: "marketing", ratio: 1.25 })));
    expect(rich.type.steps[9].clamp).toBeDefined();
    for (const radius of ["sharp", "round"] as const) {
      for (const depth of ["flat", "layered"] as const) {
        for (const motion of ["calm", "playful"] as const) {
          const spec2 = generateSystem({ ...DEFAULT_PARAMS, radius, depth, motion }, "seed-1");
          expect(spec2.shape).toEqual({ radiusSet: radius, radii: radiusScale(radius) });
          expect(spec2.depth.style).toBe(depth);
          expect(spec2.motion.feel).toBe(motion);
          // R-18: the full token sets whatever depth and motion say.
          expect(spec2.depth.shadows).toEqual(spec.depth.shadows);
        }
      }
    }
  });

  it("C-GEN-07 rounds a ratio before use, so the stored ratio and the steps agree", () => {
    const spec = generateSystem(
      { ...DEFAULT_PARAMS, type: { context: "dense", ratio: 1.2345678 } },
      "s",
    );
    expect(spec.type.ratio).toBe(1.23457);
    expect(spec.type.steps).toEqual(rounded(typeScale({ context: "dense", ratio: 1.23457 })));
    // The boundary: 1.000005 rounds up to 1.00001 and is kept; anything below rounds to 1.
    const edge = { ...DEFAULT_PARAMS, type: { context: "product" as const, ratio: 1.000005 } };
    expect(generateSystem(edge, "s").type.ratio).toBe(1.00001);
    const below = { ...edge, type: { context: "product" as const, ratio: 1.0000049999 } };
    expect(() => generateSystem(below, "s")).toThrow(RangeError);
    expect(() => generateSystem(below, "s")).toThrow("type.ratio");
  });

  it("C-GEN-08 wires the color: normalized params, palettes, charts and roles", () => {
    const params: DirectionParams = {
      ...DEFAULT_PARAMS,
      contrastLevel: "AA+",
      primary: { l: 0.7002508346689501, c: 0.17, h: 359.99999999999994 },
      accent: parseColor("#0000ff"),
    };
    const spec = generateSystem(params, "wiring");
    const palettes = buildPalettes(colorPart(params), seededRandom("wiring"));
    expect(spec.color.params).toEqual({
      ...colorPart(params),
      primary: { l: 0.700251, c: 0.17, h: 0 },
      accent: rounded(parseColor("#0000ff")),
    });
    expect("secondary" in spec.color.params).toBe(false);
    expect(spec.color.palettes).toEqual(palettes);
    for (const mode of MODES) {
      const chart = pickChartColors(palettes, mode, params.gamut);
      expect(spec.color.roles[mode]).toEqual(resolveRoles(palettes, mode, "AA+", chart));
    }
    // A rounded seed that leaves the gamut still counts as passed in gamut (R-10, C-PAL-20).
    expect("seedDeviation" in spec.color.palettes.accent).toBe(false);
  });

  it("C-GEN-08 leaves color.params without seeds when none are passed", () => {
    expect(defaultSpec().color.params).toEqual(colorPart(DEFAULT_PARAMS));
  });

  it("C-PAL-19 stores a seed's chroma after rounding, and its hue as null", () => {
    const spec = generateSystem(
      { ...DEFAULT_PARAMS, primary: { l: 0.6, c: 0.0000040000004, h: 120 } },
      "seed-1",
    );
    expect(spec.color.params.primary).toEqual({ l: 0.6, c: 4e-6, h: null });
    expect(spec.color.palettes.primary.peakChroma).toBe(0);
    expect(spec.color.palettes.primary.hue).toBe(0);
  });

  it("C-GEN-09 gives achromatic steps with h null for a gray primary and tint none", () => {
    const spec = graySpec();
    for (const name of ["neutral", "primary"] as const) {
      for (const mode of MODES) {
        for (const entry of spec.color.palettes[name][mode]) {
          // The solved steps have chroma 0; the gray seed keeps its own chroma, below 4e-6.
          expect(entry.oklch.c, `${name} ${mode} ${entry.step}`).toBeLessThanOrEqual(4e-6);
          expect(entry.oklch.h).toBeNull();
        }
      }
    }
    expect(spec.color.palettes.neutral.light.every((entry) => entry.oklch.c === 0)).toBe(true);
    expect(spec.color.params.primary?.h).toBeNull();
    expect(spec.color.params.primary?.l).toBe(0.599871);
    expectAllFinite(spec);
    expectHues(spec);
  });

  it("C-GEN-10 throws RangeError naming the field for an out-of-range parameter", () => {
    const cases: ReadonlyArray<readonly [string, Record<string, unknown>, string?]> = [
      ["harmony", { harmony: "pentadic" }],
      ["chroma", { chroma: "loud" }],
      ["neutralTint", { neutralTint: "pink" }],
      ["gamut", { gamut: "rec2020" }],
      ["scaleMode", { scaleMode: "odd" }],
      ["contrastLevel", { contrastLevel: "A" }],
      ["type.context", { type: { context: "billboard" } }],
      ["type.ratio", { type: { context: "product", ratio: 1 } }],
      ["type.ratio", { type: { context: "product", ratio: 0.9 } }],
      ["type.ratio", { type: { context: "product", ratio: 2.01 } }],
      ["type.ratio", { type: { context: "product", ratio: Number.NaN } }],
      ["type.ratio", { type: { context: "product", ratio: Number.POSITIVE_INFINITY } }],
      ["type.ratio", { type: { context: "product", ratio: 1.000001 } }],
      ["radius", { radius: "pill" }],
      ["depth", { depth: "deep" }],
      ["motion", { motion: "frantic" }],
      ["name", { name: "" }],
      ["name", { name: "n".repeat(81) }],
      ["primary.l", { primary: { l: 1.5, c: 0.1, h: 20 } }],
      ["secondary.c", { secondary: { l: 0.5, c: 0.6, h: 20 } }],
      ["accent.h", { accent: { l: 0.5, c: 0.1, h: 360 } }],
      ["primary.h", { primary: { l: 0.5, c: 0.1, h: Number.NaN } }],
    ];
    for (const [field, override] of cases) {
      const params = { ...DEFAULT_PARAMS, ...override } as DirectionParams;
      expect(() => generateSystem(params, "seed-1"), field).toThrow(RangeError);
      expect(() => generateSystem(params, "seed-1"), field).toThrow(field);
    }
    for (const seed of ["", "s".repeat(129)]) {
      expect(() => generateSystem(DEFAULT_PARAMS, seed)).toThrow(RangeError);
      expect(() => generateSystem(DEFAULT_PARAMS, seed)).toThrow("seed");
    }
    expect(
      generateSystem({ ...DEFAULT_PARAMS, name: "n".repeat(80) }, "s".repeat(128)).meta.name,
    ).toHaveLength(80);
  });

  it("C-GEN-10 throws TypeError naming the field for a value of the wrong type", () => {
    const cases: ReadonlyArray<readonly [string, unknown]> = [
      ["harmony", { ...DEFAULT_PARAMS, harmony: 3 }],
      ["gamut", { ...DEFAULT_PARAMS, gamut: null }],
      ["type", { ...DEFAULT_PARAMS, type: "product" }],
      ["type.ratio", { ...DEFAULT_PARAMS, type: { context: "product", ratio: "1.2" } }],
      ["name", { ...DEFAULT_PARAMS, name: 7 }],
      ["primary", { ...DEFAULT_PARAMS, primary: "#ff0000" }],
      ["params", null],
      ["params", "analogous"],
    ];
    for (const [field, params] of cases) {
      expect(() => generateSystem(params as DirectionParams, "seed-1"), field).toThrow(TypeError);
      expect(() => generateSystem(params as DirectionParams, "seed-1"), field).toThrow(field);
    }
    expect(() => generateSystem(DEFAULT_PARAMS, 42 as unknown as string)).toThrow(TypeError);
  });

  it("reads params.type once, so a getter cannot change it between the check and the build", () => {
    let reads = 0;
    const params = { ...DEFAULT_PARAMS };
    Object.defineProperty(params, "type", {
      enumerable: true,
      get: () => {
        reads += 1;
        // The first read is valid; any later read would hand back a context the check never saw.
        return reads === 1 ? { context: "product" } : { context: "huge" };
      },
    });
    const spec = generateSystem(params, "seed-1");
    expect(reads).toBe(1);
    expect(spec.type.context).toBe("product");
  });

  it("C-GEN-11 accepts a deep-frozen params object and does not mutate it", () => {
    const params = deepFreeze(structuredClone(RICH_PARAMS));
    const before = structuredClone(params);
    expect(generateSystem(params, "seed-1")).toEqual(richSpec());
    expect(params).toEqual(before);
  });

  it("C-GEN-12 stores every hue below 360 for a primary hue that rounds to 360", () => {
    const params = { ...DEFAULT_PARAMS, primary: parseColor("oklch(0.7 0.17 359.99999999999994)") };
    const spec = generateSystem(params, "seed-1");
    expect(DesignSpecSchema.safeParse(spec).success).toBe(true);
    expect(spec.color.params.primary?.h).toBe(0);
    expect(spec.color.palettes.primary.hue).toBe(0);
    expectHues(spec);
  });

  it("returns a spec whose canonical form is itself (R-02, C-CANON-07)", () => {
    for (const spec of [defaultSpec(), richSpec(), graySpec()]) {
      expect(JSON.parse(canonicalize(spec))).toEqual(spec);
    }
  });
});
