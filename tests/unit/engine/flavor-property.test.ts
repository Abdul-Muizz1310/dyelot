import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FLAVOR_STEPS, flavorStops } from "@/engine/flavor";
import { generateSystem } from "@/engine/generate";
import { anyDirection, anySeedText, MODES, PROPERTY_TIMEOUT } from "../spec/support";

// C-STOPS-02 of docs/specs/05-motion-3d.md, section 14.3 (R5-16, I-M5-01): a property over generated
// designs, in a file of its own so flavor.test.ts stays in the fast set.

describe("flavorStops over generated designs", () => {
  it(
    "C-STOPS-02 gives five step hexes of the mode, at FLAVOR_STEPS, for any design and both modes",
    () => {
      fc.assert(
        fc.property(anyDirection, anySeedText, (params, seed) => {
          const spec = generateSystem(params, seed);
          for (const mode of MODES) {
            const stops = flavorStops(spec, mode);
            const hexes = new Set(
              Object.values(spec.color.palettes).flatMap((palette) =>
                palette[mode].map((entry) => entry.hex),
              ),
            );
            expect(stops).toHaveLength(5);
            stops.forEach((stop, index) => {
              expect(hexes.has(stop), `${mode} stop ${index}`).toBe(true);
              const [palette, step] = FLAVOR_STEPS[index];
              const entry = spec.color.palettes[palette][mode].find((item) => item.step === step);
              expect(stop, `${mode} stop ${index}`).toBe(entry?.hex);
            });
          }
        }),
        { numRuns: 100, seed: 5003 },
      );
    },
    PROPERTY_TIMEOUT,
  );
});
