"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react";
import { type Mode, SOLID_GAMUTS, type SolidGamut } from "@/engine";
import { useOsReducedMotion } from "@/features/preview/kit/reduced";
import { BUTTON } from "@/features/studio/chrome";
import { Choice, LABEL, type Option } from "@/features/studio/controls";
import { pageHref } from "@/features/studio/pages";
import { bannerFor, readHash } from "@/features/studio/url";
import type { DesignSpec } from "@/spec";
import type { Drawn } from "./Explorer3D";
import { FlatView } from "./FlatView";
import {
  type Camera,
  DEFAULT_CAMERA,
  EXPLORE_LINES,
  GAMUT_NAMES,
  scenePoints,
  sceneSummary,
} from "./scene";
import { supportsWebgl2 } from "./webgl";

// The explorer (spec R5-36 to R5-40, 8.1 to 8.4): the controls, the 3D panel and the flat view of one
// design. This file holds the state; `Explorer3D` holds every three and R3F import and arrives in a
// chunk of its own, after the page, only where WebGL2 works. The flat view is always shown.

/** The 3D code's chunk did not load: told apart from an error while the renderer starts (R5-39). */
class ChunkFailed extends Error {}

/** The panel's box while the 3D code loads, or before the browser was asked for WebGL2. */
function Loading() {
  return (
    <p className="absolute inset-0 m-0 grid place-items-center p-4 text-center text-fg-muted text-sm">
      {EXPLORE_LINES.loading}
    </p>
  );
}

const Explorer3D = dynamic(
  () =>
    import("./Explorer3D").then(
      (module) => module.Explorer3D,
      (cause: unknown) => {
        throw new ChunkFailed("Explorer3D: the chunk did not load", { cause });
      },
    ),
  { ssr: false, loading: Loading },
);

/** Why the panel shows no 3D view. Only the first two are `data-explorer-reason`'s values (8.3). */
type Fallback = "no-webgl2" | "context-lost" | "load-failed";
type Panel =
  | { readonly state: "loading" | "3d" }
  | { readonly state: "flat"; readonly reason: Fallback };

/**
 * Turns an error inside the 3D view into a fallback (R5-39): a chunk that did not load is
 * `load-failed`; any other error, such as a renderer that fails as it starts, is `no-webgl2`.
 */
