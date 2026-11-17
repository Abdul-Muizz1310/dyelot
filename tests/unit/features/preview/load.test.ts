import { afterEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/features/preview/templates/Dashboard";
import { Editorial } from "@/features/preview/templates/Editorial";
import { KitchenSink } from "@/features/preview/templates/KitchenSink";
import {
  idleScheduler,
  type LazyTemplateId,
  preloadTemplates,
  TEMPLATE_LINES,
  TEMPLATE_LOADERS,
} from "@/features/preview/templates/load";
import { Mobile } from "@/features/preview/templates/Mobile";
import { Settings } from "@/features/preview/templates/Settings";
import { TEMPLATE_IDS } from "@/features/studio/view";

// The canvas's lazy templates (docs/specs/06-gallery.md, R6-33 and section 5.5): C-TPL6-01 to 04.

/** The lazy templates, in the order of `TEMPLATE_IDS`. */
const LAZY = TEMPLATE_IDS.filter((id): id is LazyTemplateId => id !== "landing");

/** Fake loaders that record each call, in order; `failing` rejects. */
function fakeLoaders(failing?: LazyTemplateId) {
  const calls: LazyTemplateId[] = [];
  const loaders = Object.fromEntries(
    LAZY.map((id) => [
      id,
      vi.fn(() => {
        calls.push(id);
        return id === failing
          ? Promise.reject(new Error(`${id} did not load`))
          : Promise.resolve({});
      }),
    ]),
  ) as unknown as Record<LazyTemplateId, () => Promise<unknown>>;
  return { calls, loaders };
}

/** A fake idle scheduler: `flush()` runs every callback still scheduled. */
function fakeScheduler() {
  const queue = new Set<() => void>();
  const schedule = vi.fn((run: () => void) => {
    queue.add(run);
    return () => {
      queue.delete(run);
    };
  });
  return {
    schedule,
    flush() {
      for (const run of [...queue]) {
        queue.delete(run);
        run();
      }
    },
  };
}

/** Lets every settled promise run its handlers. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("TEMPLATE_LOADERS", () => {
  it("C-TPL6-01 has the five lazy templates, frozen, each loading its template's component", async () => {
    expect(Object.keys(TEMPLATE_LOADERS)).toEqual(TEMPLATE_IDS.filter((id) => id !== "landing"));
    expect(Object.isFrozen(TEMPLATE_LOADERS)).toBe(true);
    const components = {
      dashboard: Dashboard,
      settings: Settings,
      mobile: Mobile,
      editorial: Editorial,
      "kitchen-sink": KitchenSink,
    };
    for (const id of LAZY) {
      expect((await TEMPLATE_LOADERS[id]()).default).toBe(components[id]);
    }
  });
});

describe("preloadTemplates", () => {
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown) => rejections.push(reason);

  afterEach(() => {
    process.off("unhandledRejection", onRejection);
    rejections.length = 0;
  });

  it("C-TPL6-02 calls no loader until the idle callback runs, then the five in order, once each", () => {
    const { calls, loaders } = fakeLoaders();
    const scheduler = fakeScheduler();
    preloadTemplates("landing", scheduler.schedule, loaders);
    expect(scheduler.schedule).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([]);
    scheduler.flush();
    expect(calls).toEqual(LAZY);
    for (const id of LAZY) expect(loaders[id]).toHaveBeenCalledTimes(1);
  });

  it("C-TPL6-02 leaves out the template shown", () => {
    const { calls, loaders } = fakeLoaders();
    const scheduler = fakeScheduler();
    preloadTemplates("dashboard", scheduler.schedule, loaders);
    scheduler.flush();
    expect(calls).toEqual(["settings", "mobile", "editorial", "kitchen-sink"]);
  });

  it("C-TPL6-02 calls no loader once its cancel ran before the idle callback", () => {
    const { calls, loaders } = fakeLoaders();
    const scheduler = fakeScheduler();
    const cancel = preloadTemplates("landing", scheduler.schedule, loaders);
    expect(scheduler.schedule).toHaveBeenCalledTimes(1);
    cancel();
    scheduler.flush();
    expect(calls).toEqual([]);
  });

  it("C-TPL6-02 calls a loader that rejects once, and leaves no unhandled rejection", async () => {
    process.on("unhandledRejection", onRejection);
    const { calls, loaders } = fakeLoaders("settings");
    const scheduler = fakeScheduler();
    preloadTemplates("landing", scheduler.schedule, loaders);
    scheduler.flush();
    await settle();
    await settle();
    expect(calls).toEqual(LAZY);
    expect(loaders.settings).toHaveBeenCalledTimes(1);
    expect(rejections).toEqual([]);
  });

  it("C-TPL6-04 throws a RangeError for a template outside TEMPLATE_IDS, naming preloadTemplates", () => {
    const { schedule } = fakeScheduler();
    expect(() => preloadTemplates("nope" as never, schedule)).toThrow(RangeError);
    expect(() => preloadTemplates("nope" as never, schedule)).toThrow(/^preloadTemplates/);
  });

  it("C-TPL6-04 throws a TypeError for a wrong type, before any value's domain", () => {
    const { schedule } = fakeScheduler();
    expect(() => preloadTemplates("landing", 3 as never)).toThrow(TypeError);
    expect(() => preloadTemplates("landing", 3 as never)).toThrow(/^preloadTemplates/);
    expect(() => preloadTemplates(3 as never, schedule)).toThrow(TypeError);
    expect(() => preloadTemplates("nope" as never, 3 as never)).toThrow(TypeError);
    for (const loaders of [null, [], { dashboard: () => Promise.resolve({}) }]) {
      expect(() => preloadTemplates("landing", schedule, loaders as never)).toThrow(TypeError);
      expect(() => preloadTemplates("landing", schedule, loaders as never)).toThrow(
        /^preloadTemplates/,
      );
    }
    expect(schedule).not.toHaveBeenCalled();
  });
});

describe("idleScheduler", () => {
  /** A fake window: the timers always, the idle callbacks when `idle` is set. */
  function fakeWindow(idle: { request: boolean; cancel: boolean }) {
    return {
      setTimeout: vi.fn(() => 11),
      clearTimeout: vi.fn(),
      ...(idle.request ? { requestIdleCallback: vi.fn(() => 7) } : {}),
      ...(idle.cancel ? { cancelIdleCallback: vi.fn() } : {}),
    };
  }

  it("C-TPL6-03 schedules with requestIdleCallback and a 2,000 ms timeout, and cancels with cancelIdleCallback", () => {
    const win = fakeWindow({ request: true, cancel: true });
    const run = () => {};
    const cancel = idleScheduler(win as never)(run);
    expect(win.requestIdleCallback).toHaveBeenCalledWith(run, { timeout: 2000 });
    expect(win.setTimeout).not.toHaveBeenCalled();
    expect(win.cancelIdleCallback).not.toHaveBeenCalled();
    cancel();
    expect(win.cancelIdleCallback).toHaveBeenCalledWith(7);
    expect(win.clearTimeout).not.toHaveBeenCalled();
  });

  it("C-TPL6-03 without the idle callbacks, schedules with a 1,000 ms setTimeout and cancels with clearTimeout", () => {
    for (const idle of [
      { request: false, cancel: false },
      { request: true, cancel: false },
    ]) {
      const win = fakeWindow(idle);
      const run = () => {};
      const cancel = idleScheduler(win as never)(run);
      expect(win.setTimeout).toHaveBeenCalledWith(run, 1000);
      expect(win.requestIdleCallback ?? vi.fn()).not.toHaveBeenCalled();
      cancel();
      expect(win.clearTimeout).toHaveBeenCalledWith(11);
    }
  });

  it("C-TPL6-04 throws a TypeError naming idleScheduler for a value that is not a window", () => {
    for (const win of [null, undefined, 3, "window", {}, { setTimeout: () => 1 }]) {
      expect(() => idleScheduler(win as never)).toThrow(TypeError);
      expect(() => idleScheduler(win as never)).toThrow(/^idleScheduler/);
    }
  });
});

describe("TEMPLATE_LINES", () => {
  it("C-TPL6-04 holds R6-33's three strings, frozen", () => {
    expect(TEMPLATE_LINES).toEqual({
      loading: "Loading the template…",
      failed: "This template could not load.",
      retry: "Try again",
    });
    expect(Object.isFrozen(TEMPLATE_LINES)).toBe(true);
  });
});
