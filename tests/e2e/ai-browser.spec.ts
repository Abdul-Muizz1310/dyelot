import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type Response, test } from "@playwright/test";
import { gamutMap, type Hex, lintSpec, paramsOfSpec, toHex } from "@/engine";
import { fixFor } from "@/features/studio/fixes";
import { findingTitle } from "@/features/studio/inspect";
import { decodeSpec, encodeSpec, normalizeSpec } from "@/spec";
import { ONE_FAIL } from "../unit/export/one-fail-support";
import {
  ai,
  aiSettings,
  aiSettingsButton,
  answerShared,
  BRIEF_OUT,
  briefField,
  briefLines,
  briefSection,
  expectBriefLines,
  explainFindings,
  explanation,
  fakeLanguageModel,
  findingsLines,
  findingsSection,
  holdShared,
  isAiRequest,
  lexiconLine,
  noLanguageModel,
  OUTPUTS,
  onDeviceSwitch,
  openAiSettings,
  openAt,
  rationaleLines,
  rationaleSection,
  readBrief,
  recordRequests,
  runBrief,
  START,
  sharedFailure,
  sharedOk,
  writeRationale,
} from "./ai-support";
import {
  button,
  first,
  inputsPanel,
  inspectorAside,
  lotId,
  nearHex,
  openStudio,
  settled,
} from "./studio-support";

// The browser flows of docs/specs/04-ai.md, section 14.11, for Task 4.10a: the Brief section
// (13.1, R4-39, R4-40), the action hook's cancel and load failure (R4-56, section 13), the
// on-device model (R4-31, 10.2) and the lazy AI layer (I-M4-09); and, for Task 4.11, the
// inspector's Rationale and the critique (13.5, R4-49, R4-50). The shared step is answered via
// `page.route`; the mock-backed flows live in ai-route.spec.ts (Task 4.12a).

test.use({ viewport: { width: 1280, height: 800 } });

/** What the fake `LanguageModel` of `fakeLanguageModel` leaves on the window. */
type LmHost = { __lm: { prompt: number; replied: boolean }; __lmRelease(): void };

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

/** 10.3's sentences for the brief's shared step, word for word, with the word list next. */
const SHARED_SENTENCES = {
  "not-configured": "The shared quota is off here, so dyelot used the word list.",
  "visitor-cap": "You have used today's 3 shared actions, so dyelot used the word list.",
  "pool-low": "The shared quota is nearly used up for today, so dyelot used the word list.",
  "guard-unavailable": "The shared quota could not be checked, so dyelot used the word list.",
  busy: "The shared quota is busy with another request, so dyelot used the word list.",
  "forbidden-origin": "The shared quota refused this page's address, so dyelot used the word list.",
  "bad-request": "The shared quota could not be reached, so dyelot used the word list.",
  "too-large": "The shared quota could not be reached, so dyelot used the word list.",
  unreachable: "The shared quota could not be reached, so dyelot used the word list.",
} as const;
/** 10.3's on-device sentences for the brief, word for word, with the shared quota next. */
const NOT_DOWNLOADED =
  "Chrome's built-in model is not downloaded yet, so dyelot used its shared quota.";
const UNAVAILABLE =
  "Chrome's built-in model is not available on this device, so dyelot used its shared quota.";
const ON_DEVICE_FAILED =
  "Chrome's built-in model could not read the brief, so dyelot used its shared quota.";
