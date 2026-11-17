import { readFileSync } from "node:fs";
import path from "node:path";
import type { GalleryData, GalleryEntry } from "@/features/gallery/data";
import { GALLERY_DEFS } from "@/features/gallery/defs";
import type { DesignSpec } from "@/spec";
import { decodeSpec, isPlainText } from "@/spec";
import { DENY_LIST } from "../ai/lexicon-deny";
import { m6CopyProblems } from "./copy-m6";

// The gallery's test fixtures (docs/specs/06-gallery.md, section 4): the committed data read from
// disk, so a test never touches the app's `GALLERY` binding, and the words check of R6-12. It imports
// neither `vitest` nor `@/ai`.

/** The committed `gallery.json`, read from disk. */
export const GALLERY_DATA: GalleryData = JSON.parse(
  readFileSync(path.join(process.cwd(), "src/features/gallery/gallery.json"), "utf8"),
) as GalleryData;

export const DEFS = GALLERY_DEFS;

/** The entry with `slug`; an unknown slug throws. */
export function ENTRY(slug: string): GalleryEntry {
  const found = GALLERY_DATA.entries.find((entry) => entry.slug === slug);
  if (found === undefined) throw new Error(`ENTRY: no gallery entry with slug "${slug}"`);
  return found;
}

const SPECS = new Map<string, DesignSpec>();

/** The design a slug's link decodes to, decoded once. */
export function SPEC_OF(slug: string): DesignSpec {
  const known = SPECS.get(slug);
  if (known !== undefined) return known;
  const spec = decodeSpec(ENTRY(slug).link);
  SPECS.set(slug, spec);
  return spec;
}

/** The 18 brief rows and the six hero rows. */
export const BRIEFS = DEFS.filter((def) => def.source === "brief");
export const HEROES = DEFS.filter((def) => def.source === "hero");

/** `slug`'s entry, or undefined before the data is written (the update run reads this module too). */
const find = (slug: string): GalleryEntry =>
  GALLERY_DATA.entries.find((entry) => entry.slug === slug) as GalleryEntry;

export const MADDER = find("madder");
export const KERMES = find("kermes");
export const TURQUOISE = find("turquoise");

/** A color literal: a hex, or a color function. */
const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/i;

/** The words of `text`'s whole-word matches in the M4 deny list. */
const denied = (text: string): string[] =>
  DENY_LIST.filter((word) => new RegExp(`\\b${word}\\b`, "i").test(text));

/** What breaks R6-12's bounds in one row: an empty list when it keeps them. */
export function wordProblems(row: {
  name: string;
  slug: string;
  brief: string | null;
  line: string;
}): readonly string[] {
  const problems: string[] = [];
  const { name, slug, brief, line } = row;
  if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name) || name.length > 18) {
    problems.push(`name "${name}" is not 1 to 18 letters and single spaces`);
  }
  if (!/^[a-z]+(-[a-z]+)*$/.test(slug)) problems.push(`slug "${slug}" is not lowercase words`);
  if (slug !== name.toLowerCase().replaceAll(" ", "-")) {
    problems.push(`slug "${slug}" is not the name with hyphens`);
  }
  if (brief !== null) {
    if (!isPlainText(brief)) problems.push("brief is not plain text");
    if (brief.length < 30 || brief.length > 100) {
      problems.push(`brief has ${brief.length} characters, not 30 to 100`);
    }
    if (!brief.endsWith(".") || brief.indexOf(".") !== brief.length - 1) {
      problems.push("brief is not one sentence ending in a period");
    }
    if (COLOR_LITERAL.test(brief)) problems.push("brief holds a color literal");
  }
  for (const [label, text] of [
    ["name", name],
    ["slug", slug],
    ["brief", brief ?? ""],
    ["line", line],
  ] as const) {
    for (const word of denied(text)) problems.push(`${label} holds the denied word "${word}"`);
  }
  for (const [label, text] of [
    ["name", name],
    ["brief", brief ?? ""],
    ["line", line],
  ] as const) {
    for (const problem of m6CopyProblems(text)) problems.push(`${label}: ${problem}`);
  }
  return problems;
}
