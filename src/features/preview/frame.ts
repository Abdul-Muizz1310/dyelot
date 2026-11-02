import { describeType } from "@/features/studio/guards";
import type { View } from "@/features/studio/view";

// The canvas frames (spec section 7.4, R2-16 item 3). A frame keeps its layout width, so the
// container queries of a template answer for the named frame; a frame wider than the canvas area
// scales down with `transform: scale` and the switcher shows the fit. Pure.

export type Frame = View["frame"];

/** The frame widths, in the switcher's order. */
export const FRAMES: readonly Frame[] = Object.freeze([360, 768, 1280] as const);

/** The fit's label: the percent floored, so a scaled frame never reads "fit 100%". */
function fitLabel(scale: number): string {
  // The epsilon keeps a float product such as 90.99999999999999 at 91.
  return `fit ${Math.floor(scale * 100 + 1e-9)}%`;
}

/** The narrowest and widest board the mobile template takes (section 6.14, F-TPL-32). */
const BOARD = Object.freeze({ min: 360, max: 1280 });

/**
 * The mobile template's board (section 6.14, F-TPL-32): the canvas area's width `available`, clamped to
 * 360 to 1280 px, the scale that fits it (never above 1) and the fit's label.
 */
export function boardFit(available: number): { width: number; scale: number; label: string } {
  if (typeof available !== "number") {
    throw new TypeError(`boardFit: available must be a number, got ${describeType(available)}`);
  }
  if (!Number.isFinite(available) || available <= 0) {
    throw new RangeError(`boardFit: available must be a positive finite width, got ${available}`);
  }
  const width = Math.min(BOARD.max, Math.max(BOARD.min, available));
  const scale = Math.min(1, available / width);
  return { width, scale, label: fitLabel(scale) };
}

/**
 * The scale that fits `frame` into `available` px, never above 1, and its label: the percent
 * floored, so a scaled frame never reads "fit 100%".
 */
export function frameFit(available: number, frame: Frame): { scale: number; label: string } {
  if (typeof available !== "number") {
    throw new TypeError(`frameFit: available must be a number, got ${describeType(available)}`);
  }
  if (!Number.isFinite(available) || available <= 0) {
    throw new RangeError(`frameFit: available must be a positive finite width, got ${available}`);
  }
  if (typeof frame !== "number") {
    throw new TypeError(`frameFit: frame must be a number, got ${describeType(frame)}`);
  }
  if (!FRAMES.includes(frame)) {
    throw new RangeError(`frameFit: frame must be one of ${FRAMES.join(", ")}, got ${frame}`);
  }
  const scale = Math.min(1, available / frame);
  return { scale, label: fitLabel(scale) };
}
