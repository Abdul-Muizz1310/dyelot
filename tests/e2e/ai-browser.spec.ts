import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type Response, test } from "@playwright/test";
import { gamutMap, toHex } from "@/engine";
import { decodeSpec } from "@/spec";
import {
  ai,
  aiSettings,
  answerShared,
  BRIEF_OUT,
  briefField,
  briefLines,
  expectBriefLines,
  fakeLanguageModel,
  holdShared,
  isAiRequest,
  lexiconLine,
  noLanguageModel,
  onDeviceSwitch,
  openAiSettings,
  openAt,
  readBrief,
  recordRequests,
  runBrief,
  sharedFailure,
  sharedOk,
} from "./ai-support";
import { button, inputsPanel, lotId, nearHex, settled } from "./studio-support";

// The browser flows of docs/specs/04-ai.md, section 14.11, for Task 4.10a: the Brief section
// (13.1, R4-39, R4-40), the action hook's cancel and load failure (R4-56, section 13), the
// on-device model (R4-31, 10.2) and the lazy AI layer (I-M4-09). The shared step is answered via
// `page.route`; the mock-backed flows live in ai-route.spec.ts (Task 4.12a).

test.use({ viewport: { width: 1280, height: 800 } });

const SHARED_LINE = "Made with dyelot's shared AI (test/text-1:free).";
const ON_DEVICE_LINE = "Made with Chrome's built-in model.";
const NOTHING = "No known words, so nothing changed.";
const CANCELED = "Canceled. Nothing changed.";
const LOAD_FAILED = "This tool could not load. Reload the page to try again.";
/** A brief whose words the lexicon matches. */
const CALM = "calm tea house at dusk";

const hashOf = (page: Page): Promise<string> => page.evaluate(() => window.location.hash);

