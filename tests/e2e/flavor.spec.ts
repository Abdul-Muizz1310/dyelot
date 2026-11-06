import { readFileSync } from "node:fs";
import { type Download, expect, type Locator, type Page } from "@playwright/test";
import { flavorStops, type Mode } from "@/engine";
import { doneLine, FLAVOR_LINES, VIDEO_LINES } from "@/features/flavor/video";
import {
  ABORT_CHUNK,
  allowAbortedChunk,
  test as base,
  loseContext,
  NO_AVC,
  NO_ENCODE,
  NO_WEBCODECS,
  NO_WEBGL,
  recordAborted,
  STATUS_RECORD,
  TELEMETRY,
} from "./flavor-support";
import {
  button,
  canvasFrame,
  canvasRegion,
  first,
  modeSwitch,
  openStudio,
  stubSeeds,
} from "./studio-support";
import { reduceMotion, showTemplate } from "./template-support";

// Playwright does not read the `?raw` query some export files import: the hook makes it the text.
await import("./raw-hooks.mjs");
const { brandProps, mediaName } = await import("@/export");

// The Flavor dialog's flows of docs/specs/05-motion-3d.md, section 14.11 (R5-51, R5-52, 11.1, 13.1
// to 13.3, 13.8): F-FLAVOR-01, 02, 03, 05, 08 and F-STUD5-03 (Task 5.9b); the shader loop's
// recording (R5-56, R5-57, 11.3): F-FLAVOR-06, F-LOOP-01 to 05 and F-LOOP-RF3 (Task 5.10); the brand
// video's render, its privacy note and its usage event (R5-53, R5-54, R5-59, 11.2, 13.3, 13.4):
// F-RENDER-01 to 09, F-RENDER-RF4, F-FLAVOR-04 and 07 (Task 5.9c). Every flow fails, through the
// watch of flavor-support's `test`, on a `securitypolicyviolation` event, a console error, a page
// error or an unhandled rejection in any document it visits, except the failed loads 14.11's
// `ABORT_CHUNK` rule allows. Every flow that can reach the render answers its usage event with
// `TELEMETRY` first, so none reaches remotion.pro (R5-59, C-GUARD5-12), and fails on any other
// request to its host.

/** What `TELEMETRY` gives: the usage event's `POST` bodies, and every other request it aborted. */
type Telemetry = Awaited<ReturnType<typeof TELEMETRY>>;

