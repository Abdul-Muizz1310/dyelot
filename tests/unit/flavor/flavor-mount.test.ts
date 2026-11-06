import type { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { flavorSeed, flavorStops } from "@/engine";
import { hexToRgb, oklchToRgb, rgbToOklab } from "@/engine/color/convert";
import type { Hex } from "@/engine/color/types";
import {
  type FlavorOptions,
  flavorBackground,
  mountFlavor,
  supportsFlavor,
} from "@/flavor/flavor.mjs";
import { specId } from "@/spec";
import { defaultSpec } from "../spec/support";
import { canvasWith, createFakeGl, type FakeGl, installBrowserFakes } from "./support";

// C-FLAV-09 to C-FLAV-18 of docs/specs/05-motion-3d.md, section 14.3: the runtime's WebGL2 half
// (R5-18, R5-19, R5-21, sections 6.2 and 6.3) against the fake context and the browser fakes of
// ./support.ts. The flows run the real thing; these assert state, never frame counts or timing.

const SPEC = defaultSpec();
const STOPS = flavorStops(SPEC, "light");
const SEED = flavorSeed(specId(SPEC));
const S2 = flavorStops(SPEC, "dark");
const S3 = ["#1d4ed8", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];
const LINEAR = [0, 0, 1, 1];

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Mounts the runtime on a canvas of `gl` (null: no WebGL2) with STOPS, SEED and `options`, and
 * destroys it when the test ends, before the browser fakes go, so no listener outlives its test.
 */
function mount(options: Partial<FlavorOptions> = {}, gl: FakeGl | null = createFakeGl()) {
  const canvas = canvasWith(gl);
  const handle = mountFlavor(canvas, { stops: STOPS, seed: SEED, ...options });
  onTestFinished(() => handle.destroy());
  return { canvas, handle };
}

/** The runtime's state on `canvas`. */
const state = (canvas: HTMLCanvasElement) => canvas.getAttribute("data-flavor");

/** Each stop's channels over 255, stop after stop, as the runtime uploads them. */
function channels(stops: readonly string[]): number[] {
  return stops.flatMap((hex) =>
    [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255),
  );
}

/** Fails unless `actual` holds `expected`'s numbers, each within `tolerance`. */
function expectClose(
  actual: readonly number[] | undefined,
  expected: readonly number[],
  tolerance = 1e-6,
) {
  expect(actual).toHaveLength(expected.length);
  const gaps = expected.map((value, index) => Math.abs((actual?.[index] ?? Number.NaN) - value));
  expect(Math.max(...gaps), `${actual} against ${expected}`).toBeLessThanOrEqual(tolerance);
}

/** The engine's OKLab mix of each stop of `from` with the same stop of `to`, as sRGB channels. */
function oklabMix(from: readonly string[], to: readonly string[], amount: number): number[] {
  return from.flatMap((hex, index) => {
    const [l1, a1, b1] = rgbToOklab(hexToRgb(hex as Hex), "srgb");
    const [l2, a2, b2] = rgbToOklab(hexToRgb(to[index] as Hex), "srgb");
    const a = a1 + (a2 - a1) * amount;
    const b = b1 + (b2 - b1) * amount;
    const h = (Math.atan2(b, a) * 180) / Math.PI;
    return [...oklchToRgb({ l: l1 + (l2 - l1) * amount, c: Math.hypot(a, b), h }, "srgb")];
  });
}

/** `value` as jsdom's CSS parser writes it back for `property`. */
function cssValue(property: string, value: string): string {
  const probe = document.createElement("div");
  probe.style.setProperty(property, value);
  return probe.style.getPropertyValue(property);
}

/** Spies on every console method, silently, and returns how to read the calls made. */
function watchConsole(): () => unknown[] {
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation(() => {}),
  );
  return () => spies.flatMap((spy) => spy.mock.calls);
}

