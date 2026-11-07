import type * as AiModule from "@/ai";
import {
  applyPreset,
  FONT_CATALOG,
  freshParams,
  generateSystem,
  lintSpec,
  measureSpec,
  oklchToRgb,
  type PaletteName,
  PRESETS,
  presetOf,
  resolveParams,
  summarize,
  toHex,
} from "@/engine";
import { HERO_PARAMS, heroSpec } from "@/features/landing/heroes";
import { STORY_ROLES } from "@/features/landing/story";
import { mergeParams } from "@/features/studio/params";
import { type DesignSpec, encodeSpec, lotTag, specId } from "@/spec";
import type { GalleryData, GalleryEntry, SpecimenPalette } from "./data";
import { type BriefDef, GALLERY_DEFS, type GalleryDef } from "./defs";

/** The three names of the AI core the builder calls. `@/ai` is named in `import type` only (C-GUARD6-06). */
export type GalleryAi = Pick<typeof AiModule, "briefColors" | "matchLexicon" | "briefChange">;

const SLUG = /^[a-z]+(-[a-z]+)*$/;
const AI_NAMES = ["briefColors", "matchLexicon", "briefChange"] as const;
const SPECIMEN: readonly SpecimenPalette[] = [
  "primary",
  "secondary",
  "accent",
  "neutral",
  "danger",
];
const SPECIMEN_STEPS = [100, 300, 500, 700, 900];
/** The steps that take the display family, as the DTCG export assigns them (app code cannot import `@/export`). */
const HEADING_STEPS: readonly string[] = ["display", "h1", "h2", "h3", "h4"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function typeName(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function needRecord(value: unknown, path: string, caller: string): void {
  if (!isRecord(value)) {
    throw new TypeError(`${caller}: ${path} must be an object, got ${typeName(value)}`);
  }
}

/**
 * The design a brief entry makes, by the studio's rule-based path (R6-06): the six steps a visitor's
 * "Read the brief" runs with no model answering. `ai` is the `@/ai` entry, passed in. A brief with a
 * color literal, or with no term of the word list, is a `RangeError` naming this function and the slug.
 */
export function briefSpec(
  def: BriefDef,
  ai: GalleryAi,
): { readonly spec: DesignSpec; readonly terms: readonly string[] } {
  needRecord(def, "def", "briefSpec");
  if (def.source !== "brief") {
    throw new RangeError(
      `briefSpec: def.source must be "brief", got ${JSON.stringify(def.source)}`,
    );
  }
  for (const field of ["slug", "name", "seed", "brief"] as const) {
    if (typeof def[field] !== "string") {
      throw new TypeError(`briefSpec: def.${field} must be a string, got ${typeName(def[field])}`);
    }
  }
  if (!SLUG.test(def.slug)) {
    throw new RangeError(
      `briefSpec: def.slug must be lowercase words joined by hyphens, got "${def.slug}"`,
    );
  }
  needRecord(ai, "ai", "briefSpec");
  for (const name of AI_NAMES) {
    if (typeof ai[name] !== "function") {
      throw new TypeError(`briefSpec: ai.${name} must be a function, got ${typeName(ai[name])}`);
    }
  }
  const { seeds, rest } = ai.briefColors(def.brief);
  if (seeds.length > 0) {
    throw new RangeError(
      `briefSpec: the brief of "${def.slug}" holds a color, and gallery briefs hold none`,
    );
  }
  const match = ai.matchLexicon(rest);
  if (match.draft === null) {
    throw new RangeError(`briefSpec: the brief of "${def.slug}" matches no term of the word list`);
  }
  const base = mergeParams(freshParams(), { name: def.name, oneLiner: def.brief });
  const { preset, patch } = ai.briefChange(match.draft, { params: base, literals: [] });
  const params = mergeParams(preset === undefined ? base : applyPreset(base, preset), patch);
  return {
    spec: generateSystem(resolveParams(params, def.seed), def.seed, { createdWith: "lexicon" }),
    terms: [...match.terms],
  };
}

/** Checks the sections `galleryEntry` reads, as `paramsOfSpec` checks them. */
function checkSpec(spec: unknown): asserts spec is DesignSpec {
  needRecord(spec, "spec", "galleryEntry");
  const s = spec as Record<string, Record<string, unknown>>;
  needRecord(s.meta, "spec.meta", "galleryEntry");
  needRecord(s.color, "spec.color", "galleryEntry");
  needRecord(s.color?.params, "spec.color.params", "galleryEntry");
  needRecord(s.color?.palettes, "spec.color.palettes", "galleryEntry");
  needRecord(s.color?.roles, "spec.color.roles", "galleryEntry");
  needRecord(s.type, "spec.type", "galleryEntry");
  needRecord(s.type?.families, "spec.type.families", "galleryEntry");
  if (!Array.isArray(s.type?.steps)) {
    throw new TypeError(
      `galleryEntry: spec.type.steps must be an array, got ${typeName(s.type?.steps)}`,
    );
  }
}

/** A catalog family's name, or its id for a family outside the catalog. */
const familyName = (id: string): string =>
  FONT_CATALOG.find((font) => font.id === id)?.family ?? id;

/** The line of a hero entry: its locked seed's hex (R6-08). */
function heroLine(def: GalleryDef): string {
  const params = def.source === "hero" ? HERO_PARAMS[def.hero] : undefined;
  if (params === undefined) {
    throw new RangeError(`galleryEntry: "${def.slug}" names no hero design`);
  }
  return `One locked seed, ${toHex(oklchToRgb(params.primary, "srgb"))}, and the studio's defaults.`;
}

type Mode = "light" | "dark";

/** Every palette's eleven hexes in `mode`, in the spec's palette order. */
function scales(spec: DesignSpec, mode: Mode): GalleryEntry["scales"][Mode] {
  const names = Object.keys(spec.color.palettes) as PaletteName[];
  const out = {} as Record<PaletteName, readonly string[]>;
  for (const name of names) out[name] = spec.color.palettes[name][mode].map((entry) => entry.hex);
  return out;
}

/** The six roles of the landing's story in `mode`. */
function roles(spec: DesignSpec, mode: Mode): GalleryEntry["roles"][Mode] {
  return STORY_ROLES.map((name) => ({ name, hex: spec.color.roles[mode][name] as string }));
}

/** One entry of `gallery.json` for `spec` (R6-08), in `GalleryEntry`'s key order. */
export function galleryEntry(
  spec: DesignSpec,
  def: GalleryDef,
  terms: readonly string[],
): GalleryEntry {
  checkSpec(spec);
  needRecord(def, "def", "galleryEntry");
  if (typeof def.slug !== "string" || !SLUG.test(def.slug)) {
    throw new RangeError(
      `galleryEntry: def.slug must be lowercase words joined by hyphens, got ${JSON.stringify(def.slug)}`,
    );
  }
  const id = specId(spec);
  const preset = presetOf(spec);
  const { families } = spec.type;
  return {
    slug: def.slug,
    name: def.source === "brief" ? def.name : spec.meta.name,
    source: def.source,
    line: def.source === "brief" ? def.brief : heroLine(def),
    brief: def.source === "brief" ? def.brief : null,
    terms: [...terms],
    tags: [...def.tags],
    preset,
    presetLabel: preset === null ? "Custom" : PRESETS[preset].label,
    specId: id,
    lot: lotTag(id),
    createdWith: spec.meta.createdWith as GalleryEntry["createdWith"],
    link: encodeSpec(spec),
    summary: summarize(measureSpec(spec), lintSpec(spec), spec.color.params.gamut),
    families: {
      display: familyName(families.display),
      body: familyName(families.body),
      mono: familyName(families.mono),
    },
    specimen: SPECIMEN.map((palette) => ({
      palette,
      hexes: SPECIMEN_STEPS.map(
        (step) =>
          spec.color.palettes[palette].light.find((entry) => entry.step === step)?.hex as string,
      ),
    })),
    scales: {
      light: scales(spec, "light"),
      dark: scales(spec, "dark"),
    },
    roles: {
      light: roles(spec, "light"),
      dark: roles(spec, "dark"),
    },
    type: spec.type.steps.map((step) => ({
      name: step.name,
      sizePx: step.sizePx,
      lineHeightPx: step.lineHeightPx,
      family: HEADING_STEPS.includes(step.name) ? "display" : "body",
    })),
  };
}

/** The 24 entries in `GALLERY_DEFS` order (R6-05); the heroes have no terms. */
export function galleryData(ai: GalleryAi): GalleryData {
  if (!isRecord(ai)) {
    throw new TypeError(`galleryData: ai must be the @/ai module, got ${typeName(ai)}`);
  }
  return {
    entries: GALLERY_DEFS.map((def) => {
      if (def.source === "hero") return galleryEntry(heroSpec(def.hero), def, []);
      const { spec, terms } = briefSpec(def, ai);
      return galleryEntry(spec, def, terms);
    }),
  };
}
