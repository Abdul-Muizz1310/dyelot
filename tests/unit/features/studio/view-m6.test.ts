import { describe, expect, it } from "vitest";
import { PRESET_IDS, PRESETS } from "@/engine";
import { DEFAULT_VIEW, presetView } from "@/features/studio/view";

// Cases are C-STORE6-07 and C-STORE6-08 of docs/specs/06-gallery.md, section 14 (R6-26).

describe("presetView", () => {
  it("C-STORE6-07 takes the preset's mode and density, else the view itself", () => {
    expect(PRESET_IDS).toHaveLength(14);
    for (const id of PRESET_IDS) {
      expect(presetView(DEFAULT_VIEW, id), id).toEqual({
        ...DEFAULT_VIEW,
        mode: PRESETS[id].view.mode,
        density: PRESETS[id].view.density,
      });
    }
    const view = { ...DEFAULT_VIEW, frame: 360 as const };
    expect(presetView(view, null)).toBe(view);
  });

  it("C-STORE6-08 checks its inputs, types before values", () => {
    expect(() => presetView(null as never, "default")).toThrow(TypeError);
    expect(() => presetView(null as never, "default")).toThrow(/^presetView/);
    expect(() => presetView(DEFAULT_VIEW, 3 as never)).toThrow(TypeError);
    expect(() => presetView(DEFAULT_VIEW, 3 as never)).toThrow(/^presetView/);
    expect(() => presetView(DEFAULT_VIEW, "nope" as never)).toThrow(RangeError);
    expect(() => presetView(DEFAULT_VIEW, "nope" as never)).toThrow(/^presetView/);
    expect(() => presetView({ ...DEFAULT_VIEW, mode: "x" } as never, "default")).toThrow(
      RangeError,
    );
    // Types come before domains, across arguments and fields.
    expect(() => presetView({ ...DEFAULT_VIEW, mode: "x" } as never, 3 as never)).toThrow(
      TypeError,
    );
    expect(() =>
      presetView({ ...DEFAULT_VIEW, mode: "x", density: 3 } as never, "default"),
    ).toThrow(TypeError);
    expect(() => presetView({ ...DEFAULT_VIEW, mode: "x" } as never, "default")).toThrow(
      RangeError,
    );
  });
});
