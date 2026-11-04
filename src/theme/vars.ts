import {
  DEFICIENCIES,
  DEPTH_STYLES,
  type Deficiency,
  type Density,
  FONT_CATALOG,
  fontStack,
  formatOklch,
  type Hex,
  hexToRgb,
  MOTION_FEELS,
  type Mode,
  PALETTE_NAMES,
  ROLE_NAMES,
  STEPS,
  simulate,
  toHex,
  typeWeights,
} from "@/engine";
import type { DesignSpec } from "@/spec";

// The theme bridge (spec section 5.6, R2-08, R2-12): a design spec as CSS custom properties. Pure:
// no DOM, no storage, no network. M3's `theme.css` export reuses `themeVars`.

export type ThemeVars = Readonly<Record<string, string>>;

const MODES: readonly Mode[] = ["light", "dark"];
const UNITS: readonly string[] = ["vw", "cqi"];
const STEP_NAMES = [
  "caption",
  "label",
  "body-sm",
  "body",
  "lead",
  "h4",
  "h3",
  "h2",
  "h1",
  "display",
] as const;
const SPACE_UNITS = [0, 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32] as const;
const RADII = ["sm", "md", "lg", "xl", "2xl"] as const;
const DURATIONS = ["instant", "fast", "quick", "base", "slow", "slower", "slowest"] as const;
const EASINGS = ["standard", "decelerate", "accelerate", "emphasized"] as const;
const ELEVATIONS = [1, 2, 3, 4, 5] as const;
const DENSITIES: Readonly<Record<Density, ThemeVars>> = Object.freeze({
  comfortable: Object.freeze({ "--density-offset": "0px", "--control-height": "40px" }),
  compact: Object.freeze({ "--density-offset": "-4px", "--control-height": "36px" }),
  dense: Object.freeze({ "--density-offset": "-8px", "--control-height": "32px" }),
});
const HEX = /^#[0-9a-f]{6}$/;
const FAMILY_ID = /^[a-z0-9-]{1,64}$/;
const FORBIDDEN = /[;{}<]/;
const MOTION_CAP_MS = 500;
const CALM_FACTOR = 1.25;
const LAYERED_FACTOR = 1.5;

const SPRING_OF_FEEL = { calm: "smooth", brisk: "snappy", playful: "bouncy" } as const;

/** The fallback stack of a category, read once from the catalog (C-THEME-08). */
function fallbackOf(category: "sans" | "mono"): string {
  const donor = FONT_CATALOG.find((font) => font.category === category);
  if (donor === undefined) {
    throw new RangeError(`themeVars: the font catalog has no ${category} entry`);
  }
  return donor.fallback;
}
const FALLBACK = Object.freeze({ sans: fallbackOf("sans"), mono: fallbackOf("mono") });

type Motion = DesignSpec["motion"];
type Layer = DesignSpec["depth"]["shadows"][1][0];

function kind(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function need(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`themeVars: ${label} must be an object, got ${kind(value)}`);
  }
  return value;
}

/** A finite number: a wrong type is a TypeError, NaN and Infinity a RangeError. */
function finite(value: unknown, label: string): number {
  if (typeof value !== "number") {
    throw new TypeError(`themeVars: ${label} must be a number, got ${kind(value)}`);
  }
  if (!Number.isFinite(value)) {
    throw new RangeError(`themeVars: ${label} must be finite, got ${value}`);
  }
  return value;
}

/** A finite number as CSS text: `String`, so `0.1` stays `0.1`. */
function num(value: unknown, label: string): string {
  return String(finite(value, label));
}

/** Six significant digits, as the generator rounds (`round6`), so a scaled layer stays tidy. */
function round6(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`themeVars: a scaled value must be finite, got ${value}`);
  }
  const rounded = Number(value.toPrecision(6));
  return rounded === 0 ? 0 : rounded;
}

