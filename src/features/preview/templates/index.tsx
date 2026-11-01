"use client";

import type { TemplateId, View } from "@/features/studio/view";
import type { DesignSpec } from "@/spec";
import { KitchenSink } from "./KitchenSink";
import { Pending } from "./Pending";

// The canvas templates (spec section 7.4): the kitchen sink arrives with Task 2.7; landing,
// dashboard, settings, mobile and editorial arrive with Tasks 2.8 to 2.10 and show a stand-in now.

/** The template switcher's labels, in the order of `TEMPLATE_IDS`. */
export const TEMPLATE_LABELS: Readonly<Record<TemplateId, string>> = Object.freeze({
  landing: "landing",
  dashboard: "dashboard",
  settings: "settings",
  mobile: "mobile",
  editorial: "editorial",
  "kitchen-sink": "kitchen sink",
});

export function Template({ spec, view }: { spec: DesignSpec; view: View }) {
  if (view.template === "kitchen-sink") return <KitchenSink spec={spec} view={view} />;
  return <Pending id={view.template} label={TEMPLATE_LABELS[view.template]} />;
}
