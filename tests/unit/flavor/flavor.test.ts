import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { rgbToOklab } from "@/engine/color/convert";
import { flavorStops } from "@/engine/flavor";
import { scanLine } from "@/export/checker/dyelot-check.mjs";
import {
  bufferSize,
  DEFAULT_FADE,
  easeAt,
  FRAGMENT_SHADER,
  flavorBackground,
  GRAIN,
  GRAIN_SVG,
  GRAIN_URL,
  LOOP_FRAMES,
  LOOP_SECONDS,
  MAX_BUFFER,
  MAX_DPR,
  VERTEX_SHADER,
} from "@/flavor/flavor.mjs";
import { defaultSpec } from "../spec/support";

// C-FLAV-01 to C-FLAV-08 of docs/specs/05-motion-3d.md, section 14.3: the constants of section 5.2,
// the CSS fallback (R5-20), the buffer size (R5-18), the easing (R5-18) and the shader texts (R5-17,
// section 6.1). The runtime's WebGL half (C-FLAV-09 on) is Task 5.3b's.

const STOPS = flavorStops(defaultSpec(), "light");

/** R5-20's grain, written out from the spec. */
const R5_20_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0.07 0 0 0 0"/></filter><rect width="160" height="160" filter="url(#g)"/></svg>';
const R5_20_URL = `url("data:image/svg+xml,${encodeURIComponent(R5_20_SVG)}")`;

/** The five stops of the exported flavor.css (R5-20). */
const VAR_STOPS = [
  "var(--neutral-100)",
  "var(--primary-200)",
  "var(--secondary-400)",
  "var(--accent-400)",
  "var(--primary-500)",
];

/** The rule of section 12.1's `flavor/flavor.css`, with `<GRAIN_URL>` in place. */
const FLAVOR_CSS = `.dyelot-flavor {
  background-color: var(--neutral-100);
  background-image: ${R5_20_URL}, linear-gradient(in oklch 135deg, var(--neutral-100) 0%, var(--primary-200) 25%, var(--secondary-400) 50%, var(--accent-400) 75%, var(--primary-500) 100%);
}`;

/** The declarations of one CSS rule, by property name. */
function declarations(rule: string): Record<string, string> {
  const body = rule.slice(rule.indexOf("{") + 1, rule.lastIndexOf("}"));
  const found: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const text = line.trim();
    if (text === "") continue;
    const colon = text.indexOf(":");
    found[text.slice(0, colon)] = text.slice(colon + 1, text.endsWith(";") ? -1 : undefined).trim();
  }
  return found;
}

describe("the constants", () => {
  it("C-FLAV-01 holds section 5.2's numbers, the objects frozen", () => {
    expect(LOOP_SECONDS).toBe(10);
    expect(LOOP_FRAMES).toBe(300);
    expect(GRAIN).toBe(0.035);
    expect(MAX_DPR).toBe(1.5);
    expect(MAX_BUFFER).toEqual({ width: 1920, height: 1080 });
    expect(DEFAULT_FADE).toEqual({ durationMs: 200, easing: [0.2, 0, 0, 1] });
    expect(Object.isFrozen(MAX_BUFFER)).toBe(true);
    expect(Object.isFrozen(DEFAULT_FADE)).toBe(true);
    expect(Object.isFrozen(DEFAULT_FADE.easing)).toBe(true);
  });

  it("C-FLAV-01 holds R5-20's grain and its data URL", () => {
    expect(GRAIN_SVG).toBe(R5_20_SVG);
    expect(GRAIN_URL).toBe(R5_20_URL);
    expect(GRAIN_URL).toBe(`url("data:image/svg+xml,${encodeURIComponent(GRAIN_SVG)}")`);
  });
});

