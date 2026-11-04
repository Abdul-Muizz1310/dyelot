import { themeCss } from "@/export/theme-css";
import type { BundleFile } from "@/export/types";
import { ORIGIN, SPEC } from "./golden-support";

// `STUB_FILES` of docs/specs/03-export.md, section 4: the 20 paths of a 21-file bundle other than
// `receipt.json`, each with the text `"stub <path>\n"`, except `app/theme.css`, which holds the real
// CSS so the checker's hash check holds. The receipt can be tested before the bundle exists.

// Three font items, as a design with three distinct loadable families has (section 4).
const FONT_IDS = ["inter", "lora", "jetbrains-mono"];

const PATHS: readonly string[] = [
  "DESIGN.md",
  "AGENTS.md.snippet",
  "prompt.md",
  "app/theme.css",
  "registry/untitled.json",
  ...FONT_IDS.map((id) => `registry/font-${id}.json`),
  "tokens/base.tokens.json",
  "tokens/light.tokens.json",
  "tokens/dark.tokens.json",
  "tokens/design.resolver.json",
  "tokens/figma/light.tokens.json",
  "tokens/figma/dark.tokens.json",
  "design.toon",
  "motion/motion.css",
  "motion/motion.ts",
  "motion/gsap.ts",
  "skills/untitled-design/SKILL.md",
  "scripts/dyelot-check.mjs",
];

export const STUB_FILES: readonly BundleFile[] = PATHS.map((path) => ({
  path,
  text: path === "app/theme.css" ? themeCss(SPEC, ORIGIN) : `stub ${path}\n`,
}));
