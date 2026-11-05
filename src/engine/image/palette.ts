import { hexToRgb, rgbToOklch } from "../color/convert";
import { deltaEOK } from "../color/deltae";
import { assertHex, describeType } from "../color/guards";
import { normalizeSeed } from "../color/palette";
import type { Hex, Oklch } from "../color/types";
import { round6 } from "../round";

/** One color the quantizer found, and the fraction of the image it covers (spec R4-47). */
export type RawCluster = { readonly hex: string; readonly share: number };

/** A cluster after merging: `id` is `c1` to `cN`, `score` is 0 for an ineligible cluster. */
export type ImageCluster = {
  readonly id: string;
  readonly hex: Hex;
  readonly oklch: Oklch;
  readonly share: number;
  readonly score: number;
};

export type ImagePalette = {
  readonly clusters: readonly ImageCluster[];
  readonly roles: {
    readonly primary: string;
    readonly secondary?: string;
    readonly accent?: string;
  };
  readonly neutralTint: "none" | "warm" | "cool";
};

const MAX_CLUSTERS = 8;
const SHARE_SUM_LIMIT = 1.000001;
/** Two colors closer than this in ΔEOK are one cluster. */
const MERGE_DISTANCE = 0.03;
const MIN_CHROMA = 0.04;
const MIN_SHARE = 0.02;
const FULL_CHROMA = 0.15;
const ROLE_HUE_GAP = 30;
const LARGE_SHARE = 0.1;
const TINT_MIN_CHROMA = 0.02;
const WARM_END = 140;
const WARM_START = 330;

type Entry = { readonly hex: Hex; readonly oklch: Oklch; share: number };

/** Hex order by code units, never by locale (the pure core reads no locale). */
function byHex(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** The entries of `raw`, each hex checked by `assertHex`, or the error 9.2 step 1 names. */
function readInput(raw: unknown): { readonly hex: Hex; readonly share: number }[] {
  if (!Array.isArray(raw)) {
    throw new TypeError(`imagePalette: raw must be an array, got ${describeType(raw)}`);
  }
  if (raw.length < 1 || raw.length > MAX_CLUSTERS) {
    throw new RangeError(
      `imagePalette: raw must hold 1 to ${MAX_CLUSTERS} entries, got ${raw.length}`,
    );
  }
  let total = 0;
  const items: { readonly hex: Hex; readonly share: number }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const entry: unknown = raw[i];
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new TypeError(`imagePalette: raw[${i}] must be an object, got ${describeType(entry)}`);
    }
    const { hex, share } = entry as { hex?: unknown; share?: unknown };
    assertHex(hex, `imagePalette: raw[${i}].hex`);
    if (typeof share !== "number") {
      throw new TypeError(
        `imagePalette: raw[${i}].share must be a number, got ${describeType(share)}`,
      );
    }
    if (!Number.isFinite(share) || share <= 0 || share > 1) {
      throw new RangeError(`imagePalette: raw[${i}].share must be in (0, 1], got ${share}`);
    }
    total += share;
    items.push({ hex, share });
  }
  if (total > SHARE_SUM_LIMIT) {
    throw new RangeError(`imagePalette: the shares must sum to at most 1.000001, got ${total}`);
  }
  return items;
}

/** The OKLCH of a hex as a seed: L clamped to [0, 1], then `normalizeSeed` (9.2 step 2). */
function colorOf(hex: Hex): Oklch {
  const color = rgbToOklch(hexToRgb(hex), "srgb");
  return normalizeSeed({ ...color, l: Math.min(Math.max(color.l, 0), 1) });
}

/** The distance of 9.2 step 8 between two hues in degrees. */
function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

function isEligible(cluster: ImageCluster): boolean {
  return cluster.oklch.c >= MIN_CHROMA && cluster.share >= MIN_SHARE;
}

function scoreOf(cluster: Omit<ImageCluster, "score">): number {
  const eligible = cluster.oklch.c >= MIN_CHROMA && cluster.share >= MIN_SHARE;
  return eligible
    ? round6(Math.sqrt(cluster.share) * Math.min(cluster.oklch.c / FULL_CHROMA, 1))
    : 0;
}

function tintOf(clusters: readonly ImageCluster[]): ImagePalette["neutralTint"] {
  let lightest: ImageCluster | undefined;
  for (const cluster of clusters) {
    if (cluster.share >= LARGE_SHARE && (!lightest || cluster.oklch.l > lightest.oklch.l)) {
      lightest = cluster;
    }
  }
  if (!lightest || lightest.oklch.c < TINT_MIN_CHROMA) return "none";
  const hue = lightest.oklch.h ?? 0;
  return hue < WARM_END || hue >= WARM_START ? "warm" : "cool";
}

/**
 * The palette of an image from the clusters a quantizer found (spec 9.2, R4-47): the colors in
 * OKLCH, sorted by share, de-duplicated, scored, with heuristic roles at least 30 degrees of hue
 * apart and a neutral tint from the lightest large cluster. Pure: it reads no pixels.
 */
export function imagePalette(raw: readonly RawCluster[]): ImagePalette {
  const entries: Entry[] = readInput(raw).map(({ hex, share }) => ({
    hex,
    oklch: colorOf(hex),
    share,
  }));
  entries.sort((a, b) => b.share - a.share || byHex(a.hex, b.hex));

  const kept: Entry[] = [];
  for (const entry of entries) {
    const twin = kept.find((other) => deltaEOK(entry.oklch, other.oklch) < MERGE_DISTANCE);
    if (twin) twin.share += entry.share;
    else kept.push({ ...entry });
  }

  const clusters: ImageCluster[] = kept.map((entry, i) => {
    const base = {
      id: `c${i + 1}`,
      hex: entry.hex,
      oklch: entry.oklch,
      share: round6(entry.share),
    };
    return { ...base, score: scoreOf(base) };
  });

  // Highest score first, a tie to the lower index.
  const ranked = clusters
    .map((cluster, index) => ({ cluster, index }))
    .sort((a, b) => b.cluster.score - a.cluster.score || a.index - b.index)
    .map((item) => item.cluster);
  const primary = ranked[0] as ImageCluster;

  const hueOf = (cluster: ImageCluster): number => cluster.oklch.h ?? 0;
  const apart = (cluster: ImageCluster, from: readonly ImageCluster[]): boolean =>
    isEligible(cluster) &&
    from.every((other) => hueGap(hueOf(cluster), hueOf(other)) >= ROLE_HUE_GAP);

  let secondary: ImageCluster | undefined;
  let accent: ImageCluster | undefined;
  if (isEligible(primary)) {
    secondary = ranked.find((cluster) => cluster !== primary && apart(cluster, [primary]));
    if (secondary) {
      const chosen = [primary, secondary];
      accent = ranked.find((cluster) => !chosen.includes(cluster) && apart(cluster, chosen));
    }
  }

  return {
    clusters,
    roles: {
      primary: primary.id,
      ...(secondary ? { secondary: secondary.id } : {}),
      ...(accent ? { accent: accent.id } : {}),
    },
    neutralTint: tintOf(clusters),
  };
}
