// The shared half of every import (R3-29): an `ImportDraft` becomes a spec laid over a generated
// base, and a report of what was read, adjusted and inferred. Internal: a bad draft is a bug in an
// importer, never a visitor's input, so it throws (R-05). Pure.

import type { DirectionParams } from "@/engine";
import {
  freshParams,
  type Gamut,
  gamutMap,
  generateSystem,
  type Hex,
  hexToRgb,
  type Mode,
  type NEUTRAL_TINTS,
  type Oklch,
  onFill,
  PAIRINGS,
  RADIUS_SET_NAMES,
  type RadiusSet,
  type Rgb,
  ROLE_NAMES,
  type RoleName,
  radiusScale,
  resolveParams,
  rgbToOklch,
  type TypeContext,
  toHex,
} from "@/engine";
import { sha256 } from "@/export/sha256";
import { type DesignSpec, DesignSpecSchema, normalizeSpec, toPlainText } from "@/spec";
import type { ParsedColor } from "./color";
import { familyId } from "./map";
import {
  describeType,
  IGNORED_MAX,
  type ImportFormat,
  type ImportReport,
  type ImportResult,
  type ReportDraft,
} from "./report";

export type ImportDraft = {
  readonly source: ImportFormat;
  /** The text after a leading byte-order mark is dropped and line ends are LF. */
  readonly normalized: string;
  readonly primary: Oklch;
  readonly secondary?: Oklch;
  readonly accent?: Oklch;
  readonly tintFrom?: Rgb;
  readonly radiusPx?: { readonly value: number; readonly from: "css" | "md" | "lg" };
  readonly bodyPx?: number;
  readonly displayPx?: number;
  /** Family names or stacks as the source wrote them; `buildImport` maps them to ids. */
  readonly families?: { readonly display?: string; readonly body?: string; readonly mono?: string };
  readonly roles: {
    readonly light: Partial<Record<RoleName, ParsedColor>>;
    readonly dark: Partial<Record<RoleName, ParsedColor>>;
  };
  /**
   * Prose text (R3-30) is cut by `toPlainText`. Verbatim text (R3-32, `verbatim: true`) is a decoded
   * spec's, kept exactly as it is: each field must already pass the spec's own rule. A `thesis`
   * comes only with prose text, a `direction` only with verbatim text.
   */
  readonly text: {
    verbatim?: true;
    name?: string;
    oneLiner?: string;
    thesis?: string;
    direction?: NonNullable<DirectionParams["direction"]>;
    do?: string[];
    dont?: string[];
  };
  readonly report: ReportDraft;
};

const FORMATS: readonly ImportFormat[] = ["design-md", "shadcn-css"];
const MODES: readonly Mode[] = ["light", "dark"];
const SRGB: Gamut = "srgb";
const NAME_MAX = 80;
const ONE_LINER_MAX = 140;
const THESIS_MAX = 280;
const RULES_MAX = 20;
const RULE_MAX = 200;
const DEFAULT_NAME = "Imported design";

// The seed fields of a draft ----------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`buildImport: ${name} must be an object, got ${describeType(value)}`);
  }
  return value;
}

function finite(value: unknown, name: string): number {
  if (typeof value !== "number") {
    throw new TypeError(`buildImport: ${name} must be a number, got ${describeType(value)}`);
  }
  if (!Number.isFinite(value)) throw new RangeError(`buildImport: ${name} must be finite`);
  return value;
}

function checkOklch(value: unknown, name: string): void {
  const color = record(value, name);
  const l = finite(color.l, `${name}.l`);
  const c = finite(color.c, `${name}.c`);
  if (l < 0 || l > 1) throw new RangeError(`buildImport: ${name}.l must be in [0, 1], got ${l}`);
  if (c < 0 || c > 0.5)
    throw new RangeError(`buildImport: ${name}.c must be in [0, 0.5], got ${c}`);
  if (color.h !== null) {
    const h = finite(color.h, `${name}.h`);
    if (h < 0 || h >= 360)
      throw new RangeError(`buildImport: ${name}.h must be in [0, 360), got ${h}`);
  }
}

