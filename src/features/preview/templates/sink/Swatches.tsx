"use client";

import { useMemo } from "react";
import type { Mode } from "@/engine";
import type { DesignSpec } from "@/spec";
import { swatches } from "../../swatches";
import { Section } from "./Section";

// The color roles of a pane (F-TPL-01, F-TPL-02): every role with its stored hex and, for a text
// role, its WCAG ratio on the fill it sits on.

export function Swatches({ spec, mode }: { spec: DesignSpec; mode: Mode }) {
  const rows = useMemo(() => swatches(spec, mode), [spec, mode]);
  return (
    <Section
      title="Color roles"
      note="All 46 roles with their stored hex. A text role shows its WCAG ratio on the fill it sits on."
    >
      <ul className="sink-swatches">
        {rows.map(({ role, hex, pair }) => (
          <li
            key={role}
            className="sink-swatch"
            data-swatch={role}
            data-roles={pair === null ? role : `${role} ${pair.fill}`}
          >
            <span
              aria-hidden="true"
              className="sink-chip"
              style={
                pair === null
                  ? { backgroundColor: `var(--${role})` }
                  : { backgroundColor: `var(--${pair.fill})`, color: `var(--${role})` }
              }
            >
              {pair === null ? null : "Aa"}
            </span>
            <span className="kit-mono kit-t-caption">{role}</span>
            <span className="kit-mono kit-t-caption sink-muted" data-hex="">
              {hex}
            </span>
            {pair !== null && (
              <span className="kit-mono kit-t-caption sink-muted">
                <span data-ratio="">{pair.ratio.toFixed(2)}</span>:1 on {pair.fill}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}