describe("flavorBackground", () => {
  it("C-FLAV-02 gives R5-20's two values for the design's stops", () => {
    expect(flavorBackground(STOPS)).toEqual({
      backgroundColor: STOPS[0],
      backgroundImage: `${R5_20_URL}, linear-gradient(in oklch 135deg, ${STOPS[0]} 0%, ${STOPS[1]} 25%, ${STOPS[2]} 50%, ${STOPS[3]} 75%, ${STOPS[4]} 100%)`,
    });
  });

  it("C-FLAV-02 gives flavor.css's declarations for the var() stops, which hold no color literal", () => {
    const css = declarations(FLAVOR_CSS);
    const background = flavorBackground(VAR_STOPS);
    expect(background).toEqual({
      backgroundColor: css["background-color"],
      backgroundImage: css["background-image"],
    });
    for (const value of Object.values(background)) {
      expect(scanLine(value).findings).toEqual([]);
    }
    for (const line of FLAVOR_CSS.split("\n")) expect(scanLine(line).findings).toEqual([]);
  });

  it("C-FLAV-02 keeps a stop's case, and reads #rrggbb in either case", () => {
    const stops = ["#ABCDEF", "#abcdef", "#0A0b0C", "var(--x)", "var(--brand_2-a)"];
    expect(flavorBackground(stops).backgroundColor).toBe("#ABCDEF");
    expect(flavorBackground(stops).backgroundImage).toContain("#0A0b0C 50%");
  });

  it.each([
    ["4 stops", STOPS.slice(0, 4)],
    ["6 stops", [...STOPS, STOPS[0]]],
    ["the stop red", ["red", ...STOPS.slice(1)]],
    ["the stop #fff", [...STOPS.slice(0, 4), "#fff"]],
    ["the stop rgb(0 0 0)", [STOPS[0], "rgb(0 0 0)", ...STOPS.slice(2)]],
    ["the stop #ggg000", [STOPS[0], "#ggg000", ...STOPS.slice(2)]],
    ["the stop var(--)", [STOPS[0], "var(--)", ...STOPS.slice(2)]],
    ["the stop var(--a) b", [STOPS[0], "var(--a) b", ...STOPS.slice(2)]],
  ])("C-FLAV-03 throws RangeError for %s", (_name, stops) => {
    expect(() => flavorBackground(stops)).toThrow(RangeError);
    expect(() => flavorBackground(stops)).toThrow(/^flavorBackground: stops/);
  });

  it.each([
    ["null", null],
    ["a string", "#000000"],
    ["a stop 5", [5, ...STOPS.slice(1)]],
    ["a short list with a stop 5", [5]],
  ])("C-FLAV-03 throws TypeError for %s, types first", (_name, stops) => {
    expect(() => flavorBackground(stops as never)).toThrow(TypeError);
    expect(() => flavorBackground(stops as never)).toThrow(/^flavorBackground: stops/);
  });
});

