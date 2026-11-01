import { describe, expect, it } from "vitest";
import {
  applyPreset,
  choosePairing,
  type DirectionParams,
  hexToRgb,
  normalizeSeed,
  PAIRINGS,
  PRESET_IDS,
  parseColor,
  rgbToOklch,
} from "@/engine";
import {
  freshParams,
  lockSeed,
  paramsMatchSpec,
  paramsOfSpec,
  parseParams,
  resolveParams,
  touchesPreset,
} from "@/features/studio/params";
import type { DesignSpec } from "@/spec";
import { DEFAULT_PARAMS, withValue } from "../../spec/support";
import { FRESH_PARAMS, freshSpec, generate } from "./support";

// Cases are C-STORE-30 and C-STORE-31 of docs/specs/02-studio.md, section 6.7, with the pure
// helpers the store builds on: R2-05 (auto pairing), R2-14 item 2 (the draft's parameter check),
// R2-17 (the lock seed) and R2-28 (which changes clear the preset).

const as = (value: unknown) => value as DesignSpec;

/** The seed and pairing of a spec whose families are not the automatic pick for its seed. */
function explicitCase(): { seed: string; pairing: string } {
  for (let i = 1; i < 50; i++) {
    const seed = `seed-${i}`;
    if (choosePairing(seed) !== "host-grotesk") return { seed, pairing: "host-grotesk" };
  }
  throw new Error("every seed picks host-grotesk");
}

describe("freshParams", () => {
  it("is the default preset's parameters with sRGB and no pairing (auto)", () => {
    expect(freshParams()).toEqual(FRESH_PARAMS);
    expect("pairing" in freshParams()).toBe(false);
    expect(freshParams()).not.toBe(freshParams());
  });
});

describe("resolveParams", () => {
  it("fills an absent pairing with choosePairing(seed) and keeps an explicit one", () => {
    expect(resolveParams(FRESH_PARAMS, "seed-1")).toEqual({
      ...FRESH_PARAMS,
      pairing: choosePairing("seed-1"),
    });
    const explicit = { ...FRESH_PARAMS, pairing: "funnel" };
    expect(resolveParams(explicit, "seed-1")).toEqual(explicit);
  });

  it("does not mutate its input", () => {
    const params = structuredClone(FRESH_PARAMS);
    resolveParams(params, "seed-1");
    expect(params).toEqual(FRESH_PARAMS);
  });

  it("throws TypeError naming resolveParams for a non-object params or a non-string seed", () => {
    expect(() => resolveParams(null as never, "seed-1")).toThrow(/^resolveParams: params/);
    expect(() => resolveParams(null as never, "seed-1")).toThrow(TypeError);
    expect(() => resolveParams(FRESH_PARAMS, 1 as never)).toThrow(/^resolveParams: seed/);
  });
});

describe("paramsOfSpec", () => {
  it("C-STORE-30 inverts generation for 25 specs over every preset", { timeout: 120_000 }, () => {
    for (let i = 0; i < 25; i++) {
      const id = PRESET_IDS[i % PRESET_IDS.length];
      const seed = `s${i}`;
      const params = applyPreset(DEFAULT_PARAMS, id);
      const spec = generate(resolveParams(params, seed), seed);
      const back = paramsOfSpec(spec);
      expect(back.customFonts, id).toBe(false);
      expect(generate(resolveParams(back.params, seed), seed), id).toEqual(spec);
    }
  });

  it("C-STORE-31 keeps an automatic pairing absent", () => {
    const { params, customFonts } = paramsOfSpec(freshSpec());
    expect(customFonts).toBe(false);
    expect("pairing" in params).toBe(false);
  });

  it("C-STORE-31 reads another pairing as explicit, and explicit host-grotesk as explicit", () => {
    const { seed, pairing } = explicitCase();
    const spec = generate({ ...FRESH_PARAMS, pairing }, seed);
    expect(paramsOfSpec(spec).params.pairing).toBe("host-grotesk");
    const funnel = generate({ ...FRESH_PARAMS, pairing: "funnel" }, "seed-1");
    expect(choosePairing("seed-1")).not.toBe("funnel");
    expect(paramsOfSpec(funnel)).toEqual({
      params: { ...FRESH_PARAMS, pairing: "funnel" },
      customFonts: false,
    });
  });

  it("C-STORE-31 reads families that match no pairing as custom, with pairing absent", () => {
    const custom = as(withValue(freshSpec(), ["type", "families", "display"], "inter"));
    const { params, customFonts } = paramsOfSpec(custom);
    expect(customFonts).toBe(true);
    expect("pairing" in params).toBe(false);
  });

  it("reads every recorded parameter: seeds, ratio, radius, depth, motion and a name", () => {
    const params: DirectionParams = {
      ...FRESH_PARAMS,
      primary: normalizeSeed(parseColor("#1f6f5b")),
      harmony: "triadic",
      gamut: "p3",
      type: { context: "marketing", ratio: 1.25 },
      radius: "round",
      depth: "layered",
      motion: "calm",
      name: "Saltmarsh",
    };
    const spec = generate(resolveParams(params, "seed-1"), "seed-1");
    expect(paramsOfSpec(spec).params).toEqual(params);
  });

  it("leaves the generator's default name out, so a fresh design reads back as it was set", () => {
    expect(freshSpec().meta.name).toBe("untitled");
    expect(paramsOfSpec(freshSpec()).params).toEqual(FRESH_PARAMS);
  });

  it("throws TypeError naming paramsOfSpec for a value that is not a spec", () => {
    expect(() => paramsOfSpec(null as never)).toThrow(TypeError);
    expect(() => paramsOfSpec(null as never)).toThrow(/^paramsOfSpec: /);
    expect(() => paramsOfSpec({} as never)).toThrow(TypeError);
    expect(() => paramsOfSpec(as({ ...freshSpec(), type: 1 }))).toThrow(/^paramsOfSpec: /);
  });
});

