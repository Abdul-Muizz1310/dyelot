import { type APIRequestContext, expect, type Page, type Worker } from "@playwright/test";
import { applyPreset, normalizeSeed, parseColor } from "@/engine";
import { decodeSpec } from "@/spec";
import { MADDER, TURQUOISE } from "../unit/support/gallery";
import {
  briefField,
  briefLines,
  hashOf,
  imageInput,
  imageLines,
  imageSection,
  isAiRequest,
  lockToggle,
  mockLog,
  recordRequests,
  seedField,
} from "./ai-support";
import { STORAGE_DRAFT, test } from "./flavor-support";
import {
  button,
  canvasFrame,
  designFor,
  FRESH,
  first,
  inputsAside,
  inputsPanel,
  lotId,
  lotOf,
  openStudio,
  ready,
  seedOf,
  stubSeeds,
} from "./studio-support";

// The flows of docs/specs/06-gallery.md, section 14.5 (Task 6.5b; R6-23 to R6-26, 10.2, 10.3): an
// entry hash opens the studio on a fresh design and hands its brief or its image request to the
// inputs, with nothing run; a malformed one opens a fresh design with the damaged-link notice; a
// loaded design or a restored draft opens with its preset's view. Each entry flow checks that
// nothing ran a model: the page sent no request to the AI layer, and the mock OpenRouter logged none.

test.use({ viewport: { width: 1280, height: 800 } });

const WIDE = { width: 1440, height: 900 };
const PHONE = { width: 360, height: 740 };

const BRIEF_HASH = "#brief=A%20tea%20house%20at%20dusk";
const BRIEF_TEXT = "A tea house at dusk";
const DAMAGED = "This link is damaged or cut short, so the studio cannot open it.";
const FRESH_INSTEAD = "The studio opened a fresh design instead.";

/**
 * Starts recording what could run a model (R6-24) and returns the check: the page sent no request to
 * dyelot's `/api/ai/` or to OpenRouter, and the mock OpenRouter (`GET /__log`) logged no request
 * after the ones it held when the recording started. Call it before `goto`.
 */
async function noModelRuns(page: Page, request: APIRequestContext): Promise<() => Promise<void>> {
  const requests = recordRequests(page);
  const before = await mockLog(request);
  return async () => {
    expect(requests.filter(isAiRequest).map((entry) => entry.url())).toEqual([]);
    // The mock's log is one for the whole run, and `POST /__scenario` clears it. The flows that post
    // to it live in ai-route.spec.ts, which runs before this file in the run's order, but nothing
    // enforces that order: a log shorter than at the start means another worker cleared it in
    // between, and the check below would then pass on an empty slice, so that fails the flow too.
    const after = await mockLog(request);
    expect(after.length).toBeGreaterThanOrEqual(before.length);
    expect(after.slice(before.length)).toEqual([]);
  };
}

