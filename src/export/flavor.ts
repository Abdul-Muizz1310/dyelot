import { FLAVOR_STEPS, flavorSeed, flavorStops } from "@/engine";
import { type DesignSpec, lotTag, specId } from "@/spec";
import { flavorBackground, LOOP_SECONDS } from "../flavor/flavor.mjs";
import { brandProps } from "./brand";
import { FLAVOR_SOURCES } from "./flavor-sources";
import { cssComment, editLink, mdText } from "./text";
import type { BundleFile } from "./types";

// The nine files of `flavor/` (R5-24, section 12.1). Four are the shipped sources, byte for byte;
// five are generated from the design. Like the other generators it reads no clock, locale or
// randomness, so one design gives one set of bytes.

function describeType(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

function check(spec: unknown, origin: unknown): void {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(`flavorFiles: spec must be an object, got ${describeType(spec)}`);
  }
  if (typeof origin !== "string") {
    throw new TypeError(`flavorFiles: origin must be a string, got ${describeType(origin)}`);
  }
  let valid = false;
  try {
    const url = new URL(origin);
    valid = url.protocol === "https:" && url.origin === origin;
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new RangeError(
      `flavorFiles: origin must be an https origin with no path, got ${JSON.stringify(origin)}`,
    );
  }
}

/** `JSON.stringify(value, null, 2)` and a newline (R3-11). */
function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readme(name: string, lot: string, link: string): string {
  return `# Flavor: ${name}

The animated background of the dyelot design "${name}" (LOT ${lot}), with its still CSS fallback and the Remotion source of
its brand video. Edit this design: ${link}

## Files

- \`flavor.mjs\`: the background as a WebGL2 module with no dependency.
- \`flavor-react.tsx\`: a React component around it.
- \`flavor.css\`: the still background, read from the color variables of \`app/theme.css\`.
- \`palette.json\`: the five colors of each mode, the loop's length, the seed and the cross-fade.
- \`remotion/\`: the brand video's composition, built with Remotion. Read \`remotion/README.md\` first.

## Use it

In React:

\`\`\`tsx
import palette from "./flavor/palette.json";
import { Flavor } from "./flavor/flavor-react";

<Flavor stops={palette.light} seed={palette.seed} fade={palette.fade} className="h-80 w-full" />
\`\`\`

Without React:

\`\`\`js
import { mountFlavor } from "./flavor/flavor.mjs";

const flavor = mountFlavor(canvas, { stops, seed }); // canvas: a <canvas> sized by CSS
\`\`\`

Where WebGL2 is missing, the module paints the still gradient itself. To use the still background alone, give an element
the class \`dyelot-flavor\` from \`flavor.css\`.

## Motion

The background loops every ${LOOP_SECONDS} seconds. It pauses off-screen and in a hidden tab, and it draws one still frame when the
visitor's system asks for reduced motion. Show a Pause button wherever it moves.

## Videos

The brand video and a ${LOOP_SECONDS}-second loop of this background are downloads from the Flavor dialog of dyelot's studio, not
files of this folder: ${link}

## License

The files outside \`remotion/\` are MIT, like the rest of this export. \`flavor.mjs\` holds simplex noise from webgl-noise
(MIT), with its notice. The files of \`remotion/\` need Remotion, which is not open source: read \`remotion/README.md\`.
`;
}

function remotionReadme(name: string, lot: string, link: string): string {
  return `# Brand video: ${name}

Built with Remotion (https://www.remotion.dev). Remotion is not open source. Read its license before you use these
files: https://remotion.pro/license

Under its Free License, individuals, non-profit organizations and for-profit organizations with up to 3 employees may use
Remotion at no cost. Companies of four or more people need a Remotion Company License.

## Files

- \`brand-intro.tsx\`: the composition, 1280 × 720 at 30 frames a second, 6 seconds.
- \`root.tsx\`: registers \`brand-intro-light\` and \`brand-intro-dark\`.
- \`brand.json\`: the props of each, made from the design "${name}" (LOT ${lot}).

## Render it

\`\`\`sh
npm install remotion@4.0.539 @remotion/cli@4.0.539 react react-dom
npx remotion studio flavor/remotion/root.tsx
npx remotion render flavor/remotion/root.tsx brand-intro-light out/brand-intro-light.mp4
\`\`\`

dyelot renders the same composition in the browser from the Flavor dialog of its studio: ${link}
`;
}

/** The nine files of `flavor/`, in R5-24's order. */
export function flavorFiles(spec: DesignSpec, origin: string): readonly BundleFile[] {
  check(spec, origin);
  const id = specId(spec);
  const lot = lotTag(id);
  const link = editLink(spec, origin);
  const name = mdText(spec.meta.name);
  const stops = FLAVOR_STEPS.map(([palette, step]) => `var(--${palette}-${step})`);
  const still = flavorBackground(stops);
  const css = `${[
    cssComment(`dyelot design system: ${spec.meta.name} (LOT ${lot})`),
    cssComment(`Made with dyelot. Edit this design: ${link}`),
    cssComment("Generated: change the design in the studio and export it again, not by hand."),
    "/* The still background: use it where WebGL2 is missing, or alone. It reads the color variables of app/theme.css. */",
    ".dyelot-flavor {",
    `  background-color: ${still.backgroundColor};`,
    `  background-image: ${still.backgroundImage};`,
    "}",
  ].join("\n")}\n`;
  const palette = {
    name: spec.meta.name,
    loopSeconds: LOOP_SECONDS,
    seed: flavorSeed(id),
    fade: { durationMs: spec.motion.durations.base, easing: spec.motion.easings.standard },
    light: flavorStops(spec, "light"),
    dark: flavorStops(spec, "dark"),
  };
  const brand = { light: brandProps(spec, "light"), dark: brandProps(spec, "dark") };
  return [
    { path: "flavor/README.md", text: readme(name, lot, link) },
    { path: "flavor/flavor.mjs", text: FLAVOR_SOURCES["flavor/flavor.mjs"] },
    { path: "flavor/flavor-react.tsx", text: FLAVOR_SOURCES["flavor/flavor-react.tsx"] },
    { path: "flavor/flavor.css", text: css },
    { path: "flavor/palette.json", text: json(palette) },
    { path: "flavor/remotion/README.md", text: remotionReadme(name, lot, link) },
    {
      path: "flavor/remotion/brand-intro.tsx",
      text: FLAVOR_SOURCES["flavor/remotion/brand-intro.tsx"],
    },
    { path: "flavor/remotion/root.tsx", text: FLAVOR_SOURCES["flavor/remotion/root.tsx"] },
    { path: "flavor/remotion/brand.json", text: json(brand) },
  ];
}
