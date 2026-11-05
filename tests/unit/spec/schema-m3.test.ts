import { describe, expect, it } from "vitest";
import { decodeSpec, encodeSpec, normalizeSpec, specId } from "@/spec";
import { type DesignSpec, DesignSpecSchema } from "@/spec/schema";
import { defaultSpec, type Path, withValue } from "./support";

// Cases C-SPEC3-07 to C-SPEC3-09 and C-SPEC3-11 of docs/specs/03-export.md, section 10.1
// (R3-01, R3-02, I-M3-06).

function rejectedPaths(value: unknown): string[] {
  const result = DesignSpecSchema.safeParse(value);
  expect(result.success).toBe(false);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}

function expectRejected(value: unknown, at: Path): void {
  expect(rejectedPaths(value)).toContain(at.join("."));
}

function expectAccepted(value: unknown): void {
  const result = DesignSpecSchema.safeParse(value);
  expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
}

const BASE = defaultSpec();
const withOneLiner = (text: string) => withValue(BASE, ["meta", "oneLiner"], text);
const withDirection = (direction: unknown) => withValue(BASE, ["direction"], direction);
const texts = (count: number, length: number) =>
  Array.from({ length: count }, () => "x".repeat(length));

describe("the spec fields of M3", () => {
  it("C-SPEC3-07 accepts oneLiner and direction at their bounds, keeps them and round-trips them", () => {
    const direction = (value: unknown) => withDirection(value) as DesignSpec;
    const specs: DesignSpec[] = [
      withOneLiner("x") as DesignSpec,
      withOneLiner("x".repeat(140)) as DesignSpec,
      direction({ thesis: "x" }),
      direction({ adjectives: ["calm"] }),
      direction({ like: ["a"] }),
      direction({ unlike: ["a"] }),
      direction({
        thesis: "x".repeat(280),
        adjectives: texts(5, 24),
        like: texts(5, 80),
        unlike: texts(5, 80),
      }),
    ];
    for (const spec of specs) {
      expectAccepted(spec);
      expect(normalizeSpec(spec)).toEqual(spec);
      expect(decodeSpec(encodeSpec(spec))).toEqual(spec);
    }
  });

  it("C-SPEC3-08 rejects each bound and names the path", () => {
    expectRejected(withOneLiner(""), ["meta", "oneLiner"]);
    expectRejected(withOneLiner("x".repeat(141)), ["meta", "oneLiner"]);
    expectRejected(withDirection({}), ["direction"]);
    expectRejected(withDirection({ thesis: "x", extra: 1 }), ["direction"]);
    expectRejected(withDirection({ adjectives: [] }), ["direction", "adjectives"]);
    expectRejected(withDirection({ adjectives: texts(6, 3) }), ["direction", "adjectives"]);
    expectRejected(withDirection({ adjectives: ["x".repeat(25)] }), ["direction", "adjectives", 0]);
    for (const key of ["like", "unlike"]) {
      expectRejected(withDirection({ [key]: texts(6, 3) }), ["direction", key]);
      expectRejected(withDirection({ [key]: ["x".repeat(81)] }), ["direction", key, 0]);
    }
    expectRejected(withDirection({ thesis: "x".repeat(281) }), ["direction", "thesis"]);
    for (const bad of [" a", "a\u202eb"]) {
      expectRejected(withOneLiner(bad), ["meta", "oneLiner"]);
      expectRejected(withDirection({ thesis: bad }), ["direction", "thesis"]);
      expectRejected(withDirection({ adjectives: [bad] }), ["direction", "adjectives", 0]);
      expectRejected(withDirection({ like: [bad] }), ["direction", "like", 0]);
      expectRejected(withDirection({ unlike: [bad] }), ["direction", "unlike", 0]);
    }
  });

  it("C-SPEC3-09 reaches the existing text fields", () => {
    for (const name of [" Saltmarsh", "a\u0000b"]) {
      expectRejected(withValue(BASE, ["meta", "name"], name), ["meta", "name"]);
    }
    for (const entry of ["", "x\n"]) {
      expectRejected(withValue(BASE, ["rules", "do"], [entry]), ["rules", "do", 0]);
    }
    for (const path of [
      ["components", "cards"],
      ["components", "emphasis"],
      ["components", "inputs"],
      ["components", "icons", "library"],
    ]) {
      expectRejected(withValue(BASE, path, "x "), path);
    }
  });

  it("C-SPEC3-11 leaves the spec id of SPEC alone and tells a spec with the new fields apart", () => {
    expect(specId(BASE)).toBe("f99eeb55e29ded65");
    const extended = withValue(
      withValue(BASE, ["meta", "oneLiner"], "Tide charts"),
      ["direction"],
      { thesis: "Calm and exact", adjectives: ["calm"] },
    ) as DesignSpec;
    expect(specId(extended)).not.toBe(specId(BASE));
    expect(decodeSpec(encodeSpec(extended))).toEqual(extended);
  });
});
