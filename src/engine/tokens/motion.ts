import { describeType } from "../color/guards";
import { round6 } from "../round";

export type MotionTokens = {
  /** Milliseconds. */
  durations: Record<"instant" | "fast" | "quick" | "base" | "slow" | "slower" | "slowest", number>;
  /** Cubic-bezier control points `[x1, y1, x2, y2]`. */
  easings: Record<
    "standard" | "decelerate" | "accelerate" | "emphasized",
    readonly [number, number, number, number]
  >;
  /** Seconds of visual duration, and bounce. */
  springs: Record<"snappy" | "smooth" | "bouncy", { visualDuration: number; bounce: number }>;
};

/** The motion tokens of the spec. Each call returns a fresh object. */
export function motionTokens(): MotionTokens {
  return {
    durations: {
      instant: 50,
      fast: 100,
      quick: 150,
      base: 200,
      slow: 300,
      slower: 400,
      slowest: 500,
    },
    easings: {
      standard: [0.2, 0, 0, 1],
      decelerate: [0, 0, 0, 1],
      accelerate: [0.3, 0, 1, 1],
      emphasized: [0.05, 0.7, 0.1, 1],
    },
    springs: {
      snappy: { visualDuration: 0.25, bounce: 0.1 },
      smooth: { visualDuration: 0.4, bounce: 0 },
      bouncy: { visualDuration: 0.5, bounce: 0.35 },
    },
  };
}

/** The names of each group, in the key order of `MotionTokens` (R5-09). */
export const MOTION_DURATION_NAMES = Object.freeze([
  "instant",
  "fast",
  "quick",
  "base",
  "slow",
  "slower",
  "slowest",
] as const);
export const MOTION_EASING_NAMES = Object.freeze([
  "standard",
  "decelerate",
  "accelerate",
  "emphasized",
] as const);
export const MOTION_SPRING_NAMES = Object.freeze(["snappy", "smooth", "bouncy"] as const);

const SPRING_FIELDS = Object.freeze(["visualDuration", "bounce"] as const);
const GROUPS = Object.freeze(["durations", "easings", "springs"] as const);

type Loose = Record<string, unknown>;

const isRecord = (value: unknown): value is Loose =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function record(value: unknown, path: string): Loose {
  if (!isRecord(value)) {
    throw new TypeError(`${path} must be an object, got ${describeType(value)}`);
  }
  return value;
}

function number(value: unknown, path: string): number {
  if (typeof value !== "number") {
    throw new TypeError(`${path} must be a number, got ${describeType(value)}`);
  }
  return value;
}

/** Every type of the whole input, so a wrong type outranks a wrong value (R-05). */
function checkTypes(tokens: unknown, name: string): void {
  const root = record(tokens, name);
  const durations = record(root.durations, `${name}.durations`);
  for (const id of MOTION_DURATION_NAMES) number(durations[id], `${name}.durations.${id}`);
  const easings = record(root.easings, `${name}.easings`);
  for (const id of MOTION_EASING_NAMES) {
    const path = `${name}.easings.${id}`;
    const points = easings[id];
    if (!Array.isArray(points)) {
      throw new TypeError(`${path} must be an array, got ${describeType(points)}`);
    }
    for (const [index, point] of points.entries()) number(point, `${path}[${index}]`);
  }
  const springs = record(root.springs, `${name}.springs`);
  for (const id of MOTION_SPRING_NAMES) {
    const spring = record(springs[id], `${name}.springs.${id}`);
    for (const field of SPRING_FIELDS) number(spring[field], `${name}.springs.${id}.${field}`);
  }
}

/** A key of `source` that `names` does not list: a RangeError naming it. */
function noOtherKey(source: Loose, names: readonly string[], path: string): void {
  const unknown = Object.keys(source).find((key) => !names.includes(key));
  if (unknown !== undefined) throw new RangeError(`${path}.${unknown} is not a motion token`);
}

