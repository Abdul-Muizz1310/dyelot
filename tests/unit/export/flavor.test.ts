import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { flavorSeed, flavorStops } from "@/engine";
import { brandProps } from "@/export/brand";
import { scanLine } from "@/export/checker/dyelot-check.mjs";
import { flavorFiles } from "@/export/flavor";
import { FLAVOR_SOURCES } from "@/export/flavor-sources";
import { cssComment, editLink } from "@/export/text";
import { lotTag, specId } from "@/spec";
import { GRAIN_URL } from "../../../src/flavor/flavor.mjs";
import { ORIGIN, SPEC } from "./golden-support";

// C-FEX-01 to 06 and C-FEX-19 of docs/specs/05-motion-3d.md, section 14.4 (R5-05, R5-24, R3-09,
// R3-11, section 12.1).

const ROOT = path.resolve(import.meta.dirname, "../../..");
const read = (relative: string): string => readFileSync(path.join(ROOT, relative), "utf8");
const FILES = flavorFiles(SPEC, ORIGIN);
const textOf = (file: string): string =>
  FILES.find((entry) => entry.path === file)?.text ?? `missing ${file}`;
const LINK = editLink(SPEC, ORIGIN);
const LOT = lotTag(specId(SPEC));
const PATHS = [
  "flavor/README.md",
  "flavor/flavor.mjs",
  "flavor/flavor-react.tsx",
  "flavor/flavor.css",
  "flavor/palette.json",
  "flavor/remotion/README.md",
  "flavor/remotion/brand-intro.tsx",
  "flavor/remotion/root.tsx",
  "flavor/remotion/brand.json",
];
const SOURCE_FILES: Record<string, string> = {
  "flavor/flavor.mjs": "src/flavor/flavor.mjs",
  "flavor/flavor-react.tsx": "src/flavor/flavor-react.tsx",
  "flavor/remotion/brand-intro.tsx": "src/flavor/remotion/brand-intro.tsx",
  "flavor/remotion/root.tsx": "src/flavor/remotion/root.tsx",
};

describe("FLAVOR_SOURCES", () => {
  it("C-FEX-01 holds exactly its four keys, each its file's text byte for byte", () => {
    expect(Object.keys(FLAVOR_SOURCES).sort()).toEqual(Object.keys(SOURCE_FILES).sort());
    for (const [key, file] of Object.entries(SOURCE_FILES)) {
      expect(FLAVOR_SOURCES[key as keyof typeof FLAVOR_SOURCES], key).toBe(read(file));
    }
  });
});

