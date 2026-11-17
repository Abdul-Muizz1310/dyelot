import type { GallerySummary } from "../gallery/data";
import receiptJson from "./receipt-excerpt.json";

// The receipt excerpt of the landing's receipt section (R6-11, R6-29): pure, it reads the committed
// `receipt-excerpt.json` and imports no engine, spec or export code at run time (C-GUARD6-05).

export type ReceiptExcerpt = {
  readonly format: "dyelot.check/1";
  readonly name: string;
  readonly checks: number;
  readonly summary: GallerySummary;
  readonly contrast: Readonly<Record<string, string | number | boolean>>;
  readonly finding: Readonly<Record<string, string | number>> | null;
};

const FORMAT = "dyelot.check/1";

const typeName = (value: unknown): string =>
  value === null ? "null" : Array.isArray(value) ? "array" : typeof value;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** What the landing keeps of a `receipt.json`'s text (R6-11). */
export function receiptExcerpt(receipt: string): ReceiptExcerpt {
  if (typeof receipt !== "string") {
    throw new TypeError(`receiptExcerpt: receipt must be a string, got ${typeName(receipt)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(receipt);
  } catch {
    throw new RangeError("receiptExcerpt: receipt is not JSON");
  }
  if (!isRecord(parsed)) throw new RangeError("receiptExcerpt: receipt is not an object");
  if (parsed.format !== FORMAT) {
    throw new RangeError(`receiptExcerpt: format must be ${FORMAT}`);
  }
  const { design, summary, contrast, findings } = parsed;
  if (!isRecord(design) || typeof design.name !== "string") {
    throw new RangeError("receiptExcerpt: receipt lacks design.name");
  }
  if (!isRecord(summary)) throw new RangeError("receiptExcerpt: receipt lacks summary");
  if (!Array.isArray(contrast) || !isRecord(contrast[0])) {
    throw new RangeError("receiptExcerpt: receipt lacks a contrast entry");
  }
  if (!Array.isArray(findings)) throw new RangeError("receiptExcerpt: receipt lacks findings");
  const finding = findings[0];
  return {
    format: FORMAT,
    name: design.name,
    checks: contrast.length,
    summary: summary as GallerySummary,
    contrast: contrast[0] as ReceiptExcerpt["contrast"],
    finding: isRecord(finding) ? (finding as Record<string, string | number>) : null,
  };
}

/** `receipt-excerpt.json` as committed; C-REC6-02 rebuilds and compares it. */
export const RECEIPT_EXCERPT = receiptJson as ReceiptExcerpt;

/** A part of the excerpt as the section's `pre` shows it. */
export function excerptText(part: Readonly<Record<string, unknown>>): string {
  if (!isRecord(part)) {
    throw new TypeError(`excerptText: part must be an object, got ${typeName(part)}`);
  }
  return JSON.stringify(part, null, 2);
}

/** The section's fixed sentences (9.2). */
export const RECEIPT_LINES: Readonly<Record<string, string>> = Object.freeze({
  heading: "The receipt",
  finding: "One finding of the linter, with the rule it comes from.",
  findingNone: "The linter found nothing to note in this design.",
  checker:
    "The export also holds a checker with no dependencies. A coding agent runs it from the app's root before it finishes:",
  command: "$ node scripts/dyelot-check.mjs",
});

const errorsText = (n: number): string =>
  n === 0 ? "no error" : n === 1 ? "1 error" : `${n} errors`;

/** 9.2's sentences with the excerpt's numbers, in the section's order. */
export function receiptLines(excerpt: ReceiptExcerpt): readonly string[] {
  if (!isRecord(excerpt)) {
    throw new TypeError(`receiptLines: excerpt must be an object, got ${typeName(excerpt)}`);
  }
  const { format, name, checks, summary, contrast, finding } = excerpt;
  const parts = [summary?.contrast, summary?.lint, contrast];
  for (const part of parts) {
    if (!isRecord(part)) throw new TypeError("receiptLines: excerpt lacks its summary or contrast");
  }
  const counts = {
    checks,
    required: summary.contrast.required,
    requiredPass: summary.contrast.requiredPass,
    errors: summary.lint.error,
  };
  for (const [key, value] of Object.entries(counts)) {
    if (typeof value !== "number") {
      throw new TypeError(`receiptLines: ${key} must be a number, got ${typeName(value)}`);
    }
  }
  for (const [key, value] of Object.entries(counts)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(`receiptLines: ${key} must be a whole number, got ${value}`);
    }
  }
  return [
    `Every export carries receipt.json, in the format ${format}: the measurements of the design, written by the engine that made it. Here are three parts of the receipt of ${name}, the design of the story above.`,
    `The summary: ${counts.requiredPass} of ${counts.required} required contrast checks pass, and the linter found ${errorsText(counts.errors)}.`,
    `One of the ${checks} contrast checks: ${contrast.foreground} on ${contrast.background} in ${contrast.mode} mode, measured, with the ratio cut to four decimals so it never rounds up.`,
    finding === null ? RECEIPT_LINES.findingNone : RECEIPT_LINES.finding,
    RECEIPT_LINES.checker,
    `It checks the theme against receipt.json, measures the ${counts.required} required contrast pairs again and scans the source for raw colors and Tailwind palette classes. It prints PASS when the code keeps to the design.`,
  ] as readonly string[];
}
