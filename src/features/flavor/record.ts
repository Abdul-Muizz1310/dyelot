import type { FlavorStops } from "@/engine";
import { assertRecord, describeType } from "@/features/studio/guards";
import { type FlavorHandle, LOOP_FRAMES, LOOP_SECONDS, mountFlavor } from "@/flavor/flavor.mjs";
import type { RenderOutcome } from "./render";
import { assertJobDeps, type Container, endedBy } from "./video";

// The shader loop's recording (docs/specs/05-motion-3d.md, R5-56 and sections 5.8 and 11.3): the
// shell around `mediabunny`, which the dialog loads with `import()` and hands in as `deps.load`
// (R5-60, R5-61), so this file holds no import of it but its types. It mounts the design's flavor
// on a detached canvas, draws each of the loop's 300 frames and adds it to the file. Every argument
// is checked before the load, and no outcome holds an error. No Remotion code runs here.

type Mediabunny = typeof import("mediabunny");

export type RecordDeps = {
  load(): Promise<Mediabunny>;
  signal: AbortSignal;
  onProgress(progress: number): void;
  /** A detached canvas for the recording. */
  canvas(): HTMLCanvasElement;
};

/** How a recording ended: as a render does. */
export type RecordOutcome = RenderOutcome;

/** A codec this browser can encode and the container it goes in. */
export type RecordCodec = { readonly codec: "avc" | "vp9" | "vp8"; readonly container: Container };

/** The codecs, in the order `pickCodec` asks for them. */
const CODECS: readonly RecordCodec[] = Object.freeze([
  Object.freeze({ codec: "avc", container: "mp4" } as const),
  Object.freeze({ codec: "vp9", container: "webm" } as const),
  Object.freeze({ codec: "vp8", container: "webm" } as const),
]);

/** The file's frame size. */
const SIZE = Object.freeze({ width: 1280, height: 720 });

/** The file's frame rate: the loop's 300 frames over its 10 seconds. */
const FPS = LOOP_FRAMES / LOOP_SECONDS;

/** The encoder's target bitrate, in bits per second. */
const BITRATE = 4_000_000;

/** The design's flavor stops: five `#rrggbb` (as `mountFlavor` reads them). */
const STOP_COUNT = 5;
const HEX = /^#[0-9a-fA-F]{6}$/;

/** The first of `avc` (MP4), `vp9` and `vp8` (WebM) this browser can encode at 1280 by 720, or null. */
export async function pickCodec(
  media: Pick<Mediabunny, "canEncodeVideo">,
): Promise<RecordCodec | null> {
  assertRecord(media, "pickCodec: media");
  if (typeof media.canEncodeVideo !== "function") {
    throw new TypeError(
      `pickCodec: media.canEncodeVideo must be a function, got ${describeType(media.canEncodeVideo)}`,
    );
  }
  for (const choice of CODECS) {
    if (await media.canEncodeVideo(choice.codec, { width: SIZE.width, height: SIZE.height })) {
      return choice;
    }
  }
  return null;
}

/** `recordLoop`'s arguments, checked (R-05): every type, then the flavor's values. */
function checkRecordArguments(flavor: unknown, deps: unknown): void {
  assertRecord(flavor, "recordLoop: flavor");
  const { stops, seed } = flavor;
  if (!Array.isArray(stops)) {
    throw new TypeError(`recordLoop: flavor.stops must be an array, got ${describeType(stops)}`);
  }
  for (const [index, stop] of stops.entries()) {
    if (typeof stop !== "string") {
      throw new TypeError(
        `recordLoop: flavor.stops[${index}] must be a string, got ${describeType(stop)}`,
      );
    }
  }
  if (!Array.isArray(seed)) {
    throw new TypeError(`recordLoop: flavor.seed must be an array, got ${describeType(seed)}`);
  }
  for (const [index, value] of seed.entries()) {
    if (typeof value !== "number") {
      throw new TypeError(
        `recordLoop: flavor.seed[${index}] must be a number, got ${describeType(value)}`,
      );
    }
  }
  assertJobDeps(deps, "recordLoop");
  const { canvas } = deps as { canvas?: unknown };
  if (typeof canvas !== "function") {
    throw new TypeError(`recordLoop: deps.canvas must be a function, got ${describeType(canvas)}`);
  }
  if (stops.length !== STOP_COUNT) {
    throw new RangeError(
      `recordLoop: flavor.stops must hold ${STOP_COUNT} stops, got ${stops.length}`,
    );
  }
  for (const [index, stop] of stops.entries()) {
    if (!HEX.test(stop)) {
      throw new RangeError(
        `recordLoop: flavor.stops[${index}] must be a six-digit hex, got ${JSON.stringify(stop)}`,
      );
    }
  }
  if (seed.length !== 2 || !seed.every((value) => Number.isFinite(value))) {
    throw new RangeError(`recordLoop: flavor.seed must hold 2 finite numbers, got [${seed}]`);
  }
}

