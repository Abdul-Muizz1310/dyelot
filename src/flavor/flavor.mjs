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
