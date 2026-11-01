import { deflateRawSync } from "node:zlib";
import fc from "fast-check";
import { expect } from "vitest";
import { parseColor } from "@/engine/color/parse";
import type { Oklch } from "@/engine/color/types";
import { generateSystem } from "@/engine/generate";
import { seededRandom } from "@/engine/random";
import { round6, roundHue } from "@/engine/round";
import { fnv1a64 } from "@/spec/hash";
import type { DesignSpec, DirectionParams } from "@/spec/schema";
import { SpecDecodeError } from "@/spec/url-codec";

// Shared fixtures for the Task 1.8 cases of docs/specs/01-color-engine.md, section 6.7. They are
// test fixtures, not studio defaults (R-20).

/** DEFAULT_PARAMS of the spec, section 5. */
export const DEFAULT_PARAMS: DirectionParams = {
  harmony: "analogous",
  chroma: "balanced",
  neutralTint: "brand",
  gamut: "srgb",
  scaleMode: "standard",
  contrastLevel: "AA",
  type: { context: "product" },
  radius: "soft",
  depth: "soft",
  motion: "brisk",
};

/** EXTREME_SEEDS of the spec, section 5. */
export const EXTREME_SEEDS = [
  "#fefefe",
  "#010101",
  "#808080",
  "oklch(0.6 0 none)",
  "oklch(0.98 0.35 110)",
] as const;

// The enum lists, written out from the spec so the tests do not borrow the implementation's.
export const HARMONIES = [
  "monochrome",
  "analogous",
  "complementary",
  "split",
  "triadic",
  "tetradic",
] as const;
export const CHROMAS = ["muted", "balanced", "vivid"] as const;
export const TINTS = ["none", "warm", "cool", "brand"] as const;
export const GAMUTS = ["srgb", "p3"] as const;
export const SCALE_MODES = ["standard", "even"] as const;
export const LEVELS = ["AA", "AA+", "AAA"] as const;
export const CONTEXTS = ["dense", "product", "marketing", "editorial", "poster"] as const;
export const RADII = ["sharp", "soft", "round"] as const;
export const DEPTHS = ["flat", "soft", "layered"] as const;
export const FEELS = ["calm", "brisk", "playful"] as const;
export const MODES = ["light", "dark"] as const;

/** How long a property that calls `generateSystem` may run (spec section 5). */
export const PROPERTY_TIMEOUT = 240_000;

/** Freezes an object and everything inside it, so a mutation throws. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

const cache = new Map<string, DesignSpec>();

/** `generateSystem(params, seed)`, generated once per test file and frozen. */
function cached(key: string, params: DirectionParams, seed: string): DesignSpec {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const spec = deepFreeze(generateSystem(params, seed));
  cache.set(key, spec);
  return spec;
}

/** `generateSystem(DEFAULT_PARAMS, "seed-1")`, the base spec of the cases. */
export function defaultSpec(): DesignSpec {
  return cached("default", DEFAULT_PARAMS, "seed-1");
}

/** The parameters of `richSpec`: a gamut-mapped locked primary and a fluid display step. */
export const RICH_PARAMS: DirectionParams = {
  ...DEFAULT_PARAMS,
  primary: parseColor("oklch(0.7 0.3 145)"),
  type: { context: "marketing", ratio: 1.25 },
  name: "Rich fixture",
};

/**
 * A spec that fills every optional field: `color.params.primary`, `seedStep` and `seedDeviation`
 * (C-PAL-08), `type.ratio`, and the fluid `maxSizePx` and `clamp` of `display`.
 */
export function richSpec(): DesignSpec {
  return cached("rich", RICH_PARAMS, "seed-1");
}

/** A spec with tint `none` and a gray primary: achromatic neutral and primary steps (h null). */
export function grayParams(): DirectionParams {
  return { ...DEFAULT_PARAMS, neutralTint: "none", primary: parseColor("#808080") };
}

export function graySpec(): DesignSpec {
  return cached("gray", grayParams(), "seed-1");
}

/** A path into a spec: object keys and array indexes. */
export type Path = readonly (string | number)[];

type Container = Record<string | number, unknown>;

function isContainer(value: unknown): value is Container {
  return typeof value === "object" && value !== null;
}

