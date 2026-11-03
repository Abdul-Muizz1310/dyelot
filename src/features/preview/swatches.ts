import { type Hex, hexToRgb, type Mode, ROLE_NAMES, type RoleName, wcagRatio } from "@/engine";
import { assertOneOf, assertRecord, isRecord } from "@/features/studio/guards";
import type { DesignSpec } from "@/spec";

// The kitchen sink's color swatches (spec section 7.5, F-TPL-01, F-TPL-02): every role with its
// stored hex and, for a text role, the WCAG ratio against the fill it sits on. The printed hex is
// the spec's, whatever the color-vision view shows. Pure.

export type Swatch = {
  readonly role: RoleName;
  readonly hex: Hex;
  readonly pair: { readonly fill: RoleName; readonly ratio: number } | null;
};

const MODES: readonly Mode[] = ["light", "dark"];
const SUFFIX = "-foreground";

const isRole = (name: string): name is RoleName => (ROLE_NAMES as readonly string[]).includes(name);

/** The fill a text role sits on: `foreground` on `background`, each `<x>-foreground` on `<x>`. */
export const TEXT_PAIRS: Readonly<Partial<Record<RoleName, RoleName>>> = Object.freeze(
  Object.fromEntries(
    ROLE_NAMES.flatMap((role) => {
      const fill = role === "foreground" ? "background" : role.slice(0, -SUFFIX.length);
      return role.endsWith("foreground") && isRole(fill) ? [[role, fill]] : [];
    }),
  ),
);

/** The 46 swatches of `mode`, in `ROLE_NAMES` order, frozen. */
export function swatches(spec: DesignSpec, mode: Mode): readonly Swatch[] {
  assertRecord(spec, "swatches: spec");
  assertOneOf(mode, MODES, "swatches: mode");
  const roles: unknown = isRecord(spec.color) ? spec.color.roles : undefined;
  assertRecord(roles, "swatches: spec.color.roles");
  assertRecord(roles[mode], `swatches: spec.color.roles.${mode}`);
  const table = spec.color.roles[mode];
  for (const role of ROLE_NAMES) {
    if (typeof table[role] !== "string") {
      throw new TypeError(`swatches: spec.color.roles.${mode}.${role} must be a hex string`);
    }
  }
  return Object.freeze(
    ROLE_NAMES.map((role) => {
      const fill = TEXT_PAIRS[role];
      const pair =
        fill === undefined
          ? null
          : Object.freeze({ fill, ratio: wcagRatio(hexToRgb(table[role]), hexToRgb(table[fill])) });
      return Object.freeze({ role, hex: table[role], pair });
    }),
  );
}
