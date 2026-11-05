import { describe, expect, it } from "vitest";
import { MOOD_TAGS, rationaleChange, TYPE_VIBE_PAIRING, TYPE_VIBES } from "@/ai/apply";
import type { RationaleOutput } from "@/ai/features";
import { briefInput, critiqueInput, rationaleInput, refineInput, vibeInput } from "@/ai/inputs";
import {
  CONTRAST_CHECKS,
  type DirectionParams,
  type Finding,
  generateSystem,
  type ImagePalette,
  imagePalette,
  lintSpec,
  measureSpec,
  PAIRING_IDS,
} from "@/engine";
import type { DesignSpec } from "@/spec";
import { SPEC } from "../export/golden-support";
import { ONE_FAIL } from "../export/one-fail-support";
import { DEFAULT_PARAMS } from "../spec/support";
import {
  CRITIQUE_IN,
  FOUR_COLORS,
  RATIONALE_IN,
  RATIONALE_OUT,
  REFINE_IN,
  seedsOf,
  TINY_JPEG_DATA_URL,
  VIBE_IN,
} from "./fixtures";

// C-AI-16, C-AI-17 and C-AI-19 of docs/specs/04-ai.md, section 14.2: the input builders of 5.2 and
// 9.3 (R4-39, R4-45, R4-48 to R4-50), their R-05 errors, and `rationaleChange` (R4-49). The vibe
// tables of 9.4 are checked here too, beside the builder that names the clusters.

const JPEG = { dataUrl: TINY_JPEG_DATA_URL, width: 2, height: 2 };
const SEEDS = seedsOf(SPEC);
const C1_IDS = CONTRAST_CHECKS.filter((check) => check.rule === "C1").map((check) => check.id);

