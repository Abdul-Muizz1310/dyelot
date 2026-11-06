import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { rgbToOklab } from "@/engine/color/convert";
import { gamutMap } from "@/engine/color/gamut";
import { rec2020ToOklab } from "@/engine/color/rec2020";
import { gamutSolid, SOLID_GAMUTS, type SolidGamut, solidPosition } from "@/engine/color/solid";

// Cases are the C-SOLID-nn rows of docs/specs/05-motion-3d.md, section 14.1.

const near = (a: number, b: number, eps: number): void => {
  expect(Math.abs(a - b)).toBeLessThan(eps);
};
const vertexCount = (steps: number) => 6 * (steps + 1) ** 2;

const labOf = (gamut: SolidGamut, rgb: readonly [number, number, number]) =>
  gamut === "rec2020" ? rec2020ToOklab(rgb) : rgbToOklab(rgb, gamut);

/** The vertex index of face `f` at `(i, j)`. */
const at = (steps: number, f: number, i: number, j: number) =>
  f * (steps + 1) ** 2 + j * (steps + 1) + i;

const position = (solid: ReturnType<typeof gamutSolid>, vertex: number) => [
  solid.positions[vertex * 3],
  solid.positions[vertex * 3 + 1],
  solid.positions[vertex * 3 + 2],
];

const radius = (solid: ReturnType<typeof gamutSolid>, vertex: number) =>
  Math.hypot(solid.positions[vertex * 3], solid.positions[vertex * 3 + 2]);

