import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { generateSystem, resolveParams } from "@/engine";
import { skillFile } from "@/export/skill";
import { editLink, mdText, yamlString } from "@/export/text";
import { DEFAULT_PARAMS } from "../spec/support";
import { splitFrontMatter } from "./design-md-support";
import { ORIGIN, SPEC } from "./golden-support";

// C-SKL-01 to 03 of docs/specs/03-export.md, section 10.8 (6.12).

describe("skillFile", () => {
  const file = skillFile(SPEC, "untitled", ORIGIN);
  const { front, body } = splitFrontMatter(file.text);
  const data = parse(front) as { name: string; description: string };

  it("C-SKL-01: path, name and description", () => {
    expect(file.path).toBe("skills/untitled-design/SKILL.md");
    expect(data.name).toBe("untitled-design");
    expect(data.name).toMatch(/^[a-z0-9-]{1,64}$/);
    expect(data.description).toBe(
      `Restyle or audit UI against the ${SPEC.meta.name} design system: its color roles, type steps, radius, shadows and motion. Use when building or changing UI in this app, or when checking it against DESIGN.md.`,
    );
    expect(data.description.length).toBeLessThanOrEqual(1024);
    expect(front).toContain(`description: ${yamlString(data.description)}`);
    expect(file.text.endsWith("\n")).toBe(true);
  });

  it("C-SKL-02: the body names DESIGN.md, two workflows, the checker and the link", () => {
    expect(body).toContain("DESIGN.md");
    expect(body).toContain("Restyle a component");
    expect(body).toContain("Audit the app");
    expect(body).toContain("node scripts/dyelot-check.mjs");
    expect(body).toContain("PASS");
    expect(body).toContain(mdText(SPEC.meta.name));
    expect(file.text.trimEnd().endsWith(`Edit this design: ${editLink(SPEC, ORIGIN)}`)).toBe(true);
  });

  it("C-SKL-03: bad slugs are RangeErrors, a non-string a TypeError, a long name fits", () => {
    for (const slug of ["", "a".repeat(49), "Bad Slug", "-a", "a-", "a--b", "a_b"]) {
      expect(() => skillFile(SPEC, slug, ORIGIN), slug).toThrow(RangeError);
      expect(() => skillFile(SPEC, slug, ORIGIN), slug).toThrow(/skillFile/);
    }
    expect(() => skillFile(SPEC, 5 as never, ORIGIN)).toThrow(TypeError);
    expect(() => skillFile(SPEC, 5 as never, ORIGIN)).toThrow(/skillFile/);
    expect(() => skillFile(null as never, "a", ORIGIN)).toThrow(TypeError);
    const long = generateSystem(
      resolveParams({ ...DEFAULT_PARAMS, name: "Saltmarsh".repeat(8).slice(0, 80) }, "seed-1"),
      "seed-1",
    );
    const made = skillFile(long, "a".repeat(48), ORIGIN);
    const parsed = parse(splitFrontMatter(made.text).front) as { description: string };
    expect(parsed.description.length).toBeLessThanOrEqual(1024);
  });
});