class ViewBoundary extends Component<
  { onFailure(reason: Fallback): void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    this.props.onFailure(error instanceof ChunkFailed ? "load-failed" : "no-webgl2");
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

const MODE_OPTIONS: readonly Option<Mode>[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
const GAMUT_OPTIONS: readonly Option<SolidGamut>[] = SOLID_GAMUTS.map((gamut) => ({
  value: gamut,
  label: GAMUT_NAMES[gamut],
}));
const START_SLICE = 0.6;

/** A labeled slider whose shown value is also its `aria-valuetext` (8.2). */
function Slider({
  label,
  min,
  max,
  step,
  value,
  text,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  text: string;
  onChange(value: number): void;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
        <span className="font-mono text-foreground text-xs tabular-nums">{text}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={text}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="h-6 w-full cursor-pointer accent-foreground"
      />
    </div>
  );
}

/** The sentence and, after a context loss, the restart button that stand in for the 3D view. */
function FlatNote({ reason, onRestart }: { reason: Fallback; onRestart(): void }) {
  return (
    <div className="absolute inset-0 grid content-center justify-items-center gap-3 p-4 text-center">
      <p className="m-0 max-w-sm text-foreground text-sm">{EXPLORE_LINES[reason]}</p>
      {reason === "context-lost" && (
        <button type="button" onClick={onRestart} className={BUTTON}>
          {EXPLORE_LINES.restart}
        </button>
      )}
    </div>
  );
}

export function ExploreClient({ initial }: { initial: DesignSpec }) {
  const [spec, setSpec] = useState(initial);
  const [gamut, setGamut] = useState<SolidGamut>(initial.color.params.gamut);
  const [mode, setMode] = useState<Mode>("light");
  const [slice, setSlice] = useState(START_SLICE);
  const [camera, setCamera] = useState<Camera>(DEFAULT_CAMERA);
  const [notice, setNotice] = useState("");
  // Null until the browser is asked for WebGL2, which the server cannot answer.
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [panel, setPanel] = useState<Panel>({ state: "loading" });
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  // A new value mounts a new 3D view, with a new canvas and context.
  const [mount, setMount] = useState(0);
  const damping = !useOsReducedMotion();

  // The link in the hash opens on load, and a later `hashchange` loads another design (R5-40, 8.4).
  // A design opens on its own gamut's solid.
  useEffect(() => {
    const read = (fallback: string) => {
      const result = readHash(location.hash);
      if (result.kind === "spec") {
        setSpec(result.spec);
        setGamut(result.spec.color.params.gamut);
        setNotice("");
      } else if (result.kind === "error") {
        const { message } = bannerFor({
          kind: "link",
          reason: result.reason,
          ...(result.issues === undefined ? {} : { issues: result.issues }),
          fallback: "current",
        });
        setNotice(`${message} ${fallback}`);
      }
    };
    read(EXPLORE_LINES["bad-link"]);
    const onHashChange = () => read(EXPLORE_LINES["bad-link-kept"]);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Asked once, before the 3D view mounts (R5-39).
  useEffect(() => {
    const able = supportsWebgl2();
    setWebgl(able);
    if (!able) setPanel({ state: "flat", reason: "no-webgl2" });
  }, []);

  const points = useMemo(() => scenePoints(spec, mode), [spec, mode]);
  const fallBack = useCallback((reason: Fallback) => {
    setDrawn(null);
    setPanel({ state: "flat", reason });
  }, []);
  const onReady = useCallback(() => setPanel({ state: "3d" }), []);
  const onLost = useCallback(() => fallBack("context-lost"), [fallBack]);
  const restart = () => {
    setMount((count) => count + 1);
    setPanel({ state: "loading" });
  };

  const show3d = webgl === true && panel.state !== "flat";
  const reason =
    panel.state === "flat" && panel.reason !== "load-failed" ? panel.reason : undefined;

  return (
    <div data-explore="" className="space-y-6">
      <p role="status" data-explore-notice="" className="min-h-5 text-sm [overflow-wrap:anywhere]">
        {notice}
      </p>

      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <Choice
          legend="Gamut solid"
          value={gamut}
          options={GAMUT_OPTIONS}
          onChange={(next) => setGamut(next)}
        />
        <Choice
          legend="Mode"
          value={mode}
          options={MODE_OPTIONS}
          onChange={(next) => setMode(next)}
        />
        <Slider
          label="Lightness slice"
          min={0}
          max={1}
          step={0.01}
          value={slice}
          text={`L ${slice.toFixed(2)}`}
          onChange={(value) => setSlice(Math.round(value * 100) / 100)}
        />
        <Slider
          label="Turn"
          min={-180}
          max={180}
          step={1}
          value={camera.turn}
          text={`${camera.turn}°`}
          onChange={(turn) => setCamera((now) => ({ ...now, turn: Math.round(turn) }))}
        />
        <Slider
          label="Tilt"
          min={0}
          max={90}
          step={1}
          value={camera.tilt}
          text={`${camera.tilt}°`}
          onChange={(tilt) => setCamera((now) => ({ ...now, tilt: Math.round(tilt) }))}
        />
        <Slider
          label="Zoom"
          min={0.5}
          max={2}
          step={0.05}
          value={camera.zoom}
          text={`${camera.zoom.toFixed(2)}×`}
          onChange={(zoom) => setCamera((now) => ({ ...now, zoom: Math.round(zoom * 20) / 20 }))}
        />
        <div className="flex items-end">
          <button type="button" onClick={() => setCamera(DEFAULT_CAMERA)} className={BUTTON}>
            Reset view
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 space-y-2">
          <div
            data-explorer=""
            data-explorer-state={panel.state}
            data-explorer-reason={reason}
            data-gamut={gamut}
            data-mode={mode}
            data-slice={slice.toFixed(2)}
            data-turn={camera.turn}
            data-tilt={camera.tilt}
            data-zoom={camera.zoom.toFixed(2)}
            data-damping={String(damping)}
            data-points={drawn?.points}
            data-tubes={drawn?.tubes}
            data-solid-vertices={drawn?.solidVertices}
            className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-panel"
          >
            {panel.state === "flat" ? (
              <FlatNote reason={panel.reason} onRestart={restart} />
            ) : show3d ? (
              <ViewBoundary key={mount} onFailure={fallBack}>
                <Explorer3D
                  points={points}
                  gamut={gamut}
                  slice={slice}
                  camera={camera}
                  damping={damping}
                  onCamera={setCamera}
                  onDrawn={setDrawn}
                  onReady={onReady}
                  onLost={onLost}
                />
              </ViewBoundary>
            ) : (
              <Loading />
            )}
          </div>
          <p
            data-explorer-summary=""
            className="m-0 text-fg-muted text-xs [overflow-wrap:anywhere]"
          >
            {sceneSummary(spec.meta.name, mode, gamut, slice)}
          </p>
        </div>
        <FlatView spec={spec} mode={mode} l={slice} />
      </div>

      <a
        href={pageHref("studio", spec)}
        className="inline-flex min-h-6 w-fit items-center text-foreground text-sm underline underline-offset-4 hover:text-fg-muted"
      >
        Open in the studio
      </a>
    </div>
  );
}
