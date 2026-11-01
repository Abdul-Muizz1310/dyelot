import { describe, expect, it } from "vitest";
import { FONT_CATALOG, type FontEntry, genericness } from "@/engine/fonts/catalog";
import { choosePairing, PAIRING_IDS, PAIRINGS, type Pairing } from "@/engine/fonts/pairings";
import { generateSystem } from "@/engine/generate";
import { DEFAULT_PARAMS } from "../../spec/support";

// Cases are the C-PAIR-08 to C-PAIR-14 rows of docs/specs/02-studio.md, section 6.2 (Task 2.4).

const seeds = (count: number, prefix = "s"): string[] =>
  Array.from({ length: count }, (_, i) => `${prefix}${i}`);

/** A fixture catalog: display face `d<i>` has genericness 1 when `generic(i)`, else 0. */
function fixture(generic: (i: number) => boolean): {
  pairings: readonly Pairing[];
  catalog: readonly FontEntry[];
} {
  const catalog = Array.from(
    { length: 20 },
    (_, i): FontEntry => ({
      id: `d${i}`,
      family: `Fixture ${i}`,
      category: "sans",
      variable: true,
      axes: ["wght"],
      weights: [100, 900],
      license: "OFL-1.1",
      popularity: generic(i) ? 1 : 500,
      fallback: "sans-serif",
    }),
  );
  const pairings = catalog.map(
    (font, i): Pairing => ({
      id: `p${i}`,
      label: `Pairing ${i}`,
      display: font.id,
      body: font.id,
      mono: font.id,
      fit: [],
      risk: "low",
    }),
  );
  return { pairings, catalog };
}

describe("choosePairing", () => {
  it("C-PAIR-08 is deterministic per seed, and the empty seed is valid", () => {
    for (const seed of ["", "seed-1", "s7", "é"]) {
      const first = choosePairing(seed);
      expect(PAIRING_IDS).toContain(first);
      for (let i = 0; i < 3; i++) expect(choosePairing(seed)).toBe(first);
    }
  });

  it("C-PAIR-09 picks at least 10 distinct pairings over 500 seeds", () => {
    const picks = new Set(seeds(500).map((seed) => choosePairing(seed)));
    expect(picks.size).toBeGreaterThanOrEqual(10);
  });

  it("C-PAIR-10 picks a display face of genericness 0.8 or more at most 10% of the time", () => {
    const picks = seeds(1000).map((seed) => choosePairing(seed));
    const generic = picks.filter((id) => {
      const display = PAIRINGS.find((p) => p.id === id)?.display ?? "";
      return genericness(display, FONT_CATALOG) >= 0.8;
    });
    expect(generic.length / picks.length).toBeLessThanOrEqual(0.1);
  });

  it("C-PAIR-11 weights five generic faces of 20 to about 9.09%, not 25%", () => {
    const { pairings, catalog } = fixture((i) => i < 5);
    const total = 20_000;
    let generic = 0;
    for (const seed of seeds(total, "w")) {
      const id = choosePairing(seed, pairings, catalog);
      if (Number(id.slice(1)) < 5) generic++;
    }
    expect(generic / total).toBeGreaterThan(0.076);
    expect(generic / total).toBeLessThan(0.106);
  });

  it("C-PAIR-12 picks every pairing between 2% and 8% when no face is generic", () => {
    const { pairings, catalog } = fixture(() => false);
    const total = 20_000;
    const counts = new Map<string, number>();
    for (const seed of seeds(total, "u")) {
      const id = choosePairing(seed, pairings, catalog);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect(counts.size).toBe(20);
    for (const count of counts.values()) {
      expect(count / total).toBeGreaterThan(0.02);
      expect(count / total).toBeLessThan(0.08);
    }
  });

  it("C-PAIR-13 draws from a stream apart from the palette stream", () => {
    for (const seed of ["seed-1", "s3"]) {
      const before = generateSystem(DEFAULT_PARAMS, seed).color;
      choosePairing(seed);
      choosePairing(`${seed}:pairing`);
      expect(generateSystem(DEFAULT_PARAMS, seed).color).toEqual(before);
    }
  });

  it("C-PAIR-14 throws TypeError for a non-string seed and RangeError for an empty list", () => {
    expect(() => choosePairing(3 as never)).toThrow(TypeError);
    expect(() => choosePairing(null as never)).toThrow(/^choosePairing:/);
    expect(() => choosePairing("s", [])).toThrow(RangeError);
    expect(() => choosePairing("s", [])).toThrow(/^choosePairing:/);
    expect(() => choosePairing("s", "x" as never)).toThrow(TypeError);
    expect(() => choosePairing("s", PAIRINGS, "x" as never)).toThrow(/^choosePairing:/);
  });
});
