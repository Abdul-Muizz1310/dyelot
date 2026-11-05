import { FONT_CATALOG } from "@/engine";
import type { DesignSpec } from "@/spec";
import { type ThemeFamily, themeModel } from "./model";
import { describeDesign } from "./prose";
import type { BundleFile } from "./types";

// The shadcn registry items (section 6.3, R3-16): one `registry:theme` item and one
// `registry:font` item for each distinct family that `next/font/google` can import.

const SCHEMA = "https://ui.shadcn.com/schema/registry-item.json";
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MAX = 48;
const SLOTS = ["display", "body", "mono"] as const;
type Slot = (typeof SLOTS)[number];

/** The CSS variable a font item sets for a family: the body wins, then the display, then the mono. */
const VARIABLE: Readonly<Record<Slot, string>> = {
  display: "--font-heading",
  body: "--font-sans",
  mono: "--font-mono",
};
/** The `cssVars.theme` key of a slot. */
const THEME_KEY: Readonly<Record<Slot, string>> = {
  display: "font-heading",
  body: "font-sans",
  mono: "font-mono",
};

function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

type Item = { readonly id: string; readonly family: ThemeFamily; readonly variable: string };

/** The distinct importable families in display, body, mono order, each with its variable. */
function fontItems(families: Readonly<Record<Slot, ThemeFamily>>): Item[] {
  const slotOf = new Map<string, Slot>();
  for (const slot of ["body", "display", "mono"] as const) {
    const { id, nextImport } = families[slot];
    if (nextImport !== null && !slotOf.has(id)) slotOf.set(id, slot);
  }
  const items: Item[] = [];
  for (const slot of SLOTS) {
    const family = families[slot];
    const owner = slotOf.get(family.id);
    if (owner === undefined || items.some((item) => item.id === family.id)) continue;
    items.push({ id: family.id, family, variable: VARIABLE[owner] });
  }
  return items;
}

/** The registry item files of a design: the theme item, then one font item per importable family. */
export function registryItems(spec: DesignSpec, slug: string): readonly BundleFile[] {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`registryItems: spec must be an object, got ${describeType(spec)}`);
  }
  if (typeof slug !== "string") {
    throw new TypeError(`registryItems: slug must be a string, got ${describeType(slug)}`);
  }
  if (slug.length > SLUG_MAX || !SLUG_PATTERN.test(slug)) {
    throw new RangeError(
      `registryItems: slug must match ${SLUG_PATTERN} in at most ${SLUG_MAX} characters, got ${JSON.stringify(slug)}`,
    );
  }
  const model = themeModel(spec);
  const items = fontItems(model.families);
  const variableOf = new Map(items.map((item) => [item.id, item.variable]));

  const theme: Record<string, string> = {};
  for (const name of ["sm", "md", "lg", "xl", "2xl"] as const) {
    theme[`radius-${name}`] = model.radii[name];
  }
  for (const slot of SLOTS) {
    const family = model.families[slot];
    const variable = variableOf.get(family.id);
    if (variable === undefined) theme[THEME_KEY[slot]] = family.stack;
    else if (variable !== VARIABLE[slot]) theme[THEME_KEY[slot]] = `var(${variable})`;
  }
  const light: Record<string, string> = { radius: model.radii.radius };
  const dark: Record<string, string> = {};
  for (const color of [...model.roles, ...model.steps]) {
    light[color.name] = color.light;
    dark[color.name] = color.dark;
  }
  const description = `${spec.meta.oneLiner ?? describeDesign(spec)} Made with dyelot.`;
  const themeItem = {
    $schema: SCHEMA,
    name: slug,
    type: "registry:theme",
    title: spec.meta.name,
    description,
    cssVars: { theme, light, dark },
  };

  const files: BundleFile[] = [{ path: `registry/${slug}.json`, text: json(themeItem) }];
  for (const { id, family, variable } of items) {
    const entry = FONT_CATALOG.find((font) => font.id === id);
    files.push({
      path: `registry/font-${id}.json`,
      text: json({
        $schema: SCHEMA,
        name: `font-${id}`,
        type: "registry:font",
        title: family.family,
        font: {
          family: family.family,
          provider: "google",
          import: family.nextImport,
          variable,
          ...(entry?.variable === false ? { weight: entry.weights.map(String) } : {}),
          subsets: ["latin"],
        },
      }),
    });
  }
  return files;
}
