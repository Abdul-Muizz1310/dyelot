import { describe, expect, it } from "vitest";
import { lintSpec, measureSpec, summarize } from "@/engine";
import { buildBundle } from "@/export/bundle";
import { summaryLines as designMdLines } from "@/export/design-md-prose";
import {
  blockReason,
  exportState,
  failingChecks,
  formatBytes,
  summaryLines,
} from "@/features/export/files";
import { GOLDENS, ORIGIN, SPEC } from "../../export/golden-support";

// Cases C-EXPUI-01 to C-EXPUI-03 of docs/specs/03-export.md, section 10.11: the export dialog's two
// pure helpers (R3-34, section 9.2).

const summaryOf = (spec: typeof SPEC, gamut: "srgb" | "p3" = "srgb") =>
  summarize(measureSpec(spec), lintSpec(spec), gamut);

/** A summary with the given lint counts and everything else from SPEC. */
const withLint = (error: number, warn: number, info: number) => ({
  ...summaryOf(SPEC),
  lint: { error, warn, info },
});

describe("formatBytes", () => {
  it("C-EXPUI-01 reads bytes under 1,024 and kilobytes rounded to one decimal after", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(18234)).toBe("17.8 KB");
    expect(formatBytes(2000000)).toBe("1953.1 KB");
  });

  it("C-EXPUI-03 throws RangeError for a negative, fractional or non-finite count and TypeError for a string", () => {
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => formatBytes(bad)).toThrow(RangeError);
      expect(() => formatBytes(bad)).toThrow(/formatBytes/);
    }
    expect(() => formatBytes("1" as never)).toThrow(TypeError);
    expect(() => formatBytes("1" as never)).toThrow(/formatBytes/);
  });
});

describe("summaryLines", () => {
  it("C-EXPUI-02 gives the four lines of section 9.2 for SPEC", () => {
    const summary = summaryOf(SPEC);
    const lines = summaryLines(summary);
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe("78 of 78 required contrast checks pass");
    expect(lines[1]).toBe(
      `${summary.separation.checks - summary.separation.below} of 16 color-vision checks keep status and chart colors apart`,
    );
    expect(lines[2]).toBe("176 of 176 colors inside sRGB");
    const { error, warn, info } = summary.lint;
    expect(lines[3]).toBe(
      `${error === 0 ? "No lint errors" : `${error} lint error${error === 1 ? "" : "s"}`}, ${warn} warning${warn === 1 ? "" : "s"}, ${info} note${info === 1 ? "" : "s"}`,
    );
  });

  it("C-EXPUI-02 builds the lint line from the counts, with singular forms", () => {
    expect(summaryLines(withLint(0, 0, 2))[3]).toBe("No lint errors, 0 warnings, 2 notes");
    expect(summaryLines(withLint(1, 1, 1))[3]).toBe("1 lint error, 1 warning, 1 note");
    expect(summaryLines(withLint(3, 2, 0))[3]).toBe("3 lint errors, 2 warnings, 0 notes");
  });

  it("C-EXPUI-02 names Display P3 for a p3 summary", () => {
    expect(summaryLines(summaryOf(SPEC, "p3"))[2]).toMatch(/ colors inside Display P3$/);
  });

  it("C-EXPUI-03 throws TypeError for null and RangeError for a bad count", () => {
    expect(() => summaryLines(null as never)).toThrow(TypeError);
    expect(() => summaryLines(null as never)).toThrow(/summaryLines/);
    const base = summaryOf(SPEC);
    const bad = [
      { ...base, contrast: { ...base.contrast, requiredPass: -1 } },
      { ...base, lint: { ...base.lint, warn: 1.5 } },
      { ...base, separation: { ...base.separation, below: base.separation.checks + 1 } },
    ];
    for (const summary of bad) {
      expect(() => summaryLines(summary)).toThrow(RangeError);
      expect(() => summaryLines(summary)).toThrow(/summaryLines/);
    }
  });

  it("matches DESIGN.md's Accessibility lines for every golden, so the two cannot drift", () => {
    for (const { id, spec } of GOLDENS) {
      const bundle = buildBundle({ spec, origin: ORIGIN });
      const expected = designMdLines(bundle.summary);
      expect(summaryLines(bundle.summary), id).toEqual(expected);
      const designMd = bundle.files.find((file) => file.path === "DESIGN.md")?.text ?? "";
      for (const line of expected) expect(designMd, id).toContain(`- ${line}`);
    }
  });

  it("prints zero counts in DESIGN.md's lint line exactly as the dialog does", () => {
    for (const [error, warn, info] of [
      [0, 0, 2],
      [0, 3, 0],
      [0, 0, 0],
      [1, 0, 0],
      [2, 1, 1],
    ] as const) {
      const summary = withLint(error, warn, info);
      expect(designMdLines(summary)).toEqual(summaryLines(summary));
    }
  });
});

