import { readFileSync } from "node:fs";
import path from "node:path";
import { toHex } from "@/engine/color/convert";
import { gamutMap } from "@/engine/color/gamut";
import type { Hex } from "@/engine/color/types";

// Derives the Tailwind v4 default palette from node_modules/tailwindcss/theme.css (spec R2-09):
// every `--color-<palette>-<step>: oklch(L% C H);` line (H may be `none`), mapped with `toHex(gamutMap(color, "srgb"))`.
// `black` and `white` are not palette lines, so they never enter.

const THEME = path.resolve(import.meta.dirname, "../../../../node_modules/tailwindcss/theme.css");
const LINE = /--color-([a-z]+)-(\d+):\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+|none)\)/g;

export type TailwindEntry = { readonly name: string; readonly hex: Hex };

export function deriveTailwind(): {
  readonly entries: readonly TailwindEntry[];
  readonly palettes: readonly string[];
  readonly hexes: ReadonlySet<Hex>;
} {
  const css = readFileSync(THEME, "utf8");
  const entries = [...css.matchAll(LINE)].map(([, palette, step, l, c, h]): TailwindEntry => {
    const color = { l: Number(l) / 100, c: Number(c), h: h === "none" ? null : Number(h) };
    return { name: `${palette}-${step}`, hex: toHex(gamutMap(color, "srgb")) };
  });
  const palettes = [...new Set(entries.map((entry) => entry.name.replace(/-\d+$/, "")))];
  return { entries, palettes, hexes: new Set(entries.map((entry) => entry.hex)) };
}
