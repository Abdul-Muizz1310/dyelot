"use client";

import "./kitchen-sink.css";
import { useId, useMemo } from "react";
import type { Mode } from "@/engine";
import type { View } from "@/features/studio/view";
import type { DesignSpec } from "@/spec";
import { themeVars } from "@/theme/vars";
import { type CanvasCopy, COPY } from "../copy";
import { Entrance } from "../kit";
import { canvasStyle } from "../vars";
import { Components } from "./sink/Components";
import { MotionDemos } from "./sink/MotionDemos";
import { ShapeAndDepth } from "./sink/ShapeAndDepth";
import { Swatches } from "./sink/Swatches";
import { TypeSteps } from "./sink/TypeSteps";

// The kitchen sink (spec section 7.5): the light and dark canvases side by side, each a
// `[data-canvas]` with that mode's variables, holding every role with its hex and measured ratio,
// every type step, radius, shadow and motion token, and every kit component in every state it
// supports. Sample content is fictional: a tide-reading app called Saltmarsh.

const MODES: readonly Mode[] = ["light", "dark"];

export function KitchenSink({ spec, view }: { spec: DesignSpec; view: View }) {
  const copy = COPY[view.copy];
  return (
    <div data-template-root="kitchen-sink">
      <Entrance className="sink-panes">
        {MODES.map((mode) => (
          // A new copy set remounts the pane, so the fields take their new default values.
          <Pane key={`${mode}-${view.copy}`} mode={mode} spec={spec} view={view} copy={copy} />
        ))}
      </Entrance>
    </div>
  );
}

function Pane({
  mode,
  spec,
  view,
  copy,
}: {
  mode: Mode;
  spec: DesignSpec;
  view: View;
  copy: CanvasCopy;
}) {
  const id = useId();
  const style = useMemo(
    () => canvasStyle(spec, mode, { vision: view.vision, density: view.density }),
    [spec, mode, view.vision, view.density],
  );
  const vars = useMemo(() => themeVars(spec, mode, { units: "cqi" }), [spec, mode]);
  return (
    <section
      data-canvas=""
      data-pane={mode}
      data-mode={mode}
      aria-labelledby={id}
      style={style}
      className="sink-pane"
    >
      <header className="sink-head">
        <p className="kit-mono kit-t-caption sink-muted">sample · kitchen sink · {mode}</p>
        <h2 id={id} className="kit-display kit-t-h2">
          {mode === "light" ? "Light" : "Dark"}
        </h2>
        <p className="kit-t-body sink-muted">
          Every role, type step, radius, shadow, motion token and component state of this design, in{" "}
          {mode} mode.
        </p>
      </header>
      <Swatches spec={spec} mode={mode} />
      <TypeSteps vars={vars} copy={copy} />
      <ShapeAndDepth vars={vars} copy={copy} />
      <MotionDemos vars={vars} />
      <Components copy={copy} />
    </section>
  );
}