function checkRgb(value: unknown, name: string): void {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new TypeError(`buildImport: ${name} must be three channels, got ${describeType(value)}`);
  }
  value.forEach((channel, i) => {
    finite(channel, `${name}[${i}]`);
  });
}

function checkRoles(value: unknown, name: string): void {
  const roles = record(value, name);
  for (const [role, parsed] of Object.entries(roles)) {
    if (!(ROLE_NAMES as readonly string[]).includes(role)) {
      throw new RangeError(`buildImport: ${name} holds the unknown role ${role}`);
    }
    const color = record(parsed, `${name}.${role}`);
    checkRgb(color.rgb, `${name}.${role}.rgb`);
    const alpha = finite(color.alpha, `${name}.${role}.alpha`);
    if (alpha < 0 || alpha > 1)
      throw new RangeError(`buildImport: ${name}.${role}.alpha must be in [0, 1]`);
    if (typeof color.inGamut !== "boolean") {
      throw new TypeError(`buildImport: ${name}.${role}.inGamut must be a boolean`);
    }
    if (typeof color.source !== "string") {
      throw new TypeError(`buildImport: ${name}.${role}.source must be a string`);
    }
  }
}

function checkStrings(value: unknown, name: string, keys: readonly string[]): void {
  const object = record(value, name);
  for (const key of keys) {
    if (object[key] !== undefined && typeof object[key] !== "string") {
      throw new TypeError(`buildImport: ${name}.${key} must be a string`);
    }
  }
}

function checkList(value: unknown, name: string): void {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new TypeError(`buildImport: ${name} must be a list of strings`);
  }
}

/** Throws a `TypeError` or `RangeError` naming `buildImport` for a draft no importer should make. */
function checkDraft(draft: unknown): asserts draft is ImportDraft {
  const input = record(draft, "draft");
  if (!FORMATS.includes(input.source as ImportFormat)) {
    throw new RangeError(`buildImport: draft.source must be one of ${FORMATS.join(", ")}`);
  }
  if (typeof input.normalized !== "string") {
    throw new TypeError(`buildImport: draft.normalized must be a string`);
  }
  checkOklch(input.primary, "draft.primary");
  for (const key of ["secondary", "accent"] as const) {
    if (input[key] !== undefined) checkOklch(input[key], `draft.${key}`);
  }
  if (input.tintFrom !== undefined) checkRgb(input.tintFrom, "draft.tintFrom");
  if (input.radiusPx !== undefined) {
    const radius = record(input.radiusPx, "draft.radiusPx");
    if (finite(radius.value, "draft.radiusPx.value") < 0) {
      throw new RangeError("buildImport: draft.radiusPx.value must not be negative");
    }
    if (!["css", "md", "lg"].includes(radius.from as string)) {
      throw new RangeError("buildImport: draft.radiusPx.from must be css, md or lg");
    }
  }
  for (const key of ["bodyPx", "displayPx"] as const) {
    if (input[key] !== undefined && finite(input[key], `draft.${key}`) <= 0) {
      throw new RangeError(`buildImport: draft.${key} must be positive`);
    }
  }
  if (input.families !== undefined) {
    checkStrings(input.families, "draft.families", ["display", "body", "mono"]);
  }
  const roles = record(input.roles, "draft.roles");
  checkRoles(roles.light, "draft.roles.light");
  checkRoles(roles.dark, "draft.roles.dark");
  const text = record(input.text, "draft.text");
  checkStrings(text, "draft.text", ["name", "oneLiner", "thesis"]);
  for (const key of ["do", "dont"] as const) {
    if (text[key] !== undefined) checkList(text[key], `draft.text.${key}`);
  }
  if (text.verbatim !== undefined && text.verbatim !== true) {
    throw new TypeError("buildImport: draft.text.verbatim must be true when present");
  }
  if (text.verbatim === true && text.thesis !== undefined) {
    throw new RangeError("buildImport: draft.text.thesis comes only with prose text");
  }
  if (text.direction !== undefined) {
    const direction = record(text.direction, "draft.text.direction");
    checkStrings(direction, "draft.text.direction", ["thesis"]);
    for (const key of ["adjectives", "like", "unlike"] as const) {
      if (direction[key] !== undefined) checkList(direction[key], `draft.text.direction.${key}`);
    }
    if (text.verbatim !== true) {
      throw new RangeError("buildImport: draft.text.direction comes only with verbatim text");
    }
  }
  const report = record(input.report, "draft.report");
  for (const key of ["ignored", "truncated", "notes"] as const) {
    checkList(report[key], `draft.report.${key}`);
  }
}

