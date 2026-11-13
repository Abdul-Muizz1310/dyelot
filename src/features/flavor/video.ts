import {
  assertRecord,
  assertString,
  describeType,
  isOneOf,
  isRecord,
} from "@/features/studio/guards";
import type { BrandProps } from "@/flavor/remotion/brand-intro";

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
  Record<
    | "no-webgl2"
    | "context-lost"
    | "restart"
    | "still"
    | "still-canvas"
    | "pause"
    | "pause-background"
    | "pause-video",
    string
  >
> = Object.freeze({
  "no-webgl2":
    "This browser cannot draw the animated background, so a still gradient shows instead.",
  "context-lost": "The animated background stopped, so a still gradient shows instead.",
  restart: "Restart the animation",
  still: "The background is still because this device asks for reduced motion.",
  // The Flavor dialog's preview held still by the canvas's switch alone (6.4's amendment).
  "still-canvas": "The background is still because the canvas's Reduce motion switch is on.",
  pause: "Pause",
  // The Flavor dialog's two buttons each get a name of their own (R6-36); the hero keeps "Pause".
  "pause-background": "Pause the background",
  "pause-video": "Pause the video",
});

/** The first family of a font stack, unquoted: `"Fraunces", serif` is `Fraunces`. */
function firstFamily(stack: string, name: string): string {
  const family = (stack.split(",")[0] ?? "").trim().replace(/^(["'])(.*)\1$/, "$2");
  if (family === "") throw new RangeError(`${name} must name a font family`);
  return family;
}

/** The count of palettes the brand video draws. */
const PALETTE_COUNT = 5;

/**
 * The brand video's text alternative (section 13.1): what the frame draws, in one sentence, for the
 * wrapper's `aria-describedby`. Checks `props` as `brandProps` makes it, every type before any value.
 */
export function brandDescription(props: BrandProps): string {
  assertRecord(props, "brandDescription: props");
  const { name, oneLiner, lot, fonts, checks, palettes } = props;
  assertString(name, "brandDescription: props.name");
  assertString(oneLiner, "brandDescription: props.oneLiner");
  assertString(lot, "brandDescription: props.lot");
  assertRecord(fonts, "brandDescription: props.fonts");
  assertString(fonts.display, "brandDescription: props.fonts.display");
  assertString(fonts.body, "brandDescription: props.fonts.body");
  assertRecord(checks, "brandDescription: props.checks");
  assertNumber(checks.passed, "brandDescription: props.checks.passed");
  assertNumber(checks.required, "brandDescription: props.checks.required");
  if (!Array.isArray(palettes)) {
    throw new TypeError(
      `brandDescription: props.palettes must be an array, got ${describeType(palettes)}`,
    );
  }
  for (const count of [checks.passed, checks.required]) {
    if (!(Number.isInteger(count) && count >= 0)) {
      throw new RangeError(
        `brandDescription: props.checks must be whole numbers from 0, got ${count}`,
      );
    }
  }
  if (palettes.length !== PALETTE_COUNT) {
    throw new RangeError(
      `brandDescription: props.palettes must hold ${PALETTE_COUNT} palettes, got ${palettes.length}`,
    );
  }
  const display = firstFamily(fonts.display, "brandDescription: props.fonts.display");
  const body = firstFamily(fonts.body, "brandDescription: props.fonts.body");
  const subject = oneLiner === "" ? name : `${name}, "${oneLiner}"`;
  return `A six-second video of ${subject}: five rows of eleven swatches (primary, secondary, accent, neutral and danger), a sample card with a Get started button, and the line ${checks.passed} of ${checks.required} required checks pass, with the lot ${lot}. It is set in ${display} and ${body}.`;
}
