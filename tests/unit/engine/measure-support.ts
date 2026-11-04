import type { PresetId } from "@/engine";
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

// The fixtures of the measurement cases (spec section 10, Fixtures): SPEC and the preset goldens.
// The `imported-shadcn` golden needs the importer of M3 and joins in a later task.

/** `generateSystem(DEFAULT_PARAMS, "seed-1")`, M1's SPEC. */
export const SPEC: DesignSpec = generateSystem(DEFAULT_PARAMS, "seed-1");

/** The 14 preset goldens, in `PRESET_IDS` order. */
export const PRESET_GOLDENS: readonly { readonly id: PresetId; readonly spec: DesignSpec }[] =
  PRESET_IDS.map((id) => ({
    id,
    spec: generateSystem(
      resolveParams({ ...applyPreset(freshParams(), id), name: PRESETS[id].label }, "seed-1"),
      "seed-1",
    ),
  }));
