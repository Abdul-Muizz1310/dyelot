import { describe, expect, it } from "vitest";
import { lotTag } from "@/features/studio/lot";

// Cases are C-STORE-32 and C-STORE-33 of docs/specs/02-studio.md, section 6.7.

describe("lotTag", () => {
  it("C-STORE-32 shows the first eight hex digits as two groups around a middle dot", () => {
    expect(lotTag("0123456789abcdef")).toBe("0123·4567");
    expect(lotTag("0123456789abcdef").codePointAt(4)).toBe(0xb7);
    expect(lotTag("ffffffff00000000")).toBe("ffff·ffff");
  });

  it.each([
    ["too short", "0123456789abcde"],
    ["too long", "0123456789abcdef0"],
    ["uppercase", "0123456789ABCDEF"],
    ["not hex", "0123456789abcdeg"],
    ["empty", ""],
    ["padded", " 0123456789abcdef"],
  ])("C-STORE-33 throws RangeError naming lotTag for an id that is %s", (_, id) => {
    expect(() => lotTag(id)).toThrow(RangeError);
    expect(() => lotTag(id)).toThrow(/^lotTag: /);
  });

  it("names the type it got, an array included", () => {
    expect(() => lotTag([] as never)).toThrow("lotTag: id must be a string, got array");
    expect(() => lotTag(null as never)).toThrow("lotTag: id must be a string, got null");
  });

  it.each([[undefined], [null], [123], [{}]])(
    "C-STORE-33 throws TypeError naming lotTag for a non-string id (%s)",
    (id) => {
      expect(() => lotTag(id as unknown as string)).toThrow(TypeError);
      expect(() => lotTag(id as unknown as string)).toThrow(/^lotTag: /);
    },
  );
});
