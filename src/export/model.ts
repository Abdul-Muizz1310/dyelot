import { FONT_CATALOG, PALETTE_NAMES, ROLE_NAMES, STEPS, typeWeights } from "@/engine";
import type { DesignSpec } from "@/spec";
import { themeVars } from "@/theme/vars";
import { cssFontStack, familyName, fontPackage, NEXT_FONT_MISSING } from "./fonts";

// The theme model (section 6.1): what `theme.css`, the registry and the token files write,
// gathered once from the theme bridge, `typeWeights` and the font helpers (R3-13).

export type ThemeColor = { readonly name: string; readonly light: string; readonly dark: string };
export type ThemeFamily = {
  readonly id: string;
  readonly family: string;
  readonly stack: string;
  readonly package: string | null;
  readonly nextImport: string | null;
};
export type ThemeTypeStep = {
  readonly name: string;
  readonly size: string;
  readonly lineHeight: string;
  readonly tracking: string;
  /** The type role of the step: its weight is `weights[role]`. */
  readonly role: "heading" | "label" | "body";
  readonly weight: number;
};
export type ThemeModel = {
  readonly roles: readonly ThemeColor[];
  readonly steps: readonly ThemeColor[];
  readonly families: {
    readonly display: ThemeFamily;
    readonly body: ThemeFamily;
    readonly mono: ThemeFamily;
  };
  readonly typeSteps: readonly ThemeTypeStep[];
  readonly weights: { readonly heading: number; readonly label: number; readonly body: number };
  readonly radii: Readonly<Record<"sm" | "md" | "lg" | "xl" | "2xl" | "radius", string>>;
  readonly shadows: readonly string[];
  readonly durations: readonly { readonly name: string; readonly value: string }[];
  readonly easings: readonly { readonly name: string; readonly value: string }[];
  readonly spring: { readonly duration: string; readonly bounce: string };
  readonly iconStroke: string;
};

const TYPE_STEP_NAMES = [
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
const HEADING_STEPS: readonly string[] = ["display", "h1", "h2", "h3", "h4"];
const DURATION_NAMES = ["instant", "fast", "quick", "base", "slow", "slower", "slowest"] as const;
const EASING_NAMES = ["standard", "decelerate", "accelerate", "emphasized"] as const;

function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

function roleOf(step: string): "heading" | "label" | "body" {
  if (HEADING_STEPS.includes(step)) return "heading";
  return step === "label" ? "label" : "body";
}

function familyOf(id: string, slot: "display" | "body" | "mono"): ThemeFamily {
  const inCatalog = FONT_CATALOG.some((font) => font.id === id);
  const family = familyName(id);
  return {
    id,
    family,
    stack: cssFontStack(id, slot),
    package: fontPackage(id),
    nextImport: !inCatalog || NEXT_FONT_MISSING.includes(id) ? null : family.replaceAll(" ", "_"),
  };
}

/** The values the exports write for a spec, read from the theme bridge (R3-13). */
export function themeModel(spec: DesignSpec): ThemeModel {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`themeModel: spec must be an object, got ${describeType(spec)}`);
  }
  const light = themeVars(spec, "light");
  const dark = themeVars(spec, "dark");
  const colors = (names: readonly string[]): ThemeColor[] =>
    names.map((name) => ({
      name,
      light: light[`--${name}`] as string,
      dark: dark[`--${name}`] as string,
    }));
  const { families } = spec.type;
  const weights = typeWeights(spec);
  const pick = (name: string): string => light[`--${name}`] as string;
  return {
    roles: colors(ROLE_NAMES),
    steps: colors(PALETTE_NAMES.flatMap((palette) => STEPS.map((step) => `${palette}-${step}`))),
    families: {
      display: familyOf(families.display, "display"),
      body: familyOf(families.body, "body"),
      mono: familyOf(families.mono, "mono"),
    },
    typeSteps: TYPE_STEP_NAMES.map((name) => {
      const role = roleOf(name);
      return {
        name,
        size: pick(`text-${name}`),
        lineHeight: pick(`leading-${name}`),
        tracking: pick(`tracking-${name}`),
        role,
        weight: weights[role],
      };
    }),
    weights: { heading: weights.heading, label: weights.label, body: weights.body },
    radii: {
      sm: pick("radius-sm"),
      md: pick("radius-md"),
      lg: pick("radius-lg"),
      xl: pick("radius-xl"),
      "2xl": pick("radius-2xl"),
      radius: pick("radius-lg"),
    },
    shadows: [1, 2, 3, 4, 5].map((level) => pick(`shadow-${level}`)),
    durations: DURATION_NAMES.map((name) => ({ name, value: pick(`duration-${name}`) })),
    easings: EASING_NAMES.map((name) => ({ name, value: pick(`ease-${name}`) })),
    spring: { duration: pick("spring-duration"), bounce: pick("spring-bounce") },
    iconStroke: pick("icon-stroke"),
  };
}