function parentOf(root: unknown, path: Path): Container {
  let node: unknown = root;
  for (const key of path.slice(0, -1)) {
    if (!isContainer(node)) throw new Error(`no container at ${path.join(".")}`);
    node = node[key];
  }
  if (!isContainer(node)) throw new Error(`no container at ${path.join(".")}`);
  return node;
}

/** A deep copy of `value` with the field at `path` set to `next`. */
export function withValue(value: unknown, path: Path, next: unknown): unknown {
  const copy: unknown = structuredClone(value);
  parentOf(copy, path)[path[path.length - 1]] = next;
  return copy;
}

/** A deep copy of `value` without the field at `path` (an array loses that element). */
export function without(value: unknown, path: Path): unknown {
  const copy: unknown = structuredClone(value);
  const parent = parentOf(copy, path);
  const key = path[path.length - 1];
  if (Array.isArray(parent)) parent.splice(Number(key), 1);
  else delete parent[key];
  return copy;
}

/** The value at `path`. */
export function valueAt(value: unknown, path: Path): unknown {
  return parentOf(value, path)[path[path.length - 1]];
}

/** Every leaf of `value` with its path, in document order. */
export function leaves(value: unknown, path: Path = []): Array<readonly [Path, unknown]> {
  if (Array.isArray(value)) return value.flatMap((item, i) => leaves(item, [...path, i]));
  if (isContainer(value)) {
    return Object.entries(value).flatMap(([key, item]) => leaves(item, [...path, key]));
  }
  return [[path, value]];
}

/** The paths of every number in `value`. */
export function numberPaths(value: unknown): Path[] {
  return leaves(value)
    .filter(([, leaf]) => typeof leaf === "number")
    .map(([path]) => path);
}

/** The paths of every string in `value`. */
export function stringPaths(value: unknown): Path[] {
  return leaves(value)
    .filter(([, leaf]) => typeof leaf === "string")
    .map(([path]) => path);
}

/** A deep copy whose object keys sit in an order drawn from `random` at every level. */
export function shuffleKeys(value: unknown, random: () => number): unknown {
  if (Array.isArray(value)) return value.map((item) => shuffleKeys(item, random));
  if (!isContainer(value)) return value;
  const keys = Object.keys(value);
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [keys[i], keys[j]] = [keys[j], keys[i]];
  }
  const out: Container = {};
  for (const key of keys) out[key] = shuffleKeys(value[key], random);
  return out;
}

/** A key shuffle drawn from a seed string, so fast-check can shrink it. */
export const shuffled = (value: unknown, seed: string): unknown =>
  shuffleKeys(value, seededRandom(seed));

/**
 * R-02 on any value: every number through `round6`, and a number under the key `h` or `hue`
 * through `roundHue`. Written here, apart from the implementation, to state the expected values.
 */
export function rounded<T>(value: T): T {
  const walk = (node: unknown, hue: boolean): unknown => {
    if (typeof node === "number") return hue ? roundHue(node) : round6(node);
    if (Array.isArray(node)) return node.map((item) => walk(item, false));
    if (isContainer(node)) {
      const out: Container = {};
      for (const [key, item] of Object.entries(node))
        out[key] = walk(item, key === "h" || key === "hue");
      return out;
    }
    return node;
  };
  return walk(value, false) as T;
}

const HUE_NEAR_360 = fc.double({ min: 360 - 1e-9, max: 360, maxExcluded: true, noNaN: true });
const CHROMA_NEAR_EDGE = fc.double({ min: 4e-6 - 1e-9, max: 4e-6 + 1e-9, noNaN: true });

/** C-GEN-04: a locked seed from EXTREME_SEEDS or any in-range color, edges included. */
export const anySeedColor: fc.Arbitrary<Oklch> = fc.oneof(
  fc.constantFrom(...EXTREME_SEEDS.map((text) => parseColor(text))),
  fc.record({
    l: fc.double({ min: 0, max: 1, noNaN: true }),
    c: fc.oneof(fc.double({ min: 0, max: 0.5, noNaN: true }), CHROMA_NEAR_EDGE),
    h: fc.oneof(
      fc.constant(null),
      fc.double({ min: 0, max: 360, maxExcluded: true, noNaN: true }),
      HUE_NEAR_360,
    ),
  }),
);

