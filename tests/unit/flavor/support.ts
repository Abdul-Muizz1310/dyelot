import { onTestFinished, vi } from "vitest";

// Doubles for the flavor runtime's browser half (docs/specs/05-motion-3d.md, section 14.3): a WebGL2
// context that records its calls, and fakes of requestAnimationFrame, the clock, the two observers,
// matchMedia and the page's visibility. Real WebGL runs only in the flows.

/** One uniform upload: the uniform's name and the numbers sent. */
export type Upload = { readonly name: string; readonly value: readonly number[] };

/** One `drawArrays` call. */
export type Draw = { readonly mode: number; readonly first: number; readonly count: number };

/** A uniform location of the fake: the name it was asked for. */
type Location = { readonly name: string };

/**
 * A WebGL2 double: it compiles and links as `createFakeGl`'s options say, and records each uniform
 * upload by name, each `drawArrays` call, each `WEBGL_lose_context.loseContext` call and the context
 * attributes each `getContext` asked for (through `canvasWith`).
 */
export type FakeGl = {
  readonly VERTEX_SHADER: number;
  readonly FRAGMENT_SHADER: number;
  readonly COMPILE_STATUS: number;
  readonly LINK_STATUS: number;
  readonly TRIANGLES: number;
  readonly uploads: Upload[];
  readonly draws: Draw[];
  readonly attributes: unknown[];
  /** The count of `loseContext` calls. */
  losses: number;
  /** The last value uploaded to `name`, or undefined when none was. */
  uniform(name: string): readonly number[] | undefined;
};

/** The GL constants the runtime reads, with WebGL's values. */
const GL_CONSTANTS = {
  VERTEX_SHADER: 0x8b31,
  FRAGMENT_SHADER: 0x8b30,
  COMPILE_STATUS: 0x8b81,
  LINK_STATUS: 0x8b82,
  TRIANGLES: 0x0004,
} as const;

export function createFakeGl(options: { compile?: boolean; link?: boolean } = {}): FakeGl {
  const { compile = true, link = true } = options;
  let lost = false;
  const fake = {
    ...GL_CONSTANTS,
    uploads: [] as Upload[],
    draws: [] as Draw[],
    attributes: [] as unknown[],
    losses: 0,
    uniform(name: string): readonly number[] | undefined {
      return fake.uploads.findLast((upload) => upload.name === name)?.value;
    },
    getExtension(name: string) {
      if (name !== "WEBGL_lose_context") return null;
      return {
        loseContext() {
          fake.losses += 1;
          lost = true;
        },
        restoreContext() {},
      };
    },
    isContextLost: () => lost,
    createShader: (type: number) => ({ type }),
    shaderSource() {},
    compileShader() {},
    getShaderParameter: (_shader: unknown, name: number) =>
      name === GL_CONSTANTS.COMPILE_STATUS ? compile : null,
    createProgram: () => ({}),
    attachShader() {},
    linkProgram() {},
    getProgramParameter: (_program: unknown, name: number) =>
      name === GL_CONSTANTS.LINK_STATUS ? link : null,
    getUniformLocation: (_program: unknown, name: string): Location => ({ name }),
    useProgram() {},
    createVertexArray: () => ({}),
    bindVertexArray() {},
    viewport() {},
    uniform1f(location: Location, x: number) {
      fake.uploads.push({ name: location.name, value: [x] });
    },
    uniform2f(location: Location, x: number, y: number) {
      fake.uploads.push({ name: location.name, value: [x, y] });
    },
    uniform3fv(location: Location, data: Iterable<number>) {
      fake.uploads.push({ name: location.name, value: Array.from(data) });
    },
    drawArrays(mode: number, first: number, count: number) {
      fake.draws.push({ mode, first, count });
    },
  };
  return fake;
}

/**
 * A detached canvas whose `getContext("webgl2")` gives `gl`, or null when `gl` is null (no WebGL2),
 * recording the attributes each call asked for in `gl.attributes`.
 */
export function canvasWith(gl: FakeGl | null): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "getContext", {
    configurable: true,
    value(type: string, attributes?: unknown) {
      if (type !== "webgl2" || gl === null) return null;
      gl.attributes.push(attributes);
      return gl;
    },
  });
  return canvas;
}

/** What the browser fakes hold at a moment: pending frames, observed targets and listeners. */
export type Live = {
  /** Pending `requestAnimationFrame` callbacks. */
  readonly frames: number;
  /** Targets an IntersectionObserver observes. */
  readonly intersection: number;
  /** Targets a ResizeObserver observes. */
  readonly resize: number;
  /** `visibilitychange` listeners on `document`. */
  readonly visibility: number;
  /** `change` listeners on the `prefers-reduced-motion: reduce` query. */
  readonly motion: number;
};

export type BrowserFakes = {
  /** Moves the clock by `ms` and runs, once, each frame callback requested before the call. */
  step(ms: number): void;
  /** Reports every observed target inside (true) or outside (false) the view. */
  reportVisible(visible: boolean): void;
  /** Sets the OS's reduced-motion setting and tells the query's listeners. */
  setReduced(reduce: boolean): void;
  /** Hides the page and fires `visibilitychange`. */
  hide(): void;
  /** Shows the page and fires `visibilitychange`. */
  show(): void;
  /** Gives every target a ResizeObserver observes this CSS size, and tells its observer. */
  resize(width: number, height: number): void;
  /** What is pending, observed or listening now. */
  live(): Live;
};

/** The query the runtime follows for the OS setting. */
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

