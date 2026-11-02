import { describe, expect, it } from "vitest";
import {
  CONTRAST_LEVELS,
  type Finding,
  hexToRgb,
  lintSpec,
  PALETTE_NAMES,
  perceptualLc,
  ROLE_NAMES,
  RULE_IDS,
  type RuleId,
  rgbToOklch,
  wcagRatio,
} from "@/engine";
import {
  findingKey,
  findingMeasure,
  findingTitle,
  fixOutcome,
  fontNote,
  formatLc,
  groupFindings,
  nameTargets,
  passLevel,
  roleRows,
  showMe,
  showMeMode,
  showMeVision,
} from "@/features/studio/inspect";
import type { DesignSpec } from "@/spec";
import { defaultSpec, richSpec, withValue } from "../../spec/support";

// Cases C-INSPECT-05 to C-INSPECT-15, C-INSPECT-18 to C-INSPECT-24 and C-INSPECT-26 of docs/specs/02-studio.md,
// section 6.9: the inspector's pure helpers (section 5.8). C-INSPECT-01 to 04 are fixes.test.ts and
// store-fix.test.ts, C-INSPECT-16 fix-scan-*.test.ts and C-INSPECT-17 inspector-fix.test.tsx.

const SPEC = defaultSpec();
const MODES = ["light", "dark"] as const;

/** The 13 C1 text pairs and the 6 C5 on-fill pairs of M1's linter, then the 13 UI pairs (6.9). */
const TEXT_PAIRS = [
  "foreground/background",
  "card-foreground/card",
  "popover-foreground/popover",
  "sidebar-foreground/sidebar",
  "muted-foreground/muted",
  "muted-foreground/background",
  "secondary-foreground/secondary",
  "accent-foreground/accent",
  "sidebar-accent-foreground/sidebar-accent",
  "success-subtle-foreground/success-subtle",
  "warning-subtle-foreground/warning-subtle",
  "info-subtle-foreground/info-subtle",
  "destructive-subtle-foreground/destructive-subtle",
  "primary-foreground/primary",
  "sidebar-primary-foreground/sidebar-primary",
  "destructive-foreground/destructive",
  "success-foreground/success",
  "warning-foreground/warning",
  "info-foreground/info",
];
const UI_ROLES = [
  "input",
  "border",
  "ring",
  "primary",
  "destructive",
  "success",
  "warning",
  "info",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
];

/** A finding of rule `id` with `subject`, in `mode`. */
function finding(id: RuleId, subject: string, extra: Partial<Finding> = {}): Finding {
  return {
    id,
    severity: "warn",
    mode: "light",
    subject,
    measured: 1,
    threshold: 2,
    source: "test",
    ...extra,
  };
}

/** `spec` with every role of the light mode set to one gray: every C1 and C5 pair fails there. */
function flatLight(spec: DesignSpec): DesignSpec {
  let flat: unknown = spec;
  for (const role of ROLE_NAMES)
    flat = withValue(flat, ["color", "roles", "light", role], "#777777");
  return flat as DesignSpec;
}