describe("C-AI-16 the input builders", () => {
  it("C-AI-16 briefInput keeps the cleaned brief and the locked hues", () => {
    expect(briefInput("Kyoto tea house at dusk, calm and exact", {})).toEqual({
      brief: "Kyoto tea house at dusk, calm and exact",
      locked: {},
    });
    expect(briefInput("calm", { primary: 0, secondary: 359, accent: null })).toEqual({
      brief: "calm",
      locked: { primary: 0, secondary: 359, accent: null },
    });
    expect(briefInput("a".repeat(500), {}).brief).toHaveLength(500);
  });

  it("C-AI-16 briefInput reads an undefined locked hue as an absent one", () => {
    expect(briefInput("calm", { primary: undefined, accent: 20 })).toEqual({
      brief: "calm",
      locked: { accent: 20 },
    });
  });

  it("C-AI-16 refineInput summarizes the held parameters with each slot's hue", () => {
    expect(REFINE_IN).toEqual({
      text: "warmer and rounder",
      current: {
        harmony: "analogous",
        chroma: "balanced",
        neutralTint: "brand",
        contrastLevel: "AA",
        pairing: "auto",
        typeContext: "product",
        radius: "soft",
        depth: "soft",
        motion: "brisk",
        hues: {
          primary: Math.round(SEEDS.primary.h ?? Number.NaN),
          secondary: Math.round(SEEDS.secondary.h ?? Number.NaN),
          accent: Math.round(SEEDS.accent.h ?? Number.NaN),
        },
      },
    });
  });

  it("C-AI-16 refineInput rounds each hue to an integer, 360 as 0, and keeps a null hue", () => {
    const seeds = {
      primary: { l: 0.6, c: 0.1, h: 359.6 },
      secondary: { l: 0.6, c: 0.1, h: 12.4 },
      accent: { l: 0.6, c: 0, h: null },
    };
    const params: DirectionParams = {
      ...DEFAULT_PARAMS,
      pairing: PAIRING_IDS[3],
      type: { context: "editorial", ratio: 1.25 },
    };
    const input = refineInput("cooler", params, seeds);
    expect(input.current.hues).toEqual({ primary: 0, secondary: 12, accent: null });
    expect(input.current.pairing).toBe(PAIRING_IDS[3]);
    expect(input.current.typeContext).toBe("editorial");
  });

  it("C-AI-16 vibeInput writes each cluster to 3 decimals, its hue an integer or null", () => {
    const palette = imagePalette(FOUR_COLORS);
    expect(VIBE_IN).toEqual({
      clusters: [
        { id: "c1", l: 0.541, c: 0.157, h: 32, share: 0.4 },
        { id: "c2", l: 0.528, c: 0.104, h: 252, share: 0.3 },
        { id: "c3", l: 0.929, c: 0.032, h: 83, share: 0.2 },
        { id: "c4", l: 0.225, c: 0.005, h: 248, share: 0.1 },
      ],
      image: JPEG,
    });
    expect(palette.clusters.map((cluster) => cluster.id)).toEqual(["c1", "c2", "c3", "c4"]);
  });

  it("C-AI-16 vibeInput gives a hue of 359.6 as 0, a gray as null and a tiny share as 0.001", () => {
    const palette: ImagePalette = {
      clusters: [
        {
          id: "c1",
          hex: imagePalette(FOUR_COLORS).clusters[0].hex,
          oklch: { l: 0.5, c: 0.1, h: 359.6 },
          share: 0.9996,
          score: 0.5,
        },
        {
          id: "c2",
          hex: imagePalette(FOUR_COLORS).clusters[1].hex,
          oklch: { l: 0.4, c: 0, h: null },
          share: 0.0004,
          score: 0,
        },
      ],
      roles: { primary: "c1" },
      neutralTint: "none",
    };
    expect(vibeInput(palette, JPEG).clusters).toEqual([
      { id: "c1", l: 0.5, c: 0.1, h: 0, share: 1 },
      { id: "c2", l: 0.4, c: 0, h: null, share: 0.001 },
    ]);
  });

  it('C-AI-16 rationaleInput(SPEC, "default") holds the name, preset, pairing label and family names', () => {
    expect(RATIONALE_IN).toMatchObject({
      name: SPEC.meta.name,
      preset: "default",
      pairing: "Host Grotesk with Fragment Mono",
      families: { display: "Host Grotesk", body: "Host Grotesk", mono: "Fragment Mono" },
      contrastLevel: "AA",
    });
    expect(Object.keys(RATIONALE_IN)).toEqual([
      "name",
      "preset",
      "pairing",
      "families",
      "contrastLevel",
      "checks",
      "lint",
    ]);
  });

  it("C-AI-16 rationaleInput holds the 26 C1 checks, light then dark, each ratio cut to 2 decimals", () => {
    const measured = measureSpec(SPEC).contrast.filter((entry) => C1_IDS.includes(entry.check));
    expect(RATIONALE_IN.checks).toHaveLength(26);
    expect(RATIONALE_IN.checks.map((entry) => [entry.check, entry.mode])).toEqual([
      ...C1_IDS.map((id) => [id, "light"]),
      ...C1_IDS.map((id) => [id, "dark"]),
    ]);
    RATIONALE_IN.checks.forEach((entry, i) => {
      const exact = measured[i]?.ratio ?? Number.NaN;
      expect(Math.round(entry.ratio * 100) / 100).toBe(entry.ratio);
      expect(entry.ratio).toBeLessThanOrEqual(exact);
      expect(exact - entry.ratio).toBeLessThan(0.01);
    });
    // A cut, not a rounding: 10.896… is written 10.89.
    const info = RATIONALE_IN.checks.find(
      (entry) => entry.check === "C1:info-subtle-foreground/info-subtle" && entry.mode === "light",
    );
    expect(info?.ratio).toBe(10.89);
  });

  it("C-AI-16 rationaleInput counts the findings by severity", () => {
    const findings = lintSpec(SPEC);
    expect(RATIONALE_IN.lint).toEqual({
      error: findings.filter((f) => f.severity === "error").length,
      warn: findings.filter((f) => f.severity === "warn").length,
      info: findings.filter((f) => f.severity === "info").length,
    });
    expect(rationaleInput(ONE_FAIL, null).lint.error).toBe(1);
  });

  it("C-AI-16 rationaleInput gives pairing null for families that form no pairing", () => {
    const custom = (families: DesignSpec["type"]["families"]): DesignSpec => ({
      ...SPEC,
      type: { ...SPEC.type, families },
    });
    const mixed = rationaleInput(
      custom({ display: "gloock", body: "host-grotesk", mono: "fragment-mono" }),
      null,
    );
    expect(mixed.pairing).toBeNull();
    expect(mixed.preset).toBeNull();
    expect(mixed.families).toEqual({
      display: "Gloock",
      body: "Host Grotesk",
      mono: "Fragment Mono",
    });
    const outside = rationaleInput(
      custom({ display: "my-brand-sans", body: "my-brand-sans", mono: "fragment-mono" }),
      null,
    );
    expect(outside.pairing).toBeNull();
    expect(outside.families.display).toBe("my brand sans");
  });

  it('C-AI-16 rationaleInput makes a family name plain: an id "foo-" gives "foo", never a throw', () => {
    const custom = (display: string): DesignSpec => ({
      ...SPEC,
      type: { ...SPEC.type, families: { ...SPEC.type.families, display } },
    });
    expect(rationaleInput(custom("foo-"), null).families.display).toBe("foo");
    expect(rationaleInput(custom("-foo--bar-"), null).families.display).toBe("foo bar");
    expect(rationaleInput(custom("---"), null).families.display).toBe("---");
    expect(rationaleInput(custom("a".repeat(64)), null).families.display).toBe("a".repeat(64));
  });

  it("C-AI-16 rationaleInput names the pairing a spec generated with it uses", () => {
    const spec = generateSystem({ ...DEFAULT_PARAMS, pairing: "gloock-albert" }, "seed-1");
    expect(rationaleInput(spec, null).pairing).toBe("Gloock over Albert Sans");
  });

  it("C-AI-16 critiqueInput keeps lintSpec's order and fields, without the source", () => {
    const findings = lintSpec(ONE_FAIL);
    expect(CRITIQUE_IN.findings).toEqual(
      findings.map(({ id, severity, mode, subject, measured, threshold }) => ({
        id,
        severity,
        mode,
        subject,
        measured,
        threshold,
      })),
    );
  });

  it("C-AI-16 critiqueInput keeps the first 40 of more findings", () => {
    const many: Finding[] = Array.from({ length: 45 }, (_, i) => ({
      ...lintSpec(ONE_FAIL)[0],
      measured: i,
    }));
    const input = critiqueInput(many);
    expect(input.findings).toHaveLength(40);
    expect(input.findings.map((finding) => finding.measured)).toEqual(
      Array.from({ length: 40 }, (_, i) => i),
    );
  });
});

