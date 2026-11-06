"use client";

// The animated background as a React component around flavor.mjs. Its canvas carries the still
// gradient from the first render, so the gradient shows on the server, before the runtime mounts
// and with JavaScript off. A context cannot be used again after `destroy`, so a new seed, fade or
// reduced-motion setting mounts a new canvas, while new stops cross-fade on the same one. A host
// restarts the animation by changing the component's `key`.
import { useEffect, useRef } from "react";
import {
  type Fade,
  type FallbackReason,
  type FlavorHandle,
  type FlavorStops,
  flavorBackground,
  mountFlavor,
} from "./flavor.mjs";

export type FlavorProps = {
  readonly stops: FlavorStops;
  readonly seed: readonly number[];
  readonly paused?: boolean;
  readonly reducedMotion?: boolean;
  readonly fade?: Fade;
  readonly onFallback?: (reason: FallbackReason) => void;
  readonly className?: string;
};

/** A mounted runtime, what it was last told, and whether its canvas is on its way out. */
type Mounted = { handle: FlavorHandle; stops: string; paused: boolean; leaving: boolean };

/**
 * One `<canvas aria-hidden="true">` with the animated background of `stops`. It pauses with
 * `paused`, stays still with `reducedMotion` or the visitor's setting, and calls `onFallback`
 * when it shows the still gradient instead.
 */
export function Flavor(props: FlavorProps): React.JSX.Element {
  const { seed, fade, reducedMotion = false } = props;
  const key = JSON.stringify([seed, fade ? [fade.durationMs, fade.easing] : null, reducedMotion]);
  return <FlavorCanvas key={key} {...props} />;
}

function FlavorCanvas({
  stops,
  seed,
  paused = false,
  reducedMotion,
  fade,
  onFallback,
  className,
}: FlavorProps): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const mounted = useRef<Mounted | null>(null);
  const report = useRef(onFallback);
  useEffect(() => {
    report.current = onFallback;
  });

  // The runtime reads seed, fade and reducedMotion once, at mount: `Flavor` keys the canvas on
  // them. Strict Mode runs this effect, its cleanup and the effect again on the same canvas, so
  // the cleanup leaves the destroy to a microtask that a second run cancels, and the context lives.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above.
  useEffect(() => {
    const element = canvas.current;
    if (element === null) return;
    let current = mounted.current;
    if (current === null) {
      const handle = mountFlavor(element, {
        stops,
        seed,
        reducedMotion,
        fade,
        onFallback: (reason) => report.current?.(reason),
      });
      if (paused) handle.setPaused(true);
      current = { handle, stops: stops.join(","), paused, leaving: false };
      mounted.current = current;
    }
    current.leaving = false;
    const held = current;
    return () => {
      held.leaving = true;
      queueMicrotask(() => {
        if (!held.leaving) return;
        held.handle.destroy();
        if (mounted.current === held) mounted.current = null;
      });
    };
  }, []);

  useEffect(() => {
    const current = mounted.current;
    const joined = stops.join(",");
    if (current === null || current.stops === joined) return;
    current.stops = joined;
    current.handle.setStops(stops);
  }, [stops]);

  useEffect(() => {
    const current = mounted.current;
    if (current === null || current.paused === paused) return;
    current.paused = paused;
    current.handle.setPaused(paused);
  }, [paused]);

  return (
    // biome-ignore lint/a11y/noAriaHiddenOnFocusable: a canvas with no tabIndex takes no focus.
    <canvas ref={canvas} aria-hidden="true" className={className} style={flavorBackground(stops)} />
  );
}
