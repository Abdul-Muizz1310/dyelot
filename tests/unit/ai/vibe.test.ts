import { describe, expect, it } from "vitest";
import {
  type AiChange,
  imageChange,
  MOOD_TAGS,
  TYPE_VIBE_PAIRING,
  TYPE_VIBES,
  vibeChange,
} from "@/ai/apply";
import type { VibeOutput } from "@/ai/features";
import { vibeInput } from "@/ai/inputs";
import { type DirectionParams, type ImagePalette, imagePalette, PAIRING_IDS } from "@/engine";
import { mergeParams } from "@/features/studio/params";
import { DEFAULT_PARAMS } from "../spec/support";
import { FOUR_COLORS, readOutputs, TINY_JPEG_DATA_URL, VIBE_IN, VIBE_OUT } from "./fixtures";

// C-IMG-12 and C-IMG-13 of docs/specs/04-ai.md, section 14.6 (R4-47, R4-48, 9.3, 9.4): the image's
// heuristic change, the vibe's change, and the vibe's input. Each builder's R-05 checks sit under
// its case.

const PALETTE = imagePalette(FOUR_COLORS);
const [C1, C2, C3, C4] = PALETTE.clusters;
const LOCKED: DirectionParams = {
  ...DEFAULT_PARAMS,
  accent: { l: 0.7, c: 0.1, h: 120 },
  direction: { thesis: "Calm and exact", adjectives: ["old"] },
};

/** Expects `run` to throw `kind` with a message that starts with `name`. */
function expectThrow(run: () => unknown, kind: typeof TypeError | typeof RangeError, name: string) {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(kind);
  expect((caught as Error).message.startsWith(`${name}:`), (caught as Error).message).toBe(true);
}

/** A palette with one field replaced, for the R-05 cases. */
const paletteWith = (over: Record<string, unknown>): ImagePalette =>
  ({ ...PALETTE, ...over }) as never;

describe("C-IMG-12 imageChange", () => {
  it("C-IMG-12 imageChange(imagePalette(FOUR_COLORS)) sets the roles' colors, accent undefined and the tint", () => {
    expect(PALETTE.roles).toEqual({ primary: "c1", secondary: "c2" });
    const change = imageChange(PALETTE);
    expect(change).toStrictEqual({
      patch: { primary: C1.oklch, secondary: C2.oklch, accent: undefined, neutralTint: "warm" },
    });
    expect(Object.hasOwn(change.patch, "accent")).toBe(true);
  });

  it("C-IMG-12 holds only fields of an AiChange, so applyAi takes it with createdWith", () => {
    const change = imageChange(PALETTE);
    expect(Object.keys(change)).toEqual(["patch"]);
    const full: AiChange = { ...change, createdWith: "controls" };
    expect(Object.keys(full).sort()).toEqual(["createdWith", "patch"]);
  });

  it("C-IMG-12 the merged parameters lock the extracted seeds and unlock the slot with no role", () => {
    const merged = mergeParams(LOCKED, imageChange(PALETTE).patch);
    expect(merged.primary).toEqual(C1.oklch);
    expect(merged.secondary).toEqual(C2.oklch);
    expect(Object.hasOwn(merged, "accent")).toBe(false);
    expect(merged.neutralTint).toBe("warm");
  });

  it("C-IMG-12 an accent role sets the accent, and a gray palette locks only the primary with tint none", () => {
    const withAccent = paletteWith({ roles: { primary: "c2", secondary: "c1", accent: "c3" } });
    expect(imageChange(withAccent).patch).toStrictEqual({
      primary: C2.oklch,
      secondary: C1.oklch,
      accent: C3.oklch,
      neutralTint: "warm",
    });
    const gray = imagePalette([
      { hex: "#202020", share: 0.4 },
      { hex: "#808080", share: 0.3 },
    ]);
    expect(imageChange(gray).patch).toStrictEqual({
      primary: gray.clusters[0].oklch,
      secondary: undefined,
      accent: undefined,
      neutralTint: "none",
    });
  });

  it("C-IMG-12 hands out fresh seeds, never the palette's own objects", () => {
    const { patch } = imageChange(PALETTE);
    expect(patch.primary).not.toBe(C1.oklch);
  });

  it("C-IMG-12 a palette, clusters, roles or a cluster of the wrong type is a TypeError naming imageChange", () => {
    for (const bad of [
      null,
      "palette",
      [PALETTE],
      paletteWith({ clusters: "c1" }),
      paletteWith({ clusters: [null] }),
      paletteWith({ clusters: [{ ...C1, id: 1 }] }),
      paletteWith({ clusters: [{ ...C1, oklch: "red" }] }),
      paletteWith({ roles: null }),
      paletteWith({ roles: { primary: 1 } }),
      paletteWith({ roles: {} }),
      paletteWith({ neutralTint: 5 }),
    ]) {
      expectThrow(() => imageChange(bad as never), TypeError, "imageChange");
    }
  });

  it("C-IMG-12 a palette out of its domain is a RangeError naming imageChange", () => {
    for (const bad of [
      paletteWith({ clusters: [] }),
      paletteWith({ clusters: Array.from({ length: 9 }, (_, i) => ({ ...C1, id: `c${i + 1}` })) }),
      paletteWith({ clusters: [C1, { ...C2, id: "c1" }] }),
      paletteWith({ clusters: [{ ...C1, oklch: { l: 1.5, c: 0.1, h: 30 } }] }),
      paletteWith({ roles: { primary: "c9" } }),
      paletteWith({ roles: { primary: "c1", secondary: "c1" } }),
      paletteWith({ roles: { primary: "c1", accent: "c4", tertiary: "c3" } }),
      paletteWith({ neutralTint: "brand" }),
    ]) {
      expectThrow(() => imageChange(bad as never), RangeError, "imageChange");
    }
  });
});

