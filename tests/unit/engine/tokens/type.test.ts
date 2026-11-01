import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type TypeStep, typeScale } from "@/engine/tokens/type";

// Cases are the C-TYPE-nn rows of docs/specs/01-color-engine.md, section 6.6.

type Context = "dense" | "product" | "marketing" | "editorial" | "poster";
const CONTEXTS: readonly Context[] = ["dense", "product", "marketing", "editorial", "poster"];
const RATIOS = [1.067, 1.2, 1.5, 2] as const;
const NAMES = ["caption", "label", "body-sm", "body", "lead", "h4", "h3", "h2", "h1", "display"];

function step(steps: readonly TypeStep[], name: TypeStep["name"]): TypeStep {
  const found = steps.find((item) => item.name === name);
  if (!found) throw new Error(`no step ${name}`);
  return found;
}

/** The 50 cells of the line-height table in section 6.6, in step order. */
const LINE_HEIGHTS: Readonly<Record<string, readonly number[]>> = {
  dense: [12, 16, 16, 20, 24, 24, 28, 32, 36, 40],
  product: [16, 16, 20, 24, 32, 28, 32, 40, 48, 52],
  poster: [12, 16, 16, 28, 40, 36, 52, 76, 108, 152],
  marketing: [16, 20, 20, 28, 32, 32, 36, 40, 44, 68],
  editorial: [16, 20, 20, 28, 32, 32, 36, 40, 44, 68],
};

