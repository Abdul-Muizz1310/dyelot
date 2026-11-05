import { expect, type Page, type Worker as PageWorker, test } from "@playwright/test";
import type { VibeInput } from "@/ai";
import { imagePalette, type RawCluster } from "@/engine";
import {
  ai,
  answerShared,
  chooseImage,
  dropImage,
  expectCreatedWithIs,
  expectImageLines,
  extractionLines,
  heldDesign,
  hexWithin,
  holdShared,
  imageInput,
  imageLines,
  isAiRequest,
  lockToggle,
  OUTPUTS,
  openAt,
  panelChoice,
  readVibe,
  recordRequests,
  seedField,
  sharedFailure,
  sharedOk,
  specInHash,
  swatchItems,
} from "./ai-support";
import { button, inputsPanel } from "./studio-support";

// The Image flows of docs/specs/04-ai.md, section 14.11 (Task 4.10b): the file input and its drop
// zone, the worker's extraction and its heuristic roles (13.3, 9.1, R4-46, R4-47), and "Read the
// vibe" (R4-48), whose shared step is answered via `page.route`. F-IMG-03 runs against the mock in
// ai-route.spec.ts (Task 4.12a).

test.use({ viewport: { width: 1280, height: 800 } });

/** The four colors of `four-colors.png`, as section 4's `FOUR_COLORS`. */
const FOUR_COLORS: readonly RawCluster[] = [
  { hex: "#b8422e", share: 0.4 },
  { hex: "#3a6ea5", share: 0.3 },
  { hex: "#f2e6d0", share: 0.2 },
  { hex: "#1a1c1e", share: 0.1 },
];
const GRAY: readonly RawCluster[] = [
  { hex: "#202020", share: 0.4 },
  { hex: "#808080", share: 0.3 },
  { hex: "#c0c0c0", share: 0.2 },
  { hex: "#f0f0f0", share: 0.1 },
];

/** 13.3's strings, word for word. */
const TYPE_MESSAGE = "Choose a PNG, JPEG, WebP, GIF or AVIF image.";
const SIZE_MESSAGE = "That image is larger than 10 MB. Choose a smaller one.";
const READ_MESSAGE = "That image could not be read. Choose another one.";
const PIXELS_MESSAGE = "That image has more than 50 million pixels. Choose a smaller one.";
const PRIVACY =
  "Sends a smaller copy of the image to OpenRouter and the model's provider, through your key or dyelot's shared quota.";
const RULES_VIBE = "The seeds stay the image's colors (no model).";
const NOT_CONFIGURED = "The shared quota is off here, so dyelot used the image's colors.";

