import { assertFinite, assertOneOf, describeType } from "../color/guards";

export type TypeStepName =
  | "caption"
  | "label"
  | "body-sm"
  | "body"
  | "lead"
  | "h4"
  | "h3"
  | "h2"
  | "h1"
  | "display";

export type TypeStep = {
  name: TypeStepName;
  sizePx: number;
  /** Set on a fluid step: the size at the widest viewport. */
  maxSizePx?: number;
  /** Set on a fluid step: the CSS `clamp()` between `sizePx` and `maxSizePx`. */
  clamp?: string;
  lineHeightPx: number;
  trackingEm: number;
};

export const TYPE_CONTEXTS = ["dense", "product", "marketing", "editorial", "poster"] as const;
export type TypeContext = (typeof TYPE_CONTEXTS)[number];

/** Each step with its exponent of the ratio, counted from body, and its line-height multiplier. */
const STEPS: ReadonlyArray<{
  name: TypeStepName;
  exponent: number;
  lineHeight: number;
}> = [
  { name: "caption", exponent: -2, lineHeight: 1.4 },
  { name: "label", exponent: -1, lineHeight: 1.4 },
  { name: "body-sm", exponent: -1, lineHeight: 1.45 },
  { name: "body", exponent: 0, lineHeight: 1.5 },
  { name: "lead", exponent: 1, lineHeight: 1.5 },
  { name: "h4", exponent: 1, lineHeight: 1.4 },
  { name: "h3", exponent: 2, lineHeight: 1.33 },
  { name: "h2", exponent: 3, lineHeight: 1.25 },
  { name: "h1", exponent: 4, lineHeight: 1.2 },
  { name: "display", exponent: 5, lineHeight: 1.1 },
];

type Basis = {
  /** Body size and ratio at the narrow viewport (the only ones, unless `fluid`). */
  basePx: number;
  ratio: number;
  /** Body size and ratio at the wide viewport; the display step alone follows them. */
  fluid?: { basePx: number; ratio: number };
};

const CONTEXT_BASIS: Readonly<Record<TypeContext, Basis>> = {
  dense: { basePx: 14, ratio: 1.2 },
  product: { basePx: 16, ratio: 1.25 },
  poster: { basePx: 18, ratio: 1.5 },
  marketing: { basePx: 18, ratio: 1.2, fluid: { basePx: 20, ratio: 1.25 } },
  editorial: { basePx: 18, ratio: 1.2, fluid: { basePx: 20, ratio: 1.25 } },
};

/** The viewports, in px, that a fluid step spans. */
const VIEWPORT_MIN_PX = 360;
const VIEWPORT_MAX_PX = 1240;
const REM_PX = 16;

const TRACKING_MIN = -0.04;
const TRACKING_MAX = 0.05;

/** `-0.0223 + 0.185 e^(-0.1745 px)` em, clamped (spec section 6.6). */
function trackingFor(sizePx: number): number {
  const raw = -0.0223 + 0.185 * Math.exp(-0.1745 * sizePx);
  return Math.min(TRACKING_MAX, Math.max(TRACKING_MIN, raw));
}

/** The product snapped to the nearest multiple of 4, rounded up on a tie (spec R-16). */
function snapLineHeight(sizePx: number, multiplier: number): number {
  return 4 * Math.floor((sizePx * multiplier) / 4 + 0.5);
}

/** The Utopia `clamp()` of a size that runs from `sizePx` to `maxSizePx` across the viewports. */
function fluidClamp(sizePx: number, maxSizePx: number): string {
  const slope = (maxSizePx - sizePx) / (VIEWPORT_MAX_PX - VIEWPORT_MIN_PX);
  const intercept = (sizePx - slope * VIEWPORT_MIN_PX) / REM_PX;
  const fixed = (value: number) => value.toFixed(4);
  return `clamp(${fixed(sizePx / REM_PX)}rem, ${fixed(intercept)}rem + ${fixed(slope * 100)}vw, ${fixed(maxSizePx / REM_PX)}rem)`;
}

/**
 * The ten type steps of a context (spec R-16 and R-17). A `ratio` replaces the context's ratio at
 * both ends of a fluid scale and must lie in (1, 2]. Only `display` is fluid, in marketing and
 * editorial: it carries `maxSizePx` and `clamp`, and its line height follows `maxSizePx` so a line
 * never undercuts the font.
 */
export function typeScale(input: { context: TypeContext; ratio?: number }): readonly TypeStep[] {
  if (typeof input !== "object" || input === null) {
    throw new TypeError(`typeScale: input must be an object, got ${describeType(input)}`);
  }
  assertOneOf(input.context, TYPE_CONTEXTS, "typeScale: context");
  const override = input.ratio;
  if (override !== undefined) {
    assertFinite(override, "typeScale: ratio");
    if (override <= 1 || override > 2) {
      throw new RangeError(`typeScale: ratio must lie in (1, 2], got ${override}`);
    }
  }
  const basis = CONTEXT_BASIS[input.context];
  const narrowRatio = override ?? basis.ratio;
  const wideRatio = override ?? basis.fluid?.ratio ?? basis.ratio;

  return STEPS.map(({ name, exponent, lineHeight }): TypeStep => {
    const sizePx = basis.basePx * narrowRatio ** exponent;
    if (basis.fluid !== undefined && name === "display") {
      const maxSizePx = basis.fluid.basePx * wideRatio ** exponent;
      return {
        name,
        sizePx,
        maxSizePx,
        clamp: fluidClamp(sizePx, maxSizePx),
        lineHeightPx: snapLineHeight(maxSizePx, lineHeight),
        trackingEm: trackingFor(sizePx),
      };
    }
    return {
      name,
      sizePx,
      lineHeightPx: snapLineHeight(sizePx, lineHeight),
      trackingEm: trackingFor(sizePx),
    };
  });
}
