import type { Page } from "@playwright/test";
import { installColorResolver } from "./template-support";

// The shared chroma check of the achromatic-chrome flows: F-A11Y-04 (docs/specs/02-studio.md) and the
// M6 pages (docs/specs/06-gallery.md, I-M6-06).

/** sRGB channels 0–255 to OKLCH chroma, in the page (F-A11Y-04). */
export function chromaScript() {
  return (rgb: [number, number, number]): number => {
    const linear = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    const [r, g, b] = linear;
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    return Math.hypot(a, bb);
  };
}

/**
 * F-A11Y-04: every chromatic color painted under `options.root`, leaving out the `options.skip` subtrees, read through the shared
 * sRGB resolver: text, background, drawn borders and outlines. Allowed are the house neutrals, madder
 * where `options.madder` matches (default: the primary action and the focused control), the data swatches, and madder as the outline of a
 * highlighted scale cell (`data-show-me-cell`), which `exempted` counts.
 */
export async function chromaOffenders(
  page: Page,
  options: { root: string; skip: readonly string[]; madder?: string },
): Promise<{ problems: string[]; exempted: number }> {
  await installColorResolver(page);
  const { root: scope, skip, madder = "[data-primary], :focus-visible" } = options;
  return page.evaluate(
    ({ source, scope, skip, madder }) => {
      const chroma = new Function(`return (${source})`)() as (rgb: number[]) => number;
      const resolve = (window as unknown as { __dyelotRgba: (v: string) => number[] | null })
        .__dyelotRgba;
      const rootStyle = getComputedStyle(document.documentElement);
      // The house neutrals of src/app/globals.css: tinted grays shared by the portfolio's chrome.
      const neutrals = ["--fg-muted", "--border", "--border-bright", "--panel"].map((name) =>
        rootStyle.getPropertyValue(name).trim().toLowerCase(),
      );
      const hex = (rgb: number[]) =>
        `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
      // A partly transparent color reads back from the resolver's canvas with its channels rounded
      // through the alpha, so a house neutral is matched within two codes per channel.
      const channels = (text: string) =>
        [1, 3, 5].map((at) => Number.parseInt(text.slice(at, at + 2), 16));
      const isNeutral = (rgb: number[]) =>
        neutrals.some((neutral) =>
          channels(neutral).every((value, i) => Math.abs(value - (rgb[i] ?? -99)) <= 2),
        );
      const allowed = madder;
      const problems: string[] = [];
      let exempted = 0;
      for (const el of document.querySelectorAll(`${scope} *`)) {
        if (el.closest(["[data-swatch]", "script", "style", ...skip].join(", "))) continue;
        const style = getComputedStyle(el);
        const colors: [string, string][] = [
          ["color", style.color],
          ["background-color", style.backgroundColor],
        ];
        for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
          if (
            style[`border${side}Style`] !== "none" &&
            Number.parseFloat(style[`border${side}Width`]) > 0
          ) {
            colors.push([`border-${side.toLowerCase()}`, style[`border${side}Color`]]);
          }
        }
        if (style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0) {
          colors.push(["outline", style.outlineColor]);
        }
        const label = `${el.tagName.toLowerCase()}${el.closest("[data-probe]") === null ? "" : " [probe]"}`;
        for (const [property, value] of colors) {
          const rgba = resolve(value);
          if (rgba === null) {
            problems.push(`${label} ${property} unreadable ${value}`);
            continue;
          }
          if (rgba[3] === 0) continue;
          const rgb = rgba.slice(0, 3);
          if (chroma(rgb) <= 0.02 || isNeutral(rgb)) continue;
          if (hex(rgb) === "#f66c6d" && el.closest(allowed) !== null) continue;
          if (
            hex(rgb) === "#f66c6d" &&
            property === "outline" &&
            el.matches("[data-show-me-cell]")
          ) {
            exempted++;
            continue;
          }
          problems.push(`${label} ${property} ${value}`);
        }
      }
      return { problems, exempted };
    },
    { source: chromaScript().toString(), scope, skip, madder },
  );
}
