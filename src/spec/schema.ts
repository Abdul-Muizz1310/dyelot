import { GAMUTS, isHex } from "../engine/color/guards";
import { HARMONIES } from "../engine/color/harmony";
import {
  CHROMA_LEVELS,
  CONTRAST_LEVELS,
  type ColorParams,
  NEUTRAL_TINTS,
  type PaletteName,
  SCALE_MODES,
} from "../engine/color/palette";
import { ROLE_NAMES } from "../engine/color/roles";
import { STEPS, type Step } from "../engine/color/scale";
import { RADIUS_SET_NAMES, type RadiusSet } from "../engine/tokens/shape";
import { TYPE_CONTEXTS, type TypeContext, type TypeStepName } from "../engine/tokens/type";
import { z } from "./zod";

/** The version this schema reads and writes. Any other version fails loudly. */
export const SPEC_VERSION = "dyelot.spec/1";

export const DEPTH_STYLES = ["flat", "soft", "layered"] as const;
export const MOTION_FEELS = ["calm", "brisk", "playful"] as const;
export type DepthStyle = (typeof DEPTH_STYLES)[number];
export type MotionFeel = (typeof MOTION_FEELS)[number];

/** The input of `generateSystem`: the color parameters and the choices for the other tokens. */
export type DirectionParams = ColorParams & {
  readonly type: { readonly context: TypeContext; readonly ratio?: number };
  readonly radius: RadiusSet;
  readonly depth: DepthStyle;
  readonly motion: MotionFeel;
  readonly name?: string;
};

// Bounds of R-20.
const NAME_MAX = 80;
const SEED_MAX = 128;
const POLICY_MAX = 64;
const RULES_MAX = 20;
const RULE_MAX = 200;
const ENGINE_VERSION_MAX = 64;
const MODEL_SLUG = /^[\w.:/@+-]{1,120}$/;
const FAMILY_ID = /^[a-z0-9-]{1,64}$/;
/** The fluid `display` size as `typeScale` writes it (R-17): four decimals, nothing else. */
const CLAMP = /^clamp\(-?\d+\.\d{4}rem, -?\d+\.\d{4}rem \+ -?\d+\.\d{4}vw, -?\d+\.\d{4}rem\)$/;

/** The schema is where a parsed string becomes a `Hex` (spec R-05). */
const HexSchema = z.string().refine(isHex, "must be a lowercase #rrggbb hex");
const HueSchema = z.number().min(0).lt(360);
const ChromaSchema = z.number().min(0).max(0.5);
/** I-04 (`c ≤ 4e-6` exactly when `h` is null) is lint rule G3, not a schema rule. */
const OklchSchema = z.strictObject({
  l: z.number().min(0).max(1),
  c: ChromaSchema,
  h: HueSchema.nullable(),
});
const StepSchema = z.literal(STEPS);

function scaleStep<S extends Step>(step: S) {
  return z.strictObject({
    step: z.literal(step),
    oklch: OklchSchema,
    hex: HexSchema,
    contrast: z.number().min(1).max(21),
  });
}

/** Eleven steps in `STEPS` order: a missing, repeated or extra step fails. */
const ScaleSchema = z.tuple([
  scaleStep(50),
  scaleStep(100),
  scaleStep(200),
  scaleStep(300),
  scaleStep(400),
  scaleStep(500),
  scaleStep(600),
  scaleStep(700),
  scaleStep(800),
  scaleStep(900),
  scaleStep(950),
]);

/** A palette stored under its own name, so `palettes.primary.name` is always "primary". */
function palette<N extends PaletteName>(name: N) {
  return z.strictObject({
    name: z.literal(name),
    hue: HueSchema,
    peakChroma: ChromaSchema,
    light: ScaleSchema,
    dark: ScaleSchema,
    seedStep: z.strictObject({ light: StepSchema, dark: StepSchema }).exactOptional(),
    seedDeviation: z
      .strictObject({ step: StepSchema, deltaEOK: z.number().min(0) })
      .exactOptional(),
  });
}

/** Exactly the 46 role names (R-14): a missing or an extra name fails. */
const RoleMapSchema = z.record(z.enum(ROLE_NAMES), HexSchema);

const ColorSchema = z.strictObject({
  params: z.strictObject({
    primary: OklchSchema.exactOptional(),
    secondary: OklchSchema.exactOptional(),
    accent: OklchSchema.exactOptional(),
    harmony: z.enum(HARMONIES),
    chroma: z.enum(CHROMA_LEVELS),
    neutralTint: z.enum(NEUTRAL_TINTS),
    gamut: z.enum(GAMUTS),
    scaleMode: z.enum(SCALE_MODES),
    contrastLevel: z.enum(CONTRAST_LEVELS),
  }),
  palettes: z.strictObject({
    neutral: palette("neutral"),
    primary: palette("primary"),
    secondary: palette("secondary"),
    accent: palette("accent"),
    success: palette("success"),
    warning: palette("warning"),
    danger: palette("danger"),
    info: palette("info"),
  }),
  roles: z.strictObject({ light: RoleMapSchema, dark: RoleMapSchema }),
});

