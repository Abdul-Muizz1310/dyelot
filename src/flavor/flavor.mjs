// @ts-check
// The animated background of a dyelot design: a WebGL2 shader that mixes five colors of the
// design in OKLab over a noise field, loops every 10 seconds without a seam, and adds a fine
// grain. Where WebGL2 is missing, a still CSS gradient of the same colors stands in. One file, no
// dependencies.

/** One loop of the background, in seconds. */
export const LOOP_SECONDS = 10;

/** The frames of one loop at 30 frames a second. */
export const LOOP_FRAMES = 300;

/** The grain's strength: each channel moves by at most half of it, the same in every frame. */
export const GRAIN = 0.035;

/** The device pixel ratio the drawing buffer follows, at most. */
export const MAX_DPR = 1.5;

/** The largest drawing buffer; a larger one is scaled down as a whole to fit. */
export const MAX_BUFFER = Object.freeze({ width: 1920, height: 1080 });

/** The cross-fade between two sets of stops: dyelot's base duration and standard easing. */
export const DEFAULT_FADE = Object.freeze({
  durationMs: 200,
  easing: Object.freeze([0.2, 0, 0, 1]),
});

/** A mid-gray noise whose alpha averages about 0.035; it names no color. */
export const GRAIN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0.07 0 0 0 0"/></filter><rect width="160" height="160" filter="url(#g)"/></svg>';

/** `GRAIN_SVG` as a CSS image. */
export const GRAIN_URL = `url("data:image/svg+xml,${encodeURIComponent(GRAIN_SVG)}")`;

/** @typedef {readonly string[]} FlavorStops five "#rrggbb", the count checked at run time */
/** @typedef {"no-webgl2" | "context-lost"} FallbackReason */
/** @typedef {{ durationMs: number, easing: readonly number[] }} Fade easing: four numbers, checked at run time */
/**
 * @typedef {{ stops: FlavorStops, seed: readonly number[], reducedMotion?: boolean, fade?: Fade,
 *   size?: { width: number, height: number }, autoplay?: boolean,
 *   onFallback?: (reason: FallbackReason) => void }} FlavorOptions
 */
/**
 * @typedef {{ setStops(stops: FlavorStops): void, setPaused(paused: boolean): void,
 *   drawAt(fraction: number): void, destroy(): void }} FlavorHandle
 */

/** One triangle that covers the view, drawn from `gl_VertexID` alone: no vertex buffer. */
export const VERTEX_SHADER = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

/**
 * The background: the noise field picks a place on the five stops, the colors mix in OKLab, the
 * `from` and `to` sets mix by `u_mix` for a cross-fade, and a fixed grain is added. Time enters
 * only as `u_phase`, so a draw at 0 and one at 2π are the same image.
 */
export const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_phase;
uniform vec2 u_seed;
uniform vec3 u_from[5];
uniform vec3 u_to[5];
uniform float u_mix;
uniform float u_grain;

out vec4 color;

// snoise: 2D simplex noise from webgl-noise (MIT), as published there. Its file's header and its
// LICENSE follow, copied from https://github.com/stegu/webgl-noise at 22434e04 (2025-04-27).

//
// Description : Array and textureless GLSL 2D simplex noise function.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : stegu
//     Lastmod : 20110822 (ijm)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//               https://github.com/stegu/webgl-noise
// 

/*
Copyright (C) 2011 by Ashima Arts (Simplex noise)
Copyright (C) 2011-2016 by Stefan Gustavson (Classic noise and others)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
  return mod289(((x*34.0)+10.0)*x);
}

float snoise(vec2 v)
  {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
// First corner
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);

// Other corners
  vec2 i1;
  //i1.x = step( x0.y, x0.x ); // x0.x > x0.y ? 1.0 : 0.0
  //i1.y = 1.0 - i1.x;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  // x0 = x0 - 0.0 + 0.0 * C.xx ;
  // x1 = x0 - i1 + 1.0 * C.xx ;
  // x2 = x0 - 1.0 + 2.0 * C.xx ;
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

// Permutations
  i = mod289(i); // Avoid truncation effects in permutation
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
		+ i.x + vec3(0.0, i1.x, 1.0 ));

  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;

// Gradients: 41 points uniformly over a line, mapped onto a diamond.
// The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

// Normalise gradients implicitly by scaling m
// Approximation of: m *= inversesqrt( a0*a0 + h*h );
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

// Compute final noise value at P
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// A value in [0, 1) per pixel, for the grain.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// The sRGB transfer of dyelot's engine, in both directions, the sign kept.
float decode(float c) {
  float m = abs(c);
  return sign(c) * (m <= 0.04045 ? m / 12.92 : pow((m + 0.055) / 1.055, 2.4));
}

float encode(float l) {
  float m = abs(l);
  return sign(l) * (m <= 0.0031308 ? 12.92 * m : 1.055 * pow(m, 1.0 / 2.4) - 0.055);
}

// OKLab's matrices, computed from the CSS Color 4 values dyelot's engine uses and written to 10
// significant digits. Each is written row by row, so v * M is the matrix times v.
const mat3 SRGB_TO_LMS = mat3(
  0.4122214695, 0.5363325373, 0.05144599327,
  0.2119034958, 0.6806995506, 0.1073969535,
  0.08830245919, 0.2817188391, 0.6299787017
);
const mat3 LMS_TO_OKLAB = mat3(
  0.2104542683, 0.7936177747, -0.004072043012,
  1.977998532, -2.428592242, 0.4505937096,
  0.02590404247, 0.7827717125, -0.8086757549
);
const mat3 OKLAB_TO_LMS = mat3(
  1.000000000, 0.3963377774, 0.2158037573,
  1.000000000, -0.1055613458, -0.06385417283,
  1.000000000, -0.08948417753, -1.291485548
);
const mat3 LMS_TO_SRGB = mat3(
  4.076741636, -3.307711539, 0.2309699032,
  -1.268437973, 2.609757349, -0.3413193760,
  -0.004196076139, -0.7034186179, 1.707614694
);

vec3 cbrt(vec3 v) {
  return sign(v) * pow(abs(v), vec3(1.0 / 3.0));
}

vec3 toOklab(vec3 srgb) {
  vec3 lms = vec3(decode(srgb.r), decode(srgb.g), decode(srgb.b)) * SRGB_TO_LMS;
  return cbrt(lms) * LMS_TO_OKLAB;
}

vec3 toSrgb(vec3 lab) {
  vec3 lms = lab * OKLAB_TO_LMS;
  vec3 lin = (lms * lms * lms) * LMS_TO_SRGB;
  return vec3(encode(lin.r), encode(lin.g), encode(lin.b));
}

void main() {
  // The field: three octaves, each sampled on a circle that turns a whole number of times a loop.
  vec2 p = gl_FragCoord.xy / u_resolution.y * 1.6 + u_seed;
  float n = clamp(0.5 + 0.5 * (
    0.55 * snoise(1.0 * p + 0.60 * vec2(cos(1.0 * u_phase), sin(1.0 * u_phase)))
    + 0.30 * snoise(2.0 * p + 0.40 * vec2(cos(2.0 * u_phase), sin(2.0 * u_phase)))
    + 0.15 * snoise(4.0 * p + 0.25 * vec2(cos(3.0 * u_phase), sin(3.0 * u_phase)))
  ), 0.0, 1.0);
  // The place on the five stops: segment k, and f along it.
  float k = min(3.0, floor(n * 4.0));
  float f = n * 4.0 - k;
  int i = int(k);
  // The OKLab mix along the segment, for both sets of stops, then between the sets.
  vec3 labFrom = mix(toOklab(u_from[i]), toOklab(u_from[i + 1]), f);
  vec3 labTo = mix(toOklab(u_to[i]), toOklab(u_to[i + 1]), f);
  vec3 rgb = toSrgb(mix(labFrom, labTo, u_mix));
  float grain = (hash(floor(gl_FragCoord.xy)) - 0.5) * u_grain;
  color = vec4(clamp(rgb + grain, 0.0, 1.0), 1.0);
}
`;

/**
 * The type of `value` as an error message names it: `null` and an array are not "object".
 * @param {unknown} value
 * @returns {string}
 */
function describeType(value) {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

/** A stop: `#rrggbb` in either case, or a `var(--name)` reference. */
const STOP = /^(?:#[0-9a-fA-F]{6}|var\(--[A-Za-z0-9_-]+\))$/;

/** The count of stops a flavor holds. */
const STOP_COUNT = 5;

/**
 * The still background (R5-20): the first stop as the color, and under the grain a gradient
 * through the five stops in OKLCH. Each stop is a `#rrggbb` hex or a `var(--name)` reference.
 * @param {readonly string[]} stops
 * @returns {{ backgroundColor: string, backgroundImage: string }}
 */
export function flavorBackground(stops) {
  if (!Array.isArray(stops)) {
    throw new TypeError(`flavorBackground: stops must be an array, got ${describeType(stops)}`);
  }
  for (const [index, stop] of stops.entries()) {
    if (typeof stop !== "string") {
      throw new TypeError(
        `flavorBackground: stops[${index}] must be a string, got ${describeType(stop)}`,
      );
    }
  }
  if (stops.length !== STOP_COUNT) {
    throw new RangeError(
      `flavorBackground: stops must hold ${STOP_COUNT} stops, got ${stops.length}`,
    );
  }
  for (const [index, stop] of stops.entries()) {
    if (!STOP.test(stop)) {
      throw new RangeError(
        `flavorBackground: stops[${index}] must be a six-digit hex or a var(--name) reference, got ${JSON.stringify(stop)}`,
      );
    }
  }
  const [a, b, c, d, e] = stops;
  return {
    backgroundColor: a,
    backgroundImage: `${GRAIN_URL}, linear-gradient(in oklch 135deg, ${a} 0%, ${b} 25%, ${c} 50%, ${d} 75%, ${e} 100%)`,
  };
}

/**
 * Throws a TypeError when `value` is not a number.
 * @param {unknown} value
 * @param {string} name
 * @returns {asserts value is number}
 */
function assertNumber(value, name) {
  if (typeof value !== "number") {
    throw new TypeError(`${name} must be a number, got ${describeType(value)}`);
  }
}

/**
 * The drawing buffer for a canvas of `cssWidth` by `cssHeight` CSS pixels (R5-18): its size times
 * the device pixel ratio, capped at `MAX_DPR`, then scaled down as a whole to fit `MAX_BUFFER`;
 * each side rounded, and at least 1.
 * @param {number} cssWidth
 * @param {number} cssHeight
 * @param {number} dpr
 * @returns {{ width: number, height: number }}
 */
export function bufferSize(cssWidth, cssHeight, dpr) {
  assertNumber(cssWidth, "bufferSize: cssWidth");
  assertNumber(cssHeight, "bufferSize: cssHeight");
  assertNumber(dpr, "bufferSize: dpr");
  if (!(Number.isFinite(cssWidth) && cssWidth >= 0)) {
    throw new RangeError(`bufferSize: cssWidth must be finite and at least 0, got ${cssWidth}`);
  }
  if (!(Number.isFinite(cssHeight) && cssHeight >= 0)) {
    throw new RangeError(`bufferSize: cssHeight must be finite and at least 0, got ${cssHeight}`);
  }
  if (!(Number.isFinite(dpr) && dpr > 0)) {
    throw new RangeError(`bufferSize: dpr must be finite and above 0, got ${dpr}`);
  }
  // Adding 0 turns -0 into 0, so a side of 0 divides into +Infinity, never -Infinity.
  const width = cssWidth + 0;
  const height = cssHeight + 0;
  // The ratio and the fit as one factor, chosen before any multiplication, so no product overflows.
  const scale = Math.min(dpr, MAX_DPR, MAX_BUFFER.width / width, MAX_BUFFER.height / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** How close the solved x lies to the asked x. */
const EASE_TOLERANCE = 1e-6;

/** Bisection halves the interval at most this often; 2^-64 is far below the tolerance. */
const EASE_STEPS = 64;

/**
 * One coordinate of the cubic Bézier from 0 to 1 with inner control values `p1` and `p2`, at `t`.
 * @param {number} p1
 * @param {number} p2
 * @param {number} t
 */
function bezier(p1, p2, t) {
  const u = 1 - t;
  return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
}

/**
 * The `cubic-bezier(x1, y1, x2, y2)` easing's value at `x` (R5-18): `t` is found by bisection
 * until the curve's x lies within 1e-6 of `x`, and the curve's y at `t` is returned; 0 gives 0
 * and 1 gives 1 exactly.
 * @param {readonly number[]} easing `[x1, y1, x2, y2]`, x1 and x2 in [0, 1]
 * @param {number} x in [0, 1]
 * @returns {number}
 */
export function easeAt(easing, x) {
  if (!Array.isArray(easing)) {
    throw new TypeError(`easeAt: easing must be an array, got ${describeType(easing)}`);
  }
  for (const [index, value] of easing.entries()) assertNumber(value, `easeAt: easing[${index}]`);
  assertNumber(x, "easeAt: x");
  if (easing.length !== 4) {
    throw new RangeError(`easeAt: easing must hold 4 numbers, got ${easing.length}`);
  }
  for (const [index, value] of easing.entries()) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`easeAt: easing[${index}] must be finite, got ${value}`);
    }
  }
  const [x1, y1, x2, y2] = easing;
  if (x1 < 0 || x1 > 1) throw new RangeError(`easeAt: easing[0] must lie in [0, 1], got ${x1}`);
  if (x2 < 0 || x2 > 1) throw new RangeError(`easeAt: easing[2] must lie in [0, 1], got ${x2}`);
  if (!(x >= 0 && x <= 1)) throw new RangeError(`easeAt: x must lie in [0, 1], got ${x}`);
  if (x === 0) return 0;
  if (x === 1) return 1;
  let low = 0;
  let high = 1;
  let t = x;
  for (let step = 0; step < EASE_STEPS; step += 1) {
    t = (low + high) / 2;
    const at = bezier(x1, x2, t);
    if (Math.abs(at - x) < EASE_TOLERANCE) break;
    if (at < x) low = t;
    else high = t;
  }
  return bezier(y1, y2, t);
}

/** The media query of the OS setting the runtime follows. */
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/** The most one frame adds to the run time, in seconds, so a stalled tab never jumps. */
const MAX_STEP = 0.1;

/** A stop the runtime draws: `#rrggbb` in either case. */
const HEX = /^#[0-9a-fA-F]{6}$/;

/** The keys `mountFlavor` reads; any other is a RangeError. */
const OPTION_KEYS = ["stops", "seed", "reducedMotion", "fade", "size", "autoplay", "onFallback"];

/** The sides of a fixed drawing buffer (`size`), at least and at most. */
const MIN_SIDE = 2;
const MAX_SIDE = 4096;

/** The attributes the runtime writes on its canvas. */
const ATTRIBUTES = ["data-flavor", "data-flavor-reason", "data-flavor-stops"];

/** @typedef {"running" | "paused" | "offscreen" | "hidden" | "still" | "fallback"} FlavorState */
/**
 * @typedef {{ stops: readonly string[], seed: readonly number[], reducedMotion: boolean,
 *   fade: Fade, size: { width: number, height: number } | null, autoplay: boolean,
 *   onFallback: ((reason: FallbackReason) => void) | null }} Settings
 */
/**
 * @typedef {{ draw(phase: number, from: number[], to: number[], mix: number): void }} Renderer
 */

/**
 * Whether `value` is an object that is neither null nor an array.
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Throws a TypeError when `value` is not an object, or is null or an array.
 * @param {unknown} value
 * @param {string} name
 * @returns {asserts value is Record<string, unknown>}
 */
function assertRecord(value, name) {
  if (!isRecord(value)) {
    throw new TypeError(`${name} must be an object, got ${describeType(value)}`);
  }
}

/**
 * Throws a TypeError when `value` is not an array of strings.
 * @param {unknown} value
 * @param {string} name
 * @returns {asserts value is readonly string[]}
 */
function assertStrings(value, name) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array, got ${describeType(value)}`);
  }
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string") {
      throw new TypeError(`${name}[${index}] must be a string, got ${describeType(item)}`);
    }
  }
}

/**
 * Throws a TypeError when `value` is not an array of numbers.
 * @param {unknown} value
 * @param {string} name
 * @returns {asserts value is readonly number[]}
 */
function assertNumbers(value, name) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array, got ${describeType(value)}`);
  }
  for (const [index, item] of value.entries()) assertNumber(item, `${name}[${index}]`);
}

