import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { flavorStops, type Mode } from "@/engine";
import { FLAVOR_LINES } from "@/features/flavor/video";
import { loseContext } from "./flavor-support";
import {
  button,
  canvasFrame,
  canvasRegion,
  first,
  modeSwitch,
  openStudio,
  stubSeeds,
} from "./studio-support";
import { reduceMotion } from "./template-support";

// Playwright does not read the `?raw` query some export files import: the hook makes it the text.
await import("./raw-hooks.mjs");
const { brandProps } = await import("@/export");

// The Flavor dialog's flows of docs/specs/05-motion-3d.md, section 14.11 (R5-51, R5-52, 11.1, 13.1
// to 13.3, 13.8): F-FLAVOR-01, 02, 03, 05, 08 and F-STUD5-03 (Task 5.9b). Every flow fails on a
// `securitypolicyviolation` event, a console error or a page error (14.11).

/**
 * Each flow records, before the page's scripts run, every policy violation, console error and page
 * error, and fails at its end if any came.
 */
const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") problems.push(`console: ${message.text()}`);
      });
      page.on("pageerror", (error) => problems.push(`page: ${error.message}`));
      await page.addInitScript(() => {
        const host = window as unknown as { __violations: string[] };
        host.__violations = [];
        document.addEventListener(
          "securitypolicyviolation",
          (event) => host.__violations.push(`${event.violatedDirective} ${event.blockedURI}`),
          true,
        );
      });
      await use(problems);
      const violations = await page.evaluate(
        () => (window as unknown as { __violations?: string[] }).__violations ?? [],
      );
      expect([...problems, ...violations.map((each) => `violation: ${each}`)]).toEqual([]);
    },
    { auto: true },
  ],
});

test.use({ viewport: { width: 1280, height: 800 } });

const PHONE = { width: 360, height: 740 };

const flavorButton = (page: Page): Locator => button(page, "Flavor");
const dialog = (page: Page): Locator => page.getByRole("dialog", { name: "Flavor", exact: true });
const section = (page: Page, name: string): Locator =>
  dialog(page).getByRole("region", { name, exact: true });
const preview = (page: Page): Locator => dialog(page).locator("[data-flavor-preview] canvas");
const player = (page: Page): Locator => section(page, "Brand video").locator("[data-brand-player]");
const pauseIn = (page: Page, name: string): Locator =>
  section(page, name).getByRole("button", { name: "Pause", exact: true });

/** The stops the preview names in `data-flavor-stops` for the first design in `mode`. */
const stopsOf = (mode: Mode): string => flavorStops(first(), mode).join(",").toLowerCase();

/** Opens the studio on its first design and the Flavor dialog over it. */
async function openFlavor(page: Page, before?: () => Promise<void>): Promise<void> {
  await stubSeeds(page);
  await openStudio(page);
  await before?.();
  await flavorButton(page).click();
  await expect(dialog(page)).toBeVisible();
}

