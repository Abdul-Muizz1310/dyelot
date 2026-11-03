import { indexNames, type NameIndex } from "@/engine";

// The color names list (spec R2-11, section 7.8): `color-name-list/bestof`, about 4,500 names in a
// 190 KB module, stays out of the first load. The inspector's Names section calls `loadNames` the first
// time it shows on screen; the dynamic `import()` puts the list in a chunk of its own, and the engine's
// `indexNames` checks it. A failed load rejects, and the section says the names are unavailable.

let loaded: Promise<NameIndex> | null = null;

/** The indexed name list, loaded once. A failed load is not kept, so a later call tries again. */
export function loadNames(): Promise<NameIndex> {
  if (loaded === null) {
    const loading = import("color-name-list/bestof").then(({ colornames }) =>
      indexNames(colornames),
    );
    loaded = loading;
    loading.catch(() => {
      if (loaded === loading) loaded = null;
    });
  }
  return loaded;
}
