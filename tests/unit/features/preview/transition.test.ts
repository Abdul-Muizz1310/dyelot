import { describe, expect, it } from "vitest";
import { templateTransition } from "@/features/preview/transition";

// The template switch's transition props (R5-46, section 10.1).

describe("templateTransition", () => {
  it("C-VT-01 gives auto each for share, enter and exit, and none by default", () => {
    const transition = templateTransition(false);
    expect(transition).toEqual({ share: "auto", enter: "auto", exit: "auto", default: "none" });
    expect(Object.isFrozen(transition)).toBe(true);
  });

  it("C-VT-01 gives none each while the canvas's Reduce motion is on", () => {
    const transition = templateTransition(true);
    expect(transition).toEqual({ share: "none", enter: "none", exit: "none", default: "none" });
    expect(Object.isFrozen(transition)).toBe(true);
  });

  it("C-VT-02 throws a TypeError naming templateTransition for a non-boolean", () => {
    for (const value of ["yes", 1, 0, null, undefined, {}, []]) {
      expect(() => templateTransition(value as never)).toThrow(TypeError);
      expect(() => templateTransition(value as never)).toThrow(/^templateTransition/);
    }
  });
});
