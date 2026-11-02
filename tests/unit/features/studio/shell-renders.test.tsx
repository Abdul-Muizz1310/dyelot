import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Review M-8 of Task 2.7: the studio shell does not re-render its panels when only the canvas
// changes. A view setting (the vision group) and a stage resize (the frame's fit) re-render the
// canvas and the frame switcher, never the inputs panel. The panel is replaced by a counter.

const renders = vi.hoisted(() => ({ inputs: 0 }));

vi.mock("@/features/studio/InputsPanel", () => ({
  InputsPanel: () => {
    renders.inputs++;
    return null;
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/** Every ResizeObserver the page makes, so the test can report a new size. */
const observers: { callback: ResizeObserverCallback; targets: Element[] }[] = [];

class StubResizeObserver {
  private readonly entry: { callback: ResizeObserverCallback; targets: Element[] };
  constructor(callback: ResizeObserverCallback) {
    this.entry = { callback, targets: [] };
    observers.push(this.entry);
  }
  observe(target: Element) {
    this.entry.targets.push(target);
  }
  unobserve() {}
  disconnect() {}
}

/** The inspector's Names section waits for an IntersectionObserver that never reports (Task 2.10b). */
class StubIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
  vi.stubGlobal("IntersectionObserver", StubIntersectionObserver);
  // A 1280 × 800 window: no media query of the shell's drawers matches below its width.
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: /min-width/.test(query),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
  window.location.hash = "";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  observers.length = 0;
});

describe("the studio shell's renders (review M-8)", () => {
  it("re-renders neither the inputs panel for a view setting nor for a stage resize", async () => {
    const { Studio } = await import("@/features/studio/Studio");
    render(<Studio />);
    const protan = await screen.findByRole("radio", { name: "protan" });
    const settled = renders.inputs;
    expect(settled).toBeGreaterThan(0);

    // A view setting changes the canvas only.
    act(() => {
      fireEvent.click(protan);
    });
    expect(document.querySelector("[data-canvas][data-frame]")?.getAttribute("data-vision")).toBe(
      "protan",
    );
    expect(renders.inputs).toBe(settled);

    // The stage grows to 640 px: the frame switcher reads "fit 50%", the panel stays as it was.
    const stage = document.querySelector("[data-canvas-stage]");
    if (stage === null) throw new Error("no stage");
    Object.defineProperty(stage, "clientWidth", { configurable: true, value: 640 });
    act(() => {
      for (const { callback, targets } of observers) {
        if (targets.includes(stage)) callback([], {} as ResizeObserver);
      }
    });
    expect(document.querySelector("[data-frame-fit]")?.textContent).toBe("fit 50%");
    expect(renders.inputs).toBe(settled);
  });
});
