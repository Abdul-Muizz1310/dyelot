import { describe, expect, it } from "vitest";
import { FLAVOR_STEPS, flavorSeed, flavorStops } from "@/engine/flavor";
import { specId } from "@/spec/hash";
import type { DesignSpec } from "@/spec/schema";
import { defaultSpec } from "../spec/support";

// C-STOPS-01 and C-STOPS-03 to 05 of docs/specs/05-motion-3d.md, section 14.3 (R5-16). C-STOPS-02,
// the property over generated designs, lives in flavor-property.test.ts.

const SPEC = defaultSpec();

/** The hex of one step of one palette in one mode, read from the spec by its step number. */
function hexAt(
  spec: DesignSpec,
  palette: "neutral" | "primary" | "secondary" | "accent",
  mode: "light" | "dark",
  step: number,
): string {
  const found = spec.color.palettes[palette][mode].find((entry) => entry.step === step);
  if (found === undefined) throw new Error(`no step ${step} in ${palette}.${mode}`);
  return found.hex;
}

/** A copy of the spec whose primary light scale has no step 200. */
function withoutPrimary200(): DesignSpec {
  const copy = structuredClone(SPEC) as unknown as {
    color: { palettes: { primary: { light: { step: number }[] } } };
  };
  copy.color.palettes.primary.light = copy.color.palettes.primary.light.filter(
    (entry) => entry.step !== 200,
  );
  return copy as unknown as DesignSpec;
}

describe("flavorStops", () => {
  it("C-STOPS-01 reads neutral 100, primary 200, secondary 400, accent 400 and primary 500 of each mode", () => {
    for (const mode of ["light", "dark"] as const) {
      expect(flavorStops(SPEC, mode), mode).toEqual([
        hexAt(SPEC, "neutral", mode, 100),
        hexAt(SPEC, "primary", mode, 200),
        hexAt(SPEC, "secondary", mode, 400),
        hexAt(SPEC, "accent", mode, 400),
        hexAt(SPEC, "primary", mode, 500),
      ]);
    }
    expect(flavorStops(SPEC, "light")).not.toEqual(flavorStops(SPEC, "dark"));
  });

  it("C-STOPS-01 lists FLAVOR_STEPS in that order, frozen with every pair", () => {
    expect(FLAVOR_STEPS).toEqual([
      ["neutral", 100],
      ["primary", 200],
      ["secondary", 400],
      ["accent", 400],
      ["primary", 500],
    ]);
    expect(Object.isFrozen(FLAVOR_STEPS)).toBe(true);
    for (const pair of FLAVOR_STEPS) expect(Object.isFrozen(pair)).toBe(true);
  });

  it("C-STOPS-03 throws TypeError for a spec that is not an object and a mode that is not a string", () => {
    expect(() => flavorStops(null as never, "light")).toThrow(TypeError);
    expect(() => flavorStops(null as never, "light")).toThrow(/^flavorStops: spec /);
    expect(() => flavorStops(SPEC, 1 as never)).toThrow(TypeError);
    expect(() => flavorStops(SPEC, 1 as never)).toThrow(/^flavorStops: mode /);
  });

  it("C-STOPS-03 throws RangeError for a mode other than light or dark", () => {
    expect(() => flavorStops(SPEC, "dim" as never)).toThrow(RangeError);
    expect(() => flavorStops(SPEC, "dim" as never)).toThrow(/^flavorStops: mode /);
  });

  it("C-STOPS-03 throws TypeError naming the scale that lacks a step", () => {
    const spec = withoutPrimary200();
    expect(() => flavorStops(spec, "light")).toThrow(TypeError);
    expect(() => flavorStops(spec, "light")).toThrow(
      /^flavorStops: spec\.color\.palettes\.primary\.light /,
    );
  });

  it("C-STOPS-03 checks the sections it reads as paramsOfSpec does, types first", () => {
    const noColor = { ...SPEC, color: null } as unknown as DesignSpec;
    expect(() => flavorStops(noColor, "light")).toThrow(TypeError);
    expect(() => flavorStops(noColor, "light")).toThrow(/^flavorStops: spec\.color /);
    const noPalettes = { ...SPEC, color: { ...SPEC.color, palettes: [] } } as unknown as DesignSpec;
    expect(() => flavorStops(noPalettes, "light")).toThrow(/^flavorStops: spec\.color\.palettes /);
    const noAccent = {
      ...SPEC,
      color: { ...SPEC.color, palettes: { ...SPEC.color.palettes, accent: 5 } },
    } as unknown as DesignSpec;
    expect(() => flavorStops(noAccent, "dark")).toThrow(TypeError);
    expect(() => flavorStops(noAccent, "dark")).toThrow(
      /^flavorStops: spec\.color\.palettes\.accent /,
    );
    const darkNotList = structuredClone(SPEC) as unknown as {
      color: { palettes: { secondary: { dark: unknown } } };
    };
    darkNotList.color.palettes.secondary.dark = {};
    expect(() => flavorStops(darkNotList as unknown as DesignSpec, "dark")).toThrow(
      /^flavorStops: spec\.color\.palettes\.secondary\.dark /,
    );
    // The scales are part of the spec's type, so a broken one is a TypeError before the mode's domain.
    expect(() => flavorStops(withoutPrimary200(), "dim" as never)).toThrow(TypeError);
  });

  it("C-STOPS-03 throws for a stored hex that is not a #rrggbb string", () => {
    const numberHex = structuredClone(SPEC) as unknown as {
      color: { palettes: { neutral: { light: { step: number; hex: unknown }[] } } };
    };
    numberHex.color.palettes.neutral.light[1].hex = 5;
    expect(() => flavorStops(numberHex as unknown as DesignSpec, "light")).toThrow(TypeError);
    expect(() => flavorStops(numberHex as unknown as DesignSpec, "light")).toThrow(
      /^flavorStops: spec\.color\.palettes\.neutral\.light\[1\]\.hex /,
    );
    const upperHex = structuredClone(SPEC) as unknown as {
      color: { palettes: { primary: { dark: { step: number; hex: unknown }[] } } };
    };
    upperHex.color.palettes.primary.dark[5].hex = "#ABCDEF";
    expect(() => flavorStops(upperHex as unknown as DesignSpec, "dark")).toThrow(RangeError);
    expect(() => flavorStops(upperHex as unknown as DesignSpec, "dark")).toThrow(
      /^flavorStops: spec\.color\.palettes\.primary\.dark\[5\]\.hex /,
    );
  });
});

