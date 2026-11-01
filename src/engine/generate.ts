import { canonicalJson } from "../spec/canonical";
import {
  DEPTH_STYLES,
  type DepthStyle,
  type DesignSpec,
  DesignSpecSchema,
  type DirectionParams,
  MOTION_FEELS,
  type MotionFeel,
  SPEC_VERSION,
} from "../spec/schema";
import { pickChartColors } from "./color/chart";
import { assertFinite, assertOneOf, describeType, GAMUTS } from "./color/guards";
import { HARMONIES } from "./color/harmony";
import {
  buildPalettes,
  CHROMA_LEVELS,
  CONTRAST_LEVELS,
  type ColorParams,
  NEUTRAL_TINTS,
  normalizeSeed,
  type Palette,
  type PaletteName,
  SCALE_MODES,
} from "./color/palette";
import { resolveRoles } from "./color/roles";
import { STEPS } from "./color/scale";
import type { Mode, Oklch } from "./color/types";
import { seededRandom } from "./random";
import { round6 } from "./round";
import { shadows } from "./tokens/depth";
import { motionTokens } from "./tokens/motion";
import { RADIUS_SET_NAMES, type RadiusSet, radiusScale } from "./tokens/shape";
import { spaceScale } from "./tokens/space";
import { TYPE_CONTEXTS, type TypeContext, typeScale } from "./tokens/type";

/** The engine that wrote a spec; `meta.engineVersion` records it. */
export const ENGINE_VERSION = "dyelot.engine/1";

// Bounds of R-20.
const NAME_MAX = 80;
const SEED_MAX = 128;
const UNTITLED = "untitled";
const SPACE_BASE = 4;
const SHADOW_STEP = STEPS.indexOf(950);
const LOCKABLE = ["primary", "secondary", "accent"] as const;

type Seeds = Partial<Record<(typeof LOCKABLE)[number], Oklch>>;

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
  readonly name: string;
};

function checkText(value: unknown, max: number, name: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string, got ${describeType(value)}`);
  }
  if (value.length < 1 || value.length > max) {
    throw new RangeError(`${name} must be 1 to ${max} characters, got ${value.length}`);
  }
  return value;
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
  const type: unknown = params.type;
  if (typeof type !== "object" || type === null) {
    throw new TypeError(`generateSystem: params.type must be an object, got ${describeType(type)}`);
  }
  const { context, ratio } = params.type;
  assertOneOf(context, TYPE_CONTEXTS, "generateSystem: params.type.context");
  const { radius, depth, motion, name } = params;
  assertOneOf(radius, RADIUS_SET_NAMES, "generateSystem: params.radius");
  assertOneOf(depth, DEPTH_STYLES, "generateSystem: params.depth");
  assertOneOf(motion, MOTION_FEELS, "generateSystem: params.motion");
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
    name: name === undefined ? UNTITLED : checkText(name, NAME_MAX, "generateSystem: params.name"),
  };
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
 */
export function generateSystem(params: DirectionParams, seed: string): DesignSpec {
  const parsed = parseParams(params, seed);
  const { context, ratio } = parsed;
  const palettes = buildPalettes(parsed.color, seededRandom(seed));
  const draft = {
    version: SPEC_VERSION,
    meta: { name: parsed.name, seed, engineVersion: ENGINE_VERSION, createdWith: "controls" },
    color: {
      params: parsed.color,
      palettes,
      roles: {
        light: rolesFor(palettes, "light", parsed.color),
        dark: rolesFor(palettes, "dark", parsed.color),
      },
    },
    type: {
      // M1 values for the fields M2 owns (spec section 6.7).
      families: { display: "host-grotesk", body: "host-grotesk", mono: "fragment-mono" },
      context,
      ...(ratio === undefined ? {} : { ratio }),
      steps: typeScale(ratio === undefined ? { context } : { context, ratio }),
    },
    space: { basePx: SPACE_BASE, scale: spaceScale(SPACE_BASE) },
    shape: { radiusSet: parsed.radius, radii: radiusScale(parsed.radius) },
    depth: { style: parsed.depth, shadows: shadows(palettes.neutral.light[SHADOW_STEP].oklch) },
    motion: { feel: parsed.motion, ...motionTokens() },
    components: {
      cards: "interactive-only",
      emphasis: "one-filled-per-region",
      inputs: "outlined",
      icons: { library: "lucide", strokePx: 2 },
    },
    rules: { do: [], dont: [] },
  };
  // R-02: every stored number through round6, a hue through roundHue. The canonical text does
  // exactly that, so reading it back gives the stored spec, which the schema checks and types.
  return DesignSpecSchema.parse(JSON.parse(canonicalJson(draft, "spec")));
}
