import { describe, expect, it } from "vitest";
import { motionTokens } from "@/engine/tokens/motion";
import { MOTION_PRESET_IDS, MOTION_PRESETS, motionPresetOf } from "@/engine/tokens/motion-presets";
import { CUSTOM_TOKENS } from "../../support/motion";

// Cases C-PRE5-01, 03 and 04 of docs/specs/05-motion-3d.md, section 14.2 (R5-12).

const isDeepFrozen = (value: unknown): boolean =>
  typeof value !== "object" ||
  value === null ||
  (Object.isFrozen(value) && Object.values(value).every(isDeepFrozen));

/** R5-12's table: durations, then the four easings, then the springs (visual duration, bounce). */
const TABLE = {
  dyelot: {
    label: "dyelot",
    note: "dyelot's default: 50 to 500 ms, standard curves and three springs.",
    d: [50, 100, 150, 200, 300, 400, 500],
    e: [
      [0.2, 0, 0, 1],
      [0, 0, 0, 1],
      [0.3, 0, 1, 1],
      [0.05, 0.7, 0.1, 1],
    ],
    s: [
      [0.25, 0.1],
      [0.4, 0],
      [0.5, 0.35],
    ],
  },
  productive: {
    label: "Productive",
    note: "Short and efficient, for tools people use all day.",
    d: [40, 70, 110, 150, 240, 320, 400],
    e: [
      [0.2, 0, 0.38, 0.9],
      [0, 0, 0.38, 0.9],
      [0.2, 0, 1, 0.9],
      [0.4, 0.14, 0.3, 1],
    ],
    s: [
      [0.2, 0],
      [0.3, 0],
      [0.4, 0.15],
    ],
  },
  expressive: {
    label: "Expressive",
    note: "Longer and livelier, for moments worth noticing.",
    d: [70, 110, 150, 240, 400, 450, 500],
    e: [
      [0.4, 0.14, 0.3, 1],
      [0, 0, 0.3, 1],
      [0.4, 0.14, 1, 1],
      [0.05, 0.7, 0.1, 1],
    ],
    s: [
      [0.3, 0.2],
      [0.5, 0.1],
      [0.6, 0.45],
    ],
  },
  gentle: {
    label: "Gentle",
    note: "Soft starts and ends, for calm reading.",
    d: [80, 150, 200, 300, 400, 450, 500],
    e: [
      [0.33, 0, 0.67, 1],
      [0, 0, 0.2, 1],
      [0.4, 0, 1, 1],
      [0.05, 0.7, 0.1, 1],
    ],
    s: [
      [0.35, 0],
      [0.6, 0],
      [0.7, 0.2],
    ],
  },
  snappy: {
    label: "Snappy",
    note: "Quick and direct, for dense interfaces.",
    d: [30, 60, 90, 120, 180, 240, 300],
    e: [
      [0.2, 0, 0, 1],
      [0, 0, 0, 1],
      [0.3, 0, 1, 1],
      [0.2, 0, 0, 1],
    ],
    s: [
      [0.15, 0.05],
      [0.25, 0],
      [0.35, 0.3],
    ],
  },
} as const;

const spring = ([visualDuration, bounce]: readonly number[]) => ({ visualDuration, bounce });

describe("MOTION_PRESETS", () => {
  it("C-PRE5-01 lists the five ids, frozen, and holds R5-12's table deeply frozen", () => {
    expect(MOTION_PRESET_IDS).toEqual(["dyelot", "productive", "expressive", "gentle", "snappy"]);
    expect(Object.isFrozen(MOTION_PRESET_IDS)).toBe(true);
    expect(isDeepFrozen(MOTION_PRESETS)).toBe(true);
    expect(Object.keys(MOTION_PRESETS)).toEqual([...MOTION_PRESET_IDS]);
    for (const id of MOTION_PRESET_IDS) {
      const row = TABLE[id];
      const [snappy, smooth, bouncy] = row.s;
      const [standard, decelerate, accelerate, emphasized] = row.e;
      const [instant, fast, quick, base, slow, slower, slowest] = row.d;
      expect(MOTION_PRESETS[id], id).toEqual({
        id,
        label: row.label,
        note: row.note,
        tokens: {
          durations: { instant, fast, quick, base, slow, slower, slowest },
          easings: { standard, decelerate, accelerate, emphasized },
          springs: { snappy: spring(snappy), smooth: spring(smooth), bouncy: spring(bouncy) },
        },
      });
    }
  });

  it("C-PRE5-01 makes dyelot the default tokens", () => {
    expect(MOTION_PRESETS.dyelot.tokens).toEqual(motionTokens());
  });
});

describe("motionPresetOf", () => {
  it("C-PRE5-03 gives each preset's id for its tokens, and dyelot for the defaults", () => {
    for (const id of MOTION_PRESET_IDS) expect(motionPresetOf(MOTION_PRESETS[id].tokens)).toBe(id);
    expect(motionPresetOf(motionTokens())).toBe("dyelot");
  });

  it("C-PRE5-03 gives null for custom tokens and for a preset with one duration plus 1", () => {
    expect(motionPresetOf(CUSTOM_TOKENS)).toBeNull();
    const tokens = structuredClone(MOTION_PRESETS.productive.tokens);
    tokens.durations.base += 1;
    expect(motionPresetOf(tokens)).toBeNull();
  });

  it("C-PRE5-03 holds no design-system or brand name in an id, a label or a note", () => {
    const banned = /material|carbon|fluent|tailwind|apple|ibm|google|microsoft/i;
    for (const preset of Object.values(MOTION_PRESETS)) {
      for (const text of [preset.id, preset.label, preset.note]) expect(text).not.toMatch(banned);
    }
  });

  it("C-PRE5-04 throws TypeError for null and RangeError for a bounce of 2, naming itself", () => {
    expect(() => motionPresetOf(null as never)).toThrow(TypeError);
    expect(() => motionPresetOf(null as never)).toThrow(/^motionPresetOf/);
    const tokens = structuredClone(motionTokens());
    tokens.springs.snappy.bounce = 2;
    expect(() => motionPresetOf(tokens)).toThrow(RangeError);
    expect(() => motionPresetOf(tokens)).toThrow(/^motionPresetOf/);
  });
});
