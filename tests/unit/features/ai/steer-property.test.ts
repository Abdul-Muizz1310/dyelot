import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CHROMA_LEVELS,
  DEPTH_STYLES,
  type Density,
  generateSystem,
  RADIUS_SET_NAMES,
  TYPE_CONTEXTS,
  type TypeContext,
} from "@/engine";
import {
  CHIPS,
  type ChipContext,
  chipChange,
  chipsChange,
  RATIO_LADDER,
} from "@/features/ai/steer";
import { mergeParams } from "@/features/studio/params";
import { DEFAULT_PARAMS, PROPERTY_TIMEOUT } from "../../spec/support";

// C-CHIP-09 of docs/specs/04-ai.md, section 14.5, apart from steer.test.ts: 300 generations are
// slow (the slow set of R2-31), and the file's other cases stay in the fast gate.

const hue = fc.option(fc.integer({ min: 0, max: 359 }), { nil: null });
const params = fc.record({
  chroma: fc.constantFrom(...CHROMA_LEVELS),
  radius: fc.constantFrom(...RADIUS_SET_NAMES),
  depth: fc.constantFrom(...DEPTH_STYLES),
  neutralTint: fc.constantFrom("none", "warm", "cool", "brand"),
  context: fc.constantFrom(...TYPE_CONTEXTS),
  ratio: fc.option(fc.constantFrom(...RATIO_LADDER, 1.1, 1.7, 2), { nil: undefined }),
});
const contexts = fc.record({
  p: params,
  density: fc.constantFrom<Density>("dense", "compact", "comfortable"),
  l: fc.integer({ min: 20, max: 90 }).map((v) => v / 100),
  h: hue,
});

function contextOf(v: {
  p: {
    chroma: (typeof CHROMA_LEVELS)[number];
    radius: (typeof RADIUS_SET_NAMES)[number];
    depth: (typeof DEPTH_STYLES)[number];
    neutralTint: "none" | "warm" | "cool" | "brand";
    context: TypeContext;
    ratio: number | undefined;
  };
  density: Density;
  l: number;
  h: number | null;
}): ChipContext {
  const { p } = v;
  return {
    params: {
      ...DEFAULT_PARAMS,
      chroma: p.chroma,
      radius: p.radius,
      depth: p.depth,
      neutralTint: p.neutralTint,
      type: p.ratio === undefined ? { context: p.context } : { context: p.context, ratio: p.ratio },
    },
    density: v.density,
    primary: { l: v.l, c: v.h === null ? 0 : 0.12, h: v.h },
  };
}

describe("C-CHIP-09 the chips over random parameters", () => {
  it(
    "C-CHIP-09 every enabled patch generates, and softer then sharper, bolder then quieter restore",
    () => {
      fc.assert(
        fc.property(contexts, fc.constantFrom(...CHIPS), (value, chip) => {
          const context = contextOf(value);
          const outcome = chipChange(chip, context);
          if (outcome.enabled) {
            const merged = mergeParams(context.params, outcome.patch);
            expect(() =>
              generateSystem({ ...merged, pairing: "host-grotesk" }, "seed-1"),
            ).not.toThrow();
          } else {
            expect(outcome.reason.length).toBeGreaterThan(0);
          }
          const { radius, depth, chroma } = context.params;
          if (radius !== "sharp" && radius !== "round" && depth !== "flat" && depth !== "layered") {
            const up = chipsChange(["softer", "sharper"], context);
            const merged = mergeParams(context.params, up.patch);
            expect(merged.radius).toBe(radius);
            expect(merged.depth).toBe(depth);
          }
          if (chroma === "balanced") {
            const merged = mergeParams(
              context.params,
              chipsChange(["bolder", "quieter"], context).patch,
            );
            expect(merged.chroma).toBe("balanced");
          }
        }),
        { numRuns: 300, seed: 4005 },
      );
    },
    PROPERTY_TIMEOUT,
  );
});
