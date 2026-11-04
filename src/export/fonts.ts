import { FONT_CATALOG, type FontEntry } from "@/engine";

// The font helpers of the export (section 6.1, R3-16): names, CSS stacks and packages.

const FAMILY_ID = /^[a-z0-9-]{1,64}$/;
const SLOTS = ["display", "body", "mono"] as const;
type Slot = (typeof SLOTS)[number];

/**
 * The catalog families `next/font/google` cannot import: those absent from the `font-data.json` of
 * next 16.4.3 (C-REG-09 reads that file).
 */
export const NEXT_FONT_MISSING: readonly string[] = Object.freeze(["redaction"]);

function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

function entryOf(id: string, who: string): FontEntry | undefined {
  if (typeof id !== "string") {
    throw new TypeError(`${who}: id must be a string, got ${describeType(id)}`);
  }
  if (!FAMILY_ID.test(id)) {
    throw new RangeError(`${who}: id must match ${FAMILY_ID}, got ${JSON.stringify(id)}`);
  }
  return FONT_CATALOG.find((font) => font.id === id);
}

/** The fallback of a slot outside the catalog, as the theme bridge reads it. */
function fallbackOf(category: "sans" | "mono"): string {
  const donor = FONT_CATALOG.find((font) => font.category === category) as FontEntry;
  return donor.fallback;
}

/** The catalog's family name, or the id with each `-` read as a space. */
export function familyName(id: string): string {
  return entryOf(id, "familyName")?.family ?? id.replaceAll("-", " ");
}

/**
 * The `font-family` value of a slot: `"<Family> Variable", "<Family>", <fallback>` for a variable
 * family (Fontsource's naming), `"<Family>", <fallback>` for a static one, and for a family outside
 * the catalog its name followed by the bridge's fallback for the slot.
 */
export function cssFontStack(id: string, slot: Slot): string {
  const entry = entryOf(id, "cssFontStack");
  if (typeof slot !== "string") {
    throw new TypeError(`cssFontStack: slot must be a string, got ${describeType(slot)}`);
  }
  if (!SLOTS.includes(slot)) {
    throw new RangeError(
      `cssFontStack: slot must be display, body or mono, got ${JSON.stringify(slot)}`,
    );
  }
  if (entry === undefined) {
    const fallback = fallbackOf(slot === "mono" ? "mono" : "sans");
    return `"${id.replaceAll("-", " ")}", ${fallback}`;
  }
  const names = entry.variable
    ? `"${entry.family} Variable", "${entry.family}"`
    : `"${entry.family}"`;
  return `${names}, ${entry.fallback}`;
}

/** The Fontsource package of a catalog family, or `null` outside the catalog. */
export function fontPackage(id: string): string | null {
  const entry = entryOf(id, "fontPackage");
  if (entry === undefined) return null;
  return `${entry.variable ? "@fontsource-variable" : "@fontsource"}/${entry.id}`;
}
