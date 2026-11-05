import { buildBundle } from "@/export/bundle";
import { ORIGIN, SPEC } from "./golden-support";

/** `BUNDLE` of docs/specs/03-export.md, section 4: `buildBundle({ spec: SPEC, origin: ORIGIN })`. */
export const BUNDLE = buildBundle({ spec: SPEC, origin: ORIGIN });

/** `LONG_NAME`: "Saltmarsh" eight times and "Tidewater" cut to 8, 80 characters with no space. */
export const LONG_NAME = `${"Saltmarsh".repeat(8)}`.slice(0, 80);
