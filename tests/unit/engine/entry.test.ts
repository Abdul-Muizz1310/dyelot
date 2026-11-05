import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { DirectionParams, Finding, LintedSpec } from "@/engine";
import * as engine from "@/engine";
import { pickChartColors } from "@/engine/color/chart";
import { meets, perceptualLc, wcagRatio } from "@/engine/color/contrast";
import { formatOklch, hexToRgb, oklchToRgb, rgbToOklch, toHex } from "@/engine/color/convert";
import { DEFICIENCIES, simulate } from "@/engine/color/cvd";
import { deltaEOK } from "@/engine/color/deltae";
import { ColorParseError } from "@/engine/color/errors";
import { gamutMap } from "@/engine/color/gamut";
import { GAMUTS } from "@/engine/color/guards";
import { HARMONIES } from "@/engine/color/harmony";
import { indexNames, nearestName } from "@/engine/color/names";
import {
  CHROMA_LEVELS,
  CONTRAST_LEVELS,
  LOCKABLE,
  NEUTRAL_TINTS,
  normalizeSeed,
  PALETTE_NAMES,
  SCALE_MODES,
} from "@/engine/color/palette";
import { parseColor } from "@/engine/color/parse";
import { onFill, ROLE_NAMES, resolveRoles } from "@/engine/color/roles";
import { STEPS, UnsatisfiableTargetError } from "@/engine/color/scale";
import {
  FONT_CATALOG,
  fontFiles,
  fontStack,
  genericness,
  HIGH_GENERICNESS_FAMILIES,
} from "@/engine/fonts/catalog";
import { choosePairing, PAIRING_IDS, PAIRINGS } from "@/engine/fonts/pairings";
import { ENGINE_VERSION, generateSystem } from "@/engine/generate";
import { imagePalette } from "@/engine/image/palette";
import { lintSpec } from "@/engine/lint";
import { RULE_IDS } from "@/engine/lint/types";
import { CONTRAST_CHECKS, measureSpec, summarize } from "@/engine/measure";
import { freshParams, paramsOfSpec, resolveParams } from "@/engine/params";
import { applyPreset, PRESET_IDS, PRESETS, presetOf } from "@/engine/presets";
import { round6, roundHue } from "@/engine/round";
import { shadows } from "@/engine/tokens/depth";
import { motionTokens } from "@/engine/tokens/motion";
import { nestedRadius, RADIUS_SET_NAMES, radiusScale } from "@/engine/tokens/shape";
import { spaceScale } from "@/engine/tokens/space";
import { springCurve } from "@/engine/tokens/spring";
import { TYPE_CONTEXTS, typeScale } from "@/engine/tokens/type";
import { typeWeights } from "@/engine/tokens/weights";
import type { DesignSpec } from "@/spec";
import * as spec from "@/spec";
import { canonicalize } from "@/spec/canonical";
import { specId } from "@/spec/hash";
import { lotTag } from "@/spec/lot";
import { DEPTH_STYLES, MOTION_FEELS } from "@/spec/schema";
import { isPlainText, toPlainText } from "@/spec/text";
import { decodeSpec, encodeSpec } from "@/spec/url-codec";
import { DEFAULT_PARAMS, defaultSpec } from "../spec/support";

// Cases are the C-ENTRY-nn rows of docs/specs/02-studio.md, section 6.1. C-ENTRY-12 (imports
// between the engine and the spec), C-ENTRY-16 (one definition per bound), C-ENTRY-17 and
// C-ENTRY-18 live in repo-guards.test.ts.

const ROOT = path.resolve(import.meta.dirname, "../../..");

