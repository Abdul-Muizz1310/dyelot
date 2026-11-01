import { hexToRgb, oklchToOklab, rgbToOklab } from "./convert";
import { assertOklch, describeType, isHex } from "./guards";
import type { Oklab, Oklch } from "./types";

// Color names (spec section 5.5, R2-11). Pure: this module never imports the name list. The UI
// loads the list lazily with a dynamic import and hands it to `indexNames`.

const DECIMALS = 1e6;

export type NameEntry = { readonly name: string; readonly hex: string };

type IndexedName = { readonly name: string; readonly hex: string; readonly lab: Oklab };

/** A frozen list of names with each color's OKLab computed once. */
export type NameIndex = { readonly entries: readonly IndexedName[] };

/**
 * Validates a name list and indexes it. An entry is `{ name, hex }` with a non-empty name and a
 * lowercase `#rrggbb` hex; a non-array or a wrong type is a TypeError, an empty list or a bad
 * value a RangeError that names the entry's index. The input is not mutated.
 */
export function indexNames(list: readonly NameEntry[]): NameIndex {
  if (!Array.isArray(list as unknown)) {
    throw new TypeError(`indexNames: list must be an array, got ${describeType(list)}`);
  }
  if (list.length === 0) throw new RangeError("indexNames: list must not be empty");
  const entries = list.map((entry, i): IndexedName => {
    const at = `indexNames: list[${i}]`;
    if (typeof entry !== "object" || entry === null) {
      throw new TypeError(`${at} must be an object, got ${describeType(entry)}`);
    }
    const { name, hex } = entry;
    if (typeof name !== "string") {
      throw new TypeError(`${at}.name must be a string, got ${describeType(name)}`);
    }
    if (name.length === 0) throw new RangeError(`${at}.name must not be empty`);
    if (typeof hex !== "string") {
      throw new TypeError(`${at}.hex must be a string, got ${describeType(hex)}`);
    }
    if (!isHex(hex)) {
      throw new RangeError(`${at}.hex must be a lowercase #rrggbb hex, got ${JSON.stringify(hex)}`);
    }
    return Object.freeze({ name, hex, lab: Object.freeze(rgbToOklab(hexToRgb(hex), "srgb")) });
  });
  return Object.freeze({ entries: Object.freeze(entries) });
}

/**
 * The entry nearest to a color by ΔEOK (the Euclidean distance in OKLab). A tie keeps the earlier
 * entry in list order. A null hue reads as a = b = 0. The distance is rounded to six decimals, so
 * a color equal to an entry reports exactly 0.
 */
export function nearestName(
  color: Oklch,
  index: NameIndex,
): { name: string; hex: string; deltaEOK: number } {
  assertOklch(color, "nearestName: color");
  if (typeof index !== "object" || index === null || !Array.isArray(index.entries)) {
    throw new TypeError(`nearestName: index must come from indexNames, got ${describeType(index)}`);
  }
  const [l, a, b] = color.h === null ? [color.l, 0, 0] : oklchToOklab(color);
  let best = index.entries[0] as IndexedName;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const entry of index.entries) {
    const distance = Math.hypot(l - entry.lab[0], a - entry.lab[1], b - entry.lab[2]);
    if (distance < bestDistance) {
      best = entry;
      bestDistance = distance;
    }
  }
  return {
    name: best.name,
    hex: best.hex,
    deltaEOK: Math.round(bestDistance * DECIMALS) / DECIMALS,
  };
}
