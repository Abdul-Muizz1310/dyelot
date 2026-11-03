import { describe, expect, it } from "vitest";
import { generateSystem } from "@/engine/generate";
import { lintSpec } from "@/engine/lint";
import { DEFAULT_PARAMS, PROPERTY_TIMEOUT } from "../../spec/support";

/**
 * C-TASTE-13: `generateSystem(DEFAULT_PARAMS, "s" + i)` raises no T3 for i in [from, to). The 300
 * seeds are split over three files (t3-defaults-*.test.ts) so Vitest runs them in parallel.
 */
export function describeT3Defaults(from: number, to: number): void {
  describe("T3 on default designs", () => {
    it(
      `C-TASTE-13 raises nothing for s${from} to s${to - 1}`,
      () => {
        for (let i = from; i < to; i++) {
          const found = lintSpec(generateSystem(DEFAULT_PARAMS, `s${i}`)).filter(
            (f) => f.id === "T3",
          );
          expect(found, `s${i}`).toEqual([]);
        }
      },
      PROPERTY_TIMEOUT,
    );
  });
}
