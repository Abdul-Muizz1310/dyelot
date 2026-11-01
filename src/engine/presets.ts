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

/** The values of one preset: `PresetParams` flattened, plus the view settings. */
type Values = Omit<PresetParams, "type"> & {
  readonly context: TypeContext;
  readonly mode: Mode;
  readonly density: Density;
};

function preset(
  id: PresetId,
  label: string,
  summary: string,
  values: Values,
  guards: readonly string[] = [],
  unexpressed: readonly string[] = [],
): Preset {
  const { context, mode, density, ...rest } = values;
  const params: PresetParams = { ...rest, type: Object.freeze({ context }) };
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
  preset("default", "Default", "A balanced product palette with soft corners.", {
    harmony: "analogous",
    chroma: "balanced",
    neutralTint: "brand",
    contrastLevel: "AA",
    scaleMode: "standard",
    context: "product",
    radius: "soft",
    depth: "soft",
    motion: "brisk",
    mode: "light",
    density: "comfortable",
  }),
  preset(
    "minimal-swiss",
    "Minimal Swiss",
    "One restrained accent on a grid, sharp corners, no depth.",
    {
      harmony: "monochrome",
      chroma: "muted",
      neutralTint: "none",
      contrastLevel: "AA+",
      scaleMode: "standard",
      context: "product",
      radius: "sharp",
      depth: "flat",
      motion: "brisk",
      pairing: "host-grotesk",
      mode: "light",
      density: "comfortable",
    },
    ["Grey text stays at 4.5:1 or more", "Hairlines stay at 3:1 or more", "One accent"],
    ["1 px rules between regions"],
  ),
  preset(
    "editorial",
    "Editorial",
    "Warm greys and a serif voice for long reading.",
    {
      harmony: "analogous",
      chroma: "muted",
      neutralTint: "warm",
      contrastLevel: "AA+",
      scaleMode: "standard",
      context: "editorial",
      radius: "sharp",
      depth: "flat",
      motion: "calm",
      pairing: "schibsted-serif",
      mode: "light",
      density: "comfortable",
    },
    ["Small serif text stays at 16 px or more", "Underline-only inputs keep 3:1"],
    ["Uppercase tracked labels", "Underlined inputs"],
  ),
  preset(
    "neo-brutalism",
    "Neo-brutalism",
    "Loud triads, sharp edges and heavy, wide type.",
    {
      harmony: "triadic",
      chroma: "vivid",
      neutralTint: "none",
      contrastLevel: "AA+",
      scaleMode: "even",
      context: "product",
      radius: "sharp",
      depth: "flat",
      motion: "brisk",
      pairing: "anybody-albert",
      mode: "light",
      density: "comfortable",
    },
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
    {
      harmony: "analogous",
      chroma: "balanced",
      neutralTint: "cool",
      contrastLevel: "AAA",
      scaleMode: "standard",
      context: "marketing",
      radius: "round",
      depth: "layered",
      motion: "calm",
      pairing: "funnel",
      mode: "light",
      density: "comfortable",
    },
    ["Contrast holds without the backdrop (AAA)", "Glass only on floating chrome"],
    ["Backdrop blur of 12 to 24 px", "A 10 to 25% white fill", "A reduced-transparency fallback"],
  ),
  preset(
    "dark-dev-tool",
    "Dark dev tool",
    "A dense, dark workbench with flat surfaces.",
    {
      harmony: "analogous",
      chroma: "balanced",
      neutralTint: "brand",
      contrastLevel: "AA+",
      scaleMode: "standard",
      context: "dense",
      radius: "soft",
      depth: "flat",
      motion: "brisk",
      pairing: "hubot-mona",
      mode: "dark",
      density: "dense",
    },
    ["Surfaces step by lightness", "Grey-on-grey keeps 4.5:1", "The page is not #000"],
    ["Borders at 6 to 12% white", "The command palette"],
  ),
  preset(
    "bento",
    "Bento",
    "Rounded tiles of different sizes on a soft ground.",
    {
      harmony: "analogous",
      chroma: "balanced",
      neutralTint: "brand",
      contrastLevel: "AA",
      scaleMode: "standard",
      context: "product",
      radius: "round",
      depth: "soft",
      motion: "brisk",
      pairing: "commissioner",
      mode: "light",
      density: "comfortable",
    },
    ["Reflow keeps reading and focus order", "Tiles differ in size"],
    ["Grid spans"],
  ),
  preset(
    "aurora",
    "Aurora",
    "Vivid, cool color with round corners and calm motion.",
    {
      harmony: "analogous",
      chroma: "vivid",
      neutralTint: "cool",
      contrastLevel: "AA+",
      scaleMode: "standard",
      context: "marketing",
      radius: "round",
      depth: "soft",
      motion: "calm",
      pairing: "zalando",
      mode: "light",
      density: "comfortable",
    },
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
    {
      harmony: "split",
      chroma: "vivid",
      neutralTint: "cool",
      contrastLevel: "AA+",
      scaleMode: "even",
      context: "marketing",
      radius: "round",
      depth: "layered",
      motion: "playful",
      pairing: "unbounded-golos",
      mode: "dark",
      density: "comfortable",
    },
    ["Neon text keeps 4.5:1 (AA+)", "No vibration"],
    ["Chrome gradients", "Glossy highlights"],
  ),
  preset(
    "tactile",
    "Tactile",
    "Warm, layered surfaces lit from one side.",
    {
      harmony: "analogous",
      chroma: "balanced",
      neutralTint: "warm",
      contrastLevel: "AA",
      scaleMode: "standard",
      context: "product",
      radius: "soft",
      depth: "layered",
      motion: "brisk",
      pairing: "shoulders-redhat",
      mode: "light",
      density: "comfortable",
    },
    ["One light source", "Shadows tinted toward the page"],
    ["Inner highlights", "Noise"],
  ),
  preset(
    "maximalism",
    "Maximalism",
    "Five or more colors, a poster scale and a display serif.",
    {
      harmony: "tetradic",
      chroma: "vivid",
      neutralTint: "none",
      contrastLevel: "AA+",
      scaleMode: "even",
      context: "poster",
      radius: "soft",
      depth: "layered",
      motion: "playful",
      pairing: "gloock-albert",
      mode: "light",
      density: "comfortable",
    },
    ["Hierarchy survives five or more colors (even mode)", "Reading order stays"],
    ["Collage", "Rotation", "Overlap"],
  ),
  preset(
    "organic",
    "Organic",
    "Earth tones, round corners and an editorial voice.",
    {
      harmony: "analogous",
      chroma: "muted",
      neutralTint: "warm",
      contrastLevel: "AA+",
      scaleMode: "standard",
      context: "editorial",
      radius: "round",
      depth: "soft",
      motion: "calm",
      pairing: "young-onest",
      mode: "light",
      density: "comfortable",
    },
    ["Earth tones keep 4.5:1 (AA+)", "Not wellness beige"],
    ["Paper grain", "Superellipse corners"],
  ),
  preset(
    "dithering-pixel",
    "Dithering and pixel",
    "Monochrome on dark with a pixel display face.",
    {
      harmony: "monochrome",
      chroma: "balanced",
      neutralTint: "none",
      contrastLevel: "AAA",
      scaleMode: "standard",
      context: "product",
      radius: "sharp",
      depth: "flat",
      motion: "brisk",
      pairing: "tiny5-spline",
      mode: "dark",
      density: "compact",
    },
    ["Pixel faces for display only", "Body stays legible (AAA)"],
    ["Ordered dither shader", "image-rendering: pixelated"],
  ),
  preset(
    "m3-expressive",
    "M3 Expressive",
    "Round shapes and springy motion on familiar patterns.",
    {
      harmony: "analogous",
      chroma: "balanced",
      neutralTint: "brand",
      contrastLevel: "AA",
      scaleMode: "standard",
      context: "product",
      radius: "round",
      depth: "soft",
      motion: "playful",
      pairing: "google-flex",
      mode: "light",
      density: "comfortable",
    },
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
