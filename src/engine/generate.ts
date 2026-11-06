import { canonicalizeFor, canonicalJson, checkCanonical } from "../spec/canonical";
import {
  ADJECTIVE_MAX,
  type CreatedWith,
  CreatedWithSchema,
  DEPTH_STYLES,
  type DepthStyle,
  type DesignSpec,
  DesignSpecSchema,
  type Direction,
  type DirectionParams,
  LIKE_MAX,
  LIST_MAX,
  MOTION_FEELS,
  type MotionFeel,
  NAME_MAX,
  ONE_LINER_MAX,
  RULE_MAX,
  RULES_MAX,
  SEED_MAX,
  SPEC_VERSION,
  THESIS_MAX,
} from "../spec/schema";
import { isPlainText } from "../spec/text";
import { pickChartColors } from "./color/chart";
import { assertFinite, assertOneOf, describeType, GAMUTS } from "./color/guards";
import { HARMONIES } from "./color/harmony";
import {
  buildPalettes,
  CHROMA_LEVELS,
  CONTRAST_LEVELS,
  type ColorParams,
  LOCKABLE,
  type Lockable,
  NEUTRAL_TINTS,
  normalizeSeed,
  type Palette,
  type PaletteName,
  SCALE_MODES,
} from "./color/palette";
import { resolveRoles } from "./color/roles";
import { STEPS } from "./color/scale";
import type { Mode, Oklch } from "./color/types";
import { PAIRING_IDS, pairingById } from "./fonts/pairings";
import { seededRandom } from "./random";
import { round6 } from "./round";
import { shadows } from "./tokens/depth";
import { type MotionTokens, motionTokens, normalizeMotionTokens } from "./tokens/motion";
import { RADIUS_SET_NAMES, type RadiusSet, radiusScale } from "./tokens/shape";
import { spaceScale } from "./tokens/space";
import { TYPE_CONTEXTS, type TypeContext, typeScale } from "./tokens/type";

/** The engine that wrote a spec; `meta.engineVersion` records it. */
export const ENGINE_VERSION = "dyelot.engine/1";

const UNTITLED = "untitled";
const SPACE_BASE = 4;
const SHADOW_STEP = STEPS.indexOf(950);
type Seeds = Partial<Record<Lockable, Oklch>>;

/** The parameters, read once and checked: what the generator builds from. */
type Parsed = {
  /**
   * The color parameters with the seeds as stored: rounded, achromatic rule applied (R-02, R-03).
   * The palettes are built from these same values, so a spec regenerated from what it records is
   * identical (C-GEN-13): R-10 tests the stored seed for gamut mapping.
   */
  readonly color: ColorParams;
  readonly context: TypeContext;
  readonly ratio: number | undefined;
  readonly radius: RadiusSet;
  readonly depth: DepthStyle;
  readonly motion: MotionFeel;
  /** The normalized tokens of `params.motionTokens`; absent means `motionTokens()` (R5-10). */
  readonly motionTokens: MotionTokens | undefined;
  readonly name: string;
  readonly oneLiner: string | undefined;
  readonly direction: Direction | undefined;
  readonly rules: { readonly do: readonly string[]; readonly dont: readonly string[] } | undefined;
  /** The three font ids: the pairing's, or M1's default when `pairing` is absent. */
  readonly families: { readonly display: string; readonly body: string; readonly mono: string };
};

/** M1's families, written when `params.pairing` is absent (R2-05): the `host-grotesk` pairing. */
const DEFAULT_FAMILIES = { display: "host-grotesk", body: "host-grotesk", mono: "fragment-mono" };

function checkText(value: unknown, max: number, name: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string, got ${describeType(value)}`);
  }
  if (value.length < 1 || value.length > max) {
    throw new RangeError(`${name} must be 1 to ${max} characters, got ${value.length}`);
  }
  return value;
}

/** Plain text (R3-02) of 1 to `max` characters: a TypeError for a non-string, else a RangeError. */
function checkPlain(value: unknown, max: number, name: string): string {
  const text = checkText(value, max, name);
  if (!isPlainText(text)) {
    throw new RangeError(`${name} must be plain text, got ${JSON.stringify(value)}`);
  }
  return text;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkObject(value: unknown, name: string): Record<string, unknown> {
  if (!isObject(value)) {
    throw new TypeError(`${name} must be an object, got ${describeType(value)}`);
  }
  return value;
}

/** A list of plain texts within `bounds`. */
function checkList(value: unknown, bounds: ListBounds, name: string): string[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array, got ${describeType(value)}`);
  }
  if (value.length < bounds.min || value.length > bounds.maxLength) {
    throw new RangeError(
      `${name} must have ${bounds.min} to ${bounds.maxLength} entries, got ${value.length}`,
    );
  }
  return value.map((entry, index) => checkPlain(entry, bounds.maxChars, `${name}[${index}]`));
}

