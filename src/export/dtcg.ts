import type { Hex } from "@/engine";
import { hexToRgb, PALETTE_NAMES, rgbToOklch, round6, roundHue, STEPS } from "@/engine";
import type { DesignSpec } from "@/spec";
import { themeModel } from "./model";
import { editLink } from "./text";
import { checkRoleHexes, checkTokenInput } from "./token-input";
import type { BundleFile } from "./types";

// The DTCG 2025.10 token files (R3-17, section 6.4): base, light, dark and the resolver. Every token
// carries its own `$type` and no group does. JavaScript lists integer-like keys first, in ascending
// order (R3-11), so `space`, `shadow` and the scale steps need no sorting.

type Json = Record<string, unknown>;
type Mode = "light" | "dark";

const MODES: readonly Mode[] = ["light", "dark"];
const HEADING_STEPS: readonly string[] = ["display", "h1", "h2", "h3", "h4"];
const SPRINGS = ["snappy", "smooth", "bouncy"] as const;
const FULL_RADIUS_PX = 9999;
const LAYERED_FACTOR = 1.5;

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;
const px = (value: number): Json => ({ value, unit: "px" });
const hue = (h: number | null): number | string => (h === null ? "none" : roundHue(h));

function oklchComponents(l: number, c: number, h: number | null): (number | string)[] {
  return [round6(l), round6(c), hue(h)];
}

function colorToken(components: (number | string)[], hex: string): Json {
  return { $type: "color", $value: { colorSpace: "oklch", components, hex } };
}

/** A role holds only a hex, so its OKLCH is converted (R3-15). */
function roleToken(hex: string): Json {
  const { l, c, h } = rgbToOklch(hexToRgb(hex as Hex), "srgb");
  return colorToken(oklchComponents(l, c, h), hex);
}

/** The names of a CSS font stack, the quotes stripped: `"Inter", ui-sans-serif` is two names. */
function stackNames(stack: string): string[] {
  const names: string[] = [];
  for (const match of stack.matchAll(/"([^"]*)"|([^,\s][^,]*)/g)) {
    names.push((match[1] ?? (match[2] as string)).trim());
  }
  return names;
}

function colorFile(spec: DesignSpec, mode: Mode): Json {
  const model = themeModel(spec);
  const role: Json = {};
  for (const entry of model.roles) role[entry.name] = roleToken(entry[mode]);
  const scale: Json = {};
  for (const palette of PALETTE_NAMES) {
    const steps: Json = {};
    spec.color.palettes[palette][mode].forEach((entry, index) => {
      const { l, c, h } = entry.oklch;
      const step = STEPS[index] as number;
      steps[String(step)] = colorToken(
        oklchComponents(l, c, h),
        (
          model.steps.find((s) => s.name === `${palette}-${step}`) as {
            light: string;
            dark: string;
          }
        )[mode],
      );
    });
    scale[palette] = steps;
  }
  return { color: { role, scale } };
}

type Layer = DesignSpec["depth"]["shadows"][1][0];

function shadowLayer(layer: Layer, factor: number, cap: boolean): Json {
  const alpha = round6(layer.alpha * factor);
  return {
    color: {
      colorSpace: "oklch",
      components: oklchComponents(layer.color.l, layer.color.c, layer.color.h),
      alpha: cap ? Math.min(1, alpha) : alpha,
    },
    offsetX: px(0),
    offsetY: px(round6(layer.offsetY * factor)),
    blur: px(round6(layer.blur * factor)),
    spread: px(0),
  };
}

function shadowTokens(spec: DesignSpec): Json {
  const out: Json = {};
  const { style, shadows } = spec.depth;
  const layered = style === "layered";
  for (const level of [1, 2, 3, 4, 5] as const) {
    const layers =
      style === "flat"
        ? [
            {
              color: { colorSpace: "oklch", components: [0, 0, 0], alpha: 0 },
              offsetX: px(0),
              offsetY: px(0),
              blur: px(0),
              spread: px(0),
            },
          ]
        : shadows[level].map((layer) => shadowLayer(layer, layered ? LAYERED_FACTOR : 1, layered));
    out[String(level)] = { $type: "shadow", $value: layers };
  }
  return out;
}