/** Runs `run` with jsdom's own error reports kept from the output, and returns them by type. */
function jsdomReports<T>(run: () => T): { result: T; reports: string[] } {
  const { virtualConsole } = (globalThis as unknown as { jsdom: { virtualConsole: EventEmitter } })
    .jsdom;
  const forwarders = virtualConsole.listeners("jsdomError") as ((error: Error) => void)[];
  const reports: string[] = [];
  const keep = (error: Error & { type?: string }) => reports.push(error.type ?? error.message);
  virtualConsole.removeAllListeners("jsdomError");
  virtualConsole.on("jsdomError", keep);
  try {
    return { result: run(), reports };
  } finally {
    virtualConsole.off("jsdomError", keep);
    for (const forward of forwarders) virtualConsole.on("jsdomError", forward);
  }
}

/** Fails unless `run` throws `kind` with a message that starts with `name` and a colon. */
function expectThrow(run: () => unknown, kind: ErrorConstructor, name: string) {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(kind);
  expect((caught as Error).message).toMatch(new RegExp(`^${name}: `));
}

/** A value of the wrong type or domain, passed where the types forbid it. */
const bad = (value: unknown) => value as never;

describe("supportsFlavor", () => {
  it("C-FLAV-09 is false in jsdom, which has no WebGL2", () => {
    const { result, reports } = jsdomReports(() => supportsFlavor());
    expect(result).toBe(false);
    expect(reports).toEqual(["not-implemented"]);
  });

  it("C-FLAV-09 is true when a canvas's getContext gives a WebGL2 context", () => {
    const gl = createFakeGl();
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(((type: string) => (type === "webgl2" ? gl : null)) as never);
    expect(supportsFlavor()).toBe(true);
    expect(getContext).toHaveBeenCalledWith("webgl2");
  });

  it("C-FLAV-09 is false, with no throw, when getContext throws", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(supportsFlavor()).toBe(false);
  });

  it("R5-21 releases the scratch context it asked for", () => {
    const gl = createFakeGl();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() => gl) as never);
    supportsFlavor();
    expect(gl.losses).toBe(1);
  });
});

describe("mountFlavor's fallbacks", () => {
  it("C-FLAV-10 falls back to the CSS gradient, quietly, when getContext gives null", () => {
    installBrowserFakes();
    const calls = watchConsole();
    const onFallback = vi.fn();
    const { canvas } = mount({ onFallback }, null);
    expect(state(canvas)).toBe("fallback");
    expect(canvas.getAttribute("data-flavor-reason")).toBe("no-webgl2");
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback).toHaveBeenCalledWith("no-webgl2");
    const { backgroundImage, backgroundColor } = flavorBackground(STOPS);
    expect(canvas.style.backgroundImage).not.toBe("");
    expect(canvas.style.backgroundImage).toBe(cssValue("background-image", backgroundImage));
    expect(canvas.style.backgroundColor).toBe(cssValue("background-color", backgroundColor));
    expect(calls()).toEqual([]);
  });

  it.each([
    ["compile", { compile: false }],
    ["link", { link: false }],
  ])("C-FLAV-11 a failed %s gives the no-webgl2 fallback, quietly", (_step, options) => {
    installBrowserFakes();
    const calls = watchConsole();
    const onFallback = vi.fn();
    const gl = createFakeGl(options);
    const { canvas } = mount({ onFallback }, gl);
    expect(state(canvas)).toBe("fallback");
    expect(canvas.getAttribute("data-flavor-reason")).toBe("no-webgl2");
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback).toHaveBeenCalledWith("no-webgl2");
    expect(gl.draws).toEqual([]);
    expect(calls()).toEqual([]);
  });
});

