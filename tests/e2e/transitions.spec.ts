import { expect, type Page, test } from "@playwright/test";
import { tokenRow } from "@/features/studio/token-row";
import { VT_RECORD, vtRecord } from "./flavor-support";
import { canvasFrame, first, inspectorAside, openStudio, stubSeeds } from "./studio-support";
import { reduceMotion, screenOf, showTemplate, templateSelect } from "./template-support";

// The view transitions of Tasks 5.8a and 5.8b (docs/specs/05-motion-3d.md, rulings R5-46 to R5-49).

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
    await expect(canvasFrame(page)).toHaveAttribute("data-template", "dashboard");
    // Under the OS setting the new template renders in the same commit: no transition call at all.
    const record = await vtRecord(page);
    expect(record.calls).toBe(0);
    expect(record.animations.filter((a) => a.duration > 0)).toEqual([]);
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
    expect(record.calls).toBe(0);
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

// The token row of a Scales step (Task 5.8b, ruling R5-47, section 10.2).

const SWATCH = "::view-transition-group(dyelot-swatch-primary-500)";

/** A step's compact or open button in the inspector's Scales. */
function stepButton(page: Page, palette: string, step: number) {
  const row = first().color.palettes[palette as "primary"].light.find((s) => s.step === step);
  return inspectorAside(page).getByRole("button", {
    name: `${palette} ${step}, ${row?.hex}`,
    exact: true,
  });
}

test.describe("token row", () => {
  test("F-VT-04 a step opens its token row, the swatch morphs, another step closes it, Escape returns focus", async ({
    page,
  }) => {
    await VT_RECORD(page);
    await stubSeeds(page);
    await openStudio(page);
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "light");
    const expected = tokenRow(first(), "light", "primary", 500);
    await stepButton(page, "primary", 500).click();
    const row = inspectorAside(page).locator("[data-token-row]");
    await expect(row).toHaveCount(1);
    await expect(stepButton(page, "primary", 500)).toHaveAttribute("aria-expanded", "true");
    await expect(row.locator("code")).toHaveText([
      expected.token,
      expected.utility,
      expected.cssVar,
    ]);
    await expect(row).toContainText(expected.hex);
    await expect(row).toContainText(expected.oklch);
    await expect(row).toContainText(expected.contrast);
    await expect(row).toContainText(
      expected.roles.length > 0
        ? `Roles: ${expected.roles.join(", ")}`
        : "Roles: none in light mode.",
    );
    await expect(stepButton(page, "primary", 500)).toBeFocused();
    const record = await recorded(page);
    expect(record.animations.some((a) => a.pseudo === SWATCH && a.duration === 250)).toBe(true);
    await stepButton(page, "primary", 600).click();
    await expect(inspectorAside(page).locator("[data-token-row]")).toHaveCount(1);
    await expect(stepButton(page, "primary", 500)).toHaveAttribute("aria-expanded", "false");
    await expect(stepButton(page, "primary", 600)).toHaveAttribute("aria-expanded", "true");
    await expect(stepButton(page, "primary", 600)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(inspectorAside(page).locator("[data-token-row]")).toHaveCount(0);
    await expect(stepButton(page, "primary", 600)).toHaveAttribute("aria-expanded", "false");
    await expect(stepButton(page, "primary", 600)).toBeFocused();
  });

  test.describe("with the clipboard", () => {
    test.use({ permissions: ["clipboard-read", "clipboard-write"] });

    test("F-VT-05 Copy writes the variable and reads Copied; compact steps are 24 px tall", async ({
      page,
    }) => {
      await stubSeeds(page);
      await openStudio(page);
      const heights = await inspectorAside(page)
        .locator("li[data-step] [data-step-button]")
        .evaluateAll((buttons) => buttons.map((b) => b.getBoundingClientRect().height));
      expect(heights).toHaveLength(88);
      expect(Math.min(...heights)).toBeGreaterThanOrEqual(24);
      await stepButton(page, "primary", 500).click();
      const copy = inspectorAside(page).getByRole("button", { name: "Copy var(--primary-500)" });
      await copy.click();
      await expect(copy).toHaveText("Copied");
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("var(--primary-500)");
    });
  });

  test("F-VT-06 under reduced motion the swatch's animation lasts 0 ms", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await VT_RECORD(page);
    await stubSeeds(page);
    await openStudio(page);
    await stepButton(page, "primary", 500).click();
    await expect(inspectorAside(page).locator("[data-token-row]")).toHaveCount(1);
    const record = await recorded(page);
    expect(record.animations.some((a) => a.pseudo === SWATCH)).toBe(true);
    expect(record.animations.filter((a) => a.duration > 0)).toEqual([]);
  });
});
