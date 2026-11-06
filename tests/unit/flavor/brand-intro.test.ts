import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_INTRO, BRAND_TIMELINE, springAt } from "../../../src/flavor/remotion/brand-intro";

// C-BRAND-01 to 04 of docs/specs/05-motion-3d.md, section 14 (ruling R5-22, R5-55, R-05).

const SOURCE = path.resolve(import.meta.dirname, "../../../src/flavor/remotion/brand-intro.tsx");
const SAMPLES = { settleMs: 400, samples: [0, 0.5, 1] };

describe("the brand video's constants", () => {
  it("C-BRAND-01 holds the composition's size, rate and length, and its timeline", () => {
    expect(BRAND_INTRO).toEqual({ width: 1280, height: 720, fps: 30, durationInFrames: 180 });
    expect(BRAND_TIMELINE).toEqual({
      name: 0,
      oneLiner: 6,
      palettes: 30,
      rowGap: 12,
      stepGap: 2,
      specimen: 96,
      receipt: 132,
    });
  });
});

describe("springAt", () => {
  it("C-BRAND-02 reads the samples evenly over the settle time", () => {
    expect(springAt(SAMPLES, -1, 30)).toBe(0);
    expect(springAt(SAMPLES, 3, 30)).toBeCloseTo(0.25, 12);
    expect(springAt(SAMPLES, 6, 30)).toBeCloseTo(0.5, 12);
    expect(springAt(SAMPLES, 12, 30)).toBe(1);
    expect(springAt(SAMPLES, 100, 30)).toBe(1);
  });

  it("C-BRAND-03 throws RangeError for a frame that is not finite", () => {
    for (const frame of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => springAt(SAMPLES, frame, 30)).toThrow(RangeError);
      expect(() => springAt(SAMPLES, frame, 30)).toThrow(/^springAt/);
    }
  });

  it("C-BRAND-03 throws TypeError for one sample, a null curve or a wrong frame type", () => {
    const bad: unknown[] = [
      { settleMs: 400, samples: [1] },
      null,
      { settleMs: 400, samples: "ab" },
    ];
    for (const curve of bad) {
      expect(() => springAt(curve as never, 3, 30)).toThrow(TypeError);
      expect(() => springAt(curve as never, 3, 30)).toThrow(/^springAt/);
    }
    expect(() => springAt(SAMPLES, "3" as never, 30)).toThrow(TypeError);
    expect(() => springAt(SAMPLES, "3" as never, 30)).toThrow(/^springAt/);
  });
});

describe("the composition's source", () => {
  it("C-BRAND-04 opens with R5-22's four comment lines and links the license", () => {
    const text = readFileSync(SOURCE, "utf8");
    expect(text.split("\n").slice(0, 4)).toEqual([
      "// Built with Remotion (https://www.remotion.dev).",
      "// Remotion is not open source: read its license at https://remotion.pro/license before you use this file.",
      "// Companies of four or more people need a Remotion Company License.",
      "// This composition was exported by dyelot (MIT); the Remotion package it imports is under Remotion's license.",
    ]);
    expect(text).toContain("https://remotion.pro/license");
  });
});
