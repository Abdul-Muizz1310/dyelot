import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { flavorSeed, flavorStops } from "@/engine";
import { flavorBackground, mountFlavor } from "@/flavor/flavor.mjs";
import { Flavor, type FlavorProps } from "@/flavor/flavor-react";
import { specId } from "@/spec";
import { defaultSpec } from "../spec/support";

// C-FLAV-19 of docs/specs/05-motion-3d.md, section 14.3: `<Flavor>` (R5-21) around a stand-in for
// the runtime's `mountFlavor`; the runtime's own cases live in flavor-mount.test.ts.

vi.mock("@/flavor/flavor.mjs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/flavor/flavor.mjs")>()),
  mountFlavor: vi.fn(),
}));

const SPEC = defaultSpec();
const STOPS = flavorStops(SPEC, "light");
const S2 = flavorStops(SPEC, "dark");
const SEED = flavorSeed(specId(SPEC));
const FADE = { durationMs: 200, easing: [0.2, 0, 0, 1] };

type Handle = { setStops: Mock; setPaused: Mock; drawAt: Mock; destroy: Mock };

/** The handles the stand-in returned, in mount order. */
const handles: Handle[] = [];

beforeEach(() => {
  handles.length = 0;
  vi.mocked(mountFlavor)
    .mockReset()
    .mockImplementation(() => {
      const handle = { setStops: vi.fn(), setPaused: vi.fn(), drawAt: vi.fn(), destroy: vi.fn() };
      handles.push(handle);
      return handle;
    });
});

/** Lets a destroy deferred to a microtask run. */
const settle = () => Promise.resolve();

/** The props of each case: STOPS, SEED and FADE unless `props` says otherwise. */
const props = (more: Partial<FlavorProps> = {}): FlavorProps => ({
  stops: STOPS,
  seed: SEED,
  fade: FADE,
  ...more,
});

/** The one canvas `container` holds. */
function canvasIn(container: HTMLElement): HTMLCanvasElement {
  const canvases = container.querySelectorAll("canvas");
  expect(canvases).toHaveLength(1);
  return canvases[0];
}

