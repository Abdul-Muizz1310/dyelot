import {
  assertRecord,
  assertString,
  describeType,
  isOneOf,
  isRecord,
} from "@/features/studio/guards";

// The video helpers of the Flavor dialog (docs/specs/05-motion-3d.md, section 5.8; R5-53, R5-56)
// and the hosts' sentences of sections 6.4 and 13.3, word for word. The hero shows FLAVOR_LINES
// before the dialog exists, so they live here (plan departure D6). Pure.

/** The two video jobs: the brand video's render and the shader loop's recording. */
export type VideoJob = "render" | "record";

/** The two files a video job makes. */
export type Container = "mp4" | "webm";

const JOBS: readonly VideoJob[] = Object.freeze(["render", "record"] as const);

/** The word a progress line opens with, by job. */
const JOB_WORDS: Readonly<Record<VideoJob, string>> = Object.freeze({
  render: "Rendering",
  record: "Recording",
});

/** A progress announcement's step, in percent. */
const STEP = 10;

/** A number of any value, or a TypeError naming `name`. */
function assertNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== "number") {
    throw new TypeError(`${name} must be a number, got ${describeType(value)}`);
  }
}

/** Whether `scope` (the window, in the browser) has WebCodecs: `VideoEncoder` is a function. */
export function canMakeVideo(scope: { readonly VideoEncoder?: unknown }): boolean {
  assertRecord(scope, "canMakeVideo: scope");
  return typeof scope.VideoEncoder === "function";
}

/**
 * The 10% step `progress` (0 to 1) has reached when it is past `last`, the step announced last
 * (0 before any), or null: a live region speaks at most once per 10%.
 */
export function nextAnnounced(last: number, progress: number): number | null {
  assertNumber(last, "nextAnnounced: last");
  assertNumber(progress, "nextAnnounced: progress");
  if (!(Number.isInteger(last) && last >= 0 && last <= 100 && last % STEP === 0)) {
    throw new RangeError(`nextAnnounced: last must be a step of 10 from 0 to 100, got ${last}`);
  }
  if (!(progress >= 0 && progress <= 1)) {
    throw new RangeError(`nextAnnounced: progress must lie in [0, 1], got ${progress}`);
  }
  const reached = Math.floor(progress * STEP) * STEP;
  return reached > last ? reached : null;
}

/** "Rendering: 30%." or "Recording: 30%.": a job's progress, in whole percent. */
export function progressLine(job: VideoJob, percent: number): string {
  assertString(job, "progressLine: job");
  assertNumber(percent, "progressLine: percent");
  if (!isOneOf(job, JOBS)) {
    throw new RangeError(
      `progressLine: job must be "render" or "record", got ${JSON.stringify(job)}`,
    );
  }
  if (!(Number.isInteger(percent) && percent >= 0 && percent <= 100)) {
    throw new RangeError(
      `progressLine: percent must be a whole number from 0 to 100, got ${percent}`,
    );
  }
  return `${JOB_WORDS[job]}: ${percent}%.`;
}

/**
 * The types of what both video shells are given (section 5.8), each wrong one a TypeError naming
 * `caller`: `load` and `onProgress` are functions and `signal` an AbortSignal. For the shells.
 */
export function assertJobDeps(
  deps: unknown,
  caller: string,
): asserts deps is { load: unknown; signal: AbortSignal; onProgress: unknown } {
  assertRecord(deps, `${caller}: deps`);
  for (const key of ["load", "onProgress"]) {
    if (typeof deps[key] !== "function") {
      throw new TypeError(
        `${caller}: deps.${key} must be a function, got ${describeType(deps[key])}`,
      );
    }
  }
  if (!(deps.signal instanceof AbortSignal)) {
    throw new TypeError(
      `${caller}: deps.signal must be an AbortSignal, got ${describeType(deps.signal)}`,
    );
  }
}

/**
 * How a video job that threw ended (section 5.8): canceled once its signal has aborted, whatever
 * the error (4.0.539's render then rejects with a plain Error, "renderMediaOnWeb() was
 * cancelled"), or for an AbortError; failed for any other throw. The error itself is never kept.
 */
export function endedBy(error: unknown, signal: AbortSignal): "canceled" | "failed" {
  return signal.aborted || (isRecord(error) && error.name === "AbortError") ? "canceled" : "failed";
}

/** "Downloaded <file name>.": the line a finished job leaves. */
export function doneLine(fileName: string): string {
  assertString(fileName, "doneLine: fileName");
  if (fileName === "") throw new RangeError("doneLine: fileName must not be empty");
  return `Downloaded ${fileName}.`;
}

/** The Flavor dialog's video lines (section 13.3). */
export const VIDEO_LINES = Object.freeze({
  "no-webcodecs": "This browser cannot make videos. Try a recent Chrome, Edge or Firefox.",
  checking: "Checking this browser…",
  "render-unsupported": "This browser cannot render the brand video.",
  rendering: "Rendering…",
  "render-failed": "The brand video could not be rendered in this browser.",
  canceled: "Canceled. Nothing was downloaded.",
  "load-failed": "This tool could not load. Reload the page to try again.",
  wait: "Wait for the current video to finish.",
  record: "Record the shader loop",
  "record-description":
    "Records one 10-second loop at 1280 × 720 in this browser. Nothing is sent anywhere.",
  "record-unsupported": "This browser cannot record the shader loop.",
  recording: "Recording…",
  "record-failed": "The shader loop could not be recorded in this browser.",
  cancel: "Cancel",
});

/** The sentences and labels of a host of the animated background (section 6.4). */
export const FLAVOR_LINES: Readonly<
  Record<"no-webgl2" | "context-lost" | "restart" | "still" | "still-canvas" | "pause", string>
> = Object.freeze({
  "no-webgl2":
    "This browser cannot draw the animated background, so a still gradient shows instead.",
  "context-lost": "The animated background stopped, so a still gradient shows instead.",
  restart: "Restart the animation",
  still: "The background is still because this device asks for reduced motion.",
  // The Flavor dialog's preview held still by the canvas's switch alone (6.4's amendment).
  "still-canvas": "The background is still because the canvas's Reduce motion switch is on.",
  pause: "Pause",
});