describe("mountFlavor's states (section 6.3)", () => {
  it("C-FLAV-12 runs while visible, each frame drawing the triangle with the stops over 255", () => {
    const fakes = installBrowserFakes();
    const gl = createFakeGl();
    const { canvas } = mount({}, gl);
    fakes.reportVisible(true);
    expect(state(canvas)).toBe("running");
    expect(canvas.getAttribute("data-flavor-reason")).toBeNull();
    const drawn = gl.draws.length;
    fakes.step(16);
    expect(gl.draws.length).toBeGreaterThan(drawn);
    expect(gl.draws.at(-1)).toEqual({ mode: gl.TRIANGLES, first: 0, count: 3 });
    expectClose(gl.uniform("u_from"), channels(STOPS));
    expectClose(gl.uniform("u_to"), channels(STOPS));
    expect(gl.uniform("u_seed")).toEqual([...SEED]);
    expect(fakes.live().frames).toBe(1);
  });

  it("C-FLAV-12 pauses with no further frame request, and runs again", () => {
    const fakes = installBrowserFakes();
    const gl = createFakeGl();
    const { canvas, handle } = mount({}, gl);
    fakes.reportVisible(true);
    handle.setPaused(true);
    expect(state(canvas)).toBe("paused");
    expect(fakes.live().frames).toBe(0);
    const drawn = gl.draws.length;
    fakes.step(16);
    expect(gl.draws).toHaveLength(drawn);
    handle.setPaused(false);
    expect(state(canvas)).toBe("running");
    expect(fakes.live().frames).toBe(1);
  });

  it("C-FLAV-12 reads hidden and offscreen, and paused before hidden", () => {
    const fakes = installBrowserFakes();
    const { canvas, handle } = mount();
    fakes.reportVisible(true);
    fakes.hide();
    expect(state(canvas)).toBe("hidden");
    expect(fakes.live().frames).toBe(0);
    fakes.show();
    expect(state(canvas)).toBe("running");
    fakes.reportVisible(false);
    expect(state(canvas)).toBe("offscreen");
    expect(fakes.live().frames).toBe(0);
    fakes.reportVisible(true);
    expect(state(canvas)).toBe("running");
    handle.setPaused(true);
    fakes.hide();
    expect(state(canvas)).toBe("paused");
    handle.setPaused(false);
    expect(state(canvas)).toBe("hidden");
  });

  it("R5-18 advances the phase with the run time, at most 0.1 s a frame, and holds it while paused", () => {
    const fakes = installBrowserFakes();
    const gl = createFakeGl();
    const { handle } = mount({}, gl);
    const phaseAt = (seconds: number) => (2 * Math.PI * seconds) / 10;
    expect(gl.uniform("u_phase")).toEqual([0]);
    fakes.step(100);
    expect(gl.uniform("u_phase")?.[0]).toBeCloseTo(phaseAt(0.1), 12);
    handle.setPaused(true);
    fakes.step(5_000);
    handle.setPaused(false);
    fakes.step(40);
    expect(gl.uniform("u_phase")?.[0]).toBeCloseTo(phaseAt(0.14), 12);
    fakes.step(3_000);
    expect(gl.uniform("u_phase")?.[0]).toBeCloseTo(phaseAt(0.24), 12);
  });

  it("C-FLAV-13 reducedMotion: true draws one still frame at phase 0 and requests none", () => {
    const fakes = installBrowserFakes();
    const gl = createFakeGl();
    const { canvas } = mount({ reducedMotion: true }, gl);
    expect(state(canvas)).toBe("still");
    expect(gl.draws).toHaveLength(1);
    expect(gl.uniform("u_phase")).toEqual([0]);
    expect(fakes.live().frames).toBe(0);
  });

  it("C-FLAV-13 follows the OS setting into still and out of it to running", () => {
    const fakes = installBrowserFakes();
    fakes.setReduced(true);
    const gl = createFakeGl();
    const { canvas } = mount({}, gl);
    expect(state(canvas)).toBe("still");
    expect(gl.draws).toHaveLength(1);
    expect(gl.uniform("u_phase")).toEqual([0]);
    expect(fakes.live().frames).toBe(0);
    fakes.setReduced(false);
    expect(state(canvas)).toBe("running");
    expect(fakes.live().frames).toBe(1);
  });

  it("C-FLAV-13 setStops while still draws once, at once, with u_mix 1", () => {
    installBrowserFakes();
    const gl = createFakeGl();
    const { handle } = mount({ reducedMotion: true }, gl);
    handle.setStops(S2);
    expect(gl.draws).toHaveLength(2);
    expect(gl.uniform("u_mix")).toEqual([1]);
    expectClose(gl.uniform("u_to"), channels(S2));
  });

  it("C-FLAV-13 (RF1) the OS turning to reduce mid-fade ends it still, at the target", () => {
    const fakes = installBrowserFakes();
    const gl = createFakeGl();
    const { canvas, handle } = mount({ fade: { durationMs: 100, easing: LINEAR } }, gl);
    handle.setStops(S2);
    fakes.step(50);
    expect(gl.uniform("u_mix")?.[0]).toBeCloseTo(0.5, 5);
    fakes.setReduced(true);
    expect(state(canvas)).toBe("still");
    expect(gl.uniform("u_mix")).toEqual([1]);
    expect(gl.uniform("u_phase")).toEqual([0]);
    expectClose(gl.uniform("u_to"), channels(S2));
    expectClose(gl.uniform("u_from"), channels(S2));
    expect(fakes.live().frames).toBe(0);
  });
});

