import { expect, type Locator, type Page } from "@playwright/test";
import { VIDEO_LINES } from "@/features/flavor/video";
import { PLAYER_CAP, TELEMETRY, test } from "./flavor-support";
import { expectLoaded, loaded, REMOTION, recordScripts } from "./lazy-support";
import { button, openStudio, stubSeeds } from "./studio-support";

// The laziness flows of docs/specs/05-motion-3d.md, section 14.11 (R5-61, I-M5-04): F-LAZY5-01 to 04
// (Task 5.11a). Each reads the text of every JavaScript response a page fetches and tells the heavy
// libraries apart by the marker strings of R5-64 (probes 1, 4 and 5), and the engine by its version
// string, both in tests/e2e/lazy-support.ts. Every flow fails, through the watch of flavor-support's
// `test`, on a `securitypolicyviolation` event, a console error, a page error or an unhandled
// rejection in any document it visits (14.11).

test.use({ viewport: { width: 1280, height: 800 } });

/**
 * Probe 1's eight strings, which no JavaScript of `/explore` may hold, in any case: the remote
 * assets drei's other parts fetch.
 */
const REMOTE_ASSETS = [
  "troika",
  "detect-gpu",
  "draco",
  "mediapipe",
  "cdn.jsdelivr.net",
  "raw.githack.com",
  "unpkg.com",
  "storage.googleapis.com",
] as const;

const flavorButton = (page: Page): Locator => button(page, "Flavor");
const dialog = (page: Page): Locator => page.getByRole("dialog", { name: "Flavor", exact: true });
const section = (page: Page, name: string): Locator =>
  dialog(page).getByRole("region", { name, exact: true });
const player = (page: Page): Locator => section(page, "Brand video").locator("[data-brand-player]");

/** Opens the studio on its first design and the Flavor dialog over it, the Player playing. */
async function openFlavor(page: Page): Promise<void> {
  await stubSeeds(page);
  await openStudio(page);
  await flavorButton(page).click();
  await expect(dialog(page)).toBeVisible();
  await expect(player(page)).toHaveAttribute("data-playing", "true", { timeout: PLAYER_CAP });
}

/**
 * A cap on a video job's slow steps, never a measure: the renderer or Mediabunny loads, then the
 * browser draws in software (SwiftShader), which the desktop's load slows (as 5.9c's and 5.10's
 * flows cap them).
 */
const VIDEO_CAP = 240_000;

