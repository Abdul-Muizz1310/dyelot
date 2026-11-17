import { describe, expect, it } from "vitest";
import { brandProps } from "@/export";
import { brandDescription, FLAVOR_LINES } from "@/features/flavor/video";
import { KERMES, MADDER, SPEC_OF } from "../../support/gallery";

// C-FLAV6-01 to 03 of docs/specs/06-gallery.md, section 14 (R6-35, R6-36, 5.5, 13.1, 13.2).

const bad = (value: unknown) => value as never;

function expectThrow(run: () => unknown, kind: ErrorConstructor) {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(kind);
  expect((caught as Error).message).toMatch(/^brandDescription: /);
}

describe("C-FLAV6-01 brandDescription is 13.1's sentence", () => {
  it("leaves out an empty one-liner", () => {
    const props = { ...brandProps(SPEC_OF(MADDER.slug), "light"), oneLiner: "" };
    expect(brandDescription(props)).toBe(
      "A six-second video of Madder: five rows of eleven swatches (primary, secondary, accent, neutral and danger), a sample card with a Get started button, and the line 78 of 78 required checks pass, with the lot aa8c·3b9a. It is set in Host Grotesk and Host Grotesk.",
    );
  });

  it("holds a one-liner in quotation marks, after the word with", () => {
    const props = brandProps(SPEC_OF(KERMES.slug), "light");
    expect(brandDescription(props)).toBe(
      'A six-second video of Kermes, with "A slow longform magazine set in serif on warm paper, with burgundy headings.": five rows of eleven swatches (primary, secondary, accent, neutral and danger), a sample card with a Get started button, and the line 78 of 78 required checks pass, with the lot 1b3f·a778. It is set in Schibsted Grotesk and Source Serif 4.',
    );
  });

  it("names the first family of each stack, unquoted", () => {
    const props = {
      ...brandProps(SPEC_OF(MADDER.slug), "light"),
      oneLiner: "",
      fonts: { display: '"Fraunces", serif', body: "Inter, sans-serif" },
    };
    expect(brandDescription(props)).toContain("It is set in Fraunces and Inter.");
  });
});

describe("C-FLAV6-02 brandDescription checks its argument", () => {
  const good = () => brandProps(SPEC_OF(MADDER.slug), "light");

  it("throws a TypeError for a non-object", () => {
    expectThrow(() => brandDescription(bad(null)), TypeError);
    expectThrow(() => brandDescription(bad("props")), TypeError);
  });

  it("throws a RangeError for four palettes", () => {
    const props = good();
    expectThrow(
      () => brandDescription({ ...props, palettes: props.palettes.slice(0, 4) }),
      RangeError,
    );
  });

  it("throws a TypeError for a string where a count belongs", () => {
    const props = good();
    expectThrow(
      () => brandDescription({ ...props, checks: { ...props.checks, passed: bad("78") } }),
      TypeError,
    );
  });

  it("throws a TypeError for palettes that are not an array", () => {
    expectThrow(() => brandDescription({ ...good(), palettes: bad("five") }), TypeError);
  });

  it("throws a RangeError for counts that are not whole numbers from 0", () => {
    const props = good();
    for (const passed of [-1, 1.5]) {
      expectThrow(
        () => brandDescription({ ...props, checks: { ...props.checks, passed } }),
        RangeError,
      );
    }
  });

  it("throws a RangeError for an empty font stack", () => {
    const props = good();
    expectThrow(
      () => brandDescription({ ...props, fonts: { ...props.fonts, body: "" } }),
      RangeError,
    );
  });

  it("checks types before values", () => {
    const props = good();
    expectThrow(
      () =>
        brandDescription({
          ...props,
          palettes: props.palettes.slice(0, 4),
          lot: bad(1),
        }),
      TypeError,
    );
  });
});

describe("C-FLAV6-03 FLAVOR_LINES names each Pause", () => {
  it("holds the two keys, frozen", () => {
    expect(FLAVOR_LINES["pause-background"]).toBe("Pause the background");
    expect(FLAVOR_LINES["pause-video"]).toBe("Pause the video");
    expect(FLAVOR_LINES.pause).toBe("Pause");
    expect(Object.isFrozen(FLAVOR_LINES)).toBe(true);
  });
});