/** The runtime keys of src/engine/index.ts, section 6.1 (R2-02): the whole set, once every task has landed. */
const ENGINE_KEYS = [
  "CONTRAST_CHECKS",
  "ColorParseError",
  "DEFICIENCIES",
  "DEPTH_STYLES",
  "ENGINE_VERSION",
  "FONT_CATALOG",
  "GAMUTS",
  "HARMONIES",
  "HIGH_GENERICNESS_FAMILIES",
  "LOCKABLE",
  "MOTION_FEELS",
  "NEUTRAL_TINTS",
  "PAIRINGS",
  "PAIRING_IDS",
  "PALETTE_NAMES",
  "PRESETS",
  "PRESET_IDS",
  "RADIUS_SET_NAMES",
  "ROLE_NAMES",
  "RULE_IDS",
  "SCALE_MODES",
  "STEPS",
  "TYPE_CONTEXTS",
  "UnsatisfiableTargetError",
  "CHROMA_LEVELS",
  "CONTRAST_LEVELS",
  "applyPreset",
  "choosePairing",
  "deltaEOK",
  "fontFiles",
  "fontStack",
  "formatOklch",
  "freshParams",
  "gamutMap",
  "generateSystem",
  "genericness",
  "hexToRgb",
  "imagePalette",
  "indexNames",
  "lintSpec",
  "measureSpec",
  "meets",
  "motionTokens",
  "nearestName",
  "nestedRadius",
  "normalizeSeed",
  "oklchToRgb",
  "onFill",
  "paramsOfSpec",
  "parseColor",
  "perceptualLc",
  "presetOf",
  "radiusScale",
  "resolveParams",
  "rgbToOklch",
  "round6",
  "roundHue",
  "shadows",
  "simulate",
  "spaceScale",
  "springCurve",
  "summarize",
  "toHex",
  "typeScale",
  "typeWeights",
  "wcagRatio",
];

/**
 * Keys whose module a later task of M2 creates. Task 2.4 landed the last of them (presets, pairing
 * choice and color names), so the list is empty and the entry holds the whole set. A key joins the
 * entry only when the full set above names it.
 */
const PENDING_KEYS: readonly string[] = [];

/** M3's engine key set: the entry's keys before Task 4.6a. */
const M3_ENGINE_KEYS: readonly string[] = ENGINE_KEYS.filter((key) => key !== "imagePalette");

const SPEC_KEYS = [
  "DesignSpecSchema",
  "SpecDecodeError",
  "canonicalize",
  "decodeSpec",
  "encodeSpec",
  "isPlainText",
  "lotTag",
  "normalizeSpec",
  "specId",
  "toPlainText",
];

const sorted = (keys: readonly string[]): string[] => [...keys].sort();

