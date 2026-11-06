import { describe, expect, it } from "vitest";
import { MOTION_PRESETS, withMotion } from "@/engine";
import { motionLine, pageHref } from "@/features/studio/pages";
import { encodeSpec } from "@/spec";
import { CUSTOM_TOKENS } from "../../support/motion";
import { freshSpec } from "./support";

// Cases C-STUD5-07 and C-STUD5-08 of docs/specs/05-motion-3d.md, section 5.4.

const SPEC = freshSpec();

describe("pageHref", () => {
  it.each(["studio", "explore", "motion"] as const)(
    "C-STUD5-07 links to %s with the design's link",
    (page) => {
      expect(pageHref(page, SPEC)).toBe(`/${page}#s=${encodeSpec(SPEC)}`);
    },
  );

  it("C-STUD5-07 throws RangeError for another page and TypeError for bad types", () => {
    expect(() => pageHref("about" as never, SPEC)).toThrow(RangeError);
    expect(() => pageHref("about" as never, SPEC)).toThrow(/^pageHref/);
    expect(() => pageHref("explore", null as never)).toThrow(TypeError);
    expect(() => pageHref("explore", null as never)).toThrow(/^pageHref/);
    expect(() => pageHref(5 as never, SPEC)).toThrow(TypeError);
  });
});

describe("motionLine", () => {
  it("C-STUD5-08 names the preset or says custom", () => {
    expect(motionLine(SPEC)).toBe("Motion tokens: dyelot preset.");
    expect(motionLine(withMotion(SPEC, CUSTOM_TOKENS))).toBe("Motion tokens: custom.");
    expect(motionLine(withMotion(SPEC, MOTION_PRESETS.gentle.tokens))).toBe(
      "Motion tokens: Gentle preset.",
    );
  });

  it("C-STUD5-08 throws TypeError for a non-spec, naming motionLine", () => {
    expect(() => motionLine(null as never)).toThrow(TypeError);
    expect(() => motionLine(null as never)).toThrow(/^motionLine/);
    expect(() => motionLine({ motion: null } as never)).toThrow(TypeError);
  });
});
