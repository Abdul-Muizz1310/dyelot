"use client";

import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { downloadBlob } from "@/features/export/download";
import { loadExport } from "@/features/export/useBundle";
import { BUTTON } from "@/features/studio/chrome";
import type { DesignSpec } from "@/spec";
import { progressed, type VideoPhase } from "./phase";
import type { RenderOutcome } from "./render";
import { type Container, VIDEO_LINES, type VideoJob } from "./video";

// What the Flavor dialog's two video sections share (docs/specs/05-motion-3d.md, sections 11.2,
// 11.3 and 13.3; R5-53, R5-56): both run the same states, so one hook holds a section's phase, the
// focus that follows its controls, and the end of a press (the file's name, the download, the
// outcome's line); `JobButton` and `RunningRow` are the controls that take turns in the button's
// place. Each section keeps only its own steps: the render's note, the recording's codec.

/** Text that wraps anywhere: a long name never makes the dialog scroll sideways. */
export const WRAP = "[overflow-wrap:anywhere]";

/** The MIME type of each container's `Blob`. */
const VIDEO_TYPES: Readonly<Record<Container, string>> = Object.freeze({
  mp4: "video/mp4",
  webm: "video/webm",
});

/** The file each job makes, as `mediaName` names it. */
const MEDIA_KINDS: Readonly<Record<VideoJob, "brand" | "loop">> = Object.freeze({
  render: "brand",
  record: "loop",
});

/** A section's control that can take focus once the next phase shows. */
type FocusTarget = "button" | "cancel" | "heading";

export type VideoSection = {
  readonly phase: VideoPhase;
  /** The section's `h3`, which takes focus from a button an outcome removes. */
  readonly heading: RefObject<HTMLHeadingElement | null>;
  /** The job's button, and the "Cancel" that stands in its place while the job runs. */
  readonly button: RefObject<HTMLButtonElement | null>;
  readonly cancel: RefObject<HTMLButtonElement | null>;
  /** Shows `next`. */
  show(next: VideoPhase): void;
  /** Shows the job's `progress` (0 to 1): the bar each percent, the live line once per 10%. */
  progress(progress: number): void;
  /** Moves focus to `target` once the next phase shows it. */
  focusNext(target: FocusTarget): void;
  /** Whether the job's button, or its "Cancel", exists and holds focus. */
  holds(control: "button" | "cancel"): boolean;
  /** Shows an outcome; focus on "Cancel", or on a button the outcome removes, moves on. */
  finish(next: VideoPhase): void;
  /**
   * Ends a press with its job's outcome: nothing for null (another job held the dialog); the
   * outcome's line; or, for a file, its download as `mediaName(spec, …)` and "Downloaded <name>.".
   * A dialog closed meanwhile downloads nothing.
   */
  deliver(outcome: RenderOutcome | null, spec: DesignSpec): Promise<void>;
};

/** One video section's phase, focus and outcomes, for `job`'s section; it starts at `initial()`. */
export function useVideoSection(job: VideoJob, initial: () => VideoPhase): VideoSection {
  const [phase, setPhase] = useState<VideoPhase>(initial);
  const heading = useRef<HTMLHeadingElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);
  /** The control that takes focus once the next phase shows, when a focused one goes away. */
  const request = useRef<FocusTarget | null>(null);

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
    const next = request.current;
    if (next === null) return;
    const target = { button, cancel, heading }[next].current;
    if (target === null) return;
    request.current = null;
    target.focus();
  }, [phase]);

  const holds = (control: "button" | "cancel"): boolean => {
    const element = (control === "button" ? button : cancel).current;
    return element !== null && document.activeElement === element;
  };

  function finish(next: VideoPhase): void {
    request.current = holds("cancel")
      ? "button"
      : next.kind === "unsupported" && holds("button")
        ? "heading"
        : null;
    setPhase(next);
  }

  async function deliver(outcome: RenderOutcome | null, spec: DesignSpec): Promise<void> {
    if (outcome === null) return;
    if (outcome.kind !== "done") {
      finish({ kind: outcome.kind });
      return;
    }
    let name: string;
    try {
      name = (await loadExport()).mediaName(spec, MEDIA_KINDS[job], outcome.container);
    } catch {
      finish({ kind: "load-failed" });
      return;
    }
    if (!mounted.current) return;
    downloadBlob(name, outcome.bytes, VIDEO_TYPES[outcome.container]);
    finish({ kind: "done", name });
  }

  return {
    phase,
    heading,
    button,
    cancel,
    show: setPhase,
    progress: (progress) => setPhase((current) => progressed(current, progress)),
    focusNext: (target) => {
      request.current = target;
    },
    holds,
    finish,
    deliver,
  };
}

/**
 * A section's job button (13.3), described by what it makes; while the other job runs it is
 * `aria-disabled` and described by "Wait for the current video to finish." (R5-53).
 */
export function JobButton({
  section,
  label,
  description,
  waiting,
  onPress,
}: {
  section: VideoSection;
  label: string;
  description: string;
  waiting: boolean;
  onPress(): void;
}) {
  const descriptionId = useId();
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        ref={section.button}
        type="button"
        aria-busy={section.phase.kind === "checking" ? "true" : undefined}
        aria-disabled={waiting ? "true" : undefined}
        aria-describedby={descriptionId}
        onClick={onPress}
        className={BUTTON}
      >
        {label}
      </button>
      <p id={descriptionId} className={`text-fg-muted text-sm ${WRAP}`}>
        {waiting ? VIDEO_LINES.wait : description}
      </p>
    </div>
  );
}

/** What stands in the job button's place while the job runs (11.2, 11.3): its line, bar and "Cancel". */
export function RunningRow({
  section,
  label,
  barLabel,
  onCancel,
}: {
  section: VideoSection;
  label: string;
  barLabel: string;
  onCancel(): void;
}) {
  const percent = section.phase.kind === "running" ? section.phase.percent : 0;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm">{label}</p>
      <progress
        max={100}
        value={percent}
        aria-label={barLabel}
        className="h-2 w-40 accent-foreground"
      />
      <button ref={section.cancel} type="button" onClick={onCancel} className={BUTTON}>
        {VIDEO_LINES.cancel}
      </button>
    </div>
  );
}