describe("C-AI-17 the input builders' errors", () => {
  it.each([
    ["briefInput", () => briefInput(5 as unknown as string, {})],
    ["briefInput", () => briefInput("calm", null as never)],
    ["briefInput", () => briefInput("calm", "x" as never)],
    ["briefInput", () => briefInput("calm", { primary: "12" as unknown as number })],
    ["refineInput", () => refineInput(null as unknown as string, DEFAULT_PARAMS, SEEDS)],
    ["refineInput", () => refineInput("x", null as never, SEEDS)],
    ["refineInput", () => refineInput("x", { ...DEFAULT_PARAMS, type: null } as never, SEEDS)],
    ["refineInput", () => refineInput("x", { ...DEFAULT_PARAMS, harmony: 5 } as never, SEEDS)],
    ["refineInput", () => refineInput("x", DEFAULT_PARAMS, null as never)],
    ["refineInput", () => refineInput("x", DEFAULT_PARAMS, { ...SEEDS, accent: 5 } as never)],
    [
      "refineInput",
      () => refineInput("x", DEFAULT_PARAMS, { ...SEEDS, accent: { l: 1, c: 0, h: "0" } } as never),
    ],
    ["vibeInput", () => vibeInput(null as never, JPEG)],
    ["vibeInput", () => vibeInput({ ...imagePalette(FOUR_COLORS), clusters: "x" } as never, JPEG)],
    ["vibeInput", () => vibeInput({ clusters: [null] } as never, JPEG)],
    ["vibeInput", () => vibeInput({ clusters: [{ id: "c1", oklch: 5 }] } as never, JPEG)],
    ["vibeInput", () => vibeInput(imagePalette(FOUR_COLORS), null as never)],
    ["vibeInput", () => vibeInput(imagePalette(FOUR_COLORS), { ...JPEG, width: "2" } as never)],
    ["rationaleInput", () => rationaleInput(null as never, null)],
    ["rationaleInput", () => rationaleInput(SPEC, 5 as never)],
    ["critiqueInput", () => critiqueInput(null as never)],
    ["critiqueInput", () => critiqueInput([null] as never)],
    ["critiqueInput", () => critiqueInput([{ ...lintSpec(ONE_FAIL)[0], measured: "3" }] as never)],
  ])("C-AI-17 %s throws TypeError for a wrong type (%#)", (name, call) => {
    expect(call).toThrow(TypeError);
    expect(call).toThrow(new RegExp(`^${name}: `));
  });

  it.each([
    ["briefInput", () => briefInput("", {})],
    ["briefInput", () => briefInput(" a", {})],
    ["briefInput", () => briefInput("a".repeat(501), {})],
    ["briefInput", () => briefInput("calm", { primary: 360 })],
    ["briefInput", () => briefInput("calm", { secondary: 12.5 })],
    ["briefInput", () => briefInput("calm", { tertiary: 1 } as never)],
    ["refineInput", () => refineInput("a".repeat(201), DEFAULT_PARAMS, SEEDS)],
    ["refineInput", () => refineInput("", DEFAULT_PARAMS, SEEDS)],
    ["refineInput", () => refineInput("x", { ...DEFAULT_PARAMS, chroma: "loud" } as never, SEEDS)],
    [
      "refineInput",
      () => refineInput("x", DEFAULT_PARAMS, { ...SEEDS, accent: { l: 1, c: 0, h: Number.NaN } }),
    ],
    ["critiqueInput", () => critiqueInput([])],
    ["critiqueInput", () => critiqueInput([{ ...lintSpec(ONE_FAIL)[0], id: "Z9" } as never])],
    [
      "vibeInput",
      () =>
        vibeInput(imagePalette(FOUR_COLORS), {
          ...JPEG,
          dataUrl: JPEG.dataUrl.replace("jpeg", "png"),
        }),
    ],
    ["vibeInput", () => vibeInput(imagePalette(FOUR_COLORS), { ...JPEG, width: 769 })],
    ["vibeInput", () => vibeInput({ ...imagePalette(FOUR_COLORS), clusters: [] }, JPEG)],
    ["rationaleInput", () => rationaleInput(SPEC, "vaporwave" as never)],
    ["rationaleInput", () => rationaleInput({ ...SPEC, version: "dyelot.spec/0" } as never, null)],
    ["rationaleInput", () => rationaleInput({ meta: SPEC.meta } as never, null)],
  ])("C-AI-17 %s throws RangeError for a value out of its domain (%#)", (name, call) => {
    expect(call).toThrow(RangeError);
    expect(call).toThrow(new RegExp(`^${name}: `));
  });
});

