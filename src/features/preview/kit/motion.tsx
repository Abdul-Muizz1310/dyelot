"use client";

import {
  domAnimation,
  LazyMotion,
  MotionConfig,
  m,
  type Transition,
  useReducedMotionConfig,
} from "motion/react";
import { type ReactNode, useState } from "react";

// The kit's motion (R2-08, R2-21): every Motion part springs with the spec's spring, the one that
// `feelSpring(spec.motion)` reads. The canvas's "Reduce motion" switch passes `reducedMotion="always"`;
// otherwise Motion follows the system setting ("user"). CSS animations stop by the canvas rules.

export function MotionScope({
  reduced,
  spring,
  children,
}: {
  reduced: boolean;
  spring: { readonly visualDuration: number; readonly bounce: number };
  children: ReactNode;
}) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig
        reducedMotion={reduced ? "always" : "user"}
        transition={{
          type: "spring",
          visualDuration: spring.visualDuration,
          bounce: spring.bounce,
        }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

/**
 * A template's one orchestrated entrance (research D4): the block rises into place once, on the
 * spec's spring. Reduced motion is read once, at mount: under it the block starts in place and
 * nothing runs, and a later toggle changes nothing. The element is always the same `m.div`, so a
 * view toggle never remounts the template and the preview keeps its own state (R2-20).
 */
export function Entrance({ className, children }: { className: string; children: ReactNode }) {
  const reduced = useReducedMotionConfig() === true;
  const [reducedAtMount] = useState(reduced);
  return (
    <m.div
      data-entrance=""
      className={className}
      initial={reducedAtMount ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {children}
    </m.div>
  );
}

const INSTANT: Transition = { duration: 0 };

/**
 * The transition of a live kit part: instant while motion is reduced, otherwise the spec's spring
 * from MotionConfig. Motion reads `reducedMotion` when a part mounts, so a part that stays mounted
 * across the canvas switch reads it here, on every render.
 */
export function useKitTransition(): Transition | undefined {
  return useReducedMotionConfig() === true ? INSTANT : undefined;
}
