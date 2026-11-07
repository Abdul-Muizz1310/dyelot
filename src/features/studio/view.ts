import {
  DEFICIENCIES,
  type Deficiency,
  type Density,
  type Mode,
  type PaletteName,
  PRESET_IDS,
  PRESETS,
  type PresetId,
  type Step,
} from "@/engine";
import { FRAMES } from "@/features/preview/frame";
import { assertOneOf, assertRecord, describeType } from "./guards";

// The canvas view settings (spec section 5.7, `View`): the mode, density, frame, template and the
// canvas toggles. They are not in a snapshot and not in the link (R2-13 item 7). Pure.

export type TemplateId =
  | "landing"
  | "dashboard"
  | "settings"
  | "mobile"
  | "editorial"
  | "kitchen-sink";
export type Highlight = {
  readonly roles: readonly string[];
  readonly cells: readonly { readonly palette: PaletteName; readonly step: Step }[];
};
export type View = {
  readonly mode: Mode;
  readonly density: Density;
  readonly frame: 360 | 768 | 1280;
  readonly template: TemplateId;
  readonly reducedMotion: boolean;
  readonly copy: "real" | "edge";
  readonly vision: "none" | Deficiency;
  readonly highlight: Highlight | null;
};

/** The templates, in the order of spec section 5.7. */
export const TEMPLATE_IDS: readonly TemplateId[] = Object.freeze([
  "landing",
  "dashboard",
  "settings",
  "mobile",
  "editorial",
  "kitchen-sink",
]);
/** The modes, in the toolbar's order. */
export const MODES: readonly Mode[] = Object.freeze(["light", "dark"]);
/** The densities, in the order the inputs panel and the toolbar list them. */
export const DENSITIES: readonly Density[] = Object.freeze(["comfortable", "compact", "dense"]);
const COPIES: readonly View["copy"][] = ["real", "edge"];
/** The color-vision views: none, then the three deficiencies `simulate` takes. */
export const VISIONS: readonly View["vision"][] = Object.freeze(["none", ...DEFICIENCIES]);

/** The view of a first load. */
export const DEFAULT_VIEW: View = Object.freeze({
  mode: "light",
  density: "comfortable",
  frame: 1280,
  template: "landing",
  reducedMotion: false,
  copy: "real",
  vision: "none",
  highlight: null,
});

function checkHighlight(value: unknown, name: string): void {
  if (value === null) return;
  assertRecord(value, name);
  if (!Array.isArray(value.roles) || !Array.isArray(value.cells)) {
    throw new TypeError(`${name} must hold roles and cells arrays`);
  }
}

/**
 * The view after a patch, a new object; every setting is checked first (R-05): a value of the
 * wrong type is a TypeError, a value outside its set or an unknown setting a RangeError. Errors
 * name `caller`, the public function that was called (the store's `setView`).
 */
export function mergeView(view: View, patch: Partial<View>, caller = "mergeView"): View {
  assertRecord(patch, `${caller}: patch`);
  for (const [key, value] of Object.entries(patch)) {
    const name = `${caller}: patch.${key}`;
    switch (key) {
      case "mode":
        assertOneOf(value, MODES, name);
        break;
      case "density":
        assertOneOf(value, DENSITIES, name);
        break;
      case "template":
        assertOneOf(value, TEMPLATE_IDS, name);
        break;
      case "copy":
        assertOneOf(value, COPIES, name);
        break;
      case "vision":
        assertOneOf(value, VISIONS, name);
        break;
      case "frame":
        if (typeof value !== "number") {
          throw new TypeError(`${name} must be a number, got ${describeType(value)}`);
        }
        if (!FRAMES.some((frame) => frame === value)) {
          throw new RangeError(`${name} must be one of ${FRAMES.join(", ")}, got ${String(value)}`);
        }
        break;
      case "reducedMotion":
        if (typeof value !== "boolean") {
          throw new TypeError(`${name} must be a boolean, got ${describeType(value)}`);
        }
        break;
      case "highlight":
        checkHighlight(value, name);
        break;
      default:
        throw new RangeError(`${name} is not a view setting`);
    }
  }
  return { ...view, ...patch };
}

/**
 * The view a design of `preset` opens with (R6-26, 10.3): the preset's mode and density over
 * `view`, or `view` itself for null. R-05: the view and the preset are checked here, since
 * `mergeView` checks only its patch.
 */
export function presetView(view: View, preset: PresetId | null): View {
  assertRecord(view, "presetView: view");
  for (const [name, value] of [
    ["view.mode", view.mode],
    ["view.density", view.density],
  ] as const) {
    if (typeof value !== "string") {
      throw new TypeError(`presetView: ${name} must be a string, got ${describeType(value)}`);
    }
  }
  if (preset !== null && typeof preset !== "string") {
    throw new TypeError(`presetView: preset must be a string or null, got ${describeType(preset)}`);
  }
  assertOneOf(view.mode, MODES, "presetView: view.mode");
  assertOneOf(view.density, DENSITIES, "presetView: view.density");
  if (preset === null) return view;
  assertOneOf(preset, PRESET_IDS, "presetView: preset");
  return { ...view, mode: PRESETS[preset].view.mode, density: PRESETS[preset].view.density };
}