describe("C-AI-19 rationaleChange", () => {
  const held: DirectionParams = {
    ...DEFAULT_PARAMS,
    oneLiner: "An old line.",
    direction: { thesis: "An old thesis.", adjectives: ["calm", "exact"], like: ["tea"] },
    rules: { do: ["Old do."], dont: ["Old dont."] },
  };

  it("C-AI-19 stores the one-liner, the thesis and the rules, keeping the held adjectives", () => {
    expect(rationaleChange(RATIONALE_OUT, held)).toEqual({
      patch: {
        oneLiner: RATIONALE_OUT.oneLiner,
        direction: { ...held.direction, thesis: RATIONALE_OUT.thesis },
        rules: { do: RATIONALE_OUT.do, dont: RATIONALE_OUT.dont },
      },
    });
  });

  it("C-AI-19 gives a direction of the thesis alone when none is held", () => {
    expect(rationaleChange(RATIONALE_OUT, DEFAULT_PARAMS).patch.direction).toEqual({
      thesis: RATIONALE_OUT.thesis,
    });
  });

  it("C-AI-19 returns exactly the patch of an AiChange, which generates", () => {
    const change = rationaleChange(RATIONALE_OUT, held);
    expect(Object.keys(change)).toEqual(["patch"]);
    const { oneLiner, direction, rules } = change.patch;
    const spec = generateSystem({ ...held, oneLiner, direction, rules }, "seed-1");
    expect(spec.direction?.thesis).toBe(RATIONALE_OUT.thesis);
    expect(spec.direction?.adjectives).toEqual(["calm", "exact"]);
    expect(spec.rules).toEqual({ do: RATIONALE_OUT.do, dont: RATIONALE_OUT.dont });
  });

  it("C-AI-19 throws TypeError and RangeError naming rationaleChange", () => {
    const out = (patch: Partial<Record<keyof RationaleOutput, unknown>>) =>
      ({ ...RATIONALE_OUT, ...patch }) as RationaleOutput;
    expect(() => rationaleChange(null as never, held)).toThrow(TypeError);
    expect(() => rationaleChange(out({ thesis: 5 }), held)).toThrow(TypeError);
    expect(() => rationaleChange(RATIONALE_OUT, null as never)).toThrow(TypeError);
    expect(() => rationaleChange(RATIONALE_OUT, { ...held, direction: "x" } as never)).toThrow(
      TypeError,
    );
    for (const bad of [
      out({ thesis: " untrimmed" }),
      out({ oneLiner: "a".repeat(141) }),
      out({ do: [] }),
      out({ dont: Array(7).fill("No.") }),
      out({ do: ["a".repeat(161)] }),
      { ...RATIONALE_OUT, extra: 1 } as RationaleOutput,
    ]) {
      expect(() => rationaleChange(bad, held)).toThrow(RangeError);
      expect(() => rationaleChange(bad, held)).toThrow(/^rationaleChange: /);
    }
  });
});

describe("C-AI-03 the vibe tables of section 9.4", () => {
  it("C-AI-03 MOOD_TAGS lists the sixteen tags, frozen", () => {
    expect(MOOD_TAGS).toEqual([
      "calm",
      "warm",
      "cool",
      "bold",
      "playful",
      "serious",
      "earthy",
      "airy",
      "moody",
      "bright",
      "soft",
      "luxurious",
      "technical",
      "organic",
      "retro",
      "minimal",
    ]);
    expect(Object.isFrozen(MOOD_TAGS)).toBe(true);
  });

  it("C-AI-03 TYPE_VIBES map to their pairings, each a pairing of the engine", () => {
    expect(TYPE_VIBES).toEqual([
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
    for (const id of Object.values(TYPE_VIBE_PAIRING)) expect(PAIRING_IDS).toContain(id);
    expect(Object.isFrozen(TYPE_VIBES)).toBe(true);
    expect(Object.isFrozen(TYPE_VIBE_PAIRING)).toBe(true);
  });
});
