"use client";

import { Player, type PlayerRef } from "@remotion/player";
import { useLayoutEffect, useRef, useState } from "react";
import type { Mode } from "@/engine";
import { TOGGLE_BUTTON } from "@/features/studio/chrome";
import { BRAND_INTRO, BrandIntro, type BrandProps } from "@/flavor/remotion/brand-intro";
import { FLAVOR_LINES } from "./video";

// The brand video's preview (docs/specs/05-motion-3d.md, R5-52, section 11.1): Remotion's Player
// with no controls of its own and no audio tags, and dyelot's "Pause" under it, which drives the
// Player through its ref. Under reduced motion it waits on its last frame, the finished picture;
// otherwise it autoplays, muted. The Flavor dialog loads this file with `next/dynamic`, so the
// Player's code arrives only with the dialog.

/** The last frame, the finished picture: where a reduced-motion preview opens. */
const LAST_FRAME = BRAND_INTRO.durationInFrames - 1;

/**
 * The composition as the Player shows it: a video frame, hidden from assistive technology, since its
 * text is part of the picture (WCAG 1.4.3; 13.3's amendment, recorded at the final review). The
 * wrapper fills the Player's frame, so `BrandIntro`, which stays as its golden pinned it, draws as
 * before; the Player's loading and failure lines sit outside it.
 */
function BrandFrame(props: BrandProps) {
  return (
    <div aria-hidden="true" data-brand-frame="" style={{ position: "absolute", inset: 0 }}>
      <BrandIntro {...props} />
    </div>
  );
}

export type BrandPlayerProps = {
  /** `brandProps(spec, mode)`, memoized on the spec and the mode by the dialog. */
  readonly props: BrandProps;
  readonly mode: Mode;
  /** The visitor's setting or the canvas's "Reduce motion". */
  readonly reduced: boolean;
};

export function BrandPlayer({ props, mode, reduced }: BrandPlayerProps) {
  const player = useRef<PlayerRef>(null);
  const [playing, setPlaying] = useState(false);

  // The Player autoplays from its own effect, which runs before this component's effects: the
  // listeners go on in the layout phase, once the Player's ref is set, so its first `play` counts.
  useLayoutEffect(() => {
    const current = player.current;
    if (current === null) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    current.addEventListener("play", onPlay);
    current.addEventListener("pause", onPause);
    return () => {
      current.removeEventListener("play", onPlay);
      current.removeEventListener("pause", onPause);
    };
  }, []);

  /** Pauses a playing preview, or plays a paused one, from the start when it is on its last frame. */
  function toggle(): void {
    const current = player.current;
    if (current === null) return;
    if (playing) {
      current.pause();
      return;
    }
    if (current.getCurrentFrame() === LAST_FRAME) current.seekTo(0);
    current.play();
  }

  return (
    <>
      <div
        data-brand-player=""
        data-autoplay={String(!reduced)}
        data-playing={String(playing)}
        data-mode={mode}
        className="overflow-hidden rounded-md border border-border"
      >
        <Player
          ref={player}
          component={BrandFrame}
          inputProps={props}
          durationInFrames={BRAND_INTRO.durationInFrames}
          fps={BRAND_INTRO.fps}
          compositionWidth={BRAND_INTRO.width}
          compositionHeight={BRAND_INTRO.height}
          controls={false}
          clickToPlay={false}
          loop
          numberOfSharedAudioTags={0}
          initiallyMuted
          acknowledgeRemotionLicense
          autoPlay={!reduced}
          initialFrame={reduced ? LAST_FRAME : 0}
          style={{ width: "100%" }}
          renderLoading={() => <p className="text-fg-muted text-sm">Loading the preview…</p>}
          errorFallback={() => <p className="text-sm">The preview could not play here.</p>}
        />
      </div>
      <button
        type="button"
        aria-pressed={!playing}
        onClick={toggle}
        className={`${TOGGLE_BUTTON} self-start`}
      >
        {FLAVOR_LINES.pause}
      </button>
    </>
  );
}
