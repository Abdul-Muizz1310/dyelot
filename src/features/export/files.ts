import type { Summary } from "@/engine";
import { assertRecord, describeType } from "@/features/studio/guards";

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
