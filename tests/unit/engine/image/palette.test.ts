import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Hex, Oklch, RawCluster } from "@/engine";
import { deltaEOK, gamutMap, hexToRgb, imagePalette, rgbToOklch, toHex } from "@/engine";
import { normalizeSeed } from "@/engine/color/palette";
import { FOUR_COLORS } from "./support";

// Cases are the C-IMG-01 to C-IMG-08 rows of docs/specs/04-ai.md, section 14.6 (rulings R4-47, 9.2).

const oklchOf = (hex: string): Oklch => {
  const raw = rgbToOklch(hexToRgb(hex as Hex), "srgb");
  return normalizeSeed({ ...raw, l: Math.min(Math.max(raw.l, 0), 1) });
};
const hueOf = (hex: string): number => oklchOf(hex).h ?? 0;
const chromaOf = (hex: string): number => oklchOf(hex).c;
/** The distance of 9.2 step 8. */
const hueDistance = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

/** Every hex a hue sweep makes at the given lightnesses, in a fixed order. */
function* sweep(lightnesses: readonly number[], chromas: readonly number[]): Generator<string> {
  for (const c of chromas) {
    for (const l of lightnesses) {
      for (let step = 0; step < 3600; step++) {
        yield toHex(gamutMap({ l, c, h: step / 10 }, "srgb"));
      }
    }
  }
}

/** The first hex of a sweep that satisfies `want`; the test fails when there is none. */
function find(
  want: (hex: string) => boolean,
  lightnesses: readonly number[] = [0.62, 0.5, 0.74, 0.4, 0.85],
  chromas: readonly number[] = [0.25],
): string {
  for (const hex of sweep(lightnesses, chromas)) if (want(hex)) return hex;
  throw new Error("no hex for the predicate");
}

/** A vivid hex (chroma 0.15 or more) whose hue is `lo` to `hi` degrees from `from`'s. */
const vividAt = (from: string, lo: number, hi: number): string =>
  find((hex) => {
    const d = hueDistance(hueOf(hex), hueOf(from));
    return chromaOf(hex) >= 0.15 && d >= lo && d < hi;
  });

/** A hex with the given normalized chroma range and lightness range, found by a neighbor search. */
function withChroma(lo: number, hi: number, lMin = 0, lMax = 1): string {
  const lightnesses = [0.9, 0.95, 0.85, 0.6, 0.3].filter((l) => l >= lMin && l <= lMax);
  return find(
    (hex) => {
      const o = oklchOf(hex);
      return o.c >= lo && o.c < hi && o.l >= lMin && o.l <= lMax;
    },
    lightnesses,
    [lo, (lo + hi) / 2, hi, lo - 0.003, hi + 0.003],
  );
}

/** A pair of hexes whose ΔEOK is in [lo, hi), from a search over the neighbors of `base`. */
function pairApart(base: string, lo: number, hi: number): [string, string] {
  const [r, g, b] = hexToRgb(base as Hex);
  const baseColor = oklchOf(base);
  for (let dr = -8; dr <= 8; dr++) {
    for (let dg = -8; dg <= 8; dg++) {
      for (let db = -8; db <= 8; db++) {
        const hex = toHex([r + dr / 255, g + dg / 255, b + db / 255]);
        const d = deltaEOK(baseColor, oklchOf(hex));
        if (d >= lo && d < hi) return [base, hex];
      }
    }
  }
  throw new Error("no pair");
}

