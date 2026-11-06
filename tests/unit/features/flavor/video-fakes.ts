// Fakes of the two video libraries (docs/specs/05-motion-3d.md, section 14.9; plan departure D7): a
// web renderer whose answers and render a test sets, and a Mediabunny that records the output's
// calls. The shells reach them through `deps.load()`, so no test loads the real libraries; the
// flows run those in a real browser.

type WebRenderer = typeof import("@remotion/web-renderer");
type Mediabunny = typeof import("mediabunny");

/** A small file whose bytes 4 to 7 read `ftyp`, as an MP4's do. */
export const FILE_BYTES: readonly number[] = Object.freeze([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]);

/** The rejection 4.0.539 gives once a render's signal aborts: a plain Error, not an AbortError. */
export const renderCanceled = () => new Error("renderMediaOnWeb() was cancelled");

export type FakeRenderer = {
  readonly module: WebRenderer;
  /** The options of each `canRenderMediaOnWeb` call, in order. */
  readonly asked: Record<string, unknown>[];
  /** The options of each `renderMediaOnWeb` call, in order. */
  readonly renders: Record<string, unknown>[];
  /** Ends the held render with the file. */
  finish(): void;
};

/**
 * A web renderer. `canRender` answers `canRenderMediaOnWeb` by container (a throw is thrown, as
 * the real one may); by default every container can render. A render reports a progress of 0.5,
 * then rejects with `error` when one is given, waits for `finish()` when `hold` is set, or
 * resolves at once with `FILE_BYTES`. An aborted signal rejects it as 4.0.539 does.
 */
export function fakeRenderer(
  options: { canRender?: (container: string) => boolean; error?: unknown; hold?: boolean } = {},
): FakeRenderer {
  const { canRender = () => true, error, hold = false } = options;
  const asked: Record<string, unknown>[] = [];
  const renders: Record<string, unknown>[] = [];
  let finish = () => {};
  const module = {
    async canRenderMediaOnWeb(ask: Record<string, unknown>) {
      asked.push(ask);
      return { canRender: canRender(String(ask.container)), issues: [] };
    },
    async renderMediaOnWeb(render: Record<string, unknown>) {
      renders.push(render);
      const signal = render.signal as AbortSignal;
      if (signal.aborted) throw renderCanceled();
      (render.onProgress as (progress: Record<string, unknown>) => void)({
        renderedFrames: 90,
        encodedFrames: 90,
        doneIn: null,
        renderEstimatedTime: 0,
        progress: 0.5,
      });
      if (error !== undefined) throw error;
      if (hold) {
        await new Promise<void>((resolve, reject) => {
          finish = resolve;
          signal.addEventListener("abort", () => reject(renderCanceled()), { once: true });
        });
      }
      return { getBlob: async () => new Blob([Uint8Array.from(FILE_BYTES)]), internalState: {} };
    },
  };
  return {
    module: module as unknown as WebRenderer,
    asked,
    renders,
    finish: () => finish(),
  };
}

/** One `CanvasSource.add` call. */
export type Add = { readonly timestamp: number; readonly duration: number };

export type FakeSource = {
  readonly canvas: unknown;
  readonly config: { readonly codec: string; readonly quality: unknown };
  readonly adds: Add[];
};

export type FakeOutput = {
  readonly format: unknown;
  readonly target: { buffer: ArrayBuffer | null };
  readonly tracks: unknown[];
  /** "start", "finalize" and "cancel", in the order they were called. */
  readonly calls: string[];
};

export type FakeMedia = {
  readonly module: Mediabunny;
  /** Each `canEncodeVideo` call's codec and options, in order. */
  readonly asked: { readonly codec: string; readonly options: unknown }[];
  readonly outputs: FakeOutput[];
  readonly sources: FakeSource[];
  /** The options each `Quality` was built with. */
  readonly qualities: unknown[];
  /** The format classes, to tell an MP4 output from a WebM one. */
  readonly Mp4OutputFormat: new () => unknown;
  readonly WebMOutputFormat: new () => unknown;
  readonly BufferTarget: new () => unknown;
};

/**
 * A Mediabunny. `canEncodeVideo` answers yes for the codecs in `encodes` (by default `avc` only),
 * or throws `encodeError`. `onAdd` runs inside each `CanvasSource.add` with the call's index, before
 * the call returns; a throw there is the call's. `finalize` runs `onFinalize`, then writes
 * `FILE_BYTES` into the target, unless `emptyBuffer`; `cancel` rejects when `cancelError` is given.
 */
export function fakeMedia(
  options: {
    encodes?: readonly string[];
    encodeError?: unknown;
    onAdd?: (index: number) => void | Promise<void>;
    onFinalize?: () => void | Promise<void>;
    emptyBuffer?: boolean;
    cancelError?: unknown;
  } = {},
): FakeMedia {
  const {
    encodes = ["avc"],
    encodeError,
    onAdd,
    onFinalize,
    emptyBuffer = false,
    cancelError,
  } = options;
  const asked: { codec: string; options: unknown }[] = [];
  const outputs: FakeOutput[] = [];
  const sources: FakeSource[] = [];
  const qualities: unknown[] = [];

  class Quality {
    constructor(quality: unknown) {
      qualities.push(quality);
    }
  }
  class Mp4OutputFormat {}
  class WebMOutputFormat {}
  class BufferTarget {
    buffer: ArrayBuffer | null = null;
  }
  class CanvasSource {
    readonly record: FakeSource;
    constructor(canvas: unknown, config: { codec: string; quality: unknown }) {
      this.record = { canvas, config, adds: [] };
      sources.push(this.record);
    }
    async add(timestamp: number, duration: number) {
      const index = this.record.adds.length;
      this.record.adds.push({ timestamp, duration });
      await onAdd?.(index);
    }
  }
  class Output {
    readonly record: FakeOutput;
    constructor(init: { format: unknown; target: { buffer: ArrayBuffer | null } }) {
      this.record = { format: init.format, target: init.target, tracks: [], calls: [] };
      outputs.push(this.record);
    }
    get target() {
      return this.record.target;
    }
    addVideoTrack(source: CanvasSource) {
      this.record.tracks.push(source.record);
    }
    async start() {
      this.record.calls.push("start");
    }
    async finalize() {
      this.record.calls.push("finalize");
      await onFinalize?.();
      if (!emptyBuffer) this.record.target.buffer = Uint8Array.from(FILE_BYTES).buffer;
    }
    async cancel() {
      this.record.calls.push("cancel");
      if (cancelError !== undefined) throw cancelError;
    }
  }

  const module = {
    async canEncodeVideo(codec: string, ask: unknown) {
      asked.push({ codec, options: ask });
      if (encodeError !== undefined) throw encodeError;
      return encodes.includes(codec);
    },
    Quality,
    Mp4OutputFormat,
    WebMOutputFormat,
    BufferTarget,
    CanvasSource,
    Output,
  };
  return {
    module: module as unknown as Mediabunny,
    asked,
    outputs,
    sources,
    qualities,
    Mp4OutputFormat,
    WebMOutputFormat,
    BufferTarget,
  };
}
