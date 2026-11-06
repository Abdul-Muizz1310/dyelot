import { expect, type Page, test } from "@playwright/test";
import { VT_RECORD, vtRecord } from "./flavor-support";
import { canvasFrame, openStudio, stubSeeds } from "./studio-support";
import { reduceMotion, screenOf, showTemplate, templateSelect } from "./template-support";

// The view transitions of Task 5.8a (docs/specs/05-motion-3d.md, rulings R5-46, R5-48, R5-49).

const GROUP = "::view-transition-group(dyelot-template)";

/** Waits for the record to hold one call and its `ready` animations. */
async function recorded(page: Page) {
  await expect.poll(async () => (await vtRecord(page)).animations.length).toBeGreaterThan(0);
  return vtRecord(page);
}

test.describe("template cross-fade", () => {
  test("F-VT-01 a template switch makes one call and animates only the template's group", async ({
    page,
  }) => {
    await VT_RECORD(page);
    await stubSeeds(page);
    await openStudio(page);
    await templateSelect(page).selectOption("dashboard");
    const record = await recorded(page);
    expect(record.calls).toBe(1);
    expect(record.animations.some((a) => a.pseudo === GROUP && a.duration > 0)).toBe(true);
    expect(record.animations.filter((a) => a.pseudo.includes("(root)") && a.duration > 0)).toEqual(
      [],
    );
    await expect(canvasFrame(page)).toHaveAttribute("data-template", "dashboard");
    await expect(canvasFrame(page).locator("[data-template-root]")).toHaveCount(1);
  });

  test("F-VT-02 under the OS reduced motion every recorded animation is 0 ms", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await VT_RECORD(page);
    await stubSeeds(page);
    await openStudio(page);
    await templateSelect(page).selectOption("dashboard");
    const record = await recorded(page);
    expect(record.animations.filter((a) => a.duration > 0)).toEqual([]);
    await expect(canvasFrame(page)).toHaveAttribute("data-template", "dashboard");
  });

  test("F-VT-03 the canvas's Reduce motion skips the cross-fade and keeps the FAQ's open item", async ({
    page,
  }) => {
    await VT_RECORD(page);
    await stubSeeds(page);
    await openStudio(page);
    const landing = await showTemplate(page, "landing");
    const second = landing.locator('[data-block="faq"] button[aria-expanded]').nth(1);
    await second.click();
    await expect(second).toHaveAttribute("aria-expanded", "true");
    await reduceMotion(page).click();
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "true");
    await reduceMotion(page).click();
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "false");
    await expect(second).toHaveAttribute("aria-expanded", "true");
    await reduceMotion(page).click();
    await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "true");
    await templateSelect(page).selectOption("settings");
    await expect(canvasFrame(page)).toHaveAttribute("data-template", "settings");
    const record = await vtRecord(page);
    expect(
      record.animations.filter((a) => a.pseudo.includes("dyelot-template") && a.duration > 0),
    ).toEqual([]);
  });
});

test.describe("OS reduced motion mid-animation", () => {
  test("F-VT-07 the sheet settles when the OS asks for reduced motion during its rise", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    const mobile = await showTemplate(page, "mobile");
    const detail = screenOf(mobile, "detail");
    const opener = detail.getByRole("button", { name: "Set an alert", exact: true });
    await opener.evaluate(
      (button) =>
        new Promise<void>((resolve) => {
          (button as HTMLButtonElement).click();
          setTimeout(resolve, 60);
        }),
    );
    const sheet = detail.getByRole("dialog");
    const layer = sheet.locator("xpath=ancestor::*[contains(@class,'kit-sheet-layer')][1]");
    // The rise must still run when the OS asks, or the flow proves nothing.
    expect(
      await layer.evaluate((element) => element.getAnimations({ subtree: true }).length),
    ).toBeGreaterThan(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Within two frames of the change, the layer is settled and holds no animation: the rise did not
    // run to its end first.
    const atOnce = await layer.evaluate(
      (element) =>
        new Promise<{ settled: boolean; running: number }>((resolve) => {
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              resolve({
                settled: element.hasAttribute("data-settled"),
                running: element.getAnimations({ subtree: true }).length,
              }),
            ),
          );
        }),
    );
    expect(atOnce).toEqual({ settled: true, running: 0 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(sheet).toBeVisible();
    await expect(layer).toHaveAttribute("data-settled", "");
    await layer.evaluate((element) => {
      const counted = window as unknown as { __starts: number };
      counted.__starts = 0;
      element.addEventListener("animationstart", () => {
        counted.__starts += 1;
      });
    });
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => (window as unknown as { __starts: number }).__starts)).toBe(0);
    expect(await layer.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(
      0,
    );
    await expect(sheet).toBeVisible();
  });
});
