import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  bezierPoints,
  MOTION_DURATION_NAMES,
  MOTION_EASING_NAMES,
  MOTION_PRESET_IDS,
  MOTION_PRESETS,
  MOTION_SPRING_NAMES,
  motionTokens,
  normalizeMotionTokens,
} from "@/engine";
import {
  curvePath,
  durationBars,
  editTokens,
  fieldText,
  LAB_BOUNDS,
  presetLine,
  readField,
  reducedTransition,
  type TokenPath,
} from "@/features/motion/lab";
import { CUSTOM_TOKENS } from "../../support/motion";
import { freshSpec, generate, resolvedFresh } from "../studio/support";

// Cases C-LAB-01 to C-LAB-11 and C-PRE5-02 of docs/specs/05-motion-3d.md, sections 9.2 and 9.3.

const SPEC = freshSpec();
const BASE: TokenPath = { kind: "duration", name: "base" };
const X1: TokenPath = { kind: "easing", name: "standard", index: 0 };
const Y1: TokenPath = { kind: "easing", name: "standard", index: 1 };
const SPRING_DURATION: TokenPath = { kind: "spring", name: "snappy", field: "visualDuration" };
const SPRING_BOUNCE: TokenPath = { kind: "spring", name: "snappy", field: "bounce" };
const BOX = { width: 200, height: 200, pad: 20, yMin: -1, yMax: 2 };
const bad = (value: unknown) => value as never;

describe("LAB_BOUNDS", () => {
  it("C-LAB-01 equals the table of 9.3, frozen", () => {
    expect(LAB_BOUNDS).toEqual({
      duration: { min: 0, max: 500, step: 1 },
      x: { min: 0, max: 1, step: 0.01 },
      y: { min: -1, max: 2, step: 0.01 },
      visualDuration: { min: 0.05, max: 2, step: 0.01 },
      bounce: { min: 0, max: 1, step: 0.01 },
    });
    expect(Object.isFrozen(LAB_BOUNDS)).toBe(true);
    for (const bound of Object.values(LAB_BOUNDS)) expect(Object.isFrozen(bound)).toBe(true);
  });
});

describe("readField", () => {
  it.each([
    ["reads 200 for a duration", BASE, "200", 200],
    ["trims and rounds a duration", BASE, " 12.4 ", 12],
    ["rounds an x to its step", X1, "0.333", 0.33],
    ["reads U+2212 as a minus", Y1, "−0.5", -0.5],
    ["reads a spring's duration of 2", SPRING_DURATION, "2", 2],
    ["reads a spring's duration of 0.05", SPRING_DURATION, "0.05", 0.05],
    ["reads a bounce of 1", SPRING_BOUNCE, "1", 1],
    ["writes a zero without a sign", Y1, "-0", 0],
  ])("C-LAB-02 %s", (_title, path, text, value) => {
    const result = readField(path, text);
    expect(result).toEqual({ ok: true, value });
    if (result.ok) expect(Object.is(result.value, value)).toBe(true);
  });

  it.each([
    ["", BASE, "Enter a number of milliseconds from 0 to 500."],
    ["abc", BASE, "Enter a number of milliseconds from 0 to 500."],
    ["1e400", BASE, "Enter a number of milliseconds from 0 to 500."],
    ["501", BASE, "Enter a number of milliseconds from 0 to 500."],
    ["-1", BASE, "Enter a number of milliseconds from 0 to 500."],
    ["1.01", X1, "Enter a number from 0 to 1."],
    ["2.01", Y1, "Enter a number from −1 to 2."],
    ["0.04", SPRING_DURATION, "Enter a number of seconds from 0.05 to 2."],
    ["2.01", SPRING_DURATION, "Enter a number of seconds from 0.05 to 2."],
    ["1.01", SPRING_BOUNCE, "Enter a number from 0 to 1."],
  ])("C-LAB-03 rejects %j with its kind's sentence", (text, path, message) => {
    expect(readField(path, text)).toEqual({ ok: false, message });
  });

  it("C-LAB-03 never throws for any string", () => {
    const paths = [BASE, X1, Y1, SPRING_DURATION, SPRING_BOUNCE];
    fc.assert(
      fc.property(fc.constantFrom(...paths), fc.string({ unit: "binary" }), (path, text) => {
        const result = readField(path, text);
        expect(typeof result.ok).toBe("boolean");
      }),
      { numRuns: 500, seed: 5007 },
    );
  });

  it("C-LAB-03 throws RangeError for an unknown kind and TypeError for a text of 5", () => {
    expect(() => readField(bad({ kind: "x" }), "1")).toThrow(RangeError);
    expect(() => readField(bad({ kind: "x" }), "1")).toThrow(/^readField/);
    expect(() => readField(BASE, bad(5))).toThrow(TypeError);
    expect(() => readField(BASE, bad(5))).toThrow(/^readField/);
    expect(() => readField(bad(null), "1")).toThrow(TypeError);
  });
});

