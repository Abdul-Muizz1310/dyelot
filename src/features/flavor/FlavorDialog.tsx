"use client";

import dynamic from "next/dynamic";
import {
  Component,
  type ReactNode,
  type Ref,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { flavorSeed, flavorStops, type Mode } from "@/engine";
import { trapTab } from "@/features/a11y/trapTab";
import { downloadBlob } from "@/features/export/download";
import { loadExport } from "@/features/export/useBundle";
import { useOsReducedMotion } from "@/features/preview/kit/reduced";
import { BUTTON, TOGGLE_BUTTON } from "@/features/studio/chrome";
import { type StudioStore, useStudio } from "@/features/studio/store";
import { type FallbackReason, supportsFlavor } from "@/flavor/flavor.mjs";
import { Flavor } from "@/flavor/flavor-react";
import { loadOnce } from "@/lib/load-once";
import { type DesignSpec, specId } from "@/spec";
import { PrivacyNote } from "./PrivacyNote";
import { recordLoop } from "./record";
import { pickRenderTarget, renderBrandVideo } from "./render";
import { useVideoJob, type VideoJobs } from "./useVideoJob";
import {
  type Container,
  canMakeVideo,
  doneLine,
  FLAVOR_LINES,
  nextAnnounced,
  progressLine,
  VIDEO_LINES,
} from "./video";

// The Flavor dialog (docs/specs/05-motion-3d.md, R5-51, R5-52, sections 13.1 to 13.3): a modal
// dialog on the export dialog's rules (R3-34): the studio makes the rest of the page inert, focus
// moves to the heading, Escape and "Close" shut it, and the studio gives focus back to "Flavor".
// Its three sections follow the canvas's mode. Its state ends when it closes: the studio unmounts it,
// which aborts its one video job. The studio loads it through `load.ts` only; it loads `@/export` on
// open and the Player's code (`BrandPlayer`) through `next/dynamic`, so neither arrives with the
// studio; the web renderer with `import()` on "Render the brand video" only, and Mediabunny with
// `import()` on "Record the shader loop" (R5-61).

/** What the dialog says while the Player's code or `@/export` loads, and when the Player fails. */
const LOADING_LINE = "Loading the preview…";
const PREVIEW_FAILED_LINE = "The preview could not play here.";

/** Text that wraps anywhere: a long name never makes the dialog scroll sideways. */
const WRAP = "[overflow-wrap:anywhere]";

const BrandPlayer = dynamic(() => import("./BrandPlayer").then((module) => module.BrandPlayer), {
  ssr: false,
  loading: () => <p className="text-fg-muted text-sm">{LOADING_LINE}</p>,
});

/** The page load's answer to the privacy note (R5-54), which the studio holds, not the dialog. */
export type PrivacyAnswer = { readonly accepted: boolean; accept(): void };

export type FlavorDialogProps = {
  store: StudioStore;
  onClose(): void;
  /** Whether the page load's first render has passed the privacy note (R5-54). */
  privacy: PrivacyAnswer;
};

export function FlavorDialog({ store, onClose, privacy }: FlavorDialogProps) {
  const spec = useStudio(store, (studio) => studio.spec);
  const mode = useStudio(store, (studio) => studio.view.mode);
  const canvasReduced = useStudio(store, (studio) => studio.view.reducedMotion);
  const osReduced = useOsReducedMotion();
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // The dialog's one video job, a render or a recording (R5-53): closing the dialog aborts it.
  const jobs = useVideoJob();

  // Focus goes to the heading when the dialog opens (R3-34).
  useEffect(() => heading.current?.focus(), []);

  const close = useEffectEvent(onClose);
  // Escape and the Tab trap listen on the window, as the export dialog's do, so they hold when a
  // click on the dialog's text has moved focus to the dialog itself.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (panel.current !== null) {
        trapTab(event, panel.current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the scrim only keeps a click from moving focus out of the dialog.
    <div
      data-flavor-overlay=""
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
      className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-3 sm:p-6"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className="flex max-h-full w-full max-w-3xl flex-col gap-5 overflow-y-auto [&>*]:shrink-0 rounded-md border border-border-bright bg-panel p-4 shadow-[var(--window-shadow)] sm:p-6"
      >
        <h2
          id={headingId}
          ref={heading}
          tabIndex={-1}
          className="font-mono text-fg-muted text-xs uppercase tracking-[0.14em]"
        >
          Flavor
        </h2>
        <p className={`text-sm ${WRAP}`}>
          This design's moving parts: an animated background, a brand video and a loop of the
          background, all made in this browser.
        </p>
        <Background spec={spec} mode={mode} canvasReduced={canvasReduced} osReduced={osReduced} />
        <BrandVideo
          spec={spec}
          mode={mode}
          reduced={canvasReduced || osReduced}
          jobs={jobs}
          privacy={privacy}
        />
        <ShaderLoop spec={spec} mode={mode} jobs={jobs} />
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={BUTTON}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One of the dialog's three sections: a `section` named by its `h3`. With `headingRef`, the heading
 * can take focus from a control of the section that goes away.
 */
function Section({
  title,
  headingRef,
  children,
}: {
  title: string;
  headingRef?: Ref<HTMLHeadingElement>;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3
        id={id}
        ref={headingRef}
        tabIndex={headingRef === undefined ? undefined : -1}
        className="font-medium text-foreground text-sm"
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Background (13.2): the animated background of the design in the canvas's mode, in a 16:9 box. It
 * stays still under the canvas's "Reduce motion" (the runtime adds the visitor's setting); its
 * "Pause" shows only while it loops; its region says why it is still or why it fell back, and after
 * a lost context "Restart the animation" mounts a new canvas.
 */
function Background({
  spec,
  mode,
  canvasReduced,
  osReduced,
}: {
  spec: DesignSpec;
  mode: Mode;
  canvasReduced: boolean;
  osReduced: boolean;
}) {
  const stops = useMemo(() => flavorStops(spec, mode), [spec, mode]);
  const seed = useMemo(() => flavorSeed(specId(spec)), [spec]);
  const fade = useMemo(
    () => ({ durationMs: spec.motion.durations.base, easing: spec.motion.easings.standard }),
    [spec.motion],
  );
  const [paused, setPaused] = useState(false);
  const [fallback, setFallback] = useState<FallbackReason | null>(null);
  const [mounts, setMounts] = useState(0);
  const pause = useRef<HTMLButtonElement>(null);
  const restarted = useRef(false);

  // "Restart the animation" goes away as the new canvas runs: focus moves to the new "Pause".
  // biome-ignore lint/correctness/useExhaustiveDependencies: `mounts` is the trigger.
  useEffect(() => {
    if (!restarted.current) return;
    restarted.current = false;
    pause.current?.focus();
  }, [mounts]);

  const still = canvasReduced || osReduced;
  const loops = fallback === null && !still;
  const line = backgroundLine(fallback, canvasReduced, osReduced);
  return (
    <Section title="Background">
      <div
        data-flavor-preview=""
        className="aspect-video w-full overflow-hidden rounded-md border border-border"
      >
        <Flavor
          key={mounts}
          stops={stops}
          seed={seed}
          fade={fade}
          paused={paused}
          reducedMotion={canvasReduced}
          onFallback={setFallback}
          className="block size-full"
        />
      </div>
      {loops && (
        <button
          ref={pause}
          type="button"
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
          className={`${TOGGLE_BUTTON} self-start`}
        >
          {FLAVOR_LINES.pause}
        </button>
      )}
      <div role="status" className={`min-h-5 text-sm ${WRAP}`}>
        {line}
      </div>
      {fallback === "context-lost" && (
        <button
          type="button"
          onClick={() => {
            restarted.current = true;
            setFallback(null);
            setMounts((count) => count + 1);
          }}
          className={`${BUTTON} self-start`}
        >
          {FLAVOR_LINES.restart}
        </button>
      )}
      <p className={`text-fg-muted text-sm ${WRAP}`}>
        To take this background as code, turn on Include flavor files in Export.
      </p>
    </Section>
  );
}

/**
 * The Background region's sentence (6.4, 13.2 and their amendments): a fallback's reason first;
 * for a still preview, the device's sentence whenever the OS setting asks, else the canvas switch's;
 * nothing while it loops.
 */
function backgroundLine(
  fallback: FallbackReason | null,
  canvasReduced: boolean,
  osReduced: boolean,
): string {
  if (fallback !== null) return FLAVOR_LINES[fallback];
  if (osReduced) return FLAVOR_LINES.still;
  if (canvasReduced) return FLAVOR_LINES["still-canvas"];
  return "";
}

type ExportModule = Awaited<ReturnType<typeof loadExport>>;

/** The web renderer, loaded on the first press of "Render the brand video" and kept (R5-53). */
const loadRenderer = loadOnce(() => import("@remotion/web-renderer"));

/** The render button's label and description (13.3). */
const RENDER_LABEL = "Render the brand video";
const RENDER_DESCRIPTION = "Makes a 6-second video at 1280 × 720 in this browser.";

/** A running job's progress as shown: the bar's whole percent and the last 10% step announced. */
type Shown = { readonly percent: number; readonly announced: number };

/**
 * `shown` after a job's `progress` (0 to 1), or the first progress when `shown` is null: the live
 * line moves at most once per 10%. The same object comes back when nothing it shows changes.
 */
function advanced(shown: Shown | null, progress: number): Shown {
  const percent = Math.floor(progress * 100);
  const last = shown?.announced ?? 0;
  const announced = nextAnnounced(last, progress) ?? last;
  if (shown !== null && shown.percent === percent && shown.announced === announced) return shown;
  return { percent, announced };
}

/**
 * What the Brand video section's render shows (11.2): `checking` while the renderer loads and
 * `pickRenderTarget` runs, `confirm` while the privacy note waits, `rendering` from the render's
 * start with its progress, and each outcome's line under the button.
 */
type RenderPhase =
  | {
      readonly kind:
        | "idle"
        | "checking"
        | "confirm"
        | "unsupported"
        | "canceled"
        | "failed"
        | "load-failed";
    }
  | ({ readonly kind: "rendering" } & Shown)
  | { readonly kind: "done"; readonly name: string };

/** The line the Brand video section's status region holds in `phase` (13.3). */
function renderLine(phase: RenderPhase): string {
  switch (phase.kind) {
    case "idle":
    case "confirm":
      return "";
    case "checking":
      return VIDEO_LINES.checking;
    case "rendering":
      return phase.announced === 0 ? "" : progressLine("render", phase.announced);
    case "unsupported":
      return VIDEO_LINES["render-unsupported"];
    case "done":
      return doneLine(phase.name);
    case "canceled":
      return VIDEO_LINES.canceled;
    case "failed":
      return VIDEO_LINES["render-failed"];
    case "load-failed":
      return VIDEO_LINES["load-failed"];
  }
}

/**
 * Brand video (13.3, 11.1, 11.2, 13.4): the Player of the design's brand video in the canvas's
 * mode, its "Pause", and "Render the brand video", which renders the same video in this browser and
 * downloads it. `@/export` loads when the dialog opens, for `brandProps`; a failed load says so in
 * the section's region. Without WebCodecs a sentence stands in the button's place. A press runs the
 * dialog's one video job from its check to its outcome: the renderer loads and the target is
 * picked; the page load's first render waits on the privacy note; then the render runs with its
 * bar, its live line and "Cancel", and its file downloads. While the dialog's job is a recording,
 * the button is `aria-disabled` and says to wait.
 */
function BrandVideo({
  spec,
  mode,
  reduced,
  jobs,
  privacy,
}: {
  spec: DesignSpec;
  mode: Mode;
  reduced: boolean;
  jobs: VideoJobs;
  privacy: PrivacyAnswer;
}) {
  const [brand, setBrand] = useState<ExportModule | null>(null);
  const [failed, setFailed] = useState(false);
  // The dialog is only ever mounted in the browser, after the studio loaded it.
  const [webCodecs] = useState(() => canMakeVideo(window));
  const [phase, setPhase] = useState<RenderPhase>({ kind: "idle" });
  const descriptionId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const renderButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);
  /** The note's answer, while it waits: true for "Render", false for "Cancel". */
  const answer = useRef<((render: boolean) => void) | null>(null);
  /** The control that takes focus once the next phase shows, when a focused one goes away. */
  const focusNext = useRef<"render" | "cancel" | "heading" | null>(null);

  useEffect(() => {
    mounted.current = true;
    let live = true;
    loadExport().then(
      (module) => {
        if (live) setBrand(module);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
      mounted.current = false;
    };
  }, []);
  const props = useMemo(
    () => (brand === null ? null : brand.brandProps(spec, mode)),
    [brand, spec, mode],
  );

  // The control takes focus once it shows: an effect of an earlier phase, run after the request,
  // finds it missing and leaves the request in place.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `phase` is the trigger.
  useEffect(() => {
    const next = focusNext.current;
    if (next === null) return;
    const target = { render: renderButton, cancel: cancelButton, heading }[next].current;
    if (target === null) return;
    focusNext.current = null;
    target.focus();
  }, [phase]);

  /** Whether `element` exists and holds focus. */
  const focused = (element: HTMLElement | null): boolean =>
    element !== null && document.activeElement === element;

  /** Shows an outcome; focus on "Cancel", or on a button the outcome removes, moves on. */
  function finish(next: RenderPhase): void {
    focusNext.current = focused(cancelButton.current)
      ? "render"
      : next.kind === "unsupported" && focused(renderButton.current)
        ? "heading"
        : null;
    setPhase(next);
  }

  /** Waits on the privacy note: true once "Render" is pressed; false on "Cancel" or an abort. */
  function ask(signal: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      const settle = (render: boolean) => {
        answer.current = null;
        signal.removeEventListener("abort", abort);
        resolve(render);
      };
      const abort = () => settle(false);
      signal.addEventListener("abort", abort, { once: true });
      answer.current = settle;
      setPhase({ kind: "confirm" });
    });
  }

  async function render(): Promise<void> {
    if (jobs.running !== null) return;
    // The note's "Cancel": the job ends as canceled, yet the section shows no line (13.4).
    let declined = false;
    const outcome = await jobs.start("render", async (signal) => {
      setPhase({ kind: "checking" });
      let renderer: Awaited<ReturnType<typeof loadRenderer>>;
      let exported: ExportModule;
      try {
        [renderer, exported] = await Promise.all([loadRenderer(), loadExport()]);
      } catch {
        return { kind: "load-failed" };
      }
      const target = await pickRenderTarget(renderer);
      if (signal.aborted) return { kind: "canceled" };
      if (target === null) return { kind: "unsupported" };
      // "Render" in the note moves focus to the render's "Cancel" (13.4), as a focused render
      // button does when no note comes.
      let noted = false;
      if (!privacy.accepted) {
        if (!(await ask(signal))) {
          declined = !signal.aborted;
          return { kind: "canceled" };
        }
        privacy.accept();
        noted = true;
      }
      if (noted || focused(renderButton.current)) focusNext.current = "cancel";
      setPhase({ kind: "rendering", percent: 0, announced: 0 });
      return renderBrandVideo(exported.brandProps(spec, mode), target, {
        load: () => Promise.resolve(renderer),
        signal,
        onProgress: (progress) =>
          setPhase((current) => {
            const shown = advanced(current.kind === "rendering" ? current : null, progress);
            return shown === current ? current : { kind: "rendering", ...shown };
          }),
      });
    });
    // Null: another job held the dialog, and this press started nothing.
    if (outcome === null) return;
    if (declined) {
      focusNext.current = "render";
      setPhase({ kind: "idle" });
      return;
    }
    if (outcome.kind !== "done") {
      finish({ kind: outcome.kind });
      return;
    }
    let name: string;
    try {
      name = (await loadExport()).mediaName(spec, "brand", outcome.container);
    } catch {
      finish({ kind: "load-failed" });
      return;
    }
    // A dialog closed meanwhile downloads nothing.
    if (!mounted.current) return;
    downloadBlob(name, outcome.bytes, VIDEO_TYPES[outcome.container]);
    finish({ kind: "done", name });
  }

  const waiting = jobs.running === "record";
  const line =
    phase.kind !== "idle"
      ? renderLine(phase)
      : failed
        ? VIDEO_LINES["load-failed"]
        : webCodecs
          ? ""
          : VIDEO_LINES["no-webcodecs"];
  return (
    <Section title="Brand video" headingRef={heading}>
      {props !== null && (
        <PreviewBoundary>
          <BrandPlayer props={props} mode={mode} reduced={reduced} />
        </PreviewBoundary>
      )}
      {props === null && !failed && <p className="text-fg-muted text-sm">{LOADING_LINE}</p>}
      {phase.kind === "confirm" ? (
        <PrivacyNote
          onRender={() => answer.current?.(true)}
          onCancel={() => answer.current?.(false)}
        />
      ) : phase.kind === "rendering" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">{VIDEO_LINES.rendering}</p>
          <progress
            max={100}
            value={phase.percent}
            aria-label="Brand video progress"
            className="h-2 w-40 accent-foreground"
          />
          <button ref={cancelButton} type="button" onClick={jobs.abort} className={BUTTON}>
            {VIDEO_LINES.cancel}
          </button>
        </div>
      ) : (
        webCodecs &&
        phase.kind !== "unsupported" && (
          <div className="flex flex-col items-start gap-1">
            <button
              ref={renderButton}
              type="button"
              aria-busy={phase.kind === "checking" ? "true" : undefined}
              aria-disabled={waiting ? "true" : undefined}
              aria-describedby={descriptionId}
              onClick={() => void render()}
              className={BUTTON}
            >
              {RENDER_LABEL}
            </button>
            <p id={descriptionId} className={`text-fg-muted text-sm ${WRAP}`}>
              {waiting ? VIDEO_LINES.wait : RENDER_DESCRIPTION}
            </p>
          </div>
        )
      )}
      <div role="status" className={`min-h-5 text-sm ${WRAP}`}>
        {line}
      </div>
    </Section>
  );
}

/** Shows the Player's failure line in its place when its code fails to load or it throws (R5-52). */
class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render(): ReactNode {
    if (this.state.failed) return <p className="text-sm">{PREVIEW_FAILED_LINE}</p>;
    return this.props.children;
  }
}

