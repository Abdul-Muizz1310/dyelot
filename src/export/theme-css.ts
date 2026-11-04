import type { DesignSpec } from "@/spec";
import { lotTag, specId } from "@/spec";
import { themeModel } from "./model";
import { cssComment, editLink } from "./text";

// `app/theme.css` (section 6.2, R3-13, R3-14): Tailwind v4 and shadcn's roles from the theme bridge.

function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

function block(selector: string, declarations: readonly (readonly [string, string])[]): string {
  return `${selector} {\n${declarations.map(([name, value]) => `  ${name}: ${value};`).join("\n")}\n}`;
}

/** The CSS of a design: a header, `@theme`, `:root`, `.dark` and `@theme inline`. */
export function themeCss(spec: DesignSpec, origin: string): string {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`themeCss: spec must be an object, got ${describeType(spec)}`);
  }
  const model = themeModel(spec);
  const link = editLink(spec, origin);
  const { families, weights } = model;
  const lot = lotTag(specId(spec));

  const theme: [string, string][] = [
    ["--color-*", "initial"],
    ["--color-white", "#ffffff"],
    ["--color-black", "#000000"],
    ["--font-display", families.display.stack],
    ["--font-heading", families.display.stack],
    ["--font-body", families.body.stack],
    ["--font-sans", families.body.stack],
    ["--font-mono", families.mono.stack],
    ["--font-weight-heading", String(weights.heading)],
    ["--font-weight-label", String(weights.label)],
    ["--font-weight-body", String(weights.body)],
  ];
  for (const step of model.typeSteps) {
    theme.push(
      [`--text-${step.name}`, step.size],
      [`--text-${step.name}--line-height`, step.lineHeight],
      [`--text-${step.name}--letter-spacing`, step.tracking],
      [`--text-${step.name}--font-weight`, `var(--font-weight-${step.role})`],
    );
  }
  for (const step of model.typeSteps) theme.push([`--leading-${step.name}`, step.lineHeight]);
  for (const step of model.typeSteps) theme.push([`--tracking-${step.name}`, step.tracking]);
  theme.push(["--spacing", "4px"]);
  for (const name of ["sm", "md", "lg", "xl", "2xl"] as const) {
    theme.push([`--radius-${name}`, model.radii[name]]);
  }
  model.shadows.forEach((value, index) => {
    theme.push([`--shadow-${index + 1}`, value]);
  });
  for (const easing of model.easings) theme.push([`--ease-${easing.name}`, easing.value]);

  const colorsOf = (mode: "light" | "dark"): [string, string][] =>
    [...model.roles, ...model.steps].map((color) => [`--${color.name}`, color[mode]]);
  const root: [string, string][] = [
    ["--radius", model.radii.radius],
    ...colorsOf("light"),
    ...model.durations.map(({ name, value }): [string, string] => [`--duration-${name}`, value]),
    ["--spring-duration", model.spring.duration],
    ["--spring-bounce", model.spring.bounce],
    ["--icon-stroke", model.iconStroke],
  ];
  const inline: [string, string][] = [...model.roles, ...model.steps].map((color) => [
    `--color-${color.name}`,
    `var(--${color.name})`,
  ]);

  return `${[
    cssComment(`dyelot design system: ${spec.meta.name} (LOT ${lot})`),
    cssComment(`Made with dyelot. Edit this design: ${link}`),
    cssComment("Generated: change the design in the studio and export it again, not by hand."),
    "@custom-variant dark (&:is(.dark *));",
    "",
    block("@theme", theme),
    "",
    block(":root", root),
    "",
    block(".dark", colorsOf("dark")),
    "",
    block("@theme inline", inline),
  ].join("\n")}\n`;
}
