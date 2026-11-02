"use client";

import type { TemplateId, View } from "@/features/studio/view";
import type { DesignSpec } from "@/spec";
import { Dashboard } from "./Dashboard";
import { Editorial } from "./Editorial";
import { KitchenSink } from "./KitchenSink";
import { Landing } from "./Landing";
import { Mobile } from "./Mobile";
import { Settings } from "./Settings";

// The canvas templates (spec section 7.4): the kitchen sink (Task 2.7), the landing page and the
// editorial article (Task 2.8), the dashboard and the settings (Task 2.9), and the mobile template
// (Task 2.10a).

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
    case "mobile":
      return <Mobile view={view} />;
    default: {
      const unknown: never = view.template;
      throw new RangeError(`Template: no template ${JSON.stringify(unknown)}`);
    }
  }
}
