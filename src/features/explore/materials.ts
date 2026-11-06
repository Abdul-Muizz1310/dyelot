import { Color, DoubleSide, MeshBasicMaterial } from "three";
import type { Hex } from "@/engine";

// The explorer's three materials (R5-36, 8.3), made in one place so a test can read them without
// WebGL. Each is unlit and opts out of tone mapping: R3F turns on ACES Filmic tone mapping when
// `<Canvas>` has no `flat`, and a tone-mapped step would not show its hex (I-M5-01).

const SOLID_OPACITY = 0.35;

/** The step spheres' material; each instance takes its own color. */
export function stepMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({ toneMapped: false });
}

/** A scale's tube, in its step 500 color. */
export function tubeMaterial(hex: Hex): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: new Color(hex), toneMapped: false });
}

/** The gamut's solid: its vertex colors, see-through, both sides drawn, no depth writes. */
export function solidMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: SOLID_OPACITY,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  });
}
