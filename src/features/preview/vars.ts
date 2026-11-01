import type { CSSProperties } from "react";
import type { Mode } from "@/engine";
import type { View } from "@/features/studio/view";
import type { DesignSpec } from "@/spec";
import { densityVars, type ThemeVars, themeVars } from "@/theme/vars";

// The custom properties a `[data-canvas]` carries (spec section 7.4, R2-12): the theme bridge's
// variables for a mode, with `cqi` units so the fluid display size follows the frame and the
// color-vision view recomputed through `simulate`, and the density's two properties. Pure.

const isCustomProperty = (name: string): name is `--${string}` => name.startsWith("--");

/** The groups as one React style object; a name that is not a custom property is a RangeError. */
export function cssVariables(...groups: readonly ThemeVars[]): CSSProperties {
  const style: CSSProperties = {};
  for (const group of groups) {
    for (const [name, value] of Object.entries(group)) {
      if (!isCustomProperty(name)) {
        throw new RangeError(`cssVariables: ${JSON.stringify(name)} is not a custom property`);
      }
      style[name] = value;
    }
  }
  return style;
}

/** The style of a `[data-canvas]` in `mode` under the view's vision and density. */
export function canvasStyle(
  spec: DesignSpec,
  mode: Mode,
  view: Pick<View, "vision" | "density">,
): CSSProperties {
  const theme =
    view.vision === "none"
      ? themeVars(spec, mode, { units: "cqi" })
      : themeVars(spec, mode, { vision: view.vision, units: "cqi" });
  return cssVariables(theme, densityVars(view.density));
}
