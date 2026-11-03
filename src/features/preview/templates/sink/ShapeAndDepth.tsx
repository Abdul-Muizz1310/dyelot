import type { CanvasCopy } from "../../copy";
import { Card, Segmented } from "../../kit";
import { Section } from "./Section";

// The radii, the elevations and the concentric shapes of a pane (F-TPL-01, F-TPL-08).

const RADII = ["sm", "md", "lg", "xl", "2xl", "full"] as const;
const ELEVATIONS = [1, 2, 3, 4, 5] as const;

export function ShapeAndDepth({
  vars,
  copy,
}: {
  vars: Readonly<Record<string, string>>;
  copy: CanvasCopy;
}) {
  return (
    <Section
      title="Radius and depth"
      note="Six radii and five elevations. A nested shape keeps one center: the inner radius is the outer radius minus the padding."
    >
      <div className="sink-tiles">
        {RADII.map((name) => (
          <figure key={name} className="sink-tile">
            <span
              data-token={`radius-${name}`}
              className="sink-radius"
              style={{ borderRadius: `var(--radius-${name})` }}
            />
            <figcaption className="kit-mono kit-t-caption">
              {name} · {vars[`--radius-${name}`]}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="sink-tiles">
        {ELEVATIONS.map((level) => (
          <figure key={level} className="sink-tile">
            <span
              data-token={`shadow-${level}`}
              className="sink-shadow"
              style={{ boxShadow: `var(--shadow-${level})` }}
            />
            <figcaption className="kit-mono kit-t-caption">shadow {level}</figcaption>
          </figure>
        ))}
      </div>
      <div className="sink-concentric">
        <Card title={copy.title} meta="Sample · four readings today" />
        <Segmented legend="Tide range" options={["Neap", "Mean", "Spring"]} />
      </div>
    </Section>
  );
}
