import {
  CONTRAST_CHECKS,
  type DirectionParams,
  type Finding,
  FONT_CATALOG,
  type ImagePalette,
  LOCKABLE,
  type Lockable,
  lintSpec,
  measureSpec,
  type Oklch,
  PAIRINGS,
  type PresetId,
} from "@/engine";
import { type DesignSpec, DesignSpecSchema } from "@/spec";
import type { z } from "@/spec/zod";
import { assertRecord, assertString, describeType, valueAt } from "./assert";
import {
  type BriefInput,
  type CritiqueInput,
  type FeatureInput,
  type HueOrNull,
  inputSchema,
  type RationaleInput,
  type RefineInput,
  type VibeInput,
} from "./features";

// The input builders of section 5.2: each builds its feature's input from the studio's state, then
// checks it against the feature's input schema, so what a builder returns is what the route accepts
// (R4-16). A wrong type is a TypeError and any other rejection a RangeError, each naming the builder.

const MAX_FINDINGS = 40;
const C1_IDS: readonly string[] = CONTRAST_CHECKS.filter((check) => check.rule === "C1").map(
  (check) => check.id,
);

/**
 * Whether a zod issue is a wrong type (R-05): a value missing or of another type than expected, or
 * outside a list whose values are of another type (a number where a name was expected). A number
 * that is not an integer is a value out of its domain, not a wrong type.
 */
function isWrongType(issue: z.core.$ZodIssue, candidate: unknown): boolean {
  const value = valueAt(candidate, issue.path);
  if (issue.code === "invalid_type") {
    return describeType(value) !== (issue.expected === "int" ? "number" : issue.expected);
  }
  if (issue.code !== "invalid_value") return false;
  return issue.values.every((allowed) => describeType(allowed) !== describeType(value));
}

/** The candidate, checked by its feature's input schema; a rejection throws, naming `caller`. */
function checked<F extends keyof FeatureInput>(
  feature: F,
  caller: string,
  candidate: unknown,
): FeatureInput[F] {
  const result = inputSchema(feature).safeParse(candidate);
  if (result.success) return result.data;
  const issues = result.error.issues;
  const wrong = issues.find((issue) => isWrongType(issue, candidate));
  const issue = wrong ?? issues[0];
  const where = issue.path.length > 0 ? issue.path.join(".") : "input";
  const message = `${caller}: ${where}: ${issue.message}`;
  throw wrong === undefined ? new RangeError(message) : new TypeError(message);
}

