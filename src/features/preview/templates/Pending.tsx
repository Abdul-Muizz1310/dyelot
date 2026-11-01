import type { CSSProperties } from "react";
import type { TemplateId } from "@/features/studio/view";

// A stand-in for the templates that arrive with Tasks 2.8 to 2.10 (landing, dashboard, settings,
// mobile and editorial): a short sample page that reads only the spec's variables, so every input
// shows on the canvas and the frame is never blank.

const text = (step: string): CSSProperties => ({
  fontSize: `var(--text-${step})`,
  lineHeight: `var(--leading-${step})`,
  letterSpacing: `var(--tracking-${step})`,
});

const chip = (fill: string, ink: string): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  height: "var(--control-height)",
  paddingInline: "var(--space-4)",
  borderRadius: "var(--radius-md)",
  backgroundColor: `var(--${fill})`,
  color: `var(--${ink})`,
  ...text("label"),
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
        style={{
          ...text("caption"),
          color: "var(--muted-foreground)",
          fontFamily: "var(--font-mono)",
        }}
      >
        sample · {label}
      </p>
      <div style={{ display: "grid", gap: "var(--space-3)", maxWidth: "36rem" }}>
        <h2 style={{ ...text("h1"), fontFamily: "var(--font-display)", fontWeight: 600 }}>
          Read the tide before you set out.
        </h2>
        <p style={{ ...text("lead"), color: "var(--muted-foreground)" }}>
          A sample page set in this design: its colors, type, radius, shadow and density.
        </p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <span style={chip("primary", "primary-foreground")}>Primary action</span>
        <span style={chip("secondary", "secondary-foreground")}>Secondary</span>
        <span style={chip("accent", "accent-foreground")}>Accent</span>
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
        <h3 style={{ ...text("h4"), fontFamily: "var(--font-display)", fontWeight: 600 }}>
          Saltmarsh tide table
        </h3>
        <dl style={{ marginTop: "var(--space-4)", display: "grid", gap: "var(--space-2)" }}>
          {TIDES.map(([event, time, height]) => (
            <div
              key={time}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "var(--space-4)",
                ...text("body-sm"),
              }}
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
