import { describe, expect, it } from "vitest";
import type { DirectionParams } from "@/engine";
import { choosePairing, PAIRINGS } from "@/engine/fonts/pairings";
import { generateSystem } from "@/engine/generate";
import { freshParams, paramsOfSpec, resolveParams } from "@/engine/params";
import { applyPreset, PRESET_IDS, PRESETS, type PresetId, presetOf } from "@/engine/presets";
import type { DesignSpec } from "@/spec";
import { PROPERTY_TIMEOUT } from "../spec/support";

// C-PMATCH-03 of docs/specs/03-export.md, section 10.2 (R3-07): 14 presets, nine changes each,
// 126 generations. It has a file of its own because it takes more than 10 s alone.

const golden = (id: PresetId): DesignSpec =>
  generateSystem(
    resolveParams({ ...applyPreset(freshParams(), id), name: PRESETS[id].label }, "seed-1"),
    "seed-1",
  );

describe("presetOf over changed parameters", () => {
  it(
    "C-PMATCH-03 never matches the own id after one parameter changes",
    () => {
      const changes: Array<[string, (p: DirectionParams) => Partial<DirectionParams>]> = [
        ["harmony", (p) => ({ harmony: p.harmony === "triadic" ? "split" : "triadic" })],
        ["chroma", (p) => ({ chroma: p.chroma === "vivid" ? "muted" : "vivid" })],
        ["neutralTint", (p) => ({ neutralTint: p.neutralTint === "warm" ? "cool" : "warm" })],
        ["scaleMode", (p) => ({ scaleMode: p.scaleMode === "even" ? "standard" : "even" })],
        [
          "context",
          (p) => ({ type: { context: p.type.context === "poster" ? "dense" : "poster" } }),
        ],
        ["radius", (p) => ({ radius: p.radius === "round" ? "sharp" : "round" })],
        ["depth", (p) => ({ depth: p.depth === "layered" ? "flat" : "layered" })],
        ["motion", (p) => ({ motion: p.motion === "playful" ? "calm" : "playful" })],
        [
          "pairing",
          (p) => ({
            pairing: PAIRINGS.find(
              (item) => item.id !== p.pairing && item.id !== choosePairing("seed-1"),
            )?.id,
          }),
        ],
      ];
      for (const id of PRESET_IDS) {
        const { params } = paramsOfSpec(golden(id));
        for (const [name, change] of changes) {
          const spec = generateSystem(
            resolveParams({ ...params, ...change(params) }, "seed-1"),
            "seed-1",
          );
          const found = presetOf(spec);
          if (found === null) continue;
          expect(found, `${id} with ${name}`).not.toBe(id);
          // Another preset: the result matches that preset's values.
          expect(PRESET_IDS).toContain(found);
        }
      }
    },
    PROPERTY_TIMEOUT,
  );
});