function baseFile(spec: DesignSpec, name: string, link: string): Json {
  const model = themeModel(spec);
  const slots = ["display", "body", "mono"] as const;
  const families = Object.fromEntries(
    slots.map((slot) => [slot, stackNames(model.families[slot].stack)]),
  ) as Record<(typeof slots)[number], string[]>;

  const font: Json = {};
  for (const slot of slots) font[slot] = { $type: "fontFamily", $value: families[slot] };
  const fontWeight: Json = {};
  for (const role of ["heading", "label", "body"] as const) {
    fontWeight[role] = { $type: "fontWeight", $value: model.weights[role] };
  }

  const type: Json = {};
  for (const entry of model.typeSteps) {
    const step = spec.type.steps.find(
      (s) => s.name === entry.name,
    ) as DesignSpec["type"]["steps"][number];
    const token: Json = {
      $type: "typography",
      $value: {
        fontFamily: families[HEADING_STEPS.includes(entry.name) ? "display" : "body"],
        fontSize: px(step.sizePx),
        fontWeight: entry.weight,
        letterSpacing: px(round6(step.trackingEm * step.sizePx)),
        lineHeight: round6(step.lineHeightPx / step.sizePx),
      },
    };
    if (entry.name === "display" && step.clamp !== undefined) {
      token.$description = `Fluid size: ${step.clamp}`;
    }
    type[entry.name] = token;
  }

  const space: Json = {};
  [0, 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32].forEach((unit, index) => {
    space[String(unit)] = { $type: "dimension", $value: px(spec.space.scale[index] as number) };
  });

  const radius: Json = {};
  for (const key of ["sm", "md", "lg", "xl", "2xl"] as const) {
    radius[key] = { $type: "dimension", $value: px(spec.shape.radii[key]) };
  }
  radius.full = { $type: "dimension", $value: px(FULL_RADIUS_PX) };

  const duration: Json = {};
  for (const entry of model.durations) {
    duration[entry.name] = {
      $type: "duration",
      $value: { value: Number.parseFloat(entry.value), unit: "ms" },
    };
  }
  const easing: Json = {};
  for (const entry of model.easings) {
    easing[entry.name] = {
      $type: "cubicBezier",
      $value: spec.motion.easings[entry.name as keyof DesignSpec["motion"]["easings"]],
    };
  }
  const spring: Json = {};
  for (const key of SPRINGS) {
    spring[key] = {
      "visual-duration": { $type: "number", $value: spec.motion.springs[key].visualDuration },
      bounce: { $type: "number", $value: spec.motion.springs[key].bounce },
    };
  }

  return {
    $description: `${name}. Made with dyelot: ${link}`,
    font,
    "font-weight": fontWeight,
    type,
    space,
    radius,
    shadow: shadowTokens(spec),
    duration,
    easing,
    spring,
  };
}

function resolverFile(name: string, link: string): Json {
  return {
    version: "2025.10",
    name,
    description: `Made with dyelot: ${link}`,
    sets: { base: { sources: [{ $ref: "base.tokens.json" }] } },
    modifiers: {
      mode: {
        default: "light",
        contexts: {
          light: [{ $ref: "light.tokens.json" }],
          dark: [{ $ref: "dark.tokens.json" }],
        },
      },
    },
    resolutionOrder: [{ $ref: "#/sets/base" }, { $ref: "#/modifiers/mode" }],
  };
}

/** The four DTCG files: base, light, dark and the resolver (R3-17). */
export function dtcgFiles(spec: DesignSpec, name: string, origin: string): readonly BundleFile[] {
  checkTokenInput("dtcgFiles", spec, name);
  checkRoleHexes("dtcgFiles", spec);
  const link = editLink(spec, origin);
  return [
    { path: "tokens/base.tokens.json", text: json(baseFile(spec, name, link)) },
    ...MODES.map((mode) => ({
      path: `tokens/${mode}.tokens.json`,
      text: json(colorFile(spec, mode)),
    })),
    { path: "tokens/design.resolver.json", text: json(resolverFile(name, link)) },
  ];
}
