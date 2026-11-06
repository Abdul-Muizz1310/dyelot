"use client";

import { useEffect, useRef, useState } from "react";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { FLAVOR_LINES } from "@/features/flavor/video";
import { useOsReducedMotion } from "@/features/preview/kit/reduced";
import { BUTTON, TOGGLE_BUTTON } from "@/features/studio/chrome";
import type { FallbackReason } from "@/flavor/flavor.mjs";
import { Flavor } from "@/flavor/flavor-react";
import type { HeroCards } from "./cards";
import { nextIndex, paletteLine } from "./cycle";

// The landing's hero (docs/specs/05-motion-3d.md, R5-32, 6.4 and 7.1): a terminal window whose body
// is the animated background of one hero card, with no text on it, and under it the card's line,
// "Next palette", "Pause" while the background loops, and the card's link into the studio. The
// region under the controls says why the background is still, and after a lost context "Restart
// the animation" mounts a new canvas. The canvas carries the first card's still gradient in the
// server's HTML. This file imports no engine, spec or export code (C-GUARD5-05).

/**
 * A link of the controls, as tall as a button so its hit area is at least 24 px. It is neutral:
 * madder stays on the focus ring and the primary action (C-GUARD-05 of M2).
 */
const LINK =
  "inline-flex min-h-8 items-center font-mono text-foreground text-sm underline decoration-fg-muted underline-offset-4 hover:decoration-foreground";

/**
 * The region's sentence (6.4): a fallback's reason first, as the runtime's state puts `fallback`
 * before `still`; the device's sentence while the OS asks for reduced motion; nothing while it loops.
 */
function heroLine(fallback: FallbackReason | null, reduced: boolean): string {
  if (fallback !== null) return FLAVOR_LINES[fallback];
  if (reduced) return FLAVOR_LINES.still;
  return "";
}

export function Hero({ hero }: { hero: HeroCards }) {
  const { cards, seed, fade } = hero;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fallback, setFallback] = useState<FallbackReason | null>(null);
  const [mounts, setMounts] = useState(0);
  const reduced = useOsReducedMotion();
  const next = useRef<HTMLButtonElement>(null);
  const pause = useRef<HTMLButtonElement>(null);
  const restarted = useRef(false);

  // "Restart the animation" goes away as the new canvas mounts: focus moves to the new "Pause", or
  // to "Next palette" while the OS holds the background still.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `mounts` is the trigger.
  useEffect(() => {
    if (!restarted.current) return;
    restarted.current = false;
    (pause.current ?? next.current)?.focus();
  }, [mounts]);

  // `index` only moves by `nextIndex` among the cards, so a card is always there.
  const card = cards[index] as HeroCards["cards"][number];
  const loops = fallback === null && !reduced;
  return (
    <div data-hero="" data-hero-index={index + 1} className="space-y-4">
      <TerminalWindow title={`${card.name.toLowerCase()}.flavor`}>
        <div className="aspect-video w-full overflow-hidden rounded-md">
          <Flavor
            key={mounts}
            stops={card.stops}
            seed={seed}
            fade={fade}
            paused={paused}
            onFallback={setFallback}
            className="block size-full"
          />
        </div>
      </TerminalWindow>
      <div data-hero-controls="" className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="font-mono text-sm">{paletteLine(index, cards.length, card.name)}</p>
        <button
          ref={next}
          type="button"
          onClick={() => setIndex((current) => nextIndex(current, cards.length))}
          className={BUTTON}
        >
          Next palette
        </button>
        {loops && (
          <button
            ref={pause}
            type="button"
            aria-pressed={paused}
            onClick={() => setPaused((value) => !value)}
            className={TOGGLE_BUTTON}
          >
            {FLAVOR_LINES.pause}
          </button>
        )}
        <a href={card.href} className={LINK}>
          Open this palette in the studio
        </a>
      </div>
      <div role="status" className="min-h-5 text-fg-muted text-sm">
        {heroLine(fallback, reduced)}
      </div>
      {fallback === "context-lost" && (
        <button
          type="button"
          onClick={() => {
            restarted.current = true;
            setFallback(null);
            setMounts((count) => count + 1);
          }}
          className={BUTTON}
        >
          {FLAVOR_LINES.restart}
        </button>
      )}
    </div>
  );
}