/** Replaces `globalThis[name]` with `value` and returns how to put the original back. */
function stubGlobal(name: string, value: unknown): () => void {
  const saved = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  return () => {
    if (saved === undefined) Reflect.deleteProperty(globalThis, name);
    else Object.defineProperty(globalThis, name, saved);
  };
}

type IntersectionCallback = (entries: IntersectionObserverEntry[], observer: unknown) => void;
type ResizeCallback = (entries: ResizeObserverEntry[], observer: unknown) => void;
type MotionListener = (event: { readonly matches: boolean; readonly media: string }) => void;

/**
 * Installs fakes of `requestAnimationFrame`, `cancelAnimationFrame`, the clock (`performance.now()`
 * and the frames' timestamps), `IntersectionObserver`, `ResizeObserver`, `matchMedia` and
 * `document.visibilityState`, and restores the originals when the test ends. The page starts
 * visible, the OS setting with no preference.
 */
export function installBrowserFakes(): BrowserFakes {
  let clock = 1_000;
  let nextFrame = 1;
  let frames = new Map<number, FrameRequestCallback>();
  let due = new Map<number, FrameRequestCallback>();
  const intersections = new Map<Element, IntersectionCallback>();
  const resizes = new Map<Element, ResizeCallback>();
  const visibility = new Set<unknown>();
  const motion = new Set<MotionListener>();
  let reduce = false;
  let visibilityState: DocumentVisibilityState = "visible";

  class FakeIntersectionObserver {
    readonly #callback: IntersectionCallback;
    constructor(callback: IntersectionCallback) {
      this.#callback = callback;
    }
    observe(target: Element) {
      intersections.set(target, this.#callback);
    }
    unobserve(target: Element) {
      intersections.delete(target);
    }
    disconnect() {
      for (const [target, callback] of intersections) {
        if (callback === this.#callback) intersections.delete(target);
      }
    }
    takeRecords() {
      return [];
    }
  }

  class FakeResizeObserver {
    readonly #callback: ResizeCallback;
    constructor(callback: ResizeCallback) {
      this.#callback = callback;
    }
    observe(target: Element) {
      resizes.set(target, this.#callback);
    }
    unobserve(target: Element) {
      resizes.delete(target);
    }
    disconnect() {
      for (const [target, callback] of resizes) {
        if (callback === this.#callback) resizes.delete(target);
      }
    }
  }

  const reduceQuery = {
    media: REDUCE_QUERY,
    get matches() {
      return reduce;
    },
    addEventListener(type: string, listener: MotionListener) {
      if (type === "change") motion.add(listener);
    },
    removeEventListener(type: string, listener: MotionListener) {
      if (type === "change") motion.delete(listener);
    },
  };

  const restores = [
    stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = nextFrame;
      nextFrame += 1;
      frames.set(id, callback);
      return id;
    }),
    stubGlobal("cancelAnimationFrame", (id: number) => {
      frames.delete(id);
      due.delete(id);
    }),
    stubGlobal("IntersectionObserver", FakeIntersectionObserver),
    stubGlobal("ResizeObserver", FakeResizeObserver),
    stubGlobal("matchMedia", (query: string) =>
      query === REDUCE_QUERY
        ? reduceQuery
        : { media: query, matches: false, addEventListener() {}, removeEventListener() {} },
    ),
  ];
  const now = vi.spyOn(performance, "now").mockImplementation(() => clock);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibilityState,
  });
  const add = vi.spyOn(document, "addEventListener");
  add.mockImplementation((type, listener, options) => {
    if (type === "visibilitychange") visibility.add(listener);
    EventTarget.prototype.addEventListener.call(document, type, listener, options);
  });
  const remove = vi.spyOn(document, "removeEventListener");
  remove.mockImplementation((type, listener, options) => {
    if (type === "visibilitychange") visibility.delete(listener);
    EventTarget.prototype.removeEventListener.call(document, type, listener, options);
  });

  onTestFinished(() => {
    for (const restore of restores) restore();
    now.mockRestore();
    add.mockRestore();
    remove.mockRestore();
    Reflect.deleteProperty(document, "visibilityState");
  });

  const setVisibility = (state: DocumentVisibilityState) => {
    visibilityState = state;
    document.dispatchEvent(new Event("visibilitychange"));
  };

  return {
    step(ms) {
      clock += ms;
      due = frames;
      frames = new Map();
      // A callback cancelled while an earlier one runs leaves `due` and never runs.
      for (const [id, callback] of due) {
        due.delete(id);
        callback(clock);
      }
    },
    reportVisible(visible) {
      for (const [target, callback] of [...intersections]) {
        const entry = { target, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 };
        callback([entry as unknown as IntersectionObserverEntry], undefined);
      }
    },
    setReduced(next) {
      reduce = next;
      for (const listener of [...motion]) listener({ matches: next, media: REDUCE_QUERY });
    },
    hide: () => setVisibility("hidden"),
    show: () => setVisibility("visible"),
    resize(width, height) {
      for (const [target, callback] of [...resizes]) {
        Object.defineProperty(target, "clientWidth", { configurable: true, value: width });
        Object.defineProperty(target, "clientHeight", { configurable: true, value: height });
        const entry = { target, contentRect: { width, height } };
        callback([entry as unknown as ResizeObserverEntry], undefined);
      }
    },
    live: () => ({
      frames: frames.size,
      intersection: intersections.size,
      resize: resizes.size,
      visibility: visibility.size,
      motion: motion.size,
    }),
  };
}