/** Waits for the load's persist: the hash becomes the `#s=` link of the shown design (R6-24). */
async function persisted(page: Page): Promise<void> {
  await expect.poll(() => hashOf(page)).toMatch(/^#s=/);
}

/** Every worker the page starts from now on. Call it before `goto`. */
function startedWorkers(page: Page): Worker[] {
  const started: Worker[] = [];
  page.on("worker", (worker) => started.push(worker));
  return started;
}

/**
 * Nothing read an image (R6-24): the Image section shows no line and no colors, and the page started
 * one worker, the generator's, and not the image worker.
 */
async function expectNoImageRead(page: Page, workers: readonly Worker[]): Promise<void> {
  await expect(imageLines(page).locator("p")).toHaveCount(0);
  await expect(imageSection(page).getByRole("list")).toHaveCount(0);
  expect(workers).toHaveLength(1);
}

/** The preset select's shown option (section 7.2). */
const presetShown = (page: Page) =>
  inputsPanel(page)
    .getByRole("combobox", { name: "Preset", exact: true })
    .locator("option:checked");

test.describe("14.5 an entry hash opens the studio", () => {
  test("F-HASH6-01 #color= locks the primary, writes the link within 1 s, and a reload shows the same lot", async ({
    page,
    request,
  }) => {
    const check = await noModelRuns(page, request);
    await stubSeeds(page);
    await openStudio(page, "#color=f66c6d");
    const spec = designFor({ ...FRESH, primary: normalizeSeed(parseColor("#f66c6d")) }, seedOf(1));
    await expect(seedField(page, "Primary")).toHaveValue("#f66c6d");
    await expect(lockToggle(page, "primary")).toHaveAttribute("aria-pressed", "true");
    await expect(lotId(page)).toHaveText(lotOf(spec));
    await expect.poll(() => hashOf(page), { timeout: 1_000 }).toMatch(/^#s=/);
    expect(decodeSpec((await hashOf(page)).slice(3))).toEqual(spec);
    await page.reload();
    await ready(page);
    await expect(lotId(page)).toHaveText(lotOf(spec));
    await check();
  });
});

test.describe("14.5 a brief or image entry at 1440 x 900", () => {
  test.use({ viewport: WIDE });

  test("F-HASH6-02 #brief= puts the text in the focused Brief box and runs nothing", async ({
    page,
    request,
  }) => {
    const check = await noModelRuns(page, request);
    await openStudio(page, BRIEF_HASH);
    await expect(briefField(page)).toHaveValue(BRIEF_TEXT);
    await expect(briefField(page)).toBeFocused();
    await persisted(page);
    await expect(briefLines(page).locator("p")).toHaveCount(0);
    await check();
  });

  test("F-HASH6-04 #start=image focuses Choose an image and runs nothing", async ({
    page,
    request,
  }) => {
    const check = await noModelRuns(page, request);
    const workers = startedWorkers(page);
    await openStudio(page, "#start=image");
    await expect(imageInput(page)).toBeFocused();
    await persisted(page);
    await expectNoImageRead(page, workers);
    await check();
  });
});

test.describe("14.5 a brief or image entry at 360 x 740", () => {
  test.use({ viewport: PHONE });

  test("F-HASH6-03 #brief= opens the inputs drawer on the focused Brief box; Escape gives focus to Inputs", async ({
    page,
    request,
  }) => {
    const check = await noModelRuns(page, request);
    await openStudio(page, BRIEF_HASH);
    await expect(inputsAside(page)).toBeVisible();
    await expect(inputsAside(page)).not.toHaveAttribute("inert");
    await expect(briefField(page)).toHaveValue(BRIEF_TEXT);
    await expect(briefField(page)).toBeFocused();
    await persisted(page);
    await expect(briefLines(page).locator("p")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(inputsAside(page)).toBeHidden();
    await expect(button(page, "Inputs")).toBeFocused();
    await check();
  });

  test("F-HASH6-04 #start=image focuses Choose an image inside the open inputs drawer", async ({
    page,
    request,
  }) => {
    const check = await noModelRuns(page, request);
    const workers = startedWorkers(page);
    await openStudio(page, "#start=image");
    await expect(inputsAside(page)).toBeVisible();
    await expect(inputsAside(page)).not.toHaveAttribute("inert");
    await expect(imageInput(page)).toBeFocused();
    await persisted(page);
    await expectNoImageRead(page, workers);
    await check();
  });
});

test.describe("14.5 a malformed entry", () => {
  for (const hash of ["#color=nothex", "#brief=%E0%A4%A", "#start=video"]) {
    test(`F-HASH6-05 ${hash} opens a fresh design with the damaged-link notice and keeps the hash`, async ({
      page,
    }) => {
      await stubSeeds(page);
      await openStudio(page, hash);
      const alert = page.locator("header").getByRole("alert");
      await expect(alert).toContainText(DAMAGED);
      await expect(alert).toContainText(FRESH_INSTEAD);
      await expect(canvasFrame(page)).toBeVisible();
      await expect(lotId(page)).toHaveText(lotOf(first()));
      // R6-25: nothing is persisted until the first commit, so the hash stays as it came.
      await page.waitForTimeout(1_000);
      expect(await hashOf(page)).toBe(hash);
    });
  }
});

test.describe("14.5 a loaded design opens with its preset's view", () => {
  test("F-HASH6-06 TURQUOISE's link opens dark and dense with the select on Dark dev tool", async ({
    page,
  }) => {
    await openStudio(page, `#s=${TURQUOISE.link}`);
    await expect(lotId(page)).toHaveText(TURQUOISE.lot);
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "dark");
    await expect(canvasFrame(page)).toHaveAttribute("data-density", "dense");
    await expect(presetShown(page)).toHaveText("Dark dev tool");
  });

  test("F-HASH6-06 MADDER's link opens light and comfortable with the select on Custom", async ({
    page,
  }) => {
    await openStudio(page, `#s=${MADDER.link}`);
    await expect(lotId(page)).toHaveText(MADDER.lot);
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "light");
    await expect(canvasFrame(page)).toHaveAttribute("data-density", "comfortable");
    await expect(presetShown(page)).toHaveText("Custom");
  });

  test("F-HASH6-07 a restored dark-dev-tool draft opens dark and dense", async ({ page }) => {
    const spec = designFor(applyPreset(FRESH, "dark-dev-tool"), seedOf(5));
    await STORAGE_DRAFT(page, spec, "dark-dev-tool");
    await openStudio(page);
    await expect(lotId(page)).toHaveText(lotOf(spec));
    await expect(canvasFrame(page)).toHaveAttribute("data-mode", "dark");
    await expect(canvasFrame(page)).toHaveAttribute("data-density", "dense");
    await expect(presetShown(page)).toHaveText("Dark dev tool");
  });
});
