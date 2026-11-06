import { lintSpec, measureSpec, springCurve, summarize } from "@/engine";
import { type DesignSpec, lotTag, specId } from "@/spec";
import { themeVars } from "@/theme/vars";
import type { BrandProps } from "../flavor/remotion/brand-intro";

// The brand video's props (R5-30): plain strings, numbers, arrays and objects of those, so
// `brand.json` imports with no cast. The values are the ones the theme bridge and the motion
// files write, so the video and the exported files agree.

const MODES = ["light", "dark"] as const;
const PALETTES = ["primary", "secondary", "accent", "neutral", "danger"] as const;
const SPRINGS = ["snappy", "smooth", "bouncy"] as const;
const ROLES = [
  ["background", "--background"],
  ["foreground", "--foreground"],
  ["card", "--card"],
  ["cardForeground", "--card-foreground"],
  ["primary", "--primary"],
  ["primaryForeground", "--primary-foreground"],
  ["mutedForeground", "--muted-foreground"],
  ["border", "--border"],
] as const;

function describeType(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

/** The plain props of `BrandIntro` for one mode. */
export function brandProps(spec: DesignSpec, mode: "light" | "dark"): BrandProps {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`brandProps: spec must be an object, got ${describeType(spec)}`);
  }
  if (typeof mode !== "string") {
    throw new TypeError(`brandProps: mode must be a string, got ${describeType(mode)}`);
  }
  if (!MODES.includes(mode)) {
    throw new RangeError(`brandProps: mode must be light or dark, got ${JSON.stringify(mode)}`);
  }
  const vars = themeVars(spec, mode);
  const { contrast } = summarize(measureSpec(spec), lintSpec(spec), spec.color.params.gamut);
  const springs = Object.fromEntries(
    SPRINGS.map((id) => {
      const { settleMs, samples } = springCurve(spec.motion.springs[id]);
      return [id, { settleMs, samples: [...samples] }];
    }),
  ) as BrandProps["motion"]["springs"];
  return {
    name: spec.meta.name,
    oneLiner: spec.meta.oneLiner ?? "",
    lot: lotTag(specId(spec)),
    checks: { passed: contrast.requiredPass, required: contrast.required },
    palettes: PALETTES.map((name) => ({
      name,
      steps: spec.color.palettes[name][mode].map((step) => step.hex as string),
    })),
    colors: Object.fromEntries(ROLES.map(([key, css]) => [key, vars[css]])) as BrandProps["colors"],
    fonts: { display: vars["--font-display"] as string, body: vars["--font-body"] as string },
    motion: {
      baseMs: spec.motion.durations.base,
      standard: [...spec.motion.easings.standard],
      springs,
    },
  };
}