type ListBounds = { min: number; maxLength: number; maxChars: number };

const DIRECTION_LISTS = {
  adjectives: { min: 1, maxLength: LIST_MAX, maxChars: ADJECTIVE_MAX },
  like: { min: 1, maxLength: LIST_MAX, maxChars: LIKE_MAX },
  unlike: { min: 1, maxLength: LIST_MAX, maxChars: LIKE_MAX },
} as const;
const RULES_LISTS: ListBounds = { min: 0, maxLength: RULES_MAX, maxChars: RULE_MAX };

/** `params.direction`: a strict object with at least one of its four keys (R3-01). */
function checkDirection(value: unknown): Direction | undefined {
  if (value === undefined) return undefined;
  const name = "generateSystem: params.direction";
  const source = checkObject(value, name);
  const keys = Object.keys(source);
  const known = ["thesis", ...Object.keys(DIRECTION_LISTS)];
  const unknownKey = keys.find((key) => !known.includes(key));
  if (unknownKey !== undefined) throw new RangeError(`${name} has an unknown key "${unknownKey}"`);
  if (keys.length === 0) throw new RangeError(`${name} must have at least one key`);
  const { thesis, adjectives, like, unlike } = source;
  return {
    ...(Object.hasOwn(source, "thesis")
      ? { thesis: checkPlain(thesis, THESIS_MAX, `${name}.thesis`) }
      : {}),
    ...(Object.hasOwn(source, "adjectives")
      ? { adjectives: checkList(adjectives, DIRECTION_LISTS.adjectives, `${name}.adjectives`) }
      : {}),
    ...(Object.hasOwn(source, "like")
      ? { like: checkList(like, DIRECTION_LISTS.like, `${name}.like`) }
      : {}),
    ...(Object.hasOwn(source, "unlike")
      ? { unlike: checkList(unlike, DIRECTION_LISTS.unlike, `${name}.unlike`) }
      : {}),
  };
}

/** `params.rules`: the two lists, each `RULES_MAX` entries of at most `RULE_MAX` plain characters, at least one character. */
function checkRules(value: unknown): Parsed["rules"] {
  if (value === undefined) return undefined;
  const name = "generateSystem: params.rules";
  const source = checkObject(value, name);
  return {
    do: checkList(source.do, RULES_LISTS, `${name}.do`),
    dont: checkList(source.dont, RULES_LISTS, `${name}.dont`),
  };
}

/**
 * A ratio in (1, 2], rounded with `round6` before use, so the stored ratio and the stored steps
 * agree (R-02). A ratio that rounds to 1 would leave the domain once stored, so it throws too.
 */
function checkRatio(ratio: unknown): number | undefined {
  if (ratio === undefined) return undefined;
  const name = "generateSystem: params.type.ratio";
  assertFinite(ratio, name);
  if (ratio <= 1 || ratio > 2) throw new RangeError(`${name} must lie in (1, 2], got ${ratio}`);
  const rounded = round6(ratio);
  if (rounded <= 1) {
    throw new RangeError(`${name} must stay above 1 at 6 significant digits, got ${ratio}`);
  }
  return rounded;
}

/**
 * Reads every parameter once and checks it before anything is drawn or solved, so each failure
 * names its field (R-20): RangeError for a value outside its domain, TypeError for a value of the
 * wrong type (R-05). The generator then builds from the result alone.
 */
