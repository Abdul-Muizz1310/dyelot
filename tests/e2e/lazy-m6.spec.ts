import { expect } from "@playwright/test";
import { NO_IDLE, test } from "./flavor-support";
import { loaded, REMOTION, recordScripts } from "./lazy-support";
import { canvasFrame, openStudio, stubSeeds } from "./studio-support";
import { recordTemplateChunks } from "./template-support";

// The laziness flows of docs/specs/06-gallery.md, section 14.11 (R6-56, R6-33, I-M6-03, R5-61):
// F-LAZY6-01 and F-LAZY6-02 (Task 6.11a). Each reads the text of every JavaScript response a page
// fetches and tells the code apart by its marker: the engine's version string, the export's
// receipt format, and R5-64's markers for three, R3F, Remotion and Mediabunny, from
// tests/e2e/lazy-support.ts, which the M5 flows' positive checks read too; the lazy templates' by
// probe 3's (`TEMPLATE_MARKERS`, R6-57). Every flow fails, through the watch of flavor-support's
// `test`, on a `securitypolicyviolation` event, a console error, a page error or an unhandled
// rejection in any document it visits.

test.use({ viewport: { width: 1280, height: 800 } });

/** The pages M6 adds, whose chunks hold no engine, export, three or Remotion (R6-56). */
const NEW_PAGES = ["/gallery", "/gallery/kermes", "/about"] as const;

test.describe("I-M6-03 the new pages and sections load no engine", () => {
  for (const path of NEW_PAGES) {
    // Breaks when a gallery or About file reaches the engine, the export, three or Remotion.
    test(`F-LAZY6-01 ${path} loads no chunk of the engine, the export, three or Remotion`, async ({
      page,
    }) => {
      const scripts = recordScripts(page);
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await page.waitForLoadState("networkidle");
      expect((await scripts.read()).length).toBeGreaterThan(0);
      expect(await loaded(scripts, ["engine", "export", "three", "remotion"])).toEqual([]);
    });
  }

  // Breaks when the start-from or receipt section brings the engine, the export or Remotion to /.
  test("F-LAZY6-01 / loads no chunk of the engine, the export or Remotion, its new sections shown", async ({
    page,
  }) => {
    const scripts = recordScripts(page);
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("[data-hero] canvas")).toHaveAttribute("data-flavor", "running");
    for (const section of ["[data-start-from]", "[data-receipt]"]) {
      const shown = page.locator(section);
      await expect(shown, section).toHaveCount(1);
      await shown.scrollIntoViewIfNeeded();
      await expect(shown, section).toBeInViewport();
    }
    await page.waitForLoadState("networkidle");
    expect((await scripts.read()).length).toBeGreaterThan(0);
    expect(await loaded(scripts, ["engine", "export", ...REMOTION])).toEqual([]);
  });
});

test.describe("R6-33 the studio's first load stays lean", () => {
  // Breaks when the studio's first load pulls in the 3D stack, Remotion, Mediabunny or a template it
  // does not show.
  test("F-LAZY6-02 with no idle time the studio's first load fetches no three, R3F, Remotion, Mediabunny or lazy template chunk", async ({
    page,
  }) => {
    await NO_IDLE(page);
    const scripts = recordScripts(page);
    const templates = recordTemplateChunks(page);
    await stubSeeds(page);
    await openStudio(page);
    await expect(canvasFrame(page)).toHaveAttribute("data-template", "landing");
    await page.waitForLoadState("networkidle");
    // The studio's own code arrived: its client holds the engine.
    expect(await loaded(scripts, ["engine"])).toEqual(["engine"]);
    expect(await loaded(scripts, ["three", "r3f", ...REMOTION, "mediabunny"])).toEqual([]);
    expect(await templates.loaded()).toEqual([]);
  });
});
