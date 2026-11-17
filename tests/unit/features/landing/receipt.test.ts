import { writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildBundle } from "@/export";
import { heroSpec } from "@/features/landing/heroes";
import {
  excerptText,
  RECEIPT_EXCERPT,
  RECEIPT_LINES,
  type ReceiptExcerpt,
  receiptExcerpt,
  receiptLines,
} from "@/features/landing/receipt";

// C-REC6-01 to C-REC6-04 of docs/specs/06-gallery.md, section 14.1 (R6-04, R6-11, R6-29).
// `DYELOT_UPDATE_GALLERY=1` rewrites src/features/landing/receipt-excerpt.json, as R3-11 writes JSON;
// it fails together with `CI`.

const FILE = path.join(process.cwd(), "src/features/landing/receipt-excerpt.json");

const RECEIPT_TEXT = (() => {
  const bundle = buildBundle({ spec: heroSpec(0), origin: "https://dyelot.vercel.app" });
  const file = bundle.files.find((f) => f.path === "receipt.json");
  if (file === undefined) throw new Error("no receipt.json");
  return file.text;
})();

const RECEIPT = JSON.parse(RECEIPT_TEXT) as Record<string, unknown> & {
  design: { name: string };
  summary: unknown;
  contrast: Record<string, unknown>[];
  findings: Record<string, unknown>[];
};

const withReceipt = (patch: Record<string, unknown>): string =>
  JSON.stringify({ ...RECEIPT, ...patch });

if (process.env.DYELOT_UPDATE_GALLERY === "1") {
  describe("the committed receipt excerpt", () => {
    it("C-REC6-02 rewrites receipt-excerpt.json, and never in CI", () => {
      expect(process.env.CI, "DYELOT_UPDATE_GALLERY must not run in CI").toBeUndefined();
      writeFileSync(FILE, `${JSON.stringify(receiptExcerpt(RECEIPT_TEXT), null, 2)}\n`);
    });
  });
}

describe("receiptExcerpt (R6-11)", () => {
  it("C-REC6-01 keeps the format, name, check count, summary, first contrast and first finding", () => {
    expect(RECEIPT.contrast.length).toBe(80);
    const excerpt = receiptExcerpt(RECEIPT_TEXT);
    expect(excerpt.format).toBe("dyelot.check/1");
    expect(excerpt.name).toBe("Madder");
    expect(excerpt.checks).toBe(80);
    expect(excerpt.summary).toEqual(RECEIPT.summary);
    expect(excerpt.contrast).toEqual(RECEIPT.contrast[0]);
    expect(excerpt.contrast).toMatchObject({
      check: "C1:foreground/background",
      foreground: "foreground",
      background: "background",
      mode: "light",
      required: true,
      pass: true,
    });
    expect(excerpt.finding).toEqual(RECEIPT.findings[0]);
    expect(excerpt.finding).toMatchObject({
      id: "D3",
      severity: "warn",
      mode: "dark",
      subject: "primary-600",
    });
  });

  it("C-REC6-02 RECEIPT_EXCERPT, the committed JSON, deep-equals receiptExcerpt(RECEIPT_TEXT)", () => {
    expect(Object.keys(RECEIPT_EXCERPT).length).toBeGreaterThan(0);
    expect(RECEIPT_EXCERPT).toEqual(receiptExcerpt(RECEIPT_TEXT));
  });

  it("C-REC6-02 gives a null finding for a receipt with no findings", () => {
    expect(receiptExcerpt(withReceipt({ findings: [] })).finding).toBeNull();
  });

  it("C-REC6-03 refuses a text that is not a string with a TypeError", () => {
    expect(() => receiptExcerpt(5 as never)).toThrow(TypeError);
    expect(() => receiptExcerpt(5 as never)).toThrow(/^receiptExcerpt/);
  });

  it.each([
    ["not JSON", "not json"],
    ["another format", withReceipt({ format: "dyelot.check/2" })],
    ["no summary", withReceipt({ summary: undefined })],
    ["no contrast entry", withReceipt({ contrast: [] })],
    ["no findings", withReceipt({ findings: undefined })],
    ["no design name", withReceipt({ design: {} })],
  ])("C-REC6-03 refuses a receipt with %s with a RangeError", (_label, text) => {
    expect(() => receiptExcerpt(text)).toThrow(RangeError);
    expect(() => receiptExcerpt(text)).toThrow(/^receiptExcerpt/);
  });

  it("C-REC6-03 refuses non-objects in excerptText and receiptLines with a TypeError", () => {
    expect(() => excerptText(null as never)).toThrow(TypeError);
    expect(() => excerptText(null as never)).toThrow(/^excerptText/);
    expect(() => receiptLines(null as never)).toThrow(TypeError);
    expect(() => receiptLines(null as never)).toThrow(/^receiptLines/);
  });

  it("C-REC6-03 refuses counts that are not whole numbers in receiptLines with a RangeError", () => {
    const bad = {
      ...RECEIPT_EXCERPT,
      summary: {
        ...RECEIPT_EXCERPT.summary,
        contrast: { ...RECEIPT_EXCERPT.summary.contrast, required: 77.5 },
      },
    };
    expect(() => receiptLines(bad)).toThrow(RangeError);
    expect(() => receiptLines(bad)).toThrow(/^receiptLines/);
  });

  it("C-REC6-03 checks the type of the counts before their domain", () => {
    const bad = {
      ...RECEIPT_EXCERPT,
      summary: {
        ...RECEIPT_EXCERPT.summary,
        contrast: { ...RECEIPT_EXCERPT.summary.contrast, required: "78" },
      },
    } as unknown as ReceiptExcerpt;
    expect(() => receiptLines(bad)).toThrow(TypeError);
    expect(() => receiptLines(bad)).toThrow(/^receiptLines/);
  });
});

