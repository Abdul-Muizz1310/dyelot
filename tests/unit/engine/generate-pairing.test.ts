import { describe, expect, it } from "vitest";
import { PAIRING_IDS, PAIRINGS } from "@/engine/fonts/pairings";
import { generateSystem } from "@/engine/generate";
import { specId } from "@/spec/hash";
import type { DirectionParams } from "@/spec/schema";
import { DEFAULT_PARAMS, defaultSpec, PROPERTY_TIMEOUT } from "../spec/support";

// Cases are the C-PAIR-04 to C-PAIR-07 rows of docs/specs/02-studio.md, section 6.2 (Task 2.4):
// the generator's `pairing` parameter (R2-05).

const GOLDEN_ID = "f99eeb55e29ded65";

describe("generateSystem pairing", () => {
  it("C-PAIR-04 writes the M1 families without a pairing, and the golden id holds", () => {
    const spec = generateSystem(DEFAULT_PARAMS, "seed-1");
    expect(spec.type.families).toEqual({
      display: "host-grotesk",
      body: "host-grotesk",
      mono: "fragment-mono",
    });
    expect(specId(spec)).toBe(GOLDEN_ID);
    expect(specId(generateSystem({ ...DEFAULT_PARAMS, pairing: undefined }, "seed-1"))).toBe(
      GOLDEN_ID,
    );
  });

  it("C-PAIR-05 writes the pairing's three families and changes nothing else", () => {
    const spec = generateSystem({ ...DEFAULT_PARAMS, pairing: "gloock-albert" }, "seed-1");
    expect(spec.type.families).toEqual({
      display: "gloock",
      body: "albert-sans",
      mono: "fragment-mono",
    });
    const base = defaultSpec();
    expect({ ...spec, type: { ...spec.type, families: base.type.families } }).toEqual(base);
  });

  it(
    "C-PAIR-06 leaves colors unchanged for every pairing",
    () => {
      const base = generateSystem(DEFAULT_PARAMS, "seed-1").color;
      for (const id of PAIRING_IDS) {
        expect(generateSystem({ ...DEFAULT_PARAMS, pairing: id }, "seed-1").color).toEqual(base);
      }
    },
    PROPERTY_TIMEOUT,
  );

  it(
    "C-PAIR-06 writes each pairing's own families",
    () => {
      for (const pairing of PAIRINGS) {
        const params = { ...DEFAULT_PARAMS, pairing: pairing.id };
        expect(generateSystem(params, "seed-1").type.families).toEqual({
          display: pairing.display,
          body: pairing.body,
          mono: pairing.mono,
        });
      }
    },
    PROPERTY_TIMEOUT,
  );

  it("C-PAIR-07 throws RangeError for an unknown pairing and TypeError for a non-string", () => {
    const unknown = { ...DEFAULT_PARAMS, pairing: "nope" } satisfies DirectionParams;
    expect(() => generateSystem(unknown, "seed-1")).toThrow(RangeError);
    expect(() => generateSystem(unknown, "seed-1")).toThrow(/generateSystem: params\.pairing/);
    const wrong = { ...DEFAULT_PARAMS, pairing: 3 } as unknown as DirectionParams;
    expect(() => generateSystem(wrong, "seed-1")).toThrow(TypeError);
    expect(() => generateSystem(wrong, "seed-1")).toThrow(/generateSystem: params\.pairing/);
  });
});
