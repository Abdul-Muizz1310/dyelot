import { assertRecord, assertString, describeType } from "@/features/studio/guards";
import { BRAND_INTRO, BrandIntro, type BrandProps } from "@/flavor/remotion/brand-intro";
import { assertJobDeps, type Container, endedBy } from "./video";

// The brand video's render (docs/specs/05-motion-3d.md, R5-53 and sections 5.8 and 11.2): the shell
// around `@remotion/web-renderer`, which the dialog loads with `import()` and hands in as
// `deps.load` (R5-60, R5-61), so this file holds no import of it but its types. Every argument is
// checked before the load, and no outcome holds an error.

type WebRenderer = typeof import("@remotion/web-renderer");

export type RenderDeps = {
  load(): Promise<WebRenderer>;
  signal: AbortSignal;
  onProgress(progress: number): void;
};

/** How a video job ended. A recording ends the same ways (`RecordOutcome`). */
export type RenderOutcome =
  | { readonly kind: "done"; readonly bytes: Uint8Array; readonly container: Container }
  | { readonly kind: "unsupported" }
  | { readonly kind: "canceled" }
  | { readonly kind: "failed" }
  | { readonly kind: "load-failed" };

/** A file the renderer can make: a container and its video codec. */
export type RenderTarget = { readonly container: Container; readonly videoCodec: "h264" | "vp8" };

/** The two targets, in the order `pickRenderTarget` asks for them. */
const TARGETS: readonly RenderTarget[] = Object.freeze([
  Object.freeze({ container: "mp4", videoCodec: "h264" } as const),
  Object.freeze({ container: "webm", videoCodec: "vp8" } as const),
]);

/**
 * The first target this browser can render, MP4 with H.264 before WebM with VP8, asked with the
 * render's own options; null when neither can. A check that throws counts as no.
 */
export async function pickRenderTarget(
  renderer: Pick<WebRenderer, "canRenderMediaOnWeb">,
): Promise<RenderTarget | null> {
  assertRecord(renderer, "pickRenderTarget: renderer");
  if (typeof renderer.canRenderMediaOnWeb !== "function") {
    throw new TypeError(
      `pickRenderTarget: renderer.canRenderMediaOnWeb must be a function, got ${describeType(renderer.canRenderMediaOnWeb)}`,
    );
  }
  for (const target of TARGETS) {
    try {
      const answer = await renderer.canRenderMediaOnWeb({
        width: BRAND_INTRO.width,
        height: BRAND_INTRO.height,
        container: target.container,
        videoCodec: target.videoCodec,
        muted: true,
        outputTarget: "arraybuffer",
      });
      if (answer.canRender) return target;
    } catch {
      // A check that throws counts as no (section 11.2).
    }
  }
  return null;
}

/**
 * Renders `BrandIntro` with `props` as `target`'s file, muted, under Remotion's Free License
 * (R5-55), and gives its bytes. Progress (0 to 1) goes to `deps.onProgress`; `deps.signal` cancels.
 */
export async function renderBrandVideo(
  props: BrandProps,
  target: { container: Container; videoCodec: "h264" | "vp8" },
  deps: RenderDeps,
): Promise<RenderOutcome> {
  assertRecord(props, "renderBrandVideo: props");
  assertRecord(target, "renderBrandVideo: target");
  assertString(target.container, "renderBrandVideo: target.container");
  assertString(target.videoCodec, "renderBrandVideo: target.videoCodec");
  assertJobDeps(deps, "renderBrandVideo");
  const known = TARGETS.find((each) => each.container === target.container);
  if (known === undefined) {
    throw new RangeError(
      `renderBrandVideo: target.container must be "mp4" or "webm", got ${JSON.stringify(target.container)}`,
    );
  }
  if (target.videoCodec !== known.videoCodec) {
    throw new RangeError(
      `renderBrandVideo: target.videoCodec must be "${known.videoCodec}" for ${known.container}, got ${JSON.stringify(target.videoCodec)}`,
    );
  }

  let renderer: WebRenderer;
  try {
    renderer = await deps.load();
  } catch {
    return { kind: "load-failed" };
  }
  try {
    const result = await renderer.renderMediaOnWeb({
      composition: {
        id: "brand-intro",
        component: BrandIntro,
        ...BRAND_INTRO,
        defaultProps: props,
      },
      inputProps: props,
      container: known.container,
      videoCodec: known.videoCodec,
      muted: true,
      licenseKey: "free-license",
      outputTarget: "arraybuffer",
      signal: deps.signal,
      onProgress: ({ progress }) => deps.onProgress(progress),
    });
    const bytes = new Uint8Array(await (await result.getBlob()).arrayBuffer());
    // 4.0.539 reads the signal no more after the last frame, so a Cancel while it finalizes the
    // file lets the render resolve: the bytes are dropped (R5-53, as R5-56 for the recording).
    if (deps.signal.aborted) return { kind: "canceled" };
    return { kind: "done", bytes, container: known.container };
  } catch (error) {
    return { kind: endedBy(error, deps.signal) };
  }
}