function parseParams(params: DirectionParams, seed: string): Parsed {
  if (typeof params !== "object" || params === null) {
    throw new TypeError(`generateSystem: params must be an object, got ${describeType(params)}`);
  }
  checkText(seed, SEED_MAX, "generateSystem: seed");
  const { harmony, chroma, neutralTint, gamut, scaleMode, contrastLevel } = params;
  assertOneOf(harmony, HARMONIES, "generateSystem: params.harmony");
  assertOneOf(chroma, CHROMA_LEVELS, "generateSystem: params.chroma");
  assertOneOf(neutralTint, NEUTRAL_TINTS, "generateSystem: params.neutralTint");
  assertOneOf(gamut, GAMUTS, "generateSystem: params.gamut");
  assertOneOf(scaleMode, SCALE_MODES, "generateSystem: params.scaleMode");
  assertOneOf(contrastLevel, CONTRAST_LEVELS, "generateSystem: params.contrastLevel");
  // Read once: a getter could hand back another object between the check and the build.
  const type: unknown = params.type;
  if (typeof type !== "object" || type === null) {
    throw new TypeError(`generateSystem: params.type must be an object, got ${describeType(type)}`);
  }
  // Not yet checked: each field is unknown until assertOneOf and checkRatio parse it.
  const { context, ratio } = type as { readonly context?: unknown; readonly ratio?: unknown };
  assertOneOf(context, TYPE_CONTEXTS, "generateSystem: params.type.context");
  const { radius, depth, motion, name, oneLiner } = params;
  assertOneOf(radius, RADIUS_SET_NAMES, "generateSystem: params.radius");
  assertOneOf(depth, DEPTH_STYLES, "generateSystem: params.depth");
  assertOneOf(motion, MOTION_FEELS, "generateSystem: params.motion");
  // Read once, like `type`: a getter could hand back another value between the check and the build.
  const tokens: unknown = params.motionTokens;
  const pairing: unknown = params.pairing;
  let families = DEFAULT_FAMILIES;
  if (pairing !== undefined) {
    assertOneOf(pairing, PAIRING_IDS, "generateSystem: params.pairing");
    const chosen = pairingById(pairing);
    // assertOneOf ran against PAIRING_IDS, so a miss means PAIRINGS and PAIRING_IDS disagree: fail loudly.
    if (chosen === undefined) {
      throw new Error(`generateSystem: pairing "${pairing}" is listed but has no entry`);
    }
    families = { display: chosen.display, body: chosen.body, mono: chosen.mono };
  }
  const seeds: Seeds = {};
  for (const slot of LOCKABLE) {
    const color = params[slot];
    if (color === undefined) continue;
    seeds[slot] = normalizeSeed(color, `generateSystem: params.${slot}`);
  }
  return {
    color: { ...seeds, harmony, chroma, neutralTint, gamut, scaleMode, contrastLevel },
    context,
    ratio: checkRatio(ratio),
    radius,
    depth,
    motion,
    motionTokens:
      tokens === undefined
        ? undefined
        : normalizeMotionTokens(tokens as MotionTokens, "generateSystem: params.motionTokens"),
    name: name === undefined ? UNTITLED : checkPlain(name, NAME_MAX, "generateSystem: params.name"),
    oneLiner:
      oneLiner === undefined
        ? undefined
        : checkPlain(oneLiner, ONE_LINER_MAX, "generateSystem: params.oneLiner"),
    direction: checkDirection(params.direction),
    rules: checkRules(params.rules),
    families,
  };
}

/** The options of `generateSystem` (R4-36). */
type GenerateOptions = { readonly createdWith?: CreatedWith };

const OPTION_KEYS: readonly string[] = ["createdWith"];

/**
 * `meta.createdWith` from `generateSystem`'s options: "controls" when the options or the key are
 * absent, as before M4. The options must be an object with no other key, and `createdWith` a string
 * that `CreatedWithSchema` accepts (R-05: TypeError for a wrong type, RangeError for a wrong value).
 */
function createdWithOf(options: unknown): CreatedWith {
  if (options === undefined) return "controls";
  const name = "generateSystem: options";
  const source = checkObject(options, name);
  const unknownKey = Object.keys(source).find((key) => !OPTION_KEYS.includes(key));
  if (unknownKey !== undefined) {
    throw new RangeError(`${name}.${unknownKey} is not an option of generateSystem`);
  }
  // Read once: a getter could hand back another value between the check and the build.
  const createdWith: unknown = source.createdWith;
  if (createdWith === undefined) return "controls";
  if (typeof createdWith !== "string") {
    throw new TypeError(`${name}.createdWith must be a string, got ${describeType(createdWith)}`);
  }
  const parsed = CreatedWithSchema.safeParse(createdWith);
  if (!parsed.success) {
    throw new RangeError(
      `${name}.createdWith must be a value meta.createdWith takes, got ${JSON.stringify(createdWith)}`,
    );
  }
  return parsed.data;
}

