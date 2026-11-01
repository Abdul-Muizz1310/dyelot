"use client";

import { type CSSProperties, useMemo } from "react";
import { densityVars, type ThemeVars, themeVars } from "@/theme/vars";
import { type StudioStore, useStudio } from "./store";

// The canvas frame (spec section 7.4, R2-18): `[data-canvas]` carries the theme bridge's variables
// for the current spec, mode and vision, with `cqi` units, and the density's two variables. Until
// the preview kit and templates arrive (Tasks 2.7 to 2.10) it holds a small specimen that reads
// only those variables, so every input shows on the canvas and the frame is never blank.

const isCustomProperty = (name: string): name is `--${string}` => name.startsWith("--");

/** The variables as a React style object; a name that is not a custom property is a bug. */
function cssVariables(...groups: readonly ThemeVars[]): CSSProperties {
  const style: CSSProperties = {};
  for (const group of groups) {
    for (const [name, value] of Object.entries(group)) {
      if (!isCustomProperty(name)) {
        throw new RangeError(`cssVariables: ${JSON.stringify(name)} is not a custom property`);
      }
      style[name] = value;
    }
  }
  return style;
}

export function CanvasFrame({ store }: { store: StudioStore }) {
  const spec = useStudio(store, (studio) => studio.spec);
  const mode = useStudio(store, (studio) => studio.view.mode);
  const density = useStudio(store, (studio) => studio.view.density);
  const vision = useStudio(store, (studio) => studio.view.vision);
  const style = useMemo(
    () =>
      cssVariables(
        themeVars(spec, mode, vision === "none" ? { units: "cqi" } : { vision, units: "cqi" }),
        densityVars(density),
      ),
    [spec, mode, density, vision],
  );
  return (
    <div
      data-canvas=""
      data-mode={mode}
      data-density={density}
      style={style}
      className="mx-auto w-full max-w-[1280px] overflow-hidden rounded-xl"
    >
      <Specimen />
    </div>
  );
}

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

/** A sample page in the spec's own colors, type, radius, shadow and density. */
function Specimen() {
  return (
    <div style={{ padding: "var(--space-8)", display: "grid", gap: "var(--space-6)" }}>
      <p
        style={{
          ...text("caption"),
          color: "var(--muted-foreground)",
          fontFamily: "var(--font-mono)",
        }}
      >
        sample · specimen
      </p>
      <div style={{ display: "grid", gap: "var(--space-3)", maxWidth: "36rem" }}>
        <h2 style={{ ...text("h1"), fontFamily: "var(--font-display)", fontWeight: 600 }}>
          Read the tide before you set out.
        </h2>
        <p style={{ ...text("lead"), color: "var(--muted-foreground)" }}>
          A sample page set in the design on the left: its colors, type, radius, shadow and density.
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
              <dd style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
                {time} · {height}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
