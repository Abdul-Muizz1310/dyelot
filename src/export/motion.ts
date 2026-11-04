import { springCurve } from "@/engine";
import { type DesignSpec, isPlainText } from "@/spec";
import { fmt4 } from "./format";
import { themeModel } from "./model";
import { cssComment, editLink } from "./text";
import type { BundleFile } from "./types";

// The motion files (section 6.7, R3-13, R3-20): `motion.css`, `motion.ts` and `gsap.ts`. The
// durations and easings are the values the theme bridge writes, so the files and `theme.css` agree.

const SPRING_NAMES = ["snappy", "smooth", "bouncy"] as const;
const LOT_PATTERN = /^[0-9a-f]{4}·[0-9a-f]{4}$/;

function describeType(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function check(spec: unknown, name: unknown, lot: unknown): void {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`motionFiles: spec must be an object, got ${describeType(spec)}`);
  }
  if (typeof name !== "string") {
    throw new TypeError(`motionFiles: name must be a string, got ${describeType(name)}`);
  }
  if (!isPlainText(name)) {
    throw new RangeError(`motionFiles: name must be plain text, got ${JSON.stringify(name)}`);
  }
  if (typeof lot !== "string") {
    throw new TypeError(`motionFiles: lot must be a string, got ${describeType(lot)}`);
  }
  if (!LOT_PATTERN.test(lot)) {
    throw new RangeError(`motionFiles: lot must look like 0123·4567, got ${JSON.stringify(lot)}`);
  }
}

/** The numbers of a bridge value such as `cubic-bezier(0.2, 0, 0, 1)` or `63ms`. */
function numbersOf(value: string): string[] {
  return value.match(/-?\d+(?:\.\d+)?/g) ?? [];
}

/** `motion/motion.css`, `motion/motion.ts` and `motion/gsap.ts`. */
export function motionFiles(
  spec: DesignSpec,
  name: string,
  lot: string,
  origin: string,
): readonly BundleFile[] {
  check(spec, name, lot);
  const model = themeModel(spec);
  const curves = SPRING_NAMES.map((id) => {
    const { visualDuration, bounce } = spec.motion.springs[id];
    return { id, visualDuration, bounce, ...springCurve({ visualDuration, bounce }) };
  });
  const link = editLink(spec, origin);
  const durations = model.durations.map(({ name: id, value }) => ({
    id,
    value,
    ms: numbersOf(value)[0] as string,
  }));
  const easings = model.easings.map(({ name: id, value }) => ({
    id,
    value,
    points: numbersOf(value),
  }));

  const root = [
    ...durations.map(({ id, value }) => `  --duration-${id}: ${value};`),
    ...easings.map(({ id, value }) => `  --ease-${id}: ${value};`),
    ...curves.map(({ id, samples }) => `  --spring-${id}: linear(${samples.join(", ")});`),
    ...curves.map(({ id, settleMs }) => `  --spring-${id}-settle: ${settleMs}ms;`),
  ];
  const reduced = [
    ...curves.map(({ id }) => `    --spring-${id}: linear(0, 1);`),
    ...curves.map(({ id }) => `    --spring-${id}-settle: var(--duration-fast);`),
  ];
  const css = `${[
    cssComment(`dyelot design system: ${name} (LOT ${lot})`),
    cssComment(`Made with dyelot. Edit this design: ${link}`),
    cssComment("Generated: change the design in the studio and export it again, not by hand."),
    ":root {",
    ...root,
    "}",
    "",
    "@media (prefers-reduced-motion: reduce) {",
    "  :root {",
    ...reduced,
    "  }",
    "}",
  ].join("\n")}\n`;

  const ts = `${[
    "// Motion tokens of this design. Durations are milliseconds; springs are for Motion's animate().",
    "export const durations = {",
    ...durations.map(({ id, ms }) => `  ${id}: ${ms},`),
    "} as const;",
    "",
    "export const easings = {",
    ...easings.map(({ id, points }) => `  ${id}: [${points.join(", ")}],`),
    "} as const;",
    "",
    "export const springs = {",
    ...curves.map(
      ({ id, visualDuration, bounce }) =>
        `  ${id}: { type: "spring", visualDuration: ${fmt4(visualDuration)}, bounce: ${fmt4(bounce)} },`,
    ),
    "} as const;",
    "",
    "export const springSettleMs = {",
    ...curves.map(({ id, settleMs }) => `  ${id}: ${settleMs},`),
    "} as const;",
  ].join("\n")}\n`;

  const gsap = `${[
    "// Motion tokens of this design for GSAP. Durations are seconds.",
    "// Register an ease with CustomEase.create(name, value), where value is one of the strings below.",
    "export const durations = {",
    ...durations.map(({ id, ms }) => `  ${id}: ${fmt4(Number(ms) / 1000)},`),
    "} as const;",
    "",
    "export const eases = {",
    ...easings.map(({ id, points }) => `  ${id}: "${points.join(",")}",`),
    "} as const;",
  ].join("\n")}\n`;

  return [
    { path: "motion/motion.css", text: css },
    { path: "motion/motion.ts", text: ts },
    { path: "motion/gsap.ts", text: gsap },
  ];
}
