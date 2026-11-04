import { PALETTE_NAMES, round6, STEPS } from "@/engine";
import type { DesignSpec } from "@/spec";
import { themeModel } from "./model";
import { checkRoleHexes, checkTokenInput } from "./token-input";
import type { BundleFile } from "./types";

// The Figma token files (R3-18, section 6.5): only what Figma imports. Colors are sRGB, sizes px,
// durations s, and a font family one string. No typography, shadow, weight or cubic Bezier.

type Json = Record<string, unknown>;

const px = (value: number): Json => ({ $type: "dimension", $value: { value, unit: "px" } });

function srgbToken(hex: string): Json {
  const n = Number.parseInt(hex.slice(1), 16);
  const components = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => round6(c / 255));
  return { $type: "color", $value: { colorSpace: "srgb", components, hex } };
}

function fileOf(spec: DesignSpec, mode: "light" | "dark"): Json {
  const model = themeModel(spec);
  const role: Json = {};
  for (const entry of model.roles) role[entry.name] = srgbToken(entry[mode]);
  const scale: Json = {};
  for (const palette of PALETTE_NAMES) {
    const steps: Json = {};
    for (const step of STEPS) {
      const found = model.steps.find((s) => s.name === `${palette}-${step}`);
      steps[String(step)] = srgbToken((found as { light: string; dark: string })[mode]);
    }
    scale[palette] = steps;
  }

  const font: Json = {};
  for (const slot of ["display", "body", "mono"] as const) {
    font[slot] = { $type: "fontFamily", $value: model.families[slot].family };
  }
  const size: Json = {};
  const lineHeight: Json = {};
  for (const step of spec.type.steps) {
    size[step.name] = px(step.sizePx);
    lineHeight[step.name] = px(step.lineHeightPx);
  }
  const space: Json = {};
  [0, 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32].forEach((unit, index) => {
    space[String(unit)] = px(spec.space.scale[index] as number);
  });
  const radius: Json = {};
  for (const key of ["sm", "md", "lg", "xl", "2xl"] as const)
    radius[key] = px(spec.shape.radii[key]);
  radius.full = px(9999);
  const duration: Json = {};
  for (const entry of model.durations) {
    duration[entry.name] = {
      $type: "duration",
      $value: { value: round6(Number.parseFloat(entry.value) / 1000), unit: "s" },
    };
  }
  const spring: Json = {};
  for (const key of ["snappy", "smooth", "bouncy"] as const) {
    spring[key] = {
      "visual-duration": { $type: "number", $value: spec.motion.springs[key].visualDuration },
      bounce: { $type: "number", $value: spec.motion.springs[key].bounce },
    };
  }
  return {
    color: { role, scale },
    font,
    size,
    "line-height": lineHeight,
    space,
    radius,
    duration,
    spring,
  };
}

/** The two Figma files, light then dark: the same token names and types (R3-18). */
export function figmaFiles(spec: DesignSpec, name: string): readonly BundleFile[] {
  checkTokenInput("figmaFiles", spec, name);
  checkRoleHexes("figmaFiles", spec);
  return (["light", "dark"] as const).map((mode) => ({
    path: `tokens/figma/${mode}.tokens.json`,
    text: `${JSON.stringify(fileOf(spec, mode), null, 2)}\n`,
  }));
}
