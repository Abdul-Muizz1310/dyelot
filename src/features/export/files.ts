import type { Summary } from "@/engine";
import type { Provenance } from "@/features/studio/drafts";
import { assertOneOf, assertRecord, describeType } from "@/features/studio/guards";
import type { RebuildOutcome } from "@/features/studio/rebuild";

// The export dialog's two pure helpers (spec section 9.2): a file's size as the list prints it, and
// the four summary lines the dialog and the inspector share.

/** A count: a non-negative integer, or a TypeError (another type) or a RangeError (another number). */
function assertCount(value: unknown, who: string, name: string): asserts value is number {
  if (typeof value !== "number") {
    throw new TypeError(`${who}: ${name} must be a number, got ${describeType(value)}`);
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${who}: ${name} must be a non-negative integer, got ${value}`);
  }
}

/** Rounds half away from zero to one decimal, as the export layer's `round1` does. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * A byte count as the file list prints it: under 1,024 bytes `<n> B`, then `<round1(n / 1024)> KB`
 * (no trailing zero: 1,024 is "1 KB", 1,536 is "1.5 KB").
 */
export function formatBytes(bytes: number): string {
  assertCount(bytes, "formatBytes", "bytes");
  return bytes < 1024 ? `${bytes} B` : `${round1(bytes / 1024)} KB`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The four lines of section 9.2, from a summary: the required contrast checks, the color-vision
 * checks, the colors inside the gamut, and the lint counts. The same words as DESIGN.md's
 * Accessibility section (tests/unit/features/export/files.test.ts keeps the two equal).
 */
export function summaryLines(summary: Summary): string[] {
  assertRecord(summary, "summaryLines: summary");
  const { contrast, separation, gamut, lint } = summary;
  assertRecord(contrast, "summaryLines: summary.contrast");
  assertRecord(separation, "summaryLines: summary.separation");
  assertRecord(gamut, "summaryLines: summary.gamut");
  assertRecord(lint, "summaryLines: summary.lint");
  const who = "summaryLines";
  assertCount(contrast.required, who, "contrast.required");
  assertCount(contrast.requiredPass, who, "contrast.requiredPass");
  assertCount(separation.checks, who, "separation.checks");
  assertCount(separation.below, who, "separation.below");
  assertCount(gamut.values, who, "gamut.values");
  assertCount(gamut.outside, who, "gamut.outside");
  assertCount(lint.error, who, "lint.error");
  assertCount(lint.warn, who, "lint.warn");
  assertCount(lint.info, who, "lint.info");
  if (contrast.requiredPass > contrast.required) {
    throw new RangeError("summaryLines: contrast.requiredPass is above contrast.required");
  }
  if (separation.below > separation.checks) {
    throw new RangeError("summaryLines: separation.below is above separation.checks");
  }
  if (gamut.outside > gamut.values) {
    throw new RangeError("summaryLines: gamut.outside is above gamut.values");
  }
  const errors =
    lint.error === 0 ? "No lint errors" : plural(lint.error, "lint error", "lint errors");
  return [
    `${contrast.requiredPass} of ${contrast.required} required contrast checks pass`,
    `${separation.checks - separation.below} of ${separation.checks} color-vision checks keep status and chart colors apart`,
    `${gamut.values - gamut.outside} of ${gamut.values} colors inside ${gamut.gamut === "p3" ? "Display P3" : "sRGB"}`,
    `${errors}, ${plural(lint.warn, "warning", "warnings")}, ${plural(lint.info, "note", "notes")}`,
  ];
}

/** Why export is on or off (R3-42): `passing` has no required-check error. */
export type ExportState = "passing" | "fixable" | "stuck" | "fault";

const PROVENANCES: readonly Provenance[] = ["generated", "loaded"];
const OUTCOMES: readonly RebuildOutcome[] = ["passes", "fails", "throws"];

/**
 * The state of export (R3-42). `passing` with no lint error; `fault` for a failing design the studio
 * generated; `fixable` for a failing loaded design whose rebuild passes; `stuck` when it fails or
 * throws. A failing loaded design with no outcome is a TypeError: the store never shows one.
 */
export function exportState(
  summary: Summary,
  provenance: Provenance,
  outcome?: RebuildOutcome,
): ExportState {
  assertRecord(summary, "exportState: summary");
  assertRecord(summary.lint, "exportState: summary.lint");
  assertCount(summary.lint.error, "exportState", "summary.lint.error");
  assertOneOf(provenance, PROVENANCES, "exportState: provenance");
  if (outcome !== undefined) assertOneOf(outcome, OUTCOMES, "exportState: outcome");
  if (summary.lint.error === 0) return "passing";
  if (provenance === "generated") return "fault";
  if (outcome === undefined) {
    throw new TypeError("exportState: a failing loaded design needs a rebuild outcome");
  }
  return outcome === "passes" ? "fixable" : "stuck";
}

/** R3-42's sentence for a blocked state, for `errors` failing required checks. */
export function blockReason(state: Exclude<ExportState, "passing">, errors: number): string {
  if (typeof errors !== "number") {
    throw new TypeError(`blockReason: errors must be a number, got ${describeType(errors)}`);
  }
  if (!Number.isInteger(errors) || errors < 1) {
    throw new RangeError(`blockReason: errors must be an integer of at least 1, got ${errors}`);
  }
  const checks = plural(errors, "required check", "required checks");
  switch (state) {
    case "fixable":
      return `This design fails ${checks}. It came from a link or a file, and rebuilding it from its parameters makes every check pass.`;
    case "stuck":
      return `This design fails ${checks}, and rebuilding it from its parameters does not fix them. Change the parameters until every check passes.`;
    case "fault":
      return `This design fails ${checks} although the studio generated it. That is a fault in dyelot: change any parameter to generate it again.`;
    default:
      throw new RangeError(
        `blockReason: state must be fixable, stuck or fault, got ${String(state)}`,
      );
  }
}

/**
 * The failing-check rows of the blocked dialog (section 9.2): each finding of severity `error` as
 * `<subject>, <mode>: <measured> against <threshold>`, in the receipt's order. The receipt's numbers
 * are already cut by `trunc4` (a measured ratio) or rounded by `fmt4`, so the row prints them as they are.
 */
export function failingChecks(findings: readonly Readonly<Record<string, unknown>>[]): string[] {
  if (!Array.isArray(findings)) {
    throw new TypeError(`failingChecks: findings must be an array, got ${describeType(findings)}`);
  }
  return findings
    .filter((finding) => finding.severity === "error")
    .map(
      (finding) =>
        `${String(finding.subject)}, ${String(finding.mode)}: ${String(finding.measured)} against ${String(finding.threshold)}`,
    );
}
