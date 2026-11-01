import { describe, expect, it } from "vitest";
import { seededRandom } from "@/engine/random";

// Cases are the C-RAND-nn rows of docs/specs/01-color-engine.md, section 6.3.

/** Takes `count` values from a generator. */
function draw(next: () => number, count: number): number[] {
  return Array.from({ length: count }, () => next());
}

describe("seededRandom", () => {
  it("C-RAND-01 gives the same first 1,000 values for the same seed", () => {
    const first = draw(seededRandom("dyelot"), 1000);
    const second = draw(seededRandom("dyelot"), 1000);
    expect(second).toEqual(first);
  });

  it("C-RAND-02 gives different first values for 'a' and 'b'", () => {
    expect(seededRandom("a")()).not.toBe(seededRandom("b")());
  });

  it("C-RAND-03 keeps every value in [0, 1) for 10,000 draws of several seeds", () => {
    const seeds = ["", "a", "dyelot", "seed-1", "0", "😀🎨 ünïcödé ".repeat(40), "x".repeat(5000)];
    for (const seed of seeds) {
      for (const value of draw(seededRandom(seed), 10_000)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    }
  });

  it("C-RAND-04 shares no state between two generators of one seed", () => {
    const reference = draw(seededRandom("dyelot"), 20);
    const a = seededRandom("dyelot");
    const b = seededRandom("dyelot");
    draw(a, 7);
    expect(draw(b, 20)).toEqual(reference);
    expect(a()).toBe(reference[7]);
  });

  it("C-RAND-05 matches the golden vectors exactly", () => {
    expect(draw(seededRandom("dyelot"), 3)).toEqual([
      0.3585973768495023, 0.046500695403665304, 0.9080566924531013,
    ]);
    expect(seededRandom("")()).toBe(0.32635160884819925);
    expect(seededRandom("seed-1")()).toBe(0.8052122399676591);
    expect(seededRandom("seed-2")()).toBe(0.19437866914086044);
  });

  it("C-RAND-06 spreads 10,000 values of 'dyelot' evenly", () => {
    const values = draw(seededRandom("dyelot"), 10_000);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.02);
    const deciles = new Array<number>(10).fill(0);
    for (const value of values) deciles[Math.floor(value * 10)]++;
    for (const count of deciles) {
      expect(count).toBeGreaterThanOrEqual(800);
      expect(count).toBeLessThanOrEqual(1200);
    }
  });

  it("C-RAND-07 throws a TypeError for a seed that is not a string", () => {
    for (const bad of [undefined, null, 42, {}, ["a"], Symbol("a")]) {
      expect(() => seededRandom(bad as unknown as string)).toThrow(TypeError);
    }
    expect(() => seededRandom(42 as unknown as string)).toThrow(/seededRandom: seed/);
  });

  it("C-RAND-08 applies no Unicode normalization", () => {
    const composed = "\u00e9";
    const decomposed = "e\u0301";
    expect(composed).not.toBe(decomposed);
    expect(composed.normalize("NFD")).toBe(decomposed);
    expect(seededRandom(composed)()).not.toBe(seededRandom(decomposed)());
  });
});
