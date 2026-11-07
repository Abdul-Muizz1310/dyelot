import { expect, type Page, type Request } from "@playwright/test";
import {
  ABORT_CHUNK,
  allowAbortedChunk,
  HOLD_CHUNK,
  LOADING_RECORD,
  loadingCount,
  NO_IDLE,
  recordAborted,
  test,
  VT_RECORD,
  vtRecord,
} from "./flavor-support";
import { canvasFrame, openStudio, stubSeeds } from "./studio-support";
import {
  LAZY_TEMPLATES,
  recordTemplateChunks,
  TEMPLATE_MARKERS,
  templateRoot,
  templateSelect,
} from "./template-support";

// The lazy templates of docs/specs/06-gallery.md (R6-33, 13.3): F-TPL6-01 to 05 and F-TPL6-RF3
// (Task 6.7). The landing template loads with the studio; the other five load on demand, or when the
// browser is idle after the first paint, and each is told apart by probe 3's marker (R6-57). Every
// flow fails, through the watch of flavor-support's `test`, on a `securitypolicyviolation` event, a
// console error, a page error or an unhandled rejection it does not allow by name.

test.use({ viewport: { width: 1280, height: 800 } });

const GROUP = "::view-transition-group(dyelot-template)";
const LOADING = "Loading the template…";
const FAILED = "This template could not load.";
const RETRY = "Try again";

/** The next request for a JavaScript chunk: the switch has started to load its template. */
const chunkRequest = (page: Page): Promise<Request> =>
  page.waitForRequest((request) => /\/_next\/static\/chunks\/[^/]+\.js$/.test(request.url()));