describe("<Flavor>", () => {
  it("C-FLAV-19 renders one aria-hidden canvas with its class and the still gradient on the server", () => {
    const html = renderToString(<Flavor {...props({ className: "h-80 w-full" })} />);
    const host = document.createElement("div");
    host.innerHTML = html;
    const canvas = canvasIn(host);
    expect(host.children).toHaveLength(1);
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    expect(canvas.getAttribute("class")).toBe("h-80 w-full");
    const { backgroundColor, backgroundImage } = flavorBackground(STOPS);
    expect(canvas.getAttribute("style")).toBe(
      `background-color:${backgroundColor};background-image:${backgroundImage}`,
    );
    expect(mountFlavor).not.toHaveBeenCalled();
  });

  it("C-FLAV-19 mounts the runtime once, in an effect, with its props", () => {
    const onFallback = vi.fn();
    const { container } = render(
      <Flavor {...props({ reducedMotion: true, onFallback, className: "h-80" })} />,
    );
    const canvas = canvasIn(container);
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    expect(canvas.className).toBe("h-80");
    expect(mountFlavor).toHaveBeenCalledTimes(1);
    const [target, options] = vi.mocked(mountFlavor).mock.calls[0];
    expect(target).toBe(canvas);
    expect(options).toMatchObject({ stops: STOPS, seed: SEED, fade: FADE, reducedMotion: true });
    options.onFallback?.("context-lost");
    expect(onFallback).toHaveBeenCalledWith("context-lost");
    expect(handles[0].setStops).not.toHaveBeenCalled();
    expect(handles[0].setPaused).not.toHaveBeenCalled();
  });

  it("C-FLAV-19 starts paused when paused is set at mount", () => {
    render(<Flavor {...props({ paused: true })} />);
    expect(mountFlavor).toHaveBeenCalledTimes(1);
    expect(handles[0].setPaused).toHaveBeenCalledTimes(1);
    expect(handles[0].setPaused).toHaveBeenCalledWith(true);
  });

  it("C-FLAV-19 calls setStops once per change of stops, on the same canvas", () => {
    const { container, rerender } = render(<Flavor {...props()} />);
    const canvas = canvasIn(container);
    rerender(<Flavor {...props({ stops: S2 })} />);
    expect(handles[0].setStops).toHaveBeenCalledTimes(1);
    expect(handles[0].setStops).toHaveBeenLastCalledWith(S2);
    rerender(<Flavor {...props({ stops: [...S2] })} />);
    expect(handles[0].setStops).toHaveBeenCalledTimes(1);
    rerender(<Flavor {...props({ stops: STOPS })} />);
    expect(handles[0].setStops).toHaveBeenCalledTimes(2);
    expect(handles[0].setStops).toHaveBeenLastCalledWith(STOPS);
    expect(canvasIn(container)).toBe(canvas);
    const probe = document.createElement("div");
    probe.style.backgroundImage = flavorBackground(STOPS).backgroundImage;
    expect(canvas.style.backgroundImage).toBe(probe.style.backgroundImage);
    expect(mountFlavor).toHaveBeenCalledTimes(1);
  });

  it("C-FLAV-19 calls setPaused per change of paused", () => {
    const { rerender } = render(<Flavor {...props()} />);
    rerender(<Flavor {...props({ paused: true })} />);
    rerender(<Flavor {...props({ paused: true })} />);
    rerender(<Flavor {...props({ paused: false })} />);
    expect(handles[0].setPaused.mock.calls).toEqual([[true], [false]]);
    expect(mountFlavor).toHaveBeenCalledTimes(1);
  });

  it.each<[string, Partial<FlavorProps>]>([
    ["seed", { seed: [1, 2] }],
    ["fade", { fade: { durationMs: 120, easing: [0, 0, 1, 1] } }],
    ["reducedMotion", { reducedMotion: true }],
  ])(
    "C-FLAV-19 a change of %s destroys the handle and mounts a new canvas",
    async (_name, more) => {
      const { container, rerender } = render(<Flavor {...props()} />);
      const first = canvasIn(container);
      rerender(<Flavor {...props()} />);
      rerender(<Flavor {...props({ seed: [...SEED], fade: { ...FADE } })} />);
      await settle();
      expect(mountFlavor).toHaveBeenCalledTimes(1);
      rerender(<Flavor {...props(more)} />);
      await settle();
      const second = canvasIn(container);
      expect(second).not.toBe(first);
      expect(mountFlavor).toHaveBeenCalledTimes(2);
      expect(vi.mocked(mountFlavor).mock.calls[1][0]).toBe(second);
      expect(handles[0].destroy).toHaveBeenCalledTimes(1);
      expect(handles[1].destroy).not.toHaveBeenCalled();
    },
  );

  it("C-FLAV-19 destroys the handle on unmount", async () => {
    const { unmount } = render(<Flavor {...props()} />);
    unmount();
    await settle();
    expect(handles[0].destroy).toHaveBeenCalledTimes(1);
  });

  it("C-FLAV-19 mounts a new canvas for a new key", async () => {
    const { container, rerender } = render(<Flavor key="a" {...props()} />);
    const first = canvasIn(container);
    rerender(<Flavor key="b" {...props()} />);
    await settle();
    expect(canvasIn(container)).not.toBe(first);
    expect(mountFlavor).toHaveBeenCalledTimes(2);
    expect(handles[0].destroy).toHaveBeenCalledTimes(1);
  });

  it("R5-21 under Strict Mode mounts once and keeps the context until unmount", async () => {
    const { container, unmount } = render(
      <StrictMode>
        <Flavor {...props()} />
      </StrictMode>,
    );
    await settle();
    expect(mountFlavor).toHaveBeenCalledTimes(1);
    expect(vi.mocked(mountFlavor).mock.calls[0][0]).toBe(canvasIn(container));
    expect(handles[0].destroy).not.toHaveBeenCalled();
    expect(handles[0].setStops).not.toHaveBeenCalled();
    unmount();
    await settle();
    expect(handles[0].destroy).toHaveBeenCalledTimes(1);
  });
});
