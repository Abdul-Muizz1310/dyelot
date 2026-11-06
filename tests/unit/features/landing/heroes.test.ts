import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { flavorSeed, flavorStops, freshParams, generateSystem, oklchToRgb, toHex } from "@/engine";
import { HERO_CARDS } from "@/features/landing/cards";
import { defaultDesign, HERO_PARAMS, heroCards, heroSpec } from "@/features/landing/heroes";
import { encodeSpec, specId } from "@/spec";

// C-LAND5-01, C-LAND5-02 and C-LAND5-08 of docs/specs/05-motion-3d.md, section 14.5 (R5-31).
// `DYELOT_UPDATE_HEROES=1` rewrites src/features/landing/hero-cards.json, as R3-11 writes JSON; it
// fails together with `CI`.

const FILE = path.join(process.cwd(), "src/features/landing/hero-cards.json");

/** R5-31's table, written out: name, seed, primary seed and its hex. */
const TABLE = [
  ["Madder", "hero-madder", { l: 0.7, c: 0.17, h: 22 }, "#f66c6d"],
  ["Weld", "hero-weld", { l: 0.82, c: 0.15, h: 95 }, "#e3c23b"],
  ["Verdigris", "hero-verdigris", { l: 0.68, c: 0.11, h: 165 }, "#4bae87"],
  ["Woad", "hero-woad", { l: 0.58, c: 0.12, h: 235 }, "#0e84b7"],
  ["Logwood", "hero-logwood", { l: 0.52, c: 0.14, h: 300 }, "#7652ac"],
  ["Cochineal", "hero-cochineal", { l: 0.6, c: 0.2, h: 345 }, "#cd3f9b"],
] as const;

if (process.env.DYELOT_UPDATE_HEROES === "1") {
  describe("the committed hero cards", () => {
    it("C-LAND5-02 rewrites hero-cards.json, and never in CI", () => {
      expect(process.env.CI, "DYELOT_UPDATE_HEROES must not run in CI").toBeUndefined();
      writeFileSync(FILE, `${JSON.stringify(heroCards(), null, 2)}\n`);
    });
  });
}

describe("HERO_PARAMS (R5-31)", () => {
  it("C-LAND5-01 equals the table, with each primary inside sRGB and its hex the table's", () => {
    expect(HERO_PARAMS.map((p) => [p.name, p.seed, p.primary])).toEqual(
      TABLE.map(([name, seed, primary]) => [name, seed, primary]),
    );
    HERO_PARAMS.forEach((p, i) => {
      expect(toHex(oklchToRgb(p.primary, "srgb"))).toBe(TABLE[i]?.[3]);
    });
  });

  it("C-LAND5-01 is frozen, rows and colors included", () => {
    expect(Object.isFrozen(HERO_PARAMS)).toBe(true);
    for (const p of HERO_PARAMS) {
      expect(Object.isFrozen(p)).toBe(true);
      expect(Object.isFrozen(p.primary)).toBe(true);
    }
  });
});

describe("heroSpec and heroCards (R5-31)", () => {
  it("C-LAND5-02 heroSpec(i) is generateSystem of row i + 1, and the same object twice", () => {
    for (const i of [0, 3]) {
      const row = TABLE[i];
      if (row === undefined) throw new Error("no row");
      const expected = generateSystem({ ...freshParams(), primary: row[2], name: row[0] }, row[1]);
      expect(heroSpec(i)).toEqual(expected);
      expect(heroSpec(i)).toBe(heroSpec(i));
    }
    expect(defaultDesign()).toBe(heroSpec(0));
  });

  it("C-LAND5-02 heroCards gives the shared seed and fade and six cards", () => {
    const cards = heroCards();
    const first = heroSpec(0);
    expect(cards.seed).toEqual(flavorSeed(specId(first)));
    expect(cards.fade).toEqual({
      durationMs: first.motion.durations.base,
      easing: first.motion.easings.standard,
    });
    expect(cards.cards).toHaveLength(6);
    cards.cards.forEach((card, i) => {
      const spec = heroSpec(i);
      expect(card.name).toBe(TABLE[i]?.[0]);
      expect(card.href).toBe(`/studio#s=${encodeSpec(spec)}`);
      expect(card.stops).toEqual(flavorStops(spec, "dark"));
    });
  });

  it("C-LAND5-02 HERO_CARDS, the committed JSON, deep-equals heroCards()", () => {
    expect(HERO_CARDS).toEqual(heroCards());
  });

  it("C-LAND5-02 the update switch and CI never run together", () => {
    expect(process.env.DYELOT_UPDATE_HEROES === "1" && process.env.CI !== undefined).toBe(false);
  });

  it("C-LAND5-08 heroSpec checks its index: a TypeError for a non-number", () => {
    expect(() => heroSpec("0" as never)).toThrow(TypeError);
    expect(() => heroSpec("0" as never)).toThrow(/^heroSpec/);
  });

  it.each([6, -1, 0.5, Number.NaN])("C-LAND5-08 heroSpec(%s) is a RangeError", (index) => {
    expect(() => heroSpec(index)).toThrow(RangeError);
    expect(() => heroSpec(index)).toThrow(/^heroSpec/);
  });
});