/** The MIME type of each container's `Blob`. */
const VIDEO_TYPES: Readonly<Record<Container, string>> = Object.freeze({
  mp4: "video/mp4",
  webm: "video/webm",
});

/**
 * What the Shader loop section shows (11.3): `checking` while Mediabunny loads and `pickCodec` runs,
 * `recording` from the first frame with the bar's whole percent and the last 10% step announced,
 * and each outcome's line under the button.
 */
type LoopPhase =
  | { readonly kind: "idle" | "checking" | "unsupported" | "canceled" | "failed" | "load-failed" }
  | ({ readonly kind: "recording" } & Shown)
  | { readonly kind: "done"; readonly name: string };

/** The line the section's status region holds in `phase` (13.3). */
function loopLine(phase: LoopPhase): string {
  switch (phase.kind) {
    case "idle":
      return "";
    case "checking":
      return VIDEO_LINES.checking;
    case "recording":
      return phase.announced === 0 ? "" : progressLine("record", phase.announced);
    case "unsupported":
      return VIDEO_LINES["record-unsupported"];
    case "done":
      return doneLine(phase.name);
    case "canceled":
      return VIDEO_LINES.canceled;
    case "failed":
      return VIDEO_LINES["record-failed"];
    case "load-failed":
      return VIDEO_LINES["load-failed"];
  }
}

