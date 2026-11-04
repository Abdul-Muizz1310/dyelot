// The DESIGN.md importer (R3-30, R3-32): the front matter and the yaml fences are parsed with `yaml`,
// the tokens map onto an `ImportDraft` for `buildImport` (R3-29), and a file dyelot wrote re-imports
// exactly through its edit link. Pure; never throws for a string (I-M3-05).

import {
  type DocumentOptions,
  isAlias,
  isMap,
  isNode,
  LineCounter,
  type ParseOptions,
  parseDocument,
  type SchemaOptions,
  visit,
} from "yaml";
import type { RoleName } from "@/engine";
import { PAIRINGS, ROLE_NAMES } from "@/engine";
import { designMdTokens } from "@/export/design-md-tokens";
import { type DesignSpec, decodeSpec } from "@/spec";
import { buildImport, type ImportDraft } from "./build";
import { type ParsedColor, parseCssColor } from "./color";
import { seedOf } from "./css";
import { isRole, lengthPx } from "./map";
import { checkInput, type ImportError, type ImportReport, type ImportResult } from "./report";

/** All YAML of a file together may hold this many bytes (R3-30). */
const YAML_MAX_BYTES = 65_536;
/** A seed color needs at least this much chroma (R3-29). */
const SEED_CHROMA = 0.04;
/** An edit link is tried this many times at most. */
const LINKS_MAX = 5;
/** A group name in a message is cut to this many characters. */
const GROUP_MAX = 64;
const NOTES_MAX = 20;

const ALIASES: Readonly<Record<string, RoleName>> = Object.freeze({
  surface: "background",
  background: "background",
  "on-surface": "foreground",
  "on-background": "foreground",
  text: "foreground",
  "on-primary": "primary-foreground",
  error: "destructive",
  "on-error": "destructive-foreground",
  outline: "border",
});

type Block = { readonly text: string; readonly line: number };
type Json = Record<string, unknown>;

// The file's structure ----------------------------------------------------------------------------

