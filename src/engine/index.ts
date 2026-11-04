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
export { GAMUTS, MODES } from "./color/guards";
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
export type { Gamut, Hex, Mode, Oklch, Rgb } from "./color/types";
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
export { ENGINE_VERSION, generateSystem } from "./generate";
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
export { type ShadowLayer, shadows } from "./tokens/depth";
export { type MotionTokens, motionTokens } from "./tokens/motion";
export {
  nestedRadius,
  RADIUS_SET_NAMES,
  type RadiusScale,
  type RadiusSet,
  radiusScale,
} from "./tokens/shape";
export { spaceScale } from "./tokens/space";
export { springCurve } from "./tokens/spring";
export {
  TYPE_CONTEXTS,
  type TypeContext,
  type TypeStep,
  type TypeStepName,
  typeScale,
} from "./tokens/type";
export { type TypeWeights, typeWeights } from "./tokens/weights";
