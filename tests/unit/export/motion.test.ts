import ts from "typescript";
import { describe, expect, it } from "vitest";
import { springCurve } from "@/engine";
import { motionFiles } from "@/export/motion";
import { cssComment, editLink } from "@/export/text";
import { lotTag, specId } from "@/spec";
import { themeVars } from "@/theme/vars";
import { GOLDENS, ORIGIN, SPEC } from "./golden-support";

// C-MOT-01 to 05 of docs/specs/03-export.md, section 10.6 (R3-09, R3-13, R3-20, section 6.7).

const LOT = lotTag(specId(SPEC));
const FILES = motionFiles(SPEC, "untitled", LOT, ORIGIN);
const textOf = (path: string, files = FILES): string =>
  files.find((file) => file.path === path)?.text ?? "";
const CSS = textOf("motion/motion.css");
const SPRINGS = ["snappy", "smooth", "bouncy"] as const;
const DURATIONS = ["instant", "fast", "quick", "base", "slow", "slower", "slowest"] as const;
const EASINGS = ["standard", "decelerate", "accelerate", "emphasized"] as const;

/** Transpiles a module to ESNext, drops its `export` keywords and returns what it exported. */
function evaluate(source: string): Record<string, unknown> {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const names = [...outputText.matchAll(/^export const (\w+)\b/gm)].map((m) => m[1]);
  const body = outputText.replace(/^export const /gm, "const ");
  return new Function(`${body}\nreturn { ${names.join(", ")} };`)() as Record<string, unknown>;
}

describe("motionFiles", () => {
  it("C-MOT-01: three files in order, LF only, one final newline, no trailing blanks", () => {
    expect(FILES.map((file) => file.path)).toEqual([
      "motion/motion.css",
      "motion/motion.ts",
      "motion/gsap.ts",
    ]);
    for (const { text } of FILES) {
      expect(text).not.toContain("\r");
      expect(text.endsWith("\n")).toBe(true);
      expect(text.endsWith("\n\n")).toBe(false);
      expect(text).not.toMatch(/[ \t]$/m);
    }
  });

  it("C-MOT-02: motion.css header, :root and the reduced-motion block", () => {
    const bridge = themeVars(SPEC, "light");
    const link = editLink(SPEC, ORIGIN);
    const samples = (name: (typeof SPRINGS)[number]) =>
      `linear(${springCurve(SPEC.motion.springs[name]).samples.join(", ")})`;
    const root = [
      ...DURATIONS.map((name) => `  --duration-${name}: ${bridge[`--duration-${name}`]};`),
      ...EASINGS.map((name) => `  --ease-${name}: ${bridge[`--ease-${name}`]};`),
      ...SPRINGS.map((name) => `  --spring-${name}: ${samples(name)};`),
      "  --spring-snappy-settle: 411ms;",
      "  --spring-smooth-settle: 706ms;",
      "  --spring-bouncy-settle: 1056ms;",
    ];
    const reduced = [
      ...SPRINGS.map((name) => `    --spring-${name}: linear(0, 1);`),
      ...SPRINGS.map((name) => `    --spring-${name}-settle: var(--duration-fast);`),
    ];
    expect(CSS).toBe(
      `${[
        cssComment(`dyelot design system: ${SPEC.meta.name} (LOT ${LOT})`),
        cssComment(`Made with dyelot. Edit this design: ${link}`),
        cssComment("Generated: change the design in the studio and export it again, not by hand."),
        ":root {",
        ...root,
        "}",
        "",
        "@media (prefers-reduced-motion: reduce) {",
        "  :root {",
        ...reduced,
        "  }",
        "}",
      ].join("\n")}\n`,
    );
    expect(samples("snappy").split(", ")).toHaveLength(26);
    expect(samples("smooth").split(", ")).toHaveLength(44);
    expect(samples("bouncy").split(", ")).toHaveLength(65);
  });

  it("C-MOT-03: motion.ts has no imports and exports the tokens", () => {
    const text = textOf("motion/motion.ts");
    expect(text).not.toMatch(/\bimport\b|\brequire\b/);
    const exported = evaluate(text);
    expect(exported.durations).toEqual({
      instant: 50,
      fast: 100,
      quick: 150,
      base: 200,
      slow: 300,
      slower: 400,
      slowest: 500,
    });
    expect(exported.easings).toEqual({
      standard: [0.2, 0, 0, 1],
      decelerate: [0, 0, 0, 1],
      accelerate: [0.3, 0, 1, 1],
      emphasized: [0.05, 0.7, 0.1, 1],
    });
    expect(exported.springs).toEqual({
      snappy: { type: "spring", visualDuration: 0.25, bounce: 0.1 },
      smooth: { type: "spring", visualDuration: 0.4, bounce: 0 },
      bouncy: { type: "spring", visualDuration: 0.5, bounce: 0.35 },
    });
    expect(exported.springSettleMs).toEqual({ snappy: 411, smooth: 706, bouncy: 1056 });
  });

  it("C-MOT-04: gsap.ts has no imports; seconds and CustomEase strings; calm scales", () => {
    const text = textOf("motion/gsap.ts");
    expect(text).not.toMatch(/\bimport\b|\brequire\b/);
    const code = text
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
      .join("\n");
    expect(text).toContain("CustomEase.create");
    expect(code).not.toContain("CustomEase");
    const exported = evaluate(text);
    expect(exported.durations).toEqual({
      instant: 0.05,
      fast: 0.1,
      quick: 0.15,
      base: 0.2,
      slow: 0.3,
      slower: 0.4,
      slowest: 0.5,
    });
    expect(exported.eases).toEqual({
      standard: "0.2,0,0,1",
      decelerate: "0,0,0,1",
      accelerate: "0.3,0,1,1",
      emphasized: "0.05,0.7,0.1,1",
    });
    const editorial = GOLDENS.find((golden) => golden.id === "editorial")?.spec;
    expect(editorial?.motion.feel).toBe("calm");
    if (editorial === undefined) return;
    const calm = motionFiles(editorial, "untitled", lotTag(specId(editorial)), ORIGIN);
    const ms = [63, 125, 188, 250, 375, 500, 500];
    const css = textOf("motion/motion.css", calm);
    DURATIONS.forEach((name, index) => {
      expect(css).toContain(`--duration-${name}: ${ms[index]}ms;`);
    });
    expect(Object.values(evaluate(textOf("motion/motion.ts", calm)).durations as object)).toEqual(
      ms,
    );
    expect(Object.values(evaluate(textOf("motion/gsap.ts", calm)).durations as object)).toEqual(
      ms.map((value) => value / 1000),
    );
  });

  it("C-MOT-05: wrong inputs throw, naming motionFiles", () => {
    expect(() => motionFiles(null as never, "n", LOT, ORIGIN)).toThrow(TypeError);
    expect(() => motionFiles(null as never, "n", LOT, ORIGIN)).toThrow(/motionFiles/);
    expect(() => motionFiles(SPEC, "n", "0123-4567", ORIGIN)).toThrow(RangeError);
    expect(() => motionFiles(SPEC, "n", "0123-4567", ORIGIN)).toThrow(/motionFiles/);
    expect(() => motionFiles(SPEC, "n", "ABCD·4567", ORIGIN)).toThrow(RangeError);
    expect(() => motionFiles(SPEC, 3 as never, LOT, ORIGIN)).toThrow(TypeError);
    expect(() => motionFiles(SPEC, 3 as never, LOT, ORIGIN)).toThrow(/motionFiles/);
    expect(() => motionFiles(SPEC, "n", 3 as never, ORIGIN)).toThrow(TypeError);
  });
});