describe("bufferSize", () => {
  it("C-FLAV-04 multiplies by the ratio capped at 1.5 and fits 1920 by 1080 as a whole", () => {
    expect(bufferSize(800, 450, 1)).toEqual({ width: 800, height: 450 });
    expect(bufferSize(800, 450, 2)).toEqual({ width: 1200, height: 675 });
    expect(bufferSize(2000, 1200, 1.5)).toEqual({ width: 1800, height: 1080 });
    expect(bufferSize(0.2, 0.2, 1)).toEqual({ width: 1, height: 1 });
  });

  it("C-FLAV-04 rounds each side, keeps the shape when it scales down and gives at least 1 by 1", () => {
    expect(bufferSize(100.4, 50.6, 1)).toEqual({ width: 100, height: 51 });
    expect(bufferSize(4000, 1000, 1)).toEqual({ width: 1920, height: 480 });
    expect(bufferSize(1000, 4000, 3)).toEqual({ width: 270, height: 1080 });
    expect(bufferSize(0, 0, 1)).toEqual({ width: 1, height: 1 });
    expect(bufferSize(5000, 0, 1)).toEqual({ width: 1920, height: 1 });
    expect(bufferSize(640, 360, 0.5)).toEqual({ width: 320, height: 180 });
  });

  it.each([
    ["the width", ["1", 1, 1]],
    ["the height", [1, null, 1]],
    ["the ratio", [1, 1, "2"]],
    ["the ratio before a width's domain", [-1, 1, "2"]],
  ])("C-FLAV-05 throws TypeError for %s", (_name, args) => {
    const [width, height, ratio] = args as [number, number, number];
    expect(() => bufferSize(width, height, ratio)).toThrow(TypeError);
    expect(() => bufferSize(width, height, ratio)).toThrow(/^bufferSize: /);
  });

  it.each([
    ["a width of -1", [-1, 1, 1]],
    ["a height of -1", [1, -1, 1]],
    ["a ratio of 0", [1, 1, 0]],
    ["a ratio of -1", [1, 1, -1]],
    ["a NaN width", [Number.NaN, 1, 1]],
    ["a NaN ratio", [1, 1, Number.NaN]],
    ["an infinite height", [1, Number.POSITIVE_INFINITY, 1]],
  ])("C-FLAV-05 throws RangeError for %s", (_name, args) => {
    const [width, height, ratio] = args as [number, number, number];
    expect(() => bufferSize(width, height, ratio)).toThrow(RangeError);
    expect(() => bufferSize(width, height, ratio)).toThrow(/^bufferSize: /);
  });
});

describe("easeAt", () => {
  it("C-FLAV-06 gives x for the linear curve, within 1e-6", () => {
    for (const x of [0, 0.25, 0.5, 1]) {
      expect(Math.abs(easeAt([0, 0, 1, 1], x) - x), String(x)).toBeLessThanOrEqual(1e-6);
    }
  });

  it("C-FLAV-06 gives 0.5 at 0.2 for the standard curve, within 1e-5", () => {
    expect(Math.abs(easeAt([0.2, 0, 0, 1], 0.2) - 0.5)).toBeLessThanOrEqual(1e-5);
  });

  it("C-FLAV-06 gives exactly 0 at 0 and 1 at 1 for every easing", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: -2, max: 3, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: -2, max: 3, noNaN: true }),
        (x1, y1, x2, y2) => {
          expect(easeAt([x1, y1, x2, y2], 0)).toBe(0);
          expect(easeAt([x1, y1, x2, y2], 1)).toBe(1);
        },
      ),
      { numRuns: 200, seed: 5003 },
    );
  });

  it("C-FLAV-06 follows the curve between, overshoot included", () => {
    // The ease-in-out curve is symmetric about (0.5, 0.5).
    expect(Math.abs(easeAt([0.42, 0, 0.58, 1], 0.5) - 0.5)).toBeLessThanOrEqual(1e-6);
    const bounce = easeAt([0.3, 2, 0.7, 2], 0.5);
    expect(bounce).toBeGreaterThan(1);
    expect(easeAt([0.2, 0, 0, 1], 0.1)).toBeLessThan(easeAt([0.2, 0, 0, 1], 0.2));
  });

  it.each([
    ["x -0.1", [0, 0, 1, 1], -0.1],
    ["x 1.1", [0, 0, 1, 1], 1.1],
    ["x NaN", [0, 0, 1, 1], Number.NaN],
    ["three numbers", [0, 0, 1], 0.5],
    ["five numbers", [0, 0, 1, 1, 1], 0.5],
    ["x1 1.5", [1.5, 0, 1, 1], 0.5],
    ["x2 -0.1", [0, 0, -0.1, 1], 0.5],
    ["a NaN y1", [0, Number.NaN, 1, 1], 0.5],
    ["an infinite y2", [0, 0, 1, Number.POSITIVE_INFINITY], 0.5],
  ])("C-FLAV-07 throws RangeError for %s", (_name, easing, x) => {
    expect(() => easeAt(easing, x)).toThrow(RangeError);
    expect(() => easeAt(easing, x)).toThrow(/^easeAt: /);
  });

  it.each([
    ["the easing x", "x", 0.5],
    ["the x x", [0, 0, 1, 1], "x"],
    ["a string inside the easing", [0, "0", 1, 1], 0.5],
    ["a string inside a short easing, types first", ["0"], 0.5],
    ["a null easing", null, 0.5],
  ])("C-FLAV-07 throws TypeError for %s", (_name, easing, x) => {
    expect(() => easeAt(easing as never, x as never)).toThrow(TypeError);
    expect(() => easeAt(easing as never, x as never)).toThrow(/^easeAt: /);
  });
});

