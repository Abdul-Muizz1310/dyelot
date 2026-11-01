"use client";

import { domAnimation, LazyMotion, MotionConfig, m, useReducedMotionConfig } from "motion/react";
import type { ReactNode } from "react";

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
 * spec's spring. Under reduced motion it is in place from the start and nothing runs.
 */
export function Entrance({ className, children }: { className: string; children: ReactNode }) {
  const reduced = useReducedMotionConfig() === true;
  if (reduced) {
    return (
      <div data-entrance="" className={className}>
        {children}
      </div>
    );
  }
  return (
    <m.div
      data-entrance=""
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {children}
    </m.div>
  );
}
