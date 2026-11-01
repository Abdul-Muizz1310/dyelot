"use client";

import { type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type Frame, frameFit } from "./frame";

// The fit of the canvas frame (R2-16 item 3, F-CANVAS-03): the stage's width, measured before
// paint and on every resize, against the named frame. Until the stage is measured the frame
// shows at full size and the switcher says nothing.

const UNMEASURED = Object.freeze({ scale: 1, label: "" });

export function useFrameFit(frame: Frame): {
  stageRef: RefObject<HTMLDivElement | null>;
  fit: { readonly scale: number; readonly label: string };
} {
  const stageRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<number | null>(null);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (stage === null) return;
    const measure = () => {
      // A hidden stage measures 0; the last width stands until it shows again.
      if (stage.clientWidth > 0) setAvailable(stage.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  const fit = useMemo(
    () => (available === null ? UNMEASURED : frameFit(available, frame)),
    [available, frame],
  );
  return { stageRef, fit };
}
