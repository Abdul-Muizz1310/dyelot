"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { type NameIndex, nearestName } from "@/engine";
import type { DesignSpec } from "@/spec";
import { nameTargets } from "./inspect";
import { loadNames } from "./names";
import { PanelSection } from "./PanelSection";

// The Names section of the inspector (spec section 7.8, R2-11): the nearest name of the 13 colors of
// `nameTargets`. The list loads the first time the section shows on screen, after first paint: an
// IntersectionObserver on the viewport, which a closed drawer and the scroll area's clip keep out.
// Until it arrives the section says so; a failed load says the names are unavailable (I-M2-03).

type Names =
  | { readonly phase: "waiting" | "loading" | "failed" }
  | { readonly phase: "ready"; readonly index: NameIndex };

export const NamesSection = memo(function NamesSection({ spec }: { spec: DesignSpec }) {
  const section = useRef<HTMLElement>(null);
  const [names, setNames] = useState<Names>({ phase: "waiting" });
  useEffect(() => {
    const element = section.current;
    if (element === null) return;
    let live = true;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      setNames({ phase: "loading" });
      loadNames().then(
        (index) => {
          if (live) setNames({ phase: "ready", index });
        },
        () => {
          if (live) setNames({ phase: "failed" });
        },
      );
    });
    observer.observe(element);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, []);
  const targets = useMemo(() => nameTargets(spec), [spec]);
  const named = useMemo(
    () =>
      names.phase === "ready"
        ? targets.map((target) => nearestName(target.color, names.index).name)
        : null,
    [names, targets],
  );
  return (
    <PanelSection
      title="Names"
      sectionRef={section}
      note="The nearest name of each palette's light step 500 and of the five chart colors."
    >
      <p aria-live="polite" className="text-[11px] text-fg-muted empty:hidden">
        {names.phase === "failed"
          ? "Names unavailable. The rest of the inspector works."
          : names.phase === "ready"
            ? ""
            : "Loading names…"}
      </p>
      <ul className="space-y-1">
        {targets.map((target, i) => (
          <li
            key={target.label}
            data-name-target={target.label}
            className="grid grid-cols-[0.75rem_6.25rem_minmax(0,1fr)] items-baseline gap-x-2 text-[11px] leading-5"
          >
            <span
              data-swatch=""
              aria-hidden="true"
              className="size-3 self-center rounded-[2px]"
              style={{ backgroundColor: target.hex }}
            />
            <span className="font-mono text-fg-muted">
              {target.label}{" "}
              <span data-hex="" translate="no" className="sr-only">
                {target.hex}
              </span>
            </span>
            {named !== null && (
              <span data-name="" className="min-w-0 break-words text-foreground">
                {named[i]}
              </span>
            )}
          </li>
        ))}
      </ul>
    </PanelSection>
  );
});
