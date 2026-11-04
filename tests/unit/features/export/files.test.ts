import { describe, expect, it } from "vitest";
import { lintSpec, measureSpec, summarize } from "@/engine";
import { buildBundle } from "@/export/bundle";
import { summaryLines as designMdLines } from "@/export/design-md-prose";
import { formatBytes, summaryLines } from "@/features/export/files";
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
});
