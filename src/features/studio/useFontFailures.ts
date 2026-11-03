"use client";

import { useSyncExternalStore } from "react";
import { FONT_CATALOG } from "@/engine";
import { fontLoader } from "@/features/fonts/load";
import type { DesignSpec } from "@/spec";

// The spec's families that failed to load (spec section 7.8, RF3), read from the canvas's font loader
// (R2-27) through its subscription, never by polling: the loader tells every listener when a family's
// status changes. A family outside the catalog loads nothing, so it never counts as failed.

const CATALOG_IDS: ReadonlySet<string> = new Set(FONT_CATALOG.map((font) => font.id));

/** The ids of the spec's display, body and mono families whose load failed, each once, in that order. */
export function useFontFailures(families: DesignSpec["type"]["families"]): readonly string[] {
  const ids = [...new Set([families.display, families.body, families.mono])].filter((id) =>
    CATALOG_IDS.has(id),
  );
  const failed = useSyncExternalStore(
    fontLoader.subscribe,
    () => ids.filter((id) => fontLoader.status(id) === "failed").join(" "),
    () => "",
  );
  return failed === "" ? [] : failed.split(" ");
}