const test = base.extend<{ telemetry: Telemetry }>({
  // The usage event's answer, installed before the flow's `goto`, for every flow that can reach the
  // render (R5-59, C-GUARD5-12). The watch fails the flow on any other request to remotion.pro,
  // which it aborted (R4-58).
  telemetry: async ({ page }, use) => {
    await use(await TELEMETRY(page));
  },
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

/**
 * R5-64's record budget, from the click to the download: 3 × the slowest of probe 5's runs re-measured
 * at Task 5.10 with the real flavor shader (20,036 ms), rounded up to the next whole second.
 */
const RECORD_BUDGET = 61_000;

/**
 * A cap on the shader loop's flows and their slow steps, never a measure: headless Chromium draws
 * the flavor in software (SwiftShader), so a recording under the desktop's load takes far longer
 * than on a GPU. Only F-LOOP-01 measures, against the record budget.
 */
const RECORDING_CAP = 240_000;

const recordButton = (page: Page): Locator =>
  section(page, "Shader loop").getByRole("button", { name: VIDEO_LINES.record, exact: true });
const loopCancel = (page: Page): Locator =>
  section(page, "Shader loop").getByRole("button", { name: VIDEO_LINES.cancel, exact: true });
const loopStatus = (page: Page): Locator => section(page, "Shader loop").getByRole("status");

/** The download name of the first design's loop. */
const loopName = (container: "mp4" | "webm"): string => mediaName(first(), "loop", container);

/** The render button's label, which 13.3 gives outside `VIDEO_LINES`. */
const RENDER_LABEL = "Render the brand video";
const RENDER_DESCRIPTION = "Makes a 6-second video at 1280 × 720 in this browser.";
/** The privacy note's heading and paragraph (13.4); the heading is also the dialog chunk's marker. */
const NOTE_HEADING = "Before the first render";
const NOTE_TEXT =
  "The video is made in this browser. Remotion, the video library dyelot uses, sends one usage event to remotion.pro for each render, with your IP address and this site's address. It never sends the video or the design. dyelot cannot turn this off.";
/** Probe 4's and probe 5's markers (R5-64): the web renderer's own chunk, and Mediabunny's. */
const RENDERER_MARKER = "register-usage-point";
const MEDIABUNNY_MARKER = "MediabunnyVideoHandler";
/** Probe 4's marker of `remotion`'s core chunk, which the Player loads. */
const REMOTION_MARKER = "No video config found";
/** The renderer's scaffold, which it appends to `<body>` for a render and removes at its end. */
const SCAFFOLD = '[class^="remotion-scaffold-"]';
/** The Brand video section's status region, for `STATUS_RECORD`. */
const BRAND_STATUS = '[role="dialog"] section:nth-of-type(2) > [role="status"]';

/**
 * R5-64's render budget, from the click on "Render" in the note to the download: 3 × the slowest of
 * probe 4's runs re-measured at Task 5.9c with the real `BrandIntro` (11,777 ms), rounded up to the
 * next whole second.
 */
const RENDER_BUDGET = 36_000;

/**
 * A cap on the render's flows and their slow steps, never a measure: headless Chromium draws the
 * composition in software, so a render under the desktop's load takes far longer than on a GPU.
 * Only F-RENDER-01 measures, against the render budget.
 */
const RENDERING_CAP = 240_000;

const brandSection = (page: Page): Locator => section(page, "Brand video");
const renderButton = (page: Page): Locator =>
  brandSection(page).getByRole("button", { name: RENDER_LABEL, exact: true });
const note = (page: Page): Locator =>
  brandSection(page).getByRole("group", { name: NOTE_HEADING, exact: true });
const noteButton = (page: Page, name: "Render" | "Cancel"): Locator =>
  note(page).getByRole("button", { name, exact: true });
const renderCancel = (page: Page): Locator =>
  brandSection(page).getByRole("button", { name: VIDEO_LINES.cancel, exact: true });
const renderStatus = (page: Page): Locator => brandSection(page).getByRole("status");
/** The toolbar's status line, found while it is empty (hidden) or the dialog makes it inert. */
const toolbarStatus = (page: Page): Locator => page.locator("[data-toolbar] [role=status]");

/** The download name of the first design's brand video. */
const brandName = (container: "mp4" | "webm"): string => mediaName(first(), "brand", container);

/**
 * Every hex of the first design, lowercase: each step of each palette and each role, in both modes,
 * and every hex its brand video shows (F-RENDER-01: the usage event holds none of them).
 */
function hexesOfFirst(): string[] {
  const { palettes, roles } = first().color;
  const steps = Object.values(palettes).flatMap((palette) =>
    [...palette.light, ...palette.dark].map((step) => step.hex),
  );
  const brand =
    JSON.stringify([brandProps(first(), "light"), brandProps(first(), "dark")]).match(
      /#[0-9a-f]{6}/gi,
    ) ?? [];
  const all = [...steps, ...Object.values(roles.light), ...Object.values(roles.dark), ...brand];
  return [...new Set(all.map((hex) => hex.toLowerCase()))];
}

/** Keeps every request the page sends to remotion.pro, as "<method> <url>", in order. */
function remotionRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname.endsWith("remotion.pro")) {
      requests.push(`${request.method()} ${request.url()}`);
    }
  });
  return requests;
}

/** Keeps the text of every JavaScript chunk the page fetches; `holding(marker)` names those with it. */
function recordChunks(page: Page): { holding(marker: string): Promise<string[]> } {
  const fetched: Promise<{ url: string; text: string }>[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (!/\/_next\/static\/chunks\/[^?]+\.js(\?|$)/.test(url)) return;
    fetched.push(
      response.text().then(
        (text) => ({ url, text }),
        () => ({ url, text: "" }),
      ),
    );
  });
  return {
    holding: async (marker) =>
      (await Promise.all(fetched))
        .filter(({ text }) => text.includes(marker))
        .map(({ url }) => url),
  };
}

/** Fails unless the Brand video section shows "Rendering…", its labeled bar and "Cancel". */
async function expectRendering(page: Page): Promise<void> {
  const brand = brandSection(page);
  await expect(brand.getByText(VIDEO_LINES.rendering, { exact: true })).toBeVisible();
  await expect(brand.getByRole("progressbar", { name: "Brand video progress" })).toBeVisible();
  await expect(note(page)).toHaveCount(0);
  await expect(renderButton(page)).toHaveCount(0);
  await expect(renderCancel(page)).toBeVisible();
}

