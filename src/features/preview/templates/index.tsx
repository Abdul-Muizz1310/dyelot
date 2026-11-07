"use client";

import { type ComponentType, type LazyExoticComponent, lazy } from "react";
import type { TemplateId } from "@/features/studio/view";
import { Landing } from "./Landing";
import { type LazyTemplateId, TEMPLATE_LOADERS, type TemplateProps } from "./load";

// The canvas templates (spec section 7.4): the kitchen sink (Task 2.7), the landing page and the
// editorial article (Task 2.8), the dashboard and the settings (Task 2.9), and the mobile template
// (Task 2.10a). The landing template, the one every first load shows, is a static import; the other
// five load on demand through `React.lazy` of their loaders (docs/specs/06-gallery.md, R6-33, 13.3).

/** The template switcher's labels, in the order of `TEMPLATE_IDS`. */
export const TEMPLATE_LABELS: Readonly<Record<TemplateId, string>> = Object.freeze({
  landing: "landing",
  dashboard: "dashboard",
  settings: "settings",
  mobile: "mobile",
  editorial: "editorial",
  "kitchen-sink": "kitchen sink",
});

/**
 * The templates whose screens keep their own width whatever the frame switcher holds, with the note the
 * disabled switcher shows (F-TPL-32): the mobile template draws three 360 px screens.
 */
export const FIXED_FRAMES: Readonly<Partial<Record<TemplateId, string>>> = Object.freeze({
  mobile: "Three 360 px screens",
});

/** One lazy component per lazy template, made on first use and again after "Try again". */
const lazies = new Map<LazyTemplateId, LazyExoticComponent<ComponentType<TemplateProps>>>();

/** Forgets the lazy component of `id`, whose load failed, so the next render makes a new one. */
export function forgetTemplate(id: LazyTemplateId): void {
  lazies.delete(id);
}

function lazyTemplate(id: LazyTemplateId): LazyExoticComponent<ComponentType<TemplateProps>> {
  const kept = lazies.get(id);
  if (kept !== undefined) return kept;
  const load = TEMPLATE_LOADERS[id];
  if (load === undefined) throw new RangeError(`Template: no template ${JSON.stringify(id)}`);
  const made = lazy(load);
  lazies.set(id, made);
  return made;
}

function LazyTemplate({ id, spec, view }: TemplateProps & { id: LazyTemplateId }) {
  const Shown = lazyTemplate(id);
  return <Shown spec={spec} view={view} />;
}

export function Template({ spec, view }: TemplateProps) {
  if (view.template === "landing") return <Landing view={view} />;
  return <LazyTemplate id={view.template} spec={spec} view={view} />;
}