describe("parseParams (R2-14 item 2: generateSystem's parameter checks)", () => {
  it("returns a copy of valid parameters, an absent pairing still absent", () => {
    const params = { ...FRESH_PARAMS, primary: normalizeSeed(parseColor("#1f6f5b")), name: "x" };
    expect(parseParams(params)).toEqual(params);
    expect(parseParams(JSON.parse(JSON.stringify(FRESH_PARAMS)))).toEqual(FRESH_PARAMS);
    expect("pairing" in (parseParams(FRESH_PARAMS) ?? {})).toBe(false);
  });

  it("keeps a gray seed, whose hue is null", () => {
    const params = { ...FRESH_PARAMS, primary: { l: 0.5, c: 0, h: null } };
    expect(parseParams(params)).toEqual(params);
  });

  it("keeps an explicit pairing and a ratio in (1, 2]", () => {
    const params = { ...FRESH_PARAMS, pairing: "funnel", type: { context: "dense", ratio: 2 } };
    expect(parseParams(params)).toEqual(params);
  });

  it.each([
    ["an enum outside its set (C-DRAFT-12)", { ...FRESH_PARAMS, chroma: "loud" }],
    ["a missing enum", { ...FRESH_PARAMS, harmony: undefined }],
    ["a ratio of 9 (C-DRAFT-13)", { ...FRESH_PARAMS, type: { context: "product", ratio: 9 } }],
    ["a ratio of 1", { ...FRESH_PARAMS, type: { context: "product", ratio: 1 } }],
    ["a ratio that is not a number", { ...FRESH_PARAMS, type: { context: "product", ratio: "2" } }],
    ["an unknown pairing id (C-DRAFT-13)", { ...FRESH_PARAMS, pairing: "comic-sans" }],
    ["an unknown type key", { ...FRESH_PARAMS, type: { context: "product", size: 1 } }],
    ["a type that is not an object", { ...FRESH_PARAMS, type: "product" }],
    ["a seed out of range", { ...FRESH_PARAMS, primary: { l: 2, c: 0.1, h: 30 } }],
    ["a seed that is not a color", { ...FRESH_PARAMS, accent: "#1f6f5b" }],
    ["a seed with a string lightness", { ...FRESH_PARAMS, accent: { l: "0.5", c: 0.1, h: 30 } }],
    ["a seed with a string hue", { ...FRESH_PARAMS, accent: { l: 0.5, c: 0.1, h: "30" } }],
    ["a seed with an extra key", { ...FRESH_PARAMS, accent: { l: 0.5, c: 0.1, h: 30, a: 1 } }],
    ["an unknown type context", { ...FRESH_PARAMS, type: { context: "blog" } }],
    ["an empty name", { ...FRESH_PARAMS, name: "" }],
    ["a name that is not a string", { ...FRESH_PARAMS, name: 3 }],
    ["an unknown key", { ...FRESH_PARAMS, density: "dense" }],
    ["null", null],
    ["an array", []],
    ["a string", "params"],
  ])("returns null for %s", (_, value) => {
    expect(parseParams(value)).toBeNull();
  });
});

describe("paramsMatchSpec (R2-14 item 2: the draft's parameters regenerate its spec)", () => {
  it("accepts the parameters that made the spec, auto or explicit", () => {
    expect(paramsMatchSpec(FRESH_PARAMS, freshSpec())).toBe(true);
    expect(paramsMatchSpec({ ...FRESH_PARAMS, pairing: "young-onest" }, freshSpec())).toBe(true);
  });

  it("rejects a field that disagrees with paramsOfSpec, other than pairing", () => {
    expect(paramsMatchSpec({ ...FRESH_PARAMS, radius: "round" }, freshSpec())).toBe(false);
    expect(paramsMatchSpec({ ...FRESH_PARAMS, name: "Saltmarsh" }, freshSpec())).toBe(false);
    const locked = { ...FRESH_PARAMS, primary: normalizeSeed(parseColor("#1f6f5b")) };
    expect(paramsMatchSpec(locked, freshSpec())).toBe(false);
    const ratio = { ...FRESH_PARAMS, type: { context: "product" as const, ratio: 1.25 } };
    expect(paramsMatchSpec(ratio, freshSpec())).toBe(false);
  });

  it("rejects a pairing whose families are not the spec's", () => {
    expect(paramsMatchSpec({ ...FRESH_PARAMS, pairing: "funnel" }, freshSpec())).toBe(false);
    const custom = as(withValue(freshSpec(), ["type", "families", "display"], "inter"));
    expect(paramsMatchSpec(FRESH_PARAMS, custom)).toBe(false);
  });

  it("throws TypeError naming paramsMatchSpec for a non-object", () => {
    expect(() => paramsMatchSpec(null as never, freshSpec())).toThrow(/^paramsMatchSpec: /);
  });
});