describe("editTokens", () => {
  it("C-LAB-04 sets a duration, keeps the rest, normalized and frozen, input unchanged", () => {
    const tokens = motionTokens();
    const edited = editTokens(tokens, BASE, 160);
    expect(edited.durations.base).toBe(160);
    expect(edited).toEqual(
      normalizeMotionTokens({ ...motionTokens(), durations: { ...tokens.durations, base: 160 } }),
    );
    expect(Object.isFrozen(edited)).toBe(true);
    expect(tokens).toEqual(motionTokens());
  });

  it("C-LAB-04 sets an easing's y1 and a spring's field", () => {
    expect(
      editTokens(motionTokens(), { kind: "easing", name: "standard", index: 1 }, 0.5).easings
        .standard,
    ).toEqual([0.2, 0.5, 0, 1]);
    expect(editTokens(motionTokens(), SPRING_BOUNCE, 0.2).springs.snappy).toEqual({
      visualDuration: 0.25,
      bounce: 0.2,
    });
    expect(editTokens(motionTokens(), SPRING_DURATION, 0.3).springs.snappy.visualDuration).toBe(
      0.3,
    );
    expect(
      editTokens(motionTokens(), { kind: "easing", name: "accelerate", index: 3 }, 1.5).easings
        .accelerate[3],
    ).toBe(1.5);
  });

  it("C-LAB-05 throws RangeError for an x1 of 1.5 and an index of 4, TypeError for null", () => {
    expect(() => editTokens(motionTokens(), X1, 1.5)).toThrow(RangeError);
    expect(() => editTokens(motionTokens(), X1, 1.5)).toThrow(/^editTokens/);
    expect(() =>
      editTokens(motionTokens(), bad({ kind: "easing", name: "standard", index: 4 }), 0.5),
    ).toThrow(RangeError);
    expect(() =>
      editTokens(motionTokens(), bad({ kind: "easing", name: "standard", index: 4 }), 0.5),
    ).toThrow(/^editTokens/);
    expect(() => editTokens(bad(null), BASE, 1)).toThrow(TypeError);
    expect(() => editTokens(bad(null), BASE, 1)).toThrow(/^editTokens/);
    expect(() => editTokens(motionTokens(), bad(null), 1)).toThrow(TypeError);
    expect(() => editTokens(motionTokens(), BASE, bad("1"))).toThrow(TypeError);
    expect(() => editTokens(motionTokens(), bad({ kind: "x" }), 1)).toThrow(RangeError);
    expect(() => editTokens(motionTokens(), bad({ kind: "duration", name: "nope" }), 1)).toThrow(
      RangeError,
    );
  });
});

describe("fieldText", () => {
  it("C-LAB-06 writes a duration whole and the rest with at most 2 decimals", () => {
    const tokens = motionTokens();
    expect(fieldText(tokens, BASE)).toBe("200");
    expect(fieldText(tokens, { kind: "easing", name: "standard", index: 0 })).toBe("0.2");
    expect(fieldText(tokens, { kind: "easing", name: "standard", index: 1 })).toBe("0");
    expect(fieldText(editTokens(tokens, SPRING_DURATION, 0.05), SPRING_DURATION)).toBe("0.05");
    expect(fieldText(editTokens(tokens, SPRING_BOUNCE, 1), SPRING_BOUNCE)).toBe("1");
  });
});

describe("curvePath", () => {
  it("C-LAB-07 maps points into the box", () => {
    expect(curvePath(bezierPoints([0, 0, 1, 1], 2), BOX)).toBe(
      "M 20.00 126.67 L 100.00 100.00 L 180.00 73.33",
    );
  });

  it("C-LAB-07 writes a tiny negative offset as zero", () => {
    expect(curvePath([[0, 2.00001]], BOX)).toBe("M 20.00 20.00");
  });
});

describe("durationBars", () => {
  it("C-LAB-08 gives exported equal to stored for a brisk design", () => {
    const bars = durationBars(SPEC);
    expect(bars.map((bar) => bar.name)).toEqual([...MOTION_DURATION_NAMES]);
    expect(bars.map((bar) => bar.stored)).toEqual([50, 100, 150, 200, 300, 400, 500]);
    expect(bars.map((bar) => bar.exported)).toEqual([50, 100, 150, 200, 300, 400, 500]);
  });

  it("C-LAB-08 stretches and caps for a calm design", () => {
    const calm = generate({ ...resolvedFresh(), motion: "calm" }, "seed-1");
    expect(durationBars(calm).map((bar) => bar.exported)).toEqual([
      63, 125, 188, 250, 375, 500, 500,
    ]);
  });
});

