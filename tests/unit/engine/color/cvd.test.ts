import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { toHex } from "@/engine/color/convert";
import { DEFICIENCIES, type Deficiency, simulate } from "@/engine/color/cvd";
import type { Rgb } from "@/engine/color/types";
import {
  anyRgb,
  BAD_CHANNELS,
  edgeRgb,
  expectHexClose,
  expectRgbClose,
  rgbOfHex,
  withChannel,
} from "./support";

// Cases are the C-CVD-nn rows of docs/specs/01-color-engine.md, section 6.2.

const WHITE = rgbOfHex("#ffffff");
const BLACK = rgbOfHex("#000000");

/** `[deficiency, hex, [r, g, b]]`, computed with `sim` in cvd.py (Viénot for protan and deutan, Brettel for tritan). */
const CVD_GOLDEN: ReadonlyArray<readonly [Deficiency, string, Rgb]> = [
  ["protan", "#ff0000", [0.3693324268790931, 0.3693324268790931, 0.05081874703593612]],
  ["protan", "#00ff00", [0.94887678081665, 0.94887678081665, 0.0]],
  ["protan", "#0000ff", [0.0, 0.0, 0.9999999999999999]],
  ["protan", "#ffff00", [0.9999999999999999, 0.9999999999999999, 0.0]],
  ["protan", "#00ffff", [0.94887678081665, 0.94887678081665, 0.9982352048000748]],
  ["protan", "#ff00ff", [0.3693324268790931, 0.3693324268790931, 0.9999999999999999]],
  ["protan", "#f66c6d", [0.5237384994400545, 0.5237384994400545, 0.431494558590718]],
  ["protan", "#4775ca", [0.4429438725307223, 0.4429438725307223, 0.7918814862511483]],
  ["protan", "#e69f00", [0.6626789782110905, 0.6626789782110905, 0.023034053453772303]],
  ["protan", "#56b4e9", [0.6767411501006185, 0.6767411501006185, 0.9130033653350363]],
  ["protan", "#009e73", [0.586917677613546, 0.586917677613546, 0.4492903971422188]],
  ["protan", "#808080", [0.5019607843137255, 0.5019607843137255, 0.5019607843137255]],
  ["protan", "#123456", [0.19364941572229408, 0.19364941572229408, 0.3370555843414025]],
  ["protan", "#010203", [0.0074024313725490195, 0.0074024313725490195, 0.011748980392156863]],
  ["deutan", "#ff0000", [0.5773528829159701, 0.5773528829159701, 0.0]],
  ["deutan", "#00ff00", [0.858218129563017, 0.858218129563017, 0.1614564076923448]],
  ["deutan", "#0000ff", [0.0, 0.0, 0.9999999999999999]],
  ["deutan", "#ffff00", [0.9999999999999999, 0.9999999999999999, 0.0]],
  ["deutan", "#00ffff", [0.858218129563017, 0.858218129563017, 0.9999999999999999]],
  ["deutan", "#ff00ff", [0.5773528829159701, 0.5773528829159701, 0.9901149554403476]],
  ["deutan", "#f66c6d", [0.646739989017149, 0.646739989017149, 0.4039987965397755]],
  ["deutan", "#4775ca", [0.41586216215733945, 0.41586216215733945, 0.7936887166141134]],
  ["deutan", "#e69f00", [0.7199046272892943, 0.7199046272892943, 0.0]],
  ["deutan", "#56b4e9", [0.6262418815227108, 0.6262418815227108, 0.9177347792468546]],
  ["deutan", "#009e73", [0.5289470262543556, 0.5289470262543556, 0.4602542018559455]],
  ["deutan", "#808080", [0.5019607843137255, 0.5019607843137255, 0.5019607843137255]],
  ["deutan", "#123456", [0.1757944176256611, 0.1757944176256611, 0.338362728920822]],
  ["deutan", "#010203", [0.006695098039215686, 0.006695098039215686, 0.011852313725490195]],
  ["tritan", "#ff0000", [0.9999999999999999, 0.0, 0.3052986957176174]],
  ["tritan", "#00ff00", [0.4728773308242827, 0.9139302520470625, 0.9999999999999999]],
  ["tritan", "#0000ff", [0.0, 0.38590015810462663, 0.5350807827928689]],
  ["tritan", "#ffff00", [0.9999999999999999, 0.9336691509204814, 0.9456982943899676]],
  ["tritan", "#00ffff", [0.27889390990188767, 0.97244605502355, 0.9999999999999999]],
  ["tritan", "#ff00ff", [0.9379025707636522, 0.39858674063671085, 0.4788675791397135]],
  ["tritan", "#f66c6d", [0.9690323935201065, 0.41112156964392793, 0.4943748795837935]],
  ["tritan", "#4775ca", [0.14297827321571488, 0.5081551340131638, 0.6041239448684789]],
  ["tritan", "#e69f00", [0.930138401985208, 0.575905939378874, 0.6173284876592597]],
  ["tritan", "#56b4e9", [0.2947428793824408, 0.7208184070688951, 0.8443658443349435]],
  ["tritan", "#009e73", [0.22988736130518905, 0.5837167500712999, 0.6858324371504483]],
  ["tritan", "#808080", [0.5019584636370222, 0.5019607843137255, 0.5019607843137255]],
  ["tritan", "#123456", [0.005236538091796332, 0.22043574053438159, 0.27062372491460107]],
  ["tritan", "#010203", [0.0036731372549019614, 0.008084941176470588, 0.010288627450980393]],
];