describe("flavorSeed", () => {
  it("C-STOPS-04 maps each half of the id onto 0 to 100, to 4 decimals", () => {
    expect(flavorSeed("0000000000000000")).toEqual([0, 0]);
    expect(flavorSeed("8000000040000000")).toEqual([50, 25]);
    expect(flavorSeed("ffffffffffffffff")).toEqual([100, 100]);
    expect(flavorSeed("0000000100000002")).toEqual([0, 0]);
    // 0x12345678 / 2^32 = 0.0711111…, 0x90abcdef / 2^32 = 0.5651216…
    expect(flavorSeed("1234567890abcdef")).toEqual([7.1111, 56.5122]);
  });

  it("C-STOPS-04 gives the same seed for the same design", () => {
    const id = specId(SPEC);
    const first = flavorSeed(id);
    expect(flavorSeed(id)).toEqual(first);
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
      expect(Math.round(value * 10_000) / 10_000).toBe(value);
    }
  });

  it("C-STOPS-05 throws TypeError for an id that is not a string", () => {
    expect(() => flavorSeed(5 as never)).toThrow(TypeError);
    expect(() => flavorSeed(5 as never)).toThrow(/^flavorSeed: id /);
  });

  it.each([["abc"], ["4177A34C3648BB5A"], ["4177a34c3648bb5a0"], [""], ["4177a34c3648bb5g"]])(
    "C-STOPS-05 throws RangeError for the id %j",
    (id) => {
      expect(() => flavorSeed(id)).toThrow(RangeError);
      expect(() => flavorSeed(id)).toThrow(/^flavorSeed: id /);
    },
  );
});
