import { describe, expect, it } from "vitest";
import { nextIndex, paletteLine } from "@/features/landing/cycle";

// C-LAND5-06 and C-LAND5-07 of docs/specs/05-motion-3d.md, section 14.5 (R5-32, R-05): the hero's
// palette cycle.

/** A value of the wrong type or domain, passed where the types forbid it. */
const bad = (value: unknown) => value as never;

/** Fails unless `run` throws `kind` with a message that starts with `name` and a colon. */
function expectThrow(run: () => unknown, kind: ErrorConstructor, name: string) {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(kind);
  expect((caught as Error).message).toMatch(new RegExp(`^${name}: `));
}

describe("nextIndex", () => {
  it("C-LAND5-06 moves to the next card and wraps the last to the first", () => {
    expect(nextIndex(0, 6)).toBe(1);
    expect(nextIndex(4, 6)).toBe(5);
    expect(nextIndex(5, 6)).toBe(0);
    expect(nextIndex(0, 1)).toBe(0);
  });

  it("C-LAND5-07 refuses an index outside the cards, no cards and a string", () => {
    expectThrow(() => nextIndex(6, 6), RangeError, "nextIndex");
    expectThrow(() => nextIndex(-1, 6), RangeError, "nextIndex");
    expectThrow(() => nextIndex(0, 0), RangeError, "nextIndex");
    expectThrow(() => nextIndex(bad("0"), 6), TypeError, "nextIndex");
  });

  it("C-LAND5-07 nextIndex checks both types before either domain, and wants whole numbers", () => {
    expectThrow(() => nextIndex(-1, bad("6")), TypeError, "nextIndex");
    expectThrow(() => nextIndex(0.5, 6), RangeError, "nextIndex");
    expectThrow(() => nextIndex(0, 2.5), RangeError, "nextIndex");
    expectThrow(() => nextIndex(Number.NaN, 6), RangeError, "nextIndex");
  });
});

describe("paletteLine", () => {
  it("C-LAND5-06 names the card's place and name", () => {
    expect(paletteLine(0, 6, "Madder")).toBe("Palette 1 of 6: Madder.");
    expect(paletteLine(1, 6, "Weld")).toBe("Palette 2 of 6: Weld.");
    expect(paletteLine(5, 6, "Cochineal")).toBe("Palette 6 of 6: Cochineal.");
  });

  it("C-LAND5-07 refuses an empty name", () => {
    expectThrow(() => paletteLine(0, 6, ""), RangeError, "paletteLine");
  });

  it("C-LAND5-07 paletteLine checks every type before any domain, then the index and the count", () => {
    expectThrow(() => paletteLine(bad("0"), 6, "Madder"), TypeError, "paletteLine");
    expectThrow(() => paletteLine(0, bad(null), "Madder"), TypeError, "paletteLine");
    expectThrow(() => paletteLine(-1, 6, bad(5)), TypeError, "paletteLine");
    expectThrow(() => paletteLine(6, 6, "Madder"), RangeError, "paletteLine");
    expectThrow(() => paletteLine(0, 0, "Madder"), RangeError, "paletteLine");
  });
});
