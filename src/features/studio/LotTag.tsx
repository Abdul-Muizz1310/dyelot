"use client";

import { useMemo } from "react";
import { specId } from "@/spec";
import { lotTag } from "./lot";
import { type StudioStore, useStudio } from "./store";

// The dye-lot tag of the header (spec section 7.1): `LOT` and the first eight hex digits of the spec
// id, in Geist Mono, beside the primary scale of the current mode as 11 swatches. The id names the
// design exactly, as a lot number names one dye bath.

export function LotTag({ store }: { store: StudioStore }) {
  const spec = useStudio(store, (studio) => studio.spec);
  const mode = useStudio(store, (studio) => studio.view.mode);
  const id = useMemo(() => lotTag(specId(spec)), [spec]);
  const scale = spec.color.palettes.primary[mode];
  return (
    <div className="flex items-center gap-3 sm:ml-auto">
      <p
        data-lot=""
        className="inline-flex items-baseline gap-2 rounded-sm border border-border-bright px-2 py-1 font-mono text-xs tabular-nums"
      >
        <span className="text-fg-muted tracking-[0.14em]">LOT</span>{" "}
        <span data-lot-id="" className="text-foreground">
          {id}
        </span>
      </p>
      <fieldset
        aria-label="Primary scale, 11 steps"
        className="m-0 flex min-w-0 overflow-hidden rounded-sm border border-border-bright p-0"
      >
        {scale.map((step) => (
          <span
            key={step.step}
            data-swatch=""
            title={`${step.step} ${step.hex}`}
            style={{ backgroundColor: step.hex }}
            className="h-5 w-3"
          />
        ))}
      </fieldset>
    </div>
  );
}
