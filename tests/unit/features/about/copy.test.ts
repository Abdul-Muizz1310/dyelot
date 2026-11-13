import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { VISITOR_CAP } from "@/ai";
import { CONTRAST_CHECKS, FONT_CATALOG } from "@/engine";
import { TARGETS } from "@/engine/color/scale";
import {
  ABOUT_INTRO,
  ABOUT_LINKS,
  ABOUT_SECTIONS,
  type AboutParagraph,
  type AboutSection,
} from "@/features/about/copy";
import { VIBE_SIDE } from "@/features/ai/image-protocol";
import { CHIPS } from "@/features/ai/steer";
import { TTL_DEFAULT_MS } from "@/server/ai/cache";
import { m6CopyProblems } from "../../support/copy-m6";

// C-ABOUT6-01 to C-ABOUT6-05 of docs/specs/06-gallery.md, section 14.4 (R6-21, R6-59). The table of
// 11.2 is read from the spec itself, so the copy is compared with the words the spec holds.

const ROOT = process.cwd();
const SPEC = readFileSync(path.join(ROOT, "docs/specs/06-gallery.md"), "utf8");
const DESIGN = readFileSync(path.join(ROOT, "docs/specs/00-design.md"), "utf8");

const SECTION_IDS = ["math", "receipt", "privacy", "licenses"] as const;
const HEADINGS = [
  "The color math",
  "The receipt and the checker",
  "AI and privacy",
  "Licenses",
] as const;

/** The rows of a section's table: its cells, with the backticks of the spec taken out. */
function rowsOf(heading: string): string[][] {
  const start = SPEC.indexOf(heading);
  const end = SPEC.indexOf("\n### ", start + 1);
  return SPEC.slice(start, end)
    .split("\n")
    .filter(
      (line) =>
        line.startsWith("| ") &&
        !line.startsWith("| Id ") &&
        !line.startsWith("| Label ") &&
        !line.startsWith("|---"),
    )
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim().replaceAll("`", "")),
    );
}

/** Ruling ids "R4-48 to R4-50" spans, listed one by one. */
function expandRange(entry: string): string[] {
  const match = /^(R\d*-?)(\d+) to \1(\d+)$/.exec(entry);
  if (match === null) return [entry];
  const [, prefix = "", from = "0", to = "0"] = match;
  const width = from.length;
  const ids: string[] = [];
  for (let n = Number(from); n <= Number(to); n++)
    ids.push(`${prefix}${String(n).padStart(width, "0")}`);
  return ids;
}

/** A Restates cell split on "; " and ", ", the spec's reading rule (task 6.4). */
function restatesOf(cell: string): string[] {
  const entries: string[] = [];
  for (const part of cell.split("; ").flatMap((piece) => piece.split(", "))) {
    const previous = entries.at(-1) ?? "";
    if (part.startsWith("§") && previous.startsWith("umbrella ")) {
      entries.push(`umbrella ${part}`);
    } else {
      entries.push(...expandRange(part));
    }
  }
  return entries;
}

const TABLE = rowsOf("### 11.2 The copy");
const LINK_ROWS = rowsOf("### 11.3 The links");

/** The paragraphs of the table, grouped as the copy groups them. */
const EXPECTED_PARAGRAPHS: { id: string; heading: string; paragraph: AboutParagraph }[] = TABLE.map(
  ([id = "", heading = "", text = "", restates = ""]) => ({
    id,
    heading,
    paragraph: { text, restates: restatesOf(restates) },
  }),
);

function isDeepFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeepFrozen);
}

const allParagraphs = (sections: readonly AboutSection[]): AboutParagraph[] => [
  ABOUT_INTRO,
  ...sections.flatMap((section) => section.paragraphs),
];

describe("C-ABOUT6-01 the copy is 11.2 and 11.3 word for word (R6-21)", () => {
  it("C-ABOUT6-01 reads 28 paragraphs and two links from the spec", () => {
    expect(EXPECTED_PARAGRAPHS).toHaveLength(28);
    expect(LINK_ROWS).toHaveLength(2);
    expect(restatesOf("umbrella §4, §5; R-01")).toEqual(["umbrella §4", "umbrella §5", "R-01"]);
    expect(restatesOf("R5-53 to R5-56")).toEqual(["R5-53", "R5-54", "R5-55", "R5-56"]);
  });

  it("C-ABOUT6-01 holds the intro and the four sections, each paragraph's text and restates, in order", () => {
    const [intro, ...rest] = EXPECTED_PARAGRAPHS;
    expect(ABOUT_INTRO).toEqual(intro?.paragraph);
    expect(ABOUT_SECTIONS.map((section) => section.id)).toEqual([...SECTION_IDS]);
    expect(ABOUT_SECTIONS.map((section) => section.heading)).toEqual([...HEADINGS]);
    for (const section of ABOUT_SECTIONS) {
      const expected = rest.filter((row) => row.id === section.id).map((row) => row.paragraph);
      expect(section.paragraphs, section.id).toEqual(expected);
    }
    expect(ABOUT_SECTIONS.flatMap((section) => section.paragraphs)).toHaveLength(rest.length);
  });

  it("C-ABOUT6-01 holds 11.3's two links and is deep-frozen", () => {
    expect(ABOUT_LINKS).toEqual([
      { label: "The source on GitHub", href: "https://github.com/Abdul-Muizz1310/dyelot" },
      { label: "Remotion's license", href: "https://remotion.pro/license" },
    ]);
    expect(LINK_ROWS.map(([label]) => label)).toEqual(ABOUT_LINKS.map((link) => link.label));
    expect(isDeepFrozen(ABOUT_INTRO)).toBe(true);
    expect(isDeepFrozen(ABOUT_SECTIONS)).toBe(true);
    expect(isDeepFrozen(ABOUT_LINKS)).toBe(true);
  });
});

