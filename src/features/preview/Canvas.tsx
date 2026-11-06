"use client";

import "./canvas.css";
import {
  type RefObject,
  useDeferredValue,
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
import { Template } from "./templates";
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
            </MotionScope>
          </div>
        </div>
      </div>
    </div>
  );
}
