// Built with Remotion (https://www.remotion.dev).
// Remotion is not open source: read its license at https://remotion.pro/license before you use this file.
// Companies of four or more people need a Remotion Company License.
// This composition was exported by dyelot (MIT); the Remotion package it imports is under Remotion's license.
import type { CSSProperties } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

// The brand video: 6 s at 30 frames a second. It takes plain props and uses only the web renderer's
// CSS subset (flex layout, transform, opacity, background-color, borders, text, no z-index), so the
// DOM order is the drawing order, back to front.

export type SpringSamples = { settleMs: number; samples: number[] };

export type BrandProps = {
  name: string;
  oneLiner: string;
  lot: string;
  checks: { passed: number; required: number };
  palettes: { name: string; steps: string[] }[];
  colors: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    primary: string;
    primaryForeground: string;
    mutedForeground: string;
    border: string;
  };
  fonts: { display: string; body: string };
  motion: {
    baseMs: number;
    standard: number[];
    springs: { snappy: SpringSamples; smooth: SpringSamples; bouncy: SpringSamples };
  };
};

export const BRAND_INTRO = {
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 180,
} as const;

export const BRAND_TIMELINE = {
  name: 0,
  oneLiner: 6,
  palettes: 30,
  rowGap: 12,
  stepGap: 2,
  specimen: 96,
  receipt: 132,
} as const;

/**
 * A spring curve at `frame`: 0 before frame 0 and 1 from `settleMs` on. Between, the samples are
 * read as evenly spaced over `settleMs` and interpolated linearly at the time `frame / fps`.
 */
export function springAt(curve: SpringSamples, frame: number, fps: number): number {
  if (typeof curve !== "object" || curve === null) {
    throw new TypeError("springAt: curve must be an object with settleMs and samples");
  }
  const { settleMs, samples } = curve;
  if (typeof settleMs !== "number") throw new TypeError("springAt: settleMs must be a number");
  if (!Array.isArray(samples) || samples.length < 2 || samples.some((s) => typeof s !== "number")) {
    throw new TypeError("springAt: samples must be an array of at least two numbers");
  }
  if (typeof frame !== "number") throw new TypeError("springAt: frame must be a number");
  if (typeof fps !== "number") throw new TypeError("springAt: fps must be a number");
  if (!Number.isFinite(frame)) throw new RangeError("springAt: frame must be finite");
  if (!Number.isFinite(fps) || fps <= 0) throw new RangeError("springAt: fps must be above 0");
  if (!Number.isFinite(settleMs) || settleMs <= 0) {
    throw new RangeError("springAt: settleMs must be above 0");
  }
  if (frame < 0) return 0;
  const ms = (frame / fps) * 1000;
  if (ms >= settleMs) return 1;
  const position = (ms / settleMs) * (samples.length - 1);
  const index = Math.floor(position);
  const from = samples[index];
  const to = samples[index + 1];
  return from + (to - from) * (position - index);
}

const ROWS = 5;
const STEPS = 11;

export function BrandIntro(props: BrandProps): React.JSX.Element {
  const { name, oneLiner, lot, checks, palettes, colors, fonts, motion } = props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const spring = (curve: SpringSamples, from: number): number => springAt(curve, frame - from, fps);
  const enter = (s: number): CSSProperties => ({
    opacity: Math.min(1, s),
    transform: `translateY(${(1 - s) * 24}px)`,
  });

  const smooth = motion.springs.smooth;
  const nameSpring = spring(smooth, BRAND_TIMELINE.name);
  const oneLinerSpring = spring(smooth, BRAND_TIMELINE.oneLiner);
  const specimenSpring = spring(motion.springs.bouncy, BRAND_TIMELINE.specimen);
  const receiptFrames = Math.max(1, (motion.baseMs / 1000) * fps);
  const receipt = interpolate(
    frame,
    [BRAND_TIMELINE.receipt, BRAND_TIMELINE.receipt + receiptFrames],
    [0, 1],
    {
      easing: Easing.bezier(
        motion.standard[0],
        motion.standard[1],
        motion.standard[2],
        motion.standard[3],
      ),
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        padding: 64,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 32,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 64,
            fontWeight: 600,
            color: colors.foreground,
            ...enter(nameSpring),
          }}
        >
          {name}
        </div>
        {oneLiner === "" ? null : (
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: 26,
              color: colors.mutedForeground,
              ...enter(oneLinerSpring),
            }}
          >
            {oneLiner}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "row", gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {palettes.slice(0, ROWS).map((palette, row) => (
            <div key={palette.name} style={{ display: "flex", flexDirection: "row", gap: 6 }}>
              <div
                style={{
                  width: 120,
                  fontFamily: fonts.body,
                  fontSize: 16,
                  color: colors.mutedForeground,
                }}
              >
                {palette.name}
              </div>
              {palette.steps.slice(0, STEPS).map((hex, step) => {
                const from =
                  BRAND_TIMELINE.palettes +
                  BRAND_TIMELINE.rowGap * row +
                  BRAND_TIMELINE.stepGap * step;
                const s = spring(motion.springs.snappy, from);
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: a fixed scale, step i is always the ith square
                    key={`${palette.name}-${step}`}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 6,
                      backgroundColor: hex,
                      opacity: Math.min(1, s),
                      transform: `scale(${0.6 + 0.4 * s})`,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div
          style={{
            width: 360,
            boxSizing: "border-box",
            height: "fit-content",
            padding: 28,
            borderRadius: 16,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.card,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            ...enter(specimenSpring),
          }}
        >
          <div style={{ fontFamily: fonts.display, fontSize: 32, color: colors.cardForeground }}>
            {name}
          </div>
          <div style={{ fontFamily: fonts.body, fontSize: 18, color: colors.mutedForeground }}>
            {oneLiner === "" ? "Made with dyelot." : oneLiner}
          </div>
          <div
            style={{
              alignSelf: "flex-start",
              padding: "12px 20px",
              borderRadius: 10,
              backgroundColor: colors.primary,
              color: colors.primaryForeground,
              fontFamily: fonts.body,
              fontSize: 18,
            }}
          >
            Get started
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, opacity: receipt }}>
        <div style={{ fontFamily: fonts.body, fontSize: 20, color: colors.foreground }}>
          {`${checks.passed} of ${checks.required} required checks pass`}
        </div>
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 16,
            color: colors.mutedForeground,
            letterSpacing: "0.08em",
          }}
        >
          {`LOT ${lot}`}
        </div>
      </div>
    </AbsoluteFill>
  );
}
