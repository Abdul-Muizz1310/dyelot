"use client";

import dynamic from "next/dynamic";
import {
  Component,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { flavorSeed, flavorStops, type Mode } from "@/engine";
import { trapTab } from "@/features/a11y/trapTab";
import { loadExport } from "@/features/export/useBundle";
import { useOsReducedMotion } from "@/features/preview/kit/reduced";
import { BUTTON, TOGGLE_BUTTON } from "@/features/studio/chrome";
import { type StudioStore, useStudio } from "@/features/studio/store";
import type { FallbackReason } from "@/flavor/flavor.mjs";
import { Flavor } from "@/flavor/flavor-react";
import { type DesignSpec, specId } from "@/spec";
import { FLAVOR_LINES, VIDEO_LINES } from "./video";

// The Flavor dialog (docs/specs/05-motion-3d.md, R5-51, R5-52, sections 13.1 to 13.3): a modal
// dialog on the export dialog's rules (R3-34): the studio makes the rest of the page inert, focus
// moves to the heading, Escape and "Close" shut it, and the studio gives focus back to "Flavor".
// Its three sections follow the canvas's mode. Its state ends when it closes: the studio unmounts it.
// The studio loads it through `load.ts` only; it loads `@/export` on open and the Player's code
// (`BrandPlayer`) through `next/dynamic`, so neither arrives with the studio.

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
        <Section title="Shader loop">
          <div role="status" className={`min-h-5 text-sm ${WRAP}`} />
        </Section>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={BUTTON}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** One of the dialog's three sections: a `section` named by its `h3`. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="font-medium text-foreground text-sm">
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
