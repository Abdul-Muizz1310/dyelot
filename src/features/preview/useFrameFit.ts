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
import { boardFit, type Frame, frameFit } from "./frame";

// The fit of the canvas frame (R2-16 item 3, F-CANVAS-03): the stage's width, measured before
// paint and on every resize, against the named frame. Until the stage is measured the frame
// shows at full size and the switcher says nothing.
//
// The canvas area measures the fit; the frame switcher in the toolbar shows it. They share a small
// store through `FitContext`, so a resize re-renders those two and not the shell around them.
//
// A template that keeps its own width (the mobile template's board, F-TPL-32) takes the stage's width,
// clamped to 360 to 1280 px (`boardFit`), in place of the named frame, so its screens show at a fit of
// 1 or close to it; the named frame stays the view's, for the next template.

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

/** The nearest fit store; the canvas area that writes it must render inside a `FitContext`. */
export function useFitStore(): FitStore {
  const store = useContext(FitContext);
  if (store === null) throw new Error("CanvasArea: render inside a FitContext");
  return store;
}

/** The fit the canvas area measured, from the nearest `FitContext`. */
export function useFitReading(): FitReading {
  const store = useContext(FitContext);
  if (store === null) throw new Error("useFitReading: render inside a FitContext");
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export function useFrameFit(
  frame: Frame,
  board = false,
): {
  stageRef: RefObject<HTMLDivElement | null>;
  fit: FitReading;
  /** The frame's layout width: the named frame, or the board's width when `board` is set. */
  width: number;
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
  // The canvas region changes its padding when the board starts or ends (section 7.4), in the same
  // commit. Measuring again before paint lets the first frame show the new fit; the observer alone
  // would answer a frame later (the Task 2.10a review, round 3, M-1).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `board` is the trigger, not an input: the region's padding changes with it.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (stage !== null && stage.clientWidth > 0) setAvailable(stage.clientWidth);
  }, [board]);
  return useMemo(() => {
    if (available === null) return { stageRef, fit: UNMEASURED, width: frame };
    if (!board) return { stageRef, fit: frameFit(available, frame), width: frame };
    const { width, scale, label } = boardFit(available);
    return { stageRef, fit: { scale, label }, width };
  }, [available, frame, board]);
}
