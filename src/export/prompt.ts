import { typeWeights } from "@/engine";
import type { DesignSpec } from "@/spec";
import { agentRules } from "./agents";
import { colorTable, stepTable } from "./design-md-prose";
import { describeDesign } from "./prose";
import { editLink, mdText } from "./text";
import { themeCss } from "./theme-css";

// `prompt.md` (section 6.11): a paste-ready first message for v0, Lovable, Bolt or a coding agent.

function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

/** The prompt as text, with one trailing newline. */
export function promptMd(spec: DesignSpec, origin: string): string {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`promptMd: spec must be an object, got ${describeType(spec)}`);
  }
  const link = editLink(spec, origin);
  const name = mdText(spec.meta.name);
  const thesis = spec.direction?.thesis;
  const lines = [
    `# Build with the ${name} design system`,
    "",
    `Build this interface with the ${name} design system. Follow every rule below, take each color, size, radius and shadow from its tokens, and never invent values of your own.`,
    "",
    "## Brief",
    "",
    ...(spec.meta.oneLiner === undefined ? [] : [mdText(spec.meta.oneLiner), ""]),
    describeDesign(spec),
    "",
    ...(thesis === undefined ? [] : [mdText(thesis), ""]),
    "### Colors",
    "",
    ...colorTable(spec),
    "",
    "### Type steps",
    "",
    ...stepTable(spec, typeWeights(spec)),
    "",
    "## Rules",
    "",
    ...agentRules(spec).map((rule) => `- ${rule}`),
    "",
    "## Theme",
    "",
    "Save this stylesheet as `app/theme.css`.",
    "",
    "```css",
    themeCss(spec, origin),
    "```",
    "",
    `Made with dyelot. Edit this design: ${link}`,
  ];
  return `${lines.join("\n")}\n`;
}
