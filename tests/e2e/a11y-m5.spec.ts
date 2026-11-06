import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";
import { exportButton, exportDialog, fileRows, openReady, SPEC_LINK } from "./export-support";
import { NO_WEBGL, TELEMETRY, test } from "./flavor-support";
import {
  button,
  canvasFrame,
  inputsPanel,
  inspectorAside,
  modeSwitch,
  openStudio,
  stubSeeds,
} from "./studio-support";
import { reduceMotion } from "./template-support";

// M5's accessibility flows of docs/specs/05-motion-3d.md, section 14.11 (Task 5.11b): F-A11Y5-01 to
// 04 and F-HOME5-04 (R5-01, R5-32, R5-37, R5-38, R5-51, R5-66, 13.8). Every flow fails, through the
// watch of flavor-support's `test`, on a `securitypolicyviolation` event, a console error, a page
// error or an unhandled rejection in any document it visits, and a flow that installs `TELEMETRY`
// on any request to remotion.pro other than the usage event (14.11, R5-59).

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 360, height: 740 };
const VIEWPORTS = [DESKTOP, PHONE] as const;
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.use({ viewport: DESKTOP });

/** axe's violations under the WCAG A and AA tags, contrast included. */
async function violations(page: Page, exclude?: string) {
  const builder = new AxeBuilder({ page }).withTags(AXE_TAGS);
  if (exclude !== undefined) builder.exclude(exclude);
  return (await builder.analyze()).violations;
}

/** Waits until every finite animation on the page has finished: nothing is caught mid-fade. */
const settleAnimations = (page: Page): Promise<unknown> =>
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

const overflowOf = (page: Page): Promise<number> =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// Explorer and lab handles.
const panel = (page: Page): Locator => page.locator("[data-explorer]");
const lab = (page: Page): Locator => page.locator("[data-lab]");
const field = (page: Page, name: string): Locator =>
  page.getByRole("textbox", { name, exact: true });
const slider = (page: Page, name: string): Locator =>
  page.getByRole("slider", { name, exact: true });
const radio = (page: Page, name: string): Locator => page.getByRole("radio", { name, exact: true });

// Flavor dialog handles.
const flavorButton = (page: Page): Locator => button(page, "Flavor");
const dialog = (page: Page): Locator => page.getByRole("dialog", { name: "Flavor", exact: true });
const section = (page: Page, name: string): Locator =>
  dialog(page).getByRole("region", { name, exact: true });

async function in3d(page: Page): Promise<void> {
  await expect(panel(page)).toHaveAttribute("data-explorer-state", "3d");
  await expect(panel(page).locator("canvas")).toHaveCount(1);
}

/** The studio's "View" disclosure on a phone, where the canvas's switches sit behind it. */
async function openView(page: Page): Promise<void> {
  const view = button(page, "View");
  if ((await view.isVisible()) && (await view.getAttribute("aria-expanded")) === "false") {
    await view.click();
  }
}

/** Opens the Flavor dialog with the canvas's "Reduce motion" on (the Player holds frame 179). */
async function openFlavorReduced(page: Page, mode: "light" | "dark"): Promise<void> {
  await stubSeeds(page);
  await openStudio(page);
  await openView(page);
  if (mode === "dark") {
    await modeSwitch(page).click();
    await expect(modeSwitch(page)).toHaveAttribute("aria-checked", "true");
  }
  await reduceMotion(page).click();
  await expect(canvasFrame(page)).toHaveAttribute("data-reduced-motion", "true");
  await flavorButton(page).click();
  await expect(dialog(page)).toBeVisible();
  await expect(section(page, "Brand video").locator("[data-brand-player]")).toHaveAttribute(
    "data-playing",
    "false",
  );
  await settleAnimations(page);
}

// The brand video's render section (13.3, 13.4).
const RENDER_LABEL = "Render the brand video";
const NOTE_HEADING = "Before the first render";
const RENDERING_CAP = 240_000;
const brandSection = (page: Page): Locator => section(page, "Brand video");
const renderButton = (page: Page): Locator =>
  brandSection(page).getByRole("button", { name: RENDER_LABEL, exact: true });
const noteOf = (page: Page): Locator =>
  brandSection(page).getByRole("group", { name: NOTE_HEADING, exact: true });
