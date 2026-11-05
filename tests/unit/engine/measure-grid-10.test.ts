import { describe, expect, it } from "vitest";
import { describeGridSlice, gridDesigns } from "./measure-grid-support";

// C-MEAS-13, part 10 of 10 (spec R3-41, invariant I-M3-10): grid E, all 168 designs.
describeGridSlice("E", [0, 168]);

describe("gridDesigns", () => {
  it("C-MEAS-13 returns 672, 2184, 336, 448 and 168 designs with no label repeated", () => {
    const sizes = (["A", "B", "C", "D", "E"] as const).map((g) => gridDesigns(g).length);
    expect(sizes).toEqual([672, 2184, 336, 448, 168]);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(3808);
    const labels = (["A", "B", "C", "D", "E"] as const).flatMap((g) =>
      gridDesigns(g).map((d) => d.label),
    );
    expect(new Set(labels).size).toBe(labels.length);
  });
});
