import { describe, expect, it } from "vitest";
import { absoluteStudioLink, entryHref, openHref } from "@/features/gallery/links";
import { GALLERY_DATA } from "../../support/gallery";

// C-GAL6-15 and C-GAL6-16 of docs/specs/06-gallery.md, section 14.1 (R6-14 to R6-16).

const LINKS = ["abc_DEF-123", ...GALLERY_DATA.entries.map((entry) => entry.link)];
const ORIGIN = "https://dyelot.vercel.app";

describe("the gallery's links", () => {
  it("C-GAL6-15 writes each page's href, the open route and the absolute studio link", () => {
    for (const link of LINKS) {
      expect(entryHref("studio", link)).toBe(`/studio#s=${link}`);
      expect(entryHref("explore", link)).toBe(`/explore#s=${link}`);
      expect(entryHref("motion", link)).toBe(`/motion#s=${link}`);
      expect(absoluteStudioLink(ORIGIN, link)).toBe(`${ORIGIN}/studio#s=${link}`);
    }
    expect(openHref("kermes", "motion")).toBe("/gallery/kermes/open/motion");
    expect(openHref("terre-verte", "studio")).toBe("/gallery/terre-verte/open/studio");
  });

  it("C-GAL6-15 reads every committed entry's link", () => {
    expect(GALLERY_DATA.entries).toHaveLength(24);
  });

  it("C-GAL6-16 entryHref refuses a page and a link out of domain", () => {
    const L = "abc";
    for (const call of [
      () => entryHref("gallery" as never, L),
      () => entryHref("studio", ""),
      () => entryHref("studio", "a b"),
      () => entryHref("studio", "x".repeat(65_537)),
    ]) {
      expect(call).toThrow(RangeError);
      expect(call).toThrow(/^entryHref/);
    }
    expect(entryHref("studio", "x".repeat(65_536))).toHaveLength(`/studio#s=`.length + 65_536);
    for (const call of [() => entryHref(3 as never, L), () => entryHref("studio", 3 as never)]) {
      expect(call).toThrow(TypeError);
      expect(call).toThrow(/^entryHref/);
    }
  });

  it("C-GAL6-16 absoluteStudioLink refuses an origin that is not https and bare", () => {
    for (const origin of ["http://a.test", "https://a.test/x"]) {
      expect(() => absoluteStudioLink(origin, "abc")).toThrow(RangeError);
      expect(() => absoluteStudioLink(origin, "abc")).toThrow(/^absoluteStudioLink/);
    }
    expect(() => absoluteStudioLink(null as never, "abc")).toThrow(TypeError);
    expect(() => absoluteStudioLink(null as never, "abc")).toThrow(/^absoluteStudioLink/);
    expect(() => absoluteStudioLink(ORIGIN, "")).toThrow(/^absoluteStudioLink/);
  });

  it("C-GAL6-16 openHref refuses a slug and a page out of domain", () => {
    for (const call of [
      () => openHref("Bad Slug", "studio"),
      () => openHref("kermes", "lab" as never),
    ]) {
      expect(call).toThrow(RangeError);
      expect(call).toThrow(/^openHref/);
    }
    expect(() => openHref(1 as never, "studio")).toThrow(TypeError);
    expect(() => openHref(1 as never, "studio")).toThrow(/^openHref/);
    expect(() => openHref("kermes", 1 as never)).toThrow(TypeError);
  });

  it("C-GAL6-16 checks every argument's type before any domain", () => {
    expect(() => entryHref("bad" as never, 3 as never)).toThrow(TypeError);
    expect(() => openHref("Bad Slug", 1 as never)).toThrow(TypeError);
    expect(() => absoluteStudioLink("http://a.test", 3 as never)).toThrow(TypeError);
    expect(() => absoluteStudioLink("http://a.test", "")).toThrow(RangeError);
  });
});
