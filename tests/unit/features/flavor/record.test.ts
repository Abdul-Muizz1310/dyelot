import { describe, expect, it, vi } from "vitest";
import { flavorSeed, flavorStops } from "@/engine";
import { brandProps } from "@/export";
import { pickCodec, type RecordDeps, recordLoop } from "@/features/flavor/record";
import { renderBrandVideo } from "@/features/flavor/render";
import { specId } from "@/spec";
import { canvasWith, createFakeGl, type FakeGl, installBrowserFakes } from "../../flavor/support";
import { defaultSpec } from "../../spec/support";
import { type FakeMedia, FILE_BYTES, fakeMedia, fakeRenderer } from "./video-fakes";

// C-DLG-07, C-DLG-08 and C-DLG-09's render and record half of docs/specs/05-motion-3d.md, section
// 14.9 (R5-53, R5-56, sections 5.8 and 11.3): the recording's shell against a fake Mediabunny and the
// flavor runtime on a fake WebGL2 context (tests/unit/flavor/support.ts). The flows record for real.

const SPEC = defaultSpec();
const FLAVOR = { stops: flavorStops(SPEC, "light"), seed: flavorSeed(specId(SPEC)) };
const PROPS = brandProps(SPEC, "light");
const SIZE = { width: 1280, height: 720 };

/** A value of the wrong type or domain, passed where the types forbid it. */
const bad = (value: unknown) => value as never;

/** One recording's browser: the fakes, a WebGL2 double on a detached canvas, and a Cancel. */
type World = {
  readonly fakes: ReturnType<typeof installBrowserFakes>;
  readonly gl: FakeGl;
  readonly canvas: HTMLCanvasElement;
  readonly controller: AbortController;
};

function world(gl: FakeGl = createFakeGl()): World {
  return {
    fakes: installBrowserFakes(),
    gl,
    canvas: canvasWith(gl),
    controller: new AbortController(),
  };
}

/** The deps of one recording in `w`: `load` gives `media`, and the progress lands in `progress`. */
function depsOf(w: World, media: FakeMedia) {
  const progress: number[] = [];
  const load = vi.fn(async () => media.module);
  const canvas = vi.fn(() => w.canvas);
  const deps: RecordDeps = {
    load,
    signal: w.controller.signal,
    onProgress: (value) => {
      progress.push(value);
    },
    canvas,
  };
  return { deps, load, canvas, progress };
}

/** Fails unless the flavor handle on `w`'s canvas was destroyed: no state, no listener, context let go. */
function expectDestroyed(w: World) {
  expect(w.canvas.hasAttribute("data-flavor")).toBe(false);
  expect(w.gl.losses).toBe(1);
  expect(w.fakes.live()).toEqual({
    frames: 0,
    intersection: 0,
    resize: 0,
    visibility: 0,
    motion: 0,
  });
}

/** Fails unless `run` rejects with `kind` and a message that starts with `name` and a colon. */
async function expectReject(run: () => Promise<unknown>, kind: ErrorConstructor, name: string) {
  const caught = await run().then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(caught).toBeInstanceOf(kind);
  expect((caught as Error).message).toMatch(new RegExp(`^${name}: `));
}

describe("pickCodec", () => {
  it("C-DLG-07 asks avc, vp9 and vp8 in turn at 1280 by 720, and gives the first that encodes", async () => {
    const cases: [readonly string[], unknown, readonly string[]][] = [
      [["avc", "vp9", "vp8"], { codec: "avc", container: "mp4" }, ["avc"]],
      [["vp9", "vp8"], { codec: "vp9", container: "webm" }, ["avc", "vp9"]],
      [["vp8"], { codec: "vp8", container: "webm" }, ["avc", "vp9", "vp8"]],
      [[], null, ["avc", "vp9", "vp8"]],
    ];
    for (const [encodes, picked, asked] of cases) {
      const media = fakeMedia({ encodes });
      expect(await pickCodec(media.module)).toEqual(picked);
      expect(media.asked).toEqual(asked.map((codec) => ({ codec, options: SIZE })));
    }
  });
});

