import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { lintSpec, measureSpec, summarize } from "@/engine";
import { blockReason, summaryLines } from "@/features/export/files";
import { decodeSpec } from "@/spec";
import {
  exportButton,
  exportDialog,
  IMPORTED,
  IMPORTED_LINK,
  ONE_FAIL_LINK,
  SPEC,
  SPEC_LINK,
} from "./export-support";
import { button, openStudio, settled } from "./studio-support";

// The inspector's Receipt section of docs/specs/03-export.md, section 10.12 (Task 3.15): F-RCPT-01 to
// 03, F-A11Y3-06 and F-A11Y3-07.

test.use({ viewport: { width: 1280, height: 800 } });

const PHONE = { width: 360, height: 740 };

const inspector = (page: Page) => page.locator("aside#studio-inspector");
const receipt = (page: Page) =>
  inspector(page).getByRole("region", { name: "Receipt", exact: true });
const receiptLines = (page: Page) => receipt(page).getByRole("listitem");
const rebuild = (page: Page) =>
  inspector(page).getByRole("button", { name: "Rebuild from the parameters", exact: true });

/** The four lines the page must show for `spec`. */
const linesOf = (spec: typeof SPEC): string[] =>
  summaryLines(summarize(measureSpec(spec), lintSpec(spec), spec.color.params.gamut));

test.describe("the inspector's Receipt section", () => {
  test("F-RCPT-01 follows Findings and lists the four summary lines", async ({ page }) => {
    await openStudio(page, SPEC_LINK);
    const names = await inspector(page)
      .getByRole("heading", { level: 3 })
      .evaluateAll((headings) => headings.map((heading) => heading.textContent));
    expect(names.indexOf("Receipt")).toBe((names.indexOf("Findings") ?? -2) + 1);
    await expect(receiptLines(page)).toHaveText(linesOf(SPEC));
  });

  test("F-RCPT-02 follows a committed change: AAA gives the new design's lines", async ({
    page,
  }) => {
    await openStudio(page, SPEC_LINK);
    await page
      .getByRole("group", { name: "Contrast level", exact: true })
      .first()
      .getByRole("radio", { name: "AAA", exact: true })
      .check();
    await settled(page);
    await expect
      .poll(async () => {
        const hash = await page.evaluate(() => location.hash);
        return hash.length > "#s=".length
          ? decodeSpec(hash.slice("#s=".length)).color.params.contrastLevel
          : "";
      })
      .toBe("AAA");
    const spec = decodeSpec((await page.evaluate(() => location.hash)).slice("#s=".length));
    await expect(receiptLines(page)).toHaveText(linesOf(spec));
  });

  test("F-RCPT-03 a loaded failing design shows the fixable sentence until the rebuild", async ({
    page,
  }) => {
    await openStudio(page, IMPORTED_LINK);
    const errors = lintSpec(IMPORTED).filter((finding) => finding.severity === "error").length;
    await expect(receiptLines(page)).toHaveText(linesOf(IMPORTED));
    await expect(receipt(page)).toContainText(blockReason("fixable", errors));
    await rebuild(page).click();
    await settled(page);
    await expect(receipt(page)).not.toContainText("This design fails");
    await expect(rebuild(page)).toHaveCount(0);
    await expect(receiptLines(page)).toHaveCount(4);
    await expect(receiptLines(page).nth(3)).toHaveText(/^No lint errors/);
  });

  for (const viewport of [{ width: 1280, height: 800 }, PHONE]) {
    test(`F-A11Y3-06 axe finds no violation in the blocked dialog at ${viewport.width} px; the disabled buttons stay focusable and described`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openStudio(page, IMPORTED_LINK);
      await exportButton(page).click();
      const dialog = exportDialog(page);
      const errors = lintSpec(IMPORTED).filter((finding) => finding.severity === "error").length;
      const sentence = blockReason("fixable", errors);
      await expect(dialog.getByText(sentence, { exact: true })).toBeVisible();
      await page.waitForTimeout(300);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(result.violations).toEqual([]);
      const disabled = dialog.getByRole("button", { name: /^(Download |Copy )/ });
      const count = await disabled.count();
      expect(count).toBeGreaterThan(1);
      for (let index = 0; index < count; index++) {
        const each = disabled.nth(index);
        await each.focus();
        await expect(each).toBeFocused();
        await expect(each).toHaveAccessibleDescription(sentence);
      }
    });

    test(`F-A11Y3-07 axe finds no violation in the inspector with the Receipt and the rebuild note at ${viewport.width} px; Tab reaches Rebuild after the findings`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await openStudio(page, ONE_FAIL_LINK);
      if (viewport.width < 1280) {
        await button(page, "Inspector").click();
        await expect(inspector(page).getByRole("heading", { name: "Inspector" })).toBeFocused();
      }
      await expect(rebuild(page)).toBeVisible();
      await expect(receipt(page)).toContainText("This design fails 1 required check.");
      await page.waitForTimeout(300);
      const result = await new AxeBuilder({ page })
        .include("aside#studio-inspector")
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(result.violations).toEqual([]);
      const last = inspector(page).getByRole("button", { name: "Show me", exact: true }).last();
      await last.focus();
      await page.keyboard.press("Tab");
      await expect(rebuild(page)).toBeFocused();
    });
  }
});
