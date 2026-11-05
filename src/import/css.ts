// The shadcn theme importer (R3-31): a scanner reads the light and dark declarations of a stylesheet,
// colors are read by `color.ts`, and the draft goes to `buildImport` (R3-29). Pure; never throws
// for a string (I-M3-05).

import type { Mode, RoleName } from "@/engine";
import { gamutMap, rgbToOklch } from "@/engine";
import { buildImport, type ImportDraft } from "./build";
import { cleanValue, type ParsedColor, parseCssColor } from "./color";
import { familyId, isRole, lengthPx } from "./map";
import { checkInput, failure, type ImportResult } from "./report";

type Declaration = { readonly name: string; readonly value: string };
type Declarations = { readonly light: Declaration[]; readonly dark: Declaration[] };

/** What a block's declarations count for. */
type Frame = {
  readonly light: boolean;
  readonly dark: boolean;
  /** A style rule (not an at-rule), so its declarations are read. */
  readonly style: boolean;
  /** Inside a rule or at-rule whose contents are never read. */
  readonly skip: boolean;
  /** Inside `@media (prefers-color-scheme: dark)`. */
  readonly darkMedia: boolean;
};

const TOP: Frame = { light: false, dark: false, style: false, skip: false, darkMedia: false };
const SKIPPED: Frame = { ...TOP, skip: true };
const DARK_MEDIA = /\(\s*prefers-color-scheme\s*:\s*dark\s*\)/i;
const LIGHT_SELECTORS: ReadonlySet<string> = new Set([
  ":root",
  ":root:not(.dark)",
  "html",
  ".light",
  '[data-theme="light"]',
]);
const DARK_SELECTORS: ReadonlySet<string> = new Set([
  ".dark",
  ":root.dark",
  "html.dark",
  '[data-theme="dark"]',
]);
const ROOTS: ReadonlySet<string> = new Set([":root", "html"]);