describe("the engine entry", () => {
  it("C-ENTRY-01 and C-ENTRY3-01 export the section 6.1 set and nothing else, bar the keys a later task adds", () => {
    expect(sorted(Object.keys(engine))).toEqual(
      sorted(ENGINE_KEYS.filter((key) => !PENDING_KEYS.includes(key))),
    );
    for (const key of PENDING_KEYS) expect(ENGINE_KEYS).toContain(key);
  });

  it("C-ENTRY-01 exports, for every key, the very object its home module exports", () => {
    const exported: Record<string, unknown> = { ...engine };
    const homes: Record<string, unknown> = {
      CONTRAST_CHECKS,
      ColorParseError,
      DEFICIENCIES,
      DEPTH_STYLES,
      ENGINE_VERSION,
      FONT_CATALOG,
      GAMUTS,
      HARMONIES,
      HIGH_GENERICNESS_FAMILIES,
      LOCKABLE,
      MOTION_FEELS,
      NEUTRAL_TINTS,
      PAIRINGS,
      PAIRING_IDS,
      PALETTE_NAMES,
      PRESETS,
      PRESET_IDS,
      RADIUS_SET_NAMES,
      ROLE_NAMES,
      RULE_IDS,
      SCALE_MODES,
      STEPS,
      TYPE_CONTEXTS,
      UnsatisfiableTargetError,
      CHROMA_LEVELS,
      CONTRAST_LEVELS,
      applyPreset,
      choosePairing,
      deltaEOK,
      fontFiles,
      fontStack,
      formatOklch,
      freshParams,
      gamutMap,
      generateSystem,
      genericness,
      hexToRgb,
      imagePalette,
      indexNames,
      lintSpec,
      measureSpec,
      meets,
      motionTokens,
      nearestName,
      nestedRadius,
      normalizeSeed,
      oklchToRgb,
      onFill,
      paramsOfSpec,
      parseColor,
      perceptualLc,
      presetOf,
      radiusScale,
      resolveParams,
      rgbToOklch,
      round6,
      roundHue,
      shadows,
      simulate,
      spaceScale,
      springCurve,
      summarize,
      toHex,
      typeScale,
      typeWeights,
      wcagRatio,
    };
    // Every present key has a home entry here, and the pending keys have none until their task lands.
    expect(sorted(Object.keys(homes))).toEqual(sorted(Object.keys(exported)));
    for (const [name, home] of Object.entries(homes)) {
      expect(exported[name], name).toBe(home);
    }
  });

  it("C-ENTRY4-01 exports imagePalette beside M3's keys, the very function its module exports, and no other new key", () => {
    expect(ENGINE_KEYS).toContain("imagePalette");
    expect(engine.imagePalette).toBe(imagePalette);
    expect(sorted(Object.keys(engine)).filter((key) => !M3_ENGINE_KEYS.includes(key))).toEqual([
      "imagePalette",
    ]);
    expect(sorted(Object.keys(spec))).toEqual(sorted(SPEC_KEYS));
  });

  it.each(["multiply", "runRules", "tryOklchToRgb", "gamutExcess"])(
    "C-ENTRY-02 does not export %s",
    (name) => {
      expect(name in engine).toBe(false);
      expect((engine as Record<string, unknown>)[name]).toBeUndefined();
    },
  );

  it("C-ENTRY-08 keeps the contents of the exported tables", () => {
    expect(engine.STEPS).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
    expect(engine.ROLE_NAMES).toHaveLength(46);
    expect(engine.PALETTE_NAMES).toHaveLength(8);
  });
});

describe("the spec entry", () => {
  it("C-ENTRY-03 and C-ENTRY3-01 export the section 6.1 set and nothing else", () => {
    expect(sorted(Object.keys(spec))).toEqual(sorted(SPEC_KEYS));
  });

  it.each(["SPEC_VERSION", "fnv1a64", "canonicalJson"])("C-ENTRY-04 does not export %s", (name) => {
    expect((spec as Record<string, unknown>)[name]).toBeUndefined();
  });

  it("C-ENTRY-01 exports the very objects its home modules export", () => {
    expect(spec.canonicalize).toBe(canonicalize);
    expect(spec.specId).toBe(specId);
    expect(spec.encodeSpec).toBe(encodeSpec);
    expect(spec.decodeSpec).toBe(decodeSpec);
    expect(spec.lotTag).toBe(lotTag);
    expect(spec.isPlainText).toBe(isPlainText);
    expect(spec.toPlainText).toBe(toPlainText);
  });
});

