import type { Page } from "@playwright/test";

// Init scripts and readers the M5 flows share (docs/specs/05-motion-3d.md, section 4). Each init script
// takes the page and installs itself before the next navigation.

export type VtRecord = {
  calls: number;
  animations: readonly { pseudo: string; duration: number }[];
};

/**
 * `VT_RECORD` wraps `document.startViewTransition`, counts its calls, and on each `ready` records the
 * duration of every animation whose `pseudoElement` starts with `::view-transition`, with its
 * `pseudoElement`. Read the record with `vtRecord`.
 */
export async function VT_RECORD(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const record = { calls: 0, animations: [] as { pseudo: string; duration: number }[] };
    (window as unknown as { __vt: typeof record }).__vt = record;
    const original = document.startViewTransition?.bind(document);
    if (original === undefined) return;
    document.startViewTransition = ((...args: Parameters<typeof original>) => {
      record.calls += 1;
      const transition = original(...args);
      transition.ready.then(
        () => {
          for (const animation of document.documentElement.getAnimations({ subtree: true })) {
            const effect = animation.effect as KeyframeEffect | null;
            const pseudo = effect?.pseudoElement;
            if (effect === null || pseudo === null || pseudo === undefined) continue;
            if (!pseudo.startsWith("::view-transition")) continue;
            const duration = effect.getComputedTiming().duration;
            record.animations.push({
              pseudo,
              duration: typeof duration === "number" ? duration : 0,
            });
          }
        },
        () => {},
      );
      return transition;
    }) as typeof document.startViewTransition;
  });
}

/** What `VT_RECORD` has kept so far. */
export function vtRecord(page: Page): Promise<VtRecord> {
  return page.evaluate(
    () =>
      (window as unknown as { __vt: { calls: number; animations: VtRecord["animations"] } }).__vt,
  );
}

/**
 * `loseContext` calls `WEBGL_lose_context.loseContext()` on the WebGL context of the canvas at
 * `selector`. The page keeps the extension object, because a lost context gives no extension, so
 * `restore()` can call the same object's `restoreContext()` later.
 */
export async function loseContext(
  page: Page,
  selector: string,
): Promise<{ restore(): Promise<void> }> {
  const index = await page.evaluate((target) => {
    const canvas = document.querySelector(target);
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error(`loseContext: no canvas matches ${target}`);
    }
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    const extension = gl?.getExtension("WEBGL_lose_context") ?? null;
    if (extension === null) throw new Error(`loseContext: no WebGL context on ${target}`);
    const host = window as unknown as { __lostContexts?: WEBGL_lose_context[] };
    host.__lostContexts ??= [];
    host.__lostContexts.push(extension);
    extension.loseContext();
    return host.__lostContexts.length - 1;
  }, selector);
  return {
    restore: () =>
      page.evaluate((kept) => {
        const host = window as unknown as { __lostContexts: WEBGL_lose_context[] };
        host.__lostContexts[kept]?.restoreContext();
      }, index),
  };
}

/**
 * `NO_WEBGL` (Task 5.5b): `HTMLCanvasElement.prototype.getContext` gives null for every type that
 * matches `/webgl/`, so no canvas gets a WebGL context. It patches `HTMLCanvasElement` only, so an
 * `OffscreenCanvas` keeps its contexts (the web renderer's check still passes).
 */
export async function NO_WEBGL(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (/webgl/.test(type)) return null;
      return (original as (type: string, ...rest: unknown[]) => RenderingContext | null).call(
        this,
        type,
        ...rest,
      );
    } as typeof original;
  });
}

/**
 * `NO_COMPILE` (Task 5.5b): `WebGL2RenderingContext.prototype.getShaderParameter` answers false for
 * `COMPILE_STATUS`, so every shader reads as failed to compile; other parameters answer as before.
 */
export async function NO_COMPILE(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const prototype = WebGL2RenderingContext.prototype;
    const original = prototype.getShaderParameter;
    prototype.getShaderParameter = function getShaderParameter(
      this: WebGL2RenderingContext,
      shader: WebGLShader,
      name: GLenum,
    ) {
      if (name === this.COMPILE_STATUS) return false;
      return original.call(this, shader, name);
    };
  });
}

/**
 * `ABORT_CHUNK` answers each `/_next/static/chunks/*.js` request with `route.fetch()` and aborts the
 * response whose text holds `marker`, until `release()` is called. Install it before `goto`: the
 * markers are `dyelot.check/1` for `@/export`, "Before the first render" for the Flavor dialog.
 */
export async function ABORT_CHUNK(page: Page, marker: string): Promise<{ release(): void }> {
  let released = false;
  await page.route("**/_next/static/chunks/*.js", async (route) => {
    if (released) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const text = await response.text();
    if (text.includes(marker)) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({ response, body: text });
  });
  return {
    release() {
      released = true;
    },
  };
}

/**
 * `NO_RENDERER` makes `WebGL2RenderingContext.prototype.getShaderPrecisionFormat` throw, which three's
 * renderer calls as it starts (section 4): the context is made, and the renderer still fails. The
 * error's message starts with "NO_RENDERER", so a flow can name the reports it allows.
 */
export async function NO_RENDERER(page: Page): Promise<void> {
  await page.addInitScript(() => {
    WebGL2RenderingContext.prototype.getShaderPrecisionFormat = () => {
      throw new Error("NO_RENDERER: getShaderPrecisionFormat is switched off");
    };
  });
}

// Task 5.10: the encoder init scripts of the shader loop's flows.

/**
 * `NO_ENCODE` makes `VideoEncoder.isConfigSupported` resolve `{ supported: false }` for every
 * config: the browser has WebCodecs, but encodes no codec (section 4).
 */
export async function NO_ENCODE(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (typeof VideoEncoder !== "function") return;
    VideoEncoder.isConfigSupported = async () => ({ supported: false });
  });
}

/**
 * `NO_AVC` makes `VideoEncoder.isConfigSupported` resolve `{ supported: false }` for every codec
 * string that starts `avc1`, and asks the browser for the rest: AVC never encodes (F-LOOP-03).
 */
export async function NO_AVC(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (typeof VideoEncoder !== "function") return;
    const ask = VideoEncoder.isConfigSupported.bind(VideoEncoder);
    VideoEncoder.isConfigSupported = async (config) =>
      config.codec.startsWith("avc1") ? { supported: false } : ask(config);
  });
}
