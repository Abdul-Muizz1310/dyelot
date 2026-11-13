// The about page's words (docs/specs/06-gallery.md, R6-21 and section 11.2): pure, imports nothing.
// Every sentence of /about is here, and `restates` names the ruling or section each fact comes
// from; it is never shown. The page renders `ABOUT_SECTIONS` and holds no other prose.

export type AboutParagraph = { readonly text: string; readonly restates: readonly string[] };
export type AboutSection = {
  readonly id: "math" | "receipt" | "privacy" | "licenses";
  readonly heading: string;
  readonly paragraphs: readonly AboutParagraph[];
};
export type AboutLink = { readonly label: string; readonly href: string };

/** `value` and everything inside it, frozen. */
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

export const ABOUT_INTRO: AboutParagraph = deepFreeze({
  text: "dyelot turns one color, a few words or an image into a design system, measures every color it makes and writes the measurements down. This page says how it works, what leaves your browser and whose work it builds on.",
  restates: ["umbrella §1"],
});

export const ABOUT_SECTIONS: readonly AboutSection[] = deepFreeze([
  {
    id: "math",
    heading: "The color math",
    paragraphs: [
      {
        text: "Every color is stored in OKLCH, a color space whose lightness steps look even to the eye. Each palette has eleven steps, from 50 to 950, in a light mode and a dark mode.",
        restates: ["umbrella §4", "umbrella §5", "R-01"],
      },
      {
        text: "Each step has a target contrast against the page, from 1.06 to 1 for step 50 up to 15.5 to 1 for step 950: against white in light mode, and against a dark gray page in dark mode. The engine searches each step's lightness until the color, brought inside its gamut, meets its target, then picks the 8-bit hex nearest it. Steps 500, 600 and 700 must reach 3, 4.5 and 7 to 1 on that hex.",
        restates: ["umbrella §5 Scales and its M1 note", "R-06"],
      },
      {
        text: 'WCAG 2.2 contrast is the only pass or fail test, computed without rounding, so 4.499 to 1 fails a 4.5 check. Beside it the studio shows a score labeled "perceptual contrast (advisory)", from dyelot\'s own MIT implementation of a published formula; it never decides a check.',
        restates: ["umbrella §5 Contrast", "DR-0038"],
      },
      {
        text: "Status and chart colors are checked under simulated protanopia, deuteranopia and tritanopia, so they stay apart for people who see color differently.",
        restates: ["umbrella §5 Color blindness and its M1 note"],
      },
      {
        text: "The same seed and settings always give the same design. The link holds the whole design, and one design always exports the same bytes.",
        restates: ["umbrella §3 Determinism", "R-21", "R-22"],
      },
    ],
  },
  {
    id: "receipt",
    heading: "The receipt and the checker",
    paragraphs: [
      {
        text: "Every export carries receipt.json, in the format dyelot.check/1. It holds the 80 contrast checks of the design, 40 in each mode, of which 78 are required; the color-vision checks; whether every color sits inside its gamut; the linter's findings; and a hash of every other file in the export.",
        restates: ["umbrella §1 and its M3 note", "R3-08", "R3-23"],
      },
      {
        text: "The export also carries scripts/dyelot-check.mjs, a checker with no dependencies. A coding agent runs it before it finishes: it checks the theme against the receipt, measures the 78 required contrast pairs again and scans the source for raw colors and Tailwind palette classes. It prints PASS when the code keeps to the design.",
        restates: ["R3-24", "R3-25", "6.9.1 of M3"],
      },
      {
        text: "The studio will not export a design that fails a required check, so every design that leaves dyelot passes its own receipt.",
        restates: ["R3-42"],
      },
    ],
  },
  {
    id: "privacy",
    heading: "AI and privacy",
    paragraphs: [
      {
        text: "The studio works with no model at all. A word list reads a brief, seven chips steer a design, and the colors of an image are found in your browser. When a model answers, it only chooses settings that the engine checks; it never writes a color value.",
        restates: ["umbrella §10", "R4-01", "R4-07", "R4-42", "R4-44"],
      },
      {
        text: "When you ask for AI, dyelot tries, in order: the model built into Chrome, if you turned it on; your own OpenRouter key, if you connected one; dyelot's shared free quota; then the word list. Each result says which one answered.",
        restates: ["R4-30"],
      },
      {
        text: "The model built into Chrome runs on your device, and what you type stays there. Its switch is marked experimental.",
        restates: ["R4-31", "DR-0039"],
      },
      {
        text: "Your own key stays in this browser tab, unless you choose to remember it on this device, and it never reaches dyelot's server: your browser calls OpenRouter directly, and dyelot records nothing of those calls.",
        restates: ["R4-29", "R4-33", "R4-34"],
      },
      {
        text: "With your key or the shared quota, what an action needs goes to OpenRouter and the model's provider: your brief, your words for Refine, the design's settings and findings, or, for Read the vibe, the image's main colors and a copy of the image at most 768 pixels on its longest side. On the shared quota it passes through dyelot's server first.",
        restates: ["R4-09", "R4-39", "R4-45", "R4-46", "R4-48", "R4-49", "R4-50"],
      },
      {
        text: "On the shared quota, dyelot records each action in Langfuse, a tracing service, to see which free models fail: the messages sent, your brief, your words for Refine and an image's main colors among them, and the models' answers. An image itself is recorded only as its size in bytes and its width and height.",
        restates: ["R4-52", "src/server/ai/trace.ts", "the owner's ruling of 2026-11-05"],
      },
      {
        text: "Each visitor gets three shared actions a day. A signed cookie counts them; it holds the day and the count, and nothing that names you.",
        restates: ["R4-18"],
      },
      {
        text: "The shared quota also keeps each answer in its server's memory for up to 24 hours, filed under a hash of the request, so the same request can be answered again without a model call.",
        restates: ["R4-19"],
      },
      {
        text: "An image you choose is read in your browser. Nothing of it leaves your device until you press Read the vibe.",
        restates: ["R4-46"],
      },
      {
        text: "The brand video is made in your browser by Remotion, the video library dyelot uses. Remotion sends one usage event to remotion.pro for each render, with your IP address and this site's address. It never sends the video or the design, and dyelot cannot turn it off. A note says so before the first render, and recording the shader loop sends nothing.",
        restates: ["R5-53", "R5-54", "R5-55", "R5-56"],
      },
      {
        text: "dyelot has no analytics and no advertising, and tracks nothing beyond what this section names. A design lives in its link and, as a draft, in this browser's storage; dyelot's server keeps no design.",
        restates: ["umbrella §3", "umbrella §15", "R5-58", "R6-22"],
      },
    ],
  },
  {
    id: "licenses",
    heading: "Licenses",
    paragraphs: [
      {
        text: "dyelot is open source under the MIT license.",
        restates: ["umbrella §12"],
      },
      {
        text: "Every font family dyelot uses is under the SIL Open Font License, and dyelot serves each one from its own site, with no request to a font service.",
        restates: ["umbrella §6", "R2-03", "src/engine/fonts/catalog.ts"],
      },
      {
        text: "Remotion, which makes the brand video, is source-available under its own license, not open source. It is free for individuals and for companies of up to three people; a company of four or more people needs a Remotion Company License to use it. dyelot uses it as an individual's project.",
        restates: ["R5-55", "11.4 of M5"],
      },
      {
        text: "Mediabunny, which records the shader loop, is under the Mozilla Public License 2.0 and is used unmodified.",
        restates: ["R5-50", "README.md"],
      },
      {
        text: "The noise in the animated background is the simplex noise of webgl-noise by Ian McEwan and Ashima Arts, under the MIT license; its notice is kept in the code and in the export.",
        restates: ["R5-24", "src/flavor/flavor.mjs"],
      },
      {
        text: "Color names come from color-name-list, under the MIT license.",
        restates: ["umbrella §5 Names"],
      },
      {
        text: "The colors of an image are found with colorthief by Lokesh Dhakar, under the MIT license.",
        restates: ["umbrella §5 Image to palette", "R4-60"],
      },
      {
        text: "The 3D explorer was inspired by oklch-picker by Evil Martians, under the MIT license; dyelot uses none of its code.",
        restates: ["R5-07", "11.4 of M5"],
      },
    ],
  },
]);

/** The two links of section 11.3, each placed after the paragraph it belongs to. */
export const ABOUT_LINKS: readonly AboutLink[] = deepFreeze([
  { label: "The source on GitHub", href: "https://github.com/Abdul-Muizz1310/dyelot" },
  { label: "Remotion's license", href: "https://remotion.pro/license" },
]);
