import { describe, expect, it, vi } from "vitest";
import { brandProps } from "@/export";
import { pickCodec } from "@/features/flavor/record";
import { pickRenderTarget, type RenderDeps, renderBrandVideo } from "@/features/flavor/render";
import { BrandIntro } from "@/flavor/remotion/brand-intro";
import { defaultSpec } from "../../spec/support";
import { FILE_BYTES, fakeRenderer } from "./video-fakes";

// C-DLG-05, C-DLG-06 and C-DLG-10 of docs/specs/05-motion-3d.md, section 14.9 (R5-53, section 11.2):
// the render's shell against a fake web renderer. C-DLG-09's render and record half is in
// record.test.ts, beside the Mediabunny fake.

const PROPS = brandProps(defaultSpec(), "light");
const MP4 = { container: "mp4", videoCodec: "h264" } as const;
const WEBM = { container: "webm", videoCodec: "vp8" } as const;

/** What `canRenderMediaOnWeb` is asked for a container and codec: the render's own options. */
const ask = (container: string, videoCodec: string) => ({
  width: 1280,
  height: 720,
  container,
  videoCodec,
  muted: true,
  outputTarget: "arraybuffer",
});

/** A value of the wrong type or domain, passed where the types forbid it. */
const bad = (value: unknown) => value as never;