/**
 * Throws a TypeError when `value` is present and not a boolean.
 * @param {unknown} value
 * @param {string} name
 * @returns {asserts value is boolean | undefined}
 */
function assertOptionalBoolean(value, name) {
  if (value !== undefined && typeof value !== "boolean") {
    throw new TypeError(`${name} must be a boolean, got ${describeType(value)}`);
  }
}

/**
 * Throws a RangeError unless `stops` holds five `#rrggbb` stops.
 * @param {readonly string[]} stops
 * @param {string} name
 */
function checkStops(stops, name) {
  if (stops.length !== STOP_COUNT) {
    throw new RangeError(`${name} must hold ${STOP_COUNT} stops, got ${stops.length}`);
  }
  for (const [index, stop] of stops.entries()) {
    if (!HEX.test(stop)) {
      throw new RangeError(
        `${name}[${index}] must be a six-digit hex, got ${JSON.stringify(stop)}`,
      );
    }
  }
}

/**
 * Throws a RangeError unless `values` holds `count` finite numbers.
 * @param {readonly number[]} values
 * @param {number} count
 * @param {string} name
 */
function checkFinite(values, count, name) {
  if (values.length !== count) {
    throw new RangeError(`${name} must hold ${count} numbers, got ${values.length}`);
  }
  for (const [index, value] of values.entries()) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`${name}[${index}] must be finite, got ${value}`);
    }
  }
}

