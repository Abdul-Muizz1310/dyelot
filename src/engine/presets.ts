import type { DepthStyle, DirectionParams, MotionFeel } from "../spec/schema";
import { assertOneOf, describeType } from "./color/guards";
import type { Harmony } from "./color/harmony";
import { CONTRAST_LEVELS, type ColorParams, type ContrastLevel } from "./color/palette";
import type { Mode } from "./color/types";
import type { PairingId } from "./fonts/pairings";
import type { RadiusSet } from "./tokens/shape";
import type { TypeContext } from "./tokens/type";

// The 14 style presets of spec section 5.3: one typed parameter set per research D3 style, plus the
// neutral default. A preset is a patch over `DirectionParams`; `applyPreset` never touches locked
// colors or the name, and never lowers the contrast level (R2-06).

export type Density = "comfortable" | "compact" | "dense";

export type PresetId =
  | "default"
  | "minimal-swiss"
  | "editorial"
  | "neo-brutalism"
  | "glass"
  | "dark-dev-tool"
  | "bento"
  | "aurora"
  | "retro-futurism"
  | "tactile"
  | "maximalism"
  | "organic"
  | "dithering-pixel"
  | "m3-expressive";

export type PresetParams = {
  readonly harmony: Harmony;
  readonly chroma: ColorParams["chroma"];
  readonly neutralTint: ColorParams["neutralTint"];
  readonly contrastLevel: ContrastLevel;
  readonly scaleMode: ColorParams["scaleMode"];
  readonly type: { readonly context: TypeContext };
  readonly radius: RadiusSet;
  readonly depth: DepthStyle;
  readonly motion: MotionFeel;
  /** Absent means auto (R2-05). */
  readonly pairing?: PairingId;
};

export type Preset = {
  readonly id: PresetId;
  readonly label: string;
  readonly summary: string;
  readonly params: PresetParams;
  readonly view: { readonly mode: Mode; readonly density: Density };
  /** Accessibility notes the preset's values answer or the linter checks. */
  readonly guards: readonly string[];
  /** What the style needs that `dyelot.spec/1` cannot hold. */
  readonly unexpressed: readonly string[];
};

type Values = readonly [
  harmony: Harmony,
  chroma: PresetParams["chroma"],
  neutralTint: PresetParams["neutralTint"],
  contrastLevel: ContrastLevel,
  scaleMode: PresetParams["scaleMode"],
  context: TypeContext,
  radius: RadiusSet,
  depth: DepthStyle,
  motion: MotionFeel,
  pairing: PairingId | undefined,
  mode: Mode,
  density: Density,
];

function preset(
  id: PresetId,
  label: string,
  summary: string,
  values: Values,
  guards: readonly string[] = [],
  unexpressed: readonly string[] = [],
): Preset {
  const [harmony, chroma, neutralTint, contrastLevel, scaleMode, context] = values;
  const [, , , , , , radius, depth, motion, pairing, mode, density] = values;
  const params: PresetParams = {
    harmony,
    chroma,
    neutralTint,
    contrastLevel,
    scaleMode,
    type: Object.freeze({ context }),
    radius,
    depth,
    motion,
    ...(pairing === undefined ? {} : { pairing }),
  };
  return Object.freeze({
    id,
    label,
    summary,
    params: Object.freeze(params),
    view: Object.freeze({ mode, density }),
    guards: Object.freeze([...guards]),
    unexpressed: Object.freeze([...unexpressed]),
  });
}

