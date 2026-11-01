import { describe, expect, it } from "vitest";
import { generateSystem } from "@/engine/generate";
import { lintSpec } from "@/engine/lint";
import { applyPreset, type PresetId } from "@/engine/presets";
import { DEFAULT_PARAMS, PROPERTY_TIMEOUT } from "../spec/support";

// Shared by the presets-lint-*.test.ts files. C-PRESET-04 and C-PRESET-12 measure 50 seeds per
// preset; the presets are split over several files so Vitest runs the generation in parallel.
// Each preset's 50 findings are generated once, in this file's memo, and shared by both cases.

const SEEDS = Array.from({ length: 50 }, (_, i) => `s${i}`);

/** The five groups of presets-lint-{1..5}.test.ts; presets.test.ts asserts they cover `PRESET_IDS`. */
export const PRESET_LINT_GROUPS: readonly (readonly PresetId[])[] = [
  ["default", "minimal-swiss", "editorial"],
  ["neo-brutalism", "glass", "dark-dev-tool"],
  ["bento", "aurora", "retro-futurism"],
  ["tactile", "maximalism", "organic"],
  ["dithering-pixel", "m3-expressive"],
];

export function describePresetLint(ids: readonly PresetId[]): void {
  const memo = new Map<PresetId, ReturnType<typeof lintSpec>[]>();
  const findingsOf = (id: PresetId): ReturnType<typeof lintSpec>[] => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const params = applyPreset(DEFAULT_PARAMS, id);
    const all = SEEDS.map((seed) => lintSpec(generateSystem(params, seed)));
    memo.set(id, all);
    return all;
  };

  describe.each(ids)("preset %s over 50 seeds", (id) => {
    it(
      "C-PRESET-03 and C-PRESET-04 generate and raise no lint error",
      () => {
        for (const findings of findingsOf(id)) {
          expect(findings.filter((f) => f.severity === "error")).toEqual([]);
        }
      },
      PROPERTY_TIMEOUT,
    );

    it(
      "C-PRESET-12 raises no T1, T3 or T4",
      () => {
        for (const findings of findingsOf(id)) {
          expect(findings.filter((f) => ["T1", "T3", "T4"].includes(f.id))).toEqual([]);
        }
      },
      PROPERTY_TIMEOUT,
    );
  });
}
