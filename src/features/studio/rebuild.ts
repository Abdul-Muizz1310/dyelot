import { type DirectionParams, lintSpec } from "@/engine";
import type { DesignSpec } from "@/spec";
import { assertRecord, describeType } from "./guards";

// What rebuilding a held design from its own parameters would give (spec R3-42): the store asks once
// per held blocked design, and the answer picks the blocked state's words. Pure: the generator comes in.

/** `"passes"`: the rebuilt design has no required-check error. `"fails"`: it still has one. `"throws"`: the generator threw. */
export type RebuildOutcome = "passes" | "fails" | "throws";

/**
 * Calls `generate(snapshot.params, snapshot.seed)` and lints the result. Never throws for a
 * generator that throws; a wrong snapshot or generator is a TypeError (R-05).
 */
export function rebuildOutcome(
  snapshot: { readonly params: DirectionParams; readonly seed: string },
  generate: (params: DirectionParams, seed: string) => DesignSpec,
): RebuildOutcome {
  assertRecord(snapshot, "rebuildOutcome: snapshot");
  if (!("params" in snapshot) || !("seed" in snapshot)) {
    throw new TypeError("rebuildOutcome: snapshot must have params and seed");
  }
  if (typeof generate !== "function") {
    throw new TypeError(
      `rebuildOutcome: generate must be a function, got ${describeType(generate)}`,
    );
  }
  let spec: DesignSpec;
  try {
    spec = generate(snapshot.params, snapshot.seed);
  } catch {
    return "throws";
  }
  return lintSpec(spec).some((finding) => finding.severity === "error") ? "fails" : "passes";
}
