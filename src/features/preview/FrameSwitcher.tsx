"use client";

import { Choice } from "@/features/studio/controls";
import { FRAMES, type Frame } from "./frame";
import { useFitReading } from "./useFrameFit";

// The frame switcher (spec section 7.4): a radio group "Frame" of 360, 768 and 1280, and the fit of
// a frame wider than the canvas area ("fit 91%", R2-16 item 3), read from the canvas area's fit
// store and announced as the group's description (review M-5). A template that keeps its own width
// (`fixed`, the mobile template's "Three 360 px screens", F-TPL-32) disables the group, which keeps
// the frame it held, and its note says why in place of the fit.

export function FrameSwitcher({
  frame,
  fixed,
  onChange,
}: {
  frame: Frame;
  /** Why the frame cannot change for the template shown, or nothing when it can. */
  fixed?: string;
  onChange(frame: Frame): void;
}) {
  const { label } = useFitReading();
  return (
    <Choice
      legend="Frame"
      inline
      disabled={fixed !== undefined}
      value={String(frame)}
      options={FRAMES.map((width) => ({ value: String(width), label: String(width) }))}
      onChange={(value) => {
        const chosen = FRAMES.find((width) => String(width) === value);
        if (chosen !== undefined) onChange(chosen);
      }}
      note={<span data-frame-fit="">{fixed ?? label}</span>}
    />
  );
}
