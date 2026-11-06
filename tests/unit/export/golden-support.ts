import {
  applyPreset,
  freshParams,
  generateSystem,
  PRESET_IDS,
  PRESETS,
  resolveParams,
} from "@/engine";
import { importShadcnCss } from "@/import/css";
import type { DesignSpec } from "@/spec";
import { readFixture } from "../import/helpers";
import { DEFAULT_PARAMS } from "../spec/support";

// The fixtures of docs/specs/03-export.md, section 4. `GOLDENS` holds the 14 preset specs and `imported-shadcn`.

/** `SITE.url`, the origin every export test passes. */
export const ORIGIN = "https://dyelot.vercel.app";

/** M1's `SPEC`: `generateSystem(DEFAULT_PARAMS, "seed-1")`. */
export const SPEC: DesignSpec = generateSystem(DEFAULT_PARAMS, "seed-1");

/** For each preset in `PRESET_IDS` order, the spec the studio generates for it. */
const PRESET_GOLDENS: readonly { id: string; spec: DesignSpec }[] = PRESET_IDS.map((id) => ({
  id,
  spec: generateSystem(
    resolveParams({ ...applyPreset(freshParams(), id), name: PRESETS[id].label }, "seed-1"),
    "seed-1",
  ),
}));

function importedSpec(): DesignSpec {
  const result = importShadcnCss(readFixture("shadcn-neutral.css"));
  if (!result.ok)
    throw new Error(`golden-support: the shadcn fixture did not import: ${result.error.code}`);
  return result.spec;
}

/** `IMPORTED`: shadcn's neutral theme read by the importer (R3-27). */
export const IMPORTED: DesignSpec = importedSpec();

/** The 14 presets in `PRESET_IDS` order, then `imported-shadcn`. */
export const GOLDENS: readonly { id: string; spec: DesignSpec }[] = [
  ...PRESET_GOLDENS,
  { id: "imported-shadcn", spec: IMPORTED },
];

/** A manifest entry: the design, and whether its bundle carries the flavor files (R5-27). */
export type ManifestGolden = {
  readonly id: string;
  readonly spec: DesignSpec;
  readonly flavor?: true;
};

/**
 * The goldens `manifest.json` records: `GOLDENS`, then `default-flavor`, the `default` preset's
 * design built with `flavor: true`. `GOLDENS` stays as M3 counted it (C-DMI-10).
 */
export const MANIFEST_GOLDENS: readonly ManifestGolden[] = [
  ...GOLDENS,
  {
    id: "default-flavor",
    spec: (GOLDENS.find((golden) => golden.id === "default") as { spec: DesignSpec }).spec,
    flavor: true,
  },
];