/** A ratio whose `round6` stays above 1, so `type.ratio` keeps its domain after rounding. */
const anyRatio = fc.oneof(
  fc.constantFrom(1.067, 1.125, 1.2, 1.25, 1.333, Math.SQRT2, 1.5, 1.618, 2),
  fc.double({ min: 1.00001, max: 2, noNaN: true }),
);

/** Any valid `DirectionParams`: every enum, optional locked seeds, an optional ratio and name. */
export const anyDirection: fc.Arbitrary<DirectionParams> = fc.record(
  {
    primary: anySeedColor,
    secondary: anySeedColor,
    accent: anySeedColor,
    harmony: fc.constantFrom(...HARMONIES),
    chroma: fc.constantFrom(...CHROMAS),
    neutralTint: fc.constantFrom(...TINTS),
    gamut: fc.constantFrom(...GAMUTS),
    scaleMode: fc.constantFrom(...SCALE_MODES),
    contrastLevel: fc.constantFrom(...LEVELS),
    type: fc.record(
      { context: fc.constantFrom(...CONTEXTS), ratio: anyRatio },
      { requiredKeys: ["context"] },
    ),
    radius: fc.constantFrom(...RADII),
    depth: fc.constantFrom(...DEPTHS),
    motion: fc.constantFrom(...FEELS),
    name: fc.string({ minLength: 1, maxLength: 80 }),
  },
  {
    requiredKeys: [
      "harmony",
      "chroma",
      "neutralTint",
      "gamut",
      "scaleMode",
      "contrastLevel",
      "type",
      "radius",
      "depth",
      "motion",
    ],
  },
);

/** Any seed string of 1 to 128 UTF-16 code units, ASCII or any code point. */
export const anySeedText: fc.Arbitrary<string> = fc.oneof(
  fc.string({ minLength: 1, maxLength: 128 }),
  fc.string({ unit: "binary", minLength: 1, maxLength: 64 }),
);

/** The 64 characters of base64url. */
export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * The link format of R-22 around deflate bytes made elsewhere: base64url without padding of the
 * bytes followed by their FNV-1a 64, big-endian. Built with Node's Buffer, apart from the codec.
 */
export function linkOfDeflated(deflated: Uint8Array): string {
  const trailer = Buffer.from(fnv1a64(deflated), "hex");
  return Buffer.concat([deflated, trailer]).toString("base64url");
}

/** A link whose payload is `text`, deflated by Node's zlib at level 9. */
export function linkOfText(text: string): string {
  return linkOfDeflated(deflateRawSync(Buffer.from(text, "utf8"), { level: 9 }));
}

/** A link whose payload is any JSON value, as `JSON.stringify` writes it. */
export const linkOfJson = (value: unknown): string => linkOfText(JSON.stringify(value));

/** One stored (uncompressed) final deflate block around `data`, at most 65,535 bytes. */
export function storedBlock(data: Uint8Array): Uint8Array {
  const length = data.length;
  if (length > 0xffff) throw new Error("a stored block holds at most 65,535 bytes");
  const header = [0x01, length & 0xff, length >> 8, ~length & 0xff, (~length >> 8) & 0xff];
  return Uint8Array.from([...header, ...data]);
}

/** The bytes a link carries: the deflate stream, then the 8-byte trailer. */
export const linkBytes = (link: string): Buffer => Buffer.from(link, "base64url");

/** Runs `decode` and returns the `SpecDecodeError` it throws, failing on anything else. */
export function decodeError(decode: () => unknown): SpecDecodeError {
  try {
    decode();
  } catch (error) {
    expect(error).toBeInstanceOf(SpecDecodeError);
    return error as SpecDecodeError;
  }
  throw new Error("expected a SpecDecodeError, but decoding succeeded");
}

/** Asserts that every number in `value` is finite: no NaN and no Infinity (RF3). */
export function expectAllFinite(value: unknown): void {
  for (const [path, leaf] of leaves(value)) {
    if (typeof leaf === "number") {
      expect(Number.isFinite(leaf), `${path.join(".")} is ${leaf}`).toBe(true);
    }
  }
}
