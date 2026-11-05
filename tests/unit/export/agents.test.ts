import { describe, expect, it } from "vitest";
import { generateSystem, resolveParams } from "@/engine";
import { agentsSnippet } from "@/export/agents";
import { mdText } from "@/export/text";
import { lotTag, specId } from "@/spec";
import { DEFAULT_PARAMS } from "../spec/support";
import { SPEC } from "./golden-support";

// C-AGT-01 to 03 of docs/specs/03-export.md, section 10.8 (6.10, I-M3-08).

const LOT = lotTag(specId(SPEC));

describe("agentsSnippet", () => {
  it("C-AGT-01: is the 11 lines of 6.10, filled, with one trailing newline", () => {
    expect(agentsSnippet(SPEC)).toBe(
      [
        `<!-- dyelot:start ${LOT} -->`,
        `## Design system: ${mdText(SPEC.meta.name)}`,
        "- Read DESIGN.md before any UI change; it is the design brief.",
        "- Colors, type, radius, shadows and motion come only from the tokens in app/theme.css.",
        "- Never write a raw hex, rgb(), hsl() or oklch() color in a component.",
        "- Use the role utilities (bg-background, text-foreground, bg-primary, text-primary-foreground, border-border), never Tailwind's default palette classes such as bg-blue-500.",
        "- Pair every fill with its foreground role, such as bg-primary with text-primary-foreground.",
        "- Set body text with the type steps (text-body and up), never under 16 px.",
        "- Animate with the tokens in motion/, and honor prefers-reduced-motion.",
        "- Before you finish, run `node scripts/dyelot-check.mjs` and fix every finding until it prints PASS.",
        "<!-- dyelot:end -->",
        "",
      ].join("\n"),
    );
    expect(agentsSnippet(SPEC).split("\n")).toHaveLength(12);
  });

  it("C-AGT-02: its markers, no Next.js marker, and the three names", () => {
    const text = agentsSnippet(SPEC);
    expect(text.startsWith(`<!-- dyelot:start ${LOT} -->\n`)).toBe(true);
    expect(text.endsWith("<!-- dyelot:end -->\n")).toBe(true);
    expect(text).not.toContain("nextjs-agent-rules");
    for (const name of ["DESIGN.md", "app/theme.css", "node scripts/dyelot-check.mjs"]) {
      expect(text).toContain(name);
    }
  });

  it("C-AGT-02: a dense design says 14 px", () => {
    const dense = generateSystem(
      resolveParams({ ...DEFAULT_PARAMS, type: { context: "dense" } }, "seed-1"),
      "seed-1",
    );
    expect(agentsSnippet(dense)).toContain("never under 14 px.");
  });

  it("C-AGT-03: a non-object is a TypeError, and a name with --> keeps two comments", () => {
    expect(() => agentsSnippet(null as never)).toThrow(TypeError);
    expect(() => agentsSnippet(null as never)).toThrow(/agentsSnippet/);
    const spec = generateSystem(
      resolveParams({ ...DEFAULT_PARAMS, name: "Tide --> <!-- x" }, "seed-1"),
      "seed-1",
    );
    const text = agentsSnippet(spec);
    expect(text.match(/(?<!\\)<!--/g)).toHaveLength(2);
    expect(text.match(/(?<!\\)-->/g)).toHaveLength(2);
  });
});