describe("gamutSolid", () => {
  it("C-SOLID-01 holds the gamut, the steps and the typed arrays", () => {
    const solid = gamutSolid("srgb", 2);
    expect(solid.gamut).toBe("srgb");
    expect(solid.steps).toBe(2);
    expect(solid.positions).toBeInstanceOf(Float32Array);
    expect(solid.positions).toHaveLength(162);
    expect(solid.colors).toBeInstanceOf(Float32Array);
    expect(solid.colors).toHaveLength(162);
    expect(solid.indices).toBeInstanceOf(Uint16Array);
    expect(solid.indices).toHaveLength(144);
    expect([...SOLID_GAMUTS]).toEqual(["srgb", "p3", "rec2020"]);
    expect(Object.isFrozen(SOLID_GAMUTS)).toBe(true);
  });

  it("C-SOLID-02 lays the vertices and the cells out as R5-07 says", () => {
    const solid = gamutSolid("srgb", 2);
    expect([...solid.colors.slice(21, 24)]).toEqual([0, 0.5, 1]);
    expect([...solid.indices.slice(0, 6)]).toEqual([0, 1, 3, 1, 4, 3]);
    expect([...solid.colors.slice(27, 30)]).toEqual([1, 0, 0]);
  });

  it("C-SOLID-03 puts white, black and red of the sRGB solid where R5-08 says", () => {
    const solid = gamutSolid("srgb", 32);
    const white = position(solid, at(32, 1, 32, 32));
    const black = position(solid, at(32, 0, 0, 0));
    const red = position(solid, at(32, 1, 0, 0));
    [0, 0.5, 0].forEach((v, k) => {
      near(white[k], v, 1e-5);
    });
    [0, -0.5, 0].forEach((v, k) => {
      near(black[k], v, 1e-5);
    });
    [0.449726, 0.127955, 0.251693].forEach((v, k) => {
      near(red[k], v, 1e-5);
    });
  });

  it("C-SOLID-04 colors the sRGB solid by its channels and the others by gamut mapping", () => {
    const steps = 4;
    for (const gamut of ["p3", "rec2020"] as const) {
      const solid = gamutSolid(gamut, steps);
      for (let v = 0; v < vertexCount(steps); v++) {
        const f = Math.floor(v / (steps + 1) ** 2);
        const j = Math.floor((v % (steps + 1) ** 2) / (steps + 1));
        const i = v % (steps + 1);
        const channels = faceChannels(f, i / steps, j / steps);
        const [l, a, b] = labOf(gamut, channels);
        const c = Math.hypot(a, b);
        const h = c <= 4e-6 ? null : (Math.atan2(b, a) * 180) / Math.PI;
        const expected = gamutMap({ l, c, h }, "srgb");
        for (let k = 0; k < 3; k++) {
          near(solid.colors[v * 3 + k], expected[k], 1e-6);
          expect(solid.colors[v * 3 + k]).toBeGreaterThanOrEqual(0);
          expect(solid.colors[v * 3 + k]).toBeLessThanOrEqual(1);
        }
      }
    }
    const srgb = gamutSolid("srgb", steps);
    for (let v = 0; v < vertexCount(steps); v++) {
      const f = Math.floor(v / (steps + 1) ** 2);
      const j = Math.floor((v % (steps + 1) ** 2) / (steps + 1));
      const i = v % (steps + 1);
      const channels = faceChannels(f, i / steps, j / steps);
      for (let k = 0; k < 3; k++) near(srgb.colors[v * 3 + k], channels[k], 1e-6);
    }
    const rec = gamutSolid("rec2020", 32);
    const [x, y, z] = position(rec, at(32, 1, 0, 0));
    const lab = rec2020ToOklab([1, 0, 0]);
    near(x / 2, lab[1], 1e-5);
    near(y + 0.5, lab[0], 1e-5);
    near(z / 2, lab[2], 1e-5);
  });

  it("C-SOLID-05 keeps lengths, indices, colors and heights in range", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.constantFrom(...SOLID_GAMUTS),
        (steps, gamut) => {
          const solid = gamutSolid(gamut, steps);
          expect(solid.positions).toHaveLength(vertexCount(steps) * 3);
          expect(solid.colors).toHaveLength(vertexCount(steps) * 3);
          expect(solid.indices).toHaveLength(6 * steps * steps * 6);
          for (const index of solid.indices) expect(index).toBeLessThan(vertexCount(steps));
          for (const channel of solid.colors) {
            expect(channel).toBeGreaterThanOrEqual(0);
            expect(channel).toBeLessThanOrEqual(1);
          }
          for (let v = 0; v < vertexCount(steps); v++) {
            expect(Math.abs(solid.positions[v * 3 + 1])).toBeLessThanOrEqual(0.5 + 1e-5);
          }
        },
      ),
      { numRuns: 200, seed: 5001 },
    );
  });

  it("C-SOLID-06 shares white and black and widens the red from sRGB to P3 to Rec. 2020", () => {
    const [srgb, p3, rec] = SOLID_GAMUTS.map((gamut) => gamutSolid(gamut, 8));
    for (const solid of [p3, rec]) {
      position(solid, at(8, 1, 8, 8)).forEach((v, k) => {
        near(v, position(srgb, at(8, 1, 8, 8))[k], 1e-5);
      });
      position(solid, at(8, 0, 0, 0)).forEach((v, k) => {
        near(v, position(srgb, at(8, 0, 0, 0))[k], 1e-5);
      });
    }
    const red = at(8, 1, 0, 0);
    expect(radius(rec, red)).toBeGreaterThan(radius(p3, red));
    expect(radius(p3, red)).toBeGreaterThan(radius(srgb, red));
  });

  it("C-SOLID-07 checks types first, then the domains, each naming gamutSolid", () => {
    const call = (gamut: unknown, steps: unknown) => () =>
      gamutSolid(gamut as never, steps as never);
    for (const args of [
      [5, 32],
      ["srgb", "32"],
      [5, 0],
    ] as const) {
      expect(call(args[0], args[1])).toThrow(TypeError);
      expect(call(args[0], args[1])).toThrow(/^gamutSolid/);
    }
    for (const args of [
      ["cmyk", 32],
      ["srgb", 0],
      ["srgb", 65],
      ["srgb", 2.5],
      ["srgb", Number.NaN],
    ] as const) {
      expect(call(args[0], args[1])).toThrow(RangeError);
      expect(call(args[0], args[1])).toThrow(/^gamutSolid/);
    }
  });
});

/** The encoded channels of face `f` at `(u, v)`, the face order of R5-07. */
function faceChannels(f: number, u: number, v: number): [number, number, number] {
  const fixed = f % 2;
  switch (Math.floor(f / 2)) {
    case 0:
      return [fixed, u, v];
    case 1:
      return [u, fixed, v];
    default:
      return [u, v, fixed];
  }
}

describe("solidPosition", () => {
  it("C-SOLID-08 maps OKLab (L, a, b) to (2a, L - 0.5, 2b)", () => {
    const [x, y, z] = solidPosition({ l: 0.6, c: 0.1, h: 90 });
    near(x, 0, 1e-12);
    near(y, 0.1, 1e-12);
    near(z, 0.2, 1e-12);
    const gray = solidPosition({ l: 0.5, c: 0, h: null });
    gray.forEach((v) => {
      near(v, 0, 1e-12);
    });
  });

  it("C-SOLID-09 throws TypeError for null and RangeError for NaN, naming solidPosition", () => {
    expect(() => solidPosition(null as never)).toThrow(TypeError);
    expect(() => solidPosition(null as never)).toThrow(/^solidPosition/);
    expect(() => solidPosition({ l: Number.NaN, c: 0, h: 0 })).toThrow(RangeError);
    expect(() => solidPosition({ l: Number.NaN, c: 0, h: 0 })).toThrow(/^solidPosition/);
  });
});
