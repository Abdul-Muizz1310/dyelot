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
import { useOsReducedMotion } from "./reduced";

// The kit's motion (R2-08, R2-21): every Motion part springs with the spec's spring, the one that
// `feelSpring(spec.motion)` reads. The canvas's "Reduce motion" switch passes `reducedMotion="always"`;
// otherwise Motion follows the system setting ("user"). The OS setting is also read live (R5-49), so a
// change while something moves takes the path the canvas's switch settles. CSS animations stop by the
// canvas rules.

export function MotionScope({
  reduced,
  spring,
  children,
}: {
  reduced: boolean;
  spring: { readonly visualDuration: number; readonly bounce: number };
  children: ReactNode;
}) {
  const osReduced = useOsReducedMotion();
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig
        reducedMotion={reduced || osReduced ? "always" : "user"}
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
 * The motion of a stateless leaf animator (the switch's thumb, the tab indicator). Motion reads
 * `reducedMotion` once, when a part mounts, so a key that changes with it remounts the leaf: a leaf
 * mounted while motion was reduced springs again once it is not. The leaf's state lives in its
 * parent and it sets `initial={false}`, so the remount never jumps. While reduced, the transition
 * is instant as well. Never key `MotionConfig` or `Entrance`: that would remount the template.
 */
export function useKitMotion(): {
  key: "reduced" | "full";
  transition: Transition | undefined;
} {
  return useReducedMotionConfig() === true
    ? { key: "reduced", transition: INSTANT }
    : { key: "full", transition: undefined };
}
