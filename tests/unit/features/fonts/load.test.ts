import { afterEach, describe, expect, it, vi } from "vitest";
import { createFontLoader, type FontLoaderDeps } from "@/features/fonts/load";

// Cases are the C-LOAD-nn rows of docs/specs/02-studio.md, section 6.2 (review focus RF3).

type Behavior = "resolve" | "reject" | "hang";

/** A FontFace stub: records what it was built with, and loads as `behavior` says. */
function stubs(behavior: (family: string, source: string) => Behavior = () => "resolve") {
  const built: { family: string; source: string; descriptors: Record<string, string> }[] = [];
  class StubFontFace {
    readonly family: string;
    readonly source: string;
    constructor(family: string, source: string, descriptors: Record<string, string>) {
      this.family = family;
      this.source = source;
      built.push({ family, source, descriptors });
    }
    load(): Promise<StubFontFace> {
      const how = behavior(this.family, this.source);
      if (how === "reject") return Promise.reject(new Error("network"));
      if (how === "hang") return new Promise(() => {});
      return Promise.resolve(this);
    }
  }
  const added: unknown[] = [];
  const fonts = { add: (face: unknown) => added.push(face) };
  const deps = {
    FontFace: StubFontFace as unknown as typeof FontFace,
    fonts: fonts as unknown as FontFaceSet,
    timeoutMs: 50,
  } satisfies FontLoaderDeps;
  return { built, added, deps };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createFontLoader().load", () => {
  it("C-LOAD-01 loads a variable family from its wght file and adds the face", async () => {
    const { built, added, deps } = stubs();
    const result = await createFontLoader(deps).load("host-grotesk");
    expect(result).toEqual({ id: "host-grotesk", status: "loaded" });
    expect(built).toEqual([
      {
        family: "Host Grotesk",
        source: "url(/fonts/host-grotesk/host-grotesk-latin-wght-normal.woff2) format('woff2')",
        descriptors: { weight: "300 800", style: "normal", display: "swap" },
      },
    ]);
    expect(added).toHaveLength(1);
  });

  it("C-LOAD-02 builds one face per copied weight of a static family", async () => {
    const { built, added, deps } = stubs();
    const result = await createFontLoader(deps).load("courier-prime");
    expect(result).toEqual({ id: "courier-prime", status: "loaded" });
    expect(built.map((b) => [b.source, b.descriptors.weight])).toEqual([
      ["url(/fonts/courier-prime/courier-prime-latin-400-normal.woff2) format('woff2')", "400"],
      ["url(/fonts/courier-prime/courier-prime-latin-700-normal.woff2) format('woff2')", "700"],
    ]);
    expect(added).toHaveLength(2);
  });

  it("C-LOAD-03 reports idle, loading, loaded and notifies subscribers", async () => {
    const { deps } = stubs();
    const loader = createFontLoader(deps);
    const calls: string[] = [];
    const unsubscribe = loader.subscribe(() => calls.push(loader.status("onest")));
    expect(loader.status("onest")).toBe("idle");
    const pending = loader.load("onest");
    expect(loader.status("onest")).toBe("loading");
    await pending;
    expect(loader.status("onest")).toBe("loaded");
    expect(calls).toEqual(["loading", "loaded"]);
    unsubscribe();
    await loader.load("literata");
    expect(calls).toEqual(["loading", "loaded"]);
  });

  it("C-LOAD-04 builds no new face for a loaded family and returns the same result", async () => {
    const { built, deps } = stubs();
    const loader = createFontLoader(deps);
    const first = await loader.load("onest");
    const second = await loader.load("onest");
    expect(second).toEqual(first);
    expect(built).toHaveLength(1);
  });

  it("C-LOAD-04 shares one load between two calls made while it is pending", async () => {
    const { built, deps } = stubs();
    const loader = createFontLoader(deps);
    const [a, b] = await Promise.all([loader.load("onest"), loader.load("onest")]);
    expect(a).toEqual(b);
    expect(built).toHaveLength(1);
  });

  it("C-LOAD-05 resolves failed with reason load when a face rejects, and adds no face", async () => {
    const { added, deps } = stubs(() => "reject");
    const loader = createFontLoader(deps);
    await expect(loader.load("host-grotesk")).resolves.toEqual({
      id: "host-grotesk",
      status: "failed",
      reason: "load",
    });
    expect(added).toHaveLength(0);
    expect(loader.status("host-grotesk")).toBe("failed");
  });

  it("C-LOAD-05 adds none of a static family's faces when one of them fails", async () => {
    const { added, deps } = stubs((_family, source) =>
      source.includes("-700-") ? "reject" : "resolve",
    );
    const result = await createFontLoader(deps).load("courier-prime");
    expect(result).toEqual({ id: "courier-prime", status: "failed", reason: "load" });
    expect(added).toHaveLength(0);
  });

  it("C-LOAD-06 resolves failed with reason timeout after timeoutMs", async () => {
    vi.useFakeTimers();
    const { added, deps } = stubs(() => "hang");
    const loader = createFontLoader({ ...deps, timeoutMs: 8000 });
    const pending = loader.load("host-grotesk");
    await vi.advanceTimersByTimeAsync(7999);
    expect(loader.status("host-grotesk")).toBe("loading");
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({
      id: "host-grotesk",
      status: "failed",
      reason: "timeout",
    });
    expect(loader.status("host-grotesk")).toBe("failed");
    expect(added).toHaveLength(0);
  });

  it("C-LOAD-06 adds no face that finishes after the timeout", async () => {
    vi.useFakeTimers();
    let release: () => void = () => {};
    const added: unknown[] = [];
    class SlowFace {
      load(): Promise<SlowFace> {
        return new Promise((resolve) => {
          release = () => resolve(this);
        });
      }
    }
    const loader = createFontLoader({
      FontFace: SlowFace as unknown as typeof FontFace,
      fonts: { add: (face: unknown) => added.push(face) } as unknown as FontFaceSet,
      timeoutMs: 100,
    });
    const pending = loader.load("onest");
    await vi.advanceTimersByTimeAsync(100);
    await pending;
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(added).toHaveLength(0);
  });

  it("C-LOAD-07 resolves failed with reason unsupported when the constructor throws", async () => {
    class Throwing {
      constructor() {
        throw new SyntaxError("bad source");
      }
    }
    const loader = createFontLoader({
      FontFace: Throwing as unknown as typeof FontFace,
      fonts: { add: () => {} } as unknown as FontFaceSet,
    });
    await expect(loader.load("onest")).resolves.toEqual({
      id: "onest",
      status: "failed",
      reason: "unsupported",
    });
  });

  it("C-LOAD-07 resolves failed with reason unsupported without FontFace or a font set", async () => {
    vi.stubGlobal("FontFace", undefined);
    try {
      const bare = createFontLoader({});
      await expect(bare.load("onest")).resolves.toEqual({
        id: "onest",
        status: "failed",
        reason: "unsupported",
      });
      const { deps } = stubs();
      const noSet = createFontLoader({ FontFace: deps.FontFace });
      await expect(noSet.load("onest")).resolves.toMatchObject({ reason: "unsupported" });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("C-LOAD-08 retries a failed family on the next call", async () => {
    let healthy = false;
    const { added, deps } = stubs(() => (healthy ? "resolve" : "reject"));
    const loader = createFontLoader(deps);
    expect((await loader.load("onest")).status).toBe("failed");
    healthy = true;
    await expect(loader.load("onest")).resolves.toEqual({ id: "onest", status: "loaded" });
    expect(loader.status("onest")).toBe("loaded");
    expect(added).toHaveLength(1);
  });

  it("C-LOAD-09 throws RangeError for an unknown id and TypeError for a non-string", () => {
    const loader = createFontLoader(stubs().deps);
    expect(() => loader.load("nope")).toThrow(RangeError);
    expect(() => loader.load("nope")).toThrow(/^load:/);
    expect(() => loader.load(3 as never)).toThrow(TypeError);
    expect(() => loader.status("nope")).toThrow(RangeError);
    expect(() => loader.status(3 as never)).toThrow(TypeError);
  });

  it("C-LOAD-10 keeps two loaders apart", async () => {
    const a = stubs();
    const b = stubs();
    const first = createFontLoader(a.deps);
    const second = createFontLoader(b.deps);
    await first.load("onest");
    expect(first.status("onest")).toBe("loaded");
    expect(second.status("onest")).toBe("idle");
    expect(b.built).toHaveLength(0);
  });

  it("falls back to the browser's FontFace and document.fonts when none are injected", async () => {
    const { deps } = stubs();
    vi.stubGlobal("FontFace", deps.FontFace);
    const added: unknown[] = [];
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { add: (face: unknown) => added.push(face) },
    });
    try {
      await expect(createFontLoader({}).load("onest")).resolves.toEqual({
        id: "onest",
        status: "loaded",
      });
      expect(added).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
      Reflect.deleteProperty(document, "fonts");
    }
  });
});