describe("flavorFiles", () => {
  it("C-FEX-02 gives R5-24's nine paths in order, each clean, the raw four equal to the sources", () => {
    expect(FILES.map((file) => file.path)).toEqual(PATHS);
    for (const { path: file, text } of FILES) {
      expect(text, file).not.toContain("\r");
      expect(text.startsWith("﻿"), file).toBe(false);
      expect(text, file).not.toMatch(/[ \t]$/m);
      expect(text.endsWith("\n"), file).toBe(true);
      expect(text.endsWith("\n\n"), file).toBe(false);
    }
    for (const key of Object.keys(SOURCE_FILES)) {
      expect(textOf(key), key).toBe(FLAVOR_SOURCES[key as keyof typeof FLAVOR_SOURCES]);
    }
  });

  it("C-FEX-03 writes flavor.css as the three headers, the fourth comment and the rule", () => {
    const stops = ["neutral-100", "primary-200", "secondary-400", "accent-400", "primary-500"].map(
      (name) => `var(--${name})`,
    );
    const [a, b, c, d, e] = stops;
    const css = [
      cssComment(`dyelot design system: untitled (LOT ${LOT})`),
      cssComment(`Made with dyelot. Edit this design: ${LINK}`),
      cssComment("Generated: change the design in the studio and export it again, not by hand."),
      "/* The still background: use it where WebGL2 is missing, or alone. It reads the color variables of app/theme.css. */",
      ".dyelot-flavor {",
      `  background-color: ${a};`,
      `  background-image: ${GRAIN_URL}, linear-gradient(in oklch 135deg, ${a} 0%, ${b} 25%, ${c} 50%, ${d} 75%, ${e} 100%);`,
      "}",
      "",
    ].join("\n");
    expect(textOf("flavor/flavor.css")).toBe(css);
    for (const line of textOf("flavor/flavor.css").split("\n")) {
      expect(scanLine(line).findings, line).toEqual([]);
    }
  });

  it("C-FEX-04 writes palette.json with its keys in order, as R3-11 lays out JSON", () => {
    const value = {
      name: "untitled",
      loopSeconds: 10,
      seed: flavorSeed(specId(SPEC)),
      fade: { durationMs: 200, easing: [0.2, 0, 0, 1] },
      light: flavorStops(SPEC, "light"),
      dark: flavorStops(SPEC, "dark"),
    };
    const text = textOf("flavor/palette.json");
    expect(text).toBe(`${JSON.stringify(value, null, 2)}\n`);
    expect(Object.keys(JSON.parse(text))).toEqual([
      "name",
      "loopSeconds",
      "seed",
      "fade",
      "light",
      "dark",
    ]);
  });

  it("C-FEX-05 writes both READMEs as section 12.1 words them", () => {
    expect(textOf("flavor/README.md")).toBe(README(LINK, LOT));
    const remotion = textOf("flavor/remotion/README.md");
    expect(remotion).toBe(REMOTION_README(LINK, LOT));
    expect(remotion).toContain("https://remotion.pro/license");
    expect(remotion).toContain("Companies of four or more people need a Remotion Company License.");
    expect(remotion).toContain(
      "npm install remotion@4.0.539 @remotion/cli@4.0.539 react react-dom",
    );
  });

  it("C-FEX-06 writes brand.json as both modes' brandProps in R3-11's layout", () => {
    const value = { light: brandProps(SPEC, "light"), dark: brandProps(SPEC, "dark") };
    expect(textOf("flavor/remotion/brand.json")).toBe(`${JSON.stringify(value, null, 2)}\n`);
  });

  it("C-FEX-19 throws TypeError for a spec that is not an object, RangeError for an http origin", () => {
    expect(() => flavorFiles(null as never, ORIGIN)).toThrow(TypeError);
    expect(() => flavorFiles(null as never, ORIGIN)).toThrow(/^flavorFiles/);
    expect(() => flavorFiles(SPEC, "http://dyelot.vercel.app")).toThrow(RangeError);
    expect(() => flavorFiles(SPEC, "http://dyelot.vercel.app")).toThrow(/^flavorFiles/);
    expect(() => flavorFiles(SPEC, "not a url")).toThrow(RangeError);
    expect(() => flavorFiles(SPEC, `${ORIGIN}/path`)).toThrow(/^flavorFiles/);
    expect(() => flavorFiles(SPEC, 5 as never)).toThrow(TypeError);
    expect(() => flavorFiles(SPEC, 5 as never)).toThrow(/^flavorFiles/);
  });
});

/** Section 12.1's `flavor/README.md`, written out here so a change to the generator shows. */
function README(link: string, lot: string): string {
  return `# Flavor: untitled

The animated background of the dyelot design "untitled" (LOT ${lot}), with its still CSS fallback and the Remotion source of
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

The background loops every 10 seconds. It pauses off-screen and in a hidden tab, and it draws one still frame when the
visitor's system asks for reduced motion. Show a Pause button wherever it moves.

## Videos

The brand video and a 10-second loop of this background are downloads from the Flavor dialog of dyelot's studio, not
files of this folder: ${link}

## License

The files outside \`remotion/\` are MIT, like the rest of this export. \`flavor.mjs\` holds simplex noise from webgl-noise
(MIT), with its notice. The files of \`remotion/\` need Remotion, which is not open source: read \`remotion/README.md\`.
`;
}

/** Section 12.1's `flavor/remotion/README.md`. */
function REMOTION_README(link: string, lot: string): string {
  return `# Brand video: untitled

Built with Remotion (https://www.remotion.dev). Remotion is not open source. Read its license before you use these
files: https://remotion.pro/license

Under its Free License, individuals, non-profit organizations and for-profit organizations with up to 3 employees may use
Remotion at no cost. Companies of four or more people need a Remotion Company License.

## Files

- \`brand-intro.tsx\`: the composition, 1280 × 720 at 30 frames a second, 6 seconds.
- \`root.tsx\`: registers \`brand-intro-light\` and \`brand-intro-dark\`.
- \`brand.json\`: the props of each, made from the design "untitled" (LOT ${lot}).

## Render it

\`\`\`sh
npm install remotion@4.0.539 @remotion/cli@4.0.539 react react-dom
npx remotion studio flavor/remotion/root.tsx
npx remotion render flavor/remotion/root.tsx brand-intro-light out/brand-intro-light.mp4
\`\`\`

dyelot renders the same composition in the browser from the Flavor dialog of its studio: ${link}
`;
}
