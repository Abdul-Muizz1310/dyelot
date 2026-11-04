import { PRESETS, ROLE_NAMES, type Summary } from "@/engine";
import type { DesignSpec } from "@/spec";
import { fontPackage } from "./fonts";
import { fmt4 } from "./format";
import { USE_FOR } from "./prose";

// The fixed prose and tables DESIGN.md and the prompt share (R3-22, sections 6.9 and 6.11). Plain
// functions of the spec: no user text is written here without `mdText` at the call site.

/** Five guards read as studio notes; they are reworded on export (R3-22). Others pass as written. */
const REWORDED_GUARDS: Readonly<Record<string, string>> = Object.freeze({
  "Hard shadows exist only here":
    "Hard offset shadows belong to this style; do not mix them with soft shadows.",
  "No vibration": "Never set saturated text on a saturated fill of a far hue.",
  "Not wellness beige":
    "Keep the earth tones saturated enough to read as a choice, not a default beige.",
  "Reading order stays": "Overlap and rotation never change the reading or focus order.",
  "Familiar patterns stay":
    "Keep familiar interface patterns; the expression lives in shape and motion.",
});

/** The guards of a preset as exported. */
export function exportedGuards(guards: readonly string[]): string[] {
  return guards.map((guard) => REWORDED_GUARDS[guard] ?? guard);
}

/** The size of the body step in px: 16 in the product context, 14 in a dense one. */
export function bodySize(spec: DesignSpec): string {
  const step = spec.type.steps.find((item) => item.name === "body");
  return fmt4((step as { sizePx: number }).sizePx);
}

/** The Colors table of section 6.9: a header and 46 rows in `ROLE_NAMES` order. */
export function colorTable(spec: DesignSpec): string[] {
  return [
    "| Role | Light | Dark | Use for |",
    "|---|---|---|---|",
    ...ROLE_NAMES.map(
      (role) =>
        `| \`${role}\` | ${spec.color.roles.light[role]} | ${spec.color.roles.dark[role]} | ${USE_FOR[role]} |`,
    ),
  ];
}

/** The type step table of section 6.9: a header and 10 rows, caption to display. */
export function stepTable(spec: DesignSpec, weights: Readonly<Record<string, number>>): string[] {
  const weightOf = (name: string): number => {
    if (["display", "h1", "h2", "h3", "h4"].includes(name)) return weights.heading as number;
    return (name === "label" ? weights.label : weights.body) as number;
  };
  return [
    "| Step | Size | Line height | Tracking | Weight |",
    "|---|---|---|---|---|",
    ...spec.type.steps.map(
      (step) =>
        `| \`${step.name}\` | ${fmt4(step.sizePx)} px | ${fmt4(step.lineHeightPx)} px | ${fmt4(step.trackingEm)} em | ${weightOf(step.name)} |`,
    ),
  ];
}

/** The unique Fontsource packages of the three families, in display, body, mono order. */
export function fontPackages(spec: DesignSpec): string[] {
  const { display, body, mono } = spec.type.families;
  const packages = [display, body, mono]
    .map((id) => fontPackage(id))
    .filter((name): name is string => name !== null);
  return [...new Set(packages)];
}

/** The four lines of section 9.2, from a summary. */
export function summaryLines(summary: Summary): string[] {
  const { contrast, separation, gamut, lint } = summary;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  let findings =
    lint.error === 0 ? "No lint errors" : plural(lint.error, "lint error", "lint errors");
  if (lint.warn > 0) findings += `, ${plural(lint.warn, "warning", "warnings")}`;
  if (lint.info > 0) findings += `, ${plural(lint.info, "note", "notes")}`;
  return [
    `${contrast.requiredPass} of ${contrast.required} required contrast checks pass`,
    `${separation.checks - separation.below} of ${separation.checks} color-vision checks keep status and chart colors apart`,
    `${gamut.values - gamut.outside} of ${gamut.values} colors inside ${gamut.gamut === "p3" ? "Display P3" : "sRGB"}`,
    findings,
  ];
}

/** The matched preset's label, summary and traits, or `null` (D2). */
export function presetLines(id: keyof typeof PRESETS | null): string[] {
  if (id === null) return [];
  const preset = PRESETS[id];
  const lines = [`Style: ${preset.label}. ${preset.summary}`];
  if (preset.unexpressed.length > 0) {
    lines.push(`Traits the tokens cannot hold yet: ${preset.unexpressed.join(", ")}.`);
  }
  return lines;
}