describe("roleRows", () => {
  it("C-INSPECT-05 gives 32 rows: 19 text pairs, then 13 UI pairs against background", () => {
    const rows = roleRows(SPEC);
    expect(rows).toHaveLength(32);
    expect(rows.map((row) => row.pair)).toEqual([
      ...TEXT_PAIRS,
      ...UI_ROLES.map((role) => `${role}/background`),
    ]);
    expect(rows.slice(0, 19).every((row) => row.kind === "text")).toBe(true);
    expect(rows.slice(19).every((row) => row.kind === "ui")).toBe(true);
    for (const row of rows) expect(row.pair).toBe(`${row.foreground}/${row.fill}`);
  });

  it("C-INSPECT-05 its text pairs are the linter's C1 and C5 pairs", () => {
    const failing = lintSpec(flatLight(SPEC))
      .filter((item) => item.mode === "light" && (item.id === "C1" || item.id === "C5"))
      .map((item) => item.subject);
    expect([...failing].sort()).toEqual([...TEXT_PAIRS].sort());
  });

  it("C-INSPECT-06 each cell's ratio is wcagRatio of its hexes on the full float, in both modes", () => {
    for (const row of roleRows(SPEC)) {
      for (const mode of MODES) {
        const cell = row[mode];
        const roles = SPEC.color.roles[mode];
        expect(cell.foreground, `${row.pair} ${mode}`).toBe(roles[row.foreground]);
        expect(cell.fill, `${row.pair} ${mode}`).toBe(roles[row.fill]);
        expect(cell.ratio, `${row.pair} ${mode}`).toBe(
          wcagRatio(hexToRgb(cell.foreground), hexToRgb(cell.fill)),
        );
        expect(cell.level).toBe(passLevel(cell.ratio, row.kind));
      }
    }
  });

  it("C-INSPECT-10 the sign of a cell's score follows perceptualLc: dark on light is positive", () => {
    const rows = roleRows(SPEC);
    for (const row of rows) {
      for (const mode of MODES) {
        const cell = row[mode];
        expect(cell.lc).toBe(perceptualLc(hexToRgb(cell.foreground), hexToRgb(cell.fill)));
        expect(cell.lcText).toBe(formatLc(cell.lc));
      }
    }
    const text = rows[0];
    expect(text?.pair).toBe("foreground/background");
    expect(text?.light.lc).toBeGreaterThan(0);
    expect(text?.light.lcText).toMatch(/^\+\d+$/);
    expect(text?.dark.lc).toBeLessThan(0);
    expect(text?.dark.lcText).toMatch(/^−\d+$/);
  });
});

describe("passLevel", () => {
  it.each([
    [7, "AAA"],
    [21, "AAA"],
    [6.99, "AA"],
    [4.5, "AA"],
    [4.49, "AA large"],
    [3, "AA large"],
    [2.99, "fail"],
    [1, "fail"],
  ] as const)("C-INSPECT-07 text at %s gives %s", (ratio, level) => {
    expect(passLevel(ratio, "text")).toBe(level);
  });

  it("C-INSPECT-07 compares on the full float: 4.4999999 is not AA", () => {
    expect(passLevel(4.4999999, "text")).toBe("AA large");
    expect(passLevel(6.9999999, "text")).toBe("AA");
  });

  it.each([
    [3, "pass 3:1"],
    [21, "pass 3:1"],
    [2.99, "fail"],
    [2.9999999, "fail"],
    [1, "fail"],
  ] as const)("C-INSPECT-08 UI at %s gives %s", (ratio, level) => {
    expect(passLevel(ratio, "ui")).toBe(level);
  });
});

describe("formatLc", () => {
  it.each([
    [76.4, "+76"],
    [76.5, "+77"],
    [-33.1, "−33"],
    [-105.7, "−106"],
    [0, "0"],
    [-0, "0"],
    [-0.4, "0"],
    [0.4, "0"],
  ] as const)("C-INSPECT-09 formats %s as %s", (lc, text) => {
    expect(formatLc(lc)).toBe(text);
  });
});

describe("groupFindings", () => {
  it("C-INSPECT-11 splits by severity, keeps the linter's order in each group, and drops nothing", () => {
    const tampered = withValue(flatLight(SPEC), ["type", "families", "display"], "geist");
    const findings = lintSpec(tampered as DesignSpec);
    expect(new Set(findings.map((item) => item.severity))).toEqual(
      new Set(["error", "warn", "info"]),
    );
    const groups = groupFindings(findings);
    expect(groups.error).toEqual(findings.filter((item) => item.severity === "error"));
    expect(groups.warn).toEqual(findings.filter((item) => item.severity === "warn"));
    expect(groups.info).toEqual(findings.filter((item) => item.severity === "info"));
    expect(groups.error.length + groups.warn.length + groups.info.length).toBe(findings.length);
  });

  it("C-INSPECT-11 gives three empty groups for no findings", () => {
    expect(groupFindings([])).toEqual({ error: [], warn: [], info: [] });
  });

  it("C-INSPECT-11 keeps an order it is given, even one the linter would not write", () => {
    const a = finding("T1", "display", { severity: "warn" });
    const b = finding("K2", "primary-50/primary-100", { severity: "warn" });
    expect(groupFindings([a, b]).warn).toEqual([a, b]);
  });
});

