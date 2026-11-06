import { DoubleSide } from "three";
import { describe, expect, it } from "vitest";
import type { Hex } from "@/engine";
import { solidMaterial, stepMaterial, tubeMaterial } from "@/features/explore/materials";

// The explorer's three materials (docs/specs/05-motion-3d.md, R5-36 and I-M5-01). R3F turns on ACES
// Filmic tone mapping when `<Canvas>` has no `flat`, and 8.3's props leave it out, so each material
// opts out of tone mapping to show the design's hexes (recorded at Task 5.6b's review).

const MADDER = "#b5413a" as Hex;

describe("the explorer's materials (R5-36)", () => {
  it("R5-36 I-M5-01 the spheres', the tubes' and the solid's materials are not tone-mapped", () => {
    const materials = { step: stepMaterial(), tube: tubeMaterial(MADDER), solid: solidMaterial() };
    for (const [name, material] of Object.entries(materials)) {
      expect(material.toneMapped, name).toBe(false);
    }
  });

  it("R5-36 a tube takes its hex, and the solid keeps its vertex colors, opacity and sides", () => {
    expect(tubeMaterial(MADDER).color.getHexString()).toBe("b5413a");
    const solid = solidMaterial();
    expect({
      vertexColors: solid.vertexColors,
      transparent: solid.transparent,
      opacity: solid.opacity,
      depthWrite: solid.depthWrite,
      side: solid.side,
    }).toEqual({
      vertexColors: true,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: DoubleSide,
    });
  });
});