type Structure = {
  readonly front: Block | null;
  readonly blocks: readonly Block[];
  readonly name?: string;
  readonly thesis?: string;
  readonly rules: { do: string[]; dont: string[] };
};

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})\s*([^\n]*)$/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/;
const HEADING = /^ {0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const DO_RULES = /^do[’']?s and don[’']?ts$/i;

/** The index of the line after a leading run of blank lines and HTML comments. */
function skipLeading(lines: readonly string[]): number {
  let i = 0;
  for (;;) {
    while (i < lines.length && (lines[i] as string).trim() === "") i += 1;
    const line = (lines[i] ?? "").trim();
    if (!line.startsWith("<!--")) return i;
    let end = i;
    while (end < lines.length && !(lines[end] as string).includes("-->")) end += 1;
    if (end >= lines.length) return lines.length;
    if ((lines[end] as string).trim().endsWith("-->")) i = end + 1;
    else return i;
  }
}

function structure(normalized: string): Structure {
  const lines = normalized.split("\n");
  let front: Block | null = null;
  let start = 0;
  const first = skipLeading(lines);
  if ((lines[first] ?? "").trimEnd() === "---") {
    const close = lines.findIndex((line, i) => i > first && line.trimEnd() === "---");
    if (close !== -1) {
      front = { text: lines.slice(first + 1, close).join("\n"), line: first + 2 };
      start = close + 1;
    }
  }

  const blocks: Block[] = [];
  const rules = { do: [] as string[], dont: [] as string[] };
  let name: string | undefined;
  let thesis: string | undefined;
  let section = "";
  let paragraph: string[] | null = null;
  let thesisDone = false;
  let bullet: { kind: "do" | "dont"; text: string } | null = null;
  let fence: { char: string; size: number; yaml: boolean; from: number; body: string[] } | null =
    null;

  const endBullet = (): void => {
    if (bullet !== null) rules[bullet.kind].push(bullet.text);
    bullet = null;
  };
  const endParagraph = (): void => {
    if (paragraph !== null && paragraph.length > 0 && !thesisDone && thesis === undefined) {
      thesis = paragraph.join(" ");
      thesisDone = true;
    }
    paragraph = null;
  };

  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i] as string;
    if (fence !== null) {
      const close = FENCE_CLOSE.exec(line);
      if (
        close !== null &&
        (close[1] as string).startsWith(fence.char) &&
        (close[1] as string).length >= fence.size
      ) {
        if (fence.yaml) blocks.push({ text: fence.body.join("\n"), line: fence.from + 1 });
        fence = null;
      } else fence.body.push(line);
      continue;
    }
    const open = FENCE_OPEN.exec(line);
    if (
      open !== null &&
      !((open[1] as string).startsWith("`") && (open[2] as string).includes("`"))
    ) {
      endBullet();
      endParagraph();
      const marker = open[1] as string;
      const word = (open[2] as string).trim().split(/\s+/)[0] ?? "";
      fence = {
        char: marker.charAt(0),
        size: marker.length,
        yaml: word.toLowerCase() === "yaml",
        from: i + 1,
        body: [],
      };
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading !== null) {
      endBullet();
      endParagraph();
      const level = (heading[1] as string).length;
      const text = heading[2] ?? "";
      if (level === 1 && name === undefined && text !== "") name = text;
      if (level <= 2) {
        section = level === 2 ? text.trim() : "";
        paragraph = null;
        thesisDone = thesis !== undefined;
      }
      continue;
    }
    if (section === "Overview") {
      if (line.trim() === "") endParagraph();
      else if (!thesisDone) {
        paragraph = [...(paragraph ?? []), line.trim()];
      }
    } else if (DO_RULES.test(section)) {
      const item = BULLET.exec(line);
      if (item !== null) {
        endBullet();
        const text = item[1] as string;
        if (text.startsWith("Do ")) bullet = { kind: "do", text: text.slice(3) };
        else if (text.startsWith("Don't ") || text.startsWith("Don’t ")) {
          bullet = { kind: "dont", text: text.slice(6) };
        }
      } else if (/^\s+\S/.test(line) && bullet !== null) bullet.text += ` ${line.trim()}`;
      else endBullet();
    }
  }
  endBullet();
  endParagraph();
  const unclosed = fence as { yaml: boolean; from: number; body: string[] } | null;
  if (unclosed?.yaml) blocks.push({ text: unclosed.body.join("\n"), line: unclosed.from + 1 });
  return {
    front,
    blocks,
    rules,
    ...(name === undefined ? {} : { name }),
    ...(thesis === undefined ? {} : { thesis }),
  };
}

// YAML (R3-30, section 8) -------------------------------------------------------------------------

function fail(error: ImportError): { readonly ok: false; readonly error: ImportError } {
  return { ok: false, error };
}

const yamlError = (line: number): ImportError => ({
  code: "yaml",
  message: `The YAML on line ${line} could not be read. Check its indentation and quotes, then import again.`,
  line,
});

const aliasError = (line: number): ImportError => ({
  code: "yaml-alias",
  message: `The YAML uses an anchor or an alias on line ${line}. Write the values out in full, then import again.`,
  line,
});

type Parsed = { readonly tokens: Json } | { readonly error: ImportError };