describe("showMe", () => {
  it.each([
    ["C1", "muted-foreground/muted", ["muted-foreground", "muted"]],
    ["C2", "primary/background", ["primary", "background"]],
    ["C4", "card-foreground/card", ["card-foreground", "card"]],
    ["C5", "primary-foreground/primary", ["primary-foreground", "primary"]],
    ["N1", "input/background", ["input", "background"]],
    ["N2", "chart-3/card", ["chart-3", "card"]],
    ["N3", "border/background", ["border", "background"]],
    ["F1", "ring/muted", ["ring", "muted"]],
    ["S1", "status/protan", ["success", "warning", "destructive", "info"]],
    ["S1", "chart/none", ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]],
    ["S2", "destructive/success", ["destructive", "success"]],
    ["D1", "background", ["background"]],
    ["D2", "foreground", ["foreground"]],
    ["D4", "card/background", ["card", "background"]],
    ["T1", "display", ["font-display"]],
    ["T4", "body", ["font-body"]],
  ] as const)("C-INSPECT-12 %s on %s highlights the roles %j and no cell", (id, subject, roles) => {
    expect(showMe(finding(id, subject))).toEqual({ roles: [...roles], cells: [] });
  });

  it.each([
    ["K1", "primary-500/primary-600", [500, 600], "primary"],
    ["K2", "neutral-50/neutral-100", [50, 100], "neutral"],
    ["K4", "accent-950", [950], "accent"],
    ["G1", "info-300", [300], "info"],
    ["G3", "neutral-500", [500], "neutral"],
    ["D3", "danger-600", [600], "danger"],
    ["P1", "warning-200", [200], "warning"],
    ["T3", "success-700", [700], "success"],
  ] as const)("C-INSPECT-12 %s on %s highlights the cells %j", (id, subject, steps, palette) => {
    expect(showMe(finding(id, subject))).toEqual({
      roles: [],
      cells: steps.map((step) => ({ palette, step })),
    });
  });

  it("C-INSPECT-12 T2 highlights primary on the canvas and the primary scale's 600 step", () => {
    expect(showMe(finding("T2", "primary"))).toEqual({
      roles: ["primary"],
      cells: [{ palette: "primary", step: 600 }],
    });
  });

  it("C-INSPECT-12 maps every finding the linter gives for the fixtures to a non-empty highlight", () => {
    const tampered = withValue(flatLight(richSpec()), ["type", "families", "display"], "geist");
    for (const item of lintSpec(tampered as DesignSpec)) {
      const { roles, cells } = showMe(item);
      expect(roles.length + cells.length, findingKey(item)).toBeGreaterThan(0);
    }
  });

  it.each([
    ["C1", ""],
    ["C1", "ring"],
    ["C1", "ring/"],
    ["C1", "ring/nope"],
    ["N1", "nope/background"],
    ["C5", "a/b/c"],
    ["S1", "status"],
    ["S1", "brand/protan"],
    ["S1", "status/sepia"],
    ["S2", "destructive"],
    ["D4", "card"],
    ["K1", "primary-500"],
    ["K2", "primary-500/teal-600"],
    ["K4", "primary-650"],
    ["G1", "magenta-500"],
    ["G3", "primary-600/primary-700"],
    ["P1", "primary"],
    ["T1", "body"],
    ["T2", "secondary"],
    ["T4", "display"],
  ] as const)(
    "C-INSPECT-13 %s with the subject %j gives an empty highlight and does not throw",
    (id, subject) => {
      expect(showMe(finding(id, subject))).toEqual({ roles: [], cells: [] });
    },
  );
});