/** `phase` after a recording's `progress` (0 to 1): the live line moves at most once per 10%. */
function advance(phase: LoopPhase, progress: number): LoopPhase {
  const shown = advanced(phase.kind === "recording" ? phase : null, progress);
  return shown === phase ? phase : { kind: "recording", ...shown };
}

/**
 * Shader loop (11.3, 13.3): "Record the shader loop" records one 10-second loop of the design's
 * flavor in the canvas's mode on a detached 1280 by 720 canvas, then downloads it. A click loads
 * Mediabunny; while it records, "Recording…", the bar and "Cancel" stand in the button's place, and
 * the button comes back with the outcome's line. Without WebCodecs or WebGL2 (`supportsFlavor()`),
 * or where no codec encodes, the sentence stands in its place (R5-56). Reduced motion does not block
 * it (R5-57). While the dialog's job is a render, the button is `aria-disabled` and says to wait.
 */
function ShaderLoop({ spec, mode, jobs }: { spec: DesignSpec; mode: Mode; jobs: VideoJobs }) {
  // The dialog is only ever mounted in the browser, after the studio loaded it.
  const [phase, setPhase] = useState<LoopPhase>(() =>
    canMakeVideo(window) && supportsFlavor() ? { kind: "idle" } : { kind: "unsupported" },
  );
  const descriptionId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const recordButton = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);
  /** The control that takes focus once the next phase shows, when a focused one goes away. */
  const focusNext = useRef<"record" | "cancel" | "heading" | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The control takes focus once it shows: an effect of an earlier phase, run after the request,
  // finds it missing and leaves the request in place.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `phase` is the trigger.
  useEffect(() => {
    const next = focusNext.current;
    if (next === null) return;
    const target = { record: recordButton, cancel: cancelButton, heading }[next].current;
    if (target === null) return;
    focusNext.current = null;
    target.focus();
  }, [phase]);

  /** Whether `element` exists and holds focus. */
  const focused = (element: HTMLElement | null): boolean =>
    element !== null && document.activeElement === element;

  /** Shows an outcome; focus on "Cancel", or on a button the outcome removes, moves on. */
  function finish(next: LoopPhase): void {
    focusNext.current = focused(cancelButton.current)
      ? "record"
      : next.kind === "unsupported" && focused(recordButton.current)
        ? "heading"
        : null;
    setPhase(next);
  }

  async function record(): Promise<void> {
    if (jobs.running !== null) return;
    const flavor = { stops: flavorStops(spec, mode), seed: flavorSeed(specId(spec)) };
    const outcome = await jobs.start("record", (signal) => {
      setPhase({ kind: "checking" });
      return recordLoop(flavor, {
        load: () => import("mediabunny"),
        signal,
        onProgress: (progress) => {
          if (focused(recordButton.current)) focusNext.current = "cancel";
          setPhase((current) => advance(current, progress));
        },
        canvas: () => document.createElement("canvas"),
      });
    });
    // Null: another job held the dialog, and this press started nothing.
    if (outcome === null) return;
    if (outcome.kind !== "done") {
      finish({ kind: outcome.kind });
      return;
    }
    let name: string;
    try {
      name = (await loadExport()).mediaName(spec, "loop", outcome.container);
    } catch {
      finish({ kind: "load-failed" });
      return;
    }
    // A dialog closed meanwhile downloads nothing.
    if (!mounted.current) return;
    downloadBlob(name, outcome.bytes, VIDEO_TYPES[outcome.container]);
    finish({ kind: "done", name });
  }

  const waiting = jobs.running === "render";
  return (
    <Section title="Shader loop" headingRef={heading}>
      {phase.kind === "recording" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">{VIDEO_LINES.recording}</p>
          <progress
            max={100}
            value={phase.percent}
            aria-label="Shader loop progress"
            className="h-2 w-40 accent-foreground"
          />
          <button ref={cancelButton} type="button" onClick={jobs.abort} className={BUTTON}>
            {VIDEO_LINES.cancel}
          </button>
        </div>
      ) : (
        phase.kind !== "unsupported" && (
          <div className="flex flex-col items-start gap-1">
            <button
              ref={recordButton}
              type="button"
              aria-busy={phase.kind === "checking" ? "true" : undefined}
              aria-disabled={waiting ? "true" : undefined}
              aria-describedby={descriptionId}
              onClick={() => void record()}
              className={BUTTON}
            >
              {VIDEO_LINES.record}
            </button>
            <p id={descriptionId} className={`text-fg-muted text-sm ${WRAP}`}>
              {waiting ? VIDEO_LINES.wait : VIDEO_LINES["record-description"]}
            </p>
          </div>
        )
      )}
      <div role="status" className={`min-h-5 text-sm ${WRAP}`}>
        {loopLine(phase)}
      </div>
    </Section>
  );
}