/** The spec the hash holds once the debounced write has run. */
async function hashedSpec(page: Page) {
  await expect.poll(() => hashOf(page)).toMatch(/^#s=/);
  return decodeSpec((await hashOf(page)).slice(3));
}

/** Polls the hash until its spec's `meta.createdWith` is `value`. */
async function expectCreatedWith(page: Page, value: string): Promise<void> {
  await expect
    .poll(async () => {
      const hash = await hashOf(page);
      return hash.startsWith("#s=") ? decodeSpec(hash.slice(3)).meta.createdWith : null;
    })
    .toBe(value);
}

/** The shared failure sentence of 10.3 for `code` with the word list next. */
const sharedSentence = (reason: Parameters<typeof ai.failureSentence>[0]["reason"]) =>
  ai.failureSentence({ provider: "shared", reason } as never, "brief", "rules");

/** The lot tag and the written hash, which a change that does nothing leaves as they were. */
async function design(page: Page): Promise<[string | null, string]> {
  await settled(page);
  await expect.poll(() => hashOf(page)).toMatch(/^#s=/);
  return [await lotId(page).textContent(), await hashOf(page)];
}

test.describe("13.1 Brief", () => {
  test("Read the brief on the shared route applies the model's brief as one undoable commit", async ({
    page,
  }) => {
    const posted = await answerShared(page, "brief", sharedOk("brief", BRIEF_OUT));
    await openAt(page);
    const before = await design(page);
    await runBrief(page, "a quiet harbor library at dawn");
    await expectBriefLines(page, [SHARED_LINE]);
    expect(posted).toEqual([ai.briefInput("a quiet harbor library at dawn", {})]);
    await expectCreatedWith(page, "model:test/text-1:free");
    const spec = await hashedSpec(page);
    expect(spec.meta.name).toBe(BRIEF_OUT.name);
    await openAiSettings(page);
    await expect(aiSettings(page)).toContainText("Shared AI: 2 of 3 left today.");
    await button(page, "Undo").click();
    await expect.poll(() => design(page)).toEqual(before);
  });

  test("Cancel ends the busy state at once, keeps focus on Read the brief and changes nothing", async ({
    page,
  }) => {
    const release = await holdShared(page, "brief");
    await openAt(page);
    const before = await design(page);
    await briefField(page).fill("a slow brief at noon");
    await readBrief(page).click();
    const busy = inputsPanel(page).getByRole("button", { name: "Reading the brief…", exact: true });
    await expect(busy).toHaveAttribute("aria-busy", "true");
    const cancel = inputsPanel(page).getByRole("button", { name: "Cancel", exact: true });
    // "Cancel" comes right after its busy button in Tab order (13.7).
    await busy.focus();
    await page.keyboard.press("Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Enter");
    await expectBriefLines(page, [CANCELED]);
    await expect(cancel).toHaveCount(0);
    await expect(readBrief(page)).not.toHaveAttribute("aria-busy", "true");
    await expect(readBrief(page)).toBeFocused();
    await release();
    await page.waitForTimeout(300);
    expect(await design(page)).toEqual(before);
    await expectBriefLines(page, [CANCELED]);
  });

  test("F-BRIEF-04 each refusal of the shared route shows its sentence, then the word list's result", async ({
    page,
  }) => {
    await openAt(page);
    const codes = [
      "not-configured",
      "visitor-cap",
      "pool-low",
      "guard-unavailable",
      "busy",
      "forbidden-origin",
      "bad-request",
      "too-large",
    ] as const;
    for (const code of codes) {
      const posted = await answerShared(page, "brief", sharedFailure(code));
      await runBrief(page, CALM);
      // The new route answered this run, so the lines below are this run's.
      await expect.poll(() => posted.length).toBe(1);
      // Exactly the two lines: no raw text of the reply appears.
      await expectBriefLines(page, [sharedSentence(code), lexiconLine(CALM)]);
      await expect(briefLines(page)).not.toContainText(/[{}"]/);
    }
    const aborted = await answerShared(page, "brief", { abort: true });
    await runBrief(page, CALM);
    await expect.poll(() => aborted.length).toBe(1);
    await expectBriefLines(page, [sharedSentence("unreachable"), lexiconLine(CALM)]);
    await expectCreatedWith(page, "lexicon");
    await expect(briefLines(page)).toHaveAttribute("role", "status");
  });

  test("F-BRIEF-06 a brief of two colors sets two seeds with no request", async ({ page }) => {
    const requests = recordRequests(page);
    await openAt(page);
    const text = "#b8422e, oklch(0.62 0.14 250)";
    await runBrief(page, text);
    await expectBriefLines(page, ["Set 2 seed colors from the brief (no model)."]);
    for (const slot of ["primary", "secondary"]) {
      await expect(button(page, `Lock ${slot}`)).toHaveAttribute("aria-pressed", "true");
    }
    await expect(button(page, "Lock accent")).toHaveAttribute("aria-pressed", "false");
    const primary = await inputsPanel(page)
      .getByRole("textbox", { name: "Primary", exact: true })
      .inputValue();
    expect(nearHex(primary, "#b8422e"), primary).toBe(true);
    const [, secondary] = ai.briefColors(text).seeds;
    if (secondary === undefined) throw new Error("F-BRIEF-06: the brief reads no second color");
    const shown = await inputsPanel(page)
      .getByRole("textbox", { name: "Secondary", exact: true })
      .inputValue();
    const expected = toHex(gamutMap(secondary, "srgb"));
    expect(nearHex(shown, expected), `${shown} vs ${expected}`).toBe(true);
    const spec = await hashedSpec(page);
    expect(spec.meta.createdWith).toBe("controls");
    expect(requests.filter(isAiRequest)).toEqual([]);
  });

  test("F-BRIEF-08 a brief of no known word changes nothing", async ({ page }) => {
    await answerShared(page, "brief", sharedFailure("not-configured"));
    await openAt(page);
    const before = await design(page);
    await runBrief(page, "qwxz vbnm");
    await expectBriefLines(page, [sharedSentence("not-configured"), NOTHING]);
    await page.waitForTimeout(400);
    expect(await design(page)).toEqual(before);
  });

  test("F-BRIEF-11 the brief is cleaned before it is sent, a blank one waits and digits call nothing", async ({
    page,
  }) => {
    const posted = await answerShared(page, "brief", sharedFailure("not-configured"));
    await openAt(page);
    await runBrief(page, "calm  tea house\nat dusk ");
    await expectBriefLines(page, [sharedSentence("not-configured"), lexiconLine(CALM)]);
    expect(posted).toEqual([{ brief: "calm tea house at dusk", locked: {} }]);

    await briefField(page).fill("   ");
    await expect(readBrief(page)).toHaveAttribute("aria-disabled", "true");
    await expect(readBrief(page)).toHaveAccessibleDescription(
      "Write a few words or a color first.",
    );
    // Playwright will not click an aria-disabled button; the keyboard still reaches it.
    await readBrief(page).focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    expect(posted).toHaveLength(1);

    await runBrief(page, "1234");
    await expectBriefLines(page, [NOTHING]);
    expect(posted).toHaveLength(1);
  });

  test("F-BRIEF-13 a tool that cannot load says so and changes nothing; the next click loads it", async ({
    page,
  }) => {
    await answerShared(page, "brief", sharedOk("brief", BRIEF_OUT));
    await openAt(page);
    const before = await design(page);
    const chunks = "**/_next/static/**/*.js";
    await page.route(chunks, (route) => route.abort("failed"));
    await runBrief(page, "a harbor at dusk, calm");
    await expectBriefLines(page, [LOAD_FAILED]);
    expect(await design(page)).toEqual(before);
    await page.unroute(chunks);
    await readBrief(page).click();
    await expectBriefLines(page, [SHARED_LINE]);
  });
});

test.describe("10.2 the on-device model", () => {
  const briefJson = JSON.stringify(BRIEF_OUT);
  const notDownloaded = ai.failureSentence(
    { provider: "on-device", reason: "not-downloaded" },
    "brief",
    "shared",
  );

  test("F-DEV-01 with the switch on, an available model reads the brief on the device", async ({
    page,
  }) => {
    await fakeLanguageModel(page, { state: "available", reply: briefJson });
    const requests = recordRequests(page);
    await openAt(page);
    await openAiSettings(page);
    await expect(aiSettings(page)).toContainText("Ready on this device.");
    await expect(onDeviceSwitch(page)).toHaveAttribute("aria-checked", "false");
    await onDeviceSwitch(page).click();
    await expect(onDeviceSwitch(page)).toHaveAttribute("aria-checked", "true");
    await runBrief(page, "a reading room on the device");
    await expectBriefLines(page, [ON_DEVICE_LINE]);
    await expectCreatedWith(page, "on-device");
    expect(requests.filter(isAiRequest)).toEqual([]);
    // The switch is remembered in this browser (R4-31).
    expect(await page.evaluate(() => localStorage.getItem("dyelot:on-device"))).toBe("on");
  });

  test("F-DEV-02 a model that needs a download falls to the shared quota until it is downloaded", async ({
    page,
  }) => {
    await fakeLanguageModel(page, {
      state: "downloadable",
      reply: briefJson,
      download: [0, 0.5, 1],
    });
    await answerShared(page, "brief", sharedOk("brief", BRIEF_OUT));
    await openAt(page);
    await openAiSettings(page);
    await expect(aiSettings(page)).toContainText("Needs a one-time download from Chrome.");
    await onDeviceSwitch(page).click();
    await runBrief(page, "a print shop before the download");
    await expectBriefLines(page, [notDownloaded, SHARED_LINE]);
    const download = inputsPanel(page).getByRole("button", {
      name: "Download the model",
      exact: true,
    });
    await download.click();
    await expect(aiSettings(page)).toContainText("Downloading the model: 50%.");
    await expect(aiSettings(page)).toContainText("Ready on this device.");
    await expect(download).toHaveCount(0);
    const result = await new AxeBuilder({ page })
      .include("#studio-inputs")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    await runBrief(page, "a print shop after the download");
    await expectBriefLines(page, [ON_DEVICE_LINE]);
  });

  test("F-DEV-03 an unavailable model disables the switch, and a stored switch adds its sentence", async ({
    page,
  }) => {
    await fakeLanguageModel(page, { state: "unavailable" });
    await page.addInitScript(() => localStorage.setItem("dyelot:on-device", "on"));
    await answerShared(page, "brief", sharedOk("brief", BRIEF_OUT));
    await openAt(page);
    await openAiSettings(page);
    await expect(onDeviceSwitch(page)).toHaveAttribute("aria-disabled", "true");
    await expect(onDeviceSwitch(page)).toHaveAccessibleDescription("Not available on this device.");
    await runBrief(page, "a ferry terminal at noon");
    await expectBriefLines(page, [
      ai.failureSentence({ provider: "on-device", reason: "unavailable" }, "brief", "shared"),
      SHARED_LINE,
    ]);
  });

  test("F-DEV-04 without a LanguageModel, AI settings show no on-device switch", async ({
    page,
  }) => {
    await noLanguageModel(page);
    await openAt(page);
    await openAiSettings(page);
    await expect(aiSettings(page)).toContainText("No OpenRouter key connected.");
    await expect(aiSettings(page)).toContainText("Shared AI: 3 actions a day.");
    await expect(onDeviceSwitch(page)).toHaveCount(0);
    await expect(inputsPanel(page).getByRole("switch")).toHaveCount(0);
  });

  test("F-DEV-05 a reply that is not JSON falls to the shared quota", async ({ page }) => {
    await fakeLanguageModel(page, { state: "available", reply: "Here is a calm design." });
    await page.addInitScript(() => localStorage.setItem("dyelot:on-device", "on"));
    await answerShared(page, "brief", sharedOk("brief", BRIEF_OUT));
    await openAt(page);
    await runBrief(page, "a library that answers in prose");
    await expectBriefLines(page, [
      ai.failureSentence({ provider: "on-device", reason: "failed" }, "brief", "shared"),
      SHARED_LINE,
    ]);
  });
});

test.describe("I-M4-09 the lazy AI layer", () => {
  const PROMPT_TEXT = "Never write a color value";

  /** Collects the text of every JavaScript response from now on. */
  function scripts(page: Page): Promise<string>[] {
    const bodies: Promise<string>[] = [];
    page.on("response", (response: Response) => {
      const type = response.headers()["content-type"] ?? "";
      if (type.includes("javascript")) bodies.push(response.text().catch(() => ""));
    });
    return bodies;
  }

  test("F-LAZY4-01 the first load of the studio fetches no prompt; Read the brief fetches one", async ({
    page,
  }) => {
    await answerShared(page, "brief", sharedOk("brief", BRIEF_OUT));
    const bodies = scripts(page);
    await openAt(page);
    await page.waitForLoadState("networkidle");
    const first = await Promise.all(bodies);
    expect(first.length).toBeGreaterThan(0);
    expect(first.filter((body) => body.includes(PROMPT_TEXT))).toEqual([]);
    await runBrief(page, "a lazy afternoon in a reading room");
    await expectBriefLines(page, [SHARED_LINE]);
    const after = await Promise.all(bodies);
    expect(after.some((body) => body.includes(PROMPT_TEXT))).toBe(true);
  });
});
