import { MOTION_PRESETS, motionPresetOf } from "@/engine";
import { type DesignSpec, encodeSpec } from "@/spec";
import { assertOneOf, assertRecord, assertString } from "./guards";

// The links between the studio, the explorer and the motion lab, and the studio's motion line (spec
// R5-40, R5-45, section 5.4). Pure.

const PAGES = ["studio", "explore", "motion"] as const;

/** `/<page>#s=<encodeSpec(spec)>`: a page that opens the design. */
export function pageHref(page: (typeof PAGES)[number], spec: DesignSpec): string {
  assertString(page, "pageHref: page");
  assertRecord(spec, "pageHref: spec");
  assertOneOf(page, PAGES, "pageHref: page");
  return `/${page}#s=${encodeSpec(spec)}`;
}

/** "Motion tokens: <label> preset." or "Motion tokens: custom." */
export function motionLine(spec: DesignSpec): string {
  assertRecord(spec, "motionLine: spec");
  assertRecord(spec.motion, "motionLine: spec.motion");
  const { durations, easings, springs } = spec.motion;
  const id = motionPresetOf({ durations, easings, springs });
  return id === null
    ? "Motion tokens: custom."
    : `Motion tokens: ${MOTION_PRESETS[id].label} preset.`;
}
