import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CONTRAST_CHECKS, hexToRgb, lintSpec, measureSpec, ROLE_NAMES, wcagRatio } from "@/engine";
import type { DesignSpec } from "@/spec";
import { PRESET_GOLDENS, SPEC } from "./measure-support";

// C-MEAS-02 (docs/specs/03-export.md, ruling R3-08): the measurements and the linter's seven
// WCAG rules agree on every design, because they read one table.

const GOLDENS: readonly DesignSpec[] = [...PRESET_GOLDENS.map((g) => g.spec), SPEC];
const RULES = ["C1", "C2", "C5", "N1", "N2", "N3", "F1"];
const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, "0")}`);

describe("measureSpec against lintSpec", () => {
  it("C-MEAS-02 agrees with the linter on random role overlays", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: GOLDENS.length - 1 }),
        fc.constantFrom("light", "dark"),
        fc.array(fc.tuple(fc.constantFrom(...ROLE_NAMES), hex), { minLength: 1, maxLength: 5 }),
        (index, mode, overlay) => {
          const base = GOLDENS[index] as DesignSpec;
          const roles = { ...base.color.roles[mode], ...Object.fromEntries(overlay) };
          const spec = {
            ...base,
            color: { ...base.color, roles: { ...base.color.roles, [mode]: roles } },
          } as DesignSpec;
          const failing: string[] = [];
          for (const entry of measureSpec(spec).contrast) {
            const check = CONTRAST_CHECKS.find((c) => c.id === entry.check);
            if (check === undefined) throw new Error(entry.check);
            const set = spec.color.roles[entry.mode];
            const ratio = wcagRatio(
              hexToRgb(set[check.foreground]),
              hexToRgb(set[check.background]),
            );
            expect(entry.ratio).toBe(ratio);
            expect(entry.pass).toBe(ratio >= check.threshold);
            if (!entry.pass) {
              failing.push(
                JSON.stringify([
                  check.rule,
                  entry.mode,
                  `${check.foreground}/${check.background}`,
                  ratio,
                  check.threshold,
                  check.rule === "N3" ? "info" : "error",
                ]),
              );
            }
          }
          const found = lintSpec(spec)
            .filter((f) => RULES.includes(f.id))
            .map((f) =>
              JSON.stringify([f.id, f.mode, f.subject, f.measured, f.threshold, f.severity]),
            );
          expect(found.sort()).toEqual(failing.sort());
        },
      ),
      { numRuns: 200, seed: 3003 },
    );
  });
});