const renderCancel = (page: Page): Locator =>
  brandSection(page).getByRole("button", { name: "Cancel", exact: true });

/** Opens the Flavor dialog on the first design and the privacy note in it. */
async function openFlavorWithNote(page: Page): Promise<void> {
  await stubSeeds(page);
  await openStudio(page);
  await flavorButton(page).click();
  await expect(dialog(page)).toBeVisible();
  await renderButton(page).click();
  await expect(noteOf(page)).toBeVisible();
  await settleAnimations(page);
}

/** Cancels a running render and waits until it has ended and its scaffold is gone. */
async function cancelRender(page: Page): Promise<void> {
  await renderCancel(page).click();
  await expect(brandSection(page).getByRole("status")).toHaveText(
    "Canceled. Nothing was downloaded.",
    { timeout: RENDERING_CAP },
  );
  await expect(page.locator('[class^="remotion-scaffold-"]')).toHaveCount(0);
}

for (const viewport of VIEWPORTS) {
  const at = `${viewport.width} px`;
  test.describe(`axe at ${at}`, () => {
    test.use({ viewport });

    // Breaks when the hero or the story, with every step in its final state, has a violation.
    test(`F-A11Y5-01 axe finds no violation on / at ${at}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await expect(page.locator("[data-hero] canvas")).toHaveAttribute("data-flavor", /.+/);
      expect(await violations(page)).toEqual([]);
    });

    test(`F-A11Y5-01 axe finds no violation on / with NO_WEBGL at ${at}`, async ({ page }) => {
      await NO_WEBGL(page);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await expect(page.locator("[data-hero]").getByRole("status")).not.toHaveText("");
      expect(await violations(page)).toEqual([]);
    });

    for (const mode of ["Light", "Dark"]) {
      test(`F-A11Y5-01 axe finds no violation on /explore in 3D, ${mode}, at ${at}`, async ({
        page,
      }) => {
        await page.goto("/explore");
        await in3d(page);
        if (mode === "Dark") {
          await radio(page, "Dark").check();
          await expect(panel(page)).toHaveAttribute("data-mode", "dark");
        }
        await settleAnimations(page);
        expect(await violations(page)).toEqual([]);
      });
    }

    test(`F-A11Y5-01 axe finds no violation on /explore with NO_WEBGL at ${at}`, async ({
      page,
    }) => {
      await NO_WEBGL(page);
      await page.goto("/explore");
      await expect(panel(page)).toHaveAttribute("data-explorer-state", "flat");
      expect(await violations(page)).toEqual([]);
    });

    test(`F-A11Y5-01 axe finds no violation on /motion with an invalid field shown at ${at}`, async ({
      page,
    }) => {
      await page.goto("/motion");
      await expect(lab(page)).toBeAttached();
      const instant = field(page, "instant (ms)");
      await instant.fill("abc");
      await expect(instant).toHaveAttribute("aria-invalid", "true");
      expect(await violations(page)).toEqual([]);
    });

    test(`F-A11Y5-01 axe finds no violation in the studio with a token row open at ${at}`, async ({
      page,
    }) => {
      await stubSeeds(page);
      await openStudio(page);
      if (viewport.width < 640) await button(page, "Inspector").click();
      const step = inspectorAside(page).locator("[data-step-button]").first();
      await step.click();
      await expect(step).toHaveAttribute("aria-expanded", "true");
      await expect(inspectorAside(page).locator("[data-token-row]")).toBeVisible();
      await settleAnimations(page);
      expect(await violations(page)).toEqual([]);
    });

    for (const mode of ["light", "dark"] as const) {
      test(`F-A11Y5-01 axe finds no violation in the Flavor dialog with Reduce motion on, ${mode}, at ${at}`, async ({
        page,
      }) => {
        await openFlavorReduced(page, mode);
        expect(await violations(page)).toEqual([]);
      });
    }

    test(`F-A11Y5-01 axe finds no violation in the Flavor dialog with the note shown at ${at}`, async ({
      page,
    }) => {
      await TELEMETRY(page);
      await openFlavorWithNote(page);
      expect(await violations(page)).toEqual([]);
    });

    test(`F-A11Y5-01 axe finds no violation in the Flavor dialog during a render at ${at}`, async ({
      page,
    }) => {
      test.setTimeout(RENDERING_CAP);
      await TELEMETRY(page);
      await openFlavorWithNote(page);
      await noteOf(page).getByRole("button", { name: "Render", exact: true }).click();
      await expect(brandSection(page).getByText("Rendering…", { exact: true })).toBeVisible({
        timeout: RENDERING_CAP,
      });
      await expect(
        brandSection(page).getByRole("progressbar", { name: "Brand video progress" }),
      ).toBeVisible();
      await expect(renderCancel(page)).toBeVisible();
      // The renderer's scaffold sits on the page, hidden.
      const scaffold = page.locator('[class^="remotion-scaffold-"]');
      await expect(scaffold).toHaveCount(1);
      expect(await scaffold.evaluate((node) => getComputedStyle(node).visibility)).toBe("hidden");
      expect(await violations(page)).toEqual([]);
      await cancelRender(page);
    });

    test(`F-A11Y5-01 axe finds no violation in the export dialog with flavor on at ${at}`, async ({
      page,
    }) => {
      await openStudio(page, SPEC_LINK);
      await openReady(page);
      const toggle = exportDialog(page).getByRole("switch", {
        name: "Include flavor files",
        exact: true,
      });
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await expect(fileRows(page)).toHaveCount(29);
      await settleAnimations(page);
      expect(await violations(page)).toEqual([]);
      await expect(exportButton(page)).toBeAttached();
    });

    // Breaks when a page or the open dialog scrolls sideways at a phone's width.
    test(`F-A11Y5-04 the pages and the Flavor dialog fit ${at} with no sideways scroll`, async ({
      page,
    }) => {
      for (const path of ["/", "/explore", "/motion"]) {
        await page.goto(path);
        expect(await overflowOf(page), path).toBeLessThanOrEqual(0);
      }
      await stubSeeds(page);
      await openStudio(page);
      await flavorButton(page).click();
      await expect(dialog(page)).toBeVisible();
      expect(await overflowOf(page), "the Flavor dialog").toBeLessThanOrEqual(0);
      const box = await dialog(page).boundingBox();
      expect((box?.x ?? -1) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
    });
  });
}

// Breaks when the nav's five links leave one row at 360 px, or a page grows wider than the screen.
test("F-HOME5-04 at 360 x 740 the nav's five links share a row and the pages fit", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  for (const path of ["/", "/explore", "/motion"]) {
    await page.goto(path);
    const nav = page.getByRole("navigation");
    const tops: number[] = [];
    for (const name of ["home", "studio", "explore", "motion", "github"]) {
      const link = nav.getByRole("link", { name, exact: true });
      await expect(link, `${path} ${name}`).toBeVisible();
      tops.push(Math.round((await link.boundingBox())?.y ?? -1));
    }
    expect(new Set(tops).size, path).toBe(1);
    expect(await overflowOf(page), path).toBeLessThanOrEqual(0);
  }
});

// Breaks when the hero's canvas, the explorer's 3D wrapper or the flat view lose their roles, or the
// summary and the palette line stop being text.
test("F-A11Y5-03 the canvases are hidden from assistive technology and the text stands in", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("[data-hero] canvas")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("[data-hero-controls]").getByText(/^Palette \d of 6: /)).toBeVisible();
  await page.goto("/explore");
  await in3d(page);
  const wrapper = panel(page)
    .locator("canvas")
    .locator("xpath=ancestor::*[@aria-hidden='true'][1]");
  await expect(wrapper).toHaveCount(1);
  const svg = page.locator("figure[data-flat-view] svg");
  await expect(svg).toHaveAttribute("role", "img");
  const labelledby = (await svg.getAttribute("aria-labelledby")) ?? "";
  const caption = await page.locator(`[id="${labelledby}"]`).textContent();
  expect(caption ?? "").toMatch(/^At L \d\.\d\d: how far each gamut reaches/);
  await expect(svg).toHaveAccessibleName(caption ?? "");
  await expect(page.locator("[data-explorer-summary]")).toContainText("steps of the light scales");
});

type Stop = { name: string; ring: number; width: number; height: number };

/** What the focused element is: its name, the width of its focus ring and its hit area. */
const focused = (page: Page): Promise<Stop> =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    const label = element.closest("label") ?? (element as HTMLInputElement).labels?.[0] ?? null;
    const own = element.getBoundingClientRect();
    const host = label?.getBoundingClientRect();
    const style = getComputedStyle(element);
    const outline = style.outlineStyle === "none" ? 0 : Number.parseFloat(style.outlineWidth);
    const labelledby = element.getAttribute("aria-labelledby");
    const name =
      element.getAttribute("aria-label") ??
      (labelledby !== null ? document.getElementById(labelledby)?.textContent : null) ??
      label?.textContent ??
      element.textContent ??
      "";
    return {
      name: name.trim(),
      ring: outline,
      width: Math.max(own.width, host?.width ?? 0),
      height: Math.max(own.height, host?.height ?? 0),
    };
  });

/** Tabs from the focused element until a stop's name is `last`, returning every stop met. */
async function tabTo(page: Page, last: string, limit = 80): Promise<Stop[]> {
  const stops: Stop[] = [];
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press("Tab");
    const stop = await focused(page);
    stops.push(stop);
    if (stop.name === last) return stops;
  }
  throw new Error(`tabTo: no stop named ${last} within ${limit} tabs`);
}

/** Each stop shows a ring of at least 2 px and a hit area of at least 24 x 24 px. */
function expectReachable(stops: readonly Stop[]): void {
  for (const stop of stops) {
    expect(stop.ring, `${stop.name}: ring`).toBeGreaterThanOrEqual(2);
    expect(stop.width, `${stop.name}: width`).toBeGreaterThanOrEqual(24);
    expect(stop.height, `${stop.name}: height`).toBeGreaterThanOrEqual(24);
  }
}

/** `wanted` appear in `names` in this order, other stops allowed between. */
function expectInOrder(names: readonly string[], wanted: readonly string[]): void {
  let from = 0;
  for (const name of wanted) {
    const at = names.indexOf(name, from);
    expect(at, `${name} after ${from} in ${names.join(" | ")}`).toBeGreaterThanOrEqual(0);
    from = at + 1;
  }
}

test.describe("F-A11Y5-02 the keyboard reaches every new control", () => {
  // Breaks when the hero's controls leave their order, lose the ring or shrink under 24 px, or Enter
  // and Space stop working them.
  test("F-A11Y5-02 the hero's three controls", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-hero] canvas")).toHaveAttribute("data-flavor", "running");
    const next = page.getByRole("button", { name: "Next palette", exact: true });
    await next.focus();
    const stops: Stop[] = [await focused(page)];
    stops.push(...(await tabTo(page, "Open this palette in the studio")));
    expect(stops.map((stop) => stop.name)).toEqual([
      "Next palette",
      "Pause",
      "Open this palette in the studio",
    ]);
    expectReachable(stops);
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-hero]")).toHaveAttribute("data-hero-index", "2");
    const pause = page.getByRole("button", { name: "Pause", exact: true });
    await pause.focus();
    await page.keyboard.press("Space");
    await expect(pause).toHaveAttribute("aria-pressed", "true");
  });

  // Breaks when the explorer's Tab order leaves 8.1's, or a control stops answering the keyboard.
  test("F-A11Y5-02 the explorer's controls", async ({ page }) => {
    await page.goto("/explore");
    await in3d(page);
    await page.getByRole("radio", { checked: true }).first().focus();
    const stops: Stop[] = [await focused(page)];
    stops.push(...(await tabTo(page, "Open in the studio")));
    expectInOrder(
      stops.map((stop) => stop.name),
      ["Lightness slice", "Turn", "Tilt", "Zoom", "Reset view", "Open in the studio"],
    );
    expectReachable(stops);
    // Arrow keys move a slider and a radio group.
    await slider(page, "Turn").focus();
    await page.keyboard.press("ArrowRight");
    await expect(panel(page)).toHaveAttribute("data-turn", "36");
    await radio(page, "sRGB").focus();
    await page.keyboard.press("ArrowRight");
    await expect(panel(page)).toHaveAttribute("data-gamut", "p3");
    await button(page, "Reset view").focus();
    await page.keyboard.press("Enter");
    await expect(panel(page)).toHaveAttribute("data-turn", "35");
  });

  // Breaks when the lab's Tab order leaves 9.1's, or a field stops taking typed text, spaces included.
  test("F-A11Y5-02 the lab's controls", async ({ page }) => {
    await page.goto("/motion");
    await expect(lab(page)).toBeAttached();
    await page.getByRole("button", { name: "dyelot", exact: true }).focus();
    const stops: Stop[] = [await focused(page)];
    stops.push(...(await tabTo(page, "Open in the studio", 200)));
    expectInOrder(
      stops.map((stop) => stop.name),
      [
        "dyelot",
        "Productive",
        "Snappy",
        "instant (ms)",
        "standard x1",
        "smooth duration (s)",
        "Reduced motion",
        "Open in the studio",
      ],
    );
    expectReachable(stops);
    const fast = field(page, "fast (ms)");
    await fast.fill("");
    await fast.focus();
    await page.keyboard.type("1 2");
    await expect(fast).toHaveValue("1 2");
    await expect(page.getByRole("switch", { name: "Reduced motion", exact: true })).toBeVisible();
    const reduced = page.getByRole("switch", { name: "Reduced motion", exact: true });
    const before = await reduced.getAttribute("aria-checked");
    await reduced.focus();
    await page.keyboard.press("Space");
    await expect(reduced).not.toHaveAttribute("aria-checked", before ?? "");
  });

  // Breaks when the studio's new stops (the lab link, the Scales steps and their explorer link)
  // lose the ring or the hit area.
  test("F-A11Y5-02 the studio's new stops", async ({ page }) => {
    await stubSeeds(page);
    await openStudio(page);
    const link = inputsPanel(page).getByRole("link", { name: "Edit in the motion lab" });
    await link.focus();
    const stops: Stop[] = [await focused(page)];
    const explorer = inspectorAside(page).getByRole("link", {
      name: "See these scales in the explorer",
    });
    await inspectorAside(page).locator("[data-scroll-area]").focus();
    stops.push(...(await tabTo(page, "See these scales in the explorer")));
    await expect(explorer).toBeFocused();
    expectReachable(stops);
    // The toolbar ends Undo, Redo, Copy link, Export, Flavor.
    await button(page, "Undo").focus();
    const ending = await tabTo(page, "Flavor");
    expect(ending.map((stop) => stop.name)).toEqual(["Redo", "Copy link", "Export", "Flavor"]);
    expectReachable(ending);
  });

  // Breaks when the open dialog's Tab order leaves 13.8's or its controls lose the ring or hit area.
  test("F-A11Y5-02 the Flavor dialog's order, ring and hit area", async ({ page }) => {
    await TELEMETRY(page);
    await stubSeeds(page);
    await openStudio(page);
    await flavorButton(page).click();
    await expect(dialog(page).getByRole("heading", { name: "Flavor", exact: true })).toBeFocused();
    await expect(section(page, "Brand video").locator("[data-brand-player]")).toBeAttached();
    const stops = await tabTo(page, "Close");
    expectReachable(stops);
    expect(stops.map((stop) => stop.name)).toEqual([
      "Pause",
      "Pause",
      "Render the brand video",
      "Record the shader loop",
      "Close",
    ]);
  });

  // Breaks when the privacy note's heading stops taking focus, its buttons leave the order Render,
  // Cancel (13.4), or Cancel and Render stop moving focus where the note says.
  test("F-A11Y5-02 the privacy note's order, and where focus goes", async ({ page }) => {
    await TELEMETRY(page);
    await openFlavorWithNote(page);
    await expect(noteOf(page).getByRole("heading", { name: NOTE_HEADING })).toBeFocused();
    const stops = await tabTo(page, "Cancel");
    expect(stops.map((stop) => stop.name)).toEqual(["Render", "Cancel"]);
    expectReachable(stops);
    await page.keyboard.press("Enter");
    await expect(renderButton(page)).toBeFocused();
    await renderButton(page).press("Enter");
    await noteOf(page).getByRole("button", { name: "Render", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(renderCancel(page)).toBeFocused();
    await cancelRender(page);
  });
});