const NOT_AVAILABLE = "Not available on this device.";

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
    // One live region in the section while AI settings are open: the result lines (13).
    await expect(briefSection(page).getByRole("status")).toHaveCount(1);
    await expect(briefSection(page).getByRole("status")).toHaveText(SHARED_LINE);
    await button(page, "Undo").click();
    await expect.poll(() => design(page)).toEqual(before);
  });

  test("Cancel ends the busy state at once, keeps focus on Read the brief and changes nothing", async ({
    page,
  }) => {
    // The on-device model ignores the cancel and answers when the test releases it, so a reply
    // that lands after the cancel would change the design if anything let it through.
    await fakeLanguageModel(page, {
      state: "available",
      reply: JSON.stringify(BRIEF_OUT),
      hold: true,
    });
    await page.addInitScript(() => localStorage.setItem("dyelot:on-device", "on"));
    await openAt(page);
    const before = await design(page);
    await briefField(page).fill("a slow brief at noon");
    await readBrief(page).click();
    const busy = inputsPanel(page).getByRole("button", { name: "Reading the brief…", exact: true });
    await expect(busy).toHaveAttribute("aria-busy", "true");
    await expect.poll(() => page.evaluate(() => (window as unknown as LmHost).__lm.prompt)).toBe(1);
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
    await page.evaluate(() => (window as unknown as LmHost).__lmRelease());
    await expect
      .poll(() => page.evaluate(() => (window as unknown as LmHost).__lm.replied))
      .toBe(true);
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
      await expectBriefLines(page, [SHARED_SENTENCES[code], lexiconLine(CALM)]);
      await expect(briefLines(page)).not.toContainText(/[{}"]/);
    }
    const aborted = await answerShared(page, "brief", { abort: true });
    await runBrief(page, CALM);
    await expect.poll(() => aborted.length).toBe(1);
    await expectBriefLines(page, [SHARED_SENTENCES.unreachable, lexiconLine(CALM)]);
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
    await expectBriefLines(page, [SHARED_SENTENCES["not-configured"], NOTHING]);
    // The lines show only after any commit was issued, and `design` waits for the canvas to settle.
    expect(await design(page)).toEqual(before);
  });

  test("F-BRIEF-11 the brief is cleaned before it is sent, a blank one waits and digits call nothing", async ({
    page,
  }) => {
    const posted = await answerShared(page, "brief", sharedFailure("not-configured"));
    await openAt(page);
    await runBrief(page, "calm  tea house\nat dusk ");
    await expectBriefLines(page, [SHARED_SENTENCES["not-configured"], lexiconLine(CALM)]);
    expect(posted).toEqual([{ brief: "calm tea house at dusk", locked: {} }]);

    await briefField(page).fill("   ");
    await expect(readBrief(page)).toHaveAttribute("aria-disabled", "true");
    await expect(readBrief(page)).toHaveAccessibleDescription(
      "Write a few words or a color first.",
    );
    // Playwright will not click an aria-disabled button; the keyboard still reaches it.
    await readBrief(page).focus();
    await page.keyboard.press("Enter");
    await expectBriefLines(page, [SHARED_SENTENCES["not-configured"], lexiconLine(CALM)]);

    // A full action later, the blank brief has still sent nothing.
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

test.describe("13.5 The inspector", () => {
  /** The spec `START` opens. */
  const START_SPEC = decodeSpec(START.slice(3));
  const RATIONALE_OUT = OUTPUTS.rationale;
  const CRITIQUE_OUT = OUTPUTS.critique;
  /** 13.5's lines: each feature's without a model, and the critique's for a reply whose design left. */
  const NOTHING_WRITTEN = "Nothing written. The export keeps the preset's text (no model).";
  const LIST_STAYS = "The list below stays sorted by severity (no model).";
  const DESIGN_CHANGED =
    "The design changed while the findings were explained. Explain them again for this design.";
  /** 10.3's sentence for the critique's shared step when the shared quota is off. */
  const CRITIQUE_OFF = "The shared quota is off here, so dyelot used the findings list.";
  const ONE_FAIL_LINK = `#s=${encodeSpec(ONE_FAIL)}`;
  const busyButton = (page: Page, name: string) =>
    inspectorAside(page).getByRole("button", { name, exact: true });
  const cancelButton = (page: Page) =>
    inspectorAside(page).getByRole("button", { name: "Cancel", exact: true });

  /**
   * The on-device model, switched on, holding its reply until the test releases it (it ignores the
   * cancel), so a reply can land after "Cancel".
   */
  async function heldOnDevice(page: Page, output: unknown): Promise<void> {
    await fakeLanguageModel(page, {
      state: "available",
      reply: JSON.stringify(output),
      hold: true,
    });
    await page.addInitScript(() => localStorage.setItem("dyelot:on-device", "on"));
  }
  const released = (page: Page) =>
    expect.poll(() => page.evaluate(() => (window as unknown as LmHost).__lm.replied)).toBe(true);

  /** Commits a new design from the inputs panel while an action runs (R4-56 keeps it usable). */
  async function regenerate(page: Page): Promise<void> {
    const lot = await lotId(page).textContent();
    await button(page, "Regenerate").click();
    await expect(lotId(page)).not.toHaveText(lot ?? "");
    await settled(page);
  }

  test("Write the rationale on the shared route stores the model's text in one undoable commit, shown as text", async ({
    page,
  }) => {
    const posted = await answerShared(page, "rationale", sharedOk("rationale"));
    await openAt(page);
    const before = await design(page);
    const section = rationaleSection(page);
    await expect(section).toContainText("No thesis yet.");
    await expect(section).toContainText("No rules yet.");
    await writeRationale(page).click();
    await expect(rationaleLines(page).locator("p")).toHaveText([SHARED_LINE]);
    // A design opened from a link holds no preset (R2-14 item 2).
    expect(posted).toEqual([ai.rationaleInput(START_SPEC, null)]);
    await expectCreatedWith(page, "model:test/text-1:free");
    const spec = await hashedSpec(page);
    expect(spec.meta.oneLiner).toBe(RATIONALE_OUT.oneLiner);
    expect(spec.direction?.thesis).toBe(RATIONALE_OUT.thesis);
    expect(spec.rules).toEqual({ do: RATIONALE_OUT.do, dont: RATIONALE_OUT.dont });
    // The thesis "<b>Calm</b> and exact" is text: its tags show, and no element is made of them (R4-28).
    await expect(section.getByText(RATIONALE_OUT.thesis, { exact: true })).toBeVisible();
    await expect(section.locator("b")).toHaveCount(0);
    await expect(section).not.toContainText("No thesis yet.");
    await expect(
      section.getByRole("list", { name: "Do", exact: true }).getByRole("listitem"),
    ).toHaveText([...RATIONALE_OUT.do]);
    await expect(
      section.getByRole("list", { name: "Don't", exact: true }).getByRole("listitem"),
    ).toHaveText([...RATIONALE_OUT.dont]);
    await expect(rationaleLines(page)).toHaveAttribute("role", "status");
    // One commit: one Undo restores the design before, and the section reads the held spec again.
    await button(page, "Undo").click();
    await expect.poll(() => design(page)).toEqual(before);
    await expect(section).toContainText("No thesis yet.");
    await expect(section).toContainText("No rules yet.");
  });

  test("F-RAT-03 without a model nothing is written and the export keeps the preset's text", async ({
    page,
  }) => {
    const posted = await answerShared(page, "rationale", sharedFailure("not-configured"));
    await openAt(page);
    const before = await design(page);
    await writeRationale(page).click();
    await expect(rationaleLines(page).locator("p")).toHaveText([
      "The shared quota is off here, so dyelot used the preset's text.",
      NOTHING_WRITTEN,
    ]);
    expect(posted).toHaveLength(1);
    expect(await design(page)).toEqual(before);
    await expect(rationaleSection(page)).toContainText("No thesis yet.");
  });

  test("Explain the top findings on the shared route shows the ranking as text beside the fix buttons, and stores nothing", async ({
    page,
  }) => {
    const findings = lintSpec(ONE_FAIL);
    const posted = await answerShared(page, "critique", sharedOk("critique"));
    await openStudio(page, `#s=${encodeSpec(ONE_FAIL)}`);
    const before = await design(page);
    await explainFindings(page).click();
    await expect(findingsLines(page).locator("p")).toHaveText([SHARED_LINE]);
    expect(posted).toEqual([ai.critiqueInput(findings)]);
    // The verdict, then one item per `top` entry: the finding's title and subject, the why and its fix.
    const region = explanation(page);
    await expect(region.locator(":scope > p")).toHaveText([CRITIQUE_OUT.verdict]);
    const items = region.getByRole("listitem");
    await expect(items).toHaveCount(CRITIQUE_OUT.top.length);
    const [entry] = CRITIQUE_OUT.top;
    const target = findings[entry.findingIndex];
    const patch = fixFor(target, paramsOfSpec(ONE_FAIL).params);
    if (patch?.contrastLevel === undefined) throw new Error("the explained finding has no fix");
    const item = items.first();
    for (const text of [findingTitle(target.id), target.subject, entry.why]) {
      await expect(item).toContainText(text);
    }
    const fix = item.getByRole("button", {
      name: `Raise contrast to ${patch.contrastLevel}`,
      exact: true,
    });
    await expect(fix).toBeVisible();
    await expect(region.getByRole("list")).toHaveJSProperty("tagName", "OL");
    // Never stored: the design, its id and the link are the ones before.
    expect(await design(page)).toEqual(before);

    // Without a model the list stays as it is, and no explanation is shown.
    await answerShared(page, "critique", sharedFailure("not-configured"));
    await explainFindings(page).click();
    await expect(findingsLines(page).locator("p")).toHaveText([CRITIQUE_OFF, LIST_STAYS]);
    await expect(explanation(page)).toHaveCount(0);
    expect(await design(page)).toEqual(before);

    // The explanation's fix button raises the level: the held spec id changes, so the explanation
    // hides, and its line with it; the section's one status region names the fix's outcome alone.
    await answerShared(page, "critique", sharedOk("critique"));
    await explainFindings(page).click();
    await expect(explanation(page).getByRole("listitem")).toHaveCount(1);
    await fix.click();
    await settled(page);
    await expect.poll(() => lotId(page).textContent()).not.toBe(before[0]);
    await expect(explanation(page)).toHaveCount(0);
    await expect(findingsLines(page)).toHaveText(
      `Contrast raised to ${patch.contrastLevel}. The finding is cleared.`,
    );
    // The fix's button is gone with the explanation: focus moves to the Findings heading (F-STUDIO-23).
    await expect(
      findingsSection(page).getByRole("heading", { name: "Findings", exact: true }),
    ).toBeFocused();
    // Cleared, not hidden: one Undo holds the explained design again, and neither the explanation nor
    // its line comes back (controller ruling on Task 4.11's review).
    await button(page, "Undo").click();
    await expect.poll(() => design(page)).toEqual(before);
    await expect(findingsLines(page)).toBeEmpty();
    await expect(explanation(page)).toHaveCount(0);
  });

  test("F-RAT-04 a reply that lands after the visitor's edit commits on the design as it is then", async ({
    page,
  }) => {
    const release = await holdShared(page, "rationale");
    await openAt(page);
    await writeRationale(page).click();
    await expect(busyButton(page, "Writing the rationale…")).toHaveAttribute("aria-busy", "true");
    // The visitor renames the design while the rationale is written.
    await inputsPanel(page).getByRole("textbox", { name: "Name", exact: true }).fill("Tide Table");
    await expect.poll(async () => (await hashedSpec(page)).meta.name).toBe("Tide Table");
    const renamed = await design(page);
    await release();
    await expect(rationaleLines(page).locator("p")).toHaveText([SHARED_LINE]);
    await expectCreatedWith(page, "model:test/text-1:free");
    const spec = await hashedSpec(page);
    expect(spec.meta.name).toBe("Tide Table");
    expect(spec.direction?.thesis).toBe(RATIONALE_OUT.thesis);
    expect(spec.rules).toEqual({ do: RATIONALE_OUT.do, dont: RATIONALE_OUT.dont });
    // One commit after the visitor's: one Undo takes back the rationale and keeps the new name.
    await button(page, "Undo").click();
    await expect.poll(() => design(page)).toEqual(renamed);
  });

  test("F-RAT-05 Cancel ends Writing the rationale at once, and a reply after it writes nothing", async ({
    page,
  }) => {
    await heldOnDevice(page, RATIONALE_OUT);
    await openAt(page);
    const before = await design(page);
    await writeRationale(page).click();
    const busy = busyButton(page, "Writing the rationale…");
    await expect(busy).toHaveAttribute("aria-busy", "true");
    await expect.poll(() => page.evaluate(() => (window as unknown as LmHost).__lm.prompt)).toBe(1);
    // "Cancel" comes right after its busy button in Tab order (13.7).
    await busy.focus();
    await page.keyboard.press("Tab");
    await expect(cancelButton(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(rationaleLines(page).locator("p")).toHaveText([CANCELED]);
    await expect(cancelButton(page)).toHaveCount(0);
    await expect(writeRationale(page)).toBeFocused();
    await page.evaluate(() => (window as unknown as LmHost).__lmRelease());
    await released(page);
    expect(await design(page)).toEqual(before);
    await expect(rationaleSection(page)).toContainText("No thesis yet.");
    await expect(rationaleLines(page).locator("p")).toHaveText([CANCELED]);
  });

  test("F-CRIT-03 a reply whose design left is dropped, and the action's own lines outlast a design change", async ({
    page,
  }) => {
    await openStudio(page, ONE_FAIL_LINK);
    // A core that will not load: its line describes the action, so a new design keeps it.
    const chunks = "**/_next/static/**/*.js";
    await page.route(chunks, (route) => route.abort("failed"));
    await explainFindings(page).click();
    await expect(findingsLines(page).locator("p")).toHaveText([LOAD_FAILED]);
    await page.unroute(chunks);
    await regenerate(page);
    await expect(findingsLines(page).locator("p")).toHaveText([LOAD_FAILED]);

    // A model's reply that lands after the design changed explains a design no longer held: it is
    // dropped, and the line says so, through a later change too.
    const release = await holdShared(page, "critique");
    await explainFindings(page).click();
    await expect(busyButton(page, "Ranking the findings…")).toHaveAttribute("aria-busy", "true");
    await regenerate(page);
    await release();
    await expect(findingsLines(page).locator("p")).toHaveText([DESIGN_CHANGED]);
    await expect(explanation(page)).toHaveCount(0);
    await regenerate(page);
    await expect(findingsLines(page).locator("p")).toHaveText([DESIGN_CHANGED]);

    // Without a model: the failure sentence stays through a design change, the rule line goes.
    await answerShared(page, "critique", sharedFailure("not-configured"));
    await explainFindings(page).click();
    await expect(findingsLines(page).locator("p")).toHaveText([CRITIQUE_OFF, LIST_STAYS]);
    await regenerate(page);
    await expect(findingsLines(page).locator("p")).toHaveText([CRITIQUE_OFF]);
  });

  test("F-CRIT-04 Cancel ends Ranking the findings at once, and a reply after it shows nothing", async ({
    page,
  }) => {
    await heldOnDevice(page, CRITIQUE_OUT);
    await openStudio(page, ONE_FAIL_LINK);
    const before = await design(page);
    await explainFindings(page).click();
    const busy = busyButton(page, "Ranking the findings…");
    await expect(busy).toHaveAttribute("aria-busy", "true");
    await expect.poll(() => page.evaluate(() => (window as unknown as LmHost).__lm.prompt)).toBe(1);
    await busy.focus();
    await page.keyboard.press("Tab");
    await expect(cancelButton(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(findingsLines(page).locator("p")).toHaveText([CANCELED]);
    await expect(cancelButton(page)).toHaveCount(0);
    await expect(explainFindings(page)).toBeFocused();
    await page.evaluate(() => (window as unknown as LmHost).__lmRelease());
    await released(page);
    await page.waitForTimeout(300);
    await expect(explanation(page)).toHaveCount(0);
    expect(await design(page)).toEqual(before);
    // The cancel line describes the action, so a new design keeps it.
    await regenerate(page);
    await expect(findingsLines(page).locator("p")).toHaveText([CANCELED]);
  });

  test("F-CRIT-02 with no finding, Explain the top findings is disabled and says why", async ({
    page,
  }) => {
    const plain = first();
    const spec = normalizeSpec({
      ...plain,
      color: {
        ...plain.color,
        roles: {
          light: { ...plain.color.roles.light, border: "#808080" as Hex },
          dark: { ...plain.color.roles.dark, border: "#8a8a8a" as Hex },
        },
      },
    });
    expect(lintSpec(spec)).toEqual([]);
    const requests = recordRequests(page);
    await openStudio(page, `#s=${encodeSpec(spec)}`);
    const explain = explainFindings(page);
    await expect(explain).toHaveAttribute("aria-disabled", "true");
    await expect(explain).toHaveAccessibleDescription("There are no findings to explain.");
    // Playwright will not click an aria-disabled button; the keyboard still reaches it.
    await explain.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await expect(findingsLines(page)).toBeEmpty();
    expect(requests.filter(isAiRequest)).toEqual([]);
  });
});

test.describe("10.2 the on-device model", () => {
  const briefJson = JSON.stringify(BRIEF_OUT);
  const download = (page: Page) =>
    inputsPanel(page).getByRole("button", { name: "Download the model", exact: true });

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
    await expectBriefLines(page, [NOT_DOWNLOADED, SHARED_LINE]);
    await download(page).click();
    await expect(aiSettings(page)).toContainText("Downloading the model: 50%.");
    await expect(aiSettings(page)).toContainText("Ready on this device.");
    await expect(download(page)).toHaveCount(0);
    const result = await new AxeBuilder({ page })
      .include("#studio-inputs")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    await runBrief(page, "a print shop after the download");
    await expectBriefLines(page, [ON_DEVICE_LINE]);
  });

  test("the download's progress survives closing and reopening AI settings", async ({ page }) => {
    await fakeLanguageModel(page, { state: "downloadable", download: [0, 0.5, 1] });
    await openAt(page);
    await openAiSettings(page);
    await download(page).click();
    await expect(aiSettings(page)).toContainText("Downloading the model: 0%.");
    await aiSettingsButton(page).click();
    await expect(aiSettings(page)).toHaveCount(0);
    await openAiSettings(page);
    await expect(aiSettings(page)).toContainText("Downloading the model: 50%.");
    await expect(aiSettings(page)).toContainText("Ready on this device.");
  });

  test("F-DEV-03 an unavailable model disables the switch, and a stored switch adds its sentence", async ({
    page,
  }) => {
    await fakeLanguageModel(page, { state: "unavailable" });
    await answerShared(page, "brief", sharedOk("brief", BRIEF_OUT));
    await openAt(page);
    await openAiSettings(page);
    await expect(onDeviceSwitch(page)).toHaveAttribute("aria-checked", "false");
    await expect(onDeviceSwitch(page)).toHaveAttribute("aria-disabled", "true");
    await expect(onDeviceSwitch(page)).toHaveAccessibleDescription(NOT_AVAILABLE);
    await page.evaluate(() => localStorage.setItem("dyelot:on-device", "on"));
    await page.reload();
    await runBrief(page, "a ferry terminal at noon");
    await expectBriefLines(page, [UNAVAILABLE, SHARED_LINE]);
  });

  test("F-DEV-06 a switch stored on can be turned off while the model is unavailable", async ({
    page,
  }) => {
    await fakeLanguageModel(page, { state: "unavailable" });
    await page.addInitScript(() => {
      // Only the first load starts with the switch stored on.
      if (sessionStorage.getItem("f-dev-06") === null) {
        sessionStorage.setItem("f-dev-06", "seen");
        localStorage.setItem("dyelot:on-device", "on");
      }
    });
    await answerShared(page, "brief", sharedOk("brief", BRIEF_OUT));
    await openAt(page);
    await openAiSettings(page);
    const toggle = onDeviceSwitch(page);
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(toggle).not.toHaveAttribute("aria-disabled", "true");
    await expect(toggle).toHaveAccessibleDescription(NOT_AVAILABLE);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(toggle).toHaveAttribute("aria-disabled", "true");
    await expect(toggle).toHaveAccessibleDescription(NOT_AVAILABLE);
    await expect(toggle).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem("dyelot:on-device"))).toBeNull();
    // Off, it cannot be turned on again while the model is unavailable.
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await runBrief(page, "a ferry terminal after the switch");
    await expectBriefLines(page, [SHARED_LINE]);
    // The choice holds after a reload.
    await page.reload();
    await openAiSettings(page);
    await expect(onDeviceSwitch(page)).toHaveAttribute("aria-checked", "false");
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
    await expectBriefLines(page, [ON_DEVICE_FAILED, SHARED_LINE]);
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
