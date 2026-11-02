import { describe, expect, it } from "vitest";
import { signed } from "@/features/preview/format";

// The signed change of docs/specs/02-studio.md, section 6.14 (Task 2.10a, fix round 1): one source for
// the change in meters that the dashboard's gauge table and the mobile detail screen write.

describe("signed (section 6.14)", () => {
  it("C-FORMAT-01 writes one decimal with a true minus or a plus, and no sign for zero", () => {
    expect(signed(-0.78)).toBe("−0.8");
    expect(signed(0.9)).toBe("+0.9");
    expect(signed(0)).toBe("0.0");
    expect(signed(-0.04)).toBe("0.0");
    expect(signed(0.04)).toBe("0.0");
    expect(signed(-0)).toBe("0.0");
    expect(signed(2.25)).toBe("+2.3");
  });

  it("C-FORMAT-02 R-05: a value that is not a number is a TypeError, NaN or an infinity a RangeError", () => {
    expect(() => signed("0.8" as never)).toThrow(TypeError);
    expect(() => signed("0.8" as never)).toThrow(/^signed/);
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => signed(value)).toThrow(RangeError);
      expect(() => signed(value)).toThrow(/^signed/);
    }
  });
});
