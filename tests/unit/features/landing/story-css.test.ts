import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// C-LAND5-05 of docs/specs/05-motion-3d.md, section 14.5 (R5-33, 7.2): the story's CSS, read as text.

const CSS = readFileSync(
  path.join(process.cwd(), "src/features/landing/story.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

type Block = { prelude: string; parents: string[]; declarations: string[] };

/** Every `{}` block of the text, nested ones included, with its prelude, the preludes around it and its own declarations. */
function parse(text: string, parents: string[] = []): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i);
    if (open === -1) break;
    const prelude = text.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (depth > 0 && j < text.length) {
      if (text[j] === "{") depth++;
      if (text[j] === "}") depth--;
      j++;
    }
    const body = text.slice(open + 1, j - 1);
    // Own declarations: the `;`-ended chunks of the body at depth 0.
    const declarations: string[] = [];
    let level = 0;
    let current = "";
    for (const ch of body) {
      if (level > 0) {
        if (ch === "{") level++;
        if (ch === "}") level--;
      } else if (ch === "{") {
        level = 1;
        current = "";
      } else if (ch === ";") {
        declarations.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    out.push({ prelude, parents, declarations });
    out.push(...parse(body, [...parents, prelude]));
    i = j;
  }
  return out;
}

const ALL = parse(CSS);
const SUPPORTS = "@supports (animation-timeline: view())";
const MEDIA = "@media (prefers-reduced-motion: no-preference)";

describe("story.css (7.2)", () => {
  it("C-LAND5-05 every animation declaration sits inside the supports guard inside the media guard", () => {
    const animating = ALL.filter((b) =>
      b.declarations.some((d) => /^(animation|animation-timeline|animation-range)\s*:/.test(d)),
    );
    expect(animating.length).toBeGreaterThan(0);
    for (const block of animating) {
      expect(block.parents).toEqual([MEDIA, SUPPORTS]);
    }
  });

  it("C-LAND5-05 animation-range is entry 0% entry 100%, and the timeline is view()", () => {
    const values = (property: string) =>
      ALL.flatMap((b) => b.declarations)
        .filter((d) => d.startsWith(`${property}:`))
        .map((d) => d.slice(property.length + 1).trim());
    expect(values("animation-range")).toEqual(["entry 0% entry 100%"]);
    expect(values("animation-timeline")).toEqual(["view()"]);
  });

  it("C-LAND5-05 the one keyframes rule changes only opacity and translate, by at most 24 px", () => {
    const keyframes = ALL.filter((b) => b.prelude.startsWith("@keyframes"));
    expect(keyframes).toHaveLength(1);
    const frames = ALL.filter((b) => b.parents.some((p) => p.startsWith("@keyframes")));
    expect(frames.map((f) => f.prelude)).toEqual(["from", "to"]);
    for (const frame of frames) {
      for (const declaration of frame.declarations) {
        const colon = declaration.indexOf(":");
        const property = declaration.slice(0, colon).trim();
        const value = declaration.slice(colon + 1).trim();
        expect(["opacity", "translate"]).toContain(property);
        if (property === "translate") {
          for (const px of value.matchAll(/(-?\d+(?:\.\d+)?)px/g)) {
            expect(Math.abs(Number(px[1]))).toBeLessThanOrEqual(24);
          }
          for (const token of value.split(/\s+/)) {
            expect(token).toMatch(/^(0|-?\d+(\.\d+)?px)$/);
          }
        }
      }
    }
  });

  it("C-LAND5-05 no rule outside the guards sets opacity, translate or transform", () => {
    const outside = ALL.filter(
      (b) =>
        !b.parents.some((p) => p.startsWith("@keyframes")) && !b.prelude.startsWith("@keyframes"),
    ).filter(
      (b) => !(b.parents.length === 2 && b.parents[0] === MEDIA && b.parents[1] === SUPPORTS),
    );
    for (const block of outside) {
      for (const declaration of block.declarations) {
        expect(declaration).not.toMatch(/^(opacity|translate|transform)\s*:/);
      }
    }
  });
});
