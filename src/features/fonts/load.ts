import { FONT_CATALOG, type FontEntry, fontFiles } from "@/engine";

// The font loader of spec R2-27: the imperative shell around the pure catalog. It builds a
// FontFace per copied file, loads it from /fonts/<id>/ and adds it to the document's font set.
// The browser API is injected through `deps`, so tests pass stubs. A failure never throws: it
// resolves `{ status: "failed", reason }` and the canvas keeps the family's fallback stack.

export type FontStatus = "idle" | "loading" | "loaded" | "failed";

export type FontResult =
  | { readonly id: string; readonly status: "loaded" }
  | {
      readonly id: string;
      readonly status: "failed";
      readonly reason: "load" | "timeout" | "unsupported";
    };

export type FontLoader = {
  /** Never rejects for a known id; throws for an unknown id or a non-string (spec C-LOAD-09). */
  load(id: string): Promise<FontResult>;
  status(id: string): FontStatus;
  subscribe(listener: () => void): () => void;
};

/** How long a family may take before it counts as failed: the one default, 8 seconds. */
export const FONT_TIMEOUT_MS = 8000;

export type FontLoaderDeps = {
  readonly FontFace?: typeof FontFace;
  readonly fonts?: FontFaceSet;
  readonly timeoutMs?: number;
};

type Failure = Extract<FontResult, { status: "failed" }>["reason"];

class LoadFailure extends Error {
  readonly reason: Failure;
  constructor(reason: Failure) {
    super(reason);
    this.reason = reason;
  }
}

/** The faces a family needs: one per copied file (spec R2-03 item 5). */
function faceSources(font: FontEntry): { source: string; weight: string }[] {
  const woff2 = fontFiles(font.id).filter((file) => file.endsWith(".woff2"));
  return woff2.map((file, index) => ({
    source: `url(/fonts/${font.id}/${file}) format('woff2')`,
    weight: font.variable ? `${font.weights[0]} ${font.weights[1]}` : String(font.weights[index]),
  }));
}

function find(id: string, name: string): FontEntry {
  if (typeof id !== "string") {
    throw new TypeError(`${name}: id must be a string, got ${id === null ? "null" : typeof id}`);
  }
  const font = FONT_CATALOG.find((entry) => entry.id === id);
  if (font === undefined) throw new RangeError(`${name}: unknown font id "${id}"`);
  return font;
}

export function createFontLoader(deps: FontLoaderDeps): FontLoader {
  const timeoutMs = deps.timeoutMs ?? FONT_TIMEOUT_MS;
  const states = new Map<string, FontStatus>();
  const results = new Map<string, FontResult>();
  const pending = new Map<string, Promise<FontResult>>();
  const listeners = new Set<() => void>();

  const setStatus = (id: string, status: FontStatus): void => {
    states.set(id, status);
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        // A listener's bug never rejects a load or strands a family at "loading", but it is logged.
        console.error("createFontLoader: a status listener threw", error);
      }
    }
  };

  async function run(font: FontEntry): Promise<void> {
    // Browser globals resolve at call time, so importing this module on the server is safe.
    const FaceCtor = deps.FontFace ?? globalThis.FontFace;
    const set = deps.fonts ?? (typeof document === "undefined" ? undefined : document.fonts);
    if (FaceCtor === undefined || set === undefined) throw new LoadFailure("unsupported");
    let faces: FontFace[];
    try {
      faces = faceSources(font).map(
        ({ source, weight }) =>
          new FaceCtor(font.family, source, { weight, style: "normal", display: "swap" }),
      );
    } catch {
      throw new LoadFailure("unsupported");
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new LoadFailure("timeout")), timeoutMs);
    });
    try {
      const loaded = await Promise.race([
        Promise.all(faces.map((face) => face.load())).catch(() => {
          throw new LoadFailure("load");
        }),
        timeout,
      ]);
      // All faces joined together or none: a family never half-loads.
      const added: FontFace[] = [];
      try {
        for (const face of loaded) {
          set.add(face);
          added.push(face);
        }
      } catch {
        for (const face of added) set.delete(face);
        throw new LoadFailure("load");
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async function start(font: FontEntry): Promise<FontResult> {
    let result: FontResult;
    try {
      await run(font);
      result = { id: font.id, status: "loaded" };
    } catch (error) {
      const reason = error instanceof LoadFailure ? error.reason : "load";
      result = { id: font.id, status: "failed", reason };
    }
    results.set(font.id, result);
    pending.delete(font.id);
    setStatus(font.id, result.status);
    return result;
  }

  return {
    load(id) {
      const font = find(id, "load");
      const done = results.get(id);
      if (done?.status === "loaded") return Promise.resolve(done);
      const running = pending.get(id);
      if (running !== undefined) return running;
      // Register the load before any listener hears "loading": a load called from a listener
      // then shares this promise.
      const started = start(font);
      pending.set(id, started);
      setStatus(id, "loading");
      return started;
    },
    status(id) {
      find(id, "status");
      return states.get(id) ?? "idle";
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The browser instance: a family that has not loaded in 8 seconds counts as failed. */
export const fontLoader: FontLoader = createFontLoader({ timeoutMs: FONT_TIMEOUT_MS });