function springOf(motion: Motion, who: string): { visualDuration: number; bounce: number } {
  if (!isRecord(motion)) {
    throw new TypeError(`${who}: motion must be an object, got ${kind(motion)}`);
  }
  if (typeof motion.feel !== "string") {
    throw new TypeError(`${who}: motion.feel must be a string, got ${kind(motion.feel)}`);
  }
  if (!MOTION_FEELS.includes(motion.feel)) {
    throw new RangeError(`${who}: unknown motion feel ${JSON.stringify(motion.feel)}`);
  }
  if (!isRecord(motion.springs)) {
    throw new TypeError(`${who}: motion.springs must be an object, got ${kind(motion.springs)}`);
  }
  const { visualDuration, bounce } = motion.springs[SPRING_OF_FEEL[motion.feel]];
  return { visualDuration, bounce };
}

/** The spring of a feel (R2-08): `calm` is smooth, `brisk` snappy, `playful` bouncy. */
export function feelSpring(motion: Motion): { visualDuration: number; bounce: number } {
  return springOf(motion, "feelSpring");
}

/** The view variables of a density (R2-07): the offset on spacing and the control height. */
export function densityVars(density: Density): ThemeVars {
  if (typeof density !== "string") {
    throw new TypeError(`densityVars: density must be a string, got ${kind(density)}`);
  }
  if (!Object.hasOwn(DENSITIES, density)) {
    throw new RangeError(`densityVars: unknown density ${JSON.stringify(density)}`);
  }
  return DENSITIES[density];
}

