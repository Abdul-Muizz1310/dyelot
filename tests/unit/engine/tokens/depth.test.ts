import { describe, expect, it } from "vitest";
import type { Oklch } from "@/engine/color/types";
import { shadows } from "@/engine/tokens/depth";

// Cases are the C-DEPTH-nn rows of docs/specs/01-color-engine.md, section 6.6.

const NEUTRAL: Oklch = { l: 0.145, c: 0.012, h: 262 };

describe("shadows", () => {
  it("C-DEPTH-01 builds elevation 3 from the key and ambient layers", () => {
    const [key, ambient] = shadows(NEUTRAL)[3];
    expect(key).toEqual({ offsetY: 6, blur: 12, spread: 0, color: NEUTRAL, alpha: 0.1 });
    expect(ambient).toEqual({ offsetY: 3, blur: 6, spread: 0, color: NEUTRAL, alpha: 0.06 });
  });

  it("C-DEPTH-02 scales both layers with elevation L from 1 to 5", () => {
    const all = shadows(NEUTRAL);
    for (let level = 1; level <= 5; level++) {
      const [key, ambient] = all[level];
      expect(key, `key ${level}`).toMatchObject({
        offsetY: 2 * level,
        blur: 4 * level,
        alpha: 0.1,
        spread: 0,
      });
      expect(ambient, `ambient ${level}`).toMatchObject({
        offsetY: level,
        blur: 2 * level,
        alpha: 0.06,
        spread: 0,
      });
    }
  });

  it("C-DEPTH-03 returns six entries: an empty index 0, then [key, ambient]", () => {
    const all = shadows(NEUTRAL);
    expect(all).toHaveLength(6);
    expect(all[0]).toEqual([]);
    for (let level = 1; level <= 5; level++) expect(all[level]).toHaveLength(2);
  });

  it("C-DEPTH-04 colors every layer with the neutral950 argument", () => {
    for (const color of [NEUTRAL, { l: 0.2, c: 0, h: null } as Oklch]) {
      for (const layers of shadows(color)) {
        for (const layer of layers) expect(layer.color).toEqual(color);
      }
    }
  });

  it("C-DEPTH-05 raises offsetY and blur strictly with elevation", () => {
    const all = shadows(NEUTRAL);
    for (let level = 2; level <= 5; level++) {
      for (let layer = 0; layer < 2; layer++) {
        expect(all[level][layer].offsetY).toBeGreaterThan(all[level - 1][layer].offsetY);
        expect(all[level][layer].blur).toBeGreaterThan(all[level - 1][layer].blur);
      }
    }
  });

  it("C-DEPTH-06 throws RangeError for a non-finite field in neutral950", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => shadows({ ...NEUTRAL, l: bad })).toThrow(RangeError);
      expect(() => shadows({ ...NEUTRAL, c: bad })).toThrow(RangeError);
      expect(() => shadows({ ...NEUTRAL, h: bad })).toThrow(RangeError);
    }
    expect(() => shadows({ ...NEUTRAL, l: Number.NaN })).toThrow(/neutral950/);
  });

  it("C-DEPTH-06 throws TypeError for a value that is not a color", () => {
    expect(() => shadows(null as unknown as Oklch)).toThrow(TypeError);
    expect(() => shadows({ ...NEUTRAL, l: "0.1" as unknown as number })).toThrow(TypeError);
  });

  it("returns fresh objects each call", () => {
    const first = shadows(NEUTRAL);
    (first[3][0] as { alpha: number }).alpha = 0.9;
    first[1].pop();
    expect(shadows(NEUTRAL)[3][0].alpha).toBe(0.1);
    expect(shadows(NEUTRAL)[1]).toHaveLength(2);
  });

  it("C-DEPTH-04 gives every layer its own copy of the color (I-01)", () => {
    const input = { ...NEUTRAL };
    const result = shadows(input);
    const colors = result.flat().map((layer) => layer.color);
    for (const color of colors) expect(color).not.toBe(input);
    expect(new Set(colors).size).toBe(colors.length);
    (result[2][1].color as { l: number }).l = 0.9;
    expect(input).toEqual(NEUTRAL);
    expect(result[2][0].color).toEqual(NEUTRAL);
  });
});