/** One block's top-level groups, or the first error of it. */
function parseBlock(block: Block): Parsed {
  try {
    const lineCounter = new LineCounter();
    // R3-30's options; `maxAliasCount` is read by `toJS`, so the typings leave it off.
    const options = { schema: "core", uniqueKeys: true, maxAliasCount: 0, lineCounter };
    const doc = parseDocument(
      block.text,
      options as ParseOptions & DocumentOptions & SchemaOptions,
    );
    const lineOf = (offset: number | undefined): number =>
      block.line + lineCounter.linePos(offset ?? 0).line - 1;
    let aliasLine = Number.POSITIVE_INFINITY;
    visit(doc, (_key, node) => {
      if (!isNode(node)) return undefined;
      const anchored = "anchor" in node && typeof node.anchor === "string";
      if (anchored || isAlias(node)) {
        const at = node.range?.[0] ?? 0;
        // A node's range starts at its value; the anchor may sit on an earlier line.
        const mark = anchored ? block.text.lastIndexOf(`&${node.anchor}`, at) : -1;
        aliasLine = Math.min(aliasLine, lineOf(mark === -1 ? at : mark));
      }
      return undefined;
    });
    const first = doc.errors[0];
    const errorLine = first === undefined ? Number.POSITIVE_INFINITY : lineOf(first.pos[0]);
    if (aliasLine <= errorLine && aliasLine !== Number.POSITIVE_INFINITY) {
      return { error: aliasError(aliasLine) };
    }
    if (first !== undefined) return { error: yamlError(errorLine) };
    if (!isMap(doc.contents)) return { tokens: Object.create(null) as Json };
    const value = doc.toJS({ maxAliasCount: 0 }) as unknown;
    const tokens = Object.create(null) as Json;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      for (const key of Object.keys(value)) tokens[key] = (value as Json)[key];
    }
    return { tokens };
  } catch {
    // A document nested deeper than the parser can follow.
    return { error: yamlError(block.line) };
  }
}

// Tokens ------------------------------------------------------------------------------------------

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function own(value: Json, key: string): unknown {
  return Object.hasOwn(value, key) ? value[key] : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, i) => deepEqual(item, b[i]))
    );
  }
  if (!isJson(a) || !isJson(b)) return false;
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && deepEqual(a[key], b[key]))
  );
}

/** The first of the named tokens, else the first token whose name starts with one of `prefixes`. */
function pickToken(
  group: Json,
  names: readonly string[],
  prefixes: readonly string[],
): Json | undefined {
  for (const name of names) {
    const token = own(group, name);
    if (isJson(token)) return token;
  }
  for (const key of Object.keys(group)) {
    const token = group[key];
    if (isJson(token) && prefixes.some((prefix) => key.startsWith(prefix))) return token;
  }
  return undefined;
}

function sizeOf(token: Json | undefined): number | undefined {
  const raw = token === undefined ? undefined : own(token, "fontSize");
  const px = typeof raw === "string" || typeof raw === "number" ? lengthPx(String(raw)) : null;
  return px === null || px <= 0 ? undefined : px;
}

type Colors = {
  readonly light: Partial<Record<RoleName, ParsedColor>>;
  readonly ignored: string[];
  readonly notes: string[];
  readonly seeds: Partial<Record<"secondary" | "tertiary" | "accent", ParsedColor>>;
};

function readColors(group: unknown): Colors {
  const light: Partial<Record<RoleName, ParsedColor>> = {};
  const ignored: string[] = [];
  const notes: string[] = [];
  const seeds: Colors["seeds"] = {};
  const direct = new Set<RoleName>();
  if (!isJson(group)) return { light, ignored, notes, seeds };
  let unreadable = 0;
  for (const name of Object.keys(group)) {
    const value = group[name];
    const parsed = typeof value === "string" ? parseCssColor(value) : null;
    if ((name === "tertiary" || name === "accent" || name === "secondary") && parsed !== null) {
      seeds[name] = parsed;
    }
    const role: RoleName | undefined = isRole(name)
      ? name
      : Object.hasOwn(ALIASES, name)
        ? (ALIASES[name] as RoleName)
        : undefined;
    if (role === undefined) {
      ignored.push(name);
      continue;
    }
    if (parsed === null) {
      unreadable += 1;
      if (unreadable <= NOTES_MAX) {
        notes.push(`The value of colors.${name} could not be read, so it was skipped.`);
      }
      continue;
    }
    const isDirect = name === role;
    if (light[role] !== undefined && (direct.has(role) || !isDirect)) {
      ignored.push(name);
      continue;
    }
    if (light[role] !== undefined) {
      const replaced = [...Object.keys(group)].find((key) => key !== name && ALIASES[key] === role);
      if (replaced !== undefined) ignored.push(replaced);
    }
    light[role] = parsed;
    if (isDirect) direct.add(role);
  }
  if (unreadable > NOTES_MAX)
    notes.push(`${unreadable - NOTES_MAX} more colors could not be read.`);
  return { light, ignored, notes, seeds };
}

