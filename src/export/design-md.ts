import {
  lintSpec,
  measureSpec,
  PALETTE_NAMES,
  PRESETS,
  presetOf,
  springCurve,
  summarize,
  typeWeights,
} from "@/engine";
import type { DesignSpec } from "@/spec";
import {
  bodySize,
  colorTable,
  exportedGuards,
  fontPackages,
  presetLines,
  stepTable,
  summaryLines,
} from "./design-md-prose";
import { designMdTokens, printFront } from "./design-md-tokens";
import { familyName, fontPackage } from "./fonts";
import { fmt4 } from "./format";
import { themeModel } from "./model";
import { describeDesign } from "./prose";
import { editLink, mdText, slug } from "./text";
import { themeCss } from "./theme-css";

// `DESIGN.md` (section 6.9, R3-21, R3-22): Google's DESIGN.md format, alpha. The front matter is
// printed by hand from `designMdTokens`; the body follows in the canonical section order.

function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

/** The Install and Self-check sections of 6.9.1, with the placeholders filled. */
function installSection(spec: DesignSpec, slug: string, link: string, css: string): string {
  const model = themeModel(spec);
  const packages = fontPackages(spec);
  const { display, body, mono } = model.families;
  const fontIds = [
    ...new Set([display, body, mono].filter((f) => f.nextImport !== null).map((f) => f.id)),
  ];
  const fonts =
    packages.length === 0
      ? "No font package matches these families, so add the fonts yourself."
      : `Install the fonts with \`npm install ${packages.join(" ")}\` and import each once in \`app/layout.tsx\`: ${packages
          .map((name) => `\`import "${name}";\``)
          .join(" ")}.`;
  const route2 =
    fontIds.length === 0
      ? `Run \`npx shadcn@latest add ./registry/${slug}.json\`.`
      : `Run \`npx shadcn@latest add ./registry/${slug}.json\`, then \`npx shadcn@latest add ./registry/font-<id>.json\` for each font file (${fontIds
          .map((id) => `\`registry/font-${id}.json\``)
          .join(", ")}).`;
  return [
    "## Install",
    "",
    "Two routes put this system into a Next.js app with Tailwind CSS v4. Pick one.",
    "",
    `**Route 1: the stylesheet.** Copy \`app/theme.css\` into your app's \`app/\` folder. In \`app/globals.css\`, keep \`@import "tailwindcss";\` and add \`@import "./theme.css";\` right after it. If shadcn/ui wrote \`globals.css\`, delete its \`@custom-variant dark\`, \`:root\`, \`.dark\` and \`@theme inline\` blocks, because they would override this theme. ${fonts} Put the class \`dark\` on \`<html>\` to show dark mode.`,
    "",
    `**Route 2: shadcn.** ${route2} Do not also import \`app/theme.css\`. This route sets the colors, the radius and the fonts; the type steps, shadows and easings live only in \`app/theme.css\`, so copy its \`@theme\` block if you need them.`,
    "",
    "Either way, copy `scripts/dyelot-check.mjs` and `receipt.json` into the app's root, and add the block in `AGENTS.md.snippet` to your `AGENTS.md`. The files in `tokens/` are the source of truth for design tools; `design.toon` is a compact view of the same colors for prompts.",
    "",
    "```css",
    css,
    "```",
    "",
    "## Self-check before you finish",
    "",
    `Run \`node scripts/dyelot-check.mjs\` from the app's root before you finish any UI change. It checks the theme against \`receipt.json\`, measures the 78 required contrast pairs again, and scans the source for raw colors and Tailwind palette classes. Fix every finding until it prints \`PASS\`. A raw color you must keep needs a comment on its line: \`dyelot-check-ignore: <reason>\`. Never edit \`receipt.json\` or \`app/theme.css\` by hand to make the check pass; change the design in the studio and export it again: ${link}`,
  ].join("\n");
}

