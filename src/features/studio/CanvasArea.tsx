"use client";

import { type RefObject, useLayoutEffect } from "react";
import { Canvas } from "@/features/preview/Canvas";
import { useFitStore, useFrameFit } from "@/features/preview/useFrameFit";
import { type StudioStore, useStudio } from "./store";

// The canvas region (spec section 7.1, `<main aria-label="Canvas">`): the one part of the shell that
// follows the spec, the view and the generation status, and that measures the frame's fit. Keeping
// those subscriptions here means a regenerate, a view setting or a resize re-renders the canvas and
// the frame switcher, not the inputs panel or the inspector (review M-8 of Task 2.7).

export function CanvasArea({
  store,
  regionRef,
  inert,
}: {
  store: StudioStore;
  /** The region, which takes focus after a notice action (F-STUDIO-23) and from the skip link. */
  regionRef: RefObject<HTMLElement | null>;
  inert: boolean;
}) {
  const busy = useStudio(store, (studio) => studio.status.phase === "generating");
  const spec = useStudio(store, (studio) => studio.spec);
  const view = useStudio(store, (studio) => studio.view);
  const { stageRef, fit } = useFrameFit(view.frame);
  const fitStore = useFitStore();
  // Before paint, so the switcher never shows a stale fit.
  useLayoutEffect(() => {
    fitStore.set(fit);
  }, [fitStore, fit]);
  return (
    <main
      ref={regionRef}
      id="canvas"
      aria-label="Canvas"
      aria-busy={busy}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the canvas region scrolls, so it takes focus for keyboard scrolling (F-KEY-11, F-CANVAS-13).
      tabIndex={0}
      data-canvas-region=""
      inert={inert}
      className="studio-canvas p-4 md:p-6"
    >
      <Canvas spec={spec} view={view} stageRef={stageRef} scale={fit.scale} />
    </main>
  );
}
