// The public entry of the engine: the only way for code outside src/engine, src/spec and
// src/theme to reach it (spec R2-02). Internals (`multiply`, `runRules`, `tryOklchToRgb`,
// `gamutExcess`) stay out. Every exported table is frozen at its home module.

export {
  DEPTH_STYLES,
  type DepthStyle,
  type DirectionParams,
  MOTION_FEELS,
  type MotionFeel,
} from "../spec/schema";
export { meets, perceptualLc, wcagRatio } from "./color/contrast";
export { formatOklch, hexToRgb, oklchToRgb, rgbToOklch, toHex } from "./color/convert";
export { DEFICIENCIES, type Deficiency, simulate } from "./color/cvd";
export { deltaEOK } from "./color/deltae";
export { ColorParseError } from "./color/errors";
export { gamutMap } from "./color/gamut";
export { GAMUTS } from "./color/guards";
export { HARMONIES, type Harmony } from "./color/harmony";
export { indexNames, type NameEntry, type NameIndex, nearestName } from "./color/names";
export {
  CHROMA_LEVELS,
  CONTRAST_LEVELS,
  type ContrastLevel,
  LOCKABLE,
  type Lockable,
  NEUTRAL_TINTS,
  normalizeSeed,
  PALETTE_NAMES,
  type PaletteName,
  SCALE_MODES,
} from "./color/palette";
export { parseColor } from "./color/parse";
export { onFill, ROLE_NAMES, type RoleName } from "./color/roles";
export { STEPS, type Step, UnsatisfiableTargetError } from "./color/scale";
export {
  type GamutSolid,
  gamutSlice,
  gamutSolid,
  type SlicePoint,
  SOLID_GAMUTS,
  type SolidGamut,
  solidPosition,
} from "./color/solid";
export type { Gamut, Hex, Mode, Oklch, Rgb } from "./color/types";
export { FLAVOR_STEPS, type FlavorStops, flavorSeed, flavorStops } from "./flavor";
export {
  FONT_CATALOG,
  type FontCategory,
  type FontEntry,
  fontFiles,
  fontStack,
  genericness,
  HIGH_GENERICNESS_FAMILIES,
} from "./fonts/catalog";
export {
  choosePairing,
  PAIRING_IDS,
  PAIRINGS,
  type Pairing,
  type PairingId,
} from "./fonts/pairings";
export { ENGINE_VERSION, generateSystem, withMotion } from "./generate";
export type { ImageCluster, ImagePalette, RawCluster } from "./image/palette";
export { imagePalette } from "./image/palette";
export { lintSpec } from "./lint";
export type { Finding, LintedSpec, LintOptions, RuleId, Severity } from "./lint/types";
export { RULE_IDS } from "./lint/types";
export type { ContrastCheck, ContrastKind, Measurements, Summary } from "./measure";
export { CONTRAST_CHECKS, measureSpec, summarize } from "./measure";
export { freshParams, paramsOfSpec, resolveParams } from "./params";
export {
  applyPreset,
  type Density,
  PRESET_IDS,
  PRESETS,
  type Preset,
  type PresetId,
  type PresetParams,
  presetOf,
} from "./presets";
export { round6, roundHue } from "./round";
export { type Bezier, bezierPoints } from "./tokens/bezier";
export { type ShadowLayer, shadows } from "./tokens/depth";
export {
  MOTION_DURATION_NAMES,
  MOTION_EASING_NAMES,
  MOTION_SPRING_NAMES,
  type MotionTokens,
  motionTokens,
  normalizeMotionTokens,
  sameMotionTokens,
} from "./tokens/motion";
export {
  MOTION_PRESET_IDS,
  MOTION_PRESETS,
  type MotionPreset,
  type MotionPresetId,
  motionPresetOf,
} from "./tokens/motion-presets";
export {
  nestedRadius,
  RADIUS_SET_NAMES,
  type RadiusScale,
  type RadiusSet,
  radiusScale,
} from "./tokens/shape";
export { spaceScale } from "./tokens/space";
export { type SpringCurve, springCurve } from "./tokens/spring";
export {
  TYPE_CONTEXTS,
  type TypeContext,
  type TypeStep,
  type TypeStepName,
  typeScale,
} from "./tokens/type";
export { type TypeWeights, typeWeights } from "./tokens/weights";
