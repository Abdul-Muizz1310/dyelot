import type { DesignSpec } from "../spec/schema";
import { assertHex, assertMode, describeType, MODES } from "./color/guards";
import type { PaletteName } from "./color/palette";
import type { Step } from "./color/scale";
import type { Hex, Mode } from "./color/types";

// The flavor's colors and seed (docs/specs/05-motion-3d.md, R5-16): five steps of a design, read
// from its scales and never re-derived, and a place in the noise field that follows its spec id.
// Pure.

/** Five `#rrggbb` hexes: the ground, then four steps the shader mixes between. */
export type FlavorStops = readonly [Hex, Hex, Hex, Hex, Hex];

/**
 * The steps the flavor reads, in order: neutral 100 (the quiet ground), primary 200, secondary 400,
 * accent 400 and primary 500. A step's number means the same distance from the page in each mode,
 * so one list serves both.
 */
export const FLAVOR_STEPS: readonly (readonly [PaletteName, Step])[] = Object.freeze([
  Object.freeze(["neutral", 100] as const),
  Object.freeze(["primary", 200] as const),
  Object.freeze(["secondary", 400] as const),
  Object.freeze(["accent", 400] as const),
  Object.freeze(["primary", 500] as const),
]);

/** The palettes `FLAVOR_STEPS` reads, each once. */
const FLAVOR_PALETTES: readonly PaletteName[] = [
  ...new Set(FLAVOR_STEPS.map(([palette]) => palette)),
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (!isRecord(value))
    throw new TypeError(`${name} must be an object, got ${describeType(value)}`);
}

/** The scale entry of `step` in `scale`, checked: a record whose `hex` is a string. */
function entryOf(scale: unknown, step: Step, name: string): { name: string; hex: string } {
  if (!Array.isArray(scale)) {
    throw new TypeError(`${name} must be an array of steps, got ${describeType(scale)}`);
  }
  const index = scale.findIndex((entry) => isRecord(entry) && entry.step === step);
  if (index === -1) throw new TypeError(`${name} must hold step ${step}`);
  const hex: unknown = scale[index].hex;
  if (typeof hex !== "string") {
    throw new TypeError(`${name}[${index}].hex must be a string, got ${describeType(hex)}`);
  }
  return { name: `${name}[${index}].hex`, hex };
}

/**
 * The five stops of a design in one mode (R5-16): the hexes of `spec.color.palettes.<palette>.<mode>`
 * at `FLAVOR_STEPS`. Types first (R-05): the sections it reads are checked as `paramsOfSpec` checks
 * its own, the scales of both modes included, then the mode, then each hex's form.
 */
export function flavorStops(spec: DesignSpec, mode: Mode): FlavorStops {
  assertRecord(spec, "flavorStops: spec");
  assertRecord(spec.color, "flavorStops: spec.color");
  const palettes: unknown = spec.color.palettes;
  assertRecord(palettes, "flavorStops: spec.color.palettes");
  const checked = new Map<PaletteName, Record<string, unknown>>();
  for (const palette of FLAVOR_PALETTES) {
    const value = palettes[palette];
    assertRecord(value, `flavorStops: spec.color.palettes.${palette}`);
    checked.set(palette, value);
  }
  const entries = (scaleMode: Mode) =>
    FLAVOR_STEPS.map(([palette, step]) =>
      entryOf(
        checked.get(palette)?.[scaleMode],
        step,
        `flavorStops: spec.color.palettes.${palette}.${scaleMode}`,
      ),
    );
  for (const scaleMode of MODES) entries(scaleMode);
  assertMode(mode, "flavorStops: mode");
  const hexes = entries(mode).map(({ name, hex }): Hex => {
    assertHex(hex, name);
    return hex;
  });
  return Object.freeze([hexes[0], hexes[1], hexes[2], hexes[3], hexes[4]] as const);
}

/** A spec id (`specId`): 16 lowercase hex digits. */
const SPEC_ID = /^[0-9a-f]{16}$/;

/** 2^32, the count of values one half of a spec id holds. */
const HALF_RANGE = 2 ** 32;

/** A number rounded to 4 decimals. */
const round4 = (value: number): number => Math.round(value * 10_000) / 10_000;

/**
 * The flavor's place in the noise field (R5-16): each half of the spec id read as a number and
 * mapped onto 0 to 100, to 4 decimals, so the same design always looks the same.
 */
export function flavorSeed(id: string): readonly [x: number, y: number] {
  if (typeof id !== "string") {
    throw new TypeError(`flavorSeed: id must be a string, got ${describeType(id)}`);
  }
  if (!SPEC_ID.test(id)) {
    throw new RangeError(
      `flavorSeed: id must be 16 lowercase hex digits, got ${JSON.stringify(id)}`,
    );
  }
  const half = (from: number): number =>
    round4((Number.parseInt(id.slice(from, from + 8), 16) / HALF_RANGE) * 100);
  return Object.freeze([half(0), half(8)] as const);
}