const LIST: readonly Preset[] = [
  preset("default", "Default", "A balanced product palette with soft corners.", [
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
  ]),
  preset(
    "minimal-swiss",
    "Minimal Swiss",
    "One restrained accent on a grid, sharp corners, no depth.",
    [
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
    ["Grey text stays at 4.5:1 or more", "Hairlines stay at 3:1 or more", "One accent"],
    ["1 px rules between regions"],
  ),
  preset(
    "editorial",
    "Editorial",
    "Warm greys and a serif voice for long reading.",
    [
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
    ["Small serif text stays at 16 px or more", "Underline-only inputs keep 3:1"],
    ["Uppercase tracked labels", "Underlined inputs"],
  ),
  preset(
    "neo-brutalism",
    "Neo-brutalism",
    "Loud triads, sharp edges and heavy, wide type.",
    [
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
    ["Yellow and cyan text keep 4.5:1 (AA+)", "Hard shadows exist only here"],
    [
      "A 4 px hard offset shadow with no blur",
      "2 to 4 px borders",
      "The press that translates onto the shadow",
    ],
  ),
  preset(
    "glass",
    "Glass",
    "Cool, layered surfaces with calm motion.",
    [
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
    ["Contrast holds without the backdrop (AAA)", "Glass only on floating chrome"],
    ["Backdrop blur of 12 to 24 px", "A 10 to 25% white fill", "A reduced-transparency fallback"],
  ),
  preset(
    "dark-dev-tool",
    "Dark dev tool",
    "A dense, dark workbench with flat surfaces.",
    [
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
    ["Surfaces step by lightness", "Grey-on-grey keeps 4.5:1", "The page is not #000"],
    ["Borders at 6 to 12% white", "The command palette"],
  ),
  preset(
    "bento",
    "Bento",
    "Rounded tiles of different sizes on a soft ground.",
    [
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
    ["Reflow keeps reading and focus order", "Tiles differ in size"],
    ["Grid spans"],
  ),
  preset(
    "aurora",
    "Aurora",
    "Vivid, cool color with round corners and calm motion.",
    [
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
      "Text over the gradient keeps 4.5:1 (AA+)",
      "Motion stops under reduced motion",
      "Avoid purple-blue by the T2 rule",
    ],
    ["Blurred gradient blobs", "Grain against banding"],
  ),
  preset(
    "retro-futurism",
    "Retro-futurism",
    "Neon on dark with a split palette and playful motion.",
    [
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
    ["Neon text keeps 4.5:1 (AA+)", "No vibration"],
    ["Chrome gradients", "Glossy highlights"],
  ),
  preset(
    "tactile",
    "Tactile",
    "Warm, layered surfaces lit from one side.",
    [
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
    ["One light source", "Shadows tinted toward the page"],
    ["Inner highlights", "Noise"],
  ),
  preset(
    "maximalism",
    "Maximalism",
    "Five or more colors, a poster scale and a display serif.",
    [
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
    ["Hierarchy survives five or more colors (even mode)", "Reading order stays"],
    ["Collage", "Rotation", "Overlap"],
  ),
  preset(
    "organic",
    "Organic",
    "Earth tones, round corners and an editorial voice.",
    [
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
    ["Earth tones keep 4.5:1 (AA+)", "Not wellness beige"],
    ["Paper grain", "Superellipse corners"],
  ),
  preset(
    "dithering-pixel",
    "Dithering and pixel",
    "Monochrome on dark with a pixel display face.",
    [
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
    ["Pixel faces for display only", "Body stays legible (AAA)"],
    ["Ordered dither shader", "image-rendering: pixelated"],
  ),
  preset(
    "m3-expressive",
    "M3 Expressive",
    "Round shapes and springy motion on familiar patterns.",
    [
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
    ["Familiar patterns stay", "Springs use no overshoot on color and opacity"],
    ["Shape morphing", "Emphasized weight"],
  ),
];

/** The preset ids, in the order of spec section 5.3. */
export const PRESET_IDS: readonly PresetId[] = Object.freeze(LIST.map((item) => item.id));

/** Every preset by id, deeply frozen. */
export const PRESETS: Readonly<Record<PresetId, Preset>> = Object.freeze(
  Object.fromEntries(LIST.map((item) => [item.id, item])) as Record<PresetId, Preset>,
);

const RANK: Readonly<Record<ContrastLevel, number>> = { AA: 0, "AA+": 1, AAA: 2 };

/**
 * Applies a preset to direction parameters. The preset sets harmony, chroma, tint, scale mode,
 * type context, radius, depth, motion and pairing (absent for `default`, meaning auto). Locked
 * colors, the name and the gamut stay; `type.ratio` goes, because the context fixes it; the
 * contrast level is the higher of the user's and the preset's (R2-06). Returns a new object.
 */
export function applyPreset(params: DirectionParams, id: PresetId): DirectionParams {
  if (typeof params !== "object" || params === null) {
    throw new TypeError(`applyPreset: params must be an object, got ${describeType(params)}`);
  }
  assertOneOf(id, PRESET_IDS, "applyPreset: id");
  const { params: patch } = PRESETS[id];
  const { pairing: _pairing, type: _type, ...rest } = params;
  const user = params.contrastLevel;
  assertOneOf(user, CONTRAST_LEVELS, "applyPreset: params.contrastLevel");
  return {
    ...rest,
    ...patch,
    type: { context: patch.type.context },
    contrastLevel: RANK[user] > RANK[patch.contrastLevel] ? user : patch.contrastLevel,
  };
}
