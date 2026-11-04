import { readFileSync } from "node:fs";
import path from "node:path";
import { lint } from "@google/design.md/linter";
import { describe, expect, it } from "vitest";
import { designMd } from "@/export/design-md";
import { promptMd } from "@/export/prompt";
import { skillFile } from "@/export/skill";
import { importShadcnCss } from "@/import/css";
import type { DesignSpec } from "@/spec";
import { GOLDENS, ORIGIN } from "./golden-support";

// C-DMD-14, 15 and 16 of docs/specs/03-export.md, section 10.8 (R3-21, R3-22): the pinned linter
// 0.4.0 reads every golden's DESIGN.md, and a copy check reads every exported string.

const IMPORTED = (() => {
  const result = importShadcnCss(
    readFileSync(path.join(process.cwd(), "tests/fixtures/import/shadcn-neutral.css"), "utf8"),
  );
  if (!result.ok) throw new Error("the shadcn fixture must import");
  return result.spec as DesignSpec;
})();

describe("DESIGN.md against @google/design.md", () => {
  it("C-DMD-14: every preset golden lints with 0 errors and 0 warnings", () => {
    for (const { id, spec } of GOLDENS) {
      const report = lint(designMd(spec, ORIGIN));
      const loud = report.findings.filter((f) => f.severity !== "info");
      expect(loud, id).toEqual([]);
      expect(report.summary.errors, id).toBe(0);
      expect(report.summary.warnings, id).toBe(0);
    }
  });

  it("C-DMD-15: the imported design has 0 errors and only contrast-ratio warnings", () => {
    const report = lint(designMd(IMPORTED, ORIGIN));
    expect(report.summary.errors).toBe(0);
    for (const finding of report.findings.filter((f) => f.severity === "warning")) {
      expect(finding.rule).toBe("contrast-ratio");
    }
  });
});

const BRITISH = ["colour", "grey", "behaviour", "centre", "licence", "organise", "favour"];
const BANNED = ["simply", "just", "easy", "obviously", "basically"];
const GUARDS = [
  "Hard shadows exist only here",
  "No vibration",
  "Not wellness beige",
  "Reading order stays",
  "Familiar patterns stay",
];

describe("the exported copy", () => {
  it("C-DMD-16: no British spelling, banned word or original guard in DESIGN.md, the prompt or the skill", () => {
    for (const { id, spec } of GOLDENS) {
      const texts = [
        designMd(spec, ORIGIN),
        promptMd(spec, ORIGIN),
        skillFile(spec, "x", ORIGIN).text,
      ];
      for (const text of texts) {
        // The theme.css fence holds the CSS keyword `gray`-free text; scan it too.
        const lower = text.toLowerCase();
        for (const word of [...BRITISH, ...BANNED]) {
          expect(lower, `${id}: ${word}`).not.toMatch(new RegExp(`\\b${word}`));
        }
        for (const guard of GUARDS) expect(text, `${id}: ${guard}`).not.toContain(guard);
        expect(text).not.toContain("!");
      }
    }
  });
});
