import { describe, expect, it } from "vitest";
import { FONT_CATALOG, type FontEntry } from "@/engine/fonts/catalog";
import { PAIRINGS } from "@/engine/fonts/pairings";
import { generateSystem } from "@/engine/generate";
import { typeWeights } from "@/engine/tokens/weights";
import type { DesignSpec } from "@/spec";
import { DEFAULT_PARAMS, defaultSpec } from "../../spec/support";

// Cases are the C-WGT-nn rows of docs/specs/03-export.md, section 10.2 (R3-05, R3-06).

const withPairing = (pairing: string): DesignSpec =>
  generateSystem({ ...DEFAULT_PARAMS, pairing }, "seed-1");

/** A spec whose families are the given ids. */
function withFamilies(display: string, body: string, mono: string): DesignSpec {
  const spec = structuredClone(defaultSpec());
  spec.type.families = { display, body, mono };
  return spec;
}

const entry = (id: string, variable: boolean, weights: readonly number[]): FontEntry => ({
  id,
  family: id,
  category: "sans",
  variable,
  axes: variable ? ["wght"] : [],
  weights,
  license: "OFL-1.1",
  popularity: 1,
  fallback: "sans-serif",
});

describe("typeWeights", () => {
  it("C-WGT-01 reads Host Grotesk as 650, 500 and 400", () => {
    expect(typeWeights(defaultSpec())).toEqual({ heading: 650, label: 500, body: 400 });
  });

  it.each([
    ["gloock-albert", 400],
    ["young-onest", 400],
    ["tiny5-spline", 400],
    ["redaction-redhat", 700],
  ])("C-WGT-02 a static display face of %s gives heading %i", (pairing, heading) => {
    expect(typeWeights(withPairing(pairing))).toEqual({ heading, label: 500, body: 400 });
  });

  it("C-WGT-03 clamps to a given catalog", () => {
    const catalog = [
      entry("d-var", true, [300, 600]),
      entry("b-var", true, [550, 900]),
      entry("b-static", false, [400, 600]),
      entry("b-light", false, [300]),
      entry("m", false, [400]),
    ];
    expect(typeWeights(withFamilies("d-var", "b-var", "m"), catalog)).toEqual({
      heading: 600,
      label: 550,
      body: 550,
    });
    expect(typeWeights(withFamilies("d-var", "b-static", "m"), catalog)).toMatchObject({
      label: 600,
      body: 400,
    });
    expect(typeWeights(withFamilies("d-var", "b-light", "m"), catalog)).toMatchObject({
      label: 300,
      body: 300,
    });
  });

  it("C-WGT-04 keeps the base weights outside the catalog and reads the given catalog", () => {
    expect(typeWeights(withFamilies("inter", "inter", "jetbrains-mono"))).toEqual({
      heading: 650,
      label: 500,
      body: 400,
    });
    // In place of FONT_CATALOG: host-grotesk is unknown to an empty catalog.
    expect(typeWeights(withFamilies("redaction", "host-grotesk", "fragment-mono"), [])).toEqual({
      heading: 650,
      label: 500,
      body: 400,
    });
  });

  it("C-WGT-05 throws TypeError naming typeWeights", () => {
    for (const run of [
      () => typeWeights(null as never),
      () => typeWeights({} as never),
      () => typeWeights(defaultSpec(), "x" as never),
    ]) {
      expect(run).toThrow(TypeError);
      expect(run).toThrow(/typeWeights/);
    }
  });

  it("C-WGT-06 renders 600 on every pairing's body family", () => {
    expect(PAIRINGS).toHaveLength(20);
    for (const pairing of PAIRINGS) {
      const font = FONT_CATALOG.find((item) => item.id === pairing.body);
      expect(font, pairing.id).toBeDefined();
      const heaviest = Math.max(...(font?.weights ?? []));
      expect(heaviest, pairing.id).toBeGreaterThanOrEqual(600);
    }
  });
});
