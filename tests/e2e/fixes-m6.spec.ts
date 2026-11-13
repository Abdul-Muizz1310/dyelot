import { expect, type Locator, type Page } from "@playwright/test";
import { violations } from "./a11y-support";
import { loseContext, PLAYER_CAP, TELEMETRY, test } from "./flavor-support";
import { first, openStudio, stubSeeds } from "./studio-support";

// Playwright does not read the `?raw` query some engine files import: the hook makes it the text.
await import("./raw-hooks.mjs");
const { brandProps } = await import("@/export");
const { brandDescription } = await import("@/features/flavor/video");

// M6's accessibility fixes of docs/specs/06-gallery.md, section 14 (Task 6.8; R6-35 to R6-37):
// F-FIX6-01 to 04. Every flow fails, through the watch of flavor-support's `test`, on a CSP
// violation, a console error, a page error or an unhandled rejection in any document it visits.

test.use({ viewport: { width: 1280, height: 800 } });

const dialog = (page: Page): Locator => page.getByRole("dialog", { name: "Flavor", exact: true });
const player = (page: Page): Locator =>
  dialog(page)
    .getByRole("region", { name: "Brand video", exact: true })
    .locator("[data-brand-player]");

async function openFlavor(page: Page): Promise<void> {
  await TELEMETRY(page);
  await stubSeeds(page);
  await openStudio(page);
  await page.getByRole("button", { name: "Flavor", exact: true }).click();
  await expect(dialog(page).getByRole("heading", { name: "Flavor", exact: true })).toBeFocused();
  await expect(player(page)).toBeAttached({ timeout: PLAYER_CAP });
}

test.describe("F-FIX6-01 to 04 the accessibility fixes", () => {
  // Breaks when the Player's wrapper stops being a described figure, its frame leaves aria-hidden,
  // or the description stops being the design's own.
  test("F-FIX6-01 the brand video is a figure described by its contents", async ({ page }) => {
    await openFlavor(page);
    const figure = dialog(page).getByRole("figure", { name: "Brand video preview", exact: true });
    await expect(figure).toHaveCount(1);
    await expect(figure).toHaveAttribute("data-brand-player", "");
    await expect(figure).toHaveAccessibleDescription(
      brandDescription(brandProps(first(), "light")),
    );
    await expect(figure.locator("[data-brand-frame]")).toHaveAttribute("aria-hidden", "true");
    expect(await violations(page)).toEqual([]);
  });

  // Breaks when the dialog's two Pause buttons share a name or leave their order.
  test("F-FIX6-02 the dialog's stops are Pause the background, Pause the video, Render, Record, Close", async ({
    page,
  }) => {
    await openFlavor(page);
    const names = await dialog(page)
      .getByRole("button")
      .evaluateAll((buttons) =>
        buttons.map(
          (button) => button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "",
        ),
      );
    expect(new Set(names).size).toBe(names.length);
    const stops: string[] = [];
    for (let i = 0; i < 12 && stops.at(-1) !== "Close"; i++) {
      await page.keyboard.press("Tab");
      stops.push(
        await page.evaluate(() => {
          const element = document.activeElement as HTMLElement;
          return element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "";
        }),
      );
    }
    expect(stops).toEqual([
      "Pause the background",
      "Pause the video",
      "Render the brand video",
      "Record the shader loop",
      "Close",
    ]);
  });

  // Breaks when "Restart the 3D view" lets focus fall to the body, or the view stops returning.
  test("F-FIX6-03 Restart the 3D view leaves focus on the Turn slider", async ({ page }) => {
    await page.goto("/explore");
    const panel = page.locator("[data-explorer]");
    await expect(panel).toHaveAttribute("data-explorer-state", "3d");
    await expect(panel.locator("canvas")).toHaveCount(1);
    await loseContext(page, "[data-explorer] canvas");
    await expect(panel).toHaveAttribute("data-explorer-reason", "context-lost");
    const restart = panel.getByRole("button", { name: "Restart the 3D view", exact: true });
    await restart.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("slider", { name: "Turn", exact: true })).toBeFocused();
    await expect(panel).toHaveAttribute("data-explorer-state", "3d");
    await expect(page.getByRole("slider", { name: "Turn", exact: true })).toBeFocused();
  });

  // Breaks when the hero's Pause takes a longer name.
  test("F-FIX6-04 the hero's Pause keeps its name", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-hero] canvas")).toHaveAttribute("data-flavor", "running");
    await expect(
      page.locator("[data-hero]").getByRole("button", { name: "Pause", exact: true }),
    ).toHaveCount(1);
  });
});
