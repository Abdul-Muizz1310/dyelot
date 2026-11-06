import { test as base, expect, type Page } from "@playwright/test";

// Init scripts and readers the M5 flows share (docs/specs/05-motion-3d.md, section 4). Each init script
// takes the page and installs itself before the next navigation. The flows' one `test`, with its watch
// (14.11's preamble), is first.

/**
 * What a flow allows its watch, before or after the event: `allow(pattern, count, source)` admits
 * exactly `count` console errors whose text matches `pattern` and, when `source` is given, whose
 * source URL is `source`: fewer or more fail the flow too. `allowStray(request)` admits one request
 * `TELEMETRY` aborted, as "<method> <url>", in the order the flow names them.
 */
export type Watch = {
  allow(pattern: RegExp, count: number, source?: string): void;
  allowStray(request: string): void;
};
type Allowance = { readonly pattern: RegExp; readonly count: number; readonly source?: string };
type Logged = { readonly text: string; readonly source: string };

const admits = (allowance: Allowance, logged: Logged): boolean =>
  allowance.pattern.test(logged.text) &&
  (allowance.source === undefined || allowance.source === logged.source);

/** The binding each document reports its policy violations and unhandled rejections through. */
const WATCH_BINDING = "__dyelotWatch";

/** Each page's `TELEMETRY` stray readers, which its watch reads at the flow's end. */
const telemetries = new WeakMap<Page, (() => readonly string[])[]>();

/**
 * The M5 flows' `test` (14.11's preamble, R5-59). Its watch records, from before the page's scripts
 * run, every policy violation, console error, page error and unhandled rejection in every document
 * the flow visits: each document reports its violations and rejections to the flow as they happen,
 * so a navigation loses none. At the flow's end it fails on any that `allow` did not name, and on any
 * request to remotion.pro that a `TELEMETRY` of the page aborted and `allowStray` did not name. The
 * allowances 14.11 names are the `ABORT_CHUNK` rule's two failed loads (`allowAbortedChunk`) and the
 * explorer's lines of R5-39's amendment.
 */
export const test = base.extend<{ watch: Watch }>({
  watch: [
    async ({ page }, use) => {
      const errors: Logged[] = [];
      const pageErrors: string[] = [];
      const violations: string[] = [];
      const rejections: string[] = [];
      const allowed: Allowance[] = [];
      const allowedStrays: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          errors.push({ text: message.text(), source: message.location().url });
        }
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.exposeBinding(WATCH_BINDING, (_source, kind: unknown, detail: unknown) => {
        (kind === "violation" ? violations : rejections).push(String(detail));
      });
      await page.addInitScript((binding) => {
        type Report = (kind: string, detail: string) => Promise<void>;
        const host = window as unknown as Record<string, Report | undefined> & {
          __dyelotWatchSent?: Promise<void>[];
        };
        // Each report's promise settles once the flow has it, so the flow's end can wait for them.
        const sent: Promise<void>[] = [];
        host.__dyelotWatchSent = sent;
        const report = (kind: string, detail: string) => {
          const call = host[binding]?.(kind, detail);
          if (call !== undefined) sent.push(call.catch(() => {}));
        };
        document.addEventListener(
          "securitypolicyviolation",
          (event) => report("violation", `${event.violatedDirective} ${event.blockedURI}`),
          true,
        );
        window.addEventListener("unhandledrejection", (event) =>
          report("rejection", String(event.reason)),
        );
      }, WATCH_BINDING);
      await use({
        allow: (pattern, count, source) =>
          void allowed.push(source === undefined ? { pattern, count } : { pattern, count, source }),
        allowStray: (request) => void allowedStrays.push(request),
      });
      // The current document's reports reach the flow before it reads them.
      await page.evaluate(() =>
        Promise.all(
          (window as unknown as { __dyelotWatchSent?: Promise<void>[] }).__dyelotWatchSent ?? [],
        ),
      );
      const counts = () =>
        allowed.map((allowance) => errors.filter((logged) => admits(allowance, logged)).length);
      // An allowed line may still be on its way: wait for each count, never past the poll's limit.
      await expect.poll(counts).toEqual(allowed.map(({ count }) => count));
      const unexpected = errors
        .filter((logged) => !allowed.some((allowance) => admits(allowance, logged)))
        .map(({ text, source }) => `${text} (${source})`);
      const strays = (telemetries.get(page) ?? []).flatMap((read) => read());
      expect({
        console: unexpected,
        allowed: counts(),
        page: pageErrors,
        rejections,
        violations,
        strays,
      }).toEqual({
        console: [],
        allowed: allowed.map(({ count }) => count),
        page: [],
        rejections: [],
        violations: [],
        strays: allowedStrays,
      });
    },
    { auto: true },
  ],
});

