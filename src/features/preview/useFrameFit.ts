"use client";

import {
  createContext,
  type RefObject,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { type Frame, frameFit } from "./frame";

// The fit of the canvas frame (R2-16 item 3, F-CANVAS-03): the stage's width, measured before
// paint and on every resize, against the named frame. Until the stage is measured the frame
// shows at full size and the switcher says nothing.
//
// The canvas area measures the fit; the frame switcher in the toolbar shows it. They share a small
// store through `FitContext`, so a resize re-renders those two and not the shell around them.

export type FitReading = { readonly scale: number; readonly label: string };

const UNMEASURED: FitReading = Object.freeze({ scale: 1, label: "" });

export type FitStore = {
  get(): FitReading;
  set(reading: FitReading): void;
  subscribe(listener: () => void): () => void;
};

/** A store of the latest fit; setting an equal reading notifies no one. */
export function createFitStore(): FitStore {
  let reading = UNMEASURED;
  const listeners = new Set<() => void>();
  return {
    get: () => reading,
    set(next) {
      if (next.scale === reading.scale && next.label === reading.label) return;
      reading = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const FitContext = createContext<FitStore | null>(null);

/** The fit the canvas area measured, from the nearest `FitContext`. */
export function useFitReading(): FitReading {
  const store = useContext(FitContext);
  if (store === null) throw new Error("useFitReading: render inside a FitContext");
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function useFrameFit(frame: Frame): {
  stageRef: RefObject<HTMLDivElement | null>;
  fit: FitReading;
} {
  const stageRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<number | null>(null);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (stage === null) return;
    const measure = () => {
      // A hidden stage measures 0; the last width stands until it shows again.
      if (stage.clientWidth > 0) setAvailable(stage.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);
  const fit = useMemo(
    () => (available === null ? UNMEASURED : frameFit(available, frame)),
    [available, frame],
  );
  return { stageRef, fit };
}