/** A selector in one spelling: white space folded and single quotes written as double. */
function normalizeSelector(selector: string): string {
  return selector.trim().replace(/\s+/g, " ").replace(/'/g, '"');
}

/** The top-level parts of a selector list. */
function splitList(prelude: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < prelude.length; i += 1) {
    const char = prelude.charAt(i);
    if (quote !== "") {
      if (char === "\\") i += 1;
      else if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(" || char === "[") depth += 1;
    else if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
    else if (char === "," && depth === 0) {
      parts.push(prelude.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(prelude.slice(start));
  return parts;
}

/** The frame of the block a prelude opens inside `parent`. */
function openBlock(prelude: string, parent: Frame): Frame {
  if (parent.skip || parent.style) return SKIPPED;
  if (prelude.startsWith("@")) {
    const name = /^@([\w-]+)/.exec(prelude)?.[1]?.toLowerCase();
    if (name === "layer") return parent;
    if (name === "media" && (parent.darkMedia || DARK_MEDIA.test(prelude))) {
      return { ...TOP, darkMedia: true };
    }
    return SKIPPED;
  }
  let light = false;
  let dark = false;
  for (const part of splitList(prelude)) {
    const selector = normalizeSelector(part);
    if (parent.darkMedia && ROOTS.has(selector)) dark = true;
    else if (LIGHT_SELECTORS.has(selector)) light = true;
    else if (DARK_SELECTORS.has(selector)) dark = true;
  }
  return light || dark
    ? { light, dark, style: true, skip: false, darkMedia: parent.darkMedia }
    : SKIPPED;
}

/**
 * The custom-property declarations of the light and dark blocks, in input order (R3-31). Comments
 * come out, quoted strings stay whole, and braces are counted; an unclosed block ends with the text.
 */
function scan(text: string): Declarations {
  const light: Declaration[] = [];
  const dark: Declaration[] = [];
  const stack: Frame[] = [];
  let frame = TOP;
  let buffer = "";
  let parens = 0;

  const flush = (): void => {
    const statement = buffer.trim();
    buffer = "";
    if (!frame.style || frame.skip || !statement.startsWith("--")) return;
    const colon = statement.indexOf(":");
    if (colon < 3) return;
    const name = statement.slice(0, colon).trim();
    if (/\s/.test(name)) return;
    const declaration = { name, value: statement.slice(colon + 1) };
    if (frame.light) light.push(declaration);
    if (frame.dark) dark.push(declaration);
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (char === "/" && text.charAt(i + 1) === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 1;
      buffer += " ";
    } else if (char === '"' || char === "'") {
      let j = i + 1;
      while (j < text.length && text.charAt(j) !== char && text.charAt(j) !== "\n") {
        j += text.charAt(j) === "\\" ? 2 : 1;
      }
      const end = text.charAt(j) === char ? j + 1 : Math.min(j, text.length);
      buffer += text.slice(i, end);
      i = end - 1;
    } else if (char === "\\") {
      buffer += text.slice(i, i + 2);
      i += 1;
    } else if (char === "{") {
      stack.push(frame);
      frame = openBlock(buffer.trim(), frame);
      buffer = "";
      parens = 0;
    } else if (char === "}") {
      flush();
      frame = stack.pop() ?? TOP;
      parens = 0;
    } else if (char === ";" && parens === 0) flush();
    else {
      if (char === "(") parens += 1;
      else if (char === ")") parens = Math.max(0, parens - 1);
      buffer += char;
    }
  }
  flush();
  return { light, dark };
}

/** The last declaration of each name, in the order of the names' first declarations. */
function lastWins(declarations: readonly Declaration[]): Map<string, string> {
  const winners = new Map<string, string>();
  for (const { name, value } of declarations) {
    winners.set(name, cleanValue(value));
  }
  return winners;
}

const VAR = /^var\(\s*(--[^\s,()]+)\s*\)$/i;

/** A value with a whole-value `var()` resolved once against the same mode; `null` when it cannot be. */
function resolveVar(value: string, declared: ReadonlyMap<string, string>): string | null {
  const match = VAR.exec(value);
  if (match === null) return value;
  const target = declared.get(match[1] as string);
  return target === undefined || /^var\(/i.test(target) ? null : target;
}

/** At most this many unreadable values are named in the notes. */
const NOTES_MAX = 20;

const FONT_NAMES = ["--font-sans", "--font-serif", "--font-mono"] as const;

type ModeRead = {
  readonly roles: Partial<Record<RoleName, ParsedColor>>;
  readonly named: ReadonlyMap<string, string>;
  /** Role variables declared, readable or not. */
  readonly declared: number;
};

/** Reads one mode's declarations: colors by role, and the names the importer ignores. */
function readMode(
  mode: Mode,
  winners: ReadonlyMap<string, string>,
  ignored: Set<string>,
  notes: string[],
): ModeRead {
  const roles: Partial<Record<RoleName, ParsedColor>> = {};
  let declared = 0;
  let unreadable = 0;
  for (const [name, value] of winners) {
    const role = name.slice(2);
    if (name === "--radius" || (FONT_NAMES as readonly string[]).includes(name)) continue;
    if (!isRole(role)) {
      ignored.add(name);
      continue;
    }
    declared += 1;
    const resolved = resolveVar(value, winners);
    const parsed = resolved === null ? null : parseCssColor(resolved);
    if (parsed === null) {
      unreadable += 1;
      if (unreadable <= NOTES_MAX) {
        notes.push(`The ${mode} value of ${name} could not be read, so it was skipped.`);
      }
    } else roles[role] = { ...parsed, source: value };
  }
  if (unreadable > NOTES_MAX) {
    notes.push(`${unreadable - NOTES_MAX} more ${mode} values could not be read.`);
  }
  return { roles, named: winners, declared };
}

/**
 * Reads a shadcn theme stylesheet into a design (R3-29, R3-31). `{ ok: false }` for a text it cannot
 * read, `no-roles` when no light block declares a role and `no-primary` when the light `primary` is
 * missing or unreadable. A non-string is a `TypeError`.
 */
export function importShadcnCss(text: string): ImportResult {
  const checked = checkInput(text, "importShadcnCss");
  if (!checked.ok) return checked;
  const { light, dark } = scan(checked.normalized);
  const lightWinners = lastWins(light);
  const darkWinners = lastWins(dark);
  const ignored = new Set<string>();
  const notes: string[] = [];
  const lightRead = readMode("light", lightWinners, ignored, notes);
  const darkRead = readMode("dark", darkWinners, ignored, notes);
  if (lightRead.declared === 0) return failure("no-roles");
  const primary = lightRead.roles.primary;
  if (primary === undefined) return failure("no-primary");

  const lengthOf = (name: string): string | undefined =>
    lightWinners.get(name) ?? darkWinners.get(name);
  const radius = lengthOf("--radius");
  const radiusPx = radius === undefined ? null : lengthPx(radius);
  if (radius !== undefined && radiusPx === null) {
    notes.push("The value of --radius could not be read, so it was skipped.");
  }
  const sans = lengthOf("--font-sans");
  const serif = lengthOf("--font-serif");
  const mono = lengthOf("--font-mono");
  const body = sans !== undefined && familyId(sans) !== null ? sans : undefined;
  const display = serif !== undefined && familyId(serif) !== null ? serif : body;
  const families = {
    ...(display === undefined ? {} : { display }),
    ...(body === undefined ? {} : { body }),
    ...(mono !== undefined && familyId(mono) !== null ? { mono } : {}),
  };
  const tint = lightRead.roles.muted ?? lightRead.roles.background;

  const draft: ImportDraft = {
    source: "shadcn-css",
    normalized: checked.normalized,
    primary: seedOf(primary),
    ...(tint === undefined ? {} : { tintFrom: tint.rgb }),
    ...(radiusPx === null ? {} : { radiusPx: { value: radiusPx, from: "css" as const } }),
    ...(Object.keys(families).length === 0 ? {} : { families }),
    roles: { light: lightRead.roles, dark: darkRead.roles },
    text: { name: "Imported theme" },
    report: { ignored: [...ignored], truncated: [], notes },
  };
  return buildImport(draft);
}

/** The chroma ceiling of the engine's seed domain (`CHROMA_CEILING`). */
const SEED_CHROMA_MAX = 0.5;

/**
 * The seed a primary color gives the generator: its gamut-mapped OKLCH, clamped into the seed
 * domain because the round trip can drift past it by a float (white gives `l` 1.0000000000000002).
 */
export function seedOf(primary: ParsedColor): ImportDraft["primary"] {
  const { l, c, h } = rgbToOklch(gamutMap(rgbToOklch(primary.rgb, "srgb"), "srgb"), "srgb");
  return { l: Math.min(1, Math.max(0, l)), c: Math.min(SEED_CHROMA_MAX, Math.max(0, c)), h };
}
