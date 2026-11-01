import { describe, expect, it } from "vitest";
import { hexToRgb, lintSpec, wcagRatio } from "@/engine";
import { fixFor } from "@/features/studio/fixes";
import { writeHash } from "@/features/studio/url";
import { type DesignSpec, normalizeSpec } from "@/spec";
import { withValue } from "../../spec/support";
import { lastPosted, makeStore } from "./store-support";
import { fakeLocation, freshSpec } from "./support";

// C-INSPECT-04 of docs/specs/02-studio.md, section 6.8 (R2-10): a fix action is a patch applied
// through setParams, and the worker's regeneration at the higher level clears the finding. The
// inspector's button and its note are Task 2.10's (F-INSP-09, C-INSPECT-17).

/** FRESH's spec with the light ring set to #f4f4f4 on its #ffffff page: a link made elsewhere. */
function tampered(): DesignSpec {
  const spec = freshSpec();
  expect(spec.color.params.contrastLevel).toBe("AA");
  expect(spec.color.roles.light.background).toBe("#ffffff");
  return normalizeSpec(
    withValue(spec, ["color", "roles", "light", "ring"], "#f4f4f4") as DesignSpec,
  );
}

const f1 = (spec: DesignSpec) =>
  lintSpec(spec).filter((finding) => finding.id === "F1" && finding.subject === "ring/background");

describe("a fix applied through the store", () => {
  it("C-INSPECT-04 raising the contrast to AAA regenerates every role and clears F1", () => {
    const { location } = fakeLocation(writeHash(tampered()));
    const { store, stub } = makeStore({ location });
    const opened = store.getState();
    expect(opened.spec).toEqual(tampered());
    const [finding] = f1(opened.spec);
    expect(finding).toMatchObject({ id: "F1", mode: "light", subject: "ring/background" });
    if (finding === undefined) return;

    const fix = fixFor(finding, opened.params);
    expect(fix).toEqual({ contrastLevel: "AAA" });
    if (fix === null) return;
    store.getState().setParams(fix);
    expect(lastPosted(stub).params.contrastLevel).toBe("AAA");
    stub.replyReal(lastPosted(stub).id);

    const { spec, status } = store.getState();
    expect(status.phase).toBe("idle");
    expect(spec.color.params.contrastLevel).toBe("AAA");
    expect(f1(spec)).toEqual([]);
    expect(spec.color.roles.light.ring).not.toBe("#f4f4f4");
    for (const mode of ["light", "dark"] as const) {
      const roles = spec.color.roles[mode];
      expect(
        wcagRatio(hexToRgb(roles.ring), hexToRgb(roles.background)),
        mode,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