describe("receiptLines (R6-29)", () => {
  it("C-REC6-04 gives 9.2's six sentences with the excerpt's numbers", () => {
    const lines = receiptLines(RECEIPT_EXCERPT);
    expect(lines).toHaveLength(6);
    expect(lines[0]).toBe(
      "Every export carries receipt.json, in the format dyelot.check/1: the measurements of the design, written by the engine that made it. Here are three parts of the receipt of Madder, the design of the story above.",
    );
    expect(lines[1]).toBe(
      "The summary: 78 of 78 required contrast checks pass, and the linter found no error.",
    );
    expect(lines[2]).toBe(
      "One of the 80 contrast checks: foreground on background in light mode, measured, with the ratio cut to four decimals so it never rounds up.",
    );
    expect(lines[3]).toBe("One finding of the linter, with the rule it comes from.");
    expect(lines[4]).toBe(
      "The export also holds a checker with no dependencies. A coding agent runs it from the app's root before it finishes:",
    );
    expect(lines[5]).toBe(
      "It checks the theme against receipt.json, measures the 78 required contrast pairs again and scans the source for raw colors and Tailwind palette classes. It prints PASS when the code keeps to the design.",
    );
  });

  it.each([
    [1, "1 error"],
    [3, "3 errors"],
  ])("C-REC6-04 words %i lint errors as %s", (error, words) => {
    const excerpt: ReceiptExcerpt = {
      ...RECEIPT_EXCERPT,
      summary: {
        ...RECEIPT_EXCERPT.summary,
        lint: { ...RECEIPT_EXCERPT.summary.lint, error },
      },
    };
    expect(receiptLines(excerpt)[1]).toBe(
      `The summary: 78 of 78 required contrast checks pass, and the linter found ${words}.`,
    );
  });

  it("C-REC6-04 words a null finding as 'nothing to note'", () => {
    expect(receiptLines({ ...RECEIPT_EXCERPT, finding: null })[3]).toBe(
      "The linter found nothing to note in this design.",
    );
  });

  it("C-REC6-04 excerptText is JSON.stringify(x, null, 2)", () => {
    const part = { a: 1, b: { c: [1, 2] } };
    expect(excerptText(part)).toBe(JSON.stringify(part, null, 2));
    expect(excerptText(RECEIPT_EXCERPT.summary)).toBe(
      JSON.stringify(RECEIPT_EXCERPT.summary, null, 2),
    );
  });

  it("C-REC6-04 freezes RECEIPT_LINES and fixes its keys and sentences", () => {
    expect(Object.isFrozen(RECEIPT_LINES)).toBe(true);
    expect(Object.keys(RECEIPT_LINES)).toEqual([
      "heading",
      "finding",
      "findingNone",
      "checker",
      "command",
    ]);
    expect(RECEIPT_LINES.heading).toBe("The receipt");
    expect(RECEIPT_LINES.finding).toBe("One finding of the linter, with the rule it comes from.");
    expect(RECEIPT_LINES.findingNone).toBe("The linter found nothing to note in this design.");
    expect(RECEIPT_LINES.checker).toBe(
      "The export also holds a checker with no dependencies. A coding agent runs it from the app's root before it finishes:",
    );
    expect(RECEIPT_LINES.command).toBe("$ node scripts/dyelot-check.mjs");
  });
});