describe("recordLoop", () => {
  it("C-DLG-08 adds 300 frames, each after its drawAt, then finalizes once and gives the target's bytes", async () => {
    const w = world();
    const phases: (number | undefined)[] = [];
    const media = fakeMedia({
      onAdd: () => {
        phases.push(w.gl.uniform("u_phase")?.[0]);
      },
    });
    const { deps, progress } = depsOf(w, media);

    const outcome = await recordLoop(FLAVOR, deps);

    expect(outcome).toEqual({ kind: "done", bytes: Uint8Array.from(FILE_BYTES), container: "mp4" });
    expect(media.sources).toHaveLength(1);
    expect(media.outputs).toHaveLength(1);
    const [source] = media.sources;
    const [output] = media.outputs;
    expect(source.adds).toEqual(
      Array.from({ length: 300 }, (_, i) => ({ timestamp: i / 30, duration: 1 / 30 })),
    );
    // What the canvas showed when each frame was added: the phase drawAt(i / 300) uploads.
    expect(phases).toHaveLength(300);
    phases.forEach((phase, i) => {
      expect(phase).toBeCloseTo(2 * Math.PI * (i / 300), 12);
    });
    expect(progress).toEqual(Array.from({ length: 300 }, (_, i) => (i + 1) / 300));
    expect(output.calls).toEqual(["start", "finalize"]);
    // The detached canvas, AVC at 4 Mb/s, into an MP4 held in memory.
    expect(source.canvas).toBe(w.canvas);
    expect(source.config).toEqual({ codec: "avc", quality: expect.any(media.module.Quality) });
    expect(media.qualities).toEqual([{ bitrate: 4_000_000 }]);
    expect(output.format).toBeInstanceOf(media.Mp4OutputFormat);
    expect(output.target).toBeInstanceOf(media.BufferTarget);
    expect(output.tracks).toEqual([source]);
    // The flavor mounted at a fixed 1280 by 720 buffer, kept between draws, with the design's seed.
    expect([w.canvas.width, w.canvas.height]).toEqual([1280, 720]);
    expect(w.gl.attributes).toEqual([expect.objectContaining({ preserveDrawingBuffer: true })]);
    expect(w.gl.uniform("u_seed")).toEqual([...FLAVOR.seed]);
    expectDestroyed(w);
  });

  it("C-DLG-08 an abort midway cancels the output and gives canceled", async () => {
    const w = world();
    const media = fakeMedia({
      onAdd: (index) => {
        if (index === 149) w.controller.abort();
      },
    });
    const outcome = await recordLoop(FLAVOR, depsOf(w, media).deps);
    expect(outcome).toEqual({ kind: "canceled" });
    expect(media.sources[0].adds).toHaveLength(150);
    expect(media.outputs[0].calls).toEqual(["start", "cancel"]);
    expectDestroyed(w);
  });

  it("C-DLG-08 a throwing add gives failed", async () => {
    const w = world();
    const media = fakeMedia({
      onAdd: (index) => {
        if (index === 10) throw new Error("VideoEncoder: the codec was closed");
      },
    });
    const outcome = await recordLoop(FLAVOR, depsOf(w, media).deps);
    expect(outcome).toEqual({ kind: "failed" });
    expect(media.outputs[0].calls).toEqual(["start", "cancel"]);
    expectDestroyed(w);
  });

  it("C-DLG-08 a fallback from a failed compile cancels the output and gives failed", async () => {
    const w = world(createFakeGl({ compile: false }));
    const media = fakeMedia();
    const outcome = await recordLoop(FLAVOR, depsOf(w, media).deps);
    expect(outcome).toEqual({ kind: "failed" });
    expect(media.sources[0].adds).toEqual([]);
    expect(media.outputs[0].calls).toEqual(["start", "cancel"]);
    expectDestroyed(w);
  });

  it("C-DLG-08 a fallback from a lost context midway cancels the output and gives failed", async () => {
    const w = world();
    const media = fakeMedia({
      onAdd: (index) => {
        if (index === 99) {
          w.canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
        }
      },
    });
    const outcome = await recordLoop(FLAVOR, depsOf(w, media).deps);
    expect(outcome).toEqual({ kind: "failed" });
    expect(media.sources[0].adds).toHaveLength(100);
    expect(media.outputs[0].calls).toEqual(["start", "cancel"]);
    expectDestroyed(w);
  });

  it("C-DLG-08 gives unsupported when pickCodec finds no codec, before it takes a canvas", async () => {
    const w = world();
    const media = fakeMedia({ encodes: [] });
    const { deps, canvas } = depsOf(w, media);
    expect(await recordLoop(FLAVOR, deps)).toEqual({ kind: "unsupported" });
    expect(media.asked.map((ask) => ask.codec)).toEqual(["avc", "vp9", "vp8"]);
    expect(canvas).not.toHaveBeenCalled();
    expect(media.outputs).toEqual([]);
  });

  it("R5-56 records a WebM with VP9 when AVC cannot encode", async () => {
    const w = world();
    const media = fakeMedia({ encodes: ["vp9", "vp8"] });
    const outcome = await recordLoop(FLAVOR, depsOf(w, media).deps);
    expect(outcome).toEqual({
      kind: "done",
      bytes: Uint8Array.from(FILE_BYTES),
      container: "webm",
    });
    expect(media.sources[0].config.codec).toBe("vp9");
    expect(media.outputs[0].format).toBeInstanceOf(media.WebMOutputFormat);
    expectDestroyed(w);
  });

  it("R5-56 gives load-failed for a rejected load, and failed for a throw before the output exists", async () => {
    const w = world();
    const load = vi.fn(async () => {
      throw new TypeError("Failed to fetch dynamically imported module");
    });
    const { deps } = depsOf(w, fakeMedia());
    expect(await recordLoop(FLAVOR, { ...deps, load })).toEqual({ kind: "load-failed" });

    const media = fakeMedia({ encodeError: new TypeError("width must be a positive integer.") });
    expect(await recordLoop(FLAVOR, depsOf(w, media).deps)).toEqual({ kind: "failed" });
    expect(media.outputs).toEqual([]);
  });

  it("R5-56 gives failed when the finalized target holds no buffer", async () => {
    const w = world();
    const media = fakeMedia({ emptyBuffer: true });
    expect(await recordLoop(FLAVOR, depsOf(w, media).deps)).toEqual({ kind: "failed" });
    expect(media.outputs[0].calls).toEqual(["start", "finalize"]);
    expectDestroyed(w);
  });

  it("R5-56 gives canceled even when canceling the output throws", async () => {
    const w = world();
    const media = fakeMedia({
      onAdd: () => w.controller.abort(),
      cancelError: new Error("the output was already closed"),
    });
    expect(await recordLoop(FLAVOR, depsOf(w, media).deps)).toEqual({ kind: "canceled" });
    expect(media.outputs[0].calls).toEqual(["start", "cancel"]);
    expectDestroyed(w);
  });
});

