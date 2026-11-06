import { loadOnce } from "@/lib/load-once";
import { VIDEO_LINES } from "./video";

// The Flavor dialog's loader (docs/specs/05-motion-3d.md, R5-51 and section 5.8): the studio
// reaches the dialog only through this `import()`, on the first press of "Flavor", so its first load
// fetches no flavor or Remotion code (R5-61). A failed load is forgotten and the next press tries
// again. The studio imports nothing else from this folder.

/** The dialog's module as `import()` gives it. */
export type FlavorDialogModule = typeof import("./FlavorDialog");

const load = loadOnce(() => import("./FlavorDialog"));

/** The dialog's module, loaded once per page; a failed load is forgotten. */
export function loadFlavorDialog(): Promise<FlavorDialogModule> {
  return load();
}

/** The toolbar's status line when the dialog does not load (13.1). */
export const LOAD_FAILED_LINE: string = VIDEO_LINES["load-failed"];