/** A click on the render button and its check: the page load's first render opens the note. */
async function openNote(page: Page): Promise<void> {
  await renderButton(page).click();
  await expect(note(page)).toBeVisible({ timeout: RENDERING_CAP });
}

/** Keeps every download the page starts, in order. */
function recordDownloads(page: Page): Download[] {
  const downloads: Download[] = [];
  page.on("download", (download) => downloads.push(download));
  return downloads;
}

/** The bytes of a finished download. */
async function bytesOf(download: Download): Promise<Uint8Array> {
  return new Uint8Array(readFileSync(await download.path()));
}

/** Fails unless the Shader loop section shows "Recording…", its labeled bar and "Cancel". */
async function expectRecording(page: Page): Promise<void> {
  const loop = section(page, "Shader loop");
  // The first frame comes after Mediabunny's load and the flavor's compile.
  await expect(loop.getByText(VIDEO_LINES.recording, { exact: true })).toBeVisible({
    timeout: RECORDING_CAP,
  });
  await expect(loop.getByRole("progressbar", { name: "Shader loop progress" })).toBeVisible();
  await expect(loopCancel(page)).toBeVisible();
}

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

  // Breaks when the OS's reduced motion lets the preview or the Player move, or blocks recording.
  test("F-FLAVOR-06 under the OS's reduced motion the preview is still, and Record the shader loop is enabled", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openFlavor(page);
    await expect(preview(page)).toHaveAttribute("data-flavor", "still");
    await expect(pauseIn(page, "Background")).toHaveCount(0);
    await expect(player(page)).toHaveAttribute("data-autoplay", "false");
    await expect(recordButton(page)).toBeEnabled();
    await expect(recordButton(page)).not.toHaveAttribute("aria-disabled", "true");
    await expect(recordButton(page)).toHaveAccessibleDescription(VIDEO_LINES["record-description"]);
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

test.describe("the Flavor dialog's loads and fallbacks", () => {
  // Breaks when a browser without WebGL loses the brand video's render with the shader, keeps a
  // record button that cannot record, or the studio's canvas stops drawing its templates.
  test("F-FLAVOR-04 without WebGL the preview falls back, the recording is replaced by its sentence, and the render stays", async ({
    page,
  }) => {
    await NO_WEBGL(page);
    await openFlavor(page);
    await expect(preview(page)).toHaveAttribute("data-flavor", "fallback");
    await expect(preview(page)).toHaveAttribute("data-flavor-reason", "no-webgl2");
    await expect(section(page, "Background").getByRole("status")).toHaveText(
      FLAVOR_LINES["no-webgl2"],
    );
    await expect(recordButton(page)).toHaveCount(0);
    await expect(loopStatus(page)).toHaveText(VIDEO_LINES["record-unsupported"]);
    await expect(renderButton(page)).toBeVisible();
    await expect(renderButton(page)).toHaveAccessibleDescription(RENDER_DESCRIPTION);
    await expect(renderStatus(page)).toHaveText("");
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    // The canvas's templates need no WebGL: they render as before.
    await expect(canvasFrame(page).locator("[data-template-root]")).toBeVisible();
    await expect(await showTemplate(page, "dashboard")).toBeVisible();
  });

  // Breaks when a dialog chunk that does not arrive opens nothing without saying so, or the failure
  // is kept so that the next press cannot open the dialog.
  test("F-FLAVOR-07 with the dialog's chunk aborted, Flavor says the tool could not load, and opens after release", async ({
    page,
    watch,
  }) => {
    const aborted = recordAborted(page);
    const chunk = await ABORT_CHUNK(page, NOTE_HEADING);
    await stubSeeds(page);
    await openStudio(page);
    await flavorButton(page).click();
    await expect(toolbarStatus(page)).toHaveText(VIDEO_LINES["load-failed"]);
    await expect(dialog(page)).toHaveCount(0);
    await expect(flavorButton(page)).not.toHaveAttribute("aria-busy", "true");
    await allowAbortedChunk(page, watch, aborted, NOTE_HEADING);
    chunk.release();
    await flavorButton(page).click();
    await expect(dialog(page)).toBeVisible();
    await expect(toolbarStatus(page)).toHaveText("");
    await expect(renderButton(page)).toBeVisible();
  });

  // Breaks when the Brand video section stays silent while `@/export`, which its Player and its
  // render need, does not load (Task 5.9b's line; no case id names it, preflight #35).
  test("the Brand video section says the tool could not load when @/export does not arrive", async ({
    page,
    watch,
  }) => {
    const marker = "dyelot.check/1";
    const aborted = recordAborted(page);
    await ABORT_CHUNK(page, marker);
    await openFlavor(page);
    await expect(renderStatus(page)).toHaveText(VIDEO_LINES["load-failed"]);
    await expect(player(page)).toHaveCount(0);
    await allowAbortedChunk(page, watch, aborted, marker);
  });
});

test.describe("the usage event's answer", () => {
  // Breaks when TELEMETRY lets a request to remotion.pro other than the usage event reach the
  // network, or stops recording it (R4-58, I-M5-09; Task 5.9c's review). No case id names it: it
  // checks the fixture every render flow rests on.
  test("TELEMETRY aborts and records any other request to remotion.pro", async ({
    page,
    watch,
  }) => {
    const telemetry = await TELEMETRY(page);
    expect(telemetry.strays()).toEqual([]);
    await stubSeeds(page);
    await openStudio(page);
    const stray = "https://www.remotion.pro/api/track/other";
    const reached = await page.evaluate(async (url) => {
      try {
        await fetch(url, { method: "POST", body: "{}" });
        return true;
      } catch {
        return false;
      }
    }, stray);
    expect(reached).toBe(false);
    expect(telemetry.strays()).toEqual([`POST ${stray}`]);
    expect(telemetry.posts()).toEqual([]);
    // The stray this flow sent on purpose, which the watch would fail it on otherwise, and the
    // browser's line for it: Playwright's abort reads as the inspector's block.
    watch.allowStray(`POST ${stray}`);
    watch.allow(/^Failed to load resource: net::ERR_BLOCKED_BY_CLIENT\.Inspector$/, 1, stray);
  });
});

test.describe("the video jobs", () => {
  // One video job at a time across both groups: a software render beside a software recording
  // would slow both past their budgets, as the dialog itself never runs them side by side.
  test.describe.configure({ mode: "default" });

  test.describe("the shader loop", () => {
    test.describe.configure({ timeout: RECORDING_CAP });

    // Breaks when the recording stops showing its progress, misses the record budget, names or
    // encodes its file wrongly, says nothing when done, or sends a request off the page's origin.
    test("F-LOOP-01 Record the shader loop shows its progress, and an MP4 downloads within the record budget", async ({
      page,
    }) => {
      const requests: string[] = [];
      page.on("request", (request) => requests.push(request.url()));
      await openFlavor(page);
      await expect(recordButton(page)).toHaveAccessibleDescription(
        VIDEO_LINES["record-description"],
      );
      const downloaded = page.waitForEvent("download", { timeout: RECORD_BUDGET });
      await recordButton(page).click();
      await expectRecording(page);
      const download = await downloaded;
      const name = loopName("mp4");
      expect(download.suggestedFilename()).toBe(name);
      const bytes = await bytesOf(download);
      expect(String.fromCharCode(...bytes.subarray(4, 8))).toBe("ftyp");
      await expect(loopStatus(page)).toHaveText(doneLine(name));
      await expect(recordButton(page)).toBeVisible();
      const origin = new URL(page.url()).origin;
      const foreign = requests.filter(
        (url) =>
          !url.startsWith("data:") && !url.startsWith("blob:") && new URL(url).origin !== origin,
      );
      expect(foreign).toEqual([]);
    });

    // Breaks when Cancel stops discarding the recording, or focus is lost as the controls change.
    test("F-LOOP-02 Cancel while recording says nothing was downloaded, and nothing downloads", async ({
      page,
    }) => {
      await openFlavor(page);
      const downloads = recordDownloads(page);
      await recordButton(page).click();
      await expectRecording(page);
      // The record button's place holds "Cancel" now, and focus moved to it.
      await expect(recordButton(page)).toHaveCount(0);
      await expect(loopCancel(page)).toBeFocused();
      await loopCancel(page).click();
      await expect(loopStatus(page)).toHaveText(VIDEO_LINES.canceled, { timeout: RECORDING_CAP });
      await expect(loopCancel(page)).toHaveCount(0);
      await expect(recordButton(page)).toBeFocused();
      expect(downloads).toEqual([]);
    });

    // Breaks when the recording stops falling back to WebM where AVC cannot encode.
    test("F-LOOP-03 where no avc1 codec encodes, the recording downloads a WebM", async ({
      page,
    }) => {
      await NO_AVC(page);
      await openFlavor(page);
      const downloaded = page.waitForEvent("download");
      await recordButton(page).click();
      await expectRecording(page);
      const download = await downloaded;
      const name = loopName("webm");
      expect(download.suggestedFilename()).toBe(name);
      const bytes = await bytesOf(download);
      expect([...bytes.subarray(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
      await expect(loopStatus(page)).toHaveText(doneLine(name));
    });

    // Breaks when reduced motion blocks recording, or recording sets the still preview moving.
    test("F-LOOP-04 under the OS's reduced motion the recording downloads while the preview stays still", async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await openFlavor(page);
      await expect(preview(page)).toHaveAttribute("data-flavor", "still");
      const downloaded = page.waitForEvent("download");
      await recordButton(page).click();
      await expectRecording(page);
      await expect(preview(page)).toHaveAttribute("data-flavor", "still");
      const download = await downloaded;
      expect(download.suggestedFilename()).toBe(loopName("mp4"));
      await expect(loopStatus(page)).toHaveText(doneLine(loopName("mp4")));
      await expect(preview(page)).toHaveAttribute("data-flavor", "still");
    });

    // Breaks when a browser that encodes no codec keeps the button, downloads anything, or loses the
    // focus the button held.
    test("F-LOOP-05 where no codec encodes, a click ends with the sentence in the button's place", async ({
      page,
    }) => {
      await NO_ENCODE(page);
      await openFlavor(page);
      const downloads = recordDownloads(page);
      await recordButton(page).click();
      await expect(loopStatus(page)).toHaveText(VIDEO_LINES["record-unsupported"], {
        timeout: RECORDING_CAP,
      });
      await expect(recordButton(page)).toHaveCount(0);
      await expect(loopCancel(page)).toHaveCount(0);
      // The section's heading holds the focus the gone button had.
      await expect(
        section(page, "Shader loop").getByRole("heading", { name: "Shader loop", exact: true }),
      ).toBeFocused();
      expect(downloads).toEqual([]);
    });

    // Breaks when WebGL lost on the page reaches the recording's own canvas (RF3).
    test("F-LOOP-RF3 the preview's context lost during a recording falls back, and the recording still downloads", async ({
      page,
    }) => {
      await openFlavor(page);
      await expect(preview(page)).toHaveAttribute("data-flavor", "running");
      const downloaded = page.waitForEvent("download");
      await recordButton(page).click();
      await expectRecording(page);
      await loseContext(page, "[data-flavor-preview] canvas");
      await expect(preview(page)).toHaveAttribute("data-flavor", "fallback");
      await expect(preview(page)).toHaveAttribute("data-flavor-reason", "context-lost");
      await expect(section(page, "Background").getByRole("status")).toHaveText(
        FLAVOR_LINES["context-lost"],
      );
      // The recording was still running after the preview lost its context: its "Cancel" still
      // shows, and no file has come yet.
      const name = loopName("mp4");
      await expect(loopCancel(page)).toBeVisible();
      await expect(loopStatus(page)).not.toHaveText(doneLine(name));
      const download = await downloaded;
      expect(download.suggestedFilename()).toBe(name);
      const bytes = await bytesOf(download);
      expect(String.fromCharCode(...bytes.subarray(4, 8))).toBe("ftyp");
      await expect(loopStatus(page)).toHaveText(doneLine(name));
    });
  });

  test.describe("the brand video's render", () => {
    test.describe.configure({ timeout: RENDERING_CAP });

    // Breaks when the first render skips the note or its focus, sends anything before "Render", misses
    // the render budget, names or encodes its file wrongly, says nothing when done, or its usage event
    // goes unanswered, more than once, or carries the design.
    test("F-RENDER-01 the first render shows the note, then renders an MP4 within the render budget with one usage event", async ({
      page,
      telemetry,
    }) => {
      const status = await STATUS_RECORD(page, BRAND_STATUS);
      const requests = remotionRequests(page);
      await openFlavor(page);
      await expect(renderButton(page)).toHaveAccessibleDescription(RENDER_DESCRIPTION);
      await expect(renderStatus(page)).toHaveText("");
      await openNote(page);
      await expect(
        note(page).getByRole("heading", { level: 4, name: NOTE_HEADING, exact: true }),
      ).toBeFocused();
      await expect(note(page).getByText(NOTE_TEXT, { exact: true })).toBeVisible();
      await expect(renderButton(page)).toHaveCount(0);
      expect(await status.texts()).toContain(VIDEO_LINES.checking);
      await expect(renderStatus(page)).toHaveText("");
      expect(requests).toEqual([]);
      expect(telemetry.posts()).toEqual([]);

      const downloaded = page.waitForEvent("download", { timeout: RENDER_BUDGET });
      await noteButton(page, "Render").click();
      await expectRendering(page);
      await expect(renderCancel(page)).toBeFocused();
      const download = await downloaded;
      const name = brandName("mp4");
      expect(download.suggestedFilename()).toBe(name);
      const bytes = await bytesOf(download);
      expect(String.fromCharCode(...bytes.subarray(4, 8))).toBe("ftyp");
      await expect(renderStatus(page)).toHaveText(doneLine(name));
      await expect(renderButton(page)).toBeVisible();

      await expect.poll(() => telemetry.posts().length).toBe(1);
      const [post] = telemetry.posts();
      expect(post).toMatchObject({
        event: "web-render",
        apiKey: null,
        host: new URL(page.url()).origin,
        succeeded: true,
      });
      const sent = JSON.stringify(post).toLowerCase();
      const hexes = hexesOfFirst();
      // Every step of eight palettes in two modes, each written as the body would hold it.
      expect(hexes.length).toBeGreaterThan(8 * 11);
      expect(hexes.filter((hex) => !/^#[0-9a-f]{6}$/.test(hex))).toEqual([]);
      expect(sent).not.toContain(first().meta.name.toLowerCase());
      expect(hexes.filter((hex) => sent.includes(hex))).toEqual([]);
      expect(requests.filter((request) => request.startsWith("POST "))).toHaveLength(1);
    });

    // Breaks when the answer to the note leaves with the dialog, or outlives the page load.
    test("F-RENDER-02 a second render on the same page load starts with no note, and a reload shows it again", async ({
      page,
      telemetry,
    }) => {
      await openFlavor(page);
      await openNote(page);
      const downloaded = page.waitForEvent("download", { timeout: RENDERING_CAP });
      await noteButton(page, "Render").click();
      await downloaded;
      await expect(renderStatus(page)).toHaveText(doneLine(brandName("mp4")));
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toHaveCount(0);

      await flavorButton(page).click();
      await expect(dialog(page)).toBeVisible();
      await renderButton(page).click();
      await expectRendering(page);
      await expect(renderCancel(page)).toBeFocused();
      await renderCancel(page).click();
      await expect(renderStatus(page)).toHaveText(VIDEO_LINES.canceled, { timeout: RENDERING_CAP });

      await page.reload();
      await expect(flavorButton(page)).toBeVisible();
      await flavorButton(page).click();
      await expect(dialog(page)).toBeVisible();
      await openNote(page);
      await noteButton(page, "Cancel").click();
      await expect(note(page)).toHaveCount(0);
      // Only the first render finished: a canceled render sends no usage event.
      await expect.poll(() => telemetry.posts().length).toBe(1);
    });

    // Breaks when the note's Cancel sends anything, downloads anything or loses the focus.
    test("F-RENDER-03 Cancel in the note brings the render button back with focus, and sends nothing", async ({
      page,
      telemetry,
    }) => {
      const requests = remotionRequests(page);
      await openFlavor(page);
      const downloads = recordDownloads(page);
      await openNote(page);
      await noteButton(page, "Cancel").click();
      await expect(note(page)).toHaveCount(0);
      await expect(renderButton(page)).toBeFocused();
      await expect(renderStatus(page)).toHaveText("");
      await expect(page.locator(SCAFFOLD)).toHaveCount(0);
      expect(requests).toEqual([]);
      expect(telemetry.posts()).toEqual([]);
      expect(downloads).toEqual([]);
    });

    // Breaks when Cancel stops discarding the render, or a canceled render still downloads.
    test("F-RENDER-04 Cancel while rendering says nothing was downloaded, and nothing downloads", async ({
      page,
      telemetry,
    }) => {
      await openFlavor(page);
      const downloads = recordDownloads(page);
      await openNote(page);
      await noteButton(page, "Render").click();
      await expectRendering(page);
      await renderCancel(page).click();
      await expect(renderStatus(page)).toHaveText(VIDEO_LINES.canceled, { timeout: RENDERING_CAP });
      await expect(renderCancel(page)).toHaveCount(0);
      await expect(renderButton(page)).toBeFocused();
      // The render has ended: the renderer removed its scaffold.
      await expect(page.locator(SCAFFOLD)).toHaveCount(0);
      expect(downloads).toEqual([]);
      expect(telemetry.posts()).toEqual([]);
    });

    // Breaks when a browser without WebCodecs keeps either video button, or loads either library.
    test("F-RENDER-05 without WebCodecs both video buttons are replaced by their sentences, and no video library loads", async ({
      page,
      telemetry,
    }) => {
      const chunks = recordChunks(page);
      await NO_WEBCODECS(page);
      await openFlavor(page);
      await expect(renderStatus(page)).toHaveText(VIDEO_LINES["no-webcodecs"]);
      await expect(renderButton(page)).toHaveCount(0);
      await expect(loopStatus(page)).toHaveText(VIDEO_LINES["record-unsupported"]);
      await expect(recordButton(page)).toHaveCount(0);
      await expect(player(page)).toBeVisible();
      await page.waitForLoadState("networkidle");
      // The record is not empty: the Player's Remotion code arrived.
      expect(await chunks.holding(REMOTION_MARKER)).not.toEqual([]);
      expect(await chunks.holding(RENDERER_MARKER)).toEqual([]);
      expect(await chunks.holding(MEDIABUNNY_MARKER)).toEqual([]);
      expect(telemetry.posts()).toEqual([]);
    });

    // Breaks when a browser that encodes neither codec keeps the button, shows the note, or skips its
    // check's line.
    test("F-RENDER-06 where nothing encodes, a click checks, then says the browser cannot render", async ({
      page,
      telemetry,
    }) => {
      const requests = remotionRequests(page);
      const status = await STATUS_RECORD(page, BRAND_STATUS);
      await NO_ENCODE(page);
      await openFlavor(page);
      await renderButton(page).click();
      await expect(renderStatus(page)).toHaveText(VIDEO_LINES["render-unsupported"], {
        timeout: RENDERING_CAP,
      });
      await expect(renderButton(page)).toHaveCount(0);
      await expect(note(page)).toHaveCount(0);
      const texts = await status.texts();
      expect(texts).toContain(VIDEO_LINES.checking);
      expect(texts.indexOf(VIDEO_LINES.checking)).toBeLessThan(
        texts.indexOf(VIDEO_LINES["render-unsupported"]),
      );
      // The section's heading holds the focus the gone button had.
      await expect(
        brandSection(page).getByRole("heading", { level: 3, name: "Brand video", exact: true }),
      ).toBeFocused();
      expect(requests).toEqual([]);
      expect(telemetry.posts()).toEqual([]);
    });

    // Breaks when a renderer chunk that does not arrive shows a raw error or no line, or the failure
    // is kept so that the next click cannot reach the note.
    test("F-RENDER-07 with the renderer's chunk aborted, a click says the tool could not load, and reaches the note after release", async ({
      page,
      watch,
      telemetry,
    }) => {
      const aborted = recordAborted(page);
      const chunk = await ABORT_CHUNK(page, RENDERER_MARKER);
      await openFlavor(page);
      await renderButton(page).click();
      await expect(renderStatus(page)).toHaveText(VIDEO_LINES["load-failed"], {
        timeout: RENDERING_CAP,
      });
      await expect(renderButton(page)).toBeVisible();
      await expect(note(page)).toHaveCount(0);
      await allowAbortedChunk(page, watch, aborted, RENDERER_MARKER);
      chunk.release();
      await openNote(page);
      await noteButton(page, "Cancel").click();
      await expect(renderButton(page)).toBeFocused();
      expect(telemetry.posts()).toEqual([]);
    });

    // Breaks when a render lets the recording start beside it, or closing the dialog leaves the
    // render running, downloads its file or keeps its state.
    test("F-RENDER-08 while a render runs the record button waits, and closing the dialog aborts the render", async ({
      page,
      telemetry,
    }) => {
      await openFlavor(page);
      const downloads = recordDownloads(page);
      await openNote(page);
      await noteButton(page, "Render").click();
      await expectRendering(page);
      await expect(page.locator(SCAFFOLD)).toHaveCount(1);
      await expect(recordButton(page)).toHaveAttribute("aria-disabled", "true");
      await expect(recordButton(page)).toHaveAccessibleDescription(VIDEO_LINES.wait);
      // A press on the waiting button starts nothing. Playwright waits for an `aria-disabled` control
      // to be enabled before it clicks, so the press is forced.
      await recordButton(page).click({ force: true });
      await expect(loopStatus(page)).toHaveText("");
      await expect(loopCancel(page)).toHaveCount(0);
      await expectRendering(page);

      // The render still runs as the dialog closes.
      await expect(page.locator(SCAFFOLD)).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toHaveCount(0);
      // The render has ended: the renderer removed its scaffold, and nothing came of it.
      await expect(page.locator(SCAFFOLD)).toHaveCount(0, { timeout: RENDERING_CAP });
      expect(downloads).toEqual([]);
      expect(telemetry.posts()).toEqual([]);

      await flavorButton(page).click();
      await expect(dialog(page)).toBeVisible();
      await expect(renderButton(page)).toBeVisible();
      await expect(renderButton(page)).not.toHaveAttribute("aria-disabled", "true");
      await expect(renderButton(page)).toHaveAccessibleDescription(RENDER_DESCRIPTION);
      await expect(renderStatus(page)).toHaveText("");
      await expect(recordButton(page)).not.toHaveAttribute("aria-disabled", "true");
      await expect(recordButton(page)).toHaveAccessibleDescription(
        VIDEO_LINES["record-description"],
      );
      expect(downloads).toEqual([]);
    });

    // Breaks when a recording lets the render start beside it (preflight ruling 6: the job rule holds
    // in both directions).
    test("F-RENDER-08 while a recording runs the render button waits, and starts nothing", async ({
      page,
      telemetry,
    }) => {
      await openFlavor(page);
      await recordButton(page).click();
      await expectRecording(page);
      await expect(renderButton(page)).toHaveAttribute("aria-disabled", "true");
      await expect(renderButton(page)).toHaveAccessibleDescription(VIDEO_LINES.wait);
      // Forced, as F-RENDER-08's other flow forces its press on the waiting button.
      await renderButton(page).click({ force: true });
      await expect(note(page)).toHaveCount(0);
      await expect(renderStatus(page)).toHaveText("");
      await expect(renderButton(page)).toHaveAttribute("aria-disabled", "true");
      await loopCancel(page).click();
      await expect(loopStatus(page)).toHaveText(VIDEO_LINES.canceled, { timeout: RECORDING_CAP });
      await expect(renderButton(page)).not.toHaveAttribute("aria-disabled", "true");
      await expect(renderButton(page)).toHaveAccessibleDescription(RENDER_DESCRIPTION);
      expect(telemetry.posts()).toEqual([]);
    });

    // Breaks when the live region speaks anything but 10% steps during a render, or repeats one.
    test("F-RENDER-09 the live region takes only Rendering lines at 10% steps during a render, none twice", async ({
      page,
      telemetry,
    }) => {
      const status = await STATUS_RECORD(page, BRAND_STATUS);
      await openFlavor(page);
      await openNote(page);
      const before = (await status.texts()).length;
      const downloaded = page.waitForEvent("download", { timeout: RENDERING_CAP });
      await noteButton(page, "Render").click();
      await downloaded;
      const name = brandName("mp4");
      await expect(renderStatus(page)).toHaveText(doneLine(name));
      const during = (await status.texts()).slice(before);
      expect(during.at(-1)).toBe(doneLine(name));
      const lines = during.slice(0, -1);
      expect(lines.length).toBeGreaterThan(0);
      const steps = lines.map((line) =>
        Number(/^Rendering: (\d+)%\.$/.exec(line)?.[1] ?? Number.NaN),
      );
      expect(steps.filter((step) => !(step % 10 === 0 && step >= 10 && step <= 100))).toEqual([]);
      expect(new Set(steps).size).toBe(steps.length);
      await expect.poll(() => telemetry.posts().length).toBe(1);
    });

    // Breaks when a double click on "Render" starts two renders, two usage events or two downloads.
    test("F-RENDER-RF4 a double click on Render in the note starts one render, one usage event and one download", async ({
      page,
      telemetry,
    }) => {
      await openFlavor(page);
      const downloads = recordDownloads(page);
      await openNote(page);
      const downloaded = page.waitForEvent("download", { timeout: RENDERING_CAP });
      await noteButton(page, "Render").dblclick();
      await downloaded;
      await expect(renderStatus(page)).toHaveText(doneLine(brandName("mp4")));
      await expect(renderButton(page)).toBeVisible();
      await expect(page.locator(SCAFFOLD)).toHaveCount(0);
      await expect.poll(() => telemetry.posts().length).toBe(1);
      expect(downloads).toHaveLength(1);
    });
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