/**
 * `mountFlavor`'s arguments, checked (section 5.2 of dyelot's motion spec): every type first,
 * then every domain.
 * @param {unknown} canvas
 * @param {unknown} options
 * @returns {Settings}
 */
function readOptions(canvas, options) {
  if (typeof HTMLCanvasElement !== "function" || !(canvas instanceof HTMLCanvasElement)) {
    throw new TypeError(
      `mountFlavor: canvas must be a canvas element, got ${describeType(canvas)}`,
    );
  }
  assertRecord(options, "mountFlavor: options");
  const { stops, seed, reducedMotion, fade, size, autoplay, onFallback } = options;
  assertStrings(stops, "mountFlavor: options.stops");
  assertNumbers(seed, "mountFlavor: options.seed");
  assertOptionalBoolean(reducedMotion, "mountFlavor: options.reducedMotion");
  assertOptionalBoolean(autoplay, "mountFlavor: options.autoplay");
  /** @type {Fade} */
  let fadeOption = DEFAULT_FADE;
  if (fade !== undefined) {
    assertRecord(fade, "mountFlavor: options.fade");
    const { durationMs, easing } = fade;
    assertNumber(durationMs, "mountFlavor: options.fade.durationMs");
    assertNumbers(easing, "mountFlavor: options.fade.easing");
    fadeOption = { durationMs, easing: [...easing] };
  }
  /** @type {{ width: number, height: number } | null} */
  let sizeOption = null;
  if (size !== undefined) {
    assertRecord(size, "mountFlavor: options.size");
    const { width, height } = size;
    assertNumber(width, "mountFlavor: options.size.width");
    assertNumber(height, "mountFlavor: options.size.height");
    sizeOption = { width, height };
  }
  if (onFallback !== undefined && typeof onFallback !== "function") {
    throw new TypeError(
      `mountFlavor: options.onFallback must be a function, got ${describeType(onFallback)}`,
    );
  }
  for (const key of Object.keys(options)) {
    if (!OPTION_KEYS.includes(key)) {
      throw new RangeError(
        `mountFlavor: options.${key} is not an option; the options are ${OPTION_KEYS.join(", ")}`,
      );
    }
  }
  checkStops(stops, "mountFlavor: options.stops");
  checkFinite(seed, 2, "mountFlavor: options.seed");
  const { durationMs, easing } = fadeOption;
  if (!(Number.isFinite(durationMs) && durationMs >= 0)) {
    throw new RangeError(
      `mountFlavor: options.fade.durationMs must be finite and at least 0, got ${durationMs}`,
    );
  }
  checkFinite(easing, 4, "mountFlavor: options.fade.easing");
  for (const index of [0, 2]) {
    if (easing[index] < 0 || easing[index] > 1) {
      throw new RangeError(
        `mountFlavor: options.fade.easing[${index}] must lie in [0, 1], got ${easing[index]}`,
      );
    }
  }
  if (sizeOption !== null) {
    for (const [side, value] of Object.entries(sizeOption)) {
      if (!(Number.isInteger(value) && value >= MIN_SIDE && value <= MAX_SIDE)) {
        throw new RangeError(
          `mountFlavor: options.size.${side} must be a whole number from ${MIN_SIDE} to ${MAX_SIDE}, got ${value}`,
        );
      }
    }
  }
  return {
    stops: [...stops],
    seed: [...seed],
    reducedMotion: reducedMotion === true,
    fade: fadeOption,
    size: sizeOption,
    autoplay: autoplay !== false,
    onFallback: /** @type {((reason: FallbackReason) => void) | undefined} */ (onFallback) ?? null,
  };
}