describe("mountFlavor's cross-fade", () => {
  it("C-FLAV-14 names the new stops at once and moves u_mix by the easing", () => {
    const fakes = installBrowserFakes();
    const gl = createFakeGl();
    const { canvas, handle } = mount({ fade: { durationMs: 100, easing: LINEAR } }, gl);
    handle.setStops(S2);
    expect(canvas.getAttribute("data-flavor-stops")).toBe(S2.join(",").toLowerCase());
    fakes.step(50);
    expect(gl.uniform("u_mix")?.[0]).toBeCloseTo(0.5, 5);
    expectClose(gl.uniform("u_from"), channels(STOPS));
    expectClose(gl.uniform("u_to"), channels(S2));
    fakes.step(50);
    expect(gl.uniform("u_mix")).toEqual([1]);
  });

  it("C-FLAV-14 a third setStops mid-fade starts from the colors shown", () => {
    const fakes = installBrowserFakes();
    const gl = createFakeGl();
    const { canvas, handle } = mount({ fade: { durationMs: 100, easing: LINEAR } }, gl);
    handle.setStops(S2);
    fakes.step(50);
    handle.setStops(S3);
    expect(canvas.getAttribute("data-flavor-stops")).toBe(S3.join(","));
    fakes.step(10);
    expectClose(gl.uniform("u_from"), oklabMix(STOPS, S2, 0.5), 1e-4);
    expectClose(gl.uniform("u_to"), channels(S3));
  });

  it("R5-18 writes the target stops lowercase, joined by commas", () => {
    installBrowserFakes();
    const { canvas, handle } = mount();
    expect(canvas.getAttribute("data-flavor-stops")).toBe(STOPS.join(","));
    handle.setStops(S3.map((hex) => hex.toUpperCase()));
    expect(canvas.getAttribute("data-flavor-stops")).toBe(S3.join(","));
  });
});