function rolesFor(palettes: Record<PaletteName, Palette>, mode: Mode, color: ColorParams) {
  const chart = pickChartColors(palettes, mode, color.gamut);
  return resolveRoles(palettes, mode, color.contrastLevel, chart);
}

/**
 * A complete design system from direction parameters and a seed (spec section 6.7). It checks
 * its input (R-20), draws `seededRandom(seed)`, builds the palettes, picks each mode's chart
 * colors and resolves its roles at `params.contrastLevel`, then builds the type, space, shape,
 * depth and motion tokens. `color.params` stores the seeds as the engine stored them: rounded,
 * with the achromatic rule applied (R-02, R-03). Every number is stored through `round6`, and
 * the result always passes `DesignSpecSchema`. Generating again from what a spec records (its
 * color parameters, type, shape, depth and motion choices, name and seed) gives the same spec.
 * `options.createdWith` stamps `meta.createdWith` (R4-36); absent, it is "controls", so every spec
 * made before M4 is unchanged.
 */
export function generateSystem(
  params: DirectionParams,
  seed: string,
  options?: GenerateOptions,
): DesignSpec {
  const parsed = parseParams(params, seed);
  const createdWith = createdWithOf(options);
  const { context, ratio } = parsed;
  const palettes = buildPalettes(parsed.color, seededRandom(seed));
  const draft = {
    version: SPEC_VERSION,
    meta: {
      name: parsed.name,
      ...(parsed.oneLiner === undefined ? {} : { oneLiner: parsed.oneLiner }),
      seed,
      engineVersion: ENGINE_VERSION,
      createdWith,
    },
    ...(parsed.direction === undefined ? {} : { direction: parsed.direction }),
    color: {
      params: parsed.color,
      palettes,
      roles: {
        light: rolesFor(palettes, "light", parsed.color),
        dark: rolesFor(palettes, "dark", parsed.color),
      },
    },
    type: {
      families: parsed.families,
      context,
      ...(ratio === undefined ? {} : { ratio }),
      steps: typeScale(ratio === undefined ? { context } : { context, ratio }),
    },
    space: { basePx: SPACE_BASE, scale: spaceScale(SPACE_BASE) },
    shape: { radiusSet: parsed.radius, radii: radiusScale(parsed.radius) },
    depth: { style: parsed.depth, shadows: shadows(palettes.neutral.light[SHADOW_STEP].oklch) },
    motion: { feel: parsed.motion, ...(parsed.motionTokens ?? motionTokens()) },
    components: {
      cards: "interactive-only",
      emphasis: "one-filled-per-region",
      inputs: "outlined",
      icons: { library: "lucide", strokePx: 2 },
    },
    rules: parsed.rules ?? { do: [], dont: [] },
  };
  // R-02: every stored number through round6, a hue through roundHue. The canonical text does
  // exactly that, so reading it back gives the stored spec, which the schema checks and types.
  return DesignSpecSchema.parse(JSON.parse(canonicalJson(draft, "spec", "generateSystem")));
}

/**
 * The spec `generateSystem` would return for the spec's own parameters with `motionTokens: tokens`,
 * without running the solver (R5-11): `motion` becomes `{ feel, ...tokens }`, and the result takes
 * the same canonical round trip and schema parse that end `generateSystem`. The spec is checked
 * first, as `normalizeSpec` checks it, then the tokens. Errors start with `withMotion`.
 */
export function withMotion(spec: DesignSpec, tokens: MotionTokens): DesignSpec {
  const checked = checkCanonical(canonicalizeFor(spec, "withMotion"), "withMotion");
  const normalized = normalizeMotionTokens(tokens, "withMotion: tokens");
  const draft = { ...checked, motion: { feel: checked.motion.feel, ...normalized } };
  return DesignSpecSchema.parse(JSON.parse(canonicalJson(draft, "spec", "withMotion")));
}