describe("typeScale", () => {
  it("C-TYPE-01 sizes the product scale from 16 px at 1.25", () => {
    const steps = typeScale({ context: "product" });
    const sizes = Object.fromEntries(steps.map((s) => [s.name, s.sizePx]));
    expect(sizes.body).toBe(16);
    expect(Math.abs(sizes.h1 - 39.06)).toBeLessThanOrEqual(0.01);
    expect(sizes.h1).toBeCloseTo(39.0625, 6);
    expect(sizes.caption).toBeCloseTo(10.24, 6);
    expect(sizes.label).toBeCloseTo(12.8, 6);
    expect(sizes["body-sm"]).toBeCloseTo(12.8, 6);
    expect(sizes.lead).toBeCloseTo(20, 6);
    expect(sizes.h4).toBeCloseTo(20, 6);
    expect(sizes.h3).toBeCloseTo(25, 6);
    expect(sizes.h2).toBeCloseTo(31.25, 6);
    expect(sizes.display).toBeCloseTo(48.828125, 6);
  });

  it("C-TYPE-02 sizes the dense and poster scales", () => {
    const dense = typeScale({ context: "dense" });
    expect(step(dense, "body").sizePx).toBe(14);
    expect(Math.abs(step(dense, "h1").sizePx - 29.0304)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(step(dense, "display").sizePx - 34.8365)).toBeLessThanOrEqual(0.001);
    const poster = typeScale({ context: "poster" });
    expect(step(poster, "body").sizePx).toBe(18);
    expect(Math.abs(step(poster, "h1").sizePx - 91.125)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(step(poster, "display").sizePx - 136.6875)).toBeLessThanOrEqual(0.001);
  });

  it("C-TYPE-03 snaps every line height to a positive multiple of 4", () => {
    for (const context of CONTEXTS) {
      for (const ratio of [undefined, ...RATIOS]) {
        for (const s of typeScale(ratio === undefined ? { context } : { context, ratio })) {
          expect(s.lineHeightPx, `${context} ${ratio} ${s.name}`).toBeGreaterThan(0);
          expect(s.lineHeightPx % 4, `${context} ${ratio} ${s.name}`).toBe(0);
        }
      }
    }
  });

  it("C-TYPE-04 tracks 16 px at -0.01096 and 48.83 px at -0.02226", () => {
    const steps = typeScale({ context: "product" });
    expect(Math.abs(step(steps, "body").trackingEm - -0.01096)).toBeLessThanOrEqual(0.0001);
    expect(Math.abs(step(steps, "body").trackingEm - -0.0109)).toBeLessThanOrEqual(0.0001);
    const display = step(steps, "display").trackingEm;
    expect(Math.abs(display - -0.02226)).toBeLessThanOrEqual(0.0001);
    expect(display).toBeGreaterThan(-0.0223);
  });

  it("C-TYPE-05 clamps the tracking of a 3.5 px caption to 0.05", () => {
    const steps = typeScale({ context: "dense", ratio: 2 });
    const caption = step(steps, "caption");
    expect(caption.sizePx).toBe(3.5);
    expect(caption.trackingEm).toBe(0.05);
  });

  it("C-TYPE-05 keeps every tracking value in [-0.04, 0.05]", () => {
    const ratio = fc.double({ min: 1.0000001, max: 2, noNaN: true });
    fc.assert(
      fc.property(fc.constantFrom(...CONTEXTS), ratio, (context, r) => {
        for (const s of typeScale({ context, ratio: r })) {
          expect(Number.isFinite(s.trackingEm)).toBe(true);
          expect(s.trackingEm).toBeGreaterThanOrEqual(-0.04);
          expect(s.trackingEm).toBeLessThanOrEqual(0.05);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("C-TYPE-06 writes the marketing display clamp with the Utopia formula", () => {
    const display = step(typeScale({ context: "marketing" }), "display");
    expect(display.clamp).toBe("clamp(2.7994rem, 2.3840rem + 1.8461vw, 3.8147rem)");
    expect(display.sizePx).toBeCloseTo(44.78976, 5);
    expect(display.maxSizePx).toBeCloseTo(61.03516, 4);
    const [min, intercept, slope, max] = (display.clamp ?? "")
      .match(/-?\d+\.\d+/g)
      ?.map(Number) ?? [Number.NaN];
    // `slope` is in vw (percent of the viewport, in px), `min`, `intercept` and `max` in rem.
    const at = (viewport: number) =>
      16 * Math.min(max, Math.max(min, intercept + (slope * viewport) / 100 / 16));
    expect(Math.abs(at(360) - (display.sizePx as number))).toBeLessThanOrEqual(0.01);
    expect(Math.abs(at(1240) - (display.maxSizePx as number))).toBeLessThanOrEqual(0.01);
  });

  it("C-TYPE-07 makes only display fluid in marketing and editorial", () => {
    const marketing = typeScale({ context: "marketing" });
    const editorial = typeScale({ context: "editorial" });
    expect(editorial).toEqual(marketing);
    for (const s of marketing) {
      if (s.name === "display") continue;
      expect(s.clamp, s.name).toBeUndefined();
      expect(s.maxSizePx, s.name).toBeUndefined();
      expect("clamp" in s || "maxSizePx" in s, s.name).toBe(false);
    }
    expect(step(marketing, "body").sizePx).toBe(18);
    expect(step(marketing, "h1").sizePx).toBeCloseTo(37.3248, 6);
    for (const context of ["dense", "product", "poster"] as const) {
      for (const s of typeScale({ context })) {
        expect("clamp" in s || "maxSizePx" in s, `${context} ${s.name}`).toBe(false);
      }
    }
  });

  it("C-TYPE-08 replaces the context ratio with the ratio argument", () => {
    expect(step(typeScale({ context: "product", ratio: 1.2 }), "h1").sizePx).toBeCloseTo(
      33.1776,
      4,
    );
    const display = step(typeScale({ context: "marketing", ratio: 1.2 }), "display");
    expect(Math.abs(display.sizePx - 44.78976)).toBeLessThanOrEqual(0.01);
    expect(Math.abs((display.maxSizePx as number) - 49.7664)).toBeLessThanOrEqual(0.01);
  });

  it("C-TYPE-09 lists the steps in order, with label = body-sm and lead = h4", () => {
    for (const context of CONTEXTS) {
      const steps = typeScale({ context });
      expect(steps.map((s) => s.name)).toEqual(NAMES);
      expect(step(steps, "label").sizePx).toBe(step(steps, "body-sm").sizePx);
      expect(step(steps, "lead").sizePx).toBe(step(steps, "h4").sizePx);
    }
  });

  it("C-TYPE-10 matches the line-height table in all 50 cells", () => {
    for (const context of CONTEXTS) {
      expect(
        typeScale({ context }).map((s) => s.lineHeightPx),
        context,
      ).toEqual(LINE_HEIGHTS[context]);
    }
  });

  it("C-TYPE-10 snaps the product h1 and lead as the spec shows", () => {
    const steps = typeScale({ context: "product" });
    expect(step(steps, "h1").lineHeightPx).toBe(48);
    expect(step(steps, "lead").lineHeightPx).toBe(32);
  });

  it("C-TYPE-11 throws RangeError for a ratio outside (1, 2] or not finite", () => {
    for (const ratio of [1, 0.9, 2.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => typeScale({ context: "product", ratio }), String(ratio)).toThrow(RangeError);
    }
    expect(() => typeScale({ context: "product", ratio: 2 })).not.toThrow();
  });

  it("C-TYPE-11 throws RangeError for an unknown context", () => {
    for (const context of ["", "Product", "toString", "display"]) {
      expect(() => typeScale({ context: context as Context })).toThrow(RangeError);
    }
    expect(() => typeScale({ context: "huge" as Context })).toThrow(/context/);
  });

  it("C-TYPE-11 throws TypeError for a value of the wrong type", () => {
    expect(() => typeScale({ context: 3 as unknown as Context })).toThrow(TypeError);
    expect(() => typeScale({ context: "product", ratio: "1.2" as unknown as number })).toThrow(
      TypeError,
    );
    expect(() => typeScale(null as unknown as { context: Context })).toThrow(TypeError);
  });

  it("C-TYPE-12 never lets a line height undercut its font size", () => {
    for (const context of CONTEXTS) {
      for (const ratio of [undefined, ...RATIOS]) {
        for (const s of typeScale(ratio === undefined ? { context } : { context, ratio })) {
          const largest = s.maxSizePx ?? s.sizePx;
          expect(s.lineHeightPx, `${context} ${ratio} ${s.name}`).toBeGreaterThanOrEqual(largest);
        }
      }
    }
  });

  it("C-TYPE-12 gives body line heights of 1.43, 1.5 and 1.56 times the size", () => {
    const ratioOf = (context: Context) => {
      const body = step(typeScale({ context }), "body");
      return body.lineHeightPx / body.sizePx;
    };
    expect(ratioOf("dense")).toBeCloseTo(1.43, 2);
    expect(ratioOf("product")).toBe(1.5);
    for (const context of ["poster", "marketing", "editorial"] as const) {
      expect(ratioOf(context)).toBeCloseTo(1.56, 2);
    }
  });

  it("returns a fresh array each call", () => {
    expect(typeScale({ context: "product" })).not.toBe(typeScale({ context: "product" }));
  });
});