describe("frozen tables", () => {
  const exported: Record<string, unknown> = { ...engine };
  const TABLES = [
    "STEPS",
    "PALETTE_NAMES",
    "ROLE_NAMES",
    "RULE_IDS",
    "HARMONIES",
    "GAMUTS",
    "CHROMA_LEVELS",
    "NEUTRAL_TINTS",
    "SCALE_MODES",
    "CONTRAST_LEVELS",
    "TYPE_CONTEXTS",
    "RADIUS_SET_NAMES",
    "DEPTH_STYLES",
    "MOTION_FEELS",
    "DEFICIENCIES",
    "LOCKABLE",
    "FONT_CATALOG",
    "HIGH_GENERICNESS_FAMILIES",
    "PAIRINGS",
    "PAIRING_IDS",
    "PRESET_IDS",
  ] as const;

  it.each(TABLES)("C-ENTRY-05 freezes %s", (name) => {
    expect(Object.isFrozen(exported[name]), name).toBe(true);
  });

  it("C-ENTRY-06 freezes the font tables, every entry and every array inside an entry", () => {
    for (const table of [
      engine.FONT_CATALOG,
      engine.PAIRINGS,
      engine.HIGH_GENERICNESS_FAMILIES,
      engine.PRESETS,
    ]) {
      expect(Object.isFrozen(table)).toBe(true);
    }
    for (const preset of Object.values(engine.PRESETS)) {
      for (const part of [
        preset,
        preset.params,
        preset.params.type,
        preset.view,
        preset.guards,
        preset.unexpressed,
      ]) {
        expect(Object.isFrozen(part), preset.id).toBe(true);
      }
    }
    for (const font of engine.FONT_CATALOG) {
      expect(Object.isFrozen(font), font.id).toBe(true);
      expect(Object.isFrozen(font.axes), font.id).toBe(true);
      expect(Object.isFrozen(font.weights), font.id).toBe(true);
    }
    for (const pairing of engine.PAIRINGS) {
      expect(Object.isFrozen(pairing), pairing.id).toBe(true);
      expect(Object.isFrozen(pairing.fit), pairing.id).toBe(true);
    }
  });

  it("C-ENTRY-07 throws TypeError on a write to a font table", () => {
    const first = engine.FONT_CATALOG[0] as { family: string };
    expect(() => {
      first.family = "x";
    }).toThrow(TypeError);
    expect(() => (engine.PAIRING_IDS as string[]).push("x")).toThrow(TypeError);
  });

  it("C-ENTRY-07 throws TypeError on a write", () => {
    expect(() => (engine.STEPS as unknown as number[]).push(1)).toThrow(TypeError);
    expect(() => {
      (engine.ROLE_NAMES as unknown as string[])[0] = "x";
    }).toThrow(TypeError);
  });
});

describe("the type entry", () => {
  it("C-ENTRY-09 exports the types, and a DesignSpec is a LintedSpec", () => {
    expectTypeOf<DirectionParams>().toHaveProperty("harmony");
    expectTypeOf<Finding>().toHaveProperty("id");
    expectTypeOf<DesignSpec>().toExtend<LintedSpec>();
    const linted: LintedSpec = defaultSpec();
    expect(lintSpec(linted)).toBeDefined();
  });
});

describe("the entry points keep their behavior", () => {
  it("C-ENTRY-13 simulate works and names itself through assertOneOf", () => {
    expect(simulate([1, 0, 0], "protan")).toHaveLength(3);
    expect(() => simulate([1, 0, 0], "x" as never)).toThrow(RangeError);
    expect(() => simulate([1, 0, 0], "x" as never)).toThrow(/^simulate: deficiency must be one of/);
    expect(() => simulate([1, 0, 0], 1 as never)).toThrow(TypeError);
  });

  it("C-ENTRY-15 names the public function in every error of the spec entry", () => {
    const bad = { ...structuredClone(defaultSpec()), f: () => 1 } as unknown as DesignSpec;
    expect(() => encodeSpec(bad)).toThrow(/^encodeSpec:/);
    expect(() => specId(bad)).toThrow(/^specId:/);
    expect(() => encodeSpec(null as unknown as DesignSpec)).toThrow(/^encodeSpec:/);
    expect(() => specId([] as unknown as DesignSpec)).toThrow(/^specId:/);
    expect(() => canonicalize(bad)).toThrow(/^canonicalize:/);
    const nan = structuredClone(defaultSpec());
    nan.color.palettes.primary.hue = Number.NaN;
    expect(() => encodeSpec(nan)).toThrow(/^encodeSpec: spec\.color/);
    expect(() => generateSystem(DEFAULT_PARAMS, "")).toThrow(/^generateSystem:/);
    // lintSpec (Task 2.4): the R-05 checks name the public function.
    expect(() => lintSpec(null as never)).toThrow(/^lintSpec:/);
    const noPalette = structuredClone(defaultSpec()) as unknown as { color: { palettes: object } };
    noPalette.color.palettes = {};
    expect(() => lintSpec(noPalette as never)).toThrow(/^lintSpec:/);
    const badRole = structuredClone(defaultSpec());
    (badRole.color.roles.light as Record<string, string>).primary = "red";
    expect(() => lintSpec(badRole)).toThrow(/^lintSpec:/);
  });
});

