import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// The accessibility flows' shared helpers (docs/specs/06-gallery.md, section 5.5; moved out of
// a11y-m5.spec.ts in Task 6.8 so the M6 flows use the same axe setup).

export const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * The Player's frame: the brand video's own DOM, a picture whose text is part of it, which WCAG 1.4.3
 * exempts from contrast (13.3's amendment, recorded at the final review). It is `aria-hidden`, and
 * it is the one part of a page the axe flows leave out.
 */
export const PLAYER_FRAME = "[data-brand-player] [data-brand-frame]";

/**
 * axe's violations under the WCAG A and AA tags, contrast included, the Player's frame left out.
 * `extraRules` are rule ids enabled beside the tags.
 */
export async function violations(page: Page, extraRules: readonly string[] = []) {
  // The exclusion covers a hidden picture only: each frame on the page is aria-hidden.
  for (const frame of await page.locator(PLAYER_FRAME).all()) {
    await expect(frame).toHaveAttribute("aria-hidden", "true");
  }
  const builder = new AxeBuilder({ page });
  if (extraRules.length === 0) {
    builder.withTags(AXE_TAGS);
  } else {
    builder.options({
      runOnly: { type: "tag", values: AXE_TAGS },
      rules: Object.fromEntries(extraRules.map((id) => [id, { enabled: true }])),
    });
  }
  return (await builder.exclude(PLAYER_FRAME).analyze()).violations;
}

/** Waits until every finite animation on the page has finished: nothing is caught mid-fade. */
export const settleAnimations = (page: Page): Promise<unknown> =>
  page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().iterations !== Number.POSITIVE_INFINITY,
        )
        .map((animation) => animation.finished),
    ),
  );

export const overflowOf = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
