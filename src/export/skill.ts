import type { DesignSpec } from "@/spec";
import { editLink, mdText, yamlString } from "./text";
import type { BundleFile } from "./types";

// `skills/<slug>-design/SKILL.md` (section 6.12): an Agent Skill that restyles or audits UI.

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SLUG_MAX = 48;

function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

/** The skill file of a design. `slug` is the bundle's slug. */
export function skillFile(spec: DesignSpec, slug: string, origin: string): BundleFile {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`skillFile: spec must be an object, got ${describeType(spec)}`);
  }
  if (typeof slug !== "string") {
    throw new TypeError(`skillFile: slug must be a string, got ${describeType(slug)}`);
  }
  if (slug.length === 0 || slug.length > SLUG_MAX || !SLUG.test(slug)) {
    throw new RangeError(
      `skillFile: slug must be 1 to ${SLUG_MAX} characters of ${SLUG}, got ${JSON.stringify(slug)}`,
    );
  }
  const link = editLink(spec, origin);
  const name = `${slug}-design`;
  const label = mdText(spec.meta.name);
  const description = `Restyle or audit UI against the ${spec.meta.name} design system: its color roles, type steps, radius, shadows and motion. Use when building or changing UI in this app, or when checking it against DESIGN.md.`;
  const lines = [
    "---",
    `name: ${name}`,
    `description: ${yamlString(description)}`,
    "---",
    "",
    `# ${label} design`,
    "",
    "`DESIGN.md` is the brief for this design system: its color roles, type steps, radius, shadows and motion. Read it before you touch any UI. `app/theme.css` holds the tokens.",
    "",
    "## Restyle a component",
    "",
    "1. Read the component and list every color, size, radius and shadow it sets.",
    "2. Map every color to a role utility, such as `bg-card` with `text-card-foreground`.",
    "3. Map every size to a type step, such as `text-body` or `text-h2`.",
    "4. Map every radius and shadow to its token, such as `rounded-md` or `shadow-2`.",
    "5. Run `node scripts/dyelot-check.mjs` and fix every finding.",
    "",
    "## Audit the app",
    "",
    "1. Run `node scripts/dyelot-check.mjs` from the app's root.",
    "2. Group the findings by file.",
    "3. Fix each file's findings.",
    "4. Run the checker again. Repeat until it prints `PASS`.",
    "",
    `Made with dyelot. Edit this design: ${link}`,
  ];
  return { path: `skills/${name}/SKILL.md`, text: `${lines.join("\n")}\n` };
}
