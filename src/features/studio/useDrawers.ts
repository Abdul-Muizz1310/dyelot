"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { tabStops } from "@/features/a11y/tabStops";

// The studio's two drawers (spec R2-16): below 1024 px the inputs panel and below 1280 px the
// inspector are modal drawers. An open drawer takes focus to its heading, traps Tab, makes the rest
// of the page inert and gives focus back to the button that opened it; a closed drawer is inert.

export type DrawerName = "inputs" | "inspector";

/** Below these widths a panel is a drawer; the CSS of studio.css uses the same breakpoints. */
const DRAWER_QUERY: Readonly<Record<DrawerName, string>> = {
  inputs: "(max-width: 1023.98px)",
  inspector: "(max-width: 1279.98px)",
};

/** How long a drawer's slide runs (studio.css: 220 ms), with room for the last frame. */
const SLIDE_MS = 300;

/** Whether a media query matches, following its changes. */
function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Keeps Tab and Shift+Tab inside an open drawer (R2-16 item 2). */
function trapFocus(event: ReactKeyboardEvent<HTMLElement>): void {
  if (event.key !== "Tab") return;
  const stops = tabStops(event.currentTarget);
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (first === undefined || last === undefined) {
    event.preventDefault();
    return;
  }
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !stops.some((stop) => stop === active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

/** The attributes and handler a panel element takes. */
export type PanelState = {
  readonly "data-drawer": "" | undefined;
  readonly "data-open": "" | undefined;
  /** Set while the drawer opens or closes: the only time it slides (F-STUDIO-25). */
  readonly "data-motion": "" | undefined;
  readonly inert: boolean;
  readonly onKeyDown: ((event: ReactKeyboardEvent<HTMLElement>) => void) | undefined;
};

export type Drawers = {
  /** Which panels are drawers at this width. */
  readonly isDrawer: Readonly<Record<DrawerName, boolean>>;
  /** The open drawer, if any. */
  readonly open: DrawerName | null;
  readonly headings: Readonly<Record<DrawerName, RefObject<HTMLHeadingElement | null>>>;
  openDrawer(name: DrawerName, opener: HTMLElement): void;
  closeDrawer(): void;
  /** The state of a panel: a drawer or a column, open or closed. */
  panelState(name: DrawerName): PanelState;
};

export function useDrawers(): Drawers {
  const isDrawer = {
    inputs: useMedia(DRAWER_QUERY.inputs),
    inspector: useMedia(DRAWER_QUERY.inspector),
  };
  const [requested, setRequested] = useState<DrawerName | null>(null);
  // The drawer that is opening or closing. A panel that becomes a drawer, or a column, because the
  // window crossed a breakpoint takes its place at once (F-STUDIO-25).
  const [moving, setMoving] = useState<DrawerName | null>(null);
  useEffect(() => {
    if (moving === null) return;
    const timer = setTimeout(() => setMoving(null), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [moving]);
  // A drawer whose width turned it back into a column is no longer open, and stays closed if the
  // window narrows again.
  const open = requested !== null && isDrawer[requested] ? requested : null;
  useEffect(() => {
    if (open === null) setRequested(null);
  }, [open]);

  const opener = useRef<HTMLElement | null>(null);
  const inputsHeading = useRef<HTMLHeadingElement>(null);
  const inspectorHeading = useRef<HTMLHeadingElement>(null);
  const shown = useRef<DrawerName | null>(null);

  // Opening moves focus to the drawer's heading; closing gives it back to the button that opened it.
  useEffect(() => {
    if (open === "inputs") inputsHeading.current?.focus();
    else if (open === "inspector") inspectorHeading.current?.focus();
    else if (shown.current !== null) opener.current?.focus();
    shown.current = open;
  }, [open]);

  return {
    isDrawer,
    open,
    headings: { inputs: inputsHeading, inspector: inspectorHeading },
    openDrawer(name, button) {
      opener.current = button;
      setMoving(name);
      setRequested(name);
    },
    closeDrawer() {
      setMoving(open);
      setRequested(null);
    },
    panelState(name) {
      return {
        "data-drawer": isDrawer[name] ? "" : undefined,
        "data-open": open === name ? "" : undefined,
        "data-motion": isDrawer[name] && moving === name ? "" : undefined,
        // A closed drawer is inert; a column is inert while the other drawer is open.
        inert: isDrawer[name] ? open !== name : open !== null,
        onKeyDown: open === name ? trapFocus : undefined,
      };
    },
  };
}