describe("imagePalette: the four colors of the fixture", () => {
  it("C-IMG-01 numbers the clusters by share and picks roles and the tint", () => {
    const result = imagePalette(FOUR_COLORS);
    expect(result.clusters.map((c) => [c.id, c.hex, c.share])).toEqual([
      ["c1", "#b8422e", 0.4],
      ["c2", "#3a6ea5", 0.3],
      ["c3", "#f2e6d0", 0.2],
      ["c4", "#1a1c1e", 0.1],
    ]);
    expect(result.roles).toStrictEqual({ primary: "c1", secondary: "c2" });
    expect(result.neutralTint).toBe("warm");
    expect(result.clusters[3]?.score).toBe(0);
    expect(result.clusters[0]?.score).toBeGreaterThan(0);
    expect(result.clusters[1]?.score).toBeGreaterThan(0);
    expect(result.clusters[0]?.oklch).toEqual(oklchOf("#b8422e"));
  });

  it("C-IMG-01 scores a cluster as round6(sqrt(share) x min(c / 0.15, 1))", () => {
    const [c1] = imagePalette(FOUR_COLORS).clusters;
    const chroma = oklchOf("#b8422e").c;
    expect(c1?.score).toBe(Number((Math.sqrt(0.4) * Math.min(chroma / 0.15, 1)).toPrecision(6)));
  });
});

describe("imagePalette: merging", () => {
  const base = "#7a5c3e";

  it("C-IMG-02 merges two hexes 0.02 apart into the first, sums the shares and renumbers", () => {
    const [a, b] = pairApart(base, 0.0195, 0.0205);
    const other = "#2f6f8f";
    const result = imagePalette([
      { hex: a as Hex, share: 0.4 },
      { hex: other, share: 0.35 },
      { hex: b as Hex, share: 0.2 },
    ]);
    expect(result.clusters.map((c) => [c.id, c.hex, c.share])).toEqual([
      ["c1", a, 0.6],
      ["c2", other, 0.35],
    ]);
  });

  it("C-IMG-02 keeps two hexes 0.03 apart, and merges a pair just under 0.03", () => {
    const [a, b] = pairApart(base, 0.03, 0.031);
    expect(deltaEOK(oklchOf(a), oklchOf(b))).toBeGreaterThanOrEqual(0.03);
    const kept = imagePalette([
      { hex: a as Hex, share: 0.5 },
      { hex: b as Hex, share: 0.3 },
    ]);
    expect(kept.clusters.map((c) => c.id)).toEqual(["c1", "c2"]);
    const [x, y] = pairApart(base, 0.0295, 0.03);
    expect(deltaEOK(oklchOf(x), oklchOf(y))).toBeLessThan(0.03);
    const merged = imagePalette([
      { hex: x as Hex, share: 0.5 },
      { hex: y as Hex, share: 0.3 },
    ]);
    expect(merged.clusters.map((c) => [c.id, c.share])).toEqual([["c1", 0.8]]);
  });

  it("C-IMG-02 measures a later entry against the first kept cluster, not a merged one", () => {
    const [a, b] = pairApart(base, 0.0195, 0.0205);
    // A third color near b but not near a stays: it is compared with the kept cluster a.
    const far = pairApart(b, 0.0295, 0.0305)[1];
    const near = imagePalette([
      { hex: a as Hex, share: 0.4 },
      { hex: b as Hex, share: 0.3 },
      { hex: far as Hex, share: 0.2 },
    ]);
    expect(near.clusters[0]?.share).toBe(0.7);
  });
});

describe("imagePalette: numbering after a merge", () => {
  it("C-IMG-02 renumbers by merged share, so c1 holds the largest share", () => {
    const [b, b2] = pairApart("#2f6f8f", 0.0195, 0.0205);
    const a = "#b8422e";
    const result = imagePalette([
      { hex: a as Hex, share: 0.3 },
      { hex: b as Hex, share: 0.25 },
      { hex: b2 as Hex, share: 0.2 },
    ]);
    expect(result.clusters.map((c) => [c.id, c.hex, c.share])).toEqual([
      ["c1", b, 0.45],
      ["c2", a, 0.3],
    ]);
  });
});

