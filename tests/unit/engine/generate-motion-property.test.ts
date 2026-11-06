import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { generateSystem, withMotion } from "@/engine/generate";
import { applyPreset, PRESET_IDS } from "@/engine/presets";
import type { MotionTokens } from "@/engine/tokens/motion";
import { springCurve } from "@/engine/tokens/spring";
import { motionFiles } from "@/export/motion";
import { specId } from "@/spec/hash";
import { themeVars } from "@/theme/vars";
import { DEFAULT_PARAMS, PROPERTY_TIMEOUT } from "../spec/support";
import { tokensArb } from "../support/motion";

// Cases C-MOT5-08 and C-MOT5-RF5 of docs/specs/05-motion-3d.md, section 14.2 (R5-09, R5-11).
// Seed 5000 + 2, the task's own.

describe("motion tokens as a parameter, over any tokens", () => {
  it(
    "C-MOT5-08 withMotion on a generated spec equals generating with the tokens",
    () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...PRESET_IDS),
          fc.string({ minLength: 1, maxLength: 20 }),
          tokensArb,
          (id, seed, tokens) => {
            const params = applyPreset(DEFAULT_PARAMS, id);
            const viaWith = withMotion(generateSystem(params, seed), tokens);
            const direct = generateSystem({ ...params, motionTokens: tokens }, seed);
            expect(viaWith).toEqual(direct);
            expect(specId(viaWith)).toBe(specId(direct));
          },
        ),
        { numRuns: 100, seed: 5002 },
      );
    },
    PROPERTY_TIMEOUT,
  );

  const edgeNumber = (low: number, high: number) => fc.constantFrom(low, high);
  const edgeEasing = fc.tuple(
    edgeNumber(0, 1),
    edgeNumber(-2, 3),
    edgeNumber(0, 1),
    edgeNumber(-2, 3),
  );
  const edgeSpring = fc.record({
    visualDuration: edgeNumber(0.01, 5),
    bounce: edgeNumber(0, 1),
  });
  const edgeDuration = edgeNumber(0, 2000);
  const edgeTokens: fc.Arbitrary<MotionTokens> = fc.record({
    durations: fc.record({
      instant: edgeDuration,
      fast: edgeDuration,
      quick: edgeDuration,
      base: edgeDuration,
      slow: edgeDuration,
      slower: edgeDuration,
      slowest: edgeDuration,
    }),
    easings: fc.record({
      standard: edgeEasing,
      decelerate: edgeEasing,
      accelerate: edgeEasing,
      emphasized: edgeEasing,
    }),
    springs: fc.record({ snappy: edgeSpring, smooth: edgeSpring, bouncy: edgeSpring }),
  });

  it(
    "C-MOT5-RF5 keeps every consumer working at the tokens' edges",
    () => {
      const params = applyPreset(DEFAULT_PARAMS, "editorial");
      const base = generateSystem(params, "seed-1");
      fc.assert(
        fc.property(fc.oneof(edgeTokens, tokensArb), (tokens) => {
          const spec = withMotion(base, tokens);
          expect(generateSystem({ ...params, motionTokens: tokens }, "seed-1")).toEqual(spec);
          for (const mode of ["light", "dark"] as const)
            expect(() => themeVars(spec, mode)).not.toThrow();
          for (const name of ["snappy", "smooth", "bouncy"] as const) {
            expect(() => springCurve(spec.motion.springs[name])).not.toThrow();
          }
          const css = motionFiles(spec, "x", "0123·4567", "https://example.test").find(
            (file) => file.path === "motion/motion.css",
          );
          const text = String(css?.text);
          const [root = "", reduced = ""] = text.split("@media");
          expect(root.match(/--spring-\w+: linear\(/g)).toHaveLength(3);
          expect(reduced.match(/linear\(0, 1\)/g)).toHaveLength(3);
        }),
        { numRuns: 300, seed: 5002 },
      );
    },
    PROPERTY_TIMEOUT,
  );
});
