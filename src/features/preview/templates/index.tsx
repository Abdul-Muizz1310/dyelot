"use client";

import type { TemplateId, View } from "@/features/studio/view";
import type { DesignSpec } from "@/spec";
import { Dashboard } from "./Dashboard";
import { Editorial } from "./Editorial";
import { KitchenSink } from "./KitchenSink";
import { Landing } from "./Landing";
import { Pending } from "./Pending";
import { Settings } from "./Settings";

// The canvas templates (spec section 7.4): the kitchen sink (Task 2.7), the landing page and the
// editorial article (Task 2.8), the dashboard and the settings (Task 2.9); the mobile template
// arrives with Task 2.10 and shows a stand-in now.

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
  switch (view.template) {
    case "kitchen-sink":
      return <KitchenSink spec={spec} view={view} />;
    case "landing":
      return <Landing view={view} />;
    case "editorial":
      return <Editorial view={view} />;
    case "dashboard":
      return <Dashboard view={view} />;
    case "settings":
      return <Settings spec={spec} view={view} />;
    default:
      return <Pending id={view.template} label={TEMPLATE_LABELS[view.template]} />;
  }
}
