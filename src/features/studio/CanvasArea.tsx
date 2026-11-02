"use client";

import { type CSSProperties, type RefObject, useLayoutEffect } from "react";
import { Canvas } from "@/features/preview/Canvas";
import { FIXED_FRAMES } from "@/features/preview/templates";
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
  // "Show me" (F-CANVAS-11): the highlighted roles, which highlight.css outlines inside the canvas.
  const showMe = view.highlight === null ? "" : view.highlight.roles.join(" ");
  // The mobile template keeps its own width: its board takes the canvas area's (F-TPL-32).
  const board = FIXED_FRAMES[view.template] !== undefined;
  const { stageRef, fit, width } = useFrameFit(view.frame, board);
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
      data-show-me={showMe === "" ? undefined : showMe}
      // highlight.css multiplies the outline by this, so it stays 2 px on screen at any fit (M-7).
      style={{ "--show-me-scale": String(1 / fit.scale) } as CSSProperties}
      inert={inert}
      // Below 768 px the board keeps an 8 px side margin, so a phone window shows its 360 px screens at
      // a fit of 0.95 or more (section 7.4).
      className={`studio-canvas ${board ? "px-2 py-4 md:p-6" : "p-4 md:p-6"}`}
    >
      <Canvas spec={spec} view={view} stageRef={stageRef} scale={fit.scale} width={width} />
    </main>
  );
}
