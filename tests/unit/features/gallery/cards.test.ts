import { statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as AI from "@/ai";
import { galleryData } from "@/features/gallery/build";
import { cardOf, GALLERY_CARDS, galleryCards } from "@/features/gallery/cards";
import type { GalleryData } from "@/features/gallery/data";
import { PROPERTY_TIMEOUT } from "../../spec/support";
import { GALLERY_DATA } from "../../support/gallery";

// C-CARD6-01 to C-CARD6-03 of docs/specs/06-gallery.md, section 14.1 (R6-04, R6-09).
// `DYELOT_UPDATE_GALLERY=1` rewrites src/features/gallery/cards.json, as R3-11 writes JSON; it fails
// together with `CI`.

const FILE = path.join(process.cwd(), "src/features/gallery/cards.json");

if (process.env.DYELOT_UPDATE_GALLERY === "1") {
  describe("the committed share-card data", () => {
    it(
      "C-CARD6-02 rewrites cards.json, and never in CI",
      () => {
        expect(process.env.CI, "DYELOT_UPDATE_GALLERY must not run in CI").toBeUndefined();
        writeFileSync(FILE, `${JSON.stringify(galleryCards(galleryData(AI)), null, 2)}\n`);
      },
      PROPERTY_TIMEOUT,
    );
  });
}

describe("galleryCards (R6-09)", () => {
  it("C-CARD6-01 projects each entry to its slug, name, line, strip and counts", () => {
    const { cards } = galleryCards(GALLERY_DATA);
    expect(cards).toHaveLength(24);
    cards.forEach((card, i) => {
      const entry = GALLERY_DATA.entries[i];
      if (entry === undefined) throw new Error("no entry");
      expect(Object.keys(card)).toEqual(["slug", "name", "line", "strip", "passed", "required"]);
      expect(card.slug).toBe(entry.slug);
      expect(card.name).toBe(entry.name);
      expect(card.line).toBe(entry.line);
      expect(card.strip).toEqual(entry.specimen.map((row) => row.hexes[2]));
      expect(card.strip).toHaveLength(5);
      expect(card.passed).toBe(entry.summary.contrast.requiredPass);
      expect(card.required).toBe(entry.summary.contrast.required);
    });
  });

  it("C-CARD6-02 GALLERY_CARDS, the committed JSON, deep-equals galleryCards(GALLERY)", () => {
    expect(GALLERY_CARDS).toEqual(galleryCards(GALLERY_DATA));
  });

  it("C-CARD6-02 keeps cards.json under 16 KB", () => {
    expect(statSync(FILE).size).toBeLessThan(16 * 1024);
  });

  it("C-CARD6-03 refuses data that is not an object", () => {
    expect(() => galleryCards(null as never)).toThrow(TypeError);
    expect(() => galleryCards(null as never)).toThrow(/^galleryCards/);
  });

  it("C-CARD6-03 refuses an entry whose specimen lacks danger, naming the slug", () => {
    const first = GALLERY_DATA.entries[0];
    if (first === undefined) throw new Error("no entry");
    const bad: GalleryData = {
      entries: [{ ...first, specimen: first.specimen.filter((row) => row.palette !== "danger") }],
    };
    expect(() => galleryCards(bad)).toThrow(RangeError);
    expect(() => galleryCards(bad)).toThrow(new RegExp(`^galleryCards.*${first.slug}`));
  });

  it("C-CARD6-03 cardOf takes a string and gives null for an unknown slug", () => {
    expect(() => cardOf(1 as never)).toThrow(TypeError);
    expect(() => cardOf(1 as never)).toThrow(/^cardOf/);
    expect(cardOf("nope")).toBeNull();
    expect(cardOf("madder")?.slug).toBe("madder");
  });
});
