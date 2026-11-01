import { describe, expect, it } from "vitest";
import { spaceScale } from "@/engine/tokens/space";

// Cases are the C-SPACE-nn rows of docs/specs/01-color-engine.md, section 6.6.

describe("spaceScale", () => {
  it("C-SPACE-01 multiplies 0 1 2 3 4 6 8 12 16 20 24 32 by 4", () => {
    expect(spaceScale(4)).toEqual([0, 4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 128]);
  });

  it("C-SPACE-02 returns a new array each call", () => {
    const first = spaceScale(4) as number[];
    first[0] = 999;
    first.pop();
    expect(spaceScale(4)).toEqual([0, 4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 128]);
  });

  it("C-SPACE-03 throws RangeError for a base other than 4", () => {
    for (const base of [8, Number.NaN, 0, -4, Number.POSITIVE_INFINITY]) {
      expect(() => spaceScale(base as 4), String(base)).toThrow(RangeError);
    }
    expect(() => spaceScale(8 as 4)).toThrow(/basePx/);
  });

  it("C-SPACE-03 throws TypeError for a base that is not a number", () => {
    expect(() => spaceScale("4" as unknown as 4)).toThrow(TypeError);
    expect(() => spaceScale(undefined as unknown as 4)).toThrow(TypeError);
  });
});
