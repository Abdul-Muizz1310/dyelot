import type {
  CHROMA_LEVELS,
  ContrastLevel,
  Density,
  DepthStyle,
  DirectionParams,
  Harmony,
  MotionFeel,
  NEUTRAL_TINTS,
  Oklch,
  PairingId,
  PresetId,
  RadiusSet,
  TypeContext,
} from "@/engine";
import type { CreatedWith } from "@/spec";

// The changes an AI or rule result makes to the studio (docs/specs/04-ai.md, section 5.2). Task 4.1
// holds the two types the store's `applyAi` takes; the change builders join them in later tasks.

type ChromaLevel = (typeof CHROMA_LEVELS)[number];
type NeutralTint = (typeof NEUTRAL_TINTS)[number];
/** The spec entry does not export `Direction`; this is the same type. */
type Direction = NonNullable<DirectionParams["direction"]>;

/** A change of parameters an AI or rule result makes: assignable to the studio's `ParamsPatch`. */
export type AiPatch = {
  readonly primary?: Oklch | undefined;
  readonly secondary?: Oklch | undefined;
  readonly accent?: Oklch | undefined;
  readonly harmony?: Harmony;
  readonly chroma?: ChromaLevel;
  readonly neutralTint?: NeutralTint;
  readonly contrastLevel?: ContrastLevel;
  readonly type?: { readonly context?: TypeContext; readonly ratio?: number };
  readonly radius?: RadiusSet;
  readonly depth?: DepthStyle;
  readonly motion?: MotionFeel;
  readonly pairing?: PairingId | undefined;
  readonly name?: string;
  readonly oneLiner?: string;
  readonly direction?: Direction;
  readonly rules?: { readonly do: readonly string[]; readonly dont: readonly string[] };
};

/**
 * What the store's `applyAi` applies as one commit (R4-37): the preset first, then the patch, then
 * the density, stamped with what made it. An action never makes an "import".
 */
export type AiChange = {
  readonly preset?: PresetId;
  readonly patch: AiPatch;
  readonly density?: Density;
  readonly createdWith: Exclude<CreatedWith, "import">;
};
