"use client";

import { AnimatePresence, domAnimation, LazyMotion, MotionConfig, m } from "motion/react";
import { type ReactNode, useId, useState } from "react";
import { canvasStyle } from "@/features/preview/vars";
import type { DesignSpec } from "@/spec";
import { reducedTransition } from "./lab";

// The lab's five previews (spec R5-43, 9.4): each runs the design's own tokens with the `motion`
// kit, inside a specimen painted with the design's light roles. "Reduced motion" shows what the
// exported reduced-motion rules do: `MotionConfig reducedMotion="always"`, and every spring becomes
// `linear` over `fast`.

const TAB_WIDTH = 64;
const TABS = ["One", "Two", "Three"] as const;
const REPLAY =
  "inline-flex min-h-7 items-center rounded-md border border-[var(--border)] px-2 text-xs text-[var(--foreground)] hover:bg-[var(--muted)]";

type Id = "dialog" | "toast" | "switch" | "tabs" | "hover";

function Preview({
  id,
  transition,
  caption,
  replayLabel,
  onReplay,
  children,
}: {
  id: Id;
  transition: string;
  caption: string;
  replayLabel: string;
  onReplay(): void;
  children: ReactNode;
}) {
  return (
    <figure
      data-preview={id}
      data-transition={transition}
      className="flex min-w-0 flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-4"
    >
      <div className="flex min-h-28 items-center justify-center overflow-hidden">{children}</div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>{caption}</span>
        <button type="button" onClick={onReplay} className={REPLAY}>
          {replayLabel}
        </button>
      </figcaption>
    </figure>
  );
}

export function Previews({
  spec,
  reduced,
  onReducedChange,
}: {
  spec: DesignSpec;
  reduced: boolean;
  onReducedChange(next: boolean): void;
}) {
  const noteId = useId();
  const [keys, setKeys] = useState<Record<Id, number>>({
    dialog: 0,
    toast: 0,
    switch: 0,
    tabs: 0,
    hover: 0,
  });
  const [switchOn, setSwitchOn] = useState(false);
  const [tab, setTab] = useState(0);
  const { durations, easings, springs } = spec.motion;
  const replay = (id: Id) => setKeys((all) => ({ ...all, [id]: all[id] + 1 }));
  const spring = (name: keyof typeof springs) =>
    reduced ? reducedTransition(spec) : { type: "spring" as const, ...springs[name] };
  const springTag = (name: keyof typeof springs) =>
    reduced ? `linear:${durations.fast}` : `spring:${name}`;

  return (
    <fieldset
      aria-label="Previews"
      data-specimen=""
      data-lab-previews=""
      style={{
        ...canvasStyle(spec, "light", { vision: "none", density: "comfortable" }),
        containerType: "inline-size",
      }}
      className="m-0 min-w-0 space-y-4 rounded-md border border-[var(--border)] bg-[var(--background)] p-4 text-[var(--foreground)]"
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={reduced}
          aria-describedby={noteId}
          onClick={() => onReducedChange(!reduced)}
          className="inline-flex min-h-7 items-center gap-2 rounded-md border border-[var(--border)] px-2 text-sm"
        >
          Reduced motion
        </button>
        <span id={noteId} className="text-xs">
          Shows what the exported reduced-motion rules do.
        </span>
      </div>
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion={reduced ? "always" : "never"}>
          <div className="grid gap-4 md:grid-cols-2">
            <Preview
              id="dialog"
              transition={`tween:${durations.slow}:decelerate`}
              caption="Dialog: slow and decelerate in, base and accelerate out"
              replayLabel="Replay the dialog"
              onReplay={() => replay("dialog")}
            >
              <AnimatePresence mode="wait">
                <m.div
                  key={keys.dialog}
                  className="w-40 rounded-md border border-[var(--border)] bg-[var(--popover)] p-3 text-sm text-[var(--popover-foreground)]"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    transition: { duration: durations.slow / 1000, ease: [...easings.decelerate] },
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.96,
                    transition: { duration: durations.base / 1000, ease: [...easings.accelerate] },
                  }}
                >
                  A dialog
                </m.div>
              </AnimatePresence>
            </Preview>
            <Preview
              id="toast"
              transition={springTag("smooth")}
              caption="Toast: the smooth spring"
              replayLabel="Replay the toast"
              onReplay={() => replay("toast")}
            >
              <m.div
                key={keys.toast}
                className="rounded-md border border-[var(--border)] bg-[var(--popover)] px-3 py-2 text-sm text-[var(--popover-foreground)]"
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={spring("smooth")}
              >
                Saved
              </m.div>
            </Preview>
            <Preview
              id="switch"
              transition={springTag("snappy")}
              caption="Switch: the snappy spring"
              replayLabel="Replay the switch"
              onReplay={() => setSwitchOn((on) => !on)}
            >
              <button
                type="button"
                role="switch"
                aria-label="Example switch"
                aria-checked={switchOn}
                onClick={() => setSwitchOn((on) => !on)}
                className="flex h-7 w-12 items-center rounded-full border border-[var(--border)] bg-[var(--muted)] p-0.5 aria-checked:bg-[var(--primary)]"
              >
                <m.span
                  className="block size-5 rounded-full bg-[var(--background)] shadow"
                  animate={{ x: switchOn ? 20 : 0 }}
                  transition={spring("snappy")}
                />
              </button>
            </Preview>
            <Preview
              id="tabs"
              transition={springTag("bouncy")}
              caption="Tab indicator: the bouncy spring"
              replayLabel="Replay the tab indicator"
              onReplay={() => setTab((index) => (index + 1) % TABS.length)}
            >
              <div className="relative">
                <div role="tablist" aria-label="Example tabs" className="flex">
                  {TABS.map((name, index) => (
                    <button
                      key={name}
                      type="button"
                      role="tab"
                      aria-selected={index === tab}
                      onClick={() => setTab(index)}
                      style={{ width: TAB_WIDTH }}
                      className="min-h-7 py-1 text-sm"
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <m.span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 h-0.5 bg-[var(--primary)]"
                  style={{ width: TAB_WIDTH }}
                  animate={{ x: tab * TAB_WIDTH }}
                  transition={spring("bouncy")}
                />
              </div>
            </Preview>
            <Preview
              id="hover"
              transition={`tween:${durations.fast}:standard`}
              caption="Hover: fast and standard"
              replayLabel="Replay the hover"
              onReplay={() => replay("hover")}
            >
              <m.div
                key={keys.hover}
                className="rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm"
                animate={{ y: [0, -2, 0] }}
                whileHover={{ y: -2 }}
                transition={{
                  duration: (durations.fast * 2) / 1000,
                  ease: [...easings.standard],
                  times: [0, 0.5, 1],
                }}
              >
                Hover me
              </m.div>
            </Preview>
          </div>
        </MotionConfig>
      </LazyMotion>
    </fieldset>
  );
}