describe("drawAt, autoplay and size", () => {
  it("C-FLAV-15 drawAt draws at its phase and leaves the runtime paused", () => {
    const fakes = installBrowserFakes();
    const gl = createFakeGl();
    const { canvas, handle } = mount({}, gl);
    handle.drawAt(0.25);
    expect(gl.uniform("u_phase")?.[0]).toBeCloseTo(Math.PI / 2, 12);
    expect(state(canvas)).toBe("paused");
    expect(fakes.live().frames).toBe(0);
    handle.drawAt(1);
    expect(gl.uniform("u_phase")?.[0]).toBeCloseTo(2 * Math.PI, 12);
  });

  it("C-FLAV-15 autoplay: false mounts paused with one draw at phase 0", () => {
    const fakes = installBrowserFakes();
    const gl = createFakeGl();
    const { canvas } = mount({ autoplay: false }, gl);
    expect(state(canvas)).toBe("paused");
    expect(gl.draws).toHaveLength(1);
    expect(gl.uniform("u_phase")).toEqual([0]);
    expect(fakes.live().frames).toBe(0);
  });

  it("R5-21 asks for preserveDrawingBuffer only with autoplay: false", () => {
    installBrowserFakes();
    const playing = createFakeGl();
    mount({}, playing);
    const recording = createFakeGl();
    mount({ autoplay: false }, recording);
    expect(playing.attributes).toHaveLength(1);
    expect(playing.attributes[0]).not.toHaveProperty("preserveDrawingBuffer", true);
    expect(recording.attributes[0]).toHaveProperty("preserveDrawingBuffer", true);
  });

  it("C-FLAV-15 size fixes the drawing buffer, and a resize changes nothing", () => {
    const fakes = installBrowserFakes();
    const gl = createFakeGl();
    const { canvas } = mount({ size: { width: 1280, height: 720 } }, gl);
    expect([canvas.width, canvas.height]).toEqual([1280, 720]);
    fakes.resize(800, 450);
    expect([canvas.width, canvas.height]).toEqual([1280, 720]);
    expect(gl.uniform("u_resolution")).toEqual([1280, 720]);
  });

  it("R5-18 without size, a resize sets the drawing buffer by bufferSize and redraws", () => {
    const fakes = installBrowserFakes();
    const gl = createFakeGl();
    const { canvas, handle } = mount({}, gl);
    handle.setPaused(true);
    const drawn = gl.draws.length;
    fakes.resize(800, 450);
    expect([canvas.width, canvas.height]).toEqual([800, 450]);
    expect(gl.draws.length).toBeGreaterThan(drawn);
    expect(gl.uniform("u_resolution")).toEqual([800, 450]);
  });

  it("C-FLAV-15 drawAt under still draws at its phase and stays still", () => {
    installBrowserFakes();
    const gl = createFakeGl();
    const { canvas, handle } = mount({ reducedMotion: true }, gl);
    handle.drawAt(0.25);
    expect(gl.uniform("u_phase")?.[0]).toBeCloseTo(Math.PI / 2, 12);
    expect(state(canvas)).toBe("still");
  });

  it("C-FLAV-15 after a fallback drawAt draws nothing and does not throw", () => {
    installBrowserFakes();
    const gl = createFakeGl();
    const { canvas, handle } = mount({}, gl);
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    const drawn = gl.draws.length;
    expect(() => handle.drawAt(0.5)).not.toThrow();
    expect(gl.draws).toHaveLength(drawn);
    const { handle: missing } = mount({}, null);
    expect(() => missing.drawAt(0.5)).not.toThrow();
  });
});

