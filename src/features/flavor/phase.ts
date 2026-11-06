import { assertRecord, assertString, describeType, isOneOf } from "@/features/studio/guards";
import { doneLine, nextAnnounced, progressLine, VIDEO_LINES, type VideoJob } from "./video";

// The phase of a video section of the Flavor dialog (docs/specs/05-motion-3d.md, sections 11.2,
// 11.3 and 13.3; R5-53, R5-56): both sections run the same states, and only the render has
// `confirm`, its privacy note. `phaseLine` gives the line the section's status region holds, and
// `progressed` the phase after a job's progress. Pure.

/** What a video section shows: its job's state, with the bar's percent and step while it runs. */
export type VideoPhase =
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
  | { readonly kind: "running"; readonly percent: number; readonly announced: number }
  | { readonly kind: "done"; readonly name: string };

const JOBS: readonly VideoJob[] = Object.freeze(["render", "record"] as const);

const KINDS: readonly VideoPhase["kind"][] = Object.freeze([
  "idle",
  "checking",
  "confirm",
  "unsupported",
  "canceled",
  "failed",
  "load-failed",
  "running",
  "done",
] as const);

/** The two lines that name their job (13.3). */
const JOB_LINES: Readonly<Record<VideoJob, { unsupported: string; failed: string }>> =
  Object.freeze({
    render: {
      unsupported: VIDEO_LINES["render-unsupported"],
      failed: VIDEO_LINES["render-failed"],
    },
    record: {
      unsupported: VIDEO_LINES["record-unsupported"],
      failed: VIDEO_LINES["record-failed"],
    },
  });

/**
 * The line `job`'s section's status region holds in `phase` (13.3): none while idle, at the note
 * or before the first 10% step; the progress line at each step; each outcome's line.
 */
export function phaseLine(job: VideoJob, phase: VideoPhase): string {
  assertString(job, "phaseLine: job");
  assertRecord(phase, "phaseLine: phase");
  assertString(phase.kind, "phaseLine: phase.kind");
  if (!isOneOf(job, JOBS)) {
    throw new RangeError(`phaseLine: job must be "render" or "record", got ${JSON.stringify(job)}`);
  }
  if (!isOneOf(phase.kind, KINDS)) {
    throw new RangeError(`phaseLine: phase.kind is not a phase, got ${JSON.stringify(phase.kind)}`);
  }
  switch (phase.kind) {
    case "idle":
    case "confirm":
      return "";
    case "checking":
      return VIDEO_LINES.checking;
    case "running":
      if (typeof phase.announced !== "number") {
        throw new TypeError(
          `phaseLine: phase.announced must be a number, got ${describeType(phase.announced)}`,
        );
      }
      if (!(Number.isInteger(phase.announced) && phase.announced % 10 === 0)) {
        throw new RangeError(
          `phaseLine: phase.announced must be a step of 10, got ${phase.announced}`,
        );
      }
      return phase.announced === 0 ? "" : progressLine(job, phase.announced);
    case "unsupported":
      return JOB_LINES[job].unsupported;
    case "done":
      assertString(phase.name, "phaseLine: phase.name");
      if (phase.name === "") throw new RangeError("phaseLine: phase.name must not be empty");
      return doneLine(phase.name);
    case "canceled":
      return VIDEO_LINES.canceled;
    case "failed":
      return JOB_LINES[job].failed;
    case "load-failed":
      return VIDEO_LINES["load-failed"];
  }
}

/**
 * The running phase after a job's `progress` (0 to 1), from `phase`: the bar takes the whole
 * percent, and the announced step moves at most once per 10% (`nextAnnounced`). When nothing it
 * shows changes, `phase` itself comes back.
 */
export function progressed(phase: VideoPhase, progress: number): VideoPhase {
  assertRecord(phase, "progressed: phase");
  if (typeof progress !== "number") {
    throw new TypeError(`progressed: progress must be a number, got ${describeType(progress)}`);
  }
  if (!(progress >= 0 && progress <= 1)) {
    throw new RangeError(`progressed: progress must lie in [0, 1], got ${progress}`);
  }
  const percent = Math.floor(progress * 100);
  const last = phase.kind === "running" ? phase.announced : 0;
  const announced = nextAnnounced(last, progress) ?? last;
  if (phase.kind === "running" && phase.percent === percent && phase.announced === announced) {
    return phase;
  }
  return { kind: "running", percent, announced };
}