/** Keeps the URL of every request that failed with `net::ERR_FAILED` (an aborted chunk). */
export function recordAborted(page: Page): string[] {
  const aborted: string[] = [];
  page.on("requestfailed", (request) => {
    if (request.failure()?.errorText === "net::ERR_FAILED") aborted.push(request.url());
  });
  return aborted;
}

/**
 * Checks 14.11's `ABORT_CHUNK` rule once the load has failed: the chunk that holds `marker` failed
 * twice, its request and Turbopack's one retry, and the flow allows the browser's two lines for it.
 * `aborted` is `recordAborted`'s list, made before the flow's `goto`.
 */
export async function allowAbortedChunk(
  page: Page,
  watch: Watch,
  aborted: readonly string[],
  marker: string,
): Promise<void> {
  await expect.poll(() => aborted.length).toBe(2);
  const [chunk = ""] = aborted;
  expect(aborted).toEqual([chunk, chunk]);
  expect(await (await page.request.get(chunk)).text()).toContain(marker);
  watch.allow(/^Failed to load resource: net::ERR_FAILED$/, 2, chunk);
}

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

// Task 5.9c: the brand video render's init scripts, its usage event's answer and the status recorder.

/**
 * `NO_WEBCODECS` deletes `window.VideoEncoder`, so the browser has no WebCodecs (section 4): neither
 * video job can start.
 */
export async function NO_WEBCODECS(page: Page): Promise<void> {
  await page.addInitScript(() => {
    delete (window as unknown as { VideoEncoder?: unknown }).VideoEncoder;
  });
}

/** The usage event the web renderer sends after each render (R5-59, probe 4). */
const USAGE_POINT = "https://www.remotion.pro/api/track/register-usage-point";

/** Every address of the usage event's host, which `TELEMETRY` routes. */
const REMOTION_HOST = "https://www.remotion.pro/**";

/** The CORS headers of M4's `answerCrossOrigin` (tests/e2e/ai-support.ts), which R5-59 reuses. */
const USAGE_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

/**
 * `TELEMETRY` answers the web renderer's usage event as R5-59 says, so no flow reaches remotion.pro
 * (I-M5-09): the CORS preflight `OPTIONS` with 204, and the `POST` with 200 `{"success": true}`, both
 * with M4's CORS headers. The renderer throws on any body without `success` true, and sends the event
 * without awaiting it, so any other answer would be an unhandled rejection in the page. `posts()`
 * gives the JSON body of each `POST` so far; poll it, since the event leaves after the download
 * starts. Any other request to the host never leaves the browser: it is aborted, and `strays()`
 * gives each as "<method> <url>"; the watch of `test` fails the flow on any (Task 5.9c's review, the
 * final review). Install it before `goto`.
 */
export async function TELEMETRY(
  page: Page,
): Promise<{ posts(): readonly unknown[]; strays(): readonly string[] }> {
  const posts: unknown[] = [];
  const strays: string[] = [];
  const readers = telemetries.get(page) ?? [];
  readers.push(() => [...strays]);
  telemetries.set(page, readers);
  await page.route(REMOTION_HOST, async (route) => {
    const request = route.request();
    if (request.url() !== USAGE_POINT) {
      strays.push(`${request.method()} ${request.url()}`);
      await route.abort("blockedbyclient");
      return;
    }
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: USAGE_CORS });
      return;
    }
    if (request.method() === "POST") posts.push(request.postDataJSON());
    await route.fulfill({
      status: 200,
      headers: USAGE_CORS,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    });
  });
  return { posts: () => [...posts], strays: () => [...strays] };
}

/**
 * `STATUS_RECORD` keeps every text the element at `selector` takes, in order (section 4): a
 * `MutationObserver` on the whole document reads the element's text after each change and keeps it
 * when it differs from the last one kept, so a region that mounts later, or mounts again in a new
 * dialog, is recorded too. Install it before `goto`; `texts()` reads the record so far.
 */
export async function STATUS_RECORD(
  page: Page,
  selector: string,
): Promise<{ texts(): Promise<readonly string[]> }> {
  await page.addInitScript((target) => {
    const host = window as unknown as { __statusRecords?: Record<string, string[]> };
    host.__statusRecords ??= {};
    const kept: string[] = [];
    host.__statusRecords[target] = kept;
    const read = () => {
      const element = document.querySelector(target);
      if (element === null) return;
      const text = element.textContent ?? "";
      if (kept.length === 0 || kept[kept.length - 1] !== text) kept.push(text);
    };
    new MutationObserver(read).observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }, selector);
  return {
    texts: () =>
      page.evaluate(
        (target) =>
          (window as unknown as { __statusRecords: Record<string, string[]> }).__statusRecords[
            target
          ] ?? [],
        selector,
      ),
  };
}
