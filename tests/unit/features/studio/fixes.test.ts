import { describe, expect, it, vi } from "vitest";
import { type ContrastLevel, type Finding, generateSystem, RULE_IDS, type RuleId } from "@/engine";
import { fixFor } from "@/features/studio/fixes";
import { FRESH_PARAMS } from "./support";

// Cases are C-INSPECT-01 to C-INSPECT-03 of docs/specs/02-studio.md, section 6.8 (R2-10).
// C-INSPECT-04, the fix applied through the store, lives in store-fix.test.ts.

vi.mock("@/engine", async (importOriginal) => {
  const engine = await importOriginal<typeof import("@/engine")>();
  return { ...engine, generateSystem: vi.fn(engine.generateSystem) };
});

const finding = (id: RuleId): Finding => ({
  id,
  severity: "error",
  mode: "light",
  subject: "ring/background",
  measured: 1.1,
  threshold: 3,
  source: "WCAG 2.2 SC 1.4.11",
});

const at = (contrastLevel: ContrastLevel) => ({ ...FRESH_PARAMS, contrastLevel });

describe("fixFor", () => {
  it("C-INSPECT-01 raises C1 at AA to AA+, and C5, N1, F1 at AA or AA+ to AAA, without generating", () => {
    expect(fixFor(finding("C1"), at("AA"))).toEqual({ contrastLevel: "AA+" });
    for (const id of ["C5", "N1", "F1"] as const) {
      expect(fixFor(finding(id), at("AA")), id).toEqual({ contrastLevel: "AAA" });
      expect(fixFor(finding(id), at("AA+")), id).toEqual({ contrastLevel: "AAA" });
    }
    expect(vi.mocked(generateSystem)).not.toHaveBeenCalled();
  });

  it("C-INSPECT-02 returns null when the target is not above the current level", () => {
    expect(fixFor(finding("C1"), at("AA+"))).toBeNull();
    expect(fixFor(finding("C1"), at("AAA"))).toBeNull();
    for (const id of ["C5", "N1", "F1"] as const) {
      expect(fixFor(finding(id), at("AAA")), id).toBeNull();
    }
  });

  it("C-INSPECT-03 returns null for every other rule id, K4 and the T rules included", () => {
    const others = RULE_IDS.filter((id) => !["C1", "C5", "N1", "F1"].includes(id));
    expect(others).toContain("K4");
    expect(others).toEqual(expect.arrayContaining(["T1", "T2", "T3", "T4"]));
    for (const id of others) {
      for (const level of ["AA", "AA+", "AAA"] as const) {
        expect(fixFor(finding(id), at(level)), `${id} at ${level}`).toBeNull();
      }
    }
  });

  it("C-INSPECT-03 does not mutate its arguments", () => {
    const f = Object.freeze(finding("F1"));
    const params = structuredClone(at("AA"));
    expect(fixFor(f, params)).toEqual({ contrastLevel: "AAA" });
    expect(f).toEqual(finding("F1"));
    expect(params).toEqual(at("AA"));
  });

  it("returns a new patch each call, so a caller cannot share one", () => {
    const a = fixFor(finding("F1"), at("AA"));
    const b = fixFor(finding("F1"), at("AA"));
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it("throws TypeError naming fixFor for a finding or params that are not objects", () => {
    expect(() => fixFor(null as never, at("AA"))).toThrow(TypeError);
    expect(() => fixFor(null as never, at("AA"))).toThrow(/^fixFor: finding/);
    expect(() => fixFor(finding("F1"), null as never)).toThrow(/^fixFor: params/);
    expect(() => fixFor({ ...finding("F1"), id: 1 } as never, at("AA"))).toThrow(TypeError);
  });

  it("throws RangeError naming fixFor for an unknown rule id or contrast level", () => {
    expect(() => fixFor({ ...finding("F1"), id: "K3" } as never, at("AA"))).toThrow(RangeError);
    expect(() => fixFor(finding("F1"), { ...at("AA"), contrastLevel: "AAAA" } as never)).toThrow(
      /^fixFor: params.contrastLevel/,
    );
  });
});