// Inference (R3-29 items 2 to 5) ------------------------------------------------------------------

const BRAND_DEGREES = 30;
const CHROMA_NONE = 0.005;

function clamp01(channel: number): number {
  return Math.min(1, Math.max(0, channel));
}

/** The neutral tint of a light `muted` (else `background`) color against the primary's hue. */
function inferTint(from: Rgb, primary: Oklch): (typeof NEUTRAL_TINTS)[number] {
  const { c, h } = rgbToOklch([clamp01(from[0]), clamp01(from[1]), clamp01(from[2])], SRGB);
  if (c < CHROMA_NONE || h === null) return "none";
  if (primary.h !== null) {
    const apart = Math.abs(h - primary.h);
    if (Math.min(apart, 360 - apart) <= BRAND_DEGREES) return "brand";
  }
  return h < 140 || h >= 330 ? "warm" : "cool";
}

/** The radius set whose `lg` (or `md`) is nearest; a tie goes to the rounder set. */
function inferRadius(radius: ImportDraft["radiusPx"]): RadiusSet {
  if (radius === undefined) return "soft";
  const key = radius.from === "md" ? "md" : "lg";
  let best: RadiusSet = "soft";
  let distance = Number.POSITIVE_INFINITY;
  for (const set of RADIUS_SET_NAMES) {
    const gap = Math.abs(radiusScale(set)[key] - radius.value);
    if (gap <= distance) {
      best = set;
      distance = gap;
    }
  }
  return best;
}

const DENSE_BELOW_PX = 15;
const LARGE_BODY_PX = 18;
const MARKETING_DISPLAY_PX = 64;

function inferContext(bodyPx?: number, displayPx?: number): TypeContext {
  if (bodyPx === undefined) return "product";
  if (bodyPx < DENSE_BELOW_PX) return "dense";
  if (bodyPx < LARGE_BODY_PX) return "product";
  return displayPx !== undefined && displayPx >= MARKETING_DISPLAY_PX ? "marketing" : "editorial";
}

type FamilyIds = { display?: string; body?: string; mono?: string };

function idsOf(families: ImportDraft["families"]): FamilyIds {
  const ids: FamilyIds = {};
  for (const key of ["display", "body", "mono"] as const) {
    const name = families?.[key];
    const id = name === undefined ? null : familyId(name);
    if (id !== null) ids[key] = id;
  }
  return ids;
}

// Text (R3-29 item 8, R3-30) ----------------------------------------------------------------------

type Text = {
  name: string;
  oneLiner?: string;
  direction?: NonNullable<DirectionParams["direction"]>;
  rules?: { do: string[]; dont: string[] };
  truncated: string[];
};

function cut(raw: string | undefined, max: number, field: string, truncated: string[]) {
  if (raw === undefined) return undefined;
  const plain = toPlainText(raw, max);
  if (plain === null || plain.truncated) truncated.push(field);
  return plain?.text;
}

function cutList(raw: readonly string[] | undefined, field: string, truncated: string[]) {
  const kept: string[] = [];
  let lost = false;
  for (const item of raw ?? []) {
    const plain = toPlainText(item, RULE_MAX);
    if (plain === null || kept.length >= RULES_MAX) lost = true;
    else {
      kept.push(plain.text);
      lost = lost || plain.truncated;
    }
  }
  if (lost) truncated.push(field);
  return kept;
}

const SPEC_SHAPE = DesignSpecSchema.shape;