describe("findingTitle", () => {
  const TITLES: Readonly<Record<RuleId, string>> = {
    C1: "Text under 4.5:1",
    C2: "Large text under 3:1",
    C4: "Body text under the advisory score",
    C5: "Text on a fill under 4.5:1",
    N1: "Input border under 3:1",
    N2: "Chart color under 3:1",
    N3: "Border under 3:1",
    F1: "Focus ring under 3:1",
    S1: "Colors too close under color-blind views",
    S2: "Danger and success too close in lightness",
    K1: "Scale steps out of order",
    K2: "Adjacent steps too close",
    K4: "Chroma off its curve",
    G1: "Color outside the gamut",
    G3: "Gray color with a hue",
    D1: "Dark page too light",
    D2: "Dark text off-white",
    D3: "Dark accent too saturated",
    D4: "Dark card not lighter than the page",
    P1: "Color in the disliked yellow-green zone",
    T1: "Overused display font",
    T2: "Purple on white default",
    T3: "Tailwind default color",
    T4: "Body text under 16 px",
  };

  it("C-INSPECT-14 gives the plain-language title of each of the 24 rule ids", () => {
    expect(RULE_IDS).toHaveLength(24);
    for (const id of RULE_IDS) expect(findingTitle(id), id).toBe(TITLES[id]);
  });

  it("C-INSPECT-15 no title uses a banned word or ends with an exclamation mark", () => {
    for (const id of RULE_IDS) {
      const title = findingTitle(id);
      expect(title, id).not.toMatch(/\b(simply|just|easy|obviously|basically)\b/i);
      expect(title, id).not.toMatch(/!\s*$/);
      expect(title.length, id).toBeGreaterThan(0);
    }
  });
});

