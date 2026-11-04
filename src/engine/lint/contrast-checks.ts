import type { RoleName } from "../color/roles";

// The one table of WCAG role pairs (spec R3-08). The linter's rules C1, C2, C5, N1, N2, N3 and F1
// and the measurements of `measureSpec` both read it, so they cannot disagree. It lives apart from
// `measure.ts` so that the rules can import it while `measure.ts` imports the rules' `gamutExcess`.

export type ContrastKind = "text" | "large-text" | "ui";
export type ContrastRule = "C1" | "C2" | "C5" | "N1" | "N2" | "N3" | "F1";

export type ContrastCheck = {
  /** `"<rule>:<foreground>/<background>"`. */
  readonly id: string;
  readonly rule: ContrastRule;
  readonly foreground: RoleName;
  readonly background: RoleName;
  readonly threshold: 4.5 | 3;
  readonly kind: ContrastKind;
  /** False for the border pair (N3) alone: it is advisory. */
  readonly required: boolean;
};

type Pair = readonly [foreground: RoleName, background: RoleName];

const against = (roles: readonly RoleName[], fills: readonly RoleName[]): Pair[] =>
  roles.flatMap((role) => fills.map((fill): Pair => [role, fill]));

const CHARTS: readonly RoleName[] = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

const GROUPS: readonly {
  readonly rule: ContrastRule;
  readonly threshold: 4.5 | 3;
  readonly kind: ContrastKind;
  readonly pairs: readonly Pair[];
}[] = [
  {
    rule: "C1",
    threshold: 4.5,
    kind: "text",
    pairs: [
      ["foreground", "background"],
      ["card-foreground", "card"],
      ["popover-foreground", "popover"],
      ["sidebar-foreground", "sidebar"],
      ["muted-foreground", "muted"],
      ["muted-foreground", "background"],
      ["secondary-foreground", "secondary"],
      ["accent-foreground", "accent"],
      ["sidebar-accent-foreground", "sidebar-accent"],
      ["success-subtle-foreground", "success-subtle"],
      ["warning-subtle-foreground", "warning-subtle"],
      ["info-subtle-foreground", "info-subtle"],
      ["destructive-subtle-foreground", "destructive-subtle"],
    ],
  },
  {
    rule: "C2",
    threshold: 3,
    kind: "large-text",
    pairs: against(["primary", "destructive", "success", "warning", "info"], ["background"]),
  },
  {
    rule: "C5",
    threshold: 4.5,
    kind: "text",
    pairs: [
      ["primary-foreground", "primary"],
      ["sidebar-primary-foreground", "sidebar-primary"],
      ["destructive-foreground", "destructive"],
      ["success-foreground", "success"],
      ["warning-foreground", "warning"],
      ["info-foreground", "info"],
    ],
  },
  { rule: "N1", threshold: 3, kind: "ui", pairs: against(["input"], ["background", "card"]) },
  { rule: "N2", threshold: 3, kind: "ui", pairs: against(CHARTS, ["background", "card"]) },
  { rule: "N3", threshold: 3, kind: "ui", pairs: [["border", "background"]] },
  {
    rule: "F1",
    threshold: 3,
    kind: "ui",
    pairs: against(["ring"], ["background", "card", "muted"]),
  },
];

/** The 40 WCAG checks of the linter, in its order. The array and every entry are frozen. */
export const CONTRAST_CHECKS: readonly ContrastCheck[] = Object.freeze(
  GROUPS.flatMap(({ rule, threshold, kind, pairs }) =>
    pairs.map(([foreground, background]) =>
      Object.freeze({
        id: `${rule}:${foreground}/${background}`,
        rule,
        foreground,
        background,
        threshold,
        kind,
        required: rule !== "N3",
      }),
    ),
  ),
);
