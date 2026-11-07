import { describe, expect, it } from "vitest";
import { defaultDesign } from "@/features/landing/heroes";
import { storySteps } from "@/features/landing/story";
import type { DesignSpec } from "@/spec";

// C-HYG6-07 of docs/specs/06-gallery.md, section 14 (R6-42): storySteps checks its shape.

const PATHS: readonly [string, "object" | "array"][] = [
  ["spec.color", "object"],
  ["spec.color.params", "object"],
  ["spec.color.palettes", "object"],
  ["spec.color.palettes.primary", "object"],
  ["spec.color.palettes.primary.light", "array"],
  ["spec.color.roles", "object"],
  ["spec.color.roles.light", "object"],
  ["spec.type", "object"],
  ["spec.type.families", "object"],
  ["spec.space", "object"],
  ["spec.space.scale", "array"],
];

/** A copy of the hero design with `path` (below `spec`) replaced by `value`. */
function broken(path: string, value: unknown): DesignSpec {
  const copy = structuredClone(defaultDesign()) as unknown as Record<string, unknown>;
  const keys = path.split(".").slice(1);
  let node = copy;
  for (const key of keys.slice(0, -1)) node = node[key] as Record<string, unknown>;
  node[keys.at(-1) as string] = value;
  return copy as unknown as DesignSpec;
}

describe("storySteps shape checks (R6-42)", () => {
  it("C-HYG6-07 names the first missing path in order, starting with storySteps", () => {
    expect(() => storySteps({} as DesignSpec)).toThrow(
      new TypeError("storySteps: spec.color must be an object, got undefined"),
    );
    for (const [path, kind] of PATHS) {
      const bad = broken(path, undefined);
      const article = kind === "array" ? "an array" : "an object";
      expect(() => storySteps(bad), path).toThrow(TypeError);
      expect(() => storySteps(bad), path).toThrow(
        `storySteps: ${path} must be ${article}, got undefined`,
      );
      if (kind === "array") {
        expect(() => storySteps(broken(path, {})), path).toThrow(
          `storySteps: ${path} must be an array, got object`,
        );
      }
    }
  });
});
