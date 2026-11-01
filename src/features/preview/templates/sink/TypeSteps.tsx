import type { CanvasCopy } from "../../copy";
import { Section } from "./Section";

// The type steps of a pane (F-TPL-01), largest first, each at a reading measure.

const TYPE_ORDER = [
  "display",
  "h1",
  "h2",
  "h3",
  "h4",
  "lead",
  "body",
  "body-sm",
  "label",
  "caption",
];
const HEADINGS = new Set(["display", "h1", "h2", "h3", "h4"]);

export function TypeSteps({
  vars,
  copy,
}: {
  vars: Readonly<Record<string, string>>;
  copy: CanvasCopy;
}) {
  const samples: Readonly<Record<string, string>> = {
    display: "Read the water",
    h1: "Tides of the eastern marsh",
    h2: "Spring and neap",
    h3: copy.title,
    h4: "Gauge readings",
    lead: "Sample: a tide table for the saltmarsh, set in this design's type.",
    body: `Sample: the flood fills the ${copy.word} an hour before high water, and the marsh drains slowly on the ebb.`,
    "body-sm": "Sample: readings in meters above chart datum.",
    label: "Save reading",
    caption: "Updated 06:42 · gauge 3 of 4",
  };
  return (
    <Section title="Type" note="The ten steps of the scale, largest first, with size and leading.">
      <div className="sink-type">
        {TYPE_ORDER.map((step) => {
          const size = vars[`--text-${step}`] ?? "";
          return (
            <div key={step} className="sink-type-row">
              <p className="kit-mono kit-t-caption sink-type-meta">
                <span>{step}</span>
                <span>
                  {size.startsWith("clamp") ? "fluid" : size} / {vars[`--leading-${step}`]}
                </span>
              </p>
              <p
                data-token={`text-${step}`}
                data-roles={HEADINGS.has(step) ? "font-display" : "font-body"}
                className={`kit-t-${step}${HEADINGS.has(step) ? " kit-display" : ""}`}
              >
                {samples[step]}
              </p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
