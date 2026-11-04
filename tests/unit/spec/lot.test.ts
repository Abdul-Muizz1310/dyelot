import { describe, expect, it } from "vitest";
import { lotTag as studioLotTag } from "@/features/studio/lot";
import * as spec from "@/spec";
import { lotTag } from "@/spec/lot";

// Case C-SPEC3-10 of docs/specs/03-export.md, section 10.1 (R3-03).

describe("lotTag of the spec", () => {
  it("C-SPEC3-10 is the object the studio re-exports and gives two groups of four digits", () => {
    expect(spec.lotTag).toBe(lotTag);
    expect(studioLotTag).toBe(lotTag);
    expect(lotTag("0123456789abcdef")).toBe("0123·4567");
  });

  it("C-SPEC3-10 throws TypeError and RangeError naming lotTag", () => {
    expect(() => lotTag(5 as never)).toThrow(TypeError);
    expect(() => lotTag(5 as never)).toThrow(/^lotTag: /);
    for (const id of ["0123", "0123456789ABCDEF"]) {
      expect(() => lotTag(id)).toThrow(RangeError);
      expect(() => lotTag(id)).toThrow(/^lotTag: /);
    }
  });
});