/** The deps of one render: `load` gives `module`, and the progress lands in `progress`. */
function depsFor(module: unknown, signal = new AbortController().signal) {
  const progress: number[] = [];
  const load = vi.fn(async () => module as Awaited<ReturnType<RenderDeps["load"]>>);
  const deps: RenderDeps = { load, signal, onProgress: (value) => progress.push(value) };
  return { deps, load, progress };
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

describe("pickRenderTarget", () => {
  it("C-DLG-05 asks for MP4 and H.264 first, then WebM and VP8, and gives the first that can render", async () => {
    const both = fakeRenderer();
    expect(await pickRenderTarget(both.module)).toEqual(MP4);
    expect(both.asked).toEqual([ask("mp4", "h264")]);

    const webm = fakeRenderer({ canRender: (container) => container === "webm" });
    expect(await pickRenderTarget(webm.module)).toEqual(WEBM);
    expect(webm.asked).toEqual([ask("mp4", "h264"), ask("webm", "vp8")]);

    const none = fakeRenderer({ canRender: () => false });
    expect(await pickRenderTarget(none.module)).toBeNull();
    expect(none.asked).toEqual([ask("mp4", "h264"), ask("webm", "vp8")]);
  });

  it("C-DLG-05 counts a throw as no", async () => {
    const mp4Throws = fakeRenderer({
      canRender: (container) => {
        if (container === "mp4") throw new Error("no encoder");
        return true;
      },
    });
    expect(await pickRenderTarget(mp4Throws.module)).toEqual(WEBM);

    const bothThrow = fakeRenderer({
      canRender: () => {
        throw new Error("no encoder");
      },
    });
    expect(await pickRenderTarget(bothThrow.module)).toBeNull();
  });
});

describe("renderBrandVideo", () => {
  it("C-DLG-06 passes the composition, the props, the target and the license, and gives the file's bytes", async () => {
    const renderer = fakeRenderer();
    const controller = new AbortController();
    const { deps, load, progress } = depsFor(renderer.module, controller.signal);

    const outcome = await renderBrandVideo(PROPS, MP4, deps);

    expect(load).toHaveBeenCalledTimes(1);
    expect(renderer.renders).toEqual([
      {
        composition: {
          id: "brand-intro",
          component: BrandIntro,
          width: 1280,
          height: 720,
          fps: 30,
          durationInFrames: 180,
          defaultProps: PROPS,
        },
        inputProps: PROPS,
        container: "mp4",
        videoCodec: "h264",
        muted: true,
        licenseKey: "free-license",
        outputTarget: "arraybuffer",
        signal: controller.signal,
        onProgress: expect.any(Function),
      },
    ]);
    expect(progress).toEqual([0.5]);
    expect(outcome).toEqual({
      kind: "done",
      bytes: Uint8Array.from(FILE_BYTES),
      container: "mp4",
    });
  });

  it("C-DLG-06 renders a WebM target with VP8", async () => {
    const renderer = fakeRenderer();
    const { deps } = depsFor(renderer.module);
    const outcome = await renderBrandVideo(PROPS, WEBM, deps);
    expect(renderer.renders[0]).toMatchObject({ container: "webm", videoCodec: "vp8" });
    expect(outcome).toEqual({
      kind: "done",
      bytes: Uint8Array.from(FILE_BYTES),
      container: "webm",
    });
  });

  it("C-DLG-06 gives load-failed for a rejected load, canceled for an AbortError and failed for any other throw, none holding the error", async () => {
    const load = vi.fn(async () => {
      throw new TypeError("Failed to fetch dynamically imported module");
    });
    const loadFailed = await renderBrandVideo(PROPS, MP4, {
      load,
      signal: new AbortController().signal,
      onProgress: () => {},
    });
    expect(loadFailed).toEqual({ kind: "load-failed" });

    const aborted = fakeRenderer({
      error: new DOMException("The render was aborted", "AbortError"),
    });
    expect(await renderBrandVideo(PROPS, MP4, depsFor(aborted.module).deps)).toEqual({
      kind: "canceled",
    });

    const broken = fakeRenderer({ error: new Error("WebGL context could not be created") });
    expect(await renderBrandVideo(PROPS, MP4, depsFor(broken.module).deps)).toEqual({
      kind: "failed",
    });
  });

  it("C-DLG-06 gives canceled when the signal aborts the render, whose rejection is a plain Error", async () => {
    const renderer = fakeRenderer({ hold: true });
    const controller = new AbortController();
    const running = renderBrandVideo(PROPS, MP4, depsFor(renderer.module, controller.signal).deps);
    await vi.waitFor(() => expect(renderer.renders).toHaveLength(1));
    controller.abort();
    // The fake rejects as 4.0.539 does, with renderCanceled()'s plain Error: the outcome reads the
    // signal, not the error's name.
    expect(await running).toEqual({ kind: "canceled" });
  });

  it("R-05 renderBrandVideo checks every argument's type before the target's values, and starts no load", async () => {
    const { deps, load } = depsFor(fakeRenderer().module);
    const mov = { container: "mov", videoCodec: "h264" };
    await expectReject(
      () => renderBrandVideo(bad(5), bad(mov), deps),
      TypeError,
      "renderBrandVideo",
    );
    await expectReject(
      () => renderBrandVideo(PROPS, bad(null), deps),
      TypeError,
      "renderBrandVideo",
    );
    await expectReject(
      () => renderBrandVideo(PROPS, bad({ container: 4, videoCodec: "h264" }), deps),
      TypeError,
      "renderBrandVideo",
    );
    await expectReject(
      () => renderBrandVideo(PROPS, bad({ container: "mp4", videoCodec: null }), deps),
      TypeError,
      "renderBrandVideo",
    );
    for (const wrong of [
      { ...deps, load: "import" },
      { ...deps, signal: {} },
      { ...deps, onProgress: 1 },
    ]) {
      await expectReject(
        () => renderBrandVideo(PROPS, bad(mov), bad(wrong)),
        TypeError,
        "renderBrandVideo",
      );
    }
    await expectReject(
      () => renderBrandVideo(PROPS, bad({ container: "webm", videoCodec: "h264" }), deps),
      RangeError,
      "renderBrandVideo",
    );
    await expectReject(
      () => renderBrandVideo(PROPS, bad({ container: "mp4", videoCodec: "av1" }), deps),
      RangeError,
      "renderBrandVideo",
    );
    expect(load).not.toHaveBeenCalled();
  });
});

describe("the module arguments", () => {
  it("C-DLG-10 pickRenderTarget(null) and pickCodec(null) throw TypeErrors naming their functions", async () => {
    await expectReject(() => pickRenderTarget(bad(null)), TypeError, "pickRenderTarget");
    await expectReject(() => pickCodec(bad(null)), TypeError, "pickCodec");
    // The modules have no domain beyond their types: a module without the function is the wrong type.
    await expectReject(
      () => pickRenderTarget(bad({ canRenderMediaOnWeb: 5 })),
      TypeError,
      "pickRenderTarget",
    );
    await expectReject(() => pickCodec(bad({})), TypeError, "pickCodec");
  });
});
