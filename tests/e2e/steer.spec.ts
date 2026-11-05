import { expect, type Page, test } from "@playwright/test";
import { gamutMap, LOCKABLE, type Lockable, type Oklch, toHex } from "@/engine";
import { chipChange, chipsChange } from "@/features/ai/steer";
import { lockSeed } from "@/features/studio/params";
import { type DesignSpec, encodeSpec } from "@/spec";
import {
  ai,
  answerShared,
  chipButton,
  expectCreatedWithIs,
  expectSteerLines,
  heldDesign,
  hexWithin,
  holdShared,
  lockToggle,
  openAt,
  panelChoice,
  refineButton,
  refineField,
  runRefine,
  seedField,
  sharedFailure,
  sharedOk,
} from "./ai-support";
import { button, designFor, FRESH, openStudio, seedOf, settled } from "./studio-support";

// The Steer flows of docs/specs/04-ai.md, section 14.11 (Task 4.10b): the seven chips (13.4, 8.1,
// R4-44) and "Refine in words" (R4-45), whose shared step is answered via `page.route`. F-STEER-03
// runs against the mock in ai-route.spec.ts (Task 4.12a).

test.use({ viewport: { width: 1280, height: 800 } });

/** The design `openAt` opens: FRESH with the seed of the seventh draw, nothing locked. */
const START_SPEC: DesignSpec = designFor(FRESH, seedOf(7));
/** The three slots' held seeds of a spec with nothing locked: section 4's `seedsOf`. */
const seedsOf = (spec: DesignSpec): Record<Lockable, Oklch> =>
  Object.fromEntries(LOCKABLE.map((slot) => [slot, lockSeed(spec, slot)])) as Record<
    Lockable,
    Oklch
  >;
/** The chips' context on the start design. */
const START_CONTEXT = {
  params: FRESH,
  density: "comfortable",
  primary: lockSeed(START_SPEC, "primary"),
} as const;

const NO_WORDS =
  "No steer words found, so nothing changed. Try warmer, cooler, bolder, quieter, softer, sharper or airier.";
const OFF_HERE = "The shared quota is off here, so dyelot used the steer words.";
const AT_LIMIT = "Those words are already at their limit, so nothing changed.";

/** Polls the primary seed field until it shows `seed` (±1 per channel). */
async function expectPrimary(page: Page, seed: Oklch): Promise<void> {
  const expected = toHex(gamutMap(seed, "srgb"));
  await expect
    .poll(async () => hexWithin(await seedField(page, "Primary").inputValue(), expected, 1))
    .toBe(true);
}

