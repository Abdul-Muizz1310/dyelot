import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { generateSystem, resolveParams } from "@/engine";
import { agentsSnippet } from "@/export/agents";
import { designMd } from "@/export/design-md";
import { promptMd } from "@/export/prompt";
import { describeDesign } from "@/export/prose";
import { editLink, mdText } from "@/export/text";
import { themeCss } from "@/export/theme-css";
import type { DesignSpec } from "@/spec";
import { DEFAULT_PARAMS } from "../spec/support";
import { ORIGIN, SPEC } from "./golden-support";

// C-PRM-01 to 03 of docs/specs/03-export.md, section 10.8 (6.11, R3-10).

function specWith(patch: {
  name?: string;
  oneLiner?: string;
  direction?: { thesis: string };
}): DesignSpec {
  return generateSystem(
    resolveParams({ ...DEFAULT_PARAMS, ...patch } as never, "seed-1"),
    "seed-1",
  );
}

describe("promptMd", () => {
  it("C-PRM-01: holds its parts in order", () => {
    const spec = specWith({
      name: "Tide",
      oneLiner: "A calm tide chart.",
      direction: { thesis: "Quiet water." },
    });
    const text = promptMd(spec, ORIGIN);
    const at = (needle: string) => {
      const i = text.indexOf(needle);
      expect(i, needle).toBeGreaterThanOrEqual(0);
      return i;
    };
    const order = [
      at("# Build with the Tide design system\n"),
      at("Follow every rule below"),
      at("A calm tide chart."),
      at(describeDesign(spec)),
      at("Quiet water."),
      at("| Role | Light | Dark | Use for |"),
      at("| Step | Size | Line height | Tracking | Weight |"),
      at("- Read DESIGN.md before any UI change"),
      at("```css\n"),
      at(`Made with dyelot. Edit this design: ${editLink(spec, ORIGIN)}`),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const rules = agentsSnippet(spec)
      .split("\n")
      .filter((line) => line.startsWith("- "));
    expect(rules).toHaveLength(8);
    for (const rule of rules) expect(text).toContain(`${rule}\n`);
    expect(text).toContain(`\`\`\`css\n${themeCss(spec, ORIGIN)}\n\`\`\``);
    expect(text.endsWith("\n")).toBe(true);
    // the role table is DESIGN.md's
    const table = designMd(spec, ORIGIN)
      .split("\n")
      .filter((line) => line.startsWith("| `"));
    for (const row of table) expect(text).toContain(row);
  });

  it("C-PRM-02: any plain text lands as mdText, with one css fence", () => {
    const piece = fc.stringMatching(/^[A-Za-z0-9 *_[\]`#-]{1,30}$/).filter((t) => t.trim() === t);
    const ticks = fc.constantFrom("```", "a```b", "`x`");
    const plain = fc.oneof(piece, ticks);
    fc.assert(
      fc.property(plain, plain, plain, (name, oneLiner, thesis) => {
        const spec = specWith({ name, oneLiner, direction: { thesis } });
        const text = promptMd(spec, ORIGIN);
        expect(text).toContain(mdText(name));
        expect(text).toContain(mdText(oneLiner));
        expect(text).toContain(mdText(thesis));
        const fences = text.match(/^```.*$/gm) ?? [];
        expect(fences).toEqual(["```css", "```"]);
        const css = /```css\n([\s\S]*)\n```/.exec(text)?.[1];
        expect(css).toBe(themeCss(spec, ORIGIN));
      }),
      { numRuns: 200, seed: 3009 },
    );
  });

  it("C-PRM-03: failures", () => {
    expect(() => promptMd(null as never, ORIGIN)).toThrow(TypeError);
    expect(() => promptMd(null as never, ORIGIN)).toThrow(/promptMd/);
    expect(() => promptMd(SPEC, "http://dyelot.vercel.app")).toThrow(RangeError);
    expect(() => promptMd(SPEC, "http://dyelot.vercel.app")).toThrow(/editLink/);
  });
});
