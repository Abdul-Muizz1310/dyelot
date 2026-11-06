import type { Page } from "@playwright/test";

// Init scripts and readers the M5 flows share (docs/specs/05-motion-3d.md, section 4). Each init script
// takes the page and installs itself before the next navigation.

export type VtRecord = {
  calls: number;
  animations: readonly { pseudo: string; duration: number }[];
};

/**
 * `VT_RECORD` wraps `document.startViewTransition`, counts its calls, and on each `ready` records the
 * duration of every animation whose `pseudoElement` starts with `::view-transition`, with its
 * `pseudoElement`. Read the record with `vtRecord`.
 */
export async function VT_RECORD(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const record = { calls: 0, animations: [] as { pseudo: string; duration: number }[] };
    (window as unknown as { __vt: typeof record }).__vt = record;
    const original = document.startViewTransition?.bind(document);
    if (original === undefined) return;
    document.startViewTransition = ((...args: Parameters<typeof original>) => {
      record.calls += 1;
      const transition = original(...args);
      transition.ready.then(
        () => {
          for (const animation of document.documentElement.getAnimations({ subtree: true })) {
            const effect = animation.effect as KeyframeEffect | null;
            const pseudo = effect?.pseudoElement;
            if (effect === null || pseudo === null || pseudo === undefined) continue;
            if (!pseudo.startsWith("::view-transition")) continue;
            const duration = effect.getComputedTiming().duration;
            record.animations.push({
              pseudo,
              duration: typeof duration === "number" ? duration : 0,
            });
          }
        },
        () => {},
      );
      return transition;
    }) as typeof document.startViewTransition;
  });
}

/** What `VT_RECORD` has kept so far. */
export function vtRecord(page: Page): Promise<VtRecord> {
  return page.evaluate(
    () =>
      (window as unknown as { __vt: { calls: number; animations: VtRecord["animations"] } }).__vt,
  );
}