/**
 * The shader text with its comments removed, every run of white space made one space, and no space
 * after an opening or before a closing parenthesis, so a term broken over lines reads as one line.
 */
function code(shader: string): string {
  return shader
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\( /g, "(")
    .replace(/ \)/g, ")");
}

/** A `const mat3 NAME = mat3(...)` of the fragment shader, read as written: row by row. */
function matrix(name: string): number[][] {
  const match = new RegExp(`const mat3 ${name} = mat3\\(([^)]*)\\);`).exec(code(FRAGMENT_SHADER));
  if (match === null) throw new Error(`no matrix ${name}`);
  const numbers = match[1].split(",").map((text) => text.trim());
  expect(numbers, name).toHaveLength(9);
  for (const text of numbers) {
    // Section 6.1: each number written to 10 significant digits.
    const digits = text.replace(/^-/, "").replace(".", "").replace(/^0+/, "");
    expect(digits, `${name}: ${text}`).toHaveLength(10);
  }
  const values = numbers.map(Number);
  return [values.slice(0, 3), values.slice(3, 6), values.slice(6, 9)];
}

const times = (m: number[][], v: readonly number[]): number[] =>
  m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);

/** M1's sRGB decode and encode (src/engine/color/convert.ts), written out for the test. */
const decode = (c: number): number =>
  Math.abs(c) <= 0.04045 ? c / 12.92 : Math.sign(c) * ((Math.abs(c) + 0.055) / 1.055) ** 2.4;
const encode = (l: number): number =>
  Math.abs(l) <= 0.0031308 ? 12.92 * l : Math.sign(l) * (1.055 * Math.abs(l) ** (1 / 2.4) - 0.055);