// The shader's OKLab matrices, row by row, so a cross-fade that starts mid-fade starts from the
// colors on screen: the runtime mixes them as FRAGMENT_SHADER does.
const SRGB_TO_LMS = [
  [0.4122214695, 0.5363325373, 0.05144599327],
  [0.2119034958, 0.6806995506, 0.1073969535],
  [0.08830245919, 0.2817188391, 0.6299787017],
];
const LMS_TO_OKLAB = [
  [0.2104542683, 0.7936177747, -0.004072043012],
  [1.977998532, -2.428592242, 0.4505937096],
  [0.02590404247, 0.7827717125, -0.8086757549],
];
const OKLAB_TO_LMS = [
  [1.0, 0.3963377774, 0.2158037573],
  [1.0, -0.1055613458, -0.06385417283],
  [1.0, -0.08948417753, -1.291485548],
];
const LMS_TO_SRGB = [
  [4.076741636, -3.307711539, 0.2309699032],
  [-1.268437973, 2.609757349, -0.341319376],
  [-0.004196076139, -0.7034186179, 1.707614694],
];

/**
 * The matrix `m` times `v`.
 * @param {readonly (readonly number[])[]} m
 * @param {readonly number[]} v
 * @returns {number[]}
 */
function times(m, v) {
  return m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
}