describe("lockSeed (R2-17)", () => {
  it("C-STORE-15 takes the primary's L and C from the light primary role, its hue from the palette", () => {
    const spec = freshSpec();
    const shown = rgbToOklch(hexToRgb(spec.color.roles.light.primary), "srgb");
    expect(lockSeed(spec, "primary")).toEqual(
      normalizeSeed({ l: shown.l, c: shown.c, h: spec.color.palettes.primary.hue }),
    );
  });

  it.each(["secondary", "accent"] as const)(
    "C-STORE-15 takes %s from the palette's light step 500 and the palette's hue",
    (slot) => {
      const spec = freshSpec();
      const palette = spec.color.palettes[slot];
      const step = palette.light[5];
      expect(step.step).toBe(500);
      expect(lockSeed(spec, slot)).toEqual(
        normalizeSeed({ l: step.oklch.l, c: step.oklch.c, h: palette.hue }),
      );
    },
  );

  it("throws TypeError naming lockSeed for a palette without a light step 500", () => {
    const spec = freshSpec();
    const short = withValue(
      spec,
      ["color", "palettes", "accent", "light"],
      spec.color.palettes.accent.light.slice(0, 5),
    );
    expect(() => lockSeed(short as DesignSpec, "accent")).toThrow(TypeError);
    expect(() => lockSeed(short as DesignSpec, "accent")).toThrow(/^lockSeed: .*step 500/);
    expect(() => lockSeed(as({ ...spec, color: null }), "accent")).toThrow(/^lockSeed: spec.color/);
  });

  it("throws RangeError for a slot that cannot lock, and TypeError for a non-string", () => {
    expect(() => lockSeed(freshSpec(), "neutral" as never)).toThrow(RangeError);
    expect(() => lockSeed(freshSpec(), "neutral" as never)).toThrow(/^lockSeed: /);
    expect(() => lockSeed(freshSpec(), 1 as never)).toThrow(TypeError);
    expect(() => lockSeed(null as never, "primary")).toThrow(TypeError);
  });
});

describe("touchesPreset (R2-28)", () => {
  const owned: [string, Partial<DirectionParams>][] = [
    ["harmony", { harmony: "triadic" }],
    ["chroma", { chroma: "vivid" }],
    ["neutralTint", { neutralTint: "warm" }],
    ["contrastLevel", { contrastLevel: "AAA" }],
    ["scaleMode", { scaleMode: "even" }],
    ["type.context", { type: { context: "dense" } }],
    ["radius", { radius: "sharp" }],
    ["depth", { depth: "flat" }],
    ["motion", { motion: "calm" }],
    ["pairing", { pairing: "funnel" }],
  ];

  it.each(owned)("C-STORE-35 is true when %s changes to a different value", (_, patch) => {
    expect(touchesPreset(FRESH_PARAMS, { ...FRESH_PARAMS, ...patch })).toBe(true);
  });

  it("C-STORE-35 is true when an explicit pairing goes back to auto", () => {
    expect(touchesPreset({ ...FRESH_PARAMS, pairing: "funnel" }, FRESH_PARAMS)).toBe(true);
  });

  it("C-STORE-35 is false for the same values, seeds, the gamut, the ratio and the name", () => {
    expect(touchesPreset(FRESH_PARAMS, { ...FRESH_PARAMS })).toBe(false);
    const seed = normalizeSeed(parseColor("#1f6f5b"));
    expect(touchesPreset(FRESH_PARAMS, { ...FRESH_PARAMS, primary: seed })).toBe(false);
    expect(touchesPreset(FRESH_PARAMS, { ...FRESH_PARAMS, gamut: "p3" })).toBe(false);
    const ratio = { ...FRESH_PARAMS, type: { context: "product" as const, ratio: 1.25 } };
    expect(touchesPreset(FRESH_PARAMS, ratio)).toBe(false);
    expect(touchesPreset(FRESH_PARAMS, { ...FRESH_PARAMS, name: "x" })).toBe(false);
  });
});

it("every pairing has its own three families, so paramsOfSpec finds at most one", () => {
  const triples = PAIRINGS.map((p) => `${p.display}/${p.body}/${p.mono}`);
  expect(new Set(triples).size).toBe(PAIRINGS.length);
});
