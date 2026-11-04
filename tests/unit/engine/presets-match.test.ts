import { describe, expect, it } from "vitest";
import type { DirectionParams } from "@/engine";
import { choosePairing, PAIRINGS } from "@/engine/fonts/pairings";
import { generateSystem } from "@/engine/generate";
import { freshParams, resolveParams } from "@/engine/params";
import { applyPreset, PRESET_IDS, PRESETS, type PresetId, presetOf } from "@/engine/presets";
import type { DesignSpec } from "@/spec";

// Cases are the C-PMATCH-nn rows of docs/specs/03-export.md, section 10.2 (R3-07). A golden is
// the spec of section 10's GOLDENS for one preset.

const golden = (id: PresetId, patch: Partial<DirectionParams> = {}): DesignSpec =>
  generateSystem(
    resolveParams(
      { ...applyPreset(freshParams(), id), name: PRESETS[id].label, ...patch },
      "seed-1",
    ),
    "seed-1",
  );

describe("presetOf", () => {
  it.each(PRESET_IDS)("C-PMATCH-01 matches the %s golden to itself", (id) => {
    expect(presetOf(golden(id))).toBe(id);
  });

  it("C-PMATCH-02 accepts a higher contrast level, a gamut switch and a locked seed", () => {
    const higher = { AA: "AA+", "AA+": "AAA", AAA: "AAA" } as const;
    for (const id of PRESET_IDS) {
      const level = PRESETS[id].params.contrastLevel;
      expect(presetOf(golden(id, { contrastLevel: higher[level] })), id).toBe(id);
    }
    expect(presetOf(golden("minimal-swiss", { contrastLevel: "AA" }))).toBeNull();
    const base = golden("glass");
    expect(presetOf(golden("glass", { gamut: "p3" }))).toBe("glass");
    expect(presetOf(golden("glass", { primary: { l: 0.5, c: 0.1, h: 200 } }))).toBe("glass");
    expect(presetOf(base)).toBe("glass");
  });

  it("C-PMATCH-04 never matches an import or an explicit pairing the preset lacks", () => {
    const imported = structuredClone(golden("glass")) as DesignSpec;
    imported.meta.createdWith = "import";
    expect(presetOf(imported)).toBeNull();
    const other = PAIRINGS.find((item) => item.id !== choosePairing("seed-1"))?.id;
    expect(presetOf(golden("default", { pairing: other }))).toBeNull();
  });

  it("C-PMATCH-05 throws TypeError naming presetOf", () => {
    const broken = structuredClone(golden("default")) as unknown as { color: { params?: unknown } };
    delete broken.color.params;
    for (const run of [() => presetOf(null as never), () => presetOf(broken as never)]) {
      expect(run).toThrow(TypeError);
      expect(run).toThrow(/presetOf/);
    }
  });
});