describe("imagePalette: gray and the eligibility thresholds", () => {
  it("C-IMG-03 gives gray clusters no secondary or accent, a primary c1 and the tint none", () => {
    const result = imagePalette([
      { hex: "#202020", share: 0.4 },
      { hex: "#808080", share: 0.3 },
      { hex: "#c0c0c0", share: 0.2 },
      { hex: "#f0f0f0", share: 0.1 },
    ]);
    expect(result.roles).toStrictEqual({ primary: "c1" });
    expect(result.neutralTint).toBe("none");
    for (const cluster of result.clusters) expect(cluster.score).toBe(0);
  });

  it("C-IMG-03 does not count chroma 0.039 or share 0.019 as eligible, and does at the limits", () => {
    const lowChroma = withChroma(0.039, 0.0399);
    const edgeChroma = withChroma(0.04, 0.0412);
    const lowShare = imagePalette([
      { hex: "#b8422e", share: 0.5 },
      { hex: edgeChroma as Hex, share: 0.019 },
    ]);
    expect(lowShare.clusters[1]?.score).toBe(0);
    const enough = imagePalette([
      { hex: "#b8422e", share: 0.5 },
      { hex: edgeChroma as Hex, share: 0.02 },
    ]);
    expect(enough.clusters[1]?.score).toBeGreaterThan(0);
    const chromaOnly = imagePalette([
      { hex: "#b8422e", share: 0.5 },
      { hex: lowChroma as Hex, share: 0.3 },
    ]);
    expect(chromaOnly.clusters[1]?.score).toBe(0);
    expect(chromaOnly.roles).toStrictEqual({ primary: "c1" });
  });

  it("C-IMG-03 makes c1 the primary when no cluster is eligible, whatever the order of scores", () => {
    const result = imagePalette([
      { hex: "#101010", share: 0.5 },
      { hex: "#ffffff", share: 0.5 },
    ]);
    expect(result.roles).toStrictEqual({ primary: "c1" });
    expect(result.clusters.map((c) => c.hex)).toEqual(["#101010", "#ffffff"]);
  });
});

describe("imagePalette: hue distance", () => {
  it("C-IMG-04 skips a candidate 29 degrees from the primary and takes one 30 degrees away", () => {
    const primary = vividAt("#b8422e", 0, 8);
    const near = vividAt(primary, 29, 30);
    const far = vividAt(primary, 30, 31);
    const result = imagePalette([
      { hex: primary as Hex, share: 0.5 },
      { hex: near as Hex, share: 0.3 },
      { hex: far as Hex, share: 0.15 },
    ]);
    const idOf = (hex: string) => result.clusters.find((c) => c.hex === hex)?.id;
    expect(idOf(near)).toBe("c2");
    expect(result.roles.primary).toBe("c1");
    expect(result.roles.secondary).toBe(idOf(far));
  });

  it("C-IMG-04 takes an accent 30 degrees from both, and skips one under 30 from either", () => {
    const primary = vividAt("#b8422e", 0, 8);
    const second = vividAt(primary, 30, 31);
    const decoy = find((hex) => {
      const dp = hueDistance(hueOf(hex), hueOf(primary));
      const ds = hueDistance(hueOf(hex), hueOf(second));
      const apartInColor = [primary, second].every(
        (other) => deltaEOK(oklchOf(hex), oklchOf(other)) >= 0.05,
      );
      return chromaOf(hex) >= 0.15 && dp >= 30 && ds < 30 && apartInColor;
    });
    const accent = find((hex) => {
      const dp = hueDistance(hueOf(hex), hueOf(primary));
      const ds = hueDistance(hueOf(hex), hueOf(second));
      return chromaOf(hex) >= 0.15 && dp >= 30 && ds >= 30 && ds < 31;
    });
    const result = imagePalette([
      { hex: primary as Hex, share: 0.4 },
      { hex: second as Hex, share: 0.25 },
      { hex: decoy as Hex, share: 0.15 },
      { hex: accent as Hex, share: 0.1 },
    ]);
    const idOf = (hex: string) => result.clusters.find((c) => c.hex === hex)?.id;
    expect(result.clusters).toHaveLength(4);
    expect(result.roles).toStrictEqual({
      primary: "c1",
      secondary: idOf(second),
      accent: idOf(accent),
    });
  });

  it("C-IMG-04 reads a 350 degree and a 10 degree hue as 20 degrees apart", () => {
    const a = find((hex) => hueOf(hex) >= 350 && hueOf(hex) < 351 && chromaOf(hex) >= 0.1);
    const b = find((hex) => hueOf(hex) >= 10 && hueOf(hex) < 11 && chromaOf(hex) >= 0.1);
    expect(hueDistance(hueOf(a), hueOf(b))).toBeGreaterThan(19);
    expect(hueDistance(hueOf(a), hueOf(b))).toBeLessThan(22);
    const result = imagePalette([
      { hex: a as Hex, share: 0.5 },
      { hex: b as Hex, share: 0.4 },
    ]);
    expect(result.roles).toStrictEqual({ primary: "c1" });
  });
});

