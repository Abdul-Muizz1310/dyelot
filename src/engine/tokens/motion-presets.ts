import { type MotionTokens, normalizeMotionTokens, sameMotionTokens } from "./motion";

// Five motion presets (R5-12). `dyelot` is the engine's own tokens. The others follow the published
// numbers that research record RR-0029 collects: its productive and expressive curve pairs, its 70
// to 700 ms ladder (cut at 500 ms, the cap the theme bridge applies), the ease-in-out curve
// (0.33, 0, 0.67, 1), the ease-out curve (0, 0, 0.2, 1) and the emphasized decelerate curve. The
// springs keep the house's visual-duration and bounce model.

export const MOTION_PRESET_IDS = Object.freeze([
  "dyelot",
  "productive",
  "expressive",
  "gentle",
  "snappy",
] as const);
export type MotionPresetId = (typeof MOTION_PRESET_IDS)[number];

export type MotionPreset = {
  readonly id: MotionPresetId;
  readonly label: string;
  readonly note: string;
  readonly tokens: MotionTokens;
};

type Row = {
  readonly label: string;
  readonly note: string;
  /** instant, fast, quick, base, slow, slower, slowest. */
  readonly durations: readonly [number, number, number, number, number, number, number];
  /** standard, decelerate, accelerate, emphasized. */
  readonly easings: readonly [Easing, Easing, Easing, Easing];
  /** snappy, smooth, bouncy: visual duration in seconds, then bounce. */
  readonly springs: readonly [Spring, Spring, Spring];
};
type Easing = readonly [number, number, number, number];
type Spring = readonly [number, number];

const ROWS: Readonly<Record<MotionPresetId, Row>> = {
  dyelot: {
    label: "dyelot",
    note: "dyelot's default: 50 to 500 ms, standard curves and three springs.",
    durations: [50, 100, 150, 200, 300, 400, 500],
    easings: [
      [0.2, 0, 0, 1],
      [0, 0, 0, 1],
      [0.3, 0, 1, 1],
      [0.05, 0.7, 0.1, 1],
    ],
    springs: [
      [0.25, 0.1],
      [0.4, 0],
      [0.5, 0.35],
    ],
  },
  productive: {
    label: "Productive",
    note: "Short and efficient, for tools people use all day.",
    durations: [40, 70, 110, 150, 240, 320, 400],
    easings: [
      [0.2, 0, 0.38, 0.9],
      [0, 0, 0.38, 0.9],
      [0.2, 0, 1, 0.9],
      [0.4, 0.14, 0.3, 1],
    ],
    springs: [
      [0.2, 0],
      [0.3, 0],
      [0.4, 0.15],
    ],
  },
  expressive: {
    label: "Expressive",
    note: "Longer and livelier, for moments worth noticing.",
    durations: [70, 110, 150, 240, 400, 450, 500],
    easings: [
      [0.4, 0.14, 0.3, 1],
      [0, 0, 0.3, 1],
      [0.4, 0.14, 1, 1],
      [0.05, 0.7, 0.1, 1],
    ],
    springs: [
      [0.3, 0.2],
      [0.5, 0.1],
      [0.6, 0.45],
    ],
  },
  gentle: {
    label: "Gentle",
    note: "Soft starts and ends, for calm reading.",
    durations: [80, 150, 200, 300, 400, 450, 500],
    easings: [
      [0.33, 0, 0.67, 1],
      [0, 0, 0.2, 1],
      [0.4, 0, 1, 1],
      [0.05, 0.7, 0.1, 1],
    ],
    springs: [
      [0.35, 0],
      [0.6, 0],
      [0.7, 0.2],
    ],
  },
  snappy: {
    label: "Snappy",
    note: "Quick and direct, for dense interfaces.",
    durations: [30, 60, 90, 120, 180, 240, 300],
    easings: [
      [0.2, 0, 0, 1],
      [0, 0, 0, 1],
      [0.3, 0, 1, 1],
      [0.2, 0, 0, 1],
    ],
    springs: [
      [0.15, 0.05],
      [0.25, 0],
      [0.35, 0.3],
    ],
  },
};

function tokensOf({ durations, easings, springs }: Row): MotionTokens {
  const [instant, fast, quick, base, slow, slower, slowest] = durations;
  const [standard, decelerate, accelerate, emphasized] = easings;
  const [snappy, smooth, bouncy] = springs;
  const spring = ([visualDuration, bounce]: Spring) => ({ visualDuration, bounce });
  return normalizeMotionTokens({
    durations: { instant, fast, quick, base, slow, slower, slowest },
    easings: { standard, decelerate, accelerate, emphasized },
    springs: { snappy: spring(snappy), smooth: spring(smooth), bouncy: spring(bouncy) },
  });
}

/** The five presets, deeply frozen. */
export const MOTION_PRESETS: Readonly<Record<MotionPresetId, MotionPreset>> = Object.freeze(
  Object.fromEntries(
    MOTION_PRESET_IDS.map((id) => {
      const row = ROWS[id];
      const preset: MotionPreset = Object.freeze({
        id,
        label: row.label,
        note: row.note,
        tokens: tokensOf(row),
      });
      return [id, preset];
    }),
  ) as Record<MotionPresetId, MotionPreset>,
);

/**
 * The first preset whose tokens equal `tokens` (read through `normalizeMotionTokens`), or null for
 * a custom set (R5-12).
 */
export function motionPresetOf(tokens: MotionTokens): MotionPresetId | null {
  const checked = normalizeMotionTokens(tokens, "motionPresetOf: tokens");
  return (
    MOTION_PRESET_IDS.find((id) => sameMotionTokens(MOTION_PRESETS[id].tokens, checked)) ?? null
  );
}
