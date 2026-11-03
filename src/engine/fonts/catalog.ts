import { assertFinite, describeType } from "../color/guards";

// The font catalog of spec R2-03 and section 5.2: 40 Google Fonts families under OFL-1.1, self
// hosted. Pure: the catalog never fetches. `popularity` is the value of
// fonts.google.com/metadata/fonts on 2026-11-01, written as a literal (lower = more common).

export type FontCategory = "sans" | "serif" | "mono" | "display";

export type FontEntry = {
  readonly id: string;
  readonly family: string;
  readonly category: FontCategory;
  readonly variable: boolean;
  readonly axes: readonly string[];
  readonly weights: readonly number[];
  readonly license: "OFL-1.1";
  readonly popularity: number;
  readonly fallback: string;
};

const FALLBACKS: Readonly<Record<FontCategory, string>> = Object.freeze({
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  display: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  serif: 'ui-serif, Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
});

const CATEGORIES: readonly FontCategory[] = ["sans", "serif", "mono", "display"];

/** A variable family: its `wght` range, from the installed `@fontsource-variable/<id>` metadata. */
const variable = (
  family: string,
  category: FontCategory,
  min: number,
  max: number,
  popularity: number,
): FontEntry =>
  Object.freeze({
    id: family.toLowerCase().replaceAll(" ", "-"),
    family,
    category,
    variable: true,
    axes: Object.freeze(["wght"]),
    weights: Object.freeze([min, max]),
    license: "OFL-1.1",
    popularity,
    fallback: FALLBACKS[category],
  });

/** A static family: the weights it copies, 400 and, when it has one, 700. */
const fixed = (
  family: string,
  category: FontCategory,
  weights: readonly number[],
  popularity: number,
): FontEntry =>
  Object.freeze({
    id: family.toLowerCase().replaceAll(" ", "-"),
    family,
    category,
    variable: false,
    axes: Object.freeze([]),
    weights: Object.freeze([...weights]),
    license: "OFL-1.1",
    popularity,
    fallback: FALLBACKS[category],
  });

/** The 40 families, in the order of the table in spec section 5.2. */
export const FONT_CATALOG: readonly FontEntry[] = Object.freeze([
  variable("Host Grotesk", "sans", 300, 800, 111),
  fixed("Fragment Mono", "mono", [400], 539),
  variable("Schibsted Grotesk", "sans", 400, 900, 86),
  variable("Source Serif 4", "serif", 200, 900, 102),
  fixed("Gloock", "serif", [400], 421),
  variable("Albert Sans", "sans", 100, 900, 112),
  fixed("Young Serif", "serif", [400], 525),
  variable("Onest", "sans", 100, 900, 50),
  variable("Bodoni Moda", "serif", 400, 900, 40),
  variable("Familjen Grotesk", "sans", 400, 700, 368),
  variable("Literata", "serif", 200, 900, 192),
  variable("Spline Sans", "sans", 300, 700, 414),
  variable("Spline Sans Mono", "mono", 300, 700, 561),
  variable("Hubot Sans", "sans", 200, 900, 1170),
  variable("Mona Sans", "sans", 200, 900, 383),
  variable("Martian Mono", "mono", 100, 800, 378),
  variable("Funnel Display", "display", 300, 800, 468),
  variable("Funnel Sans", "sans", 300, 800, 120),
  variable("Zalando Sans Expanded", "sans", 200, 900, 569),
  variable("Zalando Sans", "sans", 200, 900, 505),
  variable("Unbounded", "display", 200, 900, 149),
  variable("Golos Text", "sans", 400, 900, 228),
  variable("Archivo", "sans", 100, 900, 14),
  fixed("Courier Prime", "mono", [400, 700], 58),
  variable("Big Shoulders", "display", 100, 900, 455),
  variable("Red Hat Text", "sans", 300, 700, 187),
  fixed("Tiny5", "display", [400], 1039),
  variable("Doto", "display", 100, 900, 229),
  variable("Red Hat Mono", "mono", 300, 700, 595),
  fixed("Redaction", "serif", [400, 700], 997),
  variable("Commissioner", "sans", 100, 900, 270),
  variable("Atkinson Hyperlegible Next", "sans", 200, 800, 267),
  variable("Atkinson Hyperlegible Mono", "mono", 200, 800, 827),
  variable("Google Sans Flex", "sans", 1, 1000, 111),
  variable("Google Sans Code", "mono", 300, 800, 225),
  variable("Anybody", "display", 100, 900, 567),
  variable("Science Gothic", "display", 100, 900, 835),
  variable("Hanken Grotesk", "sans", 100, 900, 125),
  variable("Geist", "sans", 100, 900, 82),
  variable("Geist Mono", "mono", 100, 900, 120),
]);

/**
 * The research's list of overused families, as names (spec R2-03 item 7). A family is on it when
 * its name equals an entry or, for `IBM Plex`, `Cormorant`, `Crimson` and `DM Serif`, starts with
 * the entry and a space.
 */
export const HIGH_GENERICNESS_FAMILIES: readonly string[] = Object.freeze([
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Nunito",
  "DM Sans",
  "Plus Jakarta Sans",
  "Outfit",
  "Manrope",
  "Figtree",
  "Geist",
  "Geist Mono",
  "Space Grotesk",
  "Space Mono",
  "Fraunces",
  "Playfair Display",
  "Cormorant",
  "Lora",
  "Crimson",
  "Newsreader",
  "Syne",
  "IBM Plex",
  "DM Serif",
  "Instrument Sans",
  "Instrument Serif",
]);

