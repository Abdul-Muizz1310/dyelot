"use client";

import { Choice } from "@/features/studio/controls";
import { FRAMES, type Frame } from "./frame";
import { useFitReading } from "./useFrameFit";

// The frame switcher (spec section 7.4): a radio group "Frame" of 360, 768 and 1280, and the fit of
// a frame wider than the canvas area ("fit 91%", R2-16 item 3), read from the canvas area's fit
// store and announced as the group's description (review M-5).

export function FrameSwitcher({ frame, onChange }: { frame: Frame; onChange(frame: Frame): void }) {
  const { label } = useFitReading();
  return (
    <Choice
      legend="Frame"
      inline
      value={String(frame)}
      options={FRAMES.map((width) => ({ value: String(width), label: String(width) }))}
      onChange={(value) => {
        const chosen = FRAMES.find((width) => String(width) === value);
        if (chosen !== undefined) onChange(chosen);
      }}
      note={<span data-frame-fit="">{label}</span>}
    />
  );
}