describe("C-ABOUT6-02 the copy rules (R6-21, R6-59)", () => {
  const texts = [
    ...allParagraphs(ABOUT_SECTIONS).map((paragraph) => paragraph.text),
    ...ABOUT_SECTIONS.map((section) => section.heading),
    ...ABOUT_LINKS.map((link) => link.label),
  ];

  it("C-ABOUT6-02 breaks no rule of m6CopyProblems", () => {
    for (const text of texts) expect(m6CopyProblems(text), text).toEqual([]);
  });

  it("C-ABOUT6-02 reports a probe that breaks a rule", () => {
    expect(m6CopyProblems("It is easy!")).toHaveLength(2);
    expect(m6CopyProblems("The colour of grey")).toHaveLength(2);
  });

  it("C-ABOUT6-02 has every link on https", () => {
    for (const link of ABOUT_LINKS) expect(new URL(link.href).protocol).toBe("https:");
  });
});

describe("C-ABOUT6-03 every restates entry names something that exists (R6-21)", () => {
  const SPEC_FILES: Record<string, string> = {
    "R-": "01-color-engine.md",
    "R2-": "02-studio.md",
    "R3-": "03-export.md",
    "R4-": "04-ai.md",
    "R5-": "05-motion-3d.md",
    "R6-": "06-gallery.md",
  };
  const EARLIER: Record<string, string> = {
    M1: "01-color-engine.md",
    M2: "02-studio.md",
    M3: "03-export.md",
    M4: "04-ai.md",
    M5: "05-motion-3d.md",
  };
  const read = (file: string): string => readFileSync(path.join(ROOT, "docs/specs", file), "utf8");

  /** The problem with one `restates` entry, or null when it exists. */
  function entryProblem(entry: string): string | null {
    const umbrella = /^umbrella §(\d+)(?: .*)?$/.exec(entry);
    if (umbrella !== null) {
      return new RegExp(`^## ${umbrella[1]}\\. `, "m").test(DESIGN) ? null : `no section ${entry}`;
    }
    const ruling = /^(R\d?-)(\d+)$/.exec(entry);
    if (ruling !== null) {
      const file = SPEC_FILES[ruling[1] ?? ""];
      if (file === undefined) return `no spec for ${entry}`;
      return read(file).includes(`**${entry} ·`) ? null : `no ruling ${entry}`;
    }
    const record = /^DR-\d{4}$/.exec(entry);
    if (record !== null) return DESIGN.includes(entry) ? null : `00-design.md names no ${entry}`;
    const earlier = /^([\d.]+) of (M\d)$/.exec(entry);
    if (earlier !== null) {
      const file = EARLIER[earlier[2] ?? ""];
      if (file === undefined) return `no spec for ${entry}`;
      const number = (earlier[1] ?? "").replaceAll(".", "\\.");
      return new RegExp(`^#+ ${number} `, "m").test(read(file)) ? null : `no section ${entry}`;
    }
    if (entry === "the owner's ruling of 2026-11-05") return null;
    return existsSync(path.join(ROOT, entry)) ? null : `no file or kind of entry: ${entry}`;
  }

  it("C-ABOUT6-03 finds every entry", () => {
    for (const paragraph of allParagraphs(ABOUT_SECTIONS)) {
      expect(paragraph.restates.length, paragraph.text).toBeGreaterThan(0);
      for (const entry of paragraph.restates) expect(entryProblem(entry), entry).toBeNull();
    }
  });

  it("C-ABOUT6-03 reports an entry that names nothing", () => {
    expect(entryProblem("R4-999")).toBe("no ruling R4-999");
    expect(entryProblem("umbrella §99")).toBe("no section umbrella §99");
    expect(entryProblem("DR-9999")).toBe("00-design.md names no DR-9999");
    expect(entryProblem("99.9 of M3")).toBe("no section 99.9 of M3");
    expect(entryProblem("src/nowhere.ts")).toContain("no file");
    expect(entryProblem("R9-01")).toBe("no spec for R9-01");
  });
});

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/**
 * C-ABOUT6-04's check: every number the copy states against the code's value, naming the paragraph
 * that is wrong; a statement no paragraph makes is a problem too.
 */
