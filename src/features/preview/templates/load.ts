import type { ComponentType } from "react";
import { TEMPLATE_IDS, type TemplateId, type View } from "@/features/studio/view";
import { loadOnce } from "@/lib/load-once";
import type { DesignSpec } from "@/spec";

// The canvas's lazy templates (docs/specs/06-gallery.md, R6-33 and section 5.5). The landing
// template, the one every first load shows, stays a static import of `templates/index.tsx`; each of
// the other five loads its own chunk through one loader here, once per page and again after a
// failure (`loadOnce`). After the studio's first paint the canvas preloads them when the browser is
// idle, so a later switch finds its chunk loaded. Pure: the window and the loaders are arguments.

export type TemplateProps = { readonly spec: DesignSpec; readonly view: View };
export type TemplateModule = { readonly default: ComponentType<TemplateProps> };
export type LazyTemplateId = Exclude<TemplateId, "landing">;
/** Schedules `run` and returns its cancel. */
export type IdleScheduler = (run: () => void) => () => void;

/** One loader per lazy template, each loading that template's chunk once per page. */
export const TEMPLATE_LOADERS: Readonly<Record<LazyTemplateId, () => Promise<TemplateModule>>> =
  Object.freeze({
    dashboard: loadOnce(() => import("./Dashboard")),
    settings: loadOnce(() => import("./Settings")),
    mobile: loadOnce(() => import("./Mobile")),
    editorial: loadOnce(() => import("./Editorial")),
    "kitchen-sink": loadOnce(() => import("./KitchenSink")),
  });

/** The lazy templates, in the order of `TEMPLATE_IDS`. */
const LAZY_IDS = TEMPLATE_IDS.filter((id): id is LazyTemplateId => id !== "landing");

/** The sentences the canvas shows while a template loads, and when it could not (R6-33). */
export const TEMPLATE_LINES: Readonly<Record<"loading" | "failed" | "retry", string>> =
  Object.freeze({
    loading: "Loading the template…",
    failed: "This template could not load.",
    retry: "Try again",
  });

/** The type of `value` as an error message names it: `null` and arrays are not "object". */
function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * A scheduler on `win`: `requestIdleCallback(run, { timeout: 2000 })`, cancelled with
 * `cancelIdleCallback`, when the window has both; else `setTimeout(run, 1000)`, cancelled with
 * `clearTimeout`.
 */
export function idleScheduler(
  win: Pick<Window, "setTimeout" | "clearTimeout"> &
    Partial<Pick<Window, "requestIdleCallback" | "cancelIdleCallback">>,
): IdleScheduler {
  if (typeof win !== "object" || win === null) {
    throw new TypeError(`idleScheduler: win must be a window, got ${describeType(win)}`);
  }
  if (typeof win.setTimeout !== "function" || typeof win.clearTimeout !== "function") {
    throw new TypeError("idleScheduler: win must have setTimeout and clearTimeout");
  }
  const { requestIdleCallback, cancelIdleCallback } = win;
  if (typeof requestIdleCallback === "function" && typeof cancelIdleCallback === "function") {
    return (run) => {
      const handle = requestIdleCallback.call(win, run, { timeout: 2000 });
      return () => cancelIdleCallback.call(win, handle);
    };
  }
  return (run) => {
    const handle = win.setTimeout(run, 1000);
    return () => win.clearTimeout(handle);
  };
}

/**
 * Schedules one callback that calls the loader of each lazy template but `shown`, in the order of
 * `TEMPLATE_IDS`, and returns its cancel. A loader that fails is not called again here: the next
 * switch to its template tries it.
 */
export function preloadTemplates(
  shown: TemplateId,
  schedule: IdleScheduler,
  loaders: Readonly<Record<LazyTemplateId, () => Promise<unknown>>> = TEMPLATE_LOADERS,
): () => void {
  if (typeof shown !== "string") {
    throw new TypeError(`preloadTemplates: shown must be a string, got ${describeType(shown)}`);
  }
  if (typeof schedule !== "function") {
    throw new TypeError(
      `preloadTemplates: schedule must be a function, got ${describeType(schedule)}`,
    );
  }
  if (typeof loaders !== "object" || loaders === null || Array.isArray(loaders)) {
    throw new TypeError(
      `preloadTemplates: loaders must be an object, got ${describeType(loaders)}`,
    );
  }
  for (const id of LAZY_IDS) {
    if (typeof loaders[id] !== "function") {
      throw new TypeError(
        `preloadTemplates: loaders.${id} must be a function, got ${describeType(loaders[id])}`,
      );
    }
  }
  if (!TEMPLATE_IDS.includes(shown)) {
    throw new RangeError(
      `preloadTemplates: shown must be one of TEMPLATE_IDS, got ${JSON.stringify(shown)}`,
    );
  }
  return schedule(() => {
    for (const id of LAZY_IDS) {
      if (id !== shown) loaders[id]().catch(() => {});
    }
  });
}
