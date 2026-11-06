import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { flavorSeed, flavorStops } from "@/engine";
import { brandProps } from "@/export";
import { recordLoop } from "@/features/flavor/record";
import { type RenderOutcome, renderBrandVideo } from "@/features/flavor/render";
import { useVideoJob } from "@/features/flavor/useVideoJob";
import { specId } from "@/spec";
import { canvasWith, createFakeGl, installBrowserFakes } from "../../flavor/support";
import { defaultSpec } from "../../spec/support";
import { type FakeRenderer, FILE_BYTES, fakeMedia, fakeRenderer } from "./video-fakes";

// C-DLG-RF4 of docs/specs/05-motion-3d.md, section 14.9 (RF4, R5-51, R5-53): the dialog's one
// useVideoJob runs one video job at a time. A double click, a close during a job and two jobs at
// once each end with one job, at most one file and the hook idle.

const SPEC = defaultSpec();
const PROPS = brandProps(SPEC, "light");
const FLAVOR = { stops: flavorStops(SPEC, "light"), seed: flavorSeed(specId(SPEC)) };
const MP4 = { container: "mp4", videoCodec: "h264" } as const;
const FILE = { kind: "done", bytes: Uint8Array.from(FILE_BYTES), container: "mp4" };

/** A render's work through `renderBrandVideo`, its renderer loaded by `load`. */
function renderJob(renderer: FakeRenderer) {
  const load = vi.fn(async () => renderer.module);
  const work = (signal: AbortSignal) =>
    renderBrandVideo(PROPS, MP4, { load, signal, onProgress: () => {} });
  return { load, work };
}

/** A recording's work through `recordLoop`, on a fake WebGL2 context. */
function recordJob() {
  const media = fakeMedia();
  const load = vi.fn(async () => media.module);
  const work = (signal: AbortSignal) =>
    recordLoop(FLAVOR, {
      load,
      signal,
      onProgress: () => {},
      canvas: () => canvasWith(createFakeGl()),
    });
  return { load, work };
}

describe("useVideoJob", () => {
  it("C-DLG-RF4 a second press while a render runs does nothing, and the one render gives one file", async () => {
    const renderer = fakeRenderer({ hold: true });
    const { load, work } = renderJob(renderer);
    const { result, unmount } = renderHook(() => useVideoJob());
    expect(result.current.running).toBeNull();

    let first: Promise<RenderOutcome | null> = Promise.resolve(null);
    let second: Promise<RenderOutcome | null> = Promise.resolve(null);
    act(() => {
      // A double click: both presses land before React renders again.
      first = result.current.start("render", work);
      second = result.current.start("render", work);
    });
    expect(await second).toBeNull();
    expect(result.current.running).toBe("render");
    await vi.waitFor(() => expect(renderer.renders).toHaveLength(1));

    let third: Promise<RenderOutcome | null> = Promise.resolve(null);
    act(() => {
      third = result.current.start("render", work);
    });
    expect(await third).toBeNull();

    await act(async () => {
      renderer.finish();
      expect(await first).toEqual(FILE);
    });
    expect(load).toHaveBeenCalledTimes(1);
    expect(renderer.renders).toHaveLength(1);
    expect(result.current.running).toBeNull();
    unmount();
  });

  it("C-DLG-RF4 closing (the hook's abort) gives canceled and leaves the job idle", async () => {
    const renderer = fakeRenderer({ hold: true });
    const { work } = renderJob(renderer);
    const { result, unmount } = renderHook(() => useVideoJob());

    let first: Promise<RenderOutcome | null> = Promise.resolve(null);
    act(() => {
      first = result.current.start("render", work);
    });
    await vi.waitFor(() => expect(renderer.renders).toHaveLength(1));
    await act(async () => {
      result.current.abort();
      expect(await first).toEqual({ kind: "canceled" });
    });
    expect(result.current.running).toBeNull();

    // Idle again: the next press starts a new job, which gives its file.
    const next = fakeRenderer();
    await act(async () => {
      expect(await result.current.start("render", renderJob(next).work)).toEqual(FILE);
    });
    expect(next.renders).toHaveLength(1);
    expect(result.current.running).toBeNull();
    unmount();
  });

  it("C-DLG-RF4 unmounting (the dialog closing) aborts the running job", async () => {
    const renderer = fakeRenderer({ hold: true });
    const { work } = renderJob(renderer);
    const { result, unmount } = renderHook(() => useVideoJob());

    let first: Promise<RenderOutcome | null> = Promise.resolve(null);
    act(() => {
      first = result.current.start("render", work);
    });
    await vi.waitFor(() => expect(renderer.renders).toHaveLength(1));
    unmount();
    expect(await first).toEqual({ kind: "canceled" });
    expect((renderer.renders[0].signal as AbortSignal).aborted).toBe(true);
  });

  it("C-DLG-RF4 a recording asked for while a render runs starts nothing, and starts once the render ends", async () => {
    installBrowserFakes();
    const renderer = fakeRenderer({ hold: true });
    const render = renderJob(renderer);
    const record = recordJob();
    const { result, unmount } = renderHook(() => useVideoJob());

    let first: Promise<RenderOutcome | null> = Promise.resolve(null);
    act(() => {
      first = result.current.start("render", render.work);
    });
    let refused: Promise<RenderOutcome | null> = Promise.resolve(null);
    act(() => {
      refused = result.current.start("record", record.work);
    });
    expect(await refused).toBeNull();
    expect(record.load).not.toHaveBeenCalled();
    expect(result.current.running).toBe("render");

    await act(async () => {
      renderer.finish();
      expect(await first).toEqual(FILE);
    });
    await act(async () => {
      expect(await result.current.start("record", record.work)).toEqual(FILE);
    });
    expect(record.load).toHaveBeenCalledTimes(1);
    expect(result.current.running).toBeNull();
    unmount();
  });

  it("RF4 a job whose work throws leaves the hook idle", async () => {
    const { result, unmount } = renderHook(() => useVideoJob());
    const defect = new TypeError("renderBrandVideo: props must be an object, got null");
    await act(async () => {
      await expect(
        result.current.start("render", async () => {
          throw defect;
        }),
      ).rejects.toBe(defect);
    });
    expect(result.current.running).toBeNull();
    unmount();
  });
});
