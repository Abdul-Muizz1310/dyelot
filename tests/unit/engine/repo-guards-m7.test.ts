import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  caseIds,
  E2E_TITLE,
  filesUnder,
  ROOT,
  section14,
  titlesIn,
  UNIT_TITLE,
  unnamedCases,
} from "./guard-support";

// C-GUARD7-01 (Task 7.6, R7-20): C-GUARD6-01's method with this milestone's spec. Every case of
// section 14 of docs/specs/07-finish.md carries its id in a test title, a C- id in a `describe` or
// `it` title under tests/unit and an F- id in a `test` title under tests/e2e, read from each file's
// syntax tree. The ids are read from section 14's rows, so the count is the spec's, never a fixed
// number. The readers are C-GUARD4-11's own, in guard-support.ts.

const M7_SPEC = "docs/specs/07-finish.md";

describe("C-GUARD7-01 every case of section 14 carries its id in a test title", () => {
  const section = section14(readFileSync(path.join(ROOT, M7_SPEC), "utf8"), M7_SPEC);
  const ids = caseIds(section);
  const unit = titlesIn(filesUnder("tests/unit", /\.test\.tsx?$/), UNIT_TITLE);
  const e2e = titlesIn(filesUnder("tests/e2e", /\.spec\.ts$/), E2E_TITLE);

  it("C-GUARD7-01 reads the ids from section 14's rows, one per case row, each once", () => {
    const rows = section.split("\n").filter((line) => /^\| [CF]-/.test(line));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toHaveLength(rows.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["C-GAL7-01", "C-GUARD7-01", "F-LAND7-01"]));
    // Section 13's and 15's text is not section 14's.
    expect(section.startsWith("\n## 14. Cases")).toBe(true);
    expect(section).not.toContain("\n## 15. ");
  });

  it("C-GUARD7-01 finds each C- id in a unit title and each F- id in an end-to-end title", () => {
    expect(unit.length).toBeGreaterThan(0);
    expect(e2e.length).toBeGreaterThan(0);
    expect(unnamedCases(ids, unit, e2e)).toEqual([]);
  });

  it("C-GUARD7-01 reports a probe list's ids that no title carries", () => {
    const probe = [...ids, "C-PROBE7-01", "F-PROBE7-01"];
    // The probe adds its two ids, and only those, to what the guard reports without it.
    expect(unnamedCases(probe, unit, e2e)).toEqual([
      ...unnamedCases(ids, unit, e2e),
      "C-PROBE7-01",
      "F-PROBE7-01",
    ]);
  });
});
