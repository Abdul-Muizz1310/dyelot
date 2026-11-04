"use client";

import { useEffect, useState } from "react";
import type { Bundle } from "@/export";
import { SITE } from "@/lib/site/config";
import type { DesignSpec } from "@/spec";

// The export dialog's bundle (spec R3-34): `@/export` loads through `import()` when the dialog opens,
// never with the studio (I-M3-09), and the bundle is built again whenever the committed spec
// changes while the dialog is open (Review Focus 1). A bundle is shown only for the spec it was
// built from, so the dialog never pairs one design's files with another's lot.

type ExportModule = typeof import("@/export");

let loading: Promise<ExportModule> | null = null;

/** The export entry, loaded once; a failed load is forgotten so that "Try again" asks the network again. */
function loadExport(): Promise<ExportModule> {
  loading ??= import("@/export").catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** What one build made: the bundle, its zip (none for a failing design, D1) and the zip's name. */
type Built = {
  readonly bundle: Bundle;
  /** Absent while the design fails a required check: no download starts (I-M3-04). */
  readonly zip: Uint8Array | undefined;
  readonly zipName: string;
};

type Outcome = { readonly spec: DesignSpec } & (
  | { readonly built: Built }
  | { readonly failed: true }
);

export type BundleState = {
  readonly state: "loading" | "failed" | "waiting" | "ready";
  readonly bundle?: Bundle;
  readonly zip?: Uint8Array;
  readonly zipName?: string;
  retry(): void;
};

/**
 * The bundle of `spec`. `waiting` says a newer design is still generating: nothing is built then, and
 * the state is `waiting` until it commits.
 */
export function useBundle(spec: DesignSpec, waiting = false): BundleState {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [attempt, setAttempt] = useState(0);

  // `attempt` only restarts the effect after a retry.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above.
  useEffect(() => {
    if (waiting) return;
    let live = true;
    loadExport().then(
      (module) => {
        if (!live) return;
        try {
          const bundle = module.buildBundle({ spec, origin: SITE.url });
          const zip = bundle.summary.lint.error === 0 ? module.zipBundle(bundle) : undefined;
          setOutcome({ spec, built: { bundle, zip, zipName: module.zipName(bundle) } });
        } catch {
          setOutcome({ spec, failed: true });
        }
      },
      () => {
        if (live) setOutcome({ spec, failed: true });
      },
    );
    return () => {
      live = false;
    };
  }, [spec, waiting, attempt]);

  const retry = () => {
    setOutcome(null);
    setAttempt((count) => count + 1);
  };
  if (waiting) return { state: "waiting", retry };
  if (outcome === null || outcome.spec !== spec) return { state: "loading", retry };
  if ("failed" in outcome) return { state: "failed", retry };
  const { bundle, zip, zipName } = outcome.built;
  return { state: "ready", bundle, zip, zipName, retry };
}