/**
 * The sRGB decode of the shader, the sign kept.
 * @param {number} c
 */
function decode(c) {
  const m = Math.abs(c);
  return Math.sign(c) * (m <= 0.04045 ? m / 12.92 : ((m + 0.055) / 1.055) ** 2.4);
}

/**
 * The sRGB encode of the shader, the sign kept.
 * @param {number} l
 */
function encode(l) {
  const m = Math.abs(l);
  return Math.sign(l) * (m <= 0.0031308 ? 12.92 * m : 1.055 * m ** (1 / 2.4) - 0.055);
}

/**
 * Five stops as the shader's uniforms take them: each stop's channels over 255, stop after stop.
 * @param {readonly string[]} stops `#rrggbb`
 * @returns {number[]}
 */
function colorsOf(stops) {
  return stops.flatMap((hex) =>
    [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255),
  );
}

/**
 * The colors a cross-fade shows at `amount`: each color of `from` mixed in OKLab with the same
 * color of `to`, as the shader mixes them.
 * @param {number[]} from
 * @param {number[]} to
 * @param {number} amount
 * @returns {number[]}
 */
function mixColors(from, to, amount) {
  if (amount >= 1) return to;
  if (amount <= 0) return from;
  /** @type {number[]} */
  const mixed = [];
  for (let at = 0; at < from.length; at += 3) {
    const a = times(
      LMS_TO_OKLAB,
      times(SRGB_TO_LMS, from.slice(at, at + 3).map(decode)).map(Math.cbrt),
    );
    const b = times(
      LMS_TO_OKLAB,
      times(SRGB_TO_LMS, to.slice(at, at + 3).map(decode)).map(Math.cbrt),
    );
    const lms = times(
      OKLAB_TO_LMS,
      a.map((value, index) => value + (b[index] - value) * amount),
    );
    mixed.push(
      ...times(
        LMS_TO_SRGB,
        lms.map((value) => value * value * value),
      ).map(encode),
    );
  }
  return mixed;
}