describe("the shader texts", () => {
  it("C-FLAV-08 start with #version 300 es, and the vertex text reads no attribute", () => {
    expect(VERTEX_SHADER.startsWith("#version 300 es\n")).toBe(true);
    expect(FRAGMENT_SHADER.startsWith("#version 300 es\n")).toBe(true);
    const vertex = code(VERTEX_SHADER);
    expect(vertex).not.toMatch(/\battribute\b/);
    expect(vertex).not.toMatch(/(?:^|;|\}|\)) ?(?:layout ?\([^)]*\) ?)?in \w+ \w+/);
    expect(vertex).not.toMatch(/\buniform\b/);
    expect(vertex).toContain("gl_VertexID");
    expect(vertex).toContain("gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);");
  });

  it("C-FLAV-08 declares the seven uniforms of R5-17 and no other, and one output", () => {
    const fragment = code(FRAGMENT_SHADER);
    const uniforms = Array.from(
      fragment.matchAll(/\buniform (?:(?:highp|mediump|lowp) )?(\w+) (\w+(?:\[\d+\])?);/g),
      (match) => `${match[1]} ${match[2]}`,
    );
    expect(uniforms.sort()).toEqual(
      [
        "vec2 u_resolution",
        "float u_phase",
        "vec2 u_seed",
        "vec3 u_from[5]",
        "vec3 u_to[5]",
        "float u_mix",
        "float u_grain",
      ].sort(),
    );
    expect(fragment.match(/\buniform\b/g)).toHaveLength(7);
    expect(fragment).toContain("precision highp float;");
    expect(fragment.match(/\bout vec4 \w+;/g)).toEqual(["out vec4 color;"]);
    expect(fragment).toMatch(/color = vec4\([^;]*, 1\.0\);/);
  });

  it("C-FLAV-08 lets time enter only as u_phase, on circles of 0.60, 0.40 and 0.25 turning 1, 2 and 3 times", () => {
    const fragment = code(FRAGMENT_SHADER);
    const terms = [
      "0.55 * snoise(1.0 * p + 0.60 * vec2(cos(1.0 * u_phase), sin(1.0 * u_phase)))",
      "0.30 * snoise(2.0 * p + 0.40 * vec2(cos(2.0 * u_phase), sin(2.0 * u_phase)))",
      "0.15 * snoise(4.0 * p + 0.25 * vec2(cos(3.0 * u_phase), sin(3.0 * u_phase)))",
    ];
    let rest = fragment.replace("uniform float u_phase;", "");
    for (const term of terms) {
      expect(fragment, term).toContain(term);
      rest = rest.replace(term, "");
    }
    expect(rest).not.toContain("u_phase");
    expect(fragment).toContain("vec2 p = gl_FragCoord.xy / u_resolution.y * 1.6 + u_seed;");
    expect(fragment).toContain(`float n = clamp(0.5 + 0.5 * (${terms.join(" + ")}), 0.0, 1.0);`);
  });

  it("C-FLAV-08 picks a segment of the five stops and mixes in OKLab, then adds the grain and clamps", () => {
    const fragment = code(FRAGMENT_SHADER);
    expect(fragment).toContain("float k = min(3.0, floor(n * 4.0));");
    expect(fragment).toContain("float f = n * 4.0 - k;");
    expect(fragment).toContain(
      "float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }",
    );
    expect(fragment).toContain("(hash(floor(gl_FragCoord.xy)) - 0.5) * u_grain");
    expect(fragment).toContain("u_mix");
    expect(fragment).toMatch(/clamp\([^;]*, 0\.0, 1\.0\)/);
    // M1's piecewise transfer, in both directions.
    for (const constant of ["0.04045", "12.92", "0.055", "1.055", "2.4", "0.0031308"]) {
      expect(fragment, constant).toContain(constant);
    }
  });

  it("C-FLAV-08 keeps the webgl-noise notice above snoise", () => {
    const notice = FRAGMENT_SHADER.slice(0, FRAGMENT_SHADER.indexOf("float snoise(vec2 v)"));
    for (const text of [
      "Permission is hereby granted, free of charge",
      "Ian McEwan, Ashima Arts",
      "Copyright (C) 2011 by Ashima Arts (Simplex noise)",
      "Copyright (C) 2011-2016 by Stefan Gustavson (Classic noise and others)",
      "https://github.com/stegu/webgl-noise",
    ]) {
      expect(notice, text).toContain(text);
    }
  });

  it("C-FLAV-08 takes 200 random sRGB colors to rgbToOklab and back with its four matrices, within 1e-6", () => {
    const toLms = matrix("SRGB_TO_LMS");
    const toLab = matrix("LMS_TO_OKLAB");
    const fromLab = matrix("OKLAB_TO_LMS");
    const fromLms = matrix("LMS_TO_SRGB");
    fc.assert(
      fc.property(
        fc.tuple(
          fc.double({ min: 0, max: 1, noNaN: true }),
          fc.double({ min: 0, max: 1, noNaN: true }),
          fc.double({ min: 0, max: 1, noNaN: true }),
        ),
        (rgb) => {
          const lms = times(toLms, rgb.map(decode));
          const lab = times(toLab, lms.map(Math.cbrt));
          const expected = rgbToOklab(rgb, "srgb");
          for (let i = 0; i < 3; i++) expect(Math.abs(lab[i] - expected[i])).toBeLessThan(1e-6);
          const back = times(
            fromLms,
            times(fromLab, lab).map((value) => value ** 3),
          ).map(encode);
          for (let i = 0; i < 3; i++) expect(Math.abs(back[i] - rgb[i])).toBeLessThan(1e-6);
        },
      ),
      { numRuns: 200, seed: 5003 },
    );
  });
});
