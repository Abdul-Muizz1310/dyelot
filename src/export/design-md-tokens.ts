import { ROLE_NAMES, typeWeights } from "@/engine";
import type { DesignSpec } from "@/spec";
import { familyName } from "./fonts";
import { fmt4 } from "./format";
import { describeDesign } from "./prose";
import { yamlString } from "./text";

// The front matter of DESIGN.md (section 6.9, R3-21, R3-32) as an object. The writer prints it by
// hand; the importer parses it back and compares it with this object.

const SPACING_KEYS = ["0", "1", "2", "3", "4", "6", "8", "12", "16", "20", "24", "32"] as const;
const HEADING_STEPS: readonly string[] = ["display", "h1", "h2", "h3", "h4"];

type Component = Record<string, string>;

function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

const pair = (background: string, text: string, also: Component = {}): Component => ({
  backgroundColor: `{colors.${background}}`,
  textColor: `{colors.${text}}`,
  ...also,
});
const fill = (background: string): Component => ({ backgroundColor: `{colors.${background}}` });
const label: Component = { typography: "{typography.label}", rounded: "{rounded.md}" };

/** The 29 components of section 6.9, in table order: together they reference all 46 light roles. */
const COMPONENTS: readonly (readonly [string, Component])[] = [
  ["page", pair("background", "foreground", { typography: "{typography.body}" })],
  ["card", pair("card", "card-foreground", { rounded: "{rounded.lg}" })],
  ["popover", pair("popover", "popover-foreground", { rounded: "{rounded.md}" })],
  ["sidebar", pair("sidebar", "sidebar-foreground")],
  ["muted-panel", pair("muted", "muted-foreground")],
  ["muted-text", pair("background", "muted-foreground", { typography: "{typography.body-sm}" })],
  ["button-primary", pair("primary", "primary-foreground", { ...label, height: "40px" })],
  ["button-secondary", pair("secondary", "secondary-foreground", { ...label, height: "40px" })],
  ["menu-item-active", pair("accent", "accent-foreground")],
  ["sidebar-item-active", pair("sidebar-accent", "sidebar-accent-foreground")],
  ["sidebar-button-primary", pair("sidebar-primary", "sidebar-primary-foreground")],
  ["button-destructive", pair("destructive", "destructive-foreground", label)],
  ["alert-destructive", pair("destructive-subtle", "destructive-subtle-foreground")],
  ["badge-success", pair("success", "success-foreground")],
  ["alert-success", pair("success-subtle", "success-subtle-foreground")],
  ["badge-warning", pair("warning", "warning-foreground")],
  ["alert-warning", pair("warning-subtle", "warning-subtle-foreground")],
  ["badge-info", pair("info", "info-foreground")],
  ["alert-info", pair("info-subtle", "info-subtle-foreground")],
  ["divider", fill("border")],
  ["input-outline", fill("input")],
  ["focus-ring", fill("ring")],
  ["sidebar-divider", fill("sidebar-border")],
  ["sidebar-focus-ring", fill("sidebar-ring")],
  ...[1, 2, 3, 4, 5].map((n): [string, Component] => [`chart-${n}`, fill(`chart-${n}`)]),
];

/** The front matter of `designMd(spec, origin)` as an object, keys in the order of section 6.9. */
export function designMdTokens(spec: DesignSpec): Record<string, unknown> {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`designMdTokens: spec must be an object, got ${describeType(spec)}`);
  }
  const oneLiner = spec.meta.oneLiner;
  const weights = typeWeights(spec);
  const display = familyName(spec.type.families.display);
  const body = familyName(spec.type.families.body);
  const colors = Object.fromEntries(ROLE_NAMES.map((role) => [role, spec.color.roles.light[role]]));
  const typography = Object.fromEntries(
    spec.type.steps.map((step) => {
      const heading = HEADING_STEPS.includes(step.name);
      const role = heading ? "heading" : step.name === "label" ? "label" : "body";
      return [
        step.name,
        {
          fontFamily: heading ? display : body,
          fontSize: `${fmt4(step.sizePx)}px`,
          fontWeight: weights[role],
          lineHeight: `${fmt4(step.lineHeightPx)}px`,
          letterSpacing: `${fmt4(step.trackingEm)}em`,
        },
      ];
    }),
  );
  const radii = spec.shape.radii;
  return {
    version: "alpha",
    name: spec.meta.name,
    description: oneLiner ?? describeDesign(spec),
    colors,
    typography,
    rounded: {
      sm: `${fmt4(radii.sm)}px`,
      md: `${fmt4(radii.md)}px`,
      lg: `${fmt4(radii.lg)}px`,
      xl: `${fmt4(radii.xl)}px`,
      "2xl": `${fmt4(radii["2xl"])}px`,
      full: "9999px",
    },
    spacing: Object.fromEntries(
      SPACING_KEYS.map((key, i) => [key, `${fmt4(spec.space.scale[i] as number)}px`]),
    ),
    components: Object.fromEntries(COMPONENTS.map(([name, props]) => [name, { ...props }])),
  };
}

const PLAIN_KEY = /^[A-Za-z][A-Za-z0-9-]*$/;

function printValue(value: unknown, indent: number): string[] {
  const pad = " ".repeat(indent);
  const lines: string[] = [];
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const name = PLAIN_KEY.test(key) ? key : yamlString(key);
    if (typeof item === "object" && item !== null) {
      lines.push(`${pad}${name}:`, ...printValue(item, indent + 2));
    } else if (typeof item === "number") {
      lines.push(`${pad}${name}: ${item}`);
    } else {
      lines.push(`${pad}${name}: ${yamlString(item as string)}`);
    }
  }
  return lines;
}

/** The tokens as the YAML front matter text (no fences), every string quoted. */
export function printFront(tokens: Record<string, unknown>): string {
  return printValue(tokens, 0).join("\n");
}
