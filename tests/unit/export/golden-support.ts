import {
  applyPreset,
  freshParams,
  generateSystem,
  PRESET_IDS,
  PRESETS,
  resolveParams,
} from "@/engine";
import type { DesignSpec } from "@/spec";
import { DEFAULT_PARAMS } from "../spec/support";

// The fixtures of docs/specs/03-export.md, section 4. `GOLDENS` holds the 14 preset specs for now;
// `imported-shadcn` joins in Task 3.7, once the importer (Task 3.5) is merged (controller ruling).

/** `SITE.url`, the origin every export test passes. */
export const ORIGIN = "https://dyelot.vercel.app";

/** M1's `SPEC`: `generateSystem(DEFAULT_PARAMS, "seed-1")`. */
export const SPEC: DesignSpec = generateSystem(DEFAULT_PARAMS, "seed-1");

/** For each preset in `PRESET_IDS` order, the spec the studio generates for it. */
export const GOLDENS: readonly { id: string; spec: DesignSpec }[] = PRESET_IDS.map((id) => ({
  id,
  spec: generateSystem(
    resolveParams({ ...applyPreset(freshParams(), id), name: PRESETS[id].label }, "seed-1"),
    "seed-1",
  ),
}));