/**
 * The canvas's WebGL2 context, or null where there is none or asking throws. With `autoplay`
 * false it asks to keep the drawing buffer, which a recording reads after each `drawAt`.
 * @param {HTMLCanvasElement} canvas
 * @param {boolean} autoplay
 * @returns {WebGL2RenderingContext | null}
 */
function contextOf(canvas, autoplay) {
  /** @type {WebGLContextAttributes} */
  const attributes = { antialias: false, depth: false };
  if (!autoplay) attributes.preserveDrawingBuffer = true;
  try {
    return canvas.getContext("webgl2", attributes);
  } catch {
    return null;
  }
}

/**
 * The program of the two shader texts, or null when either does not compile or it does not link.
 * @param {WebGL2RenderingContext} gl
 * @returns {WebGLProgram | null}
 */
function linkProgram(gl) {
  const program = gl.createProgram();
  if (program === null) return null;
  /** @type {[number, string][]} */
  const sources = [
    [gl.VERTEX_SHADER, VERTEX_SHADER],
    [gl.FRAGMENT_SHADER, FRAGMENT_SHADER],
  ];
  for (const [type, source] of sources) {
    const shader = gl.createShader(type);
    if (shader === null) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

/**
 * The GL half of the runtime: `program` in use with one empty vertex array bound, and one draw
 * that uploads every uniform and draws the triangle.
 * @param {WebGL2RenderingContext} gl
 * @param {WebGLProgram} program
 * @param {HTMLCanvasElement} canvas
 * @param {readonly number[]} seed
 * @returns {Renderer}
 */
function createRenderer(gl, program, canvas, seed) {
  /** @param {string} name */
  const uniform = (name) => gl.getUniformLocation(program, name);
  const resolution = uniform("u_resolution");
  const phaseAt = uniform("u_phase");
  const seedAt = uniform("u_seed");
  const fromAt = uniform("u_from");
  const toAt = uniform("u_to");
  const mixAt = uniform("u_mix");
  const grainAt = uniform("u_grain");
  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram is not a React hook.
  gl.useProgram(program);
  gl.bindVertexArray(gl.createVertexArray());
  return {
    draw(phase, from, to, mix) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(phaseAt, phase);
      gl.uniform2f(seedAt, seed[0], seed[1]);
      gl.uniform3fv(fromAt, from);
      gl.uniform3fv(toAt, to);
      gl.uniform1f(mixAt, mix);
      gl.uniform1f(grainAt, GRAIN);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}

/**
 * Whether this browser gives a WebGL2 context: a scratch canvas asks for one and releases it.
 * @returns {boolean}
 */
export function supportsFlavor() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (gl === null) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * Mounts the animated background on `canvas` and returns its handle (R5-18, R5-19, R5-21). The
 * state shows on the canvas as `data-flavor`, the first that holds of `fallback`, `still`,
 * `paused`, `hidden`, `offscreen` and `running`; only `running` loops. Where WebGL2 is missing, a
 * shader fails or the context is lost, the canvas shows `flavorBackground(stops)` and
 * `onFallback` hears the reason, once; nothing is ever logged.
 * @param {HTMLCanvasElement} canvas
 * @param {FlavorOptions} options
 * @returns {FlavorHandle}
 */
export function mountFlavor(canvas, options) {
  const settings = readOptions(canvas, options);
  const { fade, size, onFallback } = settings;
  /** The stops asked for last, which `data-flavor-stops` names. */
  let target = settings.stops;
  /** The two sets of colors the shader mixes by `mix`; a fade moves `mix` from 0 to 1. */
  let from = colorsOf(target);
  let to = from;
  let mix = 1;
  /** @type {number | null} When the fade under way started, by `performance.now()`, or null. */
  let fadeStart = null;
  /** What the last draw showed: a new fade starts from its colors. */
  let shown = { from, to, mix, phase: 0 };
  /** The run time in seconds, which only `running` advances, and the last frame's timestamp. */
  let time = 0;
  let last = 0;
  /** @type {number | null} */
  let frame = null;
  let paused = !settings.autoplay;
  let hidden = false;
  let offscreen = false;
  let reducedBySystem = false;
  /** @type {FallbackReason | null} */
  let reason = null;
  /** @type {FlavorState | null} */
  let state = null;
  let destroyed = false;
  /** @type {MediaQueryList | null} */
  let motion = null;
  /** @type {IntersectionObserver | null} */
  let intersection = null;
  /** @type {ResizeObserver | null} */
  let resizer = null;

  canvas.setAttribute("data-flavor-stops", target.join(",").toLowerCase());
  if (size !== null) {
    canvas.width = size.width;
    canvas.height = size.height;
  }
  const gl = contextOf(canvas, settings.autoplay);
  const lose = gl === null ? null : gl.getExtension("WEBGL_lose_context");
  const program = gl === null ? null : linkProgram(gl);
  const renderer =
    gl === null || program === null ? null : createRenderer(gl, program, canvas, settings.seed);

  /** @returns {FlavorState} */
  function currentState() {
    if (reason !== null) return "fallback";
    if (settings.reducedMotion || reducedBySystem) return "still";
    if (paused) return "paused";
    if (hidden) return "hidden";
    if (offscreen) return "offscreen";
    return "running";
  }

  /** @param {number} phase */
  function draw(phase) {
    if (renderer === null) return;
    renderer.draw(phase, from, to, mix);
    shown = { from, to, mix, phase };
  }

  /** Ends a fade at its target. */
  function settle() {
    fadeStart = null;
    from = to;
    mix = 1;
  }

  /**
   * One frame: the run time and the fade move on, then one draw, then the next request.
   * @param {number} now
   */
  function tick(now) {
    time += Math.min(Math.max((now - last) / 1000, 0), MAX_STEP);
    last = now;
    if (fadeStart !== null) {
      const progress = (now - fadeStart) / fade.durationMs;
      if (progress >= 1) settle();
      else mix = easeAt(fade.easing, Math.max(progress, 0));
    }
    draw((2 * Math.PI * (time % LOOP_SECONDS)) / LOOP_SECONDS);
    frame = requestAnimationFrame(tick);
  }

  function stopFrames() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }

  /** Moves to the state that holds now, writing it on the canvas. */
  function refresh() {
    const next = currentState();
    if (next === state) return;
    const previous = state;
    state = next;
    canvas.setAttribute("data-flavor", next);
    if (previous === "running") stopFrames();
    if (next === "fallback") return;
    if (next === "still") {
      settle();
      time = 0;
      draw(0);
    } else if (previous === null || (previous === "running" && fadeStart !== null)) {
      settle();
      draw(shown.phase);
    }
    if (next === "running") {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  /** Paints the still gradient of the target stops as the canvas's own background. */
  function paint() {
    const { backgroundColor, backgroundImage } = flavorBackground(target);
    canvas.style.backgroundColor = backgroundColor;
    canvas.style.backgroundImage = backgroundImage;
  }

  /** @param {FallbackReason} why */
  function fallBack(why) {
    if (reason !== null) return;
    reason = why;
    canvas.setAttribute("data-flavor-reason", why);
    paint();
    refresh();
    onFallback?.(why);
  }

  /** @param {Event} event */
  function onLost(event) {
    event.preventDefault();
    fallBack("context-lost");
  }

  function onVisibility() {
    hidden = document.visibilityState === "hidden";
    refresh();
  }

  /** @param {{ matches: boolean }} event */
  function onMotion(event) {
    reducedBySystem = event.matches;
    refresh();
  }

  /** @param {IntersectionObserverEntry[]} entries */
  function onIntersect(entries) {
    const entry = entries[entries.length - 1];
    if (entry === undefined) return;
    offscreen = !entry.isIntersecting;
    refresh();
  }

  /** Sets the drawing buffer from the canvas's CSS size; true when it changed. */
  function fitBuffer() {
    const next = bufferSize(
      canvas.clientWidth,
      canvas.clientHeight,
      globalThis.devicePixelRatio || 1,
    );
    if (next.width === canvas.width && next.height === canvas.height) return false;
    canvas.width = next.width;
    canvas.height = next.height;
    return true;
  }

  function onResize() {
    if (fitBuffer() && state !== "fallback") draw(shown.phase);
  }

  /** @type {FlavorHandle} */
  const handle = {
    setStops(stops) {
      assertStrings(stops, "setStops: stops");
      checkStops(stops, "setStops: stops");
      if (destroyed) return;
      target = [...stops];
      canvas.setAttribute("data-flavor-stops", target.join(",").toLowerCase());
      if (state === "fallback") {
        paint();
        return;
      }
      if (state === "running" && fade.durationMs > 0) {
        from = mixColors(shown.from, shown.to, shown.mix);
        to = colorsOf(target);
        mix = 0;
        fadeStart = performance.now();
        return;
      }
      to = colorsOf(target);
      settle();
      if (state !== "running") draw(shown.phase);
    },
    setPaused(next) {
      if (typeof next !== "boolean") {
        throw new TypeError(`setPaused: paused must be a boolean, got ${describeType(next)}`);
      }
      if (destroyed) return;
      paused = next;
      refresh();
    },
    drawAt(fraction) {
      assertNumber(fraction, "drawAt: fraction");
      if (!(fraction >= 0 && fraction <= 1)) {
        throw new RangeError(`drawAt: fraction must lie in [0, 1], got ${fraction}`);
      }
      if (destroyed || state === "fallback") return;
      settle();
      paused = true;
      refresh();
      time = fraction * LOOP_SECONDS;
      draw(2 * Math.PI * fraction);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stopFrames();
      canvas.removeEventListener("webglcontextlost", onLost);
      document.removeEventListener("visibilitychange", onVisibility);
      motion?.removeEventListener("change", onMotion);
      intersection?.disconnect();
      resizer?.disconnect();
      if (gl !== null && lose !== null && !gl.isContextLost()) lose.loseContext();
      for (const name of ATTRIBUTES) canvas.removeAttribute(name);
    },
  };

  if (renderer === null) {
    fallBack("no-webgl2");
    return handle;
  }
  canvas.addEventListener("webglcontextlost", onLost);
  document.addEventListener("visibilitychange", onVisibility);
  motion = matchMedia(REDUCE_QUERY);
  motion.addEventListener("change", onMotion);
  intersection = new IntersectionObserver(onIntersect, { threshold: 0 });
  intersection.observe(canvas);
  if (size === null) {
    resizer = new ResizeObserver(onResize);
    resizer.observe(canvas);
    fitBuffer();
  }
  hidden = document.visibilityState === "hidden";
  reducedBySystem = motion.matches;
  refresh();
  return handle;
}
