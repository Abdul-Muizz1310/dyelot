"use client";

import "./navigation.css";
import { Bookmark, Check } from "lucide-react";
import { m } from "motion/react";
import {
  type KeyboardEvent,
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useKitMotion } from "./motion";
import { type KitState, withRing } from "./states";

// The kit's tabs, tab bar and menu (sections 7.5 and 7.7). A specimen shows one tab or one menu item
// in a forced state. The live tab list and the tab bar follow the ARIA tabs pattern: arrow keys, Home
// and End move the selection with the focus; the tab list's indicator slides on the spec's spring.

const TAB_ROLES = "muted-foreground foreground muted primary font-body";

export function TabSpecimen({ label, state }: { label: string; state: KitState }) {
  return (
    <div role="tablist" aria-label="Tide view" className="kit-tabs">
      <button
        type="button"
        role="tab"
        aria-selected={state === "selected"}
        className="kit-tab kit-t-label"
        data-kit="tab"
        data-state={state}
        data-roles={withRing(TAB_ROLES, state)}
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
  const motion = useKitMotion();

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
            className="kit-tab kit-t-label"
            data-roles={TAB_ROLES}
            onClick={() => setSelected(index)}
          >
            {tab.label}
          </button>
        ))}
        <m.span
          key={motion.key}
          aria-hidden="true"
          className="kit-tabs-indicator"
          initial={false}
          animate={{ x: bar.x, width: bar.width }}
          transition={motion.transition}
        />
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${selected}`}
        className="kit-tab-panel kit-t-body-sm"
      >
        {TABS[selected]?.body}
      </div>
    </div>
  );
}

export function MenuSpecimen({ state }: { state: KitState }) {
  const shared = {
    className: "kit-menu-item kit-t-body-sm",
    "data-kit": "menu-item",
    "data-state": state,
    "data-roles": withRing("popover popover-foreground accent accent-foreground font-body", state),
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

/** A tab of the tab bar: its key, its label and its icon. */
type TabBarItem<T extends string> = {
  readonly key: T;
  readonly label: string;
  readonly icon: ReactNode;
};

/**
 * A phone's tab bar (section 7.7, F-TPL-35): a named `tablist` of tabs, each an icon over its label,
 * with one tab stop, the selected tab. ←, →, Home and End move the selection and the focus together
 * (← and → wrap), and a click selects. The selection lives in the caller, so a view toggle keeps it;
 * `ids(key)` names each tab and the `tabpanel` it controls, which the caller renders. The selected tab
 * sets its icon on a `secondary` pill and its label in `foreground`; the others are `muted-foreground`.
 */
export function TabBar<T extends string>({
  label,
  items,
  selected,
  onSelect,
  ids,
}: {
  label: string;
  items: readonly TabBarItem<T>[];
  selected: T;
  onSelect: (key: T) => void;
  ids: (key: T) => { readonly tab: string; readonly panel: string };
}) {
  const tabs = useRef(new Map<T, HTMLButtonElement>());
  if (!items.some((item) => item.key === selected)) {
    throw new RangeError(`TabBar: no tab ${JSON.stringify(selected)} among its items`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const move = NEXT[event.key];
    if (move === undefined) return;
    event.preventDefault();
    const next =
      items[
        move(
          items.findIndex((item) => item.key === selected),
          items.length,
        )
      ];
    if (next === undefined) return;
    onSelect(next.key);
    tabs.current.get(next.key)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className="kit-tabbar"
      data-roles="background border"
      onKeyDown={onKeyDown}
    >
      {items.map((item) => {
        const on = item.key === selected;
        const { tab, panel } = ids(item.key);
        return (
          <button
            key={item.key}
            ref={(element) => {
              if (element === null) tabs.current.delete(item.key);
              else tabs.current.set(item.key, element);
            }}
            type="button"
            role="tab"
            id={tab}
            aria-selected={on}
            aria-controls={panel}
            tabIndex={on ? 0 : -1}
            className="kit-tabbar-tab kit-t-label"
            data-roles={on ? "foreground font-body" : "muted-foreground font-body"}
            onClick={() => onSelect(item.key)}
          >
            <span
              className="kit-tabbar-pill"
              data-roles={on ? "secondary secondary-foreground" : "muted muted-foreground"}
            >
              {item.icon}
            </span>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