describe("exportState", () => {
  const failing = withLint(2, 0, 0);

  it("C-EXPUI-05 is passing with no lint error, whatever else", () => {
    for (const provenance of ["generated", "loaded"] as const) {
      for (const outcome of [undefined, "passes", "fails", "throws"] as const) {
        expect(exportState(withLint(0, 1, 1), provenance, outcome)).toBe("passing");
      }
    }
  });

  it("C-EXPUI-05 is fault for a generated design with errors", () => {
    expect(exportState(failing, "generated")).toBe("fault");
    expect(exportState(failing, "generated", "passes")).toBe("fault");
  });

  it("C-EXPUI-05 is fixable for a loaded design that rebuilds clean, stuck otherwise", () => {
    expect(exportState(failing, "loaded", "passes")).toBe("fixable");
    expect(exportState(failing, "loaded", "fails")).toBe("stuck");
    expect(exportState(failing, "loaded", "throws")).toBe("stuck");
  });

  it("C-EXPUI-05 throws TypeError for a failing loaded design with no outcome", () => {
    expect(() => exportState(failing, "loaded")).toThrow(TypeError);
    expect(() => exportState(failing, "loaded")).toThrow(/exportState/);
    expect(() => exportState(null as never, "loaded", "passes")).toThrow(TypeError);
  });

  it("C-EXPUI-05 throws RangeError for an unknown provenance or outcome", () => {
    expect(() => exportState(failing, "imported" as never, "passes")).toThrow(RangeError);
    expect(() => exportState(failing, "imported" as never, "passes")).toThrow(/exportState/);
    expect(() => exportState(failing, "loaded", "maybe" as never)).toThrow(RangeError);
    expect(() => exportState(failing, "loaded", "maybe" as never)).toThrow(/exportState/);
  });
});

describe("blockReason", () => {
  it("C-EXPUI-06 gives R3-42's three sentences with a singular and a plural count", () => {
    expect(blockReason("fixable", 1)).toBe(
      "This design fails 1 required check. It came from a link or a file, and rebuilding it from its parameters makes every check pass.",
    );
    expect(blockReason("stuck", 1)).toBe(
      "This design fails 1 required check, and rebuilding it from its parameters does not fix them. Change the parameters until every check passes.",
    );
    expect(blockReason("fault", 1)).toBe(
      "This design fails 1 required check although the studio generated it. That is a fault in dyelot: change any parameter to generate it again.",
    );
    expect(blockReason("fixable", 2)).toContain("This design fails 2 required checks. It came");
    expect(blockReason("stuck", 3)).toContain("fails 3 required checks, and");
    expect(blockReason("fault", 12)).toContain("fails 12 required checks although");
  });

  it("C-EXPUI-06 throws RangeError for passing and for a count below 1 or fractional", () => {
    expect(() => blockReason("passing" as never, 1)).toThrow(RangeError);
    expect(() => blockReason("passing" as never, 1)).toThrow(/blockReason/);
    for (const bad of [0, -1, 1.5]) {
      expect(() => blockReason("fixable", bad)).toThrow(RangeError);
      expect(() => blockReason("fixable", bad)).toThrow(/blockReason/);
    }
    expect(() => blockReason("fixable", "1" as never)).toThrow(TypeError);
  });
});

describe("failingChecks", () => {
  it("lists each error finding as subject, mode: measured against threshold, in order", () => {
    const rows = failingChecks([
      {
        id: "C1",
        severity: "error",
        mode: "light",
        subject: "a/b",
        measured: 3.7421,
        threshold: 4.5,
      },
      { id: "T1", severity: "warn", mode: "dark", subject: "x", measured: 1, threshold: 2 },
      { id: "C2", severity: "error", mode: "dark", subject: "c/d", measured: 2.9999, threshold: 3 },
    ]);
    expect(rows).toEqual(["a/b, light: 3.7421 against 4.5", "c/d, dark: 2.9999 against 3"]);
  });

  it("throws TypeError for a non-array", () => {
    expect(() => failingChecks(null as never)).toThrow(TypeError);
    expect(() => failingChecks(null as never)).toThrow(/failingChecks/);
  });
});
