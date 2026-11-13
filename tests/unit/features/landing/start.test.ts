import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { normalizeSeed, parseColor } from "@/engine";
import {
  briefHref,
  briefReady,
  colorHref,
  GALLERY_HREF,
  IMAGE_HREF,
  START_BRIEF_MAX,
  START_LINES,
} from "@/features/landing/start";
import { readEntry } from "@/features/studio/url";
import { toPlainText } from "@/spec/text";

// C-START6-01 to C-START6-03 of docs/specs/06-gallery.md, section 14 (R6-27, R6-28, 5.2, 9.1).

describe("start", () => {
  it("C-START6-01 builds the entry links and holds the section's words", () => {
    expect(colorHref("#f66c6d")).toBe("/studio#color=f66c6d");
    expect(colorHref("F66C6D")).toBe("/studio#color=f66c6d");
    expect(briefHref("A tea house at dusk")).toBe("/studio#brief=A%20tea%20house%20at%20dusk");
    expect(briefHref("  café + bar  ")).toBe("/studio#brief=caf%C3%A9%20%2B%20bar");
    for (const ok of ["A tea house at dusk", "  café + bar  "]) expect(briefReady(ok)).toBe(true);
    for (const no of ["", "   ", "1234"]) expect(briefReady(no)).toBe(false);
    expect(START_BRIEF_MAX).toBe(500);
    expect(IMAGE_HREF).toBe("/studio#start=image");
    expect(GALLERY_HREF).toBe("/gallery");
    expect(START_LINES).toEqual({
      heading: "Start a design from",
      color: "a color",
      colorLabel: "Seed color",
      colorSubmit: "Open the studio with this color",
      brief: "a brief",
      briefLabel: "Describe the product or mood",
      briefPlaceholder: "A tea house at dusk, calm and exact",
      briefNote:
        "The studio puts it in its Brief box. Nothing reads it until you press Read the brief there.",
      briefSubmit: "Take this brief to the studio",
      briefEmpty: "Write a few words first.",
      image: "an image",
      imageNote:
        "The studio finds an image's colors in this browser. Nothing leaves your device until you ask a model to read it.",
      imageLink: "Open the studio's image drop",
      gallery: "the gallery",
      galleryNote: "Original design systems made by dyelot, each with its receipt.",
      galleryLink: "Browse the gallery",
    });
    expect(Object.isFrozen(START_LINES)).toBe(true);
  });

  it("C-START6-02 refuses what it cannot link, naming the function", () => {
    for (const bad of ["#f66c6", "red", "#f66c6dff"]) {
      expect(() => colorHref(bad)).toThrow(RangeError);
      expect(() => colorHref(bad)).toThrow(/^colorHref/);
    }
    expect(() => colorHref(5 as unknown as string)).toThrow(TypeError);
    expect(() => colorHref(5 as unknown as string)).toThrow(/^colorHref/);
    for (const bad of ["", "   ", "1234", "a".repeat(501), "tea \uD800"]) {
      expect(() => briefHref(bad)).toThrow(RangeError);
      expect(() => briefHref(bad)).toThrow(/^briefHref/);
    }
    expect(() => briefHref(null as unknown as string)).toThrow(TypeError);
    expect(() => briefHref(null as unknown as string)).toThrow(/^briefHref/);
    expect(() => briefReady(3 as unknown as string)).toThrow(TypeError);
    expect(() => briefReady(3 as unknown as string)).toThrow(/^briefReady/);
    expect(briefReady("a".repeat(500))).toBe(true);
    expect(briefReady("a".repeat(501))).toBe(false);
    expect(briefReady("tea \uD800")).toBe(false);
  });

  it("C-START6-03 the studio reads back what the links build", () => {
    fc.assert(
      fc.property(
        fc
          .string({ unit: "grapheme", minLength: 1, maxLength: 120 })
          .filter((t) => t === t.normalize("NFC") && briefReady(t)),
        (text) => {
          const read = readEntry(briefHref(text).slice("/studio".length));
          const plain = toPlainText(text, 500);
          expect(plain).not.toBeNull();
          expect(read).toEqual({ kind: "entry", entry: { kind: "brief", text: plain?.text } });
        },
      ),
      { numRuns: 300, seed: 6006 },
    );
    fc.assert(
      fc.property(fc.stringMatching(/^[0-9a-fA-F]{6}$/), (hex) => {
        expect(readEntry(colorHref(hex).slice("/studio".length))).toEqual({
          kind: "entry",
          entry: { kind: "color", seed: normalizeSeed(parseColor(`#${hex.toLowerCase()}`)) },
        });
      }),
      { numRuns: 300, seed: 6006 },
    );
  });
});