// The exact re-import (R3-32) ---------------------------------------------------------------------

const LINK = /https?:\/\/[^\s<>"'`]*?\/studio#s=([A-Za-z0-9_-]+)/g;

function sameFamilies(spec: DesignSpec, pairing: (typeof PAIRINGS)[number]): boolean {
  const { display, body, mono } = spec.type.families;
  return display === pairing.display && body === pairing.body && mono === pairing.mono;
}

function exactResult(spec: DesignSpec): ImportResult {
  const pairing = PAIRINGS.find((item) => sameFamilies(spec, item));
  const mapped = (["light", "dark"] as const).flatMap((mode) =>
    ROLE_NAMES.map((role) => ({ mode, role, source: spec.color.roles[mode][role] })),
  );
  const report: ImportReport = {
    format: "design-md",
    exact: true,
    mapped,
    adjusted: [],
    generated: { light: 0, dark: 0, darkGenerated: false },
    inferred: {
      tint: spec.color.params.neutralTint,
      radius: spec.shape.radiusSet,
      context: spec.type.context,
      pairing: pairing?.id ?? null,
      customFonts: pairing === undefined,
    },
    ignored: [],
    ignoredMore: 0,
    truncated: [],
    notes: [],
  };
  return { ok: true, spec, report };
}

/** The spec of the first edit link that decodes, whether any link was found, and the links' count. */
function readLink(normalized: string): { spec: DesignSpec | null; found: boolean } {
  let tries = 0;
  let found = false;
  for (const match of normalized.matchAll(LINK)) {
    found = true;
    if (tries >= LINKS_MAX) break;
    tries += 1;
    try {
      return { spec: decodeSpec(match[1] as string), found };
    } catch {
      // Try the next link.
    }
  }
  return { spec: null, found };
}

// The import --------------------------------------------------------------------------------------

/**
 * Reads a DESIGN.md into a design (R3-29, R3-30, R3-32). A file that holds an edit link whose design
 * has the file's own tokens comes back exactly; any other file is read by its tokens and prose. A
 * non-string is a `TypeError`.
 */
export function importDesignMd(text: string): ImportResult {
  const checked = checkInput(text, "importDesignMd");
  if (!checked.ok) return checked;
  const { normalized } = checked;
  const parts = structure(normalized);

  const all = [...(parts.front === null ? [] : [parts.front]), ...parts.blocks];
  const encoder = new TextEncoder();
  const bytes = all.reduce((sum, block) => sum + encoder.encode(block.text).length, 0);
  if (bytes > YAML_MAX_BYTES) {
    return fail({
      code: "yaml-too-large",
      message: "The YAML holds more than 64 KB. Keep the tokens under 64 KB, then import again.",
    });
  }

  const groups = Object.create(null) as Json;
  let frontTokens: Json | null = null;
  for (const block of all) {
    const parsed = parseBlock(block);
    if ("error" in parsed) return fail(parsed.error);
    for (const key of Object.keys(parsed.tokens)) {
      if (Object.hasOwn(groups, key)) {
        return fail({
          code: "yaml-group-twice",
          message: `The YAML defines ${key.slice(0, GROUP_MAX)} twice. Keep one definition, then import again.`,
        });
      }
      groups[key] = parsed.tokens[key];
    }
    if (block === parts.front) frontTokens = parsed.tokens;
  }

  const notes: string[] = [];
  const link = readLink(normalized);
  if (link.spec !== null) {
    if (frontTokens !== null && deepEqual(designMdTokens(link.spec), { ...frontTokens })) {
      return exactResult(link.spec);
    }
    notes.push("The edit link was ignored because the tokens changed.");
  } else if (link.found) notes.push("The edit link could not be read.");

  const colors = readColors(own(groups, "colors"));
  const primary = colors.light.primary;
  if (primary === undefined) {
    return fail({
      code: "no-primary",
      message: "No primary color was found. Add a primary color, then import again.",
    });
  }
  const ignored = [
    ...colors.ignored,
    ...Object.keys(groups).filter(
      (key) => !["version", "name", "description", "colors", "typography", "rounded"].includes(key),
    ),
  ];

  const seed = (color: ParsedColor | undefined) => {
    if (color === undefined) return undefined;
    const oklch = seedOf(color);
    return oklch.c >= SEED_CHROMA ? oklch : undefined;
  };
  const secondary = seed(colors.seeds.secondary);
  const accent = seed(colors.seeds.tertiary ?? colors.seeds.accent);

  const typography = own(groups, "typography");
  const type = isJson(typography) ? typography : {};
  const bodyToken = pickToken(type, ["body", "body-md"], ["body"]);
  const displayToken = pickToken(type, ["display", "display-lg"], ["display", "headline"]);
  const monoKey = Object.keys(type).find((key) => key.includes("mono") || key.includes("code"));
  const monoToken = monoKey === undefined ? undefined : type[monoKey];
  const family = (token: unknown): string | undefined =>
    isJson(token) ? str(own(token, "fontFamily")) : undefined;
  const families = {
    ...(family(displayToken) === undefined ? {} : { display: family(displayToken) as string }),
    ...(family(bodyToken) === undefined ? {} : { body: family(bodyToken) as string }),
    ...(family(monoToken) === undefined ? {} : { mono: family(monoToken) as string }),
  };
  const bodyPx = sizeOf(bodyToken);
  const displayPx = sizeOf(displayToken);

  const rounded = own(groups, "rounded");
  const radii = isJson(rounded) ? rounded : {};
  const radiusOf = (key: string): number | null => {
    const raw = own(radii, key);
    return typeof raw === "string" || typeof raw === "number" ? lengthPx(String(raw)) : null;
  };
  const lg = radiusOf("lg");
  const md = radiusOf("md");
  const radiusPx =
    lg !== null
      ? { value: lg, from: "lg" as const }
      : md !== null
        ? { value: md, from: "md" as const }
        : undefined;

  const tint = colors.light.muted ?? colors.light.background;
  const name = str(own(groups, "name")) ?? parts.name;
  const description = str(own(groups, "description"));

  const draft: ImportDraft = {
    source: "design-md",
    normalized,
    primary: seedOf(primary),
    ...(secondary === undefined ? {} : { secondary }),
    ...(accent === undefined ? {} : { accent }),
    ...(tint === undefined ? {} : { tintFrom: tint.rgb }),
    ...(radiusPx === undefined ? {} : { radiusPx }),
    ...(bodyPx === undefined ? {} : { bodyPx }),
    ...(displayPx === undefined ? {} : { displayPx }),
    ...(Object.keys(families).length === 0 ? {} : { families }),
    roles: { light: colors.light, dark: {} },
    text: {
      ...(name === undefined ? {} : { name }),
      ...(description === undefined ? {} : { oneLiner: description }),
      ...(parts.thesis === undefined ? {} : { thesis: parts.thesis }),
      ...(parts.rules.do.length === 0 ? {} : { do: parts.rules.do }),
      ...(parts.rules.dont.length === 0 ? {} : { dont: parts.rules.dont }),
    },
    report: { ignored, truncated: [], notes: [...notes, ...colors.notes] },
  };
  return buildImport(draft);
}