function hexOf(value: Hex | undefined, label: string): Hex {
  if (typeof value !== "string") {
    throw new TypeError(`themeVars: ${label} must be a string, got ${kind(value)}`);
  }
  if (!HEX.test(value)) {
    throw new RangeError(
      `themeVars: ${label} must be a lowercase #rrggbb hex, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function familyStack(id: unknown, label: string, category: "sans" | "mono"): string {
  if (typeof id !== "string") {
    throw new TypeError(`themeVars: ${label} must be a string, got ${kind(id)}`);
  }
  if (!FAMILY_ID.test(id)) {
    throw new RangeError(`themeVars: ${label} must match ${FAMILY_ID}, got ${JSON.stringify(id)}`);
  }
  // A valid id outside the catalog (a custom font): the category's fallback stack (C-THEME-08).
  return FONT_CATALOG.some((font) => font.id === id) ? fontStack(id) : FALLBACK[category];
}

function layerCss(layer: Layer, factor: number, capAlpha: boolean): string {
  const offsetY = finite(layer.offsetY, "shadow offsetY");
  const blur = finite(layer.blur, "shadow blur");
  const alpha = finite(layer.alpha, "shadow alpha");
  const scaledAlpha = round6(alpha * factor);
  const written = num(capAlpha ? Math.min(1, scaledAlpha) : scaledAlpha, "shadow alpha");
  const color = formatOklch(layer.color).replace(/\)$/, ` / ${written})`);
  return `0 ${num(round6(offsetY * factor), "shadow offsetY")}px ${num(round6(blur * factor), "shadow blur")}px 0 ${color}`;
}

function shadowVars(depth: DesignSpec["depth"], out: Record<string, string>): void {
  if (typeof depth.style !== "string") {
    throw new TypeError(`themeVars: depth.style must be a string, got ${kind(depth.style)}`);
  }
  if (!DEPTH_STYLES.includes(depth.style)) {
    throw new RangeError(`themeVars: unknown depth style ${JSON.stringify(depth.style)}`);
  }
  const layered = depth.style === "layered";
  const factor = layered ? LAYERED_FACTOR : 1;
  for (const level of ELEVATIONS) {
    const row = depth.shadows[level];
    if (!Array.isArray(row) || row.length !== 2) {
      throw new TypeError(
        `themeVars: depth.shadows[${level}] must hold 2 layers, got ${kind(row)}`,
      );
    }
    const [key, ambient] = row;
    out[`--shadow-${level}`] =
      depth.style === "flat"
        ? "none"
        : `${layerCss(key, factor, layered)}, ${layerCss(ambient, factor, layered)}`;
  }
}

function durationMs(stored: unknown, feel: Motion["feel"], label: string): string {
  const base = finite(stored, label);
  const scaled = feel === "calm" ? base * CALM_FACTOR : base;
  // `Math.round` sends a tie up, as R2-08 asks.
  return `${Math.min(MOTION_CAP_MS, Math.round(scaled))}ms`;
}

function checkInputs(
  spec: unknown,
  mode: unknown,
  options: unknown,
): { mode: Mode; vision: Deficiency | undefined; units: "vw" | "cqi" } {
  if (typeof mode !== "string") {
    throw new TypeError(`themeVars: mode must be a string, got ${kind(mode)}`);
  }
  if (!MODES.includes(mode as Mode)) {
    throw new RangeError(`themeVars: mode must be light or dark, got ${JSON.stringify(mode)}`);
  }
  if (options !== undefined && !isRecord(options)) {
    throw new TypeError(`themeVars: options must be an object, got ${kind(options)}`);
  }
  const { vision, units = "vw" } = (options ?? {}) as { vision?: unknown; units?: unknown };
  if (vision !== undefined) {
    if (typeof vision !== "string") {
      throw new TypeError(`themeVars: options.vision must be a string, got ${kind(vision)}`);
    }
    if (!DEFICIENCIES.includes(vision as Deficiency)) {
      throw new RangeError(`themeVars: unknown options.vision ${JSON.stringify(vision)}`);
    }
  }
  if (typeof units !== "string") {
    throw new TypeError(`themeVars: options.units must be a string, got ${kind(units)}`);
  }
  if (!UNITS.includes(units)) {
    throw new RangeError(
      `themeVars: options.units must be vw or cqi, got ${JSON.stringify(units)}`,
    );
  }
  need(need(need(spec, "spec").color, "spec.color").roles, "spec.color.roles");
  return {
    mode: mode as Mode,
    vision: vision as Deficiency | undefined,
    units: units as "vw" | "cqi",
  };
}

/**
 * The CSS custom properties of a spec for one mode: 207 names in the order of section 5.6 and R3-06, frozen.
 * Colors are the stored hexes, or their color-vision simulation when `options.vision` is set.
 * `options.units` `cqi` writes the fluid display size against the canvas frame (R2-12). Depth
 * style and motion feel are applied here (R2-08). Every value is validated before it is emitted,
 * so a bad spec never reaches a style attribute.
 */
export function themeVars(
  spec: DesignSpec,
  mode: Mode,
  options?: { vision?: Deficiency; units?: "vw" | "cqi" },
): ThemeVars {
  const checked = checkInputs(spec, mode, options);
  const out: Record<string, string> = {};
  const color = (hex: Hex | undefined, label: string): string => {
    const stored = hexOf(hex, label);
    return checked.vision === undefined
      ? stored
      : toHex(simulate(hexToRgb(stored), checked.vision));
  };

  const roles = spec.color.roles[mode];
  need(roles, `spec.color.roles.${mode}`);
  for (const role of ROLE_NAMES) out[`--${role}`] = color(roles[role], `role ${role}`);

  need(spec.type, "spec.type");
  need(spec.space, "spec.space");
  need(spec.shape, "spec.shape");
  need(spec.depth, "spec.depth");
  need(spec.motion, "spec.motion");
  need(spec.components, "spec.components");
  need(spec.color.palettes, "spec.color.palettes");
  for (const palette of PALETTE_NAMES) {
    need(spec.color.palettes[palette], `palette ${palette}`);
    const scale = spec.color.palettes[palette][mode];
    if (!Array.isArray(scale) || scale.length !== STEPS.length) {
      throw new TypeError(
        `themeVars: palette ${palette} ${mode} must hold ${STEPS.length} steps, got ${Array.isArray(scale) ? scale.length : kind(scale)}`,
      );
    }
    STEPS.forEach((step, index) => {
      const entry = scale[index];
      need(entry, `palette ${palette} step ${step}`);
      if (entry.step !== step) {
        throw new RangeError(
          `themeVars: palette ${palette} ${mode} entry ${index} must be step ${step}, got ${JSON.stringify(entry.step)}`,
        );
      }
      out[`--${palette}-${step}`] = color(entry.hex, `scale step ${palette}-${step}`);
    });
  }

  const steps = spec.type.steps;
  if (!Array.isArray(steps) || steps.length !== STEP_NAMES.length) {
    throw new TypeError(
      `themeVars: spec.type.steps must hold ${STEP_NAMES.length} steps, got ${Array.isArray(steps) ? steps.length : kind(steps)}`,
    );
  }
  STEP_NAMES.forEach((name, index) => {
    const step = steps[index];
    need(step, `type step ${name}`);
    if (step.name !== name) {
      throw new RangeError(
        `themeVars: type step ${index} must be ${name}, got ${JSON.stringify(step.name)}`,
      );
    }
    let size = `${num(step.sizePx, `type step ${name} size`)}px`;
    if (name === "display" && step.clamp !== undefined) {
      if (typeof step.clamp !== "string") {
        throw new TypeError(`themeVars: display clamp must be a string, got ${kind(step.clamp)}`);
      }
      size = checked.units === "cqi" ? step.clamp.replaceAll("vw", "cqi") : step.clamp;
    }
    out[`--text-${name}`] = size;
    out[`--leading-${name}`] = `${num(step.lineHeightPx, `type step ${name} line height`)}px`;
    out[`--tracking-${name}`] = `${num(step.trackingEm, `type step ${name} tracking`)}em`;
  });

  const { families } = spec.type;
  out["--font-display"] = familyStack(families.display, "type.families.display", "sans");
  out["--font-body"] = familyStack(families.body, "type.families.body", "sans");
  out["--font-mono"] = familyStack(families.mono, "type.families.mono", "mono");

  const weights = typeWeights(spec);
  out["--weight-heading"] = String(weights.heading);
  out["--weight-label"] = String(weights.label);
  out["--weight-body"] = String(weights.body);

  SPACE_UNITS.forEach((unit, index) => {
    out[`--space-${unit}`] = `${num(spec.space.scale[index], `space unit ${unit}`)}px`;
  });

  for (const name of RADII)
    out[`--radius-${name}`] = `${num(spec.shape.radii[name], `radius ${name}`)}px`;
  out["--radius-full"] = `${num(spec.shape.radii.full, "radius full")}px`;

  shadowVars(spec.depth, out);

  for (const name of DURATIONS) {
    out[`--duration-${name}`] = durationMs(
      spec.motion.durations[name],
      spec.motion.feel,
      `duration ${name}`,
    );
  }
  for (const name of EASINGS) {
    const easing: unknown = spec.motion.easings[name];
    if (!Array.isArray(easing)) {
      throw new TypeError(`themeVars: easing ${name} must be an array, got ${kind(easing)}`);
    }
    if (easing.length !== 4) {
      throw new RangeError(`themeVars: easing ${name} must hold 4 numbers, got ${easing.length}`);
    }
    const points = easing.map((p, i) => num(p, `easing ${name}[${i}]`));
    out[`--ease-${name}`] = `cubic-bezier(${points.join(", ")})`;
  }

  const spring = springOf(spec.motion, "themeVars");
  out["--spring-duration"] = num(spring.visualDuration, "spring duration");
  out["--spring-bounce"] = num(spring.bounce, "spring bounce");

  out["--icon-stroke"] = num(spec.components.icons.strokePx, "icon stroke");

  for (const [name, value] of Object.entries(out)) {
    if (FORBIDDEN.test(value)) {
      throw new RangeError(
        `themeVars: ${name} holds a forbidden character: ${JSON.stringify(value)}`,
      );
    }
  }
  return Object.freeze(out);
}
