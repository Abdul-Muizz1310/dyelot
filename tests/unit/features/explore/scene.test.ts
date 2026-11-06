import { describe, expect, it } from "vitest";
import { gamutSlice, PALETTE_NAMES, STEPS, solidPosition } from "@/engine";
import {
  type Camera,
  cameraOf,
  cameraPosition,
  DEFAULT_CAMERA,
  dotAt,
  EXPLORE_LINES,
  type ScenePoint,
  scenePoints,
  sceneSummary,
  slicePath,
  sliceSteps,
} from "@/features/explore/scene";
import { defaultDesign } from "@/features/landing/heroes";

// C-EXPL5-01 to C-EXPL5-07 and C-EXPL5-10 of docs/specs/05-motion-3d.md, section 14.5 (R5-36 to R5-38).

const SPEC = defaultDesign();
const rad = (deg: number) => (deg * Math.PI) / 180;

const at = (l: number): ScenePoint => ({
  palette: "primary",
  step: 500,
  hex: "#000000" as ScenePoint["hex"],
  oklch: { l, c: 0.1, h: 20 },
  position: [0, 0, 0],
  seed: false,
});

describe("scenePoints (R5-36)", () => {
  it("C-EXPL5-01 gives 88 points in palette then step order, each placed by solidPosition", () => {
    const points = scenePoints(SPEC, "light");
    expect(points).toHaveLength(88);
    expect(points.map((p) => [p.palette, p.step])).toEqual(
      PALETTE_NAMES.flatMap((palette) => STEPS.map((step) => [palette, step])),
    );
    for (const point of points) {
      const source = SPEC.color.palettes[point.palette].light.find((s) => s.step === point.step);
      expect(point.hex).toBe(source?.hex);
      expect(point.oklch).toEqual(source?.oklch);
      expect(point.position).toEqual(solidPosition(point.oklch));
      const seedStep = SPEC.color.palettes[point.palette].seedStep?.light;
      expect(point.seed).toBe(seedStep === point.step);
    }
    expect(points.some((p) => p.seed)).toBe(true);
    expect(points.filter((p) => p.seed).length).toBeLessThanOrEqual(8);
  });

  it("C-EXPL5-01 reads the dark scales in dark mode", () => {
    const points = scenePoints(SPEC, "dark");
    expect(points[0]?.hex).toBe(SPEC.color.palettes.neutral.dark[0]?.hex);
    for (const p of points.filter((q) => q.seed)) {
      expect(SPEC.color.palettes[p.palette].seedStep?.dark).toBe(p.step);
    }
  });
});

describe("sliceSteps (R5-37)", () => {
  it("C-EXPL5-02 keeps the points within 0.04 of L, in order", () => {
    const points = [at(0.55), at(0.56), at(0.64), at(0.6401), at(0.5599), at(0.6)];
    expect(sliceSteps(points, 0.6).map((p) => p.oklch.l)).toEqual([0.56, 0.64, 0.6]);
  });
});