/** A swatch item's text: `<hex> · <percent>%`. */
const SWATCH = /^(#[0-9a-f]{6}) · (\d+)%$/;

/** The swatch list as [hex, percent] pairs. */
async function swatchList(page: Page): Promise<[string, number][]> {
  const texts = await swatchItems(page).allTextContents();
  return texts.map((text) => {
    const match = SWATCH.exec(text.trim());
    if (match === null) throw new Error(`swatch text ${JSON.stringify(text)}`);
    return [match[1] as string, Number(match[2])];
  });
}

/** The image workers the page starts from now on: every worker but the generator's. */
function imageWorkers(page: Page): PageWorker[] {
  const started: PageWorker[] = [];
  page.on("worker", (worker) => started.push(worker));
  return started;
}

test.describe("13.3 Image", () => {
  test("F-IMG-01 four-colors.png gives four swatches and locks its colors as one commit, with no request", async ({
    page,
  }) => {
    const requests = recordRequests(page);
    // The worker and its quantizer load under the nonce CSP with no error.
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await openAt(page);
    const before = await heldDesign(page);
    await chooseImage(page, "four-colors.png");
    await expectImageLines(page, extractionLines(imagePalette(FOUR_COLORS)));
    const listed = await swatchList(page);
    expect(listed).toHaveLength(4);
    for (const [[, percent], expected] of listed.map(
      (item, i) => [item, [40, 30, 20, 10][i]] as const,
    )) {
      expect(Math.abs(percent - (expected ?? Number.NaN)), String(percent)).toBeLessThanOrEqual(3);
    }
    await expect(lockToggle(page, "primary")).toHaveAttribute("aria-pressed", "true");
    await expect(lockToggle(page, "secondary")).toHaveAttribute("aria-pressed", "true");
    await expect(lockToggle(page, "accent")).toHaveAttribute("aria-pressed", "false");
    const primary = await seedField(page, "Primary").inputValue();
    const secondary = await seedField(page, "Secondary").inputValue();
    expect(hexWithin(primary, "#b8422e", 2), primary).toBe(true);
    expect(hexWithin(secondary, "#3a6ea5", 2), secondary).toBe(true);
    await expect(panelChoice(page, "Neutral tint", "warm")).toBeChecked();
    await expectCreatedWithIs(page, "controls");
    // One history entry: one Undo restores the design before, and there is nothing more to undo.
    await button(page, "Undo").click();
    await expect.poll(() => heldDesign(page)).toEqual(before);
    await expect(button(page, "Undo")).toHaveAttribute("aria-disabled", "true");
    // Nothing left the device: no request to /api/ or OpenRouter, and none that carries image data.
    expect(requests.filter(isAiRequest).map((request) => request.url())).toEqual([]);
    const carrying = requests.filter((request) => {
      const body = request.postDataBuffer();
      return body !== null && body.length > 0;
    });
    expect(carrying.map((request) => request.url())).toEqual([]);
    // "Read the vibe" is described by where the image would go.
    await expect(readVibe(page)).toHaveAccessibleDescription(PRIVACY);
    expect(errors).toEqual([]);
  });

  test("F-IMG-02 an SVG, a PNG over 10 MB and a corrupt PNG show their messages and change nothing", async ({
    page,
  }) => {
    await openAt(page);
    const workers = imageWorkers(page);
    const before = await heldDesign(page);
    await imageInput(page).setInputFiles({
      name: "logo.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'),
    });
    await expectImageLines(page, [TYPE_MESSAGE]);
    const large = Buffer.alloc(10_485_761);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(large);
    await imageInput(page).setInputFiles({
      name: "large.png",
      mimeType: "image/png",
      buffer: large,
    });
    await expectImageLines(page, [SIZE_MESSAGE]);
    // Neither file reached a worker: no image worker has started.
    expect(workers).toHaveLength(0);
    expect(await heldDesign(page)).toEqual(before);
    await chooseImage(page, "odd/corrupt.png");
    await expectImageLines(page, [READ_MESSAGE]);
    // The corrupt file did reach one.
    expect(workers).toHaveLength(1);
    await expect(swatchItems(page)).toHaveCount(0);
    await expect(readVibe(page)).toHaveAccessibleDescription("Choose an image first.");
    expect(await heldDesign(page)).toEqual(before);
    await expect(button(page, "Undo")).toHaveAttribute("aria-disabled", "true");
  });

  test("F-IMG-04 gray.png, dropped on the zone, locks only the primary and sets the tint none", async ({
    page,
  }) => {
    await openAt(page);
    await dropImage(page, "gray.png", "image/png");
    await expectImageLines(page, extractionLines(imagePalette(GRAY)));
    await expect(lockToggle(page, "primary")).toHaveAttribute("aria-pressed", "true");
    await expect(lockToggle(page, "secondary")).toHaveAttribute("aria-pressed", "false");
    await expect(lockToggle(page, "accent")).toHaveAttribute("aria-pressed", "false");
    await expect(panelChoice(page, "Neutral tint", "none")).toBeChecked();
    const primary = await seedField(page, "Primary").inputValue();
    expect(hexWithin(primary, "#202020", 2), primary).toBe(true);
    expect((await swatchList(page)).map(([hex]) => hex)).toEqual(GRAY.map(({ hex }) => hex));
  });

  test("F-IMG-05 a shared quota that is off keeps the extraction's design", async ({ page }) => {
    const posted = await answerShared(page, "vibe", sharedFailure("not-configured"));
    await openAt(page);
    await chooseImage(page, "four-colors.png");
    await expectImageLines(page, extractionLines(imagePalette(FOUR_COLORS)));
    const extracted = await heldDesign(page);
    await readVibe(page).click();
    await expectImageLines(page, [NOT_CONFIGURED, RULES_VIBE]);
    expect(posted).toHaveLength(1);
    expect(await heldDesign(page)).toEqual(extracted);
  });

  test("Read the vibe on the shared route applies the model's roles, pairing, preset and moods as one commit", async ({
    page,
  }) => {
    const posted = (await answerShared(page, "vibe", sharedOk("vibe"))) as VibeInput[];
    await openAt(page);
    await chooseImage(page, "four-colors.png");
    await expectImageLines(page, extractionLines(imagePalette(FOUR_COLORS)));
    const extracted = await heldDesign(page);
    await expect(readVibe(page)).toHaveAccessibleDescription(PRIVACY);
    await readVibe(page).click();
    await expectImageLines(page, [
      "Made with dyelot's shared AI (test/vision-1:free). Mood: earthy, calm.",
    ]);
    expect(posted).toHaveLength(1);
    const [input] = posted;
    if (input === undefined) throw new Error("no vibe request");
    // The request is the vibe input of the extracted palette, with the JPEG the worker made.
    expect(input).toEqual(
      ai.vibeInput(imagePalette(FOUR_COLORS), {
        dataUrl: input.image.dataUrl,
        width: 100,
        height: 10,
      }),
    );
    const jpeg = Buffer.from(input.image.dataUrl.slice("data:image/jpeg;base64,".length), "base64");
    expect(jpeg.length).toBeLessThanOrEqual(1_048_576);
    expect([...jpeg.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    expect(Math.max(input.image.width, input.image.height)).toBeLessThanOrEqual(768);
    await expectCreatedWithIs(page, "model:test/vision-1:free");
    const spec = await specInHash(page);
    expect(spec.direction?.adjectives).toEqual([...OUTPUTS.vibe.moodTags]);
    // The preset `organic` applies first, then the type vibe's pairing, which is not organic's own
    // (`young-onest`), so the design reads as "Custom" (R2-28) with organic's other values.
    await expect(inputsPanel(page).getByRole("combobox", { name: "Pairing" })).toHaveValue(
      "schibsted-serif",
    );
    await expect(inputsPanel(page).getByRole("combobox", { name: "Preset" })).toHaveValue("custom");
    await expect(inputsPanel(page).getByRole("combobox", { name: "Type context" })).toHaveValue(
      "editorial",
    );
    await expect(panelChoice(page, "Radius", "round")).toBeChecked();
    await expect(panelChoice(page, "Contrast level", "AA+")).toBeChecked();
    await expect(panelChoice(page, "Motion feel", "calm")).toBeChecked();
    await expect(panelChoice(page, "Neutral tint", "warm")).toBeChecked();
    const primary = await seedField(page, "Primary").inputValue();
    const secondary = await seedField(page, "Secondary").inputValue();
    expect(hexWithin(primary, "#b8422e", 2), primary).toBe(true);
    expect(hexWithin(secondary, "#3a6ea5", 2), secondary).toBe(true);
    // One commit: one Undo goes back to the extraction's design.
    await button(page, "Undo").click();
    await expect.poll(() => heldDesign(page)).toEqual(extracted);
  });

  test("a new image while the vibe reads cancels the vibe, whose late reply changes nothing", async ({
    page,
  }) => {
    const release = await holdShared(page, "vibe", sharedOk("vibe"));
    await openAt(page);
    await chooseImage(page, "four-colors.png");
    await expectImageLines(page, extractionLines(imagePalette(FOUR_COLORS)));
    await readVibe(page).click();
    await expect(
      inputsPanel(page).getByRole("button", { name: "Reading the vibe…", exact: true }),
    ).toHaveAttribute("aria-busy", "true");
    await chooseImage(page, "gray.png");
    await expectImageLines(page, extractionLines(imagePalette(GRAY)));
    await expect(readVibe(page)).not.toHaveAttribute("aria-busy", "true");
    const gray = await heldDesign(page);
    await release();
    await page.waitForTimeout(500);
    expect(await heldDesign(page)).toEqual(gray);
    await expectImageLines(page, extractionLines(imagePalette(GRAY)));
    await expectCreatedWithIs(page, "controls");
  });

  test("F-IMG-RF3 every odd file gives a palette or a message within 5 s, never a hang", async ({
    page,
  }) => {
    const posted = (await answerShared(
      page,
      "vibe",
      sharedFailure("not-configured"),
    )) as VibeInput[];
    await openAt(page);
    const workers = imageWorkers(page);
    const within = { timeout: 5_000 };
    const one = (name: string) => [...extractionLines(imagePalette([{ hex: name, share: 1 }]))];

    await chooseImage(page, "odd/one-pixel.png");
    await expectImageLines(page, one("#b8422e"), within);
    await expect(swatchItems(page)).toHaveCount(1);
    expect(await swatchList(page)).toEqual([["#b8422e", 100]]);

    // The image worker now runs: count its decodes from here on.
    expect(workers).toHaveLength(1);
    const [worker] = workers;
    if (worker === undefined) throw new Error("no image worker");
    await worker.evaluate(() => {
      const scope = globalThis as unknown as {
        createImageBitmap: typeof createImageBitmap;
        __decodes: number;
      };
      const real = scope.createImageBitmap.bind(scope);
      scope.__decodes = 0;
      scope.createImageBitmap = ((...args: Parameters<typeof createImageBitmap>) => {
        scope.__decodes += 1;
        return real(...args);
      }) as typeof createImageBitmap;
    });
    const decodes = () =>
      worker.evaluate(() => (globalThis as unknown as { __decodes: number }).__decodes);

    // 64 million pixels in the header: refused before any decode.
    await chooseImage(page, "odd/huge.png");
    await expectImageLines(page, [PIXELS_MESSAGE], within);
    expect(await decodes()).toBe(0);

    await chooseImage(page, "odd/corrupt.png");
    await expectImageLines(page, [READ_MESSAGE], within);
    expect(await decodes()).toBe(1);

    // A fully transparent PNG still gives one cluster.
    await chooseImage(page, "odd/transparent.png");
    await expect(swatchItems(page)).toHaveCount(1, within);
    await expectImageLines(page, one((await swatchList(page))[0]?.[0] ?? ""), within);

    // An animated GIF reads its first frame.
    await chooseImage(page, "odd/two-frames.gif");
    await expect(swatchItems(page)).toHaveCount(1, within);
    const [[gifHex = ""] = []] = await swatchList(page);
    expect(hexWithin(gifHex, "#b8422e", 2), gifHex).toBe(true);

    // The rotated JPEG is read upright: its vibe JPEG is 20 wide and 40 high.
    await chooseImage(page, "odd/rotated.jpg");
    await expect(imageLines(page)).toContainText(
      "Made with the image's colors (no model).",
      within,
    );
    await readVibe(page).click();
    await expectImageLines(page, [NOT_CONFIGURED, RULES_VIBE]);
    const sent = posted.at(-1);
    if (sent === undefined) throw new Error("no vibe request");
    expect([sent.image.width, sent.image.height]).toEqual([20, 40]);
    // Stored 40 x 20 with the gradient from top (#b8422e) to bottom (#3a6ea5), turned a quarter
    // clockwise: upright, the red side is on the right and the blue side on the left.
    const sides = await page.evaluate(async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("no 2D context");
      context.drawImage(image, 0, 0);
      const at = (x: number) => [...context.getImageData(x, 20, 1, 1).data];
      return { size: [image.naturalWidth, image.naturalHeight], left: at(1), right: at(18) };
    }, sent.image.dataUrl);
    expect(sides.size).toEqual([20, 40]);
    const [lr = 0, , lb = 0] = sides.left;
    const [rr = 0, , rb = 0] = sides.right;
    expect(lb, JSON.stringify(sides)).toBeGreaterThan(lr);
    expect(rr, JSON.stringify(sides)).toBeGreaterThan(rb);
    // One worker served every file.
    expect(workers).toHaveLength(1);
  });
});
