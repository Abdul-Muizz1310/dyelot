import { describeType } from "@/features/studio/guards";
import type { View } from "@/features/studio/view";

// The canvas frames (spec section 7.4, R2-16 item 3). A frame keeps its layout width, so the
// container queries of a template answer for the named frame; a frame wider than the canvas area
// scales down with `transform: scale` and the switcher shows the fit. Pure.

export type Frame = View["frame"];

/** The frame widths, in the switcher's order. */
export const FRAMES: readonly Frame[] = Object.freeze([360, 768, 1280] as const);

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
  // The epsilon keeps a float product such as 90.99999999999999 at 91.
  return { scale, label: `fit ${Math.floor(scale * 100 + 1e-9)}%` };
}