describe("presetLine", () => {
  it("C-LAB-09 names the matching preset or says the tokens are custom", () => {
    expect(presetLine(motionTokens())).toBe(
      "These tokens match the dyelot preset. dyelot's default: 50 to 500 ms, standard curves and three springs.",
    );
    expect(presetLine(CUSTOM_TOKENS)).toBe("Custom tokens: no preset matches.");
  });
});

describe("reducedTransition", () => {
  it("C-LAB-10 is the fast duration in seconds with a linear ease", () => {
    expect(reducedTransition(SPEC)).toEqual({ duration: 0.1, ease: "linear" });
  });
});

describe("the lab's helpers reject bad input", () => {
  it("C-LAB-11 curvePath throws RangeError for a bad box or point, TypeError for null points", () => {
    expect(() => curvePath([[0, 0]], { ...BOX, yMin: 2, yMax: 2 })).toThrow(RangeError);
    expect(() => curvePath([[0, 0]], { ...BOX, yMin: 2, yMax: 2 })).toThrow(/^curvePath/);
    expect(() => curvePath([[0, Number.NaN]], BOX)).toThrow(RangeError);
    expect(() => curvePath([[0, Number.NaN]], BOX)).toThrow(/^curvePath/);
    expect(() => curvePath([[0, 0, 1] as never], BOX)).toThrow(RangeError);
    expect(() => curvePath([], BOX)).toThrow(RangeError);
    expect(() => curvePath([[0, 0]], { ...BOX, width: Number.NaN })).toThrow(RangeError);
    expect(() => curvePath(bad(null), BOX)).toThrow(TypeError);
    expect(() => curvePath(bad(null), BOX)).toThrow(/^curvePath/);
    expect(() => curvePath([[0, 0]], bad(null))).toThrow(TypeError);
    expect(() => curvePath([bad(null)], BOX)).toThrow(TypeError);
    expect(() => curvePath([[0, bad("1")]], BOX)).toThrow(TypeError);
    expect(() => curvePath([[0, 0]], { ...BOX, pad: bad("1") })).toThrow(TypeError);
  });

  it("C-LAB-11 the others throw TypeError for null and RangeError out of domain, naming themselves", () => {
    expect(() => fieldText(bad(null), BASE)).toThrow(/^fieldText/);
    expect(() => fieldText(bad(null), BASE)).toThrow(TypeError);
    expect(() => fieldText(motionTokens(), bad(null))).toThrow(TypeError);
    expect(() => durationBars(bad(null))).toThrow(TypeError);
    expect(() => durationBars(bad(null))).toThrow(/^durationBars/);
    expect(() => presetLine(bad(null))).toThrow(TypeError);
    expect(() => presetLine(bad(null))).toThrow(/^presetLine/);
    expect(() => reducedTransition(bad(null))).toThrow(TypeError);
    expect(() => reducedTransition(bad(null))).toThrow(/^reducedTransition/);
    expect(() => reducedTransition(bad({ motion: null }))).toThrow(TypeError);
    expect(() => fieldText(motionTokens(), bad({ kind: "x" }))).toThrow(RangeError);
    expect(() => fieldText(motionTokens(), bad({ kind: "x" }))).toThrow(/^fieldText/);
    const tokens = motionTokens();
    const wild = {
      ...tokens,
      springs: { ...tokens.springs, snappy: { visualDuration: 0.25, bounce: 2 } },
    };
    expect(() => presetLine(wild)).toThrow(RangeError);
    expect(() => presetLine(wild)).toThrow(/^presetLine/);
  });
});

describe("the presets", () => {
  it("C-PRE5-02 keeps dyelot at the engine's tokens and every preset inside the lab's bounds", () => {
    expect(MOTION_PRESETS.dyelot.tokens).toEqual(motionTokens());
    for (const id of MOTION_PRESET_IDS) {
      const { tokens } = MOTION_PRESETS[id];
      expect(normalizeMotionTokens(tokens)).toEqual(tokens);
      for (const name of MOTION_DURATION_NAMES) {
        expect(readField({ kind: "duration", name }, String(tokens.durations[name]))).toEqual({
          ok: true,
          value: tokens.durations[name],
        });
      }
      for (const name of MOTION_EASING_NAMES) {
        for (const index of [0, 1, 2, 3] as const) {
          const value = tokens.easings[name][index];
          expect(readField({ kind: "easing", name, index }, String(value))).toEqual({
            ok: true,
            value,
          });
        }
      }
      for (const name of MOTION_SPRING_NAMES) {
        for (const field of ["visualDuration", "bounce"] as const) {
          const value = tokens.springs[name][field];
          expect(readField({ kind: "spring", name, field }, String(value))).toEqual({
            ok: true,
            value,
          });
        }
      }
    }
  });
});
