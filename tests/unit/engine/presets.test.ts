import { describe, expect, it } from "vitest";
import { genericness } from "@/engine/fonts/catalog";
import { PAIRING_IDS, PAIRINGS } from "@/engine/fonts/pairings";
import { applyPreset, PRESET_IDS, PRESETS, type PresetId } from "@/engine/presets";
import type { DirectionParams } from "@/spec/schema";
import {
  CHROMAS,
  CONTEXTS,
  DEFAULT_PARAMS,
  DEPTHS,
  FEELS,
  HARMONIES,
  LEVELS,
  RADII,
  SCALE_MODES,
  TINTS,
} from "../spec/support";
import { PRESET_LINT_GROUPS } from "./presets-support";

// Cases are the C-PRESET-nn rows of docs/specs/02-studio.md, section 6.3 (Task 2.4). The table is
// written out from section 5.3, so the tests do not borrow the implementation's values.

type Row = readonly [
  id: string,
  harmony: string,
  chroma: string,
  tint: string,
  contrast: string,
  scale: string,
  context: string,
  radius: string,
  depth: string,
  motion: string,
  pairing: string | undefined,
  mode: string,
  density: string,
];

const TABLE: readonly Row[] = [
  [
    "default",
    "analogous",
    "balanced",
    "brand",
    "AA",
    "standard",
    "product",
    "soft",
    "soft",
    "brisk",
    undefined,
    "light",
    "comfortable",
  ],
  [
    "minimal-swiss",
    "monochrome",
    "muted",
    "none",
    "AA+",
    "standard",
    "product",
    "sharp",
    "flat",
    "brisk",
    "host-grotesk",
    "light",
    "comfortable",
  ],
  [
    "editorial",
    "analogous",
    "muted",
    "warm",
    "AA+",
    "standard",
    "editorial",
    "sharp",
    "flat",
    "calm",
    "schibsted-serif",
    "light",
    "comfortable",
  ],
  [
    "neo-brutalism",
    "triadic",
    "vivid",
    "none",
    "AA+",
    "even",
    "product",
    "sharp",
    "flat",
    "brisk",
    "anybody-albert",
    "light",
    "comfortable",
  ],
  [
    "glass",
    "analogous",
    "balanced",
    "cool",
    "AAA",
    "standard",
    "marketing",
    "round",
    "layered",
    "calm",
    "funnel",
    "light",
    "comfortable",
  ],
  [
    "dark-dev-tool",
    "analogous",
    "balanced",
    "brand",
    "AA+",
    "standard",
    "dense",
    "soft",
    "flat",
    "brisk",
    "hubot-mona",
    "dark",
    "dense",
  ],
  [
    "bento",
    "analogous",
    "balanced",
    "brand",
    "AA",
    "standard",
    "product",
    "round",
    "soft",
    "brisk",
    "commissioner",
    "light",
    "comfortable",
  ],
  [
    "aurora",
    "analogous",
    "vivid",
    "cool",
    "AA+",
    "standard",
    "marketing",
    "round",
    "soft",
    "calm",
    "zalando",
    "light",
    "comfortable",
  ],
  [
    "retro-futurism",
    "split",
    "vivid",
    "cool",
    "AA+",
    "even",
    "marketing",
    "round",
    "layered",
    "playful",
    "unbounded-golos",
    "dark",
    "comfortable",
  ],
  [
    "tactile",
    "analogous",
    "balanced",
    "warm",
    "AA",
    "standard",
    "product",
    "soft",
    "layered",
    "brisk",
    "shoulders-redhat",
    "light",
    "comfortable",
  ],
  [
    "maximalism",
    "tetradic",
    "vivid",
    "none",
    "AA+",
    "even",
    "poster",
    "soft",
    "layered",
    "playful",
    "gloock-albert",
    "light",
    "comfortable",
  ],
  [
    "organic",
    "analogous",
    "muted",
    "warm",
    "AA+",
    "standard",
    "editorial",
    "round",
    "soft",
    "calm",
    "young-onest",
    "light",
    "comfortable",
  ],
  [
    "dithering-pixel",
    "monochrome",
    "balanced",
    "none",
    "AAA",
    "standard",
    "product",
    "sharp",
    "flat",
    "brisk",
    "tiny5-spline",
    "dark",
    "compact",
  ],
  [
    "m3-expressive",
    "analogous",
    "balanced",
    "brand",
    "AA",
    "standard",
    "product",
    "round",
    "soft",
    "playful",
    "google-flex",
    "light",
    "comfortable",
  ],
];