function numberProblems(sections: readonly AboutSection[]): string[] {
  const required = CONTRAST_CHECKS.filter((check) => check.required).length;
  const rules: [label: string, pattern: RegExp, expected: string[]][] = [
    ["checks", /holds the (\d+) contrast checks/, [String(2 * CONTRAST_CHECKS.length)]],
    ["per mode", /(\d+) in each mode/, [String(CONTRAST_CHECKS.length)]],
    ["required", /of which (\d+) are required/, [String(2 * required)]],
    ["measured", /measures the (\d+) required contrast pairs/, [String(2 * required)]],
    [
      "targets",
      /from ([\d.]+) to 1 for step 50 up to ([\d.]+) to 1 for step 950/,
      [String(TARGETS[50]), String(TARGETS[950])],
    ],
    [
      "thresholds",
      /Steps 500, 600 and 700 must reach ([\d.]+), ([\d.]+) and ([\d.]+) to 1/,
      [String(TARGETS[500]), String(TARGETS[600]), String(TARGETS[700])],
    ],
    ["shared actions", /gets (\w+) shared actions a day/, [WORDS[VISITOR_CAP] ?? ""]],
    ["chips", /(\w+) chips steer/, [WORDS[CHIPS.length] ?? ""]],
    ["image side", /at most (\d+) pixels on its longest side/, [String(VIBE_SIDE)]],
    ["cache", /for up to (\d+) hours/, [String(TTL_DEFAULT_MS / 3_600_000)]],
  ];
  const problems: string[] = [];
  const paragraphs = sections.flatMap((section) => section.paragraphs);
  for (const [label, pattern, expected] of rules) {
    const hits = paragraphs.filter((paragraph) => pattern.test(paragraph.text));
    if (hits.length === 0) problems.push(`${label}: no paragraph states it`);
    for (const paragraph of hits) {
      const found = (pattern.exec(paragraph.text) ?? []).slice(1);
      const same = found.length === expected.length && found.every((v, i) => v === expected[i]);
      if (!same) {
        problems.push(
          `${label}: "${paragraph.text.slice(0, 40)}" says ${found.join(", ")}, the code has ${expected.join(", ")}`,
        );
      }
    }
  }
  return problems;
}

/** `sections` with `from` replaced by `to` in every paragraph. */
const probe = (from: string, to: string): AboutSection[] =>
  ABOUT_SECTIONS.map((section) => ({
    ...section,
    paragraphs: section.paragraphs.map((paragraph) => ({
      ...paragraph,
      text: paragraph.text.replace(from, to),
    })),
  }));

describe("C-ABOUT6-04 the copy's numbers are the code's (R6-21)", () => {
  it("C-ABOUT6-04 states the numbers of CONTRAST_CHECKS, VISITOR_CAP, VIBE_SIDE, TARGETS, CHIPS and the cache", () => {
    expect(numberProblems(ABOUT_SECTIONS)).toEqual([]);
  });

  it("C-ABOUT6-04 holds the counts the copy relies on", () => {
    expect(CONTRAST_CHECKS).toHaveLength(40);
    expect(CONTRAST_CHECKS.filter((check) => check.required)).toHaveLength(39);
    expect(VISITOR_CAP).toBe(3);
    expect(VIBE_SIDE).toBe(768);
    expect(TTL_DEFAULT_MS).toBe(24 * 60 * 60 * 1000);
    expect(CHIPS).toHaveLength(7);
  });

  it("C-ABOUT6-04 says every font family is under the SIL Open Font License, and each entry is OFL-1.1", () => {
    expect(FONT_CATALOG.length).toBeGreaterThan(0);
    for (const font of FONT_CATALOG) expect(font.license, font.id).toBe("OFL-1.1");
    const text = ABOUT_SECTIONS.flatMap((section) => section.paragraphs).map((p) => p.text);
    expect(text.some((t) => t.includes("under the SIL Open Font License"))).toBe(true);
  });
});

describe("C-ABOUT6-05 the number check reports a wrong copy, naming the paragraph (R6-21)", () => {
  it("C-ABOUT6-05 reports '79 are required'", () => {
    const problems = numberProblems(probe("78 are required", "79 are required"));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("required");
    expect(problems[0]).toContain("Every export carries receipt.json");
  });

  it("C-ABOUT6-05 reports 'four shared actions'", () => {
    const problems = numberProblems(probe("three shared actions", "four shared actions"));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("Each visitor gets");
  });

  it("C-ABOUT6-05 reports a statement that no paragraph makes", () => {
    expect(numberProblems(probe("seven chips", "chips"))).toEqual([
      "chips: no paragraph states it",
    ]);
  });
});
