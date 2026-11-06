import {
  type Bezier,
  MOTION_DURATION_NAMES,
  MOTION_EASING_NAMES,
  MOTION_PRESETS,
  MOTION_SPRING_NAMES,
  type MotionTokens,
  motionPresetOf,
  normalizeMotionTokens,
} from "@/engine";
import { assertFinite, assertRecord, assertString, describeType } from "@/features/studio/guards";
import type { DesignSpec } from "@/spec";
import { themeVars } from "@/theme/vars";

// The motion lab's pure helpers (spec R5-41 to R5-43, sections 5.7, 9.2 and 9.3): the fields'
// bounds and reading, the edited token sets, the curves' paths and the preset line. Pure: the lab's
// client holds the state.

export type TokenPath =
  | { readonly kind: "duration"; readonly name: (typeof MOTION_DURATION_NAMES)[number] }
  | {
      readonly kind: "easing";
      readonly name: (typeof MOTION_EASING_NAMES)[number];
      readonly index: 0 | 1 | 2 | 3;
    }
  | {
      readonly kind: "spring";
      readonly name: (typeof MOTION_SPRING_NAMES)[number];
      readonly field: "visualDuration" | "bounce";
    };

type BoundName = "duration" | "x" | "y" | "visualDuration" | "bounce";
type Bound = { readonly min: number; readonly max: number; readonly step: number };

/** The lab's caps (R5-42): the schema's bounds plus a cap where the schema has none. */
export const LAB_BOUNDS: Readonly<Record<BoundName, Bound>> = Object.freeze({
  duration: Object.freeze({ min: 0, max: 500, step: 1 }),
  x: Object.freeze({ min: 0, max: 1, step: 0.01 }),
  y: Object.freeze({ min: -1, max: 2, step: 0.01 }),
  visualDuration: Object.freeze({ min: 0.05, max: 2, step: 0.01 }),
  bounce: Object.freeze({ min: 0, max: 1, step: 0.01 }),
});

const SENTENCES: Readonly<Record<BoundName, string>> = Object.freeze({
  duration: "Enter a number of milliseconds from 0 to 500.",
  x: "Enter a number from 0 to 1.",
  y: "Enter a number from −1 to 2.",
  visualDuration: "Enter a number of seconds from 0.05 to 2.",
  bounce: "Enter a number from 0 to 1.",
});

/** The path's type and shape: another type is a TypeError, an unknown kind, name or index a RangeError. */
function checkPath(path: unknown, fn: string): TokenPath {
  assertRecord(path, `${fn}: path`);
  const { kind, name } = path;
  const known = (names: readonly string[]) => typeof name === "string" && names.includes(name);
  if (kind === "duration" && known(MOTION_DURATION_NAMES)) return path as TokenPath;
  if (
    kind === "easing" &&
    known(MOTION_EASING_NAMES) &&
    [0, 1, 2, 3].includes(path.index as number)
  ) {
    return path as TokenPath;
  }
  if (
    kind === "spring" &&
    known(MOTION_SPRING_NAMES) &&
    (path.field === "visualDuration" || path.field === "bounce")
  ) {
    return path as TokenPath;
  }
  throw new RangeError(`${fn}: path is not a token of the lab, got ${JSON.stringify(path)}`);
}

function boundOf(path: TokenPath): BoundName {
  if (path.kind === "duration") return "duration";
  if (path.kind === "easing") return path.index % 2 === 0 ? "x" : "y";
  return path.field;
}

function decimalsOf(step: number): number {
  return step === 1 ? 0 : 2;
}

/**
 * The number a field's text holds (R5-42): trimmed, U+2212 read as a minus, then rounded to the
 * field's step. An empty text, one that is not a finite number and a value outside the bounds give
 * `{ ok: false, message }` with the kind's sentence; no string throws.
 */
export function readField(
  path: TokenPath,
  text: string,
):
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly message: string } {
  assertRecord(path, "readField: path");
  assertString(text, "readField: text");
  const bound = boundOf(checkPath(path, "readField"));
  const { min, max, step } = LAB_BOUNDS[bound];
  const trimmed = text.trim().replaceAll("−", "-");
  const value = trimmed === "" ? Number.NaN : Number(trimmed);
  if (!Number.isFinite(value) || value < min || value > max) {
    return { ok: false, message: SENTENCES[bound] };
  }
  const rounded = Number((Math.round(value / step) * step).toFixed(decimalsOf(step)));
  // Adding 0 turns -0 into 0.
  return { ok: true, value: rounded + 0 };
}

/**
 * A new, normalized token set with one field set to `value` (R5-41). The input is not changed. A
 * value the schema refuses, such as an `x` above 1, is a RangeError.
 */