describe("C-IMG-13 vibeChange and vibeInput", () => {
  const context = { params: LOCKED, palette: PALETTE };

  it("C-IMG-13 vibeChange(VIBE_OUT, { params, palette }) gives the preset, the seeds, the tint, the pairing and the mood tags", () => {
    expect(VIBE_OUT).toEqual({
      roleMap: { primary: "c1", secondary: "c2" },
      neutralTint: "warm",
      moodTags: ["earthy", "calm"],
      typeVibe: "editorial-serif",
      preset: "organic",
    });
    const change = vibeChange(VIBE_OUT, context);
    expect(change).toStrictEqual({
      preset: "organic",
      patch: {
        primary: C1.oklch,
        secondary: C2.oklch,
        accent: undefined,
        neutralTint: "warm",
        pairing: TYPE_VIBE_PAIRING["editorial-serif"],
        direction: { thesis: "Calm and exact", adjectives: ["earthy", "calm"] },
      },
    });
    expect(change.patch.pairing).toBe("schibsted-serif");
    expect(Object.keys(change).sort()).toEqual(["patch", "preset"]);
  });

  it("C-IMG-13 the roles name any cluster, an accent included, and a held direction may be absent", () => {
    const output: VibeOutput = {
      roleMap: { primary: "c4", secondary: "c3", accent: "c1" },
      neutralTint: "cool",
      moodTags: ["minimal"],
      typeVibe: "mono-tech",
      preset: "default",
    };
    const change = vibeChange(output, { params: DEFAULT_PARAMS, palette: PALETTE });
    expect(change.patch).toStrictEqual({
      primary: C4.oklch,
      secondary: C3.oklch,
      accent: C1.oklch,
      neutralTint: "cool",
      pairing: "hubot-mona",
      direction: { adjectives: ["minimal"] },
    });
  });

  it("C-IMG-13 each type vibe maps to section 9.4's pairing, one of the engine's", () => {
    expect([...TYPE_VIBES]).toEqual([
      "geometric",
      "humanist",
      "grotesk",
      "editorial-serif",
      "mono-tech",
      "display",
    ]);
    expect(TYPE_VIBE_PAIRING).toEqual({
      geometric: "funnel",
      humanist: "atkinson",
      grotesk: "host-grotesk",
      "editorial-serif": "schibsted-serif",
      "mono-tech": "hubot-mona",
      display: "unbounded-golos",
    });
    for (const typeVibe of TYPE_VIBES) {
      expect(PAIRING_IDS).toContain(TYPE_VIBE_PAIRING[typeVibe]);
      const { patch } = vibeChange({ ...VIBE_OUT, typeVibe }, context);
      expect(patch.pairing).toBe(TYPE_VIBE_PAIRING[typeVibe]);
    }
    expect(MOOD_TAGS).toHaveLength(16);
  });

  it("C-IMG-13 the merged parameters after the preset lock the seeds, unlock the accent and keep the thesis", () => {
    const { patch } = vibeChange(VIBE_OUT, context);
    const merged = mergeParams(LOCKED, patch);
    expect(merged.primary).toEqual(C1.oklch);
    expect(Object.hasOwn(merged, "accent")).toBe(false);
    expect(merged.pairing).toBe("schibsted-serif");
    expect(merged.direction).toEqual({ thesis: "Calm and exact", adjectives: ["earthy", "calm"] });
  });

  it("C-IMG-13 vibeInput rounds as 9.3 says: 3 decimals, an integer hue or null, a share of at least 0.001", () => {
    expect(VIBE_IN.clusters).toEqual([
      { id: "c1", l: 0.541, c: 0.157, h: 32, share: 0.4 },
      { id: "c2", l: 0.528, c: 0.104, h: 252, share: 0.3 },
      { id: "c3", l: 0.929, c: 0.032, h: 83, share: 0.2 },
      { id: "c4", l: 0.225, c: 0.005, h: 248, share: 0.1 },
    ]);
    expect(VIBE_IN.image).toEqual({ dataUrl: TINY_JPEG_DATA_URL, width: 2, height: 2 });
    expect(TINY_JPEG_DATA_URL).toMatch(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/);
    const edge: ImagePalette = {
      clusters: [
        { ...C1, oklch: { l: 0.12345, c: 0.0996, h: 359.6 }, share: 0.9996 },
        { ...C2, oklch: { l: 0.4, c: 0, h: null }, share: 0.0004 },
      ],
      roles: { primary: "c1" },
      neutralTint: "none",
    };
    expect(vibeInput(edge, { dataUrl: TINY_JPEG_DATA_URL, width: 2, height: 2 }).clusters).toEqual([
      { id: "c1", l: 0.123, c: 0.1, h: 0, share: 1 },
      { id: "c2", l: 0.4, c: 0, h: null, share: 0.001 },
    ]);
  });

  it("C-IMG-13 an output, context, params or palette of the wrong type is a TypeError naming vibeChange", () => {
    const out = readOutputs().vibe;
    for (const run of [
      () => vibeChange(null as never, context),
      () => vibeChange(out, null as never),
      () => vibeChange(out, { ...context, params: "x" } as never),
      () => vibeChange(out, { ...context, palette: undefined } as never),
      () => vibeChange(out, { ...context, palette: paletteWith({ clusters: "x" }) }),
      () => vibeChange(out, { params: { ...LOCKED, direction: "x" } as never, palette: PALETTE }),
      () => vibeChange({ ...out, roleMap: "c1" } as never, context),
      () => vibeChange({ ...out, roleMap: { primary: 1 } } as never, context),
      () => vibeChange({ ...out, roleMap: {} } as never, context),
      () => vibeChange({ ...out, neutralTint: 5 } as never, context),
      () => vibeChange({ ...out, moodTags: "calm" } as never, context),
      () => vibeChange({ ...out, moodTags: [5] } as never, context),
      () => vibeChange({ ...out, typeVibe: undefined } as never, context),
      () => vibeChange({ ...out, preset: null } as never, context),
    ]) {
      expectThrow(run, TypeError, "vibeChange");
    }
  });

  it("C-IMG-13 an output out of its domain is a RangeError naming vibeChange", () => {
    const out = readOutputs().vibe;
    for (const run of [
      () => vibeChange({ ...out, extra: 1 } as never, context),
      () => vibeChange({ ...out, roleMap: { primary: "c9" } }, context),
      () => vibeChange({ ...out, roleMap: { primary: "c1", secondary: "c1" } }, context),
      () => vibeChange({ ...out, roleMap: { primary: "c1", tertiary: "c2" } } as never, context),
      () => vibeChange({ ...out, neutralTint: "pink" } as never, context),
      () => vibeChange({ ...out, moodTags: [] }, context),
      () =>
        vibeChange({ ...out, moodTags: ["calm", "warm", "cool", "bold", "airy", "soft"] }, context),
      () => vibeChange({ ...out, moodTags: ["calm", "calm"] }, context),
      () => vibeChange({ ...out, moodTags: ["sleepy"] } as never, context),
      () => vibeChange({ ...out, typeVibe: "script" } as never, context),
      () => vibeChange({ ...out, preset: "vaporwave" } as never, context),
      () => vibeChange(out, { ...context, palette: paletteWith({ clusters: [] }) }),
    ]) {
      expectThrow(run, RangeError, "vibeChange");
    }
  });
});