function within(value: number, low: number, high: number, path: string): number {
  if (!Number.isFinite(value) || value < low || value > high) {
    throw new RangeError(`${path} must be a finite number from ${low} to ${high}, got ${value}`);
  }
  return round6(value);
}

/**
 * Motion tokens read as `generateSystem` stores them (R5-09): exactly the keys of `MotionTokens`, the
 * durations at least 0, each easing four finite numbers with x in [0, 1], each spring a visual
 * duration above 0 and a bounce in [0, 1]. Every type is checked before any value. The result is a
 * new, deeply frozen object in the name lists' order with every number through `round6`. Errors
 * start with `name` and the path of the field.
 */
export function normalizeMotionTokens(
  tokens: MotionTokens,
  name = "normalizeMotionTokens: tokens",
): MotionTokens {
  checkTypes(tokens, name);
  const root = tokens as unknown as Record<(typeof GROUPS)[number], Loose>;
  noOtherKey(root, GROUPS, name);
  noOtherKey(root.durations, MOTION_DURATION_NAMES, `${name}.durations`);
  noOtherKey(root.easings, MOTION_EASING_NAMES, `${name}.easings`);
  noOtherKey(root.springs, MOTION_SPRING_NAMES, `${name}.springs`);
  const durations = {} as Record<string, number>;
  for (const id of MOTION_DURATION_NAMES) {
    durations[id] = within(
      root.durations[id] as number,
      0,
      Number.POSITIVE_INFINITY,
      `${name}.durations.${id}`,
    );
  }
  const easings = {} as Record<string, readonly number[]>;
  for (const id of MOTION_EASING_NAMES) {
    const path = `${name}.easings.${id}`;
    const points = root.easings[id] as readonly number[];
    if (points.length !== 4) {
      throw new RangeError(`${path} must hold 4 numbers, got ${points.length}`);
    }
    const [x1, y1, x2, y2] = points as readonly [number, number, number, number];
    const any = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY] as const;
    easings[id] = Object.freeze([
      within(x1, 0, 1, `${path}[0]`),
      within(y1, ...any, `${path}[1]`),
      within(x2, 0, 1, `${path}[2]`),
      within(y2, ...any, `${path}[3]`),
    ]);
  }
  const springs = {} as Record<string, { visualDuration: number; bounce: number }>;
  for (const id of MOTION_SPRING_NAMES) {
    const path = `${name}.springs.${id}`;
    const spring = root.springs[id] as Loose;
    noOtherKey(spring, SPRING_FIELDS, path);
    const visualDuration = spring.visualDuration as number;
    if (!Number.isFinite(visualDuration) || visualDuration <= 0) {
      throw new RangeError(
        `${path}.visualDuration must be a finite number above 0, got ${visualDuration}`,
      );
    }
    springs[id] = Object.freeze({
      visualDuration: round6(visualDuration),
      bounce: within(spring.bounce as number, 0, 1, `${path}.bounce`),
    });
  }
  return Object.freeze({
    durations: Object.freeze(durations),
    easings: Object.freeze(easings),
    springs: Object.freeze(springs),
  }) as unknown as MotionTokens;
}

/**
 * Whether two token sets hold the same numbers, compared by name with `===` over the three groups
 * (R5-10). Other keys, such as a spec's `motion.feel`, are not read. A group, name or value of the
 * wrong type is a TypeError; there is no domain beyond the types.
 */
export function sameMotionTokens(a: MotionTokens, b: MotionTokens): boolean {
  checkTypes(a, "sameMotionTokens: a");
  checkTypes(b, "sameMotionTokens: b");
  return (
    MOTION_DURATION_NAMES.every((id) => a.durations[id] === b.durations[id]) &&
    MOTION_EASING_NAMES.every(
      (id) =>
        a.easings[id].length === b.easings[id].length &&
        a.easings[id].every((value, index) => value === b.easings[id][index]),
    ) &&
    MOTION_SPRING_NAMES.every(
      (id) =>
        a.springs[id].visualDuration === b.springs[id].visualDuration &&
        a.springs[id].bounce === b.springs[id].bounce,
    )
  );
}
