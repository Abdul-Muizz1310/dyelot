import { describe, expect, it } from "vitest";
import { type BrandProps, brandProps } from "@/export";
import { brandDescription, FLAVOR_LINES } from "@/features/flavor/video";
import { KERMES, MADDER, SPEC_OF } from "../../support/gallery";

// C-FLAV6-01 to 03 of docs/specs/06-gallery.md, section 14 (R6-35, R6-36, 5.5, 13.1, 13.2).

const bad = (value: unknown) => value as never;

/** The first family of a font stack, unquoted. */
const first = (stack: string): string =>
  (stack.split(",")[0] as string).trim().replace(/^["']|["']$/g, "");

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

const sentence = (props: BrandProps, lead: string): string =>
  `A six-second video of ${lead}: five rows of eleven swatches (primary, secondary, accent, neutral and danger), a sample card with a Get started button, and the line ${props.checks.passed} of ${props.checks.required} required checks pass, with the lot ${props.lot}. It is set in ${first(props.fonts.display)} and ${first(props.fonts.body)}.`;

describe("C-FLAV6-01 brandDescription is 13.1's sentence", () => {
  it("leaves out an empty one-liner", () => {
    const props = { ...brandProps(SPEC_OF(MADDER.slug), "light"), oneLiner: "" };
    expect(brandDescription(props)).toBe(sentence(props, props.name));
  });

  it("holds a one-liner in quotation marks", () => {
    const props = brandProps(SPEC_OF(KERMES.slug), "light");
    expect(props.oneLiner).not.toBe("");
    expect(brandDescription(props)).toBe(sentence(props, `${props.name}, "${props.oneLiner}"`));
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
