import {
  DEFICIENCIES,
  type Deficiency,
  FONT_CATALOG,
  fontStack,
  formatOklch,
  type Hex,
  hexToRgb,
  PALETTE_NAMES,
  ROLE_NAMES,
  STEPS,
  simulate,
  toHex,
} from "@/engine";
import type { DesignSpec } from "@/spec";

// The theme bridge (spec section 5.6, R2-08, R2-12): a design spec as CSS custom properties. Pure:
// no DOM, no storage, no network. M3's `theme.css` export reuses `themeVars`.

export type Mode = "light" | "dark";
export type ThemeVars = Readonly<Record<string, string>>;
export type ThemeOptions = { vision?: Deficiency; units?: "vw" | "cqi" };

const MODES: readonly Mode[] = ["light", "dark"];
const UNITS: readonly string[] = ["vw", "cqi"];
const SPACE_UNITS = [0, 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32] as const;
const RADII = ["sm", "md", "lg", "xl", "2xl"] as const;
const DURATIONS = ["instant", "fast", "quick", "base", "slow", "slower", "slowest"] as const;
const EASINGS = ["standard", "decelerate", "accelerate", "emphasized"] as const;
const ELEVATIONS = [1, 2, 3, 4, 5] as const;
const HEX = /^#[0-9a-f]{6}$/;
const FAMILY_ID = /^[a-z0-9-]{1,64}$/;
const FORBIDDEN = /[;{}<]/;
const MOTION_CAP_MS = 500;
const CALM_FACTOR = 1.25;
const LAYERED_FACTOR = 1.5;

const SPRING_OF_FEEL = { calm: "smooth", brisk: "snappy", playful: "bouncy" } as const;

type Motion = DesignSpec["motion"];
type Layer = DesignSpec["depth"]["shadows"][1][0];

function kind(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A finite number as CSS text: `String`, so `0.1` stays `0.1`. */
function num(value: unknown, label: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`themeVars: ${label} must be a finite number, got ${String(value)}`);
  }
  return String(value);
}

/** Six significant digits, as the generator rounds (`round6`), so a scaled layer stays tidy. */
function round6(value: number): number {
  const rounded = Number(value.toPrecision(6));
  return rounded === 0 ? 0 : rounded;
}

/** The spring of a feel (R2-08): `calm` is smooth, `brisk` snappy, `playful` bouncy. */
export function feelSpring(motion: Motion): { visualDuration: number; bounce: number } {
  if (!isRecord(motion)) {
    throw new TypeError(`feelSpring: motion must be an object, got ${kind(motion)}`);
  }
  const name = SPRING_OF_FEEL[motion.feel];
  if (name === undefined) {
    throw new RangeError(`feelSpring: unknown motion feel ${JSON.stringify(motion.feel)}`);
  }
  const { visualDuration, bounce } = motion.springs[name];
  return { visualDuration, bounce };
}

function hexOf(value: unknown, label: string): string {
  if (typeof value !== "string" || !HEX.test(value)) {
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
  if (FONT_CATALOG.some((font) => font.id === id)) return fontStack(id);
  // A valid id outside the catalog (a custom font): the category's fallback stack (C-THEME-08).
  const donor = FONT_CATALOG.find((font) => font.category === category);
  return (donor as (typeof FONT_CATALOG)[number]).fallback;
}

function layerCss(layer: Layer, factor: number): string {
  const offsetY = num(round6(layer.offsetY * factor), "shadow offsetY");
  const blur = num(round6(layer.blur * factor), "shadow blur");
  const alpha = num(Math.min(1, round6(layer.alpha * factor)), "shadow alpha");
  const color = formatOklch(layer.color).replace(/\)$/, ` / ${alpha})`);
  return `0 ${offsetY}px ${blur}px 0 ${color}`;
}

function shadowVars(depth: DesignSpec["depth"], out: Record<string, string>): void {
  if (!["flat", "soft", "layered"].includes(depth.style)) {
    throw new RangeError(`themeVars: unknown depth style ${JSON.stringify(depth.style)}`);
  }
  const factor = depth.style === "layered" ? LAYERED_FACTOR : 1;
  for (const level of ELEVATIONS) {
    const [key, ambient] = depth.shadows[level];
    out[`--shadow-${level}`] =
      depth.style === "flat" ? "none" : `${layerCss(key, factor)}, ${layerCss(ambient, factor)}`;
  }
}

function durationMs(stored: number, feel: Motion["feel"], label: string): string {
  num(stored, label);
  const scaled = feel === "calm" ? stored * CALM_FACTOR : stored;
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
  if (!isRecord(spec) || !isRecord((spec as { color?: unknown }).color)) {
    throw new TypeError(`themeVars: spec must be an object with color.roles, got ${kind(spec)}`);
  }
  if (!isRecord((spec as DesignSpec).color.roles)) {
    throw new TypeError("themeVars: spec must be an object with color.roles");
  }
  return {
    mode: mode as Mode,
    vision: vision as Deficiency | undefined,
    units: units as "vw" | "cqi",
  };
}

/**
 * The CSS custom properties of a spec for one mode: 204 names in the order of section 5.6, frozen.
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
  const color = (hex: unknown, label: string): string => {
    const stored = hexOf(hex, label);
    return checked.vision === undefined
      ? stored
      : toHex(simulate(hexToRgb(stored as Hex), checked.vision));
  };

  const roles = spec.color.roles[mode] as Record<string, unknown>;
  for (const role of ROLE_NAMES) out[`--${role}`] = color(roles[role], `role ${role}`);

  for (const palette of PALETTE_NAMES) {
    const scale = spec.color.palettes[palette][mode];
    STEPS.forEach((step, index) => {
      out[`--${palette}-${step}`] = color(scale[index]?.hex, `scale step ${palette}-${step}`);
    });
  }

  for (const step of spec.type.steps) {
    const size =
      step.name === "display" && step.clamp !== undefined
        ? checked.units === "cqi"
          ? step.clamp.replaceAll("vw", "cqi")
          : step.clamp
        : `${num(step.sizePx, `type step ${step.name} size`)}px`;
    out[`--text-${step.name}`] = size;
    out[`--leading-${step.name}`] =
      `${num(step.lineHeightPx, `type step ${step.name} line height`)}px`;
    out[`--tracking-${step.name}`] = `${num(step.trackingEm, `type step ${step.name} tracking`)}em`;
  }

  const { families } = spec.type;
  out["--font-display"] = familyStack(families.display, "type.families.display", "sans");
  out["--font-body"] = familyStack(families.body, "type.families.body", "sans");
  out["--font-mono"] = familyStack(families.mono, "type.families.mono", "mono");

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
    const points = spec.motion.easings[name].map((p, i) => num(p, `easing ${name}[${i}]`));
    out[`--ease-${name}`] = `cubic-bezier(${points.join(", ")})`;
  }

  const spring = feelSpring(spec.motion);
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