describe("a lost context and destroy", () => {
  it("C-FLAV-16 a lost context is prevented, falls back once and stops the frames", () => {
    const fakes = installBrowserFakes();
    const calls = watchConsole();
    const onFallback = vi.fn();
    const gl = createFakeGl();
    const { canvas } = mount({ onFallback }, gl);
    const lost = new Event("webglcontextlost", { cancelable: true });
    canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(state(canvas)).toBe("fallback");
    expect(canvas.getAttribute("data-flavor-reason")).toBe("context-lost");
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(onFallback).toHaveBeenCalledWith("context-lost");
    expect(fakes.live().frames).toBe(0);
    expect(canvas.style.backgroundImage).toBe(
      cssValue("background-image", flavorBackground(STOPS).backgroundImage),
    );
    const drawn = gl.draws.length;
    canvas.dispatchEvent(new Event("webglcontextrestored"));
    fakes.step(16);
    expect(state(canvas)).toBe("fallback");
    expect(onFallback).toHaveBeenCalledTimes(1);
    expect(fakes.live().frames).toBe(0);
    expect(gl.draws).toHaveLength(drawn);
    expect(calls()).toEqual([]);
  });

  it("C-FLAV-17 destroy stops the frames, the observers and the listeners, and loses the context", () => {
    const fakes = installBrowserFakes();
    const gl = createFakeGl();
    const onFallback = vi.fn();
    const { canvas, handle } = mount({ onFallback }, gl);
    expect(fakes.live()).toEqual({
      frames: 1,
      intersection: 1,
      resize: 1,
      visibility: 1,
      motion: 1,
    });
    handle.destroy();
    expect(fakes.live()).toEqual({
      frames: 0,
      intersection: 0,
      resize: 0,
      visibility: 0,
      motion: 0,
    });
    expect(gl.losses).toBe(1);
    for (const name of ["data-flavor", "data-flavor-reason", "data-flavor-stops"]) {
      expect(canvas.hasAttribute(name), name).toBe(false);
    }
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("C-FLAV-17 destroy removes the reason of a fallback too", () => {
    installBrowserFakes();
    const { canvas, handle } = mount({}, null);
    expect(canvas.getAttribute("data-flavor-reason")).toBe("no-webgl2");
    handle.destroy();
    for (const name of ["data-flavor", "data-flavor-reason", "data-flavor-stops"]) {
      expect(canvas.hasAttribute(name), name).toBe(false);
    }
  });

  it("C-FLAV-17 a second destroy and a setStops after it do nothing and do not throw", () => {
    installBrowserFakes();
    const gl = createFakeGl();
    const { canvas, handle } = mount({ reducedMotion: true }, gl);
    handle.destroy();
    const drawn = gl.draws.length;
    expect(() => handle.destroy()).not.toThrow();
    expect(() => handle.setStops(S2)).not.toThrow();
    expect(gl.draws).toHaveLength(drawn);
    expect(gl.losses).toBe(1);
    expect(canvas.hasAttribute("data-flavor-stops")).toBe(false);
  });
});

describe("argument checks (R-05)", () => {
  it("C-FLAV-18 refuses a canvas or options of the wrong type", () => {
    installBrowserFakes();
    const canvas = canvasWith(createFakeGl());
    expectThrow(
      () => mountFlavor(bad(null), { stops: STOPS, seed: SEED }),
      TypeError,
      "mountFlavor",
    );
    expectThrow(() => mountFlavor(canvas, bad(null)), TypeError, "mountFlavor");
  });

  it.each<[string, Partial<FlavorOptions> & Record<string, unknown>]>([
    ["4 stops", { stops: STOPS.slice(0, 4) }],
    ["a stop #ggg000", { stops: ["#ggg000", ...STOPS.slice(1)] }],
    ["a seed of one number", { seed: [1] }],
    ["fade.durationMs -1", { fade: { durationMs: -1, easing: LINEAR } }],
    ["a size 1 x 720", { size: { width: 1, height: 720 } }],
    ["a size 4097 wide", { size: { width: 4097, height: 720 } }],
    ["an option loop", { loop: true }],
  ])("C-FLAV-18 refuses %s with a RangeError", (_case, options) => {
    installBrowserFakes();
    const canvas = canvasWith(createFakeGl());
    expectThrow(
      () => mountFlavor(canvas, { stops: STOPS, seed: SEED, ...options }),
      RangeError,
      "mountFlavor",
    );
  });

  it.each<[string, Record<string, unknown>]>([
    ["seed: ['1', 2]", { seed: ["1", 2] }],
    ["reducedMotion: 'yes'", { reducedMotion: "yes" }],
    ["onFallback: 5", { onFallback: 5 }],
  ])("C-FLAV-18 refuses %s with a TypeError", (_case, options) => {
    installBrowserFakes();
    const canvas = canvasWith(createFakeGl());
    expectThrow(
      () => mountFlavor(canvas, bad({ stops: STOPS, seed: SEED, ...options })),
      TypeError,
      "mountFlavor",
    );
  });

  it("C-FLAV-18 checks every type before any domain", () => {
    installBrowserFakes();
    const canvas = canvasWith(createFakeGl());
    expectThrow(
      () => mountFlavor(canvas, bad({ stops: ["#000000"], seed: "x" })),
      TypeError,
      "mountFlavor",
    );
    expectThrow(
      () => mountFlavor(canvas, bad({ stops: STOPS, seed: SEED, loop: 1, autoplay: "no" })),
      TypeError,
      "mountFlavor",
    );
  });

  it("C-FLAV-18 the handle's methods check their arguments, each naming itself", () => {
    installBrowserFakes();
    const { handle } = mount();
    expectThrow(() => handle.setStops(["#000000"]), RangeError, "setStops");
    expectThrow(() => handle.drawAt(1.5), RangeError, "drawAt");
    expectThrow(() => handle.setPaused(bad("no")), TypeError, "setPaused");
  });
});
