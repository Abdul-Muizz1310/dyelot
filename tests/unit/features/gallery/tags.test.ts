import { describe, expect, it } from "vitest";
import { GALLERY_TAGS, readTag } from "@/features/gallery/tags";

// C-TAG6-01 and C-TAG6-02 of docs/specs/06-gallery.md, section 14.1 (R6-07).

describe("GALLERY_TAGS and readTag (R6-07)", () => {
  it("C-TAG6-01 is the six moods in order, frozen", () => {
    expect([...GALLERY_TAGS]).toEqual([
      "calm",
      "bold",
      "editorial",
      "technical",
      "playful",
      "natural",
    ]);
    expect(Object.isFrozen(GALLERY_TAGS)).toBe(true);
  });

  it("C-TAG6-01 reads undefined as all and each tag as itself", () => {
    expect(readTag(undefined)).toBe("all");
    for (const tag of GALLERY_TAGS) expect(readTag(tag)).toBe(tag);
  });

  it("C-TAG6-02 reads anything else as unknown", () => {
    for (const value of ["", "CALM", "calm ", "loud"]) expect(readTag(value)).toBe("unknown");
    expect(readTag(["calm", "bold"])).toBe("unknown");
  });

  it("C-TAG6-02 throws a TypeError naming readTag for a number and null", () => {
    for (const value of [5, null]) {
      expect(() => readTag(value as never)).toThrow(TypeError);
      expect(() => readTag(value as never)).toThrow(/^readTag/);
    }
  });
});
