import type { RoleName } from "@/engine";
import type { DesignSpec } from "@/spec";
import { familyName } from "./fonts";

// The fixed prose of the export (R3-22): one sentence for a design, one for each role. American
// English, plain sentences, no color named.

function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

const HARMONY: Readonly<Record<string, string>> = {
  monochrome: "a single-hue palette",
  analogous: "a palette of neighboring hues",
  complementary: "a palette of opposing hues",
  split: "a palette of split-complementary hues",
  triadic: "a palette of three evenly spaced hues",
  tetradic: "a palette of four balanced hues",
};
const CHROMA: Readonly<Record<string, string>> = {
  muted: "muted intensity",
  balanced: "balanced intensity",
  vivid: "vivid intensity",
};
const TINT: Readonly<Record<string, string>> = {
  none: "pure neutrals",
  warm: "warm-leaning neutrals",
  cool: "cool-leaning neutrals",
  brand: "neutrals tinted toward the brand",
};
const CONTRAST: Readonly<Record<string, string>> = {
  AA: "AA contrast",
  "AA+": "AA+ contrast",
  AAA: "AAA contrast",
};
const GAMUT: Readonly<Record<string, string>> = {
  srgb: "within the sRGB gamut",
  p3: "in the Display P3 gamut",
};
const RADIUS: Readonly<Record<string, string>> = {
  sharp: "sharp corners",
  soft: "softly rounded corners",
  round: "fully rounded corners",
};
const DEPTH: Readonly<Record<string, string>> = {
  flat: "flat surfaces",
  soft: "soft shadows",
  layered: "layered shadows",
};
const MOTION: Readonly<Record<string, string>> = {
  calm: "calm motion",
  brisk: "brisk motion",
  playful: "playful motion",
};

function phrase(table: Readonly<Record<string, string>>, key: unknown, label: string): string {
  if (typeof key !== "string") {
    throw new TypeError(`describeDesign: ${label} must be a string, got ${describeType(key)}`);
  }
  const found = Object.hasOwn(table, key) ? table[key] : undefined;
  if (found === undefined) {
    throw new RangeError(`describeDesign: unknown ${label} ${JSON.stringify(key)}`);
  }
  return found;
}

/**
 * One sentence about a design, built from fixed phrase tables over the harmony, chroma, neutral
 * tint, contrast level, gamut, the three families, the radius set, the depth style and the motion
 * feel. It never names a color (R3-22).
 */
export function describeDesign(spec: DesignSpec): string {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`describeDesign: spec must be an object, got ${describeType(spec)}`);
  }
  const { params } = spec.color;
  const { families } = spec.type;
  const palette = `${phrase(HARMONY, params.harmony, "harmony")} of ${phrase(CHROMA, params.chroma, "chroma")}`;
  const neutrals = `with ${phrase(TINT, params.neutralTint, "neutral tint")}`;
  const quality = `built for ${phrase(CONTRAST, params.contrastLevel, "contrast level")} ${phrase(GAMUT, params.gamut, "gamut")}`;
  const type = `set in ${familyName(families.display)} for headings, ${familyName(families.body)} for text and ${familyName(families.mono)} for code`;
  const shape = `with ${phrase(RADIUS, spec.shape.radiusSet, "radius set")}, ${phrase(DEPTH, spec.depth.style, "depth style")} and ${phrase(MOTION, spec.motion.feel, "motion feel")}`;
  const sentence = `${palette}, ${neutrals}, ${quality}, ${type}, ${shape}.`;
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`;
}

/** What each of the 46 roles paints, in one plain sentence of at most 90 characters (R3-22). */
export const USE_FOR: Readonly<Record<RoleName, string>> = Object.freeze({
  background: "The page behind everything else.",
  foreground: "Default text and icons on the page.",
  card: "The fill of cards and raised panels.",
  "card-foreground": "Text and icons on a card.",
  popover: "The fill of menus, tooltips and popovers.",
  "popover-foreground": "Text and icons inside a popover.",
  muted: "Quiet fills for tabs, chips and disabled areas.",
  "muted-foreground": "Secondary text, captions and placeholders.",
  secondary: "The fill of secondary buttons.",
  "secondary-foreground": "Text and icons on a secondary button.",
  accent: "Hover and selected fills for list rows and menu items.",
  "accent-foreground": "Text and icons on an accent fill.",
  primary: "The fill of the main action and key highlights.",
  "primary-foreground": "Text and icons on a primary fill.",
  destructive: "The fill of actions that delete or cannot be undone.",
  "destructive-foreground": "Text and icons on a destructive fill.",
  "destructive-subtle": "A soft fill for error banners and invalid fields.",
  "destructive-subtle-foreground": "Text and icons on a soft error fill.",
  success: "The fill of success badges and confirmations.",
  "success-foreground": "Text and icons on a success fill.",
  "success-subtle": "A soft fill for success banners.",
  "success-subtle-foreground": "Text and icons on a soft success fill.",
  warning: "The fill of warning badges and cautions.",
  "warning-foreground": "Text and icons on a warning fill.",
  "warning-subtle": "A soft fill for warning banners.",
  "warning-subtle-foreground": "Text and icons on a soft warning fill.",
  info: "The fill of informational badges and notices.",
  "info-foreground": "Text and icons on an info fill.",
  "info-subtle": "A soft fill for informational banners.",
  "info-subtle-foreground": "Text and icons on a soft info fill.",
  border: "Dividers and the outlines of cards and panels.",
  input: "The outline of text fields, selects and other form controls.",
  ring: "The focus ring around the element that has keyboard focus.",
  sidebar: "The fill of the sidebar.",
  "sidebar-foreground": "Text and icons in the sidebar.",
  "sidebar-primary": "The fill of the active item and main action in the sidebar.",
  "sidebar-primary-foreground": "Text and icons on a sidebar primary fill.",
  "sidebar-accent": "Hover and selected fills for sidebar items.",
  "sidebar-accent-foreground": "Text and icons on a sidebar accent fill.",
  "sidebar-border": "Dividers and outlines inside the sidebar.",
  "sidebar-ring": "The focus ring for elements in the sidebar.",
  "chart-1": "The first series in charts.",
  "chart-2": "The second series in charts.",
  "chart-3": "The third series in charts.",
  "chart-4": "The fourth series in charts.",
  "chart-5": "The fifth series in charts.",
} satisfies Record<RoleName, string>);