describe("imagePalette: the tint", () => {
  const tintOf = (hex: string, share = 0.5): string =>
    imagePalette([{ hex: hex as Hex, share }]).neutralTint;
  const hueIn = (lo: number, hi: number): string =>
    find((hex) => hueOf(hex) >= lo && hueOf(hex) < hi && chromaOf(hex) >= 0.05);

  it("C-IMG-05 gives warm for hues 20 and 335 and cool for 140 and 200", () => {
    expect(tintOf(hueIn(20, 21))).toBe("warm");
    expect(tintOf(hueIn(335, 336))).toBe("warm");
    expect(tintOf(hueIn(140, 141))).toBe("cool");
    expect(tintOf(hueIn(200, 201))).toBe("cool");
  });

  it("C-IMG-05 puts the edges at 140 (cool), 330 (warm) and just under each", () => {
    expect(tintOf(hueIn(139, 139.999))).toBe("warm");
    expect(tintOf(hueIn(329, 329.999))).toBe("cool");
    expect(tintOf(hueIn(330, 331))).toBe("warm");
    expect(tintOf(hueIn(359, 360))).toBe("warm");
    expect(tintOf(hueIn(0, 1))).toBe("warm");
  });

  it("C-IMG-05 does not count a share of 0.09 as large, and does count 0.1", () => {
    const dark = find(
      (hex) => hueOf(hex) >= 250 && hueOf(hex) < 260 && oklchOf(hex).l < 0.5,
      [0.4],
    );
    const light = find((hex) => hueOf(hex) >= 60 && hueOf(hex) < 70 && oklchOf(hex).l > 0.8, [0.9]);
    const withLight = (share: number) =>
      imagePalette([
        { hex: dark as Hex, share: 0.5 },
        { hex: light as Hex, share },
      ]).neutralTint;
    expect(withLight(0.09)).toBe("cool");
    expect(withLight(0.1)).toBe("warm");
  });

  it("C-IMG-05 gives none when the lightest large cluster has chroma 0.019, and picks 0.02 up", () => {
    const dark = find(
      (hex) => hueOf(hex) >= 250 && hueOf(hex) < 260 && oklchOf(hex).l < 0.5,
      [0.4],
    );
    const pale = withChroma(0.0185, 0.0195, 0.8);
    const tinted = withChroma(0.02, 0.0215, 0.8);
    const tintWith = (hex: string) =>
      imagePalette([
        { hex: dark as Hex, share: 0.5 },
        { hex: hex as Hex, share: 0.2 },
      ]).neutralTint;
    expect(tintWith(pale)).toBe("none");
    expect(tintWith(tinted)).not.toBe("none");
  });

  it("C-IMG-05 breaks a lightness tie to the lower index", () => {
    const lightnesses = Array.from({ length: 21 }, (_, i) => 0.6 + i / 100);
    const byLightness = new Map<number, string>();
    for (const hex of sweep(lightnesses, [0.08])) {
      const o = oklchOf(hex);
      if (o.c < 0.05 || !(o.h !== null && o.h >= 60 && o.h < 70)) continue;
      byLightness.set(o.l, hex);
    }
    let pair: [string, string] | undefined;
    for (const hex of sweep(lightnesses, [0.08])) {
      const o = oklchOf(hex);
      const warm = byLightness.get(o.l);
      if (o.c >= 0.05 && o.h !== null && o.h >= 250 && o.h < 260 && warm) {
        pair = [warm, hex];
        break;
      }
    }
    expect(pair).toBeDefined();
    const [warm, cool] = pair as [string, string];
    expect(oklchOf(warm).l).toBe(oklchOf(cool).l);
    const tint = (first: string, second: string) =>
      imagePalette([
        { hex: first as Hex, share: 0.3 },
        { hex: second as Hex, share: 0.3 },
      ]);
    // Equal shares sort by hex, so c1 is the smaller hex; the tint follows c1's hue.
    const result = tint(warm, cool);
    expect(result.clusters[0]?.id).toBe("c1");
    const first = result.clusters[0]?.hex;
    expect(result.neutralTint).toBe(first === warm ? "warm" : "cool");
  });
});