/** A decoded spec's text, kept exactly (R3-32): each field passes the spec's own rule, or the draft is a bug. */
function keptText(text: ImportDraft["text"]): Text {
  const name = text.name ?? DEFAULT_NAME;
  const rules = { do: [...(text.do ?? [])], dont: [...(text.dont ?? [])] };
  const fields: readonly [string, unknown, { safeParse(value: unknown): { success: boolean } }][] =
    [
      ["name", name, SPEC_SHAPE.meta.shape.name],
      ["oneLiner", text.oneLiner, SPEC_SHAPE.meta.shape.oneLiner],
      ["direction", text.direction, SPEC_SHAPE.direction],
      ["rules", rules, SPEC_SHAPE.rules],
    ];
  for (const [field, value, rule] of fields) {
    if (value !== undefined && !rule.safeParse(value).success) {
      throw new RangeError(`buildImport: verbatim draft.text.${field} must be as a spec holds it`);
    }
  }
  return {
    name,
    ...(text.oneLiner === undefined ? {} : { oneLiner: text.oneLiner }),
    ...(text.direction === undefined ? {} : { direction: text.direction }),
    ...(rules.do.length === 0 && rules.dont.length === 0 ? {} : { rules }),
    truncated: [],
  };
}

function readText(text: ImportDraft["text"]): Text {
  if (text.verbatim === true) return keptText(text);
  const truncated: string[] = [];
  const name = cut(text.name, NAME_MAX, "name", truncated) ?? DEFAULT_NAME;
  const oneLiner = cut(text.oneLiner, ONE_LINER_MAX, "oneLiner", truncated);
  const thesis = cut(text.thesis, THESIS_MAX, "thesis", truncated);
  const direction = thesis === undefined ? undefined : { thesis };
  const doList = cutList(text.do, "do", truncated);
  const dontList = cutList(text.dont, "dont", truncated);
  return {
    name,
    ...(oneLiner === undefined ? {} : { oneLiner }),
    ...(direction === undefined ? {} : { direction }),
    ...(doList.length === 0 && dontList.length === 0
      ? {}
      : { rules: { do: doList, dont: dontList } }),
    truncated,
  };
}

// The overlay (R3-29 item 7) ----------------------------------------------------------------------

/** The fills of lint rule C5 and the text color each carries. */
const FILLS: readonly (readonly [fill: RoleName, foreground: RoleName])[] = [
  ["primary", "primary-foreground"],
  ["sidebar-primary", "sidebar-primary-foreground"],
  ["destructive", "destructive-foreground"],
  ["success", "success-foreground"],
  ["warning", "warning-foreground"],
  ["info", "info-foreground"],
];

type Adjusted = ImportReport["adjusted"][number];

/** An imported color as sRGB inside the gamut, flattened over `background` when it has alpha. */
function settle(
  parsed: ParsedColor,
  background: Rgb,
): { hex: Hex; gamut: boolean; alpha: boolean } {
  const inside: Rgb = parsed.inGamut
    ? [clamp01(parsed.rgb[0]), clamp01(parsed.rgb[1]), clamp01(parsed.rgb[2])]
    : gamutMap(rgbToOklch(parsed.rgb, SRGB), SRGB);
  const alpha = parsed.alpha < 1;
  const flat: Rgb = alpha
    ? [
        parsed.alpha * inside[0] + (1 - parsed.alpha) * background[0],
        parsed.alpha * inside[1] + (1 - parsed.alpha) * background[1],
        parsed.alpha * inside[2] + (1 - parsed.alpha) * background[2],
      ]
    : inside;
  return { hex: toHex(flat), gamut: !parsed.inGamut, alpha };
}

/** One mode's roles: the generated ones with each imported role laid over them. */
function overlay(
  mode: Mode,
  generated: Record<RoleName, Hex>,
  imported: Partial<Record<RoleName, ParsedColor>>,
  adjusted: Adjusted[],
): Record<RoleName, Hex> {
  const roles: Record<RoleName, Hex> = { ...generated };
  const names = Object.keys(imported) as RoleName[];
  // The imported background is flattened over the generated one; every other color, over it.
  const base = imported.background;
  const background: Rgb =
    base === undefined
      ? hexToRgb(generated.background)
      : hexToRgb(settle(base, hexToRgb(generated.background)).hex);
  for (const role of names) {
    const parsed = imported[role] as ParsedColor;
    const over = role === "background" ? hexToRgb(generated.background) : background;
    const { hex, gamut, alpha } = settle(parsed, over);
    roles[role] = hex;
    if (gamut) adjusted.push({ mode, role, reason: "gamut", from: parsed.source, to: hex });
    if (alpha) adjusted.push({ mode, role, reason: "alpha", from: parsed.source, to: hex });
  }
  for (const [fill, foreground] of FILLS) {
    if (imported[fill] === undefined || imported[foreground] !== undefined) continue;
    const to = onFill(hexToRgb(roles[fill]));
    adjusted.push({ mode, role: foreground, reason: "foreground", from: roles[foreground], to });
    roles[foreground] = to;
  }
  return roles;
}