describe("palette checks", () => {
  it("C-ENTRY-14 names the function that read the palettes in a TypeError", () => {
    const palettes = generateSystem(DEFAULT_PARAMS, "seed-1").color.palettes;
    const { info: _info, ...noInfo } = palettes;
    const { neutral: _neutral, ...noNeutral } = palettes;
    const short = {
      ...palettes,
      primary: { ...palettes.primary, light: palettes.primary.light.slice(1) },
    };
    const chart = ["#111111", "#222222", "#333333", "#444444", "#555555"];
    expect(() => resolveRoles(noInfo as never, "light", "AA", chart as never)).toThrow(TypeError);
    expect(() => resolveRoles(noInfo as never, "light", "AA", chart as never)).toThrow(
      /^resolveRoles: p\.info must be a palette/,
    );
    expect(() => resolveRoles(short as never, "light", "AA", chart as never)).toThrow(TypeError);
    expect(() => resolveRoles(short as never, "light", "AA", chart as never)).toThrow(
      /^resolveRoles: p\.primary\.light must hold 11 steps/,
    );
    for (const bad of [noNeutral, short]) {
      expect(() => pickChartColors(bad as never, "light", "srgb")).toThrow(TypeError);
      expect(() => pickChartColors(bad as never, "light", "srgb")).toThrow(/^pickChartColors: p\./);
    }
  });
});

describe("the Biome deep-import rule", () => {
  /** The `noRestrictedImports` diagnostics Biome reports for `source`, written under `folder`. */
  function restricted(folder: string, source: string): boolean {
    const parent = path.join(ROOT, folder);
    const parentExisted = existsSync(parent);
    const dir = path.join(parent, "__entry-probe__");
    mkdirSync(dir, { recursive: true });
    try {
      const file = path.join(dir, "probe.ts");
      writeFileSync(file, source);
      const run = spawnSync("pnpm", ["exec", "biome", "lint", file], {
        cwd: ROOT,
        encoding: "utf8",
      });
      // A failed spawn, a crash or a file Biome never linted must not read as "no diagnostic"
      // (status 0 clean, 1 findings; a missing or ignored path also exits 1 but checks no file).
      expect(run.error).toBeUndefined();
      expect([0, 1]).toContain(run.status);
      const output = `${run.stdout}${run.stderr}`;
      expect(output).toMatch(/Checked 1 file/);
      return output.includes("noRestrictedImports");
    } finally {
      rmSync(dir, { recursive: true, force: true });
      // Non-recursive: never delete source files another process wrote meanwhile.
      if (!parentExisted) {
        try {
          rmdirSync(parent);
        } catch {
          // Not empty: leave it.
        }
      }
    }
  }
  const use = (specifier: string): string =>
    `import { x } from "${specifier}";\n\nexport const y = x;\n`;

  it.each([
    "@/engine/color/palette",
    "@/spec/schema",
    "../../engine/generate",
    "../../spec/schema",
  ])("C-ENTRY-10 rejects a deep import of %s from src/features", (specifier) => {
    expect(restricted("src/features", use(specifier))).toBe(true);
  });

  it.each(["src/app", "src/components", "src/lib"])(
    "C-ENTRY-10 rejects a deep import from %s",
    (folder) => {
      expect(restricted(folder, use("@/engine/generate"))).toBe(true);
    },
  );

  it("C-ENTRY-11 accepts the entries", () => {
    expect(restricted("src/features", use("@/engine"))).toBe(false);
    expect(restricted("src/features", use("@/spec"))).toBe(false);
  });

  it("keeps the zod restriction in the folders the rule covers", () => {
    expect(restricted("src/features", use("zod"))).toBe(true);
  });
});