/** Opens the studio on its first design and waits until no request is still on its way. */
async function openQuiet(page: Page): Promise<void> {
  await stubSeeds(page);
  await openStudio(page);
  await expect(templateRoot(page, "landing")).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test.describe("R6-33 the canvas loads only the template it shows", () => {
  // Breaks when the studio's first load brings a template it does not show, or a switch cannot load it.
  test("F-TPL6-01 with no idle time the first load fetches no lazy template, and a switch fetches its chunk", async ({
    page,
  }) => {
    await NO_IDLE(page);
    const chunks = recordTemplateChunks(page);
    await openQuiet(page);
    await expect(canvasFrame(page)).toHaveAttribute("data-template", "landing");
    expect(await chunks.loaded()).toEqual([]);
    await templateSelect(page).selectOption("dashboard");
    await expect(canvasFrame(page)).toHaveAttribute("data-template", "dashboard");
    await expect(templateRoot(page, "dashboard")).toBeVisible();
    await expect.poll(() => chunks.loaded()).toEqual(["dashboard"]);
  });

  // Breaks when the idle preload does not run, so every later switch waits on the network.
  test("F-TPL6-02 after the load the five lazy chunks arrive with no switch", async ({ page }) => {
    const chunks = recordTemplateChunks(page);
    await stubSeeds(page);
    await openStudio(page);
    await expect.poll(() => chunks.loaded()).toEqual(LAZY_TEMPLATES);
    await expect(canvasFrame(page)).toHaveAttribute("data-template", "landing");
    await expect(templateRoot(page, "landing")).toBeVisible();
  });
});

test.describe("RF3 templates that load late or not at all", () => {
  // Breaks when a switch to a template still loading shows the loading sentence, drops the old
  // template, or commits more than once.
  test("F-TPL6-03 a switch keeps the landing on screen while its chunk is held, then cross-fades once", async ({
    page,
  }) => {
    await VT_RECORD(page);
    await LOADING_RECORD(page);
    await NO_IDLE(page);
    const settings = await HOLD_CHUNK(page, TEMPLATE_MARKERS.settings);
    await openQuiet(page);
    const requested = chunkRequest(page);
    await templateSelect(page).selectOption("settings");
    await requested;
    await expect(templateSelect(page)).toHaveValue("settings");
    await expect(canvasFrame(page)).toHaveAttribute("data-template", "landing");
    await expect(templateRoot(page, "landing")).toBeVisible();
    expect((await vtRecord(page)).calls).toBe(0);
    expect(await loadingCount(page)).toBe(0);
    settings.release();
    await expect(canvasFrame(page)).toHaveAttribute("data-template", "settings");
    await expect(templateRoot(page, "settings")).toBeVisible();
    await expect.poll(async () => (await vtRecord(page)).animations.length).toBeGreaterThan(0);
    const record = await vtRecord(page);
    expect(record.calls).toBe(1);
    expect(record.animations.some((animation) => animation.pseudo === GROUP)).toBe(true);
    expect(await loadingCount(page)).toBe(0);
  });

  // Breaks when a switch under the OS's reduced motion waits silently on its chunk, or animates.
  test("F-TPL6-04 under reduced motion a held switch says the template is loading, then shows it at once", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await VT_RECORD(page);
    await NO_IDLE(page);
    const editorial = await HOLD_CHUNK(page, TEMPLATE_MARKERS.editorial);
    await openQuiet(page);
    await templateSelect(page).selectOption("editorial");
    const loading = canvasFrame(page).getByText(LOADING, { exact: true });
    await expect(loading).toBeVisible();
    await expect(loading).toHaveAttribute("role", "status");
    editorial.release();
    await expect(templateRoot(page, "editorial")).toBeVisible();
    await expect(loading).toHaveCount(0);
    await expect.poll(async () => (await vtRecord(page)).animations.length).toBeGreaterThan(0);
    const record = await vtRecord(page);
    expect(record.animations.filter((animation) => animation.duration > 0)).toEqual([]);
  });

  // Breaks when a chunk that does not arrive shows a raw error or nothing, or "Try again" cannot load
  // it once it can arrive (I-M6-04).
  test("F-TPL6-05 a template whose chunk fails says so with Try again, which shows it once it loads", async ({
    page,
    watch,
  }) => {
    const aborted = recordAborted(page);
    await NO_IDLE(page);
    const chunk = await ABORT_CHUNK(page, TEMPLATE_MARKERS.dashboard);
    await openQuiet(page);
    await templateSelect(page).selectOption("dashboard");
    const alert = canvasFrame(page).getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveAttribute("data-template-failed", "");
    await expect(alert.getByText(FAILED, { exact: true })).toBeVisible();
    await expect(alert.getByRole("button", { name: RETRY, exact: true })).toBeVisible();
    // No raw error: the sentence and the button are all the canvas says.
    await expect(canvasFrame(page)).toHaveText(`${FAILED}${RETRY}`);
    // 14.11's ABORT_CHUNK rule: the chunk failed twice, its request and Turbopack's one retry. React
    // reports the error the boundary caught once (the R6-33 amendment, as R5-39's for the explorer).
    await allowAbortedChunk(page, watch, aborted, TEMPLATE_MARKERS.dashboard);
    const path = new URL(aborted[0] ?? "").pathname.replace(/[.]/g, "\\.");
    watch.allow(new RegExp(`^ChunkLoadError: Failed to load chunk ${path} from module \\d+\\n`), 1);
    chunk.release();
    await alert.getByRole("button", { name: RETRY, exact: true }).click();
    await expect(templateRoot(page, "dashboard")).toBeVisible();
    await expect(canvasFrame(page).getByRole("alert")).toHaveCount(0);
    await expect(canvasFrame(page)).toHaveAttribute("data-template", "dashboard");
  });

  // Breaks when a second switch before either chunk arrives shows the loading sentence, drops the
  // old template, lands on the first choice, or makes a transition per chunk and switch.
  test("F-TPL6-RF3 two switches before either chunk arrives keep the landing, then show the second", async ({
    page,
  }) => {
    await VT_RECORD(page);
    await LOADING_RECORD(page);
    await NO_IDLE(page);
    const dashboard = await HOLD_CHUNK(page, TEMPLATE_MARKERS.dashboard);
    const mobile = await HOLD_CHUNK(page, TEMPLATE_MARKERS.mobile);
    await openQuiet(page);
    const first = chunkRequest(page);
    await templateSelect(page).selectOption("dashboard");
    await first;
    await expect(canvasFrame(page)).toHaveAttribute("data-template", "landing");
    const second = chunkRequest(page);
    await templateSelect(page).selectOption("mobile");
    await second;
    await expect(templateSelect(page)).toHaveValue("mobile");
    await expect(canvasFrame(page)).toHaveAttribute("data-template", "landing");
    await expect(templateRoot(page, "landing")).toBeVisible();
    dashboard.release();
    mobile.release();
    await expect(canvasFrame(page)).toHaveAttribute("data-template", "mobile");
    await expect(templateRoot(page, "mobile")).toBeVisible();
    expect((await vtRecord(page)).calls).toBeLessThanOrEqual(2);
    expect(await loadingCount(page)).toBe(0);
  });
});
