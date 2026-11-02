import type { CSSProperties } from "react";
import type { RoleName } from "@/engine";
import type { TemplateId } from "@/features/studio/view";
import { roleVar } from "../vars";

// A stand-in for the template that arrives with Task 2.10 (mobile): a short sample page that reads
// only the spec's variables, so every input shows on the canvas and the frame is never blank. Type
// comes from the `.kit-t-<step>` classes.

const chip = (fill: RoleName, ink: RoleName): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  height: "var(--control-height)",
  paddingInline: "var(--space-4)",
  borderRadius: "var(--radius-md)",
  backgroundColor: roleVar(fill),
  color: roleVar(ink),
});

const TIDES = [
  ["High water", "06:42", "4.1 m"],
  ["Low water", "12:58", "0.6 m"],
  ["High water", "19:11", "4.3 m"],
] as const;

export function Pending({ id, label }: { id: TemplateId; label: string }) {
  return (
    <div
      data-template-root={id}
      style={{ padding: "var(--space-8)", display: "grid", gap: "var(--space-6)" }}
    >
      <p
        className="kit-t-caption"
        style={{ color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
      >
        sample · {label}
      </p>
      <div style={{ display: "grid", gap: "var(--space-3)", maxWidth: "36rem" }}>
        <h2 className="kit-t-h1" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
          Read the tide before you set out.
        </h2>
        <p className="kit-t-lead" style={{ color: "var(--muted-foreground)" }}>
          A sample page set in this design: its colors, type, radius, shadow and density.
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <span className="kit-t-label" style={chip("primary", "primary-foreground")}>
          Primary action
        </span>
        <span className="kit-t-label" style={chip("secondary", "secondary-foreground")}>
          Secondary
        </span>
        <span className="kit-t-label" style={chip("accent", "accent-foreground")}>
          Accent
        </span>
      </div>
      <div
        style={{
          maxWidth: "28rem",
          padding: "var(--space-6)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border)",
          backgroundColor: "var(--card)",
          color: "var(--card-foreground)",
          boxShadow: "var(--shadow-2)",
        }}
      >
        <h3 className="kit-t-h4" style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>
          Saltmarsh tide table
        </h3>
        <dl
          className="kit-t-body-sm"
          style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-2)" }}
        >
          {TIDES.map(([event, time, height]) => (
            <div
              key={time}
              style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)" }}
            >
              <dt>{event}</dt>
              <dd style={{ fontFamily: "var(--font-mono)" }}>
                {time} · {height}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