export function editTokens(tokens: MotionTokens, path: TokenPath, value: number): MotionTokens {
  assertRecord(tokens, "editTokens: tokens");
  assertRecord(path, "editTokens: path");
  assertFinite(value, "editTokens: value");
  const checked = checkPath(path, "editTokens");
  const draft = {
    durations: { ...tokens.durations },
    easings: Object.fromEntries(
      MOTION_EASING_NAMES.map((name) => [name, [...tokens.easings[name]]]),
    ) as unknown as Record<string, Bezier>,
    springs: Object.fromEntries(
      MOTION_SPRING_NAMES.map((name) => [name, { ...tokens.springs[name] }]),
    ) as MotionTokens["springs"],
  };
  if (checked.kind === "duration") draft.durations[checked.name] = value;
  else if (checked.kind === "easing") {
    (draft.easings[checked.name] as unknown as number[])[checked.index] = value;
  } else draft.springs[checked.name][checked.field] = value;
  return normalizeMotionTokens(draft as unknown as MotionTokens, "editTokens: tokens");
}

/** A field's text (9.3): a duration whole, the rest with at most 2 decimals and no trailing zero. */
export function fieldText(tokens: MotionTokens, path: TokenPath): string {
  assertRecord(tokens, "fieldText: tokens");
  const checked = checkPath(path, "fieldText");
  let value: number;
  if (checked.kind === "duration") value = tokens.durations[checked.name];
  else if (checked.kind === "easing") value = tokens.easings[checked.name][checked.index];
  else value = tokens.springs[checked.name][checked.field];
  return checked.kind === "duration" ? value.toFixed(0) : String(Number(value.toFixed(2)));
}

type CurveBox = {
  readonly width: number;
  readonly height: number;
  readonly pad: number;
  readonly yMin: number;
  readonly yMax: number;
};

function twoDecimals(value: number): string {
  const text = value.toFixed(2);
  return text === "-0.00" ? "0.00" : text;
}

/**
 * An SVG path `M x y L x y …` of `[x, y]` points in a box (9.3): x maps to `pad + x × (width − 2
 * pad)`, y to `pad + (yMax − y) / (yMax − yMin) × (height − 2 pad)`, each to 2 decimals.
 */
export function curvePath(points: readonly (readonly [number, number])[], box: CurveBox): string {
  if (!Array.isArray(points)) {
    throw new TypeError(`curvePath: points must be an array, got ${describeType(points)}`);
  }
  assertRecord(box, "curvePath: box");
  for (const key of ["width", "height", "pad", "yMin", "yMax"] as const) {
    assertFinite(box[key], `curvePath: box.${key}`);
  }
  if (!(box.yMin < box.yMax)) {
    throw new RangeError(
      `curvePath: box.yMin must be below box.yMax, got ${box.yMin} and ${box.yMax}`,
    );
  }
  if (points.length === 0) throw new RangeError("curvePath: points must not be empty");
  const { width, height, pad, yMin, yMax } = box;
  const commands = points.map((point, index) => {
    if (!Array.isArray(point)) {
      throw new TypeError(
        `curvePath: points[${index}] must be an array, got ${describeType(point)}`,
      );
    }
    if (point.length !== 2) {
      throw new RangeError(`curvePath: points[${index}] must hold 2 numbers, got ${point.length}`);
    }
    const [x, y] = point;
    assertFinite(x, `curvePath: points[${index}][0]`);
    assertFinite(y, `curvePath: points[${index}][1]`);
    const px = pad + x * (width - 2 * pad);
    const py = pad + ((yMax - y) / (yMax - yMin)) * (height - 2 * pad);
    return `${index === 0 ? "M" : "L"} ${twoDecimals(px)} ${twoDecimals(py)}`;
  });
  return commands.join(" ");
}

/**
 * Each duration as stored and as exported (9.3). The exported value is the theme bridge's
 * `--duration-<name>` for the light mode, so the calm stretch and the 500 ms cap (R2-08) are never
 * derived here.
 */
export function durationBars(
  spec: DesignSpec,
): readonly { readonly name: string; readonly stored: number; readonly exported: number }[] {
  assertRecord(spec, "durationBars: spec");
  assertRecord(spec.motion, "durationBars: spec.motion");
  const vars = themeVars(spec, "light");
  return MOTION_DURATION_NAMES.map((name) => ({
    name,
    stored: spec.motion.durations[name],
    exported: Number.parseInt(vars[`--duration-${name}`] as string, 10),
  }));
}

/** The line under the presets (9.2). */
export function presetLine(tokens: MotionTokens): string {
  const checked = normalizeMotionTokens(tokens, "presetLine: tokens");
  const id = motionPresetOf(checked);
  if (id === null) return "Custom tokens: no preset matches.";
  const { label, note } = MOTION_PRESETS[id];
  return `These tokens match the ${label} preset. ${note}`;
}

/** The transition every spring becomes under reduced motion (R5-43): `fast`, in seconds, linear. */
export function reducedTransition(spec: DesignSpec): {
  readonly duration: number;
  readonly ease: "linear";
} {
  assertRecord(spec, "reducedTransition: spec");
  assertRecord(spec.motion, "reducedTransition: spec.motion");
  assertRecord(spec.motion.durations, "reducedTransition: spec.motion.durations");
  assertFinite(spec.motion.durations.fast, "reducedTransition: spec.motion.durations.fast");
  return { duration: spec.motion.durations.fast / 1000, ease: "linear" };
}
