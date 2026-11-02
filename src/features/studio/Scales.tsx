import { memo } from "react";
import { type Mode, PALETTE_NAMES, type PaletteName, type Step } from "@/engine";
import type { DesignSpec } from "@/spec";
import { PanelSection } from "./PanelSection";
import type { Highlight } from "./view";

// The Scales section of the inspector (spec section 7.8): the 8 palettes, two to a row, each as its
// 11 steps for the canvas's mode, one step per line: the number, a swatch, the hex and the WCAG ratio
// against the page. The swatch is data (`data-swatch`), the only color here. A step "show me" picks
// carries `data-show-me-cell`, which highlight.css outlines.

type Palette = DesignSpec["color"]["palettes"][PaletteName];

export const Scales = memo(function Scales({
  spec,
  mode,
  cells,
}: {
  spec: DesignSpec;
  mode: Mode;
  cells: Highlight["cells"];
}) {
  return (
    <PanelSection
      first
      title="Scales"
      note={`The ${mode} steps, each with its contrast against the page.`}
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        {PALETTE_NAMES.map((name) => (
          <PaletteSteps
            key={name}
            palette={spec.color.palettes[name]}
            mode={mode}
            lit={cells.filter((cell) => cell.palette === name).map((cell) => cell.step)}
          />
        ))}
      </div>
    </PanelSection>
  );
});

function PaletteSteps({
  palette,
  mode,
  lit,
}: {
  palette: Palette;
  mode: Mode;
  lit: readonly Step[];
}) {
  const seed = palette.seedStep?.[mode];
  const deviation = palette.seedDeviation;
  return (
    <div data-palette={palette.name} className="min-w-0">
      <h4 className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
        <span className="text-foreground">{palette.name}</span>
        {seed !== undefined && <span className="text-fg-muted">seed {seed}</span>}
      </h4>
      {deviation !== undefined && (
        <p
          data-seed-deviation=""
          className="mt-0.5 font-mono text-[11px] text-fg-muted leading-snug"
        >
          Seed moved ΔE {deviation.deltaEOK.toFixed(3)} at step {deviation.step}
        </p>
      )}
      <ol className="mt-1.5">
        {palette[mode].map((step) => {
          const isSeed = step.step === seed;
          return (
            <li
              key={step.step}
              data-step={step.step}
              data-seed={isSeed ? "" : undefined}
              data-show-me-cell={lit.includes(step.step) ? "" : undefined}
              className="grid grid-cols-[1.75rem_0.75rem_minmax(0,1fr)_auto] items-center gap-x-1 rounded-[3px] font-mono text-[11px] tabular-nums leading-5"
            >
              <span data-step-number="" className="text-fg-muted">
                {step.step}
              </span>
              <span
                data-swatch=""
                aria-hidden="true"
                className={`size-3 rounded-[2px] ${isSeed ? "shadow-[0_0_0_1px_var(--page),0_0_0_2px_var(--foreground)]" : ""}`}
                style={{ backgroundColor: step.hex }}
              />
              <span data-hex="" translate="no" className="truncate text-foreground">
                {step.hex}
              </span>
              <span data-ratio="" className="text-right text-fg-muted">
                {step.contrast.toFixed(2)}
              </span>
              {isSeed && <span className="sr-only"> seed</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