test.describe("I-M5-04 heavy code stays lazy", () => {
  // Breaks when the home page's first load pulls in the 3D stack, Remotion or the engine.
  test("F-LAZY5-01 the first load of / fetches no three, R3F, Remotion or engine code while the hero runs", async ({
    page,
  }) => {
    const scripts = recordScripts(page);
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("[data-hero] canvas")).toHaveAttribute("data-flavor", "running");
    await page.waitForLoadState("networkidle");
    expect((await scripts.read()).length).toBeGreaterThan(0);
    expect(await loaded(scripts, ["three", "r3f", ...REMOTION, "engine"])).toEqual([]);
  });

  // Breaks when the studio's first load pulls in the 3D stack, Remotion, the renderer or Mediabunny.
  test("F-LAZY5-02 the first load of /studio fetches no three, R3F, Remotion, web renderer or Mediabunny code", async ({
    page,
  }) => {
    const scripts = recordScripts(page);
    await openStudio(page);
    await page.waitForLoadState("networkidle");
    // The studio's own code arrived: its client holds the engine.
    expect(await loaded(scripts, ["engine"])).toEqual(["engine"]);
    expect(await loaded(scripts, ["three", "r3f", ...REMOTION, "mediabunny"])).toEqual([]);
  });

  // Breaks when the explorer pulls in Remotion or Mediabunny, or its 3D code a remote asset.
  test("F-LAZY5-03 /explore in 3D has loaded three and R3F, no Remotion or Mediabunny, and no remote asset", async ({
    page,
  }) => {
    const scripts = recordScripts(page);
    const response = await page.goto("/explore");
    expect(response?.status()).toBe(200);
    const panel = page.locator("[data-explorer]");
    await expect(panel).toHaveAttribute("data-explorer-state", "3d");
    await expect(panel.locator("canvas")).toHaveCount(1);
    await page.waitForLoadState("networkidle");
    await expectLoaded(scripts, ["three", "r3f"]);
    expect(await loaded(scripts, [...REMOTION, "mediabunny"])).toEqual([]);
    const remote = (await scripts.read()).flatMap(({ url, text }) => {
      const lower = text.toLowerCase();
      return REMOTE_ASSETS.filter((name) => lower.includes(name)).map((name) => `${url}: ${name}`);
    });
    expect(remote).toEqual([]);
  });

  // Breaks when the dialog brings the renderer or Mediabunny with the Player, or loses the Player.
  test("F-LAZY5-04 opening the Flavor dialog loads the Player, and neither the web renderer nor Mediabunny", async ({
    page,
  }) => {
    const scripts = recordScripts(page);
    await stubSeeds(page);
    await openStudio(page);
    await page.waitForLoadState("networkidle");
    expect(await loaded(scripts, ["player"])).toEqual([]);
    await flavorButton(page).click();
    await expect(dialog(page)).toBeVisible();
    await expect(player(page)).toHaveAttribute("data-playing", "true", { timeout: PLAYER_CAP });
    await page.waitForLoadState("networkidle");
    await expectLoaded(scripts, ["player", "remotion"]);
    expect(await loaded(scripts, ["renderer", "mediabunny"])).toEqual([]);
  });

  // Breaks when "Render the brand video" stops loading the renderer on its click. The click loads
  // it before the note of the page load's first render (11.2): the note's Cancel then sends nothing.
  test("F-LAZY5-04 the render click loads the web renderer, and Mediabunny's code with it", async ({
    page,
  }) => {
    const telemetry = await TELEMETRY(page);
    const scripts = recordScripts(page);
    await openFlavor(page);
    await page.waitForLoadState("networkidle");
    expect(await loaded(scripts, ["renderer", "mediabunny"])).toEqual([]);
    const brand = section(page, "Brand video");
    const render = brand.getByRole("button", { name: "Render the brand video", exact: true });
    await expect(render).toBeVisible();
    // From here the renderer's load and its checks set the flow's length, never its result.
    test.setTimeout(VIDEO_CAP + 60_000);
    await render.click();
    const note = brand.getByRole("group", { name: "Before the first render", exact: true });
    await expect(note).toBeVisible({ timeout: VIDEO_CAP });
    // The renderer's marker is in what the click loaded: the positive control for every check of
    // this file that finds it absent.
    await expectLoaded(scripts, ["renderer", "mediabunny"]);
    await note.getByRole("button", { name: VIDEO_LINES.cancel, exact: true }).click();
    await expect(note).toHaveCount(0);
    await expect(render).toBeVisible();
    // Nothing reached remotion.pro: no usage event, and no other request to its host.
    expect(telemetry.posts()).toEqual([]);
    expect(telemetry.strays()).toEqual([]);
  });

  // Breaks when "Record the shader loop" stops loading Mediabunny on its click, or brings the
  // renderer with it on a page load where no render ran.
  test("F-LAZY5-04 on a fresh load with no render, the record click loads Mediabunny and not the renderer", async ({
    page,
  }) => {
    const scripts = recordScripts(page);
    await openFlavor(page);
    await page.waitForLoadState("networkidle");
    expect(await loaded(scripts, ["renderer", "mediabunny"])).toEqual([]);
    const loop = section(page, "Shader loop");
    const record = loop.getByRole("button", { name: VIDEO_LINES.record, exact: true });
    await expect(record).toBeVisible();
    // From here the recording's own pace sets the flow's length, never its result.
    test.setTimeout(VIDEO_CAP + 60_000);
    await record.click();
    // "Recording…" shows from the first frame, after Mediabunny's load (11.3).
    await expect(loop.getByText(VIDEO_LINES.recording, { exact: true })).toBeVisible({
      timeout: VIDEO_CAP,
    });
    await expectLoaded(scripts, ["mediabunny"]);
    expect(await loaded(scripts, ["renderer"])).toEqual([]);
    await loop.getByRole("button", { name: VIDEO_LINES.cancel, exact: true }).click();
    await expect(loop.getByRole("status")).toHaveText(VIDEO_LINES.canceled, {
      timeout: VIDEO_CAP,
    });
    // The recording's end loads no renderer either: the whole record path stays without it.
    await page.waitForLoadState("networkidle");
    expect(await loaded(scripts, ["renderer"])).toEqual([]);
  });
});
