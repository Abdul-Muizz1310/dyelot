import type { CSSProperties } from "react";
import { type Mode, ROLE_NAMES, type RoleName } from "@/engine";
import { assertOneOf, assertRecord, assertString } from "@/features/studio/guards";
import { DENSITIES, VISIONS, type View } from "@/features/studio/view";
import type { DesignSpec } from "@/spec";
import { densityVars, type ThemeVars, themeVars } from "@/theme/vars";

// The custom properties a `[data-canvas]` carries (spec section 7.4, R2-12): the theme bridge's
// variables for a mode, with `cqi` units so the fluid display size follows the frame and the
// color-vision view recomputed through `simulate`, and the density's two properties. Pure. Its
// checks (R-05) name its own functions: a wrong type is a TypeError, a value outside its set a
// RangeError.

const MODES: readonly Mode[] = ["light", "dark"];

const isCustomProperty = (name: string): name is `--${string}` => name.startsWith("--");

/** The groups as one React style object; a name that is not a custom property is a RangeError. */
export function cssVariables(...groups: readonly ThemeVars[]): CSSProperties {
  const style: CSSProperties = {};
  for (const group of groups) {
    assertRecord(group, "cssVariables: group");
    for (const [name, value] of Object.entries(group)) {
      if (!isCustomProperty(name)) {
        throw new RangeError(`cssVariables: ${JSON.stringify(name)} is not a custom property`);
      }
      assertString(value, `cssVariables: ${name}`);
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
  assertRecord(spec, "canvasStyle: spec");
  assertOneOf(mode, MODES, "canvasStyle: mode");
  assertRecord(view, "canvasStyle: view");
  assertOneOf(view.vision, VISIONS, "canvasStyle: view.vision");
  assertOneOf(view.density, DENSITIES, "canvasStyle: view.density");
  const theme =
    view.vision === "none"
      ? themeVars(spec, mode, { units: "cqi" })
      : themeVars(spec, mode, { vision: view.vision, units: "cqi" });
  return cssVariables(theme, densityVars(view.density));
}

/**
 * A role's custom property (`var(--primary)` for `primary`): the one place a role variable is built from a name
 * (spec section 6.10). A name outside `ROLE_NAMES` is a RangeError, a non-string a TypeError.
 */
export function roleVar(role: RoleName): string {
  assertOneOf(role, ROLE_NAMES, "roleVar: role");
  return `var(--${role})`;
}
