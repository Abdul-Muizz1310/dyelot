import { assertOklch } from "../color/guards";
import type { Oklch } from "../color/types";

export type ShadowLayer = {
  offsetY: number;
  blur: number;
  spread: 0;
  color: Oklch;
  alpha: number;
};

const ELEVATIONS = [1, 2, 3, 4, 5] as const;

/**
 * Shadows by elevation (spec R-18). The result has six entries: index 0 is empty, and indexes 1
 * to 5 hold `[key, ambient]`. For elevation L the key layer is `offsetY 2L, blur 4L, alpha 0.10`
 * and the ambient layer is `offsetY L, blur 2L, alpha 0.06`. Every layer carries `neutral950`
 * unchanged as its color.
 */
export function shadows(neutral950: Oklch): readonly ShadowLayer[][] {
  assertOklch(neutral950, "shadows: neutral950");
  return [
    [],
    ...ELEVATIONS.map((level): ShadowLayer[] => [
      { offsetY: 2 * level, blur: 4 * level, spread: 0, color: neutral950, alpha: 0.1 },
      { offsetY: level, blur: 2 * level, spread: 0, color: neutral950, alpha: 0.06 },
    ]),
  ];
}