const presetOf = (id: string) => PRESETS[id as PresetId];
const IDS = TABLE.map((row) => row[0]);
const locked = { l: 0.6, c: 0.12, h: 200 };

describe("PRESETS", () => {
  it("C-PRESET-04 the five 50-seed groups cover PRESET_IDS exactly, with no duplicate", () => {
    const union = PRESET_LINT_GROUPS.flat();
    expect(new Set(union).size).toBe(union.length);
    expect([...union].sort()).toEqual([...PRESET_IDS].sort());
  });

  it("C-PRESET-01 lists the 14 ids in the table's order, frozen, as the keys of PRESETS", () => {
    expect([...PRESET_IDS]).toEqual(IDS);
    expect(Object.isFrozen(PRESET_IDS)).toBe(true);
    expect(Object.keys(PRESETS)).toEqual(IDS);
  });

  it.each(TABLE)("C-PRESET-02 %s equals its row of section 5.3", (...row) => {
    const [
      id,
      harmony,
      chroma,
      neutralTint,
      contrastLevel,
      scaleMode,
      context,
      radius,
      depth,
      motion,
      pairing,
      mode,
      density,
    ] = row;
    const preset = presetOf(id as string);
    expect(preset.id).toBe(id);
    expect(preset.params).toEqual({
      harmony,
      chroma,
      neutralTint,
      contrastLevel,
      scaleMode,
      type: { context },
      radius,
      depth,
      motion,
      ...(pairing === undefined ? {} : { pairing }),
    });
    expect(preset.view).toEqual({ mode, density });
  });

  it.each(IDS)("C-PRESET-03 %s is a valid patch", (id) => {
    const { params } = presetOf(id);
    expect(HARMONIES).toContain(params.harmony);
    expect(CHROMAS).toContain(params.chroma);
    expect(TINTS).toContain(params.neutralTint);
    expect(LEVELS).toContain(params.contrastLevel);
    expect(SCALE_MODES).toContain(params.scaleMode);
    expect(CONTEXTS).toContain(params.type.context);
    expect(RADII).toContain(params.radius);
    expect(DEPTHS).toContain(params.depth);
    expect(FEELS).toContain(params.motion);
    if (params.pairing !== undefined) expect(PAIRING_IDS).toContain(params.pairing);
    // generateSystem accepts every preset: presets-lint-*.test.ts generate each one.
  });

  it("C-PRESET-05 keeps locked colors and leaves absent ones absent", () => {
    const withLocks: DirectionParams = {
      ...DEFAULT_PARAMS,
      primary: locked,
      secondary: { l: 0.7, c: 0.1, h: 40 },
      accent: locked,
    };
    for (const id of IDS) {
      const result = applyPreset(withLocks, id as never);
      expect(result.primary).toEqual(locked);
      expect(result.secondary).toEqual({ l: 0.7, c: 0.1, h: 40 });
      expect(result.accent).toEqual(locked);
      expect("secondary" in applyPreset(DEFAULT_PARAMS, id as never)).toBe(false);
      expect("primary" in applyPreset(DEFAULT_PARAMS, id as never)).toBe(false);
    }
  });

  it("C-PRESET-06 keeps name and removes type.ratio", () => {
    const input: DirectionParams = {
      ...DEFAULT_PARAMS,
      name: "Saltmarsh",
      type: { context: "product", ratio: 1.5 },
    };
    for (const id of IDS) {
      const result = applyPreset(input, id as never);
      expect(result.name).toBe("Saltmarsh");
      expect("ratio" in result.type).toBe(false);
    }
  });

  it("C-PRESET-07 leaves pairing absent for default and explicit for the rest", () => {
    const withPairing: DirectionParams = { ...DEFAULT_PARAMS, pairing: "funnel" };
    expect("pairing" in applyPreset(withPairing, "default")).toBe(false);
    for (const id of IDS.filter((x) => x !== "default")) {
      expect(typeof applyPreset(DEFAULT_PARAMS, id as never).pairing).toBe("string");
    }
    expect(applyPreset(DEFAULT_PARAMS, "neo-brutalism").pairing).toBe("anybody-albert");
    expect(applyPreset(DEFAULT_PARAMS, "aurora").pairing).toBe("zalando");
  });

  it("C-PRESET-08 does not mutate, returns a new object and is repeatable", () => {
    const input: DirectionParams = Object.freeze({
      ...DEFAULT_PARAMS,
      type: Object.freeze({ context: "product" as const }),
    });
    for (const id of IDS) {
      const once = applyPreset(input, id as never);
      expect(once).not.toBe(input);
      expect(applyPreset(input, id as never)).toEqual(once);
      expect(applyPreset(once, id as never)).toEqual(once);
    }
    expect(input).toEqual({ ...DEFAULT_PARAMS, type: { context: "product" } });
  });

  it("C-PRESET-09 sets no color, name, ratio or density key in params", () => {
    for (const id of IDS) {
      const { params, view } = presetOf(id);
      for (const key of ["primary", "secondary", "accent", "name", "density"]) {
        expect(key in params).toBe(false);
      }
      expect("ratio" in params.type).toBe(false);
      expect(["comfortable", "compact", "dense"]).toContain(view.density);
    }
  });

  it("C-PRESET-10 has labels, summaries and guard notes for every preset but default", () => {
    for (const id of IDS) {
      const preset = presetOf(id);
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.summary.length).toBeGreaterThan(0);
      if (id === "default") {
        expect(preset.guards).toEqual([]);
        expect(preset.unexpressed).toEqual([]);
      } else {
        expect(preset.guards.length).toBeGreaterThan(0);
        expect(preset.unexpressed.length).toBeGreaterThan(0);
      }
    }
  });

  it("C-PRESET-11 holds the guard values", () => {
    expect(PRESETS.glass.params.contrastLevel).toBe("AAA");
    expect(PRESETS["dithering-pixel"].params.contrastLevel).toBe("AAA");
    for (const id of [
      "minimal-swiss",
      "editorial",
      "neo-brutalism",
      "dark-dev-tool",
      "aurora",
      "retro-futurism",
      "maximalism",
      "organic",
    ] as const) {
      expect(["AA+", "AAA"]).toContain(PRESETS[id].params.contrastLevel);
    }
  });

  it("C-PRESET-13 gives every preset a display face below genericness 0.8", () => {
    for (const id of IDS.filter((x) => x !== "default")) {
      const pairing = PAIRINGS.find((p) => p.id === presetOf(id).params.pairing);
      expect(pairing).toBeDefined();
      expect(genericness(pairing?.display ?? "")).toBeLessThan(0.8);
    }
    expect(PAIRINGS.find((p) => p.id === PRESETS["neo-brutalism"].params.pairing)?.display).toBe(
      "anybody",
    );
  });

  it("C-PRESET-14 throws RangeError for an unknown id and TypeError for a wrong type", () => {
    expect(() => applyPreset(DEFAULT_PARAMS, "nope" as never)).toThrow(RangeError);
    expect(() => applyPreset(DEFAULT_PARAMS, "nope" as never)).toThrow(/^applyPreset:/);
    expect(() => applyPreset(DEFAULT_PARAMS, 3 as never)).toThrow(TypeError);
    expect(() => applyPreset(null as never, "glass")).toThrow(TypeError);
    expect(() => applyPreset(null as never, "glass")).toThrow(/^applyPreset:/);
    expect(() => applyPreset("x" as never, "glass")).toThrow(TypeError);
  });

  it("C-PRESET-15 freezes PRESETS deeply", () => {
    const frozen = (value: unknown): boolean =>
      typeof value !== "object" || value === null
        ? true
        : Object.isFrozen(value) && Object.values(value).every(frozen);
    expect(frozen(PRESETS)).toBe(true);
  });

  it("C-PRESET-16 never lowers the contrast level", () => {
    const at = (level: string): DirectionParams => ({
      ...DEFAULT_PARAMS,
      contrastLevel: level as never,
    });
    expect(applyPreset(at("AAA"), "default").contrastLevel).toBe("AAA");
    expect(applyPreset(at("AA"), "glass").contrastLevel).toBe("AAA");
    expect(applyPreset(at("AA+"), "bento").contrastLevel).toBe("AA+");
    expect(applyPreset(at("AA"), "minimal-swiss").contrastLevel).toBe("AA+");
    // Every other field is the preset's, the gamut and the name are the user's.
    const keep: DirectionParams = {
      ...DEFAULT_PARAMS,
      gamut: "p3",
      name: "Mine",
      contrastLevel: "AA",
    };
    for (const id of IDS) {
      const { pairing, ...patch } = PRESETS[id as PresetId].params;
      const expected = { ...keep, ...patch, ...(pairing === undefined ? {} : { pairing }) };
      expect(applyPreset(keep, id as PresetId), id).toEqual(expected);
    }
  });
});