/** The sRGB gray of channel value `value`. */
const gray = (value: number): Rgb => [value, value, value];

describe("simulate", () => {
  it("C-CVD-01 turns #ff0000 into #939300 for deutan", () => {
    expectHexClose(toHex(simulate(rgbOfHex("#ff0000"), "deutan")), "#939300");
  });

  it("C-CVD-02 turns #00ff00 into #dbdb29 for deutan", () => {
    expectHexClose(toHex(simulate(rgbOfHex("#00ff00"), "deutan")), "#dbdb29");
  });

  it("C-CVD-03 turns #ff0000 into #5e5e0d for protan", () => {
    expectHexClose(toHex(simulate(rgbOfHex("#ff0000"), "protan")), "#5e5e0d");
  });

  it("C-CVD-04 turns #0000ff into #006288 for tritan", () => {
    expectHexClose(toHex(simulate(rgbOfHex("#0000ff"), "tritan")), "#006288");
  });

  it("C-CVD-05 turns #ffff00 into #ffeef1 for tritan", () => {
    expectHexClose(toHex(simulate(rgbOfHex("#ffff00"), "tritan")), "#ffeef1");
  });

  it("C-CVD-06 keeps any gray the same gray under all three deficiencies", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.constantFrom(...DEFICIENCIES),
        (value, deficiency) => {
          expectRgbClose(simulate(gray(value), deficiency), gray(value), 1 / 255);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("C-CVD-07 gives finite channels in [0, 1] for any color", () => {
    fc.assert(
      fc.property(
        fc.oneof(anyRgb, edgeRgb),
        fc.constantFrom(...DEFICIENCIES),
        (color, deficiency) => {
          for (const channel of simulate(color, deficiency)) {
            expect(Number.isFinite(channel)).toBe(true);
            expect(channel).toBeGreaterThanOrEqual(0);
            expect(channel).toBeLessThanOrEqual(1);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("C-CVD-08 keeps white white and black black under all three deficiencies", () => {
    for (const deficiency of DEFICIENCIES) {
      expectRgbClose(simulate(WHITE, deficiency), WHITE, 1 / 255);
      expectRgbClose(simulate(BLACK, deficiency), BLACK, 1 / 255);
    }
  });

  it("C-CVD-09 returns a new tuple, leaves its input alone and repeats itself", () => {
    for (const deficiency of DEFICIENCIES) {
      const input = Object.freeze([0.9, 0.2, 0.4]) as unknown as Rgb;
      const first = simulate(input, deficiency);
      const second = simulate(input, deficiency);
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(first).not.toBe(input);
      expect(input).toEqual([0.9, 0.2, 0.4]);
    }
  });

  it("C-CVD-10 throws a RangeError for a channel outside the tolerance or not finite", () => {
    for (const deficiency of DEFICIENCIES) {
      for (const bad of BAD_CHANNELS) {
        for (const index of [0, 1, 2] as const) {
          expect(() => simulate(withChannel(WHITE, index, bad), deficiency)).toThrow(RangeError);
        }
      }
    }
  });

  it("C-CVD-10 throws a RangeError for an unknown deficiency", () => {
    for (const name of ["", "achroma", "Protan", "protanopia", "none"]) {
      expect(() => simulate(WHITE, name as Deficiency)).toThrow(RangeError);
    }
    expect(() => simulate(WHITE, "monochromacy" as Deficiency)).toThrow(/simulate: deficiency/);
  });

  it("throws a TypeError for a value that is not three channels or not a deficiency name", () => {
    expect(() => simulate(null as unknown as Rgb, "protan")).toThrow(TypeError);
    expect(() => simulate([1, 0] as unknown as Rgb, "deutan")).toThrow(TypeError);
    expect(() => simulate(WHITE, undefined as unknown as Deficiency)).toThrow(TypeError);
    expect(() => simulate(WHITE, 1 as unknown as Deficiency)).toThrow(TypeError);
  });

  it("names the argument that is out of range", () => {
    expect(() => simulate([0, 2, 0], "tritan")).toThrow(/simulate: rgb/);
  });

  it("accepts a channel exactly 1e-6 outside 0 to 1 and reads it as the edge", () => {
    for (const deficiency of DEFICIENCIES) {
      expect(simulate([-1e-6, 1 + 1e-6, 0.5], deficiency)).toEqual(
        simulate([0, 1, 0.5], deficiency),
      );
    }
  });

  it("matches the reference implementation in cvd.py to 1e-9, on both sides of the tritan plane", () => {
    // #0000ff and #ffff00 (C-CVD-04, C-CVD-05) sit on opposite sides, so the table needs both Brettel
    // matrices: a swapped half-plane test moves a channel by far more than 1e-9.
    for (const [deficiency, hex, expected] of CVD_GOLDEN) {
      expectRgbClose(simulate(rgbOfHex(hex), deficiency), expected, 1e-9);
    }
  });

  it("lists the three deficiencies the engine simulates, in a fixed order", () => {
    expect(DEFICIENCIES).toEqual(["protan", "deutan", "tritan"]);
  });

  it("collapses the red-green axis for protan and deutan: red and green come out equal", () => {
    // Rows 1 and 2 of both Viénot matrices are the same, so the two channels cannot differ.
    fc.assert(
      fc.property(
        fc.oneof(anyRgb, edgeRgb),
        fc.constantFrom<Deficiency>("protan", "deutan"),
        (color, deficiency) => {
          const [r, g] = simulate(color, deficiency);
          expect(r).toBe(g);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("projects once for protan and deutan: a second pass changes nothing", () => {
    // The simulated color already lies on the plane that the deficiency sees. The tolerance is
    // 1e-6, not 1e-9: the two halves of the sRGB curve are not exact inverses at their join,
    // where decoding an encoded value is off by up to 3e-8.
    fc.assert(
      fc.property(anyRgb, fc.constantFrom<Deficiency>("protan", "deutan"), (color, deficiency) => {
        const once = simulate(color, deficiency);
        expectRgbClose(simulate(once, deficiency), once, 1e-6);
      }),
      { numRuns: 500 },
    );
  });
});
