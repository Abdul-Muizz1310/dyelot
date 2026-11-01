import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { createFitStore, FitContext, useFitStore } from "@/features/preview/useFrameFit";

// The frame fit's store (review M-8 and R2-M4 of Task 2.7): the canvas area writes it and the frame
// switcher reads it. Outside a FitContext both fail loudly, never in silence.

describe("useFitStore (review R2-M4)", () => {
  it("throws outside a FitContext, naming the canvas area", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useFitStore())).toThrow("CanvasArea: render inside a FitContext");
    vi.restoreAllMocks();
  });

  it("returns the provided store", () => {
    const store = createFitStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <FitContext value={store}>{children}</FitContext>
    );
    expect(renderHook(() => useFitStore(), { wrapper }).result.current).toBe(store);
  });
});

describe("createFitStore", () => {
  it("notifies on a new reading only", () => {
    const store = createFitStore();
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    store.set({ scale: 0.5, label: "fit 50%" });
    store.set({ scale: 0.5, label: "fit 50%" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toEqual({ scale: 0.5, label: "fit 50%" });
    stop();
    store.set({ scale: 1, label: "fit 100%" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