test.describe("13.4 Steer", () => {
  test("F-STEER-01 Warmer locks the primary, moves it toward 50 and warms the tint; three quick presses are one entry", async ({
    page,
  }) => {
    await openAt(page);
    const before = await heldDesign(page);
    const once = chipChange("warmer", START_CONTEXT);
    if (!once.enabled || once.patch.primary === undefined) throw new Error("warmer moves no hue");
    await chipButton(page, "Warmer").click();
    await expect(lockToggle(page, "primary")).toHaveAttribute("aria-pressed", "true");
    await expect(panelChoice(page, "Neutral tint", "warm")).toBeChecked();
    await expectPrimary(page, once.patch.primary);
    await expectCreatedWithIs(page, "controls");
    await button(page, "Undo").click();
    await expect.poll(() => heldDesign(page)).toEqual(before);
    await expect(button(page, "Undo")).toHaveAttribute("aria-disabled", "true");

    // Three presses within 1 s: the hue moves three steps, and the history gains one entry.
    const thrice = chipsChange(["warmer", "warmer", "warmer"], START_CONTEXT);
    if (thrice.patch.primary === undefined) throw new Error("warmer moves no hue");
    const started = Date.now();
    for (let press = 0; press < 3; press++) await chipButton(page, "Warmer").click();
    expect(Date.now() - started).toBeLessThan(1_000);
    await expectPrimary(page, thrice.patch.primary);
    await settled(page);
    await button(page, "Undo").click();
    await expect.poll(() => heldDesign(page)).toEqual(before);
    await expect(button(page, "Undo")).toHaveAttribute("aria-disabled", "true");
  });

  test("F-STEER-02 at vivid, Bolder is disabled with its reason, stays focusable and a press changes nothing", async ({
    page,
  }) => {
    await openStudio(page, `#s=${encodeSpec(designFor({ ...FRESH, chroma: "vivid" }, seedOf(7)))}`);
    const bolder = chipButton(page, "Bolder");
    await expect(bolder).toHaveAttribute("aria-disabled", "true");
    await expect(bolder).toHaveAccessibleDescription("Chroma is already vivid.");
    // Its neighbors can still run.
    await expect(chipButton(page, "Quieter")).not.toHaveAttribute("aria-disabled", "true");
    const before = await heldDesign(page);
    await chipButton(page, "Quieter").focus();
    await page.keyboard.press("Shift+Tab");
    await expect(bolder).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await bolder.click({ force: true });
    await page.waitForTimeout(300);
    expect(await heldDesign(page)).toEqual(before);
    await expect(panelChoice(page, "Chroma", "vivid")).toBeChecked();
    await expect(button(page, "Undo")).toHaveAttribute("aria-disabled", "true");
  });

  test("F-STEER-04 without a model, the steer words in the text apply, and a text with none changes nothing", async ({
    page,
  }) => {
    const posted = await answerShared(page, "refine", sharedFailure("not-configured"));
    await openAt(page);
    const text = "warmer and airier please";
    await runRefine(page, text);
    await expectSteerLines(page, [
      OFF_HERE,
      "Made with the steer words (no model): warmer, airier.",
    ]);
    expect(posted).toEqual([ai.refineInput(text, FRESH, seedsOf(START_SPEC))]);
    const both = chipsChange(["warmer", "airier"], START_CONTEXT);
    if (both.patch.primary === undefined) throw new Error("warmer moves no hue");
    await expectPrimary(page, both.patch.primary);
    await expect(panelChoice(page, "Neutral tint", "warm")).toBeChecked();
    await expectCreatedWithIs(page, "controls");
    const after = await heldDesign(page);
    await runRefine(page, "make it pop");
    await expectSteerLines(page, [OFF_HERE, NO_WORDS]);
    expect(await heldDesign(page)).toEqual(after);
    // One commit for the words: one Undo goes back to the start.
    await button(page, "Undo").click();
    await expect(button(page, "Undo")).toHaveAttribute("aria-disabled", "true");
  });

  test("F-STEER-04 words whose chips are all at their limit change nothing, and a model-made design keeps its createdWith", async ({
    page,
  }) => {
    await answerShared(page, "refine", sharedFailure("not-configured"));
    // A design a model made, at the end of the bolder and softer chips' ranges.
    const made = designFor(
      { ...FRESH, chroma: "vivid", radius: "round", depth: "layered" },
      seedOf(7),
    );
    const spec = {
      ...made,
      meta: { ...made.meta, createdWith: "model:test/text-1:free" as const },
    };
    await openStudio(page, `#s=${encodeSpec(spec)}`);
    await expectCreatedWithIs(page, "model:test/text-1:free");
    const before = await heldDesign(page);
    await expect(button(page, "Undo")).toHaveAttribute("aria-disabled", "true");
    await runRefine(page, "bolder and softer please");
    await expectSteerLines(page, [OFF_HERE, AT_LIMIT]);
    await page.waitForTimeout(300);
    expect(await heldDesign(page)).toEqual(before);
    await expectCreatedWithIs(page, "model:test/text-1:free");
    await expect(button(page, "Undo")).toHaveAttribute("aria-disabled", "true");
  });

  test("Refine on the shared route applies the model's ops as one commit and shows its summary", async ({
    page,
  }) => {
    const posted = await answerShared(page, "refine", sharedOk("refine"));
    await openAt(page);
    const before = await heldDesign(page);
    const text = "warmer and rounder";
    await runRefine(page, text);
    await expectSteerLines(page, [
      "Made with dyelot's shared AI (test/text-1:free). Rounder corners and warmer neutrals.",
    ]);
    expect(posted).toEqual([ai.refineInput(text, FRESH, seedsOf(START_SPEC))]);
    await expect(panelChoice(page, "Radius", "round")).toBeChecked();
    await expect(panelChoice(page, "Neutral tint", "warm")).toBeChecked();
    await expectCreatedWithIs(page, "model:test/text-1:free");
    await button(page, "Undo").click();
    await expect.poll(() => heldDesign(page)).toEqual(before);
  });

  test("a refine whose slot turned gray while the model read changes nothing and says why", async ({
    page,
  }) => {
    const release = await holdShared(
      page,
      "refine",
      sharedOk("refine", {
        ops: [{ op: "shiftHue", slot: "primary", degrees: 30 }],
        summary: "A warmer primary.",
      }),
    );
    await openAt(page);
    await refineField(page).fill("shift the primary a little");
    await refineButton(page).click();
    await expect(page.getByRole("button", { name: "Refining…", exact: true })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    // The visitor sets a gray primary while the model reads the request.
    await seedField(page, "Primary").fill("#808080");
    await seedField(page, "Primary").press("Enter");
    await expect(lockToggle(page, "primary")).toHaveAttribute("aria-pressed", "true");
    const gray = await heldDesign(page);
    await release();
    await expectSteerLines(page, [
      "The design changed while the request was read, so nothing changed.",
    ]);
    expect(await heldDesign(page)).toEqual(gray);
  });
});