/** The product of the opacities from `locator` up to the root: 1 when nothing above it is faded. */
const shownOpacity = (locator: Locator): Promise<number> =>
  locator.evaluate((element) => {
    let opacity = 1;
    for (let node: Element | null = element; node !== null; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    return opacity;
  });

test.describe("the Flavor dialog", () => {
  // Breaks when "Flavor" stops opening a modal dialog with its three sections and a running preview,
  // or when closing it loses focus.
  test("F-FLAVOR-01 Flavor opens a modal dialog with three sections, a running preview and Pause", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    await expect(flavorButton(page)).toHaveAttribute("aria-haspopup", "dialog");
    await flavorButton(page).click();
    const shown = dialog(page);
    await expect(shown).toHaveAttribute("aria-modal", "true");
    const heading = shown.getByRole("heading", { name: "Flavor", exact: true });
    await expect(heading).toBeFocused();
    // The rest of the page is inert: a focus call leaves focus in the dialog.
    await button(page, "Regenerate").evaluate((element) => element.focus());
    await expect(heading).toBeFocused();
    await expect(
      shown.getByText(
        "This design's moving parts: an animated background, a brand video and a loop of the background, all made in this browser.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(shown.getByRole("heading", { level: 3 })).toHaveText([
      "Background",
      "Brand video",
      "Shader loop",
    ]);
    for (const name of ["Background", "Brand video", "Shader loop"]) {
      await expect(section(page, name)).toHaveCount(1);
    }
    await expect(section(page, "Shader loop").getByRole("status")).toHaveText("");

    await expect(preview(page)).toHaveAttribute("data-flavor", "running");
    await expect(preview(page)).toHaveAttribute("data-flavor-stops", stopsOf("light"));
    const box = await dialog(page).locator("[data-flavor-preview]").boundingBox();
    expect(box).not.toBeNull();
    expect(Math.abs((box?.width ?? 0) / (box?.height ?? 1) - 16 / 9)).toBeLessThan(0.02);
    await expect(pauseIn(page, "Background")).toHaveAttribute("aria-pressed", "false");
    await expect(section(page, "Background").getByRole("status")).toHaveText("");
    await expect(
      section(page, "Background").getByText(
        "To take this background as code, turn on Include flavor files in Export.",
        { exact: true },
      ),
    ).toBeVisible();
    // The preview's Pause holds the loop.
    await pauseIn(page, "Background").click();
    await expect(pauseIn(page, "Background")).toHaveAttribute("aria-pressed", "true");
    await expect(preview(page)).toHaveAttribute("data-flavor", "paused");

    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(flavorButton(page)).toBeFocused();
    // "Close" shuts it too, and a new dialog starts over.
    await flavorButton(page).click();
    await expect(preview(page)).toHaveAttribute("data-flavor", "running");
    await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(flavorButton(page)).toBeFocused();
  });

  // Breaks when the Player autoplays under the canvas's Reduce motion, opens anywhere but its
  // finished picture, shows a control of its own, or its Pause does not start it; or when the still
  // preview's sentence names the wrong cause (the 6.4 and 13.2 amendments of Task 5.9b's review).
  test("F-FLAVOR-02 with the canvas's Reduce motion on, the Player waits on its finished picture", async ({
    page,
  }) => {
    await openFlavor(page, async () => {
      await reduceMotion(page).click();
      await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "true");
    });
    await expect(player(page)).toHaveAttribute("data-autoplay", "false");
    await expect(player(page)).toHaveAttribute("data-playing", "false");
    await expect(player(page)).toHaveAttribute("data-mode", "light");
    // Only the canvas's switch holds the preview still: the sentence names the switch.
    const backgroundLine = section(page, "Background").getByRole("status");
    await expect(preview(page)).toHaveAttribute("data-flavor", "still");
    await expect(backgroundLine).toHaveText(
      "The background is still because the canvas's Reduce motion switch is on.",
    );
    await expect(pauseIn(page, "Background")).toHaveCount(0);
    const props = brandProps(first(), "light");
    const checks = player(page).getByText(
      `${props.checks.passed} of ${props.checks.required} required checks pass`,
      { exact: true },
    );
    const names = player(page).getByText(props.name, { exact: true });
    await expect(names).toHaveCount(2);
    const start = player(page).getByText("Get started", { exact: true });
    for (const part of [checks, names.first(), names.last(), start]) {
      await expect(part).toBeVisible();
      expect(await shownOpacity(part)).toBe(1);
    }
    await expect(player(page).getByRole("button")).toHaveCount(0);
    await expect(player(page).getByRole("slider")).toHaveCount(0);
    const pause = pauseIn(page, "Brand video");
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    await pause.click();
    await expect(player(page)).toHaveAttribute("data-playing", "true");
    await expect(pause).toHaveAttribute("aria-pressed", "false");
    // Once the device asks too, the sentence names the device, with the switch still on.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(backgroundLine).toHaveText(FLAVOR_LINES.still);
    await expect(preview(page)).toHaveAttribute("data-flavor", "still");
  });

  // Breaks when the Player stops autoplaying, its Pause stops pausing it, or the dialog stops
  // following the canvas's mode.
  test("F-FLAVOR-03 the Player autoplays and pauses, and the dialog follows the canvas's dark mode", async ({
    page,
  }) => {
    await openFlavor(page);
    await expect(player(page)).toHaveAttribute("data-autoplay", "true");
    await expect(player(page)).toHaveAttribute("data-playing", "true");
    const pause = pauseIn(page, "Brand video");
    await expect(pause).toHaveAttribute("aria-pressed", "false");
    await pause.click();
    await expect(player(page)).toHaveAttribute("data-playing", "false");
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);

    await modeSwitch(page).click();
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "dark");
    await flavorButton(page).click();
    await expect(preview(page)).toHaveAttribute("data-flavor-stops", stopsOf("dark"));
    await expect(player(page)).toHaveAttribute("data-mode", "dark");
    await expect(
      player(page).getByText(brandProps(first(), "dark").name, { exact: true }).first(),
    ).toBeVisible();
  });

  // Breaks when a lost context leaves the preview without its sentence, or "Restart the animation"
  // does not bring the loop back.
  test("F-FLAVOR-05 a lost context shows its sentence and Restart the animation, which runs again", async ({
    page,
  }) => {
    await openFlavor(page);
    await expect(preview(page)).toHaveAttribute("data-flavor", "running");
    await loseContext(page, "[data-flavor-preview] canvas");
    await expect(preview(page)).toHaveAttribute("data-flavor", "fallback");
    await expect(preview(page)).toHaveAttribute("data-flavor-reason", "context-lost");
    const background = section(page, "Background");
    await expect(background.getByRole("status")).toHaveText(FLAVOR_LINES["context-lost"]);
    await expect(pauseIn(page, "Background")).toHaveCount(0);
    const restart = background.getByRole("button", { name: FLAVOR_LINES.restart, exact: true });
    await restart.click();
    await expect(preview(page)).toHaveAttribute("data-flavor", "running");
    await expect(background.getByRole("status")).toHaveText("");
    await expect(restart).toHaveCount(0);
    await expect(pauseIn(page, "Background")).toBeFocused();
  });

  // Breaks when the Player mounts an audio element, or playing it raises a policy violation or a
  // console error (the auto fixture checks both).
  test("F-FLAVOR-08 the playing Player holds no audio element for 6 s", async ({ page }) => {
    await page.addInitScript(() => {
      const host = window as unknown as { __audioSeen: number };
      host.__audioSeen = 0;
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof Element) {
              host.__audioSeen +=
                (node.matches("audio") ? 1 : 0) + node.querySelectorAll("audio").length;
            }
          }
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await openFlavor(page);
    await expect(player(page)).toHaveAttribute("data-playing", "true");
    // A wait, not a timing: the Player plays its whole 6 s once.
    await page.waitForTimeout(6000);
    await expect(player(page)).toHaveAttribute("data-playing", "true");
    expect(await page.locator("audio").count()).toBe(0);
    expect(
      await page.evaluate(() => (window as unknown as { __audioSeen: number }).__audioSeen),
    ).toBe(0);
  });
});

test.describe("the toolbar", () => {
  // Breaks when "Flavor" leaves the end of the toolbar's Tab order, or the phone toolbar grows past
  // probe 7's bound.
  test("F-STUD5-03 the toolbar's Tab order ends with Flavor, and at 360 px it stays at most 170 px tall", async ({
    page,
  }) => {
    await stubSeeds(page);
    await openStudio(page);
    const ending = [
      button(page, "Undo"),
      button(page, "Redo"),
      button(page, "Copy link"),
      button(page, "Export"),
      flavorButton(page),
      canvasRegion(page),
    ];
    await ending[0]?.focus();
    for (const stop of ending.slice(1)) {
      await page.keyboard.press("Tab");
      await expect(stop).toBeFocused();
    }
    await page.setViewportSize(PHONE);
    await expect(button(page, "View")).toHaveAttribute("aria-expanded", "false");
    const box = await page.getByRole("region", { name: "Canvas toolbar" }).boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(170);
    await button(page, "Undo").focus();
    for (const stop of ending.slice(1)) {
      await page.keyboard.press("Tab");
      await expect(stop).toBeFocused();
    }
  });
});
