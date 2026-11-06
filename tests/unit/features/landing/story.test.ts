import { describe, expect, it } from "vitest";
import {
  FONT_CATALOG,
  freshParams,
  generateSystem,
  lintSpec,
  measureSpec,
  summarize,
} from "@/engine";
import { defaultDesign } from "@/features/landing/heroes";
import { storySteps } from "@/features/landing/story";

// C-LAND5-03 and C-LAND5-04 of docs/specs/05-motion-3d.md, section 14.5 (R5-33, 7.2).

const HERO = defaultDesign();
const family = (id: string) => FONT_CATALOG.find((f) => f.id === id)?.family ?? id;

describe("storySteps (7.2)", () => {
  it("C-LAND5-03 gives the five steps in order, from the first hero design", () => {
    const steps = storySteps(HERO);
    expect(steps.map((s) => s.kind)).toEqual(["seed", "scale", "roles", "type", "receipt"]);
    expect(steps[0]).toEqual({ kind: "seed", hex: "#f66c6d", oklch: "oklch(0.7000 0.1700 22.00)" });

    const scale = steps[1];
    if (scale?.kind !== "scale") throw new Error("not a scale");
    expect(scale.steps).toHaveLength(11);
    expect(scale.steps).toEqual(
      HERO.color.palettes.primary.light.map((s) => ({
        step: s.step,
        hex: s.hex,
        contrast: s.contrast.toFixed(2),
      })),
    );

    const roles = steps[2];
    if (roles?.kind !== "roles") throw new Error("not roles");
    expect(roles.roles.map((r) => r.name)).toEqual([
      "background",
      "foreground",
      "primary",
      "primary-foreground",
      "border",
      "ring",
    ]);
    for (const r of roles.roles) expect(r.hex).toBe(HERO.color.roles.light[r.name]);

    expect(steps[3]).toEqual({
      kind: "type",
      display: family(HERO.type.families.display),
      body: family(HERO.type.families.body),
      space: HERO.space.scale.slice(0, 8),
    });

    const { requiredPass, required } = summarize(
      measureSpec(HERO),
      lintSpec(HERO),
      HERO.color.params.gamut,
    ).contrast;
    expect(steps[4]).toEqual({ kind: "receipt", passed: requiredPass, required });
  });

  it("C-LAND5-03 names a family outside the catalog by its id", () => {
    const spec = {
      ...HERO,
      type: { ...HERO.type, families: { ...HERO.type.families, display: "no-such-family" } },
    };
    const type = storySteps(spec)[3];
    expect(type?.kind === "type" && type.display).toBe("no-such-family");
  });

  it("C-LAND5-04 a spec that is not an object is a TypeError", () => {
    expect(() => storySteps(null as never)).toThrow(TypeError);
    expect(() => storySteps(null as never)).toThrow(/^storySteps/);
  });

  it.each([[[]], ["spec"], [3]])("C-LAND5-04 %j is a TypeError naming what it is", (value) => {
    expect(() => storySteps(value as never)).toThrow(/^storySteps: spec must be an object, got /);
    expect(() => storySteps(value as never)).toThrow(TypeError);
  });

  it("C-LAND5-04 a spec with no locked primary seed is a RangeError", () => {
    const spec = generateSystem(freshParams(), "story-unlocked");
    expect(() => storySteps(spec)).toThrow(RangeError);
    expect(() => storySteps(spec)).toThrow(/^storySteps/);
  });
});