describe("imagePalette: ties", () => {
  it("C-IMG-06 sorts equal shares by hex in code-unit order", () => {
    const result = imagePalette([
      { hex: "#b8422e", share: 0.25 },
      { hex: "#3a6ea5", share: 0.25 },
      { hex: "#2f8f4e", share: 0.25 },
    ]);
    const hexes = result.clusters.map((c) => c.hex);
    expect(hexes).toEqual(["#2f8f4e", "#3a6ea5", "#b8422e"]);
    expect(hexes).toEqual([...hexes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });

  it("C-IMG-06 orders equal shares by code units, so a digit sorts before a letter", () => {
    const result = imagePalette([
      { hex: "#a8c4d6", share: 0.5 },
      { hex: "#9a3b2c", share: 0.5 },
    ]);
    expect(result.clusters.map((c) => c.hex)).toEqual(["#9a3b2c", "#a8c4d6"]);
  });

  it("C-IMG-06 sends equal scores to the lower index, for the primary, secondary and accent", () => {
    const one = "#b8422e";
    const two = vividAt(one, 90, 150);
    const three = find(
      (hex) =>
        chromaOf(hex) >= 0.15 &&
        hueDistance(hueOf(hex), hueOf(one)) >= 30 &&
        hueDistance(hueOf(hex), hueOf(two)) >= 30,
    );
    const result = imagePalette([
      { hex: one, share: 0.3 },
      { hex: two as Hex, share: 0.3 },
      { hex: three as Hex, share: 0.3 },
    ]);
    const scores = result.clusters.map((c) => c.score);
    expect(new Set(scores).size).toBe(1);
    expect(result.roles).toStrictEqual({ primary: "c1", secondary: "c2", accent: "c3" });
  });
});

describe("imagePalette: bad input", () => {
  const ok: RawCluster = { hex: "#b8422e", share: 0.5 };
  const call = (raw: unknown) => () => imagePalette(raw as readonly RawCluster[]);

  it.each([
    ["undefined", undefined],
    ["a string", "#b8422e"],
    ["an object", { hex: "#b8422e", share: 1 }],
    ["null", null],
    ["a null entry", [null]],
    ["a number entry", [5]],
    ["a string entry", ["#b8422e"]],
    ["an array entry", [[]]],
    ["a numeric hex", [{ hex: 5, share: 0.5 }]],
    ["a string share", [{ hex: "#b8422e", share: "0.5" }]],
    ["a missing share", [{ hex: "#b8422e" }]],
  ])("C-IMG-07 throws TypeError for %s", (_name, raw) => {
    expect(call(raw)).toThrow(TypeError);
    expect(call(raw)).toThrow(/^imagePalette/);
  });

  it.each([
    ["an empty array", []],
    ["nine entries", Array.from({ length: 9 }, (_, i) => ({ hex: `#00000${i}`, share: 0.1 }))],
    ["an uppercase hex", [{ hex: "#ABC123", share: 0.5 }]],
    ["a non-hex digit", [{ hex: "#ggg000", share: 0.5 }]],
    ["a short hex", [{ hex: "#abc", share: 0.5 }]],
    ["a share of 0", [{ ...ok, share: 0 }]],
    ["a share of 1.5", [{ ...ok, share: 1.5 }]],
    ["a negative share", [{ ...ok, share: -0.1 }]],
    ["a share of NaN", [{ ...ok, share: Number.NaN }]],
    ["an infinite share", [{ ...ok, share: Number.POSITIVE_INFINITY }]],
    [
      "shares summing to 1.01",
      [
        { hex: "#b8422e", share: 0.5 },
        { hex: "#3a6ea5", share: 0.51 },
      ],
    ],
  ])("C-IMG-07 throws RangeError for %s", (_name, raw) => {
    expect(call(raw)).toThrow(RangeError);
    expect(call(raw)).toThrow(/^imagePalette/);
  });

  it("C-IMG-07 accepts eight entries, a share of 1 and a sum of 1.000001", () => {
    expect(imagePalette([{ hex: "#b8422e", share: 1 }]).clusters).toHaveLength(1);
    expect(
      imagePalette([
        { hex: "#b8422e", share: 0.5 },
        { hex: "#3a6ea5", share: 0.5000009 },
      ]).clusters,
    ).toHaveLength(2);
    const eight = Array.from({ length: 8 }, (_, i) => ({
      hex: toHex([i / 8, 0.5, 1 - i / 8]),
      share: 0.125,
    }));
    expect(imagePalette(eight).clusters.length).toBeGreaterThan(0);
  });

  it("C-IMG-07 does not change its input", () => {
    const raw = FOUR_COLORS.map((c) => ({ ...c }));
    imagePalette(raw);
    expect(raw).toEqual(FOUR_COLORS);
  });
});

describe("imagePalette: properties", () => {
  const rawClusters: fc.Arbitrary<RawCluster[]> = fc
    .array(
      fc.record({
        rgb: fc.tuple(
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
        ),
        weight: fc.integer({ min: 1, max: 1000 }),
      }),
      { minLength: 1, maxLength: 8 },
    )
    .map((items) => {
      const total = items.reduce((sum, item) => sum + item.weight, 0);
      return items.map((item) => ({
        hex: toHex([item.rgb[0] / 255, item.rgb[1] / 255, item.rgb[2] / 255]) as string,
        share: item.weight / total,
      }));
    });

  it("C-IMG-08 numbers c1 to cN, keeps the share, makes distinct roles 30 degrees apart, and agrees", () => {
    fc.assert(
      fc.property(rawClusters, (raw) => {
        const result = imagePalette(raw);
        const n = result.clusters.length;
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(8);
        expect(result.clusters.map((c) => c.id)).toEqual(
          Array.from({ length: n }, (_, i) => `c${i + 1}`),
        );
        const shares = result.clusters.map((c) => c.share);
        expect(shares).toEqual([...shares].sort((x, y) => y - x));
        const total = result.clusters.reduce((sum, c) => sum + c.share, 0);
        expect(Math.abs(total - raw.reduce((sum, c) => sum + c.share, 0))).toBeLessThan(1e-5);
        const ids = Object.values(result.roles);
        expect(new Set(ids).size).toBe(ids.length);
        const hues = ids.map((id) => result.clusters.find((c) => c.id === id)?.oklch.h);
        for (let i = 0; i < hues.length; i++) {
          for (let j = i + 1; j < hues.length; j++) {
            const a = hues[i];
            const b = hues[j];
            expect(a).not.toBeNull();
            expect(b).not.toBeNull();
            expect(hueDistance(a as number, b as number)).toBeGreaterThanOrEqual(30);
          }
        }
        expect(imagePalette(raw)).toEqual(result);
      }),
      { numRuns: 500, seed: 4006 },
    );
  });
});