/** A seed's hue rounded to an integer, 360 written as 0, or null for a gray. */
function roundedHue(h: unknown, name: string): HueOrNull {
  if (h === null) return null;
  if (typeof h !== "number") {
    throw new TypeError(`${name} must be a number or null, got ${describeType(h)}`);
  }
  if (!Number.isFinite(h)) throw new RangeError(`${name} must be finite, got ${h}`);
  const rounded = Math.round(h);
  return rounded === 360 ? 0 : rounded;
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** The brief's input (R4-39): the cleaned brief and the hues of the locked slots. */
export function briefInput(text: string, locked: BriefInput["locked"]): BriefInput {
  assertString(text, "briefInput: text");
  assertRecord(locked, "briefInput: locked");
  // An undefined hue is an absent one, as everywhere in the studio.
  const present = Object.fromEntries(Object.entries(locked).filter(([, hue]) => hue !== undefined));
  return checked("brief", "briefInput", { brief: text, locked: present });
}

/** The refine's input (R4-45): the cleaned words and a summary of the held parameters and hues. */
export function refineInput(
  text: string,
  params: DirectionParams,
  seeds: Readonly<Record<Lockable, Oklch>>,
): RefineInput {
  assertString(text, "refineInput: text");
  assertRecord(params, "refineInput: params");
  assertRecord(params.type, "refineInput: params.type");
  assertRecord(seeds, "refineInput: seeds");
  const hues = Object.fromEntries(
    LOCKABLE.map((slot) => {
      const seed = seeds[slot];
      assertRecord(seed, `refineInput: seeds.${slot}`);
      return [slot, roundedHue(seed.h, `refineInput: seeds.${slot}.h`)];
    }),
  );
  return checked("refine", "refineInput", {
    text,
    current: {
      harmony: params.harmony,
      chroma: params.chroma,
      neutralTint: params.neutralTint,
      contrastLevel: params.contrastLevel,
      pairing: params.pairing ?? "auto",
      typeContext: params.type.context,
      radius: params.radius,
      depth: params.depth,
      motion: params.motion,
      hues,
    },
  });
}

/**
 * The vibe's input (section 9.3): each cluster with L and C to 3 decimals, its hue an integer (360 as
 * 0) or null, and its share to 3 decimals and at least 0.001; then the JPEG's data URL and size.
 */
export function vibeInput(
  palette: ImagePalette,
  jpeg: { dataUrl: string; width: number; height: number },
): VibeInput {
  assertRecord(palette, "vibeInput: palette");
  if (!Array.isArray(palette.clusters)) {
    throw new TypeError(
      `vibeInput: palette.clusters must be an array, got ${describeType(palette.clusters)}`,
    );
  }
  assertRecord(jpeg, "vibeInput: jpeg");
  const clusters = palette.clusters.map((cluster: unknown, i) => {
    assertRecord(cluster, `vibeInput: palette.clusters[${i}]`);
    const { oklch, share } = cluster;
    assertRecord(oklch, `vibeInput: palette.clusters[${i}].oklch`);
    const { l, c } = oklch;
    return {
      id: cluster.id,
      l: typeof l === "number" ? round3(l) : l,
      c: typeof c === "number" ? round3(c) : c,
      h: roundedHue(oklch.h, `vibeInput: palette.clusters[${i}].oklch.h`),
      share: typeof share === "number" ? Math.max(0.001, round3(share)) : share,
    };
  });
  const image = { dataUrl: jpeg.dataUrl, width: jpeg.width, height: jpeg.height };
  return checked("vibe", "vibeInput", { clusters, image });
}

/** A family's name: the catalog's, or the id with each `-` read as a space (as the export writes it). */
function familyName(id: string): string {
  return FONT_CATALOG.find((font) => font.id === id)?.family ?? id.replaceAll("-", " ");
}

/** A ratio cut (not rounded) to 2 decimals, read through 6 decimals first so 4.57 stays 4.57. */
const cut2 = (ratio: number) => Math.floor(Math.round(ratio * 1e6) / 1e4) / 100;

/**
 * The rationale's input (R4-49): the name, the preset, the label of the pairing whose three families
 * the spec uses (else null), the family names, the contrast level, the 26 C1 checks (light then
 * dark, each ratio cut to 2 decimals) and the lint counts.
 */
export function rationaleInput(spec: DesignSpec, preset: PresetId | null): RationaleInput {
  assertRecord(spec, "rationaleInput: spec");
  if (preset !== null) assertString(preset, "rationaleInput: preset");
  if (!DesignSpecSchema.safeParse(spec).success) {
    throw new RangeError("rationaleInput: spec is not a valid dyelot.spec/1 design");
  }
  const { display, body, mono } = spec.type.families;
  const pairing = PAIRINGS.find(
    (entry) => entry.display === display && entry.body === body && entry.mono === mono,
  );
  const checks = measureSpec(spec)
    .contrast.filter((entry) => C1_IDS.includes(entry.check))
    .map(({ check, mode, ratio }) => ({ check, mode, ratio: cut2(ratio) }));
  const findings = lintSpec(spec);
  const count = (severity: Finding["severity"]) =>
    findings.filter((finding) => finding.severity === severity).length;
  return checked("rationale", "rationaleInput", {
    name: spec.meta.name,
    preset,
    pairing: pairing?.label ?? null,
    families: { display: familyName(display), body: familyName(body), mono: familyName(mono) },
    contrastLevel: spec.color.params.contrastLevel,
    checks,
    lint: { error: count("error"), warn: count("warn"), info: count("info") },
  });
}

/** The critique's input (R4-50): the first 40 findings, in lintSpec's order, without their source. */
export function critiqueInput(findings: readonly Finding[]): CritiqueInput {
  if (!Array.isArray(findings)) {
    throw new TypeError(`critiqueInput: findings must be an array, got ${describeType(findings)}`);
  }
  const kept = findings.slice(0, MAX_FINDINGS).map((finding: unknown, i) => {
    assertRecord(finding, `critiqueInput: findings[${i}]`);
    const { id, severity, mode, subject, measured, threshold } = finding;
    return { id, severity, mode, subject, measured, threshold };
  });
  return checked("critique", "critiqueInput", { findings: kept });
}
