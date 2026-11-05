import {
  CONTRAST_CHECKS,
  ENGINE_VERSION,
  lintSpec,
  measureSpec,
  presetOf,
  ROLE_NAMES,
  summarize,
} from "@/engine";
import { type DesignSpec, isPlainText, lotTag, specId } from "@/spec";
import { fmt4, round1, trunc4 } from "./format";
import { themeModel } from "./model";
import { sha256 } from "./sha256";
import { editLink } from "./text";
import type { BundleFile } from "./types";

// `receipt.json` (section 7.1, R3-23): the measurements of a design and the hash of every other
// file. It reads no clock, locale or randomness, so it has no timestamp and the same input gives the
// same bytes.

export const RECEIPT_FORMAT = "dyelot.check/1";

const SEPARATION_THRESHOLD = 0.08;
const WCAG_RULES: ReadonlySet<string> = new Set(["C1", "C2", "C5", "N1", "N2", "N3", "F1"]);

function describeType(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function check(spec: unknown, others: unknown, origin: unknown): readonly BundleFile[] {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`receiptJson: spec must be an object, got ${describeType(spec)}`);
  }
  if (!Array.isArray(others)) {
    throw new TypeError(`receiptJson: others must be an array, got ${describeType(others)}`);
  }
  if (typeof origin !== "string") {
    throw new TypeError(`receiptJson: origin must be a string, got ${describeType(origin)}`);
  }
  const seen = new Set<string>();
  for (const file of others as BundleFile[]) {
    if (typeof file?.path !== "string" || typeof file.text !== "string") {
      throw new TypeError(`receiptJson: each file must hold a path and a text`);
    }
    if (file.path === "receipt.json") {
      throw new RangeError("receiptJson: others must not hold receipt.json");
    }
    if (seen.has(file.path)) {
      throw new RangeError(`receiptJson: others holds ${JSON.stringify(file.path)} twice`);
    }
    seen.add(file.path);
  }
  return others as readonly BundleFile[];
}

const num = (x: number): number => Number(fmt4(x));
const ratio = (x: number): number => Number(trunc4(x));

/** The receipt text: `JSON.stringify(receipt, null, 2)` and one newline. */
export function receiptJson(
  spec: DesignSpec,
  others: readonly BundleFile[],
  origin: string,
): string {
  const files = check(spec, others, origin);
  // `editLink` checks the origin and throws a RangeError naming itself; name this function instead.
  let link: string;
  try {
    link = editLink(spec, origin);
  } catch (error) {
    if (error instanceof RangeError) {
      throw new RangeError(`receiptJson: ${error.message}`);
    }
    throw error;
  }
  if (!isPlainText(spec.meta.name)) {
    throw new RangeError(
      `receiptJson: name must be plain text, got ${JSON.stringify(spec.meta.name)}`,
    );
  }

  const id = specId(spec);
  const { gamut } = spec.color.params;
  const measurements = measureSpec(spec);
  const findings = lintSpec(spec);
  const summary = summarize(measurements, findings, gamut);
  const byId = new Map(CONTRAST_CHECKS.map((entry) => [entry.id, entry]));

  const design: Record<string, unknown> = { name: spec.meta.name };
  if (spec.meta.oneLiner !== undefined) design.oneLiner = spec.meta.oneLiner;
  Object.assign(design, {
    specId: id,
    lot: lotTag(id),
    link,
    createdWith: spec.meta.createdWith,
    preset: presetOf(spec),
    gamut,
    contrastLevel: spec.color.params.contrastLevel,
  });

  const contrast = measurements.contrast.map((entry) => {
    const rule = byId.get(entry.check);
    if (rule === undefined) {
      throw new RangeError(`receiptJson: unknown contrast check ${JSON.stringify(entry.check)}`);
    }
    const roles = spec.color.roles[entry.mode];
    const fg = roles[rule.foreground];
    const bg = roles[rule.background];
    return {
      check: rule.id,
      rule: rule.rule,
      kind: rule.kind,
      mode: entry.mode,
      foreground: rule.foreground,
      fg,
      background: rule.background,
      bg,
      ratio: ratio(entry.ratio),
      threshold: rule.threshold,
      required: rule.required,
      pass: entry.pass,
      lc: round1(entry.lc),
    };
  });

  const separation = measurements.separation.map((entry) => ({
    set: entry.set,
    mode: entry.mode,
    view: entry.view,
    minDeltaE: ratio(entry.minDeltaE),
    threshold: SEPARATION_THRESHOLD,
    pass: entry.minDeltaE >= SEPARATION_THRESHOLD,
  }));

  // The linter's G1 flags exactly the steps whose excess is over the stored tolerance, so its
  // findings name the steps to list without a second copy of the tolerance.
  const overTolerance = new Set(
    findings.filter((f) => f.id === "G1").map((f) => `${f.mode}:${f.subject}`),
  );
  const outside = measurements.gamut
    .filter((entry) => overTolerance.has(`${entry.mode}:${entry.palette}-${entry.step}`))
    .map((entry) => ({
      palette: entry.palette,
      step: entry.step,
      mode: entry.mode,
      excess: num(entry.excess),
    }));

  const rolesOf = (mode: "light" | "dark") =>
    Object.fromEntries(ROLE_NAMES.map((name) => [name, spec.color.roles[mode][name]]));

  const encoder = new TextEncoder();
  const receipt = {
    format: RECEIPT_FORMAT,
    generator: { name: "dyelot", site: origin, engineVersion: ENGINE_VERSION },
    design,
    summary,
    contrast,
    separation,
    gamut: { gamut, values: measurements.gamut.length, outside },
    roles: { light: rolesOf("light"), dark: rolesOf("dark") },
    radius: themeModel(spec).radii.radius,
    findings: findings.map((finding) => ({
      id: finding.id,
      severity: finding.severity,
      mode: finding.mode,
      subject: finding.subject,
      measured: WCAG_RULES.has(finding.id) ? ratio(finding.measured) : num(finding.measured),
      threshold: num(finding.threshold),
      source: finding.source,
    })),
    files: files.map((file) => ({
      path: file.path,
      bytes: encoder.encode(file.text).length,
      sha256: sha256(file.text),
    })),
  };
  return `${JSON.stringify(receipt, null, 2)}\n`;
}
