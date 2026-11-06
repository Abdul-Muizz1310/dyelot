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
import type { FallbackReason } from "@/flavor/flavor.mjs";
import { Flavor } from "@/flavor/flavor-react";
import { type DesignSpec, specId } from "@/spec";
import { recordLoop } from "./record";
import { useVideoJob, type VideoJobs } from "./useVideoJob";
import {
  type Container,
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
// studio, and Mediabunny with `import()` on "Record the shader loop" only (R5-61).

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
  /** Read by the brand video's render (Task 5.9c), which the note comes before. */
  privacy: PrivacyAnswer;
};

export function FlavorDialog({ store, onClose }: FlavorDialogProps) {
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
        <BrandVideo spec={spec} mode={mode} reduced={canvasReduced || osReduced} />
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

/**
 * Brand video (13.3, 11.1): the Player of the design's brand video in the canvas's mode, and its
 * "Pause". `@/export` loads when the dialog opens, for `brandProps`; a failed load says so in the
 * section's region.
 */
function BrandVideo({ spec, mode, reduced }: { spec: DesignSpec; mode: Mode; reduced: boolean }) {
  const [brand, setBrand] = useState<ExportModule | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
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
    };
  }, []);
  const props = useMemo(
    () => (brand === null ? null : brand.brandProps(spec, mode)),
    [brand, spec, mode],
  );
  return (
    <Section title="Brand video">
      {props !== null && (
        <PreviewBoundary>
          <BrandPlayer props={props} mode={mode} reduced={reduced} />
        </PreviewBoundary>
      )}
      {props === null && !failed && <p className="text-fg-muted text-sm">{LOADING_LINE}</p>}
      <div role="status" className={`min-h-5 text-sm ${WRAP}`}>
        {failed ? VIDEO_LINES["load-failed"] : ""}
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
  | { readonly kind: "recording"; readonly percent: number; readonly announced: number }
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
  const percent = Math.floor(progress * 100);
  const last = phase.kind === "recording" ? phase.announced : 0;
  const announced = nextAnnounced(last, progress) ?? last;
  if (phase.kind === "recording" && phase.percent === percent && phase.announced === announced) {
    return phase;
  }
  return { kind: "recording", percent, announced };
}

/**
 * Shader loop (11.3, 13.3): "Record the shader loop" records one 10-second loop of the design's
 * flavor in the canvas's mode on a detached 1280 by 720 canvas, then downloads it. A click loads
 * Mediabunny; while it records, "Recording…", the bar and "Cancel" stand in the button's place, and
 * the button comes back with the outcome's line. Where no codec encodes, the sentence stands in its
 * place. Reduced motion does not block it (R5-57). While the dialog's job is a render, the button is
 * `aria-disabled` and says to wait.
 */
function ShaderLoop({ spec, mode, jobs }: { spec: DesignSpec; mode: Mode; jobs: VideoJobs }) {
  const [phase, setPhase] = useState<LoopPhase>({ kind: "idle" });
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
