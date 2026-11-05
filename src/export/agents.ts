import { type DesignSpec, lotTag, specId } from "@/spec";
import { bodySize } from "./design-md-prose";
import { mdText } from "./text";

// `AGENTS.md.snippet` (section 6.10): eleven lines an agent reads before it changes UI.

function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

/** The eight rules of the snippet, without their list marker. The prompt reuses them (6.11). */
export function agentRules(spec: DesignSpec): string[] {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`agentRules: spec must be an object, got ${describeType(spec)}`);
  }
  return [
    "Read DESIGN.md before any UI change; it is the design brief.",
    "Colors, type, radius, shadows and motion come only from the tokens in app/theme.css.",
    "Never write a raw hex, rgb(), hsl() or oklch() color in a component.",
    "Use the role utilities (bg-background, text-foreground, bg-primary, text-primary-foreground, border-border), never Tailwind's default palette classes such as bg-blue-500.",
    "Pair every fill with its foreground role, such as bg-primary with text-primary-foreground.",
    `Set body text with the type steps (text-body and up), never under ${bodySize(spec)} px.`,
    "Animate with the tokens in motion/, and honor prefers-reduced-motion.",
    "Before you finish, run `node scripts/dyelot-check.mjs` and fix every finding until it prints PASS.",
  ];
}

/** The block to add to a project's `AGENTS.md`, with one trailing newline. */
export function agentsSnippet(spec: DesignSpec): string {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`agentsSnippet: spec must be an object, got ${describeType(spec)}`);
  }
  const lines = [
    `<!-- dyelot:start ${lotTag(specId(spec))} -->`,
    `## Design system: ${mdText(spec.meta.name)}`,
    ...agentRules(spec).map((rule) => `- ${rule}`),
    "<!-- dyelot:end -->",
  ];
  return `${lines.join("\n")}\n`;
}