describe("findingKey", () => {
  it("C-INSPECT-18 joins the id, the mode and the subject with spaces", () => {
    expect(findingKey(finding("F1", "ring/background", { mode: "light" }))).toBe(
      "F1 light ring/background",
    );
    expect(findingKey(finding("K2", "primary-50/primary-100", { mode: "dark" }))).toBe(
      "K2 dark primary-50/primary-100",
    );
  });

  it("C-INSPECT-18 the linter's findings for the test specs have pairwise distinct keys", () => {
    for (const spec of [SPEC, richSpec(), flatLight(SPEC), flatLight(richSpec())]) {
      const keys = lintSpec(spec).map(findingKey);
      expect(keys.length).toBeGreaterThan(0);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("showMeVision", () => {
  it.each([
    ["status/deutan", "deutan"],
    ["status/protan", "protan"],
    ["chart/tritan", "tritan"],
    ["chart/none", "none"],
  ] as const)("C-INSPECT-26 S1 on %s shows the %s view", (subject, view) => {
    expect(showMeVision(finding("S1", subject))).toBe(view);
  });

  it("C-INSPECT-26 is null for every other rule and for an S1 subject of an unknown shape", () => {
    for (const id of RULE_IDS.filter((rule) => rule !== "S1")) {
      expect(showMeVision(finding(id, "status/deutan")), id).toBeNull();
    }
    for (const subject of ["status", "status/sepia", "brand/deutan", "chart/deutan/x", ""]) {
      expect(showMeVision(finding("S1", subject)), subject).toBeNull();
    }
  });
});

describe("showMeMode", () => {
  it("C-INSPECT-19 is the finding's mode, and null for T1 and T4", () => {
    for (const id of RULE_IDS) {
      for (const mode of MODES) {
        const expected = id === "T1" || id === "T4" ? null : mode;
        expect(showMeMode(finding(id, "x", { mode })), `${id} ${mode}`).toBe(expected);
      }
    }
  });
});

describe("findingMeasure", () => {
  it.each([
    [finding("F1", "ring/background", { measured: 1.1234, threshold: 3 }), "1.12:1 against 3:1"],
    [
      finding("C1", "muted-foreground/muted", { measured: 4.4849, threshold: 4.5 }),
      "4.48:1 against 4.5:1",
    ],
    [finding("C2", "primary/background", { measured: 2.94, threshold: 3 }), "2.94:1 against 3:1"],
    [
      finding("C5", "primary-foreground/primary", { measured: 12, threshold: 4.5 }),
      "12.00:1 against 4.5:1",
    ],
    [finding("N1", "input/card", { measured: 2.5, threshold: 3 }), "2.50:1 against 3:1"],
    [finding("N2", "chart-1/card", { measured: 2.5, threshold: 3 }), "2.50:1 against 3:1"],
    [finding("N3", "border/background", { measured: 1.4, threshold: 3 }), "1.40:1 against 3:1"],
    [finding("C4", "foreground/background", { measured: 68.4, threshold: 75 }), "Lc 68 against 75"],
    [finding("T2", "primary", { measured: 289.4, threshold: 300 }), "hue 289° against 300°"],
    [finding("T3", "primary-500", { measured: 0, threshold: 0 }), "equals a Tailwind v4 default"],
    [finding("T4", "body", { measured: 14, threshold: 16 }), "14 px against 16 px"],
    [
      finding("K1", "primary-50/primary-100", { measured: -0.0041, threshold: 0 }),
      "−0.004 against 0",
    ],
    [
      finding("K2", "primary-50/primary-100", { measured: 0.005, threshold: 0.008 }),
      "0.005 against 0.008",
    ],
    [finding("S1", "chart/protan", { measured: 0.0712, threshold: 0.08 }), "0.071 against 0.08"],
    [finding("T1", "display", { measured: 1, threshold: 0.8 }), "1 against 0.8"],
    [finding("D1", "background", { measured: 0.12, threshold: 0.15 }), "0.12 against 0.15"],
  ] as const)("C-INSPECT-20 formats %s", (item, text) => {
    expect(findingMeasure(item)).toBe(text);
  });
});

describe("nameTargets", () => {
  it("C-INSPECT-21 gives the light step 500 of the 8 palettes, then chart-1 to chart-5", () => {
    const targets = nameTargets(SPEC);
    expect(targets.map((target) => target.label)).toEqual([
      ...PALETTE_NAMES.map((name) => `${name} 500`),
      "chart-1",
      "chart-2",
      "chart-3",
      "chart-4",
      "chart-5",
    ]);
    for (const name of PALETTE_NAMES) {
      const step = SPEC.color.palettes[name].light.find((entry) => entry.step === 500);
      const target = targets.find((item) => item.label === `${name} 500`);
      expect(target?.hex).toBe(step?.hex);
      expect(target?.color).toEqual(step?.oklch);
    }
    for (const role of ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"] as const) {
      const hex = SPEC.color.roles.light[role];
      const target = targets.find((item) => item.label === role);
      expect(target?.hex).toBe(hex);
      expect(target?.color).toEqual(rgbToOklch(hexToRgb(hex), "srgb"));
    }
  });
});

describe("fontNote", () => {
  it.each([
    ["unbounded", "the system sans-serif", "Unbounded"],
    ["host-grotesk", "the system sans-serif", "Host Grotesk"],
    ["literata", "the system serif", "Literata"],
    ["fragment-mono", "the system monospace", "Fragment Mono"],
  ] as const)("C-INSPECT-22 names %s and the kind of its fallback, %s", (id, fallback, family) => {
    expect(fontNote(id)).toEqual({
      text: `${family} did not load. The canvas uses ${fallback} instead.`,
      fallback,
    });
  });

  it("C-INSPECT-22 never names a ui-* family, which only Safari knows", () => {
    for (const id of ["unbounded", "literata", "fragment-mono", "geist", "tiny5", "gloock"]) {
      expect(fontNote(id).text, id).not.toMatch(/ui-/);
    }
  });
});

describe("fixOutcome", () => {
  const ring = withValue(SPEC, ["color", "roles", "light", "ring"], "#f4f4f4") as DesignSpec;
  const f1 = lintSpec(ring).find((item) => item.id === "F1" && item.subject === "ring/background");
  const key = f1 === undefined ? "" : findingKey(f1);
  const atAaa = withValue(ring, ["color", "params", "contrastLevel"], "AAA") as DesignSpec;

  it("C-INSPECT-23 is kept when the regenerated spec at the fix's level still holds the finding", () => {
    expect(key).toBe("F1 light ring/background");
    expect(fixOutcome({ key, level: "AAA" }, atAaa, lintSpec(atAaa))).toBe("kept");
  });

  it("C-INSPECT-23 is cleared when the spec at the fix's level does not hold it", () => {
    const clean = withValue(SPEC, ["color", "params", "contrastLevel"], "AAA") as DesignSpec;
    expect(fixOutcome({ key, level: "AAA" }, clean, lintSpec(clean))).toBe("cleared");
  });

  it("C-INSPECT-23 is superseded when the spec is at another level, whatever it holds", () => {
    expect(fixOutcome({ key, level: "AAA" }, ring, lintSpec(ring))).toBe("superseded");
    expect(fixOutcome({ key, level: "AA+" }, atAaa, [])).toBe("superseded");
  });
});

describe("R-05: a wrong type is a TypeError, an out-of-domain value a RangeError", () => {
  const T = TypeError;
  const R = RangeError;
  const missingRole = withValue(SPEC, ["color", "roles", "dark", "ring"], undefined);
  const badHex = withValue(SPEC, ["color", "roles", "dark", "ring"], "#12345");
  it.each([
    ["roleRows", () => roleRows(null as never), T],
    ["roleRows", () => roleRows({ color: null } as never), T],
    ["roleRows", () => roleRows(missingRole as never), T],
    ["roleRows", () => roleRows(badHex as never), R],
    ["passLevel", () => passLevel("4.5" as never, "text"), T],
    ["passLevel", () => passLevel(Number.NaN, "text"), R],
    ["passLevel", () => passLevel(0.99, "text"), R],
    ["passLevel", () => passLevel(21.01, "ui"), R],
    ["passLevel", () => passLevel(4.5, "large" as never), R],
    ["passLevel", () => passLevel(4.5, 1 as never), T],
    ["formatLc", () => formatLc("76" as never), T],
    ["formatLc", () => formatLc(Number.POSITIVE_INFINITY), R],
    ["formatLc", () => formatLc(Number.NaN), R],
    ["groupFindings", () => groupFindings(null as never), T],
    ["groupFindings", () => groupFindings([null] as never), T],
    [
      "groupFindings",
      () => groupFindings([finding("C1", "a/b", { severity: "fatal" as never })]),
      R,
    ],
    ["showMe", () => showMe(null as never), T],
    ["showMe", () => showMe(finding("K3" as never, "a/b")), R],
    ["showMe", () => showMe(finding("C1", 1 as never)), T],
    ["findingTitle", () => findingTitle("K3" as never), R],
    ["findingTitle", () => findingTitle(3 as never), T],
    ["findingKey", () => findingKey(null as never), T],
    ["findingKey", () => findingKey(finding("K3" as never, "a/b")), R],
    ["showMeMode", () => showMeMode(null as never), T],
    ["showMeVision", () => showMeVision(null as never), T],
    ["showMeVision", () => showMeVision(finding("K3" as never, "status/deutan")), R],
    ["showMeVision", () => showMeVision(finding("S1", 1 as never)), T],
    ["showMeMode", () => showMeMode(finding("C1", "a/b", { mode: "dim" as never })), R],
    ["findingMeasure", () => findingMeasure(null as never), T],
    ["findingMeasure", () => findingMeasure(finding("C1", "a/b", { measured: Number.NaN })), R],
    ["findingMeasure", () => findingMeasure(finding("C1", "a/b", { threshold: "3" as never })), T],
    ["nameTargets", () => nameTargets(null as never), T],
    ["nameTargets", () => nameTargets({ color: {} } as never), T],
    [
      "nameTargets",
      () => nameTargets(withValue(SPEC, ["color", "palettes", "info", "light"], null) as never),
      T,
    ],
    ["fontNote", () => fontNote(3 as never), T],
    ["fontNote", () => fontNote("comic-sans"), R],
    ["fixOutcome", () => fixOutcome(null as never, SPEC, []), T],
    ["fixOutcome", () => fixOutcome({ key: 1, level: "AAA" } as never, SPEC, []), T],
    ["fixOutcome", () => fixOutcome({ key: "k", level: "AAAA" } as never, SPEC, []), R],
    ["fixOutcome", () => fixOutcome({ key: "k", level: "AAA" }, null as never, []), T],
    ["fixOutcome", () => fixOutcome({ key: "k", level: "AAA" }, SPEC, null as never), T],
  ] as const)("C-INSPECT-24 %s throws the right error naming itself", (name, call, kind) => {
    expect(call).toThrow(kind);
    expect(call).toThrow(new RegExp(`^${name}:`));
  });

  it("C-INSPECT-24 every contrast level is a level fixOutcome takes", () => {
    for (const level of CONTRAST_LEVELS) {
      expect(() => fixOutcome({ key: "k", level }, SPEC, [])).not.toThrow();
    }
  });
});