const PREFIX_ENTRIES: readonly string[] = ["IBM Plex", "Cormorant", "Crimson", "DM Serif"];

/** Whether a family name is on the high-genericness list. */
export function isHighGenericnessFamily(family: string): boolean {
  if (typeof family !== "string") {
    throw new TypeError(
      `isHighGenericnessFamily: family must be a string, got ${describeType(family)}`,
    );
  }
  if (HIGH_GENERICNESS_FAMILIES.includes(family)) return true;
  return PREFIX_ENTRIES.some((prefix) => family.startsWith(`${prefix} `));
}

/** `1 - clamp((popularity - 1) / 199, 0, 1)`: popularity 1 scores 1, 200 and above score 0. */
export function genericnessOf(popularity: number): number {
  assertFinite(popularity, "genericnessOf: popularity");
  if (popularity < 1) {
    throw new RangeError(`genericnessOf: popularity must be at least 1, got ${popularity}`);
  }
  return 1 - Math.min(1, Math.max(0, (popularity - 1) / 199));
}

function lookup(id: string, name: string, catalog: readonly FontEntry[]): FontEntry {
  if (typeof id !== "string") {
    throw new TypeError(`${name}: id must be a string, got ${describeType(id)}`);
  }
  const found = catalog.find((font) => font.id === id);
  if (found === undefined) throw new RangeError(`${name}: unknown font id "${id}"`);
  return found;
}

/** 1 for a family on the high list, else the score of its popularity. */
export function genericness(id: string, catalog: readonly FontEntry[] = FONT_CATALOG): number {
  if (!Array.isArray(catalog as unknown)) {
    throw new TypeError(`genericness: catalog must be an array, got ${describeType(catalog)}`);
  }
  const font = lookup(id, "genericness", catalog);
  return isHighGenericnessFamily(font.family) ? 1 : genericnessOf(font.popularity);
}

/** The CSS `font-family` value for a catalog id: the quoted family, then its fallback stack. */
export function fontStack(id: string): string {
  const font = lookup(id, "fontStack", FONT_CATALOG);
  return `"${font.family}", ${font.fallback}`;
}

/** The files `scripts/copy-fonts.mjs` puts in `/fonts/<id>/`, relative to that folder (R2-03 item 5). */
export function fontFiles(id: string): readonly string[] {
  const font = lookup(id, "fontFiles", FONT_CATALOG);
  const faces = font.variable
    ? [`${font.id}-latin-wght-normal.woff2`]
    : font.weights.map((weight) => `${font.id}-latin-${weight}-normal.woff2`);
  return Object.freeze([...faces, "OFL.txt"]);
}

/** The problems of a catalog, one message each: empty when it is valid. */
export function validateCatalog(entries: readonly FontEntry[]): readonly string[] {
  if (!Array.isArray(entries as unknown)) {
    throw new TypeError(`validateCatalog: entries must be an array, got ${describeType(entries)}`);
  }
  const problems: string[] = [];
  const seen = new Set<string>();
  entries.forEach((font, index) => {
    if (typeof font !== "object" || font === null) {
      problems.push(`entry ${index} must be an object, got ${describeType(font)}`);
      return;
    }
    const label = `"${font.id}"`;
    if (seen.has(font.id)) problems.push(`duplicate id ${label}`);
    seen.add(font.id);
    if (typeof font.id !== "string" || !/^[a-z0-9-]+$/.test(font.id)) {
      problems.push(`id ${label} must match ^[a-z0-9-]+$`);
    }
    if (typeof font.family !== "string" || font.family === "" || /["\\]/.test(font.family)) {
      problems.push(`${label}: family must be a non-empty name without a quote or a backslash`);
    }
    if (!CATEGORIES.includes(font.category)) problems.push(`${label}: unknown category`);
    if (font.license !== "OFL-1.1") problems.push(`${label}: license must be OFL-1.1`);
    if (!Number.isInteger(font.popularity) || font.popularity < 1) {
      problems.push(`${label}: popularity must be an integer of at least 1`);
    }
    if (typeof font.fallback !== "string" || font.fallback.length === 0) {
      problems.push(`${label}: fallback must not be empty`);
    }
    const axes: unknown = font.axes;
    const weights: unknown = font.weights;
    if (!Array.isArray(axes)) problems.push(`${label}: axes must be an array`);
    if (!Array.isArray(weights)) problems.push(`${label}: weights must be an array`);
    if (!Array.isArray(axes) || !Array.isArray(weights)) return;
    const list = weights as readonly number[];
    if (font.variable) {
      if (axes.length !== 1 || axes[0] !== "wght") {
        problems.push(`${label}: a variable family has the axes ["wght"]`);
      }
      const [min, max] = list;
      if (list.length !== 2 || min === undefined || max === undefined || min >= max) {
        problems.push(`${label}: a variable family has two weights, min below max`);
      }
    } else {
      if (axes.length !== 0) problems.push(`${label}: a static family has no axes`);
      const ordered = list.every((weight, i) => i === 0 || weight > (list[i - 1] ?? 0));
      const allowed = list.every((weight) => weight === 400 || weight === 700);
      if (list[0] !== 400 || !ordered || !allowed) {
        problems.push(`${label}: a static family has ascending weights from 400 and 700 only`);
      }
    }
  });
  return problems;
}
