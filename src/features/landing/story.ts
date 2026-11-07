import {
  FONT_CATALOG,
  formatOklch,
  type Hex,
  lintSpec,
  measureSpec,
  oklchToRgb,
  type RoleName,
  type Step,
  summarize,
  toHex,
} from "@/engine";
import type { DesignSpec } from "@/spec";

/** The five steps of the landing's story (R5-33, 7.2), as data a server component writes. */
export type StoryStep =
  | { readonly kind: "seed"; readonly hex: Hex; readonly oklch: string }
  | {
      readonly kind: "scale";
      readonly steps: readonly {
        readonly step: Step;
        readonly hex: Hex;
        readonly contrast: string;
      }[];
    }
  | {
      readonly kind: "roles";
      readonly roles: readonly { readonly name: RoleName; readonly hex: Hex }[];
    }
  | {
      readonly kind: "type";
      readonly display: string;
      readonly body: string;
      readonly space: readonly number[];
    }
  | { readonly kind: "receipt"; readonly passed: number; readonly required: number };

/** The light roles the specimen of the `roles` step names, in 7.2's order. */
export const STORY_ROLES = [
  "background",
  "foreground",
  "primary",
  "primary-foreground",
  "border",
  "ring",
] as const satisfies readonly RoleName[];

/** How many `space.scale` values the `type` step shows. */
const SPACE_STEPS = 8;

/** A family's catalog name, or its id for a family outside the catalog. */
function familyName(id: string): string {
  return FONT_CATALOG.find((font) => font.id === id)?.family ?? id;
}

/**
 * The story's five steps for a design with a locked primary seed, in order (7.2). A value that is
 * not an object is a `TypeError`; a design without a locked primary seed is a `RangeError`.
 */
export function storySteps(spec: DesignSpec): readonly StoryStep[] {
  if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
    throw new TypeError(
      `storySteps: spec must be an object, got ${spec === null ? "null" : Array.isArray(spec) ? "array" : typeof spec}`,
    );
  }
  const params = spec.color.params;
  const seed = params.primary;
  if (seed === undefined) {
    throw new RangeError("storySteps: spec.color.params.primary must be a locked seed, got none");
  }
  const { requiredPass, required } = summarize(
    measureSpec(spec),
    lintSpec(spec),
    params.gamut,
  ).contrast;
  return [
    { kind: "seed", hex: toHex(oklchToRgb(seed, "srgb")), oklch: formatOklch(seed) },
    {
      kind: "scale",
      steps: spec.color.palettes.primary.light.map(({ step, hex, contrast }) => ({
        step,
        hex,
        contrast: contrast.toFixed(2),
      })),
    },
    {
      kind: "roles",
      roles: STORY_ROLES.map((name) => ({ name, hex: spec.color.roles.light[name] })),
    },
    {
      kind: "type",
      display: familyName(spec.type.families.display),
      body: familyName(spec.type.families.body),
      space: spec.space.scale.slice(0, SPACE_STEPS),
    },
    { kind: "receipt", passed: requiredPass, required },
  ];
}