function sameFamilies(a: FamilyIds, b: { display: string; body: string; mono: string }): boolean {
  return a.display === b.display && a.body === b.body && a.mono === b.mono;
}

// The build (R3-29) -------------------------------------------------------------------------------

/**
 * A design from a draft (R3-29): the generator runs on fresh parameters with the draft's seeds,
 * inferred choices and text at contrast level AA, and the seed `"import-"` plus the first 16 digits of
 * `sha256(normalized)`; each imported role then replaces the generated one. The result succeeds even
 * when it fails the linter (R3-42). A bad draft is a `TypeError` or `RangeError` naming `buildImport`.
 */
export function buildImport(draft: ImportDraft): ImportResult {
  checkDraft(draft);
  const seed = `import-${sha256(draft.normalized).slice(0, 16)}`;
  const fresh = freshParams();
  const tint =
    draft.tintFrom === undefined ? fresh.neutralTint : inferTint(draft.tintFrom, draft.primary);
  const radius = inferRadius(draft.radiusPx);
  const context = inferContext(draft.bodyPx, draft.displayPx);
  const ids = idsOf(draft.families);
  const pairing =
    ids.display === undefined || ids.body === undefined || ids.mono === undefined
      ? undefined
      : PAIRINGS.find((item) => sameFamilies(ids, item));
  const text = readText(draft.text);

  const params: DirectionParams = {
    ...fresh,
    primary: draft.primary,
    ...(draft.secondary === undefined ? {} : { secondary: draft.secondary }),
    ...(draft.accent === undefined ? {} : { accent: draft.accent }),
    neutralTint: tint,
    contrastLevel: "AA",
    type: { context },
    radius,
    name: text.name,
    ...(text.oneLiner === undefined ? {} : { oneLiner: text.oneLiner }),
    ...(text.direction === undefined ? {} : { direction: text.direction }),
    ...(text.rules === undefined ? {} : { rules: text.rules }),
    ...(pairing === undefined ? {} : { pairing: pairing.id }),
  };
  const base = generateSystem(resolveParams(params, seed), seed);

  const adjusted: Adjusted[] = [];
  const light = overlay(
    "light",
    base.color.roles.light as Record<RoleName, Hex>,
    draft.roles.light,
    adjusted,
  );
  const dark = overlay(
    "dark",
    base.color.roles.dark as Record<RoleName, Hex>,
    draft.roles.dark,
    adjusted,
  );
  const families = { ...base.type.families, ...(pairing === undefined ? ids : {}) };
  const spec: DesignSpec = normalizeSpec({
    ...base,
    meta: { ...base.meta, createdWith: "import" },
    color: { ...base.color, roles: { light, dark } },
    type: { ...base.type, families },
  });

  const mapped = MODES.flatMap((mode) =>
    (Object.keys(draft.roles[mode]) as RoleName[]).map((role) => ({
      mode,
      role,
      source: (draft.roles[mode][role] as ParsedColor).source,
    })),
  );
  const lightCount = Object.keys(draft.roles.light).length;
  const darkCount = Object.keys(draft.roles.dark).length;
  const report: ImportReport = {
    format: draft.source,
    exact: false,
    mapped,
    adjusted,
    generated: {
      light: ROLE_NAMES.length - lightCount,
      dark: ROLE_NAMES.length - darkCount,
      darkGenerated: darkCount === 0,
    },
    inferred: {
      tint,
      radius,
      context,
      pairing: pairing?.id ?? null,
      customFonts: !PAIRINGS.some((item) => sameFamilies(families, item)),
    },
    ignored: draft.report.ignored.slice(0, IGNORED_MAX),
    ignoredMore: Math.max(0, draft.report.ignored.length - IGNORED_MAX),
    truncated: [...draft.report.truncated, ...text.truncated],
    notes: [...draft.report.notes],
  };
  return { ok: true, spec, report };
}
