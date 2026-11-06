import { buildBundle } from "@/export/bundle";
import { ORIGIN, SPEC } from "./golden-support";

/** `BUNDLE` of docs/specs/03-export.md, section 4: `buildBundle({ spec: SPEC, origin: ORIGIN })`. */
export const BUNDLE = buildBundle({ spec: SPEC, origin: ORIGIN });

/** `FLAVOR_BUNDLE` of docs/specs/05-motion-3d.md, section 4: the same design with the flavor files. */
export const FLAVOR_BUNDLE = buildBundle({ spec: SPEC, origin: ORIGIN, flavor: true });

/** `LONG_NAME`: "Saltmarsh" eight times and "Tidewater" cut to 8, 80 characters with no space. */
export const LONG_NAME = `${"Saltmarsh".repeat(8)}`.slice(0, 80);