/** DESIGN.md as text: LF only, one trailing newline. */
export function designMd(spec: DesignSpec, origin: string): string {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`designMd: spec must be an object, got ${describeType(spec)}`);
  }
  let link: string;
  try {
    link = editLink(spec, origin);
  } catch (error) {
    if (error instanceof Error) {
      throw new (error instanceof RangeError ? RangeError : TypeError)(
        `designMd: ${error.message}`,
      );
    }
    /* c8 ignore next */
    throw error;
  }
  const model = themeModel(spec);
  const weights = typeWeights(spec);
  const preset = presetOf(spec);
  const { shadows } = model;
  const radii = spec.shape.radii;
  const name = mdText(spec.meta.name);
  const sectionEnd = (lines: readonly string[]) => [...lines, ""];

  const overview = [
    describeDesign(spec),
    ...(spec.direction?.thesis === undefined ? [] : [mdText(spec.direction.thesis)]),
    ...presetLines(preset),
    `Made with dyelot. Edit this design: <${link}>`,
  ];
  const family = (label: string, id: string) => {
    const pack = fontPackage(id);
    return `- ${label}: ${familyName(id)}${pack === null ? "" : ` (\`${pack}\`)`}`;
  };
  const guards = preset === null ? [] : exportedGuards(PRESETS[preset].guards);
  const rules = spec.rules;
  const rulesLines = [
    ...rules.do.map((rule) => `- Do ${mdText(rule)}`),
    ...rules.dont.map((rule) => `- Don't ${mdText(rule)}`),
    ...guards.map((guard) => `- ${guard}`),
    "- Do pair every fill with its foreground role.",
    "- Don't write a raw hex, rgb(), hsl() or oklch() value in a component.",
    "- Don't use Tailwind's default palette classes such as bg-blue-500.",
    `- Don't set body text under ${bodySize(spec)} px.`,
  ];
  const motion = spec.motion;
  const spring = (key: "snappy" | "smooth" | "bouncy") => {
    const { settleMs } = springCurve(motion.springs[key]);
    return `- \`${key}\`: visual duration ${fmt4(motion.springs[key].visualDuration)} s, bounce ${fmt4(motion.springs[key].bounce)}, settles in ${fmt4(settleMs)} ms`;
  };
  const summary = summarize(measureSpec(spec), lintSpec(spec), spec.color.params.gamut);
  const css = themeCss(spec, origin);
  const fileSlug = slug(spec.meta.name);

  const lines: string[] = [
    "---",
    printFront(designMdTokens(spec)),
    "---",
    "",
    `# ${name}`,
    "",
    ...(spec.meta.oneLiner === undefined ? [] : [mdText(spec.meta.oneLiner), ""]),
    "## Overview",
    "",
    ...overview.flatMap((line) => [line, ""]),
    "## Colors",
    "",
    ...sectionEnd(colorTable(spec)),
    `Eight scales (${PALETTE_NAMES.join(", ")}), each with 11 steps from 50 to 950, sit behind these roles. They live in \`app/theme.css\` and \`tokens/\`.`,
    "",
    "## Typography",
    "",
    family("Display", spec.type.families.display),
    family("Body", spec.type.families.body),
    family("Mono", spec.type.families.mono),
    "",
    "The display family sets `display` and `h1` to `h4`; the body family sets every other step.",
    "",
    ...sectionEnd(stepTable(spec, weights)),
    "## Layout",
    "",
    `The system uses a 4 px base and an 8 px rhythm. There are 12 units: ${spec.space.scale.map((px) => fmt4(px)).join(", ")} px.`,
    "",
    "## Elevation & Depth",
    "",
    `Depth style: ${spec.depth.style}. The five shadows, from \`shadow-1\` to \`shadow-5\`:`,
    "",
    ...shadows.map((value, i) => `- \`shadow-${i + 1}\`: ${value}`),
    "",
    "Dark mode shows elevation by surface lightness, not by shadow.",
    "",
    "## Shapes",
    "",
    `Radius set: ${spec.shape.radiusSet}. ${(["sm", "md", "lg", "xl", "2xl"] as const)
      .map((key) => `${key} ${fmt4(radii[key])} px`)
      .join(", ")}, full ${fmt4(radii.full)} px.`,
    "",
    "A nested element takes its parent's radius less its padding: inner radius = outer radius − padding.",
    "",
    "## Components",
    "",
    `- Cards: ${mdText(spec.components.cards)}`,
    `- Emphasis: ${mdText(spec.components.emphasis)}`,
    `- Inputs: ${mdText(spec.components.inputs)}`,
    `- Icons: ${mdText(spec.components.icons.library)}, ${fmt4(spec.components.icons.strokePx)} px stroke`,
    "",
    "## Do's and Don'ts",
    "",
    ...sectionEnd(rulesLines),
    "## Dark mode",
    "",
    "Dark mode is a second value for each of the 46 roles, listed in the Colors table. Put the class `dark` on `html` to show it.",
    "",
    "## Motion",
    "",
    `Motion feel: ${motion.feel}.`,
    "",
    `- Durations: ${model.durations.map(({ name: n, value }) => `${n} ${value}`).join(", ")}`,
    `- Easings: ${model.easings.map(({ name: n, value }) => `${n} ${value}`).join(", ")}`,
    spring("snappy"),
    spring("smooth"),
    spring("bouncy"),
    "",
    "Honor `prefers-reduced-motion`: drop movement and springs, and keep at most a fade.",
    "",
    "## Accessibility",
    "",
    `Contrast level: ${spec.color.params.contrastLevel}.`,
    "",
    ...sectionEnd(summaryLines(summary).map((line) => `- ${line}`)),
    installSection(spec, fileSlug, link, css),
  ];
  return `${lines.join("\n")}\n`;
}