describe("the camera (R5-38, 8.2)", () => {
  it("C-EXPL5-03 puts the default camera at 3.2 times the direction of turn and tilt", () => {
    expect(DEFAULT_CAMERA).toEqual({ turn: 35, tilt: 25, zoom: 1 });
    const [x, y, z] = cameraPosition(DEFAULT_CAMERA);
    expect(x).toBeCloseTo(3.2 * Math.cos(rad(25)) * Math.sin(rad(35)), 9);
    expect(y).toBeCloseTo(3.2 * Math.sin(rad(25)), 9);
    expect(z).toBeCloseTo(3.2 * Math.cos(rad(25)) * Math.cos(rad(35)), 9);
  });

  it("C-EXPL5-03 gives a camera back through cameraOf", () => {
    for (let turn = -180; turn <= 180; turn += 15) {
      for (let tilt = 0; tilt <= 75; tilt += 15) {
        for (let zoom = 0.5; zoom <= 2; zoom += 0.25) {
          const camera: Camera = { turn, tilt, zoom };
          expect(cameraOf(cameraPosition(camera), 0)).toEqual(camera);
        }
      }
    }
  });

  it("C-EXPL5-03 keeps the held turn at the pole", () => {
    for (const held of [-180, -90, 0, 35, 179]) {
      const camera = { turn: held, tilt: 90, zoom: 1.5 };
      expect(cameraOf(cameraPosition(camera), held)).toEqual(camera);
      expect(cameraOf(cameraPosition({ turn: 10, tilt: 90, zoom: 1 }), held)).toEqual({
        turn: held,
        tilt: 90,
        zoom: 1,
      });
    }
  });

  it("C-EXPL5-03 rounds, clamps and wraps", () => {
    const d = 3.2;
    const polar = (turnDeg: number, tiltDeg: number, dist = d): [number, number, number] => [
      dist * Math.cos(rad(tiltDeg)) * Math.sin(rad(turnDeg)),
      dist * Math.sin(rad(tiltDeg)),
      dist * Math.cos(rad(tiltDeg)) * Math.cos(rad(turnDeg)),
    ];
    expect(cameraOf(polar(35.4, 25), 0).turn).toBe(35);
    expect(cameraOf(polar(35.6, 25), 0).turn).toBe(36);
    expect(cameraOf(polar(35, -5), 0).tilt).toBe(0);
    expect(cameraOf(polar(35, 25.4), 0).tilt).toBe(25);
    expect(cameraOf(polar(35, 25, 3.2 / 3), 0).zoom).toBe(2);
    expect(cameraOf(polar(35, 25, 3.2 / 0.3), 0).zoom).toBe(0.5);
    expect(cameraOf(polar(35, 25, 3.2 / 1.03), 0).zoom).toBe(1.05);
    expect(cameraOf(polar(190, 25), 0).turn).toBe(-170);
    expect(cameraOf(polar(-190, 25), 0).turn).toBe(170);
    expect(cameraOf(polar(179.6, 25), 0).turn).toBe(180);
    expect(cameraOf(polar(-179.6, 25), 0).turn).toBe(-180);
    expect(Object.is(cameraOf(polar(0, 0), 0).turn, 0)).toBe(true);
    expect(Object.is(cameraOf(polar(0, 0), 0).tilt, 0)).toBe(true);
  });

  it("C-EXPL5-04 rejects a camera out of range or of the wrong type, naming the function", () => {
    expect(() => cameraPosition({ turn: 181, tilt: 25, zoom: 1 })).toThrow(RangeError);
    expect(() => cameraPosition({ turn: 181, tilt: 25, zoom: 1 })).toThrow(/^cameraPosition/);
    expect(() => cameraPosition({ turn: 0, tilt: 91, zoom: 1 })).toThrow(RangeError);
    expect(() => cameraPosition({ turn: 0, tilt: 25, zoom: 0.4 })).toThrow(RangeError);
    expect(() => cameraPosition({ turn: 0, tilt: 25, zoom: Number.NaN })).toThrow(RangeError);
    expect(() => cameraPosition({ turn: "1", tilt: 25, zoom: 1 } as never)).toThrow(TypeError);
    expect(() => cameraPosition({ turn: "1", tilt: 25, zoom: 1 } as never)).toThrow(
      /^cameraPosition/,
    );
    expect(() => cameraPosition({ turn: 1, tilt: 25, zoom: 1, extra: 1 } as never)).not.toThrow();
    expect(() => cameraOf([0, 0, 0], 0)).toThrow(RangeError);
    expect(() => cameraOf([0, 0, 0], 0)).toThrow(/^cameraOf/);
    expect(() => cameraOf([0, 1] as never, 0)).toThrow(RangeError);
    expect(() => cameraOf([0, Number.NaN, 3], 0)).toThrow(RangeError);
    expect(() => cameraOf([0, 1, 3], Number.NaN)).toThrow(RangeError);
    expect(() => cameraOf([0, 1, 3], "0" as never)).toThrow(TypeError);
    expect(() => cameraOf([0, 1, 3], "0" as never)).toThrow(/^cameraOf/);
    expect(() => cameraOf([0, "1", 3] as never, 0)).toThrow(TypeError);
  });
});