function typeStep<N extends TypeStepName>(name: N) {
  return z.strictObject({
    name: z.literal(name),
    sizePx: z.number().positive(),
    maxSizePx: z.number().positive().exactOptional(),
    clamp: z.string().regex(CLAMP).exactOptional(),
    lineHeightPx: z.number().positive(),
    trackingEm: z.number().min(-0.04).max(0.05),
  });
}

const FamilySchema = z.string().regex(FAMILY_ID);

const TypeSchema = z.strictObject({
  families: z.strictObject({ display: FamilySchema, body: FamilySchema, mono: FamilySchema }),
  context: z.enum(TYPE_CONTEXTS),
  ratio: z.number().gt(1).max(2).exactOptional(),
  steps: z.tuple([
    typeStep("caption"),
    typeStep("label"),
    typeStep("body-sm"),
    typeStep("body"),
    typeStep("lead"),
    typeStep("h4"),
    typeStep("h3"),
    typeStep("h2"),
    typeStep("h1"),
    typeStep("display"),
  ]),
});

const LengthSchema = z.number().min(0);

const ShadowLayerSchema = z.strictObject({
  offsetY: LengthSchema,
  blur: LengthSchema,
  spread: z.literal(0),
  color: OklchSchema,
  alpha: z.number().min(0).max(1),
});
const ShadowPairSchema = z.tuple([ShadowLayerSchema, ShadowLayerSchema]);

/** A cubic-bezier: CSS needs both x values in [0, 1]. */
const BezierSchema = z.tuple([
  z.number().min(0).max(1),
  z.number(),
  z.number().min(0).max(1),
  z.number(),
]);
const SpringSchema = z.strictObject({
  visualDuration: z.number().positive(),
  bounce: z.number().min(0).max(1),
});

const PolicySchema = z.string().min(1).max(POLICY_MAX);
const RulesSchema = z.array(z.string().max(RULE_MAX)).max(RULES_MAX);

const CreatedWithSchema = z.union([
  z.enum(["controls", "lexicon", "on-device", "visitor-key", "import"]),
  z.templateLiteral(["model:", z.string().regex(MODEL_SLUG)]),
]);

/**
 * The `dyelot.spec/1` model of a design system (spec section 6.7, R-19). Every object is strict,
 * so an unknown key fails. Every number is finite (zod 4 rejects NaN and ±Infinity). Optional
 * fields are absent, never undefined: `exactOptional` rejects a key written as undefined (I-09).
 */
export const DesignSpecSchema = z.strictObject({
  version: z.literal(SPEC_VERSION),
  meta: z.strictObject({
    name: z.string().min(1).max(NAME_MAX),
    seed: z.string().min(1).max(SEED_MAX),
    engineVersion: z.string().min(1).max(ENGINE_VERSION_MAX),
    createdWith: CreatedWithSchema,
  }),
  color: ColorSchema,
  type: TypeSchema,
  space: z.strictObject({ basePx: z.literal(4), scale: z.array(LengthSchema).length(12) }),
  shape: z.strictObject({
    radiusSet: z.enum(RADIUS_SET_NAMES),
    radii: z.strictObject({
      sm: LengthSchema,
      md: LengthSchema,
      lg: LengthSchema,
      xl: LengthSchema,
      "2xl": LengthSchema,
      full: z.literal(9999),
    }),
  }),
  depth: z.strictObject({
    style: z.enum(DEPTH_STYLES),
    // R-18: index 0 is empty and indexes 1 to 5 hold [key, ambient].
    shadows: z.tuple([
      z.tuple([]),
      ShadowPairSchema,
      ShadowPairSchema,
      ShadowPairSchema,
      ShadowPairSchema,
      ShadowPairSchema,
    ]),
  }),
  motion: z.strictObject({
    feel: z.enum(MOTION_FEELS),
    durations: z.strictObject({
      instant: LengthSchema,
      fast: LengthSchema,
      quick: LengthSchema,
      base: LengthSchema,
      slow: LengthSchema,
      slower: LengthSchema,
      slowest: LengthSchema,
    }),
    easings: z.strictObject({
      standard: BezierSchema,
      decelerate: BezierSchema,
      accelerate: BezierSchema,
      emphasized: BezierSchema,
    }),
    springs: z.strictObject({ snappy: SpringSchema, smooth: SpringSchema, bouncy: SpringSchema }),
  }),
  components: z.strictObject({
    cards: PolicySchema,
    emphasis: PolicySchema,
    inputs: PolicySchema,
    icons: z.strictObject({ library: PolicySchema, strokePx: z.number().positive() }),
  }),
  rules: z.strictObject({ do: RulesSchema, dont: RulesSchema }),
});

/** A parsed design system. The schema's types are what the rest of the app reads. */
export type DesignSpec = z.infer<typeof DesignSpecSchema>;
