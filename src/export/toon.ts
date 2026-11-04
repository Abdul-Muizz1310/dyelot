import { encode } from "@toon-format/toon";
import { PALETTE_NAMES, STEPS } from "@/engine";
import type { DesignSpec } from "@/spec";
import { themeModel } from "./model";
import { checkRoleHexes } from "./token-input";
import type { BundleFile } from "./types";

// design.toon (R3-19, 6.6): the palettes and roles as two TOON tables, exactly `encode`'s text.

/** `design.toon`: `encode({ scales, roles })` with default options and no trailing newline. */
export function toonFile(spec: DesignSpec): BundleFile {
  if (typeof spec !== "object" || spec === null) {
    throw new TypeError(
      `toonFile: spec must be an object, got ${spec === null ? "null" : typeof spec}`,
    );
  }
  checkRoleHexes("toonFile", spec);
  const model = themeModel(spec);
  const stepsByName = new Map(model.steps.map((step) => [step.name, step]));
  const scales = PALETTE_NAMES.flatMap((palette) =>
    (["light", "dark"] as const).map((mode) => ({
      palette,
      mode,
      ...Object.fromEntries(
        STEPS.map((step) => [`s${step}`, stepsByName.get(`${palette}-${step}`)?.[mode]]),
      ),
    })),
  );
  const roles = model.roles.map(({ name, light, dark }) => ({ role: name, light, dark }));
  return { path: "design.toon", text: encode({ scales, roles }) };
}