describe("the shells' arguments", () => {
  it("C-DLG-09 renderBrandVideo and recordLoop refuse a wrong type and a wrong value, naming their functions, before any load", async () => {
    const renderer = fakeRenderer();
    const renderLoad = vi.fn(async () => renderer.module);
    const renderDeps = { load: renderLoad, signal: new AbortController().signal, onProgress() {} };
    const mp4 = { container: "mp4", videoCodec: "h264" } as const;
    await expectReject(
      () => renderBrandVideo(bad(null), mp4, renderDeps),
      TypeError,
      "renderBrandVideo",
    );
    await expectReject(
      () => renderBrandVideo(PROPS, bad({ container: "mov", videoCodec: "h264" }), renderDeps),
      RangeError,
      "renderBrandVideo",
    );

    const w = world();
    const { deps, load } = depsOf(w, fakeMedia());
    await expectReject(() => recordLoop(FLAVOR, bad(null)), TypeError, "recordLoop");
    await expectReject(
      () => recordLoop({ stops: bad(FLAVOR.stops.slice(0, 4)), seed: FLAVOR.seed }, deps),
      RangeError,
      "recordLoop",
    );
    expect(renderLoad).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it("R-05 recordLoop checks every argument's type before the flavor's values, and starts no load", async () => {
    const w = world();
    const { deps, load } = depsOf(w, fakeMedia());
    const four = bad(FLAVOR.stops.slice(0, 4));
    const types: [unknown, unknown][] = [
      [null, deps],
      [{ stops: "#000000", seed: FLAVOR.seed }, deps],
      [{ stops: [1, 2, 3, 4, 5], seed: FLAVOR.seed }, deps],
      [{ stops: four, seed: "0,0" }, deps],
      [{ stops: four, seed: [0, "1"] }, deps],
      [
        { stops: four, seed: FLAVOR.seed },
        { ...deps, load: null },
      ],
      [
        { stops: four, seed: FLAVOR.seed },
        { ...deps, signal: "stop" },
      ],
      [
        { stops: four, seed: FLAVOR.seed },
        { ...deps, onProgress: 0 },
      ],
      [
        { stops: four, seed: FLAVOR.seed },
        { ...deps, canvas: {} },
      ],
    ];
    for (const [flavor, wrong] of types) {
      await expectReject(() => recordLoop(bad(flavor), bad(wrong)), TypeError, "recordLoop");
    }
    const values: unknown[] = [
      { stops: four, seed: FLAVOR.seed },
      { stops: [...FLAVOR.stops.slice(0, 4), "red"], seed: FLAVOR.seed },
      { stops: FLAVOR.stops, seed: [0.5] },
      { stops: FLAVOR.stops, seed: [Number.NaN, 0] },
    ];
    for (const flavor of values) {
      await expectReject(() => recordLoop(bad(flavor), deps), RangeError, "recordLoop");
    }
    expect(load).not.toHaveBeenCalled();
  });
});
