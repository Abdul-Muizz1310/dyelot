"use client";

import "./navigation.css";
import { Bookmark, Check } from "lucide-react";
import { m } from "motion/react";
import { type KeyboardEvent, useId, useLayoutEffect, useRef, useState } from "react";
import { useKitTransition } from "./motion";
import type { KitState } from "./states";

// The kit's tabs and menu (section 7.5). A specimen shows one tab or one menu item in a forced
// state. The live tab list follows the ARIA tabs pattern: arrow keys, Home and End move the
// selection with the focus, and the indicator slides on the spec's spring.

const TAB_ROLES = "muted-foreground foreground muted primary";

export function TabSpecimen({ label, state }: { label: string; state: KitState }) {
  return (
    <div role="tablist" aria-label="Tide view" className="kit-tabs">
      <button
        type="button"
        role="tab"
        aria-selected={state === "selected"}
        className="kit-tab"
        data-kit="tab"
        data-state={state}
        data-roles={TAB_ROLES}
        disabled={state === "disabled"}
      >
        {label}
      </button>
    </div>
  );
}

const TABS = [
  { label: "Tides", body: "Sample: high water reaches the bay at 06:42 and again at 19:11." },
  { label: "Wind", body: "Sample: a light westerly, backing south by the afternoon." },
  { label: "Moon", body: "Sample: a waxing gibbous moon, three days from full." },
] as const;

const NEXT: Readonly<Record<string, (index: number, count: number) => number>> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_, count) => count - 1,
};

export function TabsDemo() {
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [selected, setSelected] = useState(0);
  const [bar, setBar] = useState({ x: 0, width: 0 });
  const transition = useKitTransition();

  useLayoutEffect(() => {
    const measure = () => {
      const tab = tabs.current[selected];
      if (tab) setBar({ x: tab.offsetLeft, width: tab.offsetWidth });
    };
    measure();
    if (list.current === null) return;
    // A font that loads, a density change or a new frame moves the tabs: the bar follows.
    const observer = new ResizeObserver(measure);
    observer.observe(list.current);
    return () => observer.disconnect();
  }, [selected]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const move = NEXT[event.key];
    if (move === undefined) return;
    event.preventDefault();
    const next = move(selected, TABS.length);
    setSelected(next);
    tabs.current[next]?.focus();
  }

  return (
    <div>
      <div
        ref={list}
        role="tablist"
        aria-label="Tide tables"
        className="kit-tabs"
        data-kit-demo="tabs"
        onKeyDown={onKeyDown}
      >
        {TABS.map((tab, index) => (
          <button
            key={tab.label}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={selected === index}
            aria-controls={`${id}-panel`}
            tabIndex={selected === index ? 0 : -1}
            className="kit-tab"
            data-roles={TAB_ROLES}
            onClick={() => setSelected(index)}
          >
            {tab.label}
          </button>
        ))}
        <m.span
          aria-hidden="true"
          className="kit-tabs-indicator"
          initial={false}
          animate={{ x: bar.x, width: bar.width }}
          transition={transition}
        />
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${selected}`}
        className="kit-tab-panel"
      >
        {TABS[selected]?.body}
      </div>
    </div>
  );
}

export function MenuSpecimen({ state }: { state: KitState }) {
  const shared = {
    className: "kit-menu-item",
    "data-kit": "menu-item",
    "data-state": state,
    "data-roles": "popover popover-foreground accent accent-foreground",
  };
  return (
    <div role="menu" aria-label="Reading actions" className="kit-menu">
      {state === "selected" ? (
        <div role="menuitemcheckbox" aria-checked="true" tabIndex={0} {...shared}>
          <Bookmark aria-hidden="true" />
          Pin to the top
          <Check data-mark="check" aria-hidden="true" />
        </div>
      ) : (
        <div
          role="menuitem"
          aria-disabled={state === "disabled" || undefined}
          tabIndex={0}
          {...shared}
        >
          <Bookmark aria-hidden="true" />
          Save the reading
        </div>
      )}
    </div>
  );
}
