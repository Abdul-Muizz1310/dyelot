import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseColor } from "@/engine/color/parse";
import { generateSystem } from "@/engine/generate";
import type { DirectionParams } from "@/spec/schema";
import {
  anySeedText,
  DEFAULT_PARAMS,
  EDGE_SEEDS,
  edgeDirection,
  PROPERTY_TIMEOUT,
  paramsOf,
} from "../spec/support";

// C-GEN-13 of docs/specs/01-color-engine.md, section 6.7: regenerating from what a spec records
// gives the identical spec. It sits apart from generate.test.ts so the two long properties run
// in parallel.

describe("generateSystem: regenerating", () => {
  it("C-GEN-13 regenerates the identical spec from what it records, for each edge seed", () => {
    for (const hex of EDGE_SEEDS.slice(0, 3)) {
      const seed = parseColor(hex);
      const cases: ReadonlyArray<readonly ["primary" | "accent", DirectionParams]> = [
        ["primary", { ...DEFAULT_PARAMS, primary: seed }],
        ["accent", { ...DEFAULT_PARAMS, accent: seed, name: "accent" }],
      ];
      for (const [slot, params] of cases) {
        const spec = generateSystem(params, "edge");
        // R-10: round6 leaves the stored seed under 2e-4 outside the gamut, so it is not mapped.
        expect("seedDeviation" in spec.color.palettes[slot], `${hex} ${slot}`).toBe(false);
        expect(generateSystem(paramsOf(spec), spec.meta.seed), `${hex} ${slot}`).toEqual(spec);
      }
    }
  });

  it(
    "C-GEN-13 regenerates the identical spec from what it records, for any parameters",
    () => {
      fc.assert(
        fc.property(edgeDirection, anySeedText, (params, seed) => {
          const spec = generateSystem(params, seed);
          expect(generateSystem(paramsOf(spec), spec.meta.seed)).toEqual(spec);
        }),
        { numRuns: 50 },
      );
    },
    PROPERTY_TIMEOUT,
  );
});
