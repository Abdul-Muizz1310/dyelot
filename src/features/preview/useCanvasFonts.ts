"use client";

import { useEffect } from "react";
import { FONT_CATALOG } from "@/engine";
import { fontLoader } from "@/features/fonts/load";
import type { DesignSpec } from "@/spec";

// The canvas fonts (decision "Fonts", R2-27): the spec's display, body and mono families load from
// /fonts/<id>/ through the FontFace API whenever they change. A family outside the catalog has no
// files and keeps its fallback stack (C-THEME-08); a family that fails keeps it too, and the
// inspector reports that (Task 2.10).

const CATALOG_IDS: ReadonlySet<string> = new Set(FONT_CATALOG.map((font) => font.id));

export function useCanvasFonts(families: DesignSpec["type"]["families"]): void {
  const { display, body, mono } = families;
  useEffect(() => {
    for (const id of new Set([display, body, mono])) {
      if (CATALOG_IDS.has(id)) void fontLoader.load(id);
    }
  }, [display, body, mono]);
}