/** Cancels `output`, if there is one, and drops it: nothing of it is kept, even if canceling throws. */
async function discard(output: { cancel(): Promise<void> } | null): Promise<void> {
  try {
    await output?.cancel();
  } catch {
    // The output is dropped either way.
  }
}

/**
 * Records the 10-second loop of `flavor` as a 1280 by 720 file at 30 frames a second, and gives its
 * bytes. Progress (0 to 1) goes to `deps.onProgress` after each frame; `deps.signal` cancels. A
 * fallback of the flavor (no WebGL2, a failed compile, a lost context) cancels the file and fails,
 * so no blank file is made. The flavor's handle is destroyed in every outcome.
 */
export async function recordLoop(
  flavor: { stops: FlavorStops; seed: readonly [number, number] },
  deps: RecordDeps,
): Promise<RecordOutcome> {
  checkRecordArguments(flavor, deps);

  let media: Mediabunny;
  try {
    media = await deps.load();
  } catch {
    return { kind: "load-failed" };
  }
  let output: { cancel(): Promise<void> } | null = null;
  let handle: FlavorHandle | null = null;
  try {
    const picked = await pickCodec(media);
    if (picked === null) return { kind: "unsupported" };
    const canvas = deps.canvas();
    const source = new media.CanvasSource(canvas, {
      codec: picked.codec,
      quality: new media.Quality({ bitrate: BITRATE }),
    });
    const target = new media.BufferTarget();
    const file = new media.Output({
      format:
        picked.container === "mp4" ? new media.Mp4OutputFormat() : new media.WebMOutputFormat(),
      target,
    });
    output = file;
    file.addVideoTrack(source);
    await file.start();
    let fellBack = false;
    handle = mountFlavor(canvas, {
      stops: flavor.stops,
      seed: flavor.seed,
      size: { width: SIZE.width, height: SIZE.height },
      autoplay: false,
      onFallback: () => {
        fellBack = true;
      },
    });
    /** How the recording ends early: canceled by the signal, failed by a fallback; else null. */
    const interrupted = (): "canceled" | "failed" | null =>
      deps.signal.aborted ? "canceled" : fellBack ? "failed" : null;
    // Checked before each frame and once after the last, so a Cancel or a fallback that comes
    // during the last `add` still discards the file.
    for (let frame = 0; frame <= LOOP_FRAMES; frame += 1) {
      const kind = interrupted();
      if (kind !== null) {
        await discard(file);
        return { kind };
      }
      if (frame === LOOP_FRAMES) break;
      handle.drawAt(frame / LOOP_FRAMES);
      await source.add(frame / FPS, 1 / FPS);
      deps.onProgress((frame + 1) / LOOP_FRAMES);
    }
    await file.finalize();
    // A Cancel during `finalize()` drops the finished file. A finalized output has nothing left to
    // cancel (1.62.0's `cancel()` only warns then), so it is not called.
    if (deps.signal.aborted) return { kind: "canceled" };
    if (target.buffer === null) return { kind: "failed" };
    return { kind: "done", bytes: new Uint8Array(target.buffer), container: picked.container };
  } catch (error) {
    await discard(output);
    return { kind: endedBy(error, deps.signal) };
  } finally {
    handle?.destroy();
  }
}