describe("the flat view's plot (R5-37, 8.3)", () => {
  it("C-EXPL5-05 draws a closed path of 360 vertices", () => {
    const path = slicePath(gamutSlice("srgb", 0.6), 320);
    expect(path.startsWith("M")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
    expect(path.match(/[ML]/g)).toHaveLength(360);
  });

  it("C-EXPL5-05 puts hue and chroma at the angle and radius of 8.3", () => {
    expect(slicePath([{ h: 0, c: 0.5 }], 320)).toBe("M310.00 160.00Z");
    expect(slicePath([{ h: 90, c: 0.25 }], 320)).toBe("M160.00 85.00Z");
    expect(slicePath([{ h: 180, c: 0.5 }], 320)).toBe("M10.00 160.00Z");
    expect(slicePath([{ h: 0, c: 0.5 }], 640)).toBe("M620.00 320.00Z");
  });

  it("C-EXPL5-05 keeps Rec. 2020's outline inside the 320 box", () => {
    const numbers = slicePath(gamutSlice("rec2020", 0.85), 320).match(/-?\d+\.\d\d/g) ?? [];
    expect(numbers).toHaveLength(720);
    for (const value of numbers) {
      expect(Number(value)).toBeGreaterThanOrEqual(0);
      expect(Number(value)).toBeLessThanOrEqual(320);
    }
  });

  it("C-EXPL5-05 places an achromatic step at the center and a hued step by its polar form", () => {
    expect(dotAt({ l: 0.5, c: 0, h: null }, 320)).toEqual([160, 160]);
    expect(dotAt({ l: 0.5, c: 0.5, h: 0 }, 320)).toEqual([310, 160]);
    expect(dotAt({ l: 0.5, c: 0.25, h: 90 }, 320)).toEqual([160, 85]);
    expect(dotAt({ l: 0.5, c: 0.1, h: null }, 320)).toEqual([160, 160]);
    const [x, y] = dotAt({ l: 0.7, c: 0.17, h: 22 }, 320);
    expect(x).toBeCloseTo(160 + 51 * Math.cos(rad(22)), 2);
    expect(y).toBeCloseTo(160 - 51 * Math.sin(rad(22)), 2);
  });
});

describe("sceneSummary and EXPLORE_LINES (R5-37, R5-39)", () => {
  it("C-EXPL5-06 reads as 8.3 gives it", () => {
    expect(sceneSummary("Madder", "light", "srgb", 0.6)).toBe(
      "Madder: 88 steps of the light scales in OKLab, inside the sRGB gamut solid, cut at L 0.60.",
    );
    expect(sceneSummary("Madder", "dark", "p3", 0.456)).toBe(
      "Madder: 88 steps of the dark scales in OKLab, inside the Display P3 gamut solid, cut at L 0.46.",
    );
    expect(sceneSummary("Weld", "light", "rec2020", 0)).toContain("the Rec. 2020 gamut solid");
  });

  it("C-EXPL5-06 holds 8.4's sentences, frozen", () => {
    expect(EXPLORE_LINES).toEqual({
      loading: "Loading the 3D view…",
      "no-webgl2":
        "This browser cannot draw the 3D view, so the flat view below shows the same slice.",
      "context-lost": "The 3D view stopped, so the flat view shows the same slice.",
      restart: "Restart the 3D view",
      "load-failed": "The 3D view could not load. Reload the page to try again.",
      "bad-link": "The explorer shows the default design instead.",
      "bad-link-kept": "The explorer keeps the current design.",
    });
    expect(Object.isFrozen(EXPLORE_LINES)).toBe(true);
  });

  it("C-EXPL5-07 rejects a gamut, mode or lightness out of range and a name of the wrong type", () => {
    expect(() => sceneSummary("a", "light", "x" as never, 0.5)).toThrow(RangeError);
    expect(() => sceneSummary("a", "light", "x" as never, 0.5)).toThrow(/^sceneSummary/);
    expect(() => sceneSummary("a", "light", "srgb", 2)).toThrow(RangeError);
    expect(() => sceneSummary("a", "light", "srgb", Number.NaN)).toThrow(RangeError);
    expect(() => sceneSummary("a", "dim" as never, "srgb", 0.5)).toThrow(RangeError);
    expect(() => sceneSummary(5 as never, "light", "srgb", 0.5)).toThrow(TypeError);
    expect(() => sceneSummary(5 as never, "light", "srgb", 0.5)).toThrow(/^sceneSummary/);
    expect(() => sceneSummary("a", "light", "srgb", "0.5" as never)).toThrow(TypeError);
    expect(() => scenePoints(SPEC, "dim" as never)).toThrow(RangeError);
    expect(() => scenePoints(SPEC, "dim" as never)).toThrow(/^scenePoints/);
    expect(() => scenePoints(SPEC, 1 as never)).toThrow(TypeError);
  });
});

describe("argument checks (R-05)", () => {
  it("C-EXPL5-10 throws TypeError for the wrong type and RangeError for the wrong domain", () => {
    expect(() => scenePoints(null as never, "light")).toThrow(TypeError);
    expect(() => scenePoints(null as never, "light")).toThrow(/^scenePoints/);
    expect(() => sliceSteps(null as never, 0.5)).toThrow(TypeError);
    expect(() => sliceSteps(null as never, 0.5)).toThrow(/^sliceSteps/);
    expect(() => sliceSteps([], "0.5" as never)).toThrow(TypeError);
    expect(() => cameraOf("x" as never, 0)).toThrow(TypeError);
    expect(() => cameraPosition(null as never)).toThrow(TypeError);
    expect(() => slicePath(null as never, 320)).toThrow(TypeError);
    expect(() => slicePath(null as never, 320)).toThrow(/^slicePath/);
    expect(() => slicePath([{ h: 0, c: "1" }] as never, 320)).toThrow(TypeError);
    expect(() => slicePath([null] as never, 320)).toThrow(TypeError);
    expect(() => slicePath([], "320" as never)).toThrow(TypeError);
    expect(() => dotAt(null as never, 320)).toThrow(TypeError);
    expect(() => dotAt(null as never, 320)).toThrow(/^dotAt/);
    expect(() => dotAt({ l: 0.5, c: 0, h: "1" } as never, 320)).toThrow(TypeError);
    expect(() => dotAt({ l: 0.5, c: "0", h: null } as never, 320)).toThrow(TypeError);
    expect(() => dotAt({ l: 0.5, c: 0, h: null }, "1" as never)).toThrow(TypeError);

    expect(() => sliceSteps([], 2)).toThrow(RangeError);
    expect(() => sliceSteps([], 2)).toThrow(/^sliceSteps/);
    expect(() => sliceSteps([], Number.NaN)).toThrow(RangeError);
    expect(() => slicePath([], 0)).toThrow(RangeError);
    expect(() => slicePath([], 0)).toThrow(/^slicePath/);
    expect(() => slicePath([{ h: 0, c: Number.NaN }], 320)).toThrow(RangeError);
    expect(() => dotAt({ l: 0.5, c: 0, h: null }, -1)).toThrow(RangeError);
    expect(() => dotAt({ l: 0.5, c: 0, h: null }, -1)).toThrow(/^dotAt/);
    expect(() => dotAt({ l: 0.5, c: Number.NaN, h: null }, 320)).toThrow(RangeError);
    expect(() => dotAt({ l: 0.5, c: 0.1, h: Number.POSITIVE_INFINITY }, 320)).toThrow(RangeError);
  });
});
