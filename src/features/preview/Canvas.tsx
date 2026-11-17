"use client";

import "./canvas.css";
import {
  type RefObject,
  Suspense,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  ViewTransition,
} from "react";
import type { View } from "@/features/studio/view";
import type { DesignSpec } from "@/spec";
import { feelSpring } from "@/theme/vars";
import { MotionScope } from "./kit";
import { useOsReducedMotion } from "./kit/reduced";
import { TemplateBoundary } from "./TemplateBoundary";
import { forgetTemplate, KEEPING_LOADERS, Template } from "./templates";
import { idleScheduler, preloadTemplates, TEMPLATE_LINES } from "./templates/load";
import { shownTemplate, templateTransition } from "./transition";
import { useCanvasFonts } from "./useCanvasFonts";
import { canvasStyle } from "./vars";

// The canvas (spec section 7.4): a framed specimen on the house dot grid. The frame is the
// `[data-canvas]` of the view's mode: it carries `themeVars(spec, mode, { vision, units: "cqi" })`
// and the density's two properties, and keeps its layout width (360, 768 or 1280 px) so templates
// answer to it by container query. A frame wider than the canvas area scales down as a whole
// (R2-16 item 3); `.canvas-fit` holds the scaled size in the page's layout. `width` is the frame's
// layout width: the named frame, or the mobile template's board (F-TPL-32); `data-frame` keeps the
// view's frame either way. The template switch cross-fades (R5-46): `<ViewTransition>` names the
// template's one root, keyed by the deferred template, and `data-template` reads the shown one.
// Every template but the landing loads on demand (R6-33, 13.3): the `Suspense` and its error
// boundary sit above the keyed `<ViewTransition>`, so they are mounted and revealed before any
// switch. A switch with motion allowed is a transition, so a template still loading keeps the old
// one on screen and the switch commits once; under reduced motion it is urgent and the loading
// sentence shows. A template that could not load shows a sentence and "Try again". After the first
// render the five lazy templates load when the browser is idle, so a later switch finds them loaded
// and renders at once, with no loading sentence.

export function Canvas({
  spec,
  view,
  stageRef,
  scale,
  width,
}: {
  spec: DesignSpec;
  view: View;
  stageRef: RefObject<HTMLDivElement | null>;
  scale: number;
  width: number;
}) {
  const style = useMemo(
    () => canvasStyle(spec, view.mode, { vision: view.vision, density: view.density }),
    [spec, view.mode, view.vision, view.density],
  );
  const spring = useMemo(() => feelSpring(spec.motion), [spec.motion]);
  useCanvasFonts(spec.type.families);
  const deferred = useDeferredValue(view.template);
  const osReduced = useOsReducedMotion();
  const template = shownTemplate(deferred, view.template, view.reducedMotion || osReduced);
  const transition = templateTransition(view.reducedMotion);
  const shown = useMemo(() => ({ ...view, template }), [view, template]);
  const frame = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const element = frame.current;
    if (element === null) return;
    const measure = () => setHeight(element.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // A first load always shows the landing template (the view is never stored).
  useEffect(() => preloadTemplates("landing", idleScheduler(window), KEEPING_LOADERS), []);
  return (
    <div ref={stageRef} data-canvas-stage="" className="canvas-stage">
      <div className="canvas-fit" style={{ width: width * scale, height: height * scale }}>
        <div
          data-canvas-scale=""
          className="canvas-scale"
          style={{ width, transform: `scale(${scale})` }}
        >
          <div
            ref={frame}
            data-canvas=""
            data-frame={view.frame}
            data-mode={view.mode}
            data-density={view.density}
            data-reduced-motion={String(view.reducedMotion)}
            data-copy={view.copy}
            data-vision={view.vision}
            data-template={template}
            style={style}
          >
            <MotionScope reduced={view.reducedMotion} spring={spring}>
              <TemplateBoundary
                shown={template}
                forget={(id) => {
                  if (id !== "landing") forgetTemplate(id);
                }}
              >
                <Suspense
                  fallback={
                    <p role="status" data-template-loading="" className="canvas-note kit-t-body">
                      {TEMPLATE_LINES.loading}
                    </p>
                  }
                >
                  <ViewTransition
                    key={template}
                    name="dyelot-template"
                    share={transition.share}
                    enter={transition.enter}
                    exit={transition.exit}
                    default={transition.default}
                  >
                    <Template spec={spec} view={shown} />
                  </ViewTransition>
                </Suspense>
              </TemplateBoundary>
            </MotionScope>
          </div>
        </div>
      </div>
    </div>
  );
}
