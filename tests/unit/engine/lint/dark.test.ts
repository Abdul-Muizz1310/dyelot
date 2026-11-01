import { describe, expect, it } from "vitest";
import { lintSpec } from "@/engine/lint";
import { defaultSpec } from "../../spec/support";
import { copyOf, expectFinding, expectSilent, lightnessOf, loose, withId } from "./support";

// D1 to D4: the dark-mode rules (C-LINT-32 to 39). They report mode "dark" only.

describe("D1 the dark page is not black", () => {
  it("C-LINT-32 stays silent on the base spec (L about 0.181)", () => {
    expect(lightnessOf(defaultSpec().color.roles.dark.background)).toBeCloseTo(0.181, 2);
    expectSilent(defaultSpec(), "D1");
  });

  it("C-LINT-33 warns for a #000000 dark background", () => {
    const spec = copyOf();
    loose(spec).color.roles.dark.background = "#000000";
    loose(spec).color.roles.light.background = "#000000";
    const found = expectFinding(spec, {
      id: "D1",
      severity: "warn",
      mode: "dark",
      subject: "background",
      measured: 0,
      threshold: 0.15,
    });
    expect(found.source).toBe("Material dark theme guidance");
    expect(withId(lintSpec(spec), "D1")).toHaveLength(1);
  });
});

describe("D2 dark body text is off-white", () => {
  it("C-LINT-34 stays silent on the base spec (L about 0.936)", () => {
    expect(lightnessOf(defaultSpec().color.roles.dark.foreground)).toBeCloseTo(0.936, 2);
    expectSilent(defaultSpec(), "D2");
  });

  it("C-LINT-35 warns above 0.96 and below 0.92", () => {
    for (const [text, threshold] of [
      ["#ffffff", 0.96],
      ["#cccccc", 0.92],
    ] as const) {
      const spec = copyOf();
      loose(spec).color.roles.dark.foreground = text;
      const found = expectFinding(spec, {
        id: "D2",
        severity: "warn",
        mode: "dark",
        subject: "foreground",
        measured: lightnessOf(text),
        threshold,
      });
      expect(found.source).toBe("off-white body text (Radix, Material)");
    }
    expect(lightnessOf("#cccccc")).toBeCloseTo(0.8452, 4);
  });
});

describe("D3 dark fills carry no more chroma than light ones", () => {
  it("C-LINT-36 stays silent with every dark chroma halved", () => {
    const spec = copyOf();
    for (const palette of Object.values(loose(spec).color.palettes)) {
      for (const step of (palette as { dark: { oklch: { c: number } }[] }).dark) {
        step.oklch.c /= 2;
      }
    }
    expectSilent(spec, "D3");
  });

  it("C-LINT-37 warns when primary dark 600 exceeds its light chroma", () => {
    const spec = copyOf();
    const light = spec.color.palettes.primary.light[6].oklch.c;
    loose(spec).color.palettes.primary.dark[6].oklch.c = light + 0.05;
    const found = expectFinding(spec, {
      id: "D3",
      severity: "warn",
      mode: "dark",
      subject: "primary-600",
      measured: light + 0.05,
      threshold: light,
    });
    expect(found.source).toBe("Material guidance on dark-mode accents");
  });

  it("ignores the neutral palette and steps outside 500 to 700", () => {
    const spec = copyOf();
    for (const palette of Object.values(loose(spec).color.palettes)) {
      for (const step of (palette as { dark: { oklch: { c: number } }[] }).dark) {
        step.oklch.c /= 2;
      }
    }
    loose(spec).color.palettes.neutral.dark[6].oklch.c = 0.3;
    loose(spec).color.palettes.primary.dark[8].oklch.c = 0.3;
    expectSilent(spec, "D3");
  });
});

describe("D4 the dark card sits above the page", () => {
  it("C-LINT-38 stays silent on the base spec (L 0.212 against 0.181)", () => {
    expect(lightnessOf(defaultSpec().color.roles.dark.card)).toBeCloseTo(0.212, 2);
    expectSilent(defaultSpec(), "D4");
  });

  it("C-LINT-39 warns when the dark card equals the page", () => {
    const spec = copyOf();
    const page = spec.color.roles.dark.background;
    loose(spec).color.roles.dark.card = page;
    const found = expectFinding(spec, {
      id: "D4",
      severity: "warn",
      mode: "dark",
      subject: "card/background",
      measured: lightnessOf(page),
      threshold: lightnessOf(page),
    });
    expect(found.source).toBe("Material 3 tonal elevation");
  });
});
