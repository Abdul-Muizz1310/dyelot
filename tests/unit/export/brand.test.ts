import { describe, expect, it } from "vitest";
import { lintSpec, measureSpec, springCurve, summarize } from "@/engine";
import { brandProps } from "@/export/brand";
import { lotTag, specId } from "@/spec";
import { themeVars } from "@/theme/vars";
import { SPEC } from "./golden-support";

// C-FEX-07 and C-FEX-08 of docs/specs/05-motion-3d.md, section 14.4 (R5-30).

const PALETTES = ["primary", "secondary", "accent", "neutral", "danger"] as const;
const ROLES = [
  "background",
  "foreground",
  "card",
  "cardForeground",
  "primary",
  "primaryForeground",
  "mutedForeground",
  "border",
] as const;
const KEBAB: Record<(typeof ROLES)[number], string> = {
  background: "background",
  foreground: "foreground",
  card: "card",
  cardForeground: "card-foreground",
  primary: "primary",
  primaryForeground: "primary-foreground",
  mutedForeground: "muted-foreground",
  border: "border",
};

describe("C-FEX-07 brandProps", () => {
  const props = brandProps(SPEC, "light");
  const vars = themeVars(SPEC, "light");
  const contrast = summarize(measureSpec(SPEC), lintSpec(SPEC), "srgb").contrast;

  it("C-FEX-07 holds the name, one-liner, lot and checks", () => {
    expect(props.name).toBe("untitled");
    expect(props.oneLiner).toBe("");
    expect(props.lot).toBe(lotTag(specId(SPEC)));
    expect(props.checks).toEqual({ passed: contrast.requiredPass, required: contrast.required });
  });

  it("C-FEX-07 holds five palettes of 11 light hexes, in order", () => {
    expect(props.palettes.map((p) => p.name)).toEqual([...PALETTES]);
    for (const palette of props.palettes) {
      expect(palette.steps).toEqual(
        SPEC.color.palettes[palette.name as (typeof PALETTES)[number]].light.map((s) => s.hex),
      );
      expect(palette.steps).toHaveLength(11);
    }
  });

  it("C-FEX-07 holds the eight light roles and the two font stacks", () => {
    expect(Object.keys(props.colors)).toEqual([...ROLES]);
    for (const role of ROLES) expect(props.colors[role]).toBe(vars[`--${KEBAB[role]}`]);
    expect(props.fonts).toEqual({ display: vars["--font-display"], body: vars["--font-body"] });
  });

  it("C-FEX-07 holds the motion tokens and the three spring curves", () => {
    expect(props.motion.baseMs).toBe(200);
    expect(props.motion.standard).toEqual([0.2, 0, 0, 1]);
    expect(Object.keys(props.motion.springs)).toEqual(["snappy", "smooth", "bouncy"]);
    for (const id of ["snappy", "smooth", "bouncy"] as const) {
      const { settleMs, samples } = springCurve(SPEC.motion.springs[id]);
      expect(props.motion.springs[id]).toEqual({ settleMs, samples });
    }
    expect(Object.values(props.motion.springs).map((s) => s.settleMs)).toEqual([411, 706, 1056]);
  });

  it("C-FEX-07 survives a JSON round trip", () => {
    expect(JSON.parse(JSON.stringify(props))).toEqual(props);
  });

  it("C-FEX-07 reads the dark mode's hexes", () => {
    const dark = brandProps(SPEC, "dark");
    expect(dark.colors.background).toBe(themeVars(SPEC, "dark")["--background"]);
    expect(dark.palettes[0]?.steps).toEqual(SPEC.color.palettes.primary.dark.map((s) => s.hex));
  });
});

describe("C-FEX-08 brandProps checks its arguments", () => {
  it("C-FEX-08 throws TypeError for a non-object spec and RangeError for a bad mode", () => {
    expect(() => brandProps(null as never, "light")).toThrow(TypeError);
    expect(() => brandProps(null as never, "light")).toThrow(/^brandProps/);
    expect(() => brandProps(SPEC, "dim" as never)).toThrow(RangeError);
    expect(() => brandProps(SPEC, "dim" as never)).toThrow(/^brandProps/);
    expect(() => brandProps(SPEC, 1 as never)).toThrow(TypeError);
  });
});
