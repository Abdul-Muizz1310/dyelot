import { readFileSync } from "node:fs";
import { type APIRequestContext, expect, type Page, type Request, test } from "@playwright/test";
import type { VibeInput } from "@/ai";
import { gamutMap, imagePalette, lintSpec, PRESETS, paramsOfSpec, toHex } from "@/engine";
import { mdText } from "@/export/text";
import { fixFor } from "@/features/studio/fixes";
import { findingTitle } from "@/features/studio/inspect";
import { type DesignSpec, normalizeSpec, toPlainText } from "@/spec";
import {
  ai,
  aiSettings,
  BRIEF_OUT,
  briefField,
  chatRequests,
  chooseImage,
  expectBriefLines,
  expectCreatedWithIs,
  expectImageLines,
  expectSteerLines,
  explainFindings,
  explanation,
  extractionLines,
  findingsLines,
  findingsSection,
  heldDesign,
  hexWithin,
  imageFixture,
  lexiconLine,
  lockToggle,
  MOCK_KEY_PATH,
  MOCK_ORIGIN,
  type MockScenario,
  mockLog,
  OUTPUTS,
  openAiSettings,
  openAt,
  panelChoice,
  rationaleLines,
  rationaleSection,
  readBrief,
  readVibe,
  recordRequests,
  release,
  runBrief,
  runRefine,
  seedField,
  setScenario,
  specInHash,
  TEST_KEY,
  TEXT_SLUGS,
  VISION_SLUGS,
  waitForHeld,
  waitForIdle,
  writeRationale,
} from "./ai-support";
import {
  bundleOf,
  LINK,
  ONE_FAIL,
  ONE_FAIL_LINK,
  openReady,
  previewOf,
  rawText,
  SPEC,
} from "./export-support";
import { button, inputsPanel, openStudio, settled } from "./studio-support";

// The flows of docs/specs/04-ai.md, section 14.11, that reach the local mock of OpenRouter (Task
// 4.12a, R4-58): the browser posts to the real `/api/ai/<feature>`, and the production server, run
// with section 4's TEST_ENV, calls tests/e2e/mock-openrouter.mjs on 127.0.0.1:3199. The tests run
// serially in one worker with no retries: the server's cache outlives a test, so a retry would meet
// its own cached result, and a failure skips the rest. The first test proves the app under test runs
// against the mock, so no later flow can reach openrouter.ai (the default base URL). Each flow sets
// its scenario first, then waits until no chat request is open, and reads a brief or a design no
// other flow uses.
// The cap cookie is `Secure`, and Chromium keeps it on http://localhost (R4-62, probe 4), so no flow
// replays it. Playwright's Chromium has a `LanguageModel`: the on-device switch stays off (its
// default), so every action takes the shared route.

test.describe.configure({ mode: "serial", retries: 0 });
test.use({ viewport: { width: 1280, height: 800 } });

/** 13.1's line for a model on the shared quota, as `madeWith` writes it. */
const sharedLine = (slug: string): string => `Made with dyelot's shared AI (${slug}).`;
const [TEXT_1, TEXT_2, TEXT_3] = TEXT_SLUGS;
const [VISION_1] = VISION_SLUGS;
const CANCELED = "Canceled. Nothing changed.";
/** R4-09's chat body: exactly these keys, in this order. */
const CHAT_KEYS = [
  "model",
  "messages",
  "response_format",
  "plugins",
  "max_tokens",
  "temperature",
  "usage",
] as const;

/** Sets the mock's scenario, then waits until no chat request an earlier flow sent is open. */
async function startScenario(request: APIRequestContext, name: MockScenario): Promise<void> {
  await setScenario(request, name);
  await waitForIdle(request);
}

/** The page's posts to `/api/ai/<feature>` among the recorded requests. */
const postsTo = (requests: readonly Request[], feature: string): Request[] =>
  requests.filter(
    (entry) => entry.method() === "POST" && new URL(entry.url()).pathname === `/api/ai/${feature}`,
  );

/** The undo button carries `aria-disabled="true"` when the history holds nothing to undo. */
const expectNothingToUndo = (page: Page) =>
  expect(button(page, "Undo")).toHaveAttribute("aria-disabled", "true");

/** C-LEX-RF2's brief: 82 code units, ", quiet ", then 82 repeats of "calm " (500 in all). */
const RF2_HEAD =
  "Kyoto tea house at dusk 😀, #b8422e, oklch(0.7 0.1 200), hsl(30 60% 50%), 東京, café";
const RF2_BRIEF = `${RF2_HEAD}, quiet ${"calm ".repeat(82)}`;

/** `SPEC` (M1's) under another name, so its rationale input is this flow's alone. */
const named = (name: string): DesignSpec =>
  normalizeSpec({ ...SPEC, meta: { ...SPEC.meta, name } });

test.describe("R4-58 the run's wiring", () => {
  test("R4-58 the app under test answers with the test slugs and reaches the mock, before any flow runs", async ({
    request,
    baseURL,
  }) => {
    // The slug variables are this config's, so the server runs with its environment ...
    const models = await request.get("/api/ai/models");
    expect(models.status()).toBe(200);
    expect(await models.json()).toEqual({ text: [...TEXT_SLUGS], vision: [...VISION_SLUGS] });
    // ... and its first chat call reaches the mock, so its base URL is the mock's.
    await startScenario(request, "ok");
    const input = ai.briefInput("the run reaches the mock at dawn", {});
    const reply = await request.post("/api/ai/brief", {
      data: input,
      headers: { Origin: baseURL ?? "" },
    });
    expect(reply.status()).toBe(200);
    expect(await reply.json()).toMatchObject({
      ok: true,
      path: { provider: "shared", slug: TEXT_1 },
    });
    const log = await mockLog(request);
    expect(log.filter((entry) => entry.path === MOCK_KEY_PATH)).toHaveLength(1);
    expect(chatRequests(log).map((entry) => [entry.model, entry.feature, entry.status])).toEqual([
      [TEXT_1, "brief", 200],
    ]);
  });

  test("R4-58 the mock refuses a chat body that breaks R4-09 or R4-10, naming the field", async ({
    request,
    baseURL,
  }) => {
    await startScenario(request, "ok");
    const built = (feature: "brief" | "vibe") => {
      const input =
        feature === "brief"
          ? ai.briefInput("a body the mock checks", {})
          : ai.vibeInput(imagePalette([{ hex: "#b8422e", share: 1 }]), {
              dataUrl: `data:image/jpeg;base64,${readFileSync(imageFixture("tiny.jpg")).toString("base64")}`,
              width: 2,
              height: 2,
            });
      const chat = ai.buildChatRequest({
        feature,
        input: input as never,
        slug: feature === "brief" ? TEXT_1 : VISION_1,
        baseUrl: `${MOCK_ORIGIN}/api/v1`,
        apiKey: TEST_KEY,
        referer: baseURL ?? "",
      });
      return { headers: chat.headers, body: JSON.parse(chat.body) as Record<string, unknown> };
    };
    const send = (chat: ReturnType<typeof built>) =>
      request.post(`${MOCK_ORIGIN}/api/v1/chat/completions`, {
        headers: chat.headers,
        data: chat.body,
      });
    // What the route builds passes.
    for (const feature of ["brief", "vibe"] as const) {
      expect((await send(built(feature))).status(), feature).toBe(200);
    }
    const brief = built("brief");
    const vibe = built("vibe");
    const messages = vibe.body.messages as { role: string; content: unknown }[];
    const textOnly = messages.map((message) =>
      Array.isArray(message.content)
        ? { ...message, content: message.content.filter((part) => part.type === "text") }
        : message,
    );
    const { max_tokens: _maxTokens, ...noMaxTokens } = brief.body;
    const broken: ReadonlyArray<readonly [field: string, chat: ReturnType<typeof built>]> = [
      ["response_format", { ...brief, body: { ...brief.body, response_format: { type: "text" } } }],
      ["plugins", { ...brief, body: { ...brief.body, plugins: [] } }],
      ["max_tokens", { ...brief, body: noMaxTokens }],
      ["models", { ...brief, body: { ...brief.body, models: [TEXT_1, TEXT_2] } }],
      ["provider", { ...brief, body: { ...brief.body, provider: { require_parameters: true } } }],
      ["image_url", { ...vibe, body: { ...vibe.body, messages: textOnly } }],
    ];
    for (const [field, chat] of broken) {
      const response = await send(chat);
      expect(response.status(), field).toBe(400);
      const { error } = (await response.json()) as { error: { message: string } };
      expect(error.message, field).toContain(field);
    }
    const chats = chatRequests(await mockLog(request));
    expect(chats.map((entry) => entry.status)).toEqual([200, 200, 400, 400, 400, 400, 400, 400]);
  });

  test("R4-23 a POST with no Origin or a foreign one is refused 403 forbidden-origin and reaches no model", async ({
    request,
  }) => {
    await startScenario(request, "ok");
    const data = ai.briefInput("a brief from another site", {});
    const origins: Record<string, string>[] = [{}, { Origin: "https://example.com" }];
    for (const headers of origins) {
      const reply = await request.post("/api/ai/brief", { data, headers });
      expect(reply.status(), JSON.stringify(headers)).toBe(403);
      expect(await reply.json()).toEqual({ ok: false, code: "forbidden-origin" });
    }
    expect(await mockLog(request)).toEqual([]);
  });
});

test.describe("14.11 the brief on the shared route", () => {
  test("F-BRIEF-01 the mock's first tier reads the brief: one /key read, one chat call, one undoable commit", async ({
    page,
    request,
  }) => {
    await startScenario(request, "ok");
    await openAt(page);
    const before = await heldDesign(page);
    await runBrief(page, "Kyoto tea house at dusk, calm and exact");
    await expectBriefLines(page, [sharedLine(TEXT_1)]);
    await expectCreatedWithIs(page, `model:${TEXT_1}`);
    await openAiSettings(page);
    await expect(aiSettings(page)).toContainText("Shared AI: 2 of 3 left today.");
    const log = await mockLog(request);
    expect(log.filter((entry) => entry.path === MOCK_KEY_PATH)).toHaveLength(1);
    const chats = chatRequests(log);
    expect(chats).toHaveLength(1);
    expect(chats[0]?.model).toBe(TEXT_1);
    expect(chats[0]?.system?.startsWith(ai.PROMPTS.brief.body)).toBe(true);
    // The body R4-09 and R4-10 write, as the mock read it.
    expect(chats[0]).toMatchObject({
      keys: CHAT_KEYS,
      response_format: { type: "json_object" },
      plugins: [{ id: "response-healing" }],
      max_tokens: ai.PROMPTS.brief.maxTokens,
      image: false,
    });
    await button(page, "Undo").click();
    await expect.poll(() => heldDesign(page)).toEqual(before);
  });

  test("F-BRIEF-02 a tier 1 that answers 500 hands the brief to tier 2, which the line names", async ({
    page,
    request,
  }) => {
    await startScenario(request, "tier1-500");
    await openAt(page);
    await runBrief(page, "harbor ferry at noon, crisp");
    await expectBriefLines(page, [sharedLine(TEXT_2)]);
    await expectCreatedWithIs(page, `model:${TEXT_2}`);
    const chats = chatRequests(await mockLog(request));
    expect(chats.map((entry) => [entry.model, entry.status])).toEqual([
      [TEXT_1, 500],
      [TEXT_2, 200],
    ]);
  });

  test("F-BRIEF-03 when every tier fails, the word list reads the brief and says why", async ({
    page,
    request,
  }) => {
    await startScenario(request, "all-fail");
    const text = "calm tea house for night owls at dusk";
    await openAt(page);
    await runBrief(page, text);
    await expectBriefLines(page, [
      "The shared quota's models could not read the brief, so dyelot used the word list.",
      lexiconLine(text),
    ]);
    await expectCreatedWithIs(page, "lexicon");
    const chats = chatRequests(await mockLog(request));
    expect(chats.map((entry) => [entry.model, entry.status])).toEqual([
      [TEXT_1, 503],
      [TEXT_2, 503],
      [TEXT_3, 503],
    ]);
  });

  test("F-BRIEF-05 the fourth shared action of the day goes to the word list, and AI settings read 0 of 3", async ({
    page,
    request,
  }) => {
    await startScenario(request, "ok");
    await openAt(page);
    await openAiSettings(page);
    for (const [index, text] of ["cap one, calm", "cap two, calm", "cap three, calm"].entries()) {
      await runBrief(page, text);
      await expect(aiSettings(page)).toContainText(`Shared AI: ${2 - index} of 3 left today.`);
      expect(chatRequests(await mockLog(request))).toHaveLength(index + 1);
    }
    const fourth = "cap four, calm";
    await runBrief(page, fourth);
    await expectBriefLines(page, [
      "You have used today's 3 shared actions, so dyelot used the word list.",
      lexiconLine(fourth),
    ]);
    await expect(aiSettings(page)).toContainText("Shared AI: 0 of 3 left today.");
    // The cap answers before the guard: the fourth action reaches neither /key nor a model.
    const log = await mockLog(request);
    expect(chatRequests(log)).toHaveLength(3);
    expect(log.filter((entry) => entry.path === MOCK_KEY_PATH)).toHaveLength(3);
  });

  test("F-BRIEF-07 a color in the brief sets the primary seed, whatever hue the model names", async ({
    page,
    request,
  }) => {
    await startScenario(request, "ok");
    await openAt(page);
    await runBrief(page, "calm tea house, #3a6ea5");
    await expectBriefLines(page, [sharedLine(TEXT_1)]);
    await expectCreatedWithIs(page, `model:${TEXT_1}`);
    // The model was asked, and its output names another primary hue.
    expect(chatRequests(await mockLog(request))).toHaveLength(1);
    expect(BRIEF_OUT.hues?.primary).toBe(150);
    await expect(lockToggle(page, "primary")).toHaveAttribute("aria-pressed", "true");
    const primary = await seedField(page, "Primary").inputValue();
    expect(hexWithin(primary, "#3a6ea5", 1), primary).toBe(true);
  });

  test("F-BRIEF-09 Cancel while the mock holds the reply changes nothing, then or once the hold is released", async ({
    page,
    request,
  }) => {
    await startScenario(request, "hold");
    const requests = recordRequests(page);
    await openAt(page);
    const before = await heldDesign(page);
    await expectNothingToUndo(page);
    await runBrief(page, "a slow brief at dusk");
    const busy = inputsPanel(page).getByRole("button", { name: "Reading the brief…", exact: true });
    await expect(busy).toHaveAttribute("aria-busy", "true");
    // The server's tier 1 is at the mock, held.
    await waitForHeld(request);
    await inputsPanel(page).getByRole("button", { name: "Cancel", exact: true }).click();
    await expectBriefLines(page, [CANCELED]);
    await expect(readBrief(page)).not.toHaveAttribute("aria-busy", "true");
    expect(await heldDesign(page)).toEqual(before);
    await expectNothingToUndo(page);
    // The cancel aborted the post, and the server dropped its held tier (R4-16), so no reply can
    // come back; the next scenario then has nothing to answer.
    const [posted] = postsTo(requests, "brief");
    if (posted === undefined) throw new Error("F-BRIEF-09: the brief was not posted");
    expect(await posted.response()).toBeNull();
    await expect
      .poll(async () => chatRequests(await mockLog(request)).map((entry) => entry.state))
      .toEqual(["closed"]);
    await setScenario(request, "ok");
    expect(await heldDesign(page)).toEqual(before);
    await expectNothingToUndo(page);
    await expectBriefLines(page, [CANCELED]);
  });

  test("F-BRIEF-10 the same brief again is answered from the server's cache: one chat call, no count", async ({
    page,
    request,
  }) => {
    await startScenario(request, "ok");
    const requests = recordRequests(page);
    await openAt(page);
    const before = await heldDesign(page);
    await openAiSettings(page);
    const text = "repeat me at dusk";
    await runBrief(page, text);
    await expectBriefLines(page, [sharedLine(TEXT_1)]);
    await expectCreatedWithIs(page, `model:${TEXT_1}`);
    await expect(aiSettings(page)).toContainText("Shared AI: 2 of 3 left today.");
    // Undo brings back the design the brief was read on, so the second input equals the first.
    await button(page, "Undo").click();
    await expect.poll(() => heldDesign(page)).toEqual(before);
    await runBrief(page, text);
    await expectCreatedWithIs(page, `model:${TEXT_1}`);
    await expectBriefLines(page, [sharedLine(TEXT_1)]);
    const posts = postsTo(requests, "brief");
    expect(posts).toHaveLength(2);
    expect(posts[1]?.postDataJSON()).toEqual(posts[0]?.postDataJSON());
    expect(chatRequests(await mockLog(request))).toHaveLength(1);
    await expect(aiSettings(page)).toContainText("Shared AI: 2 of 3 left today.");
  });

  test("F-BRIEF-RF2 a mixed brief of 500 characters posts its trimmed text, sets its three seeds and follows the mock", async ({
    page,
    request,
  }) => {
    expect(RF2_BRIEF).toHaveLength(500);
    await startScenario(request, "ok");
    const requests = recordRequests(page);
    await openAt(page);
    await briefField(page).fill(RF2_BRIEF);
    await expect(briefField(page)).toHaveAccessibleDescription("500 of 500 characters");
    await readBrief(page).click();
    await expectBriefLines(page, [sharedLine(TEXT_1)]);
    await expectCreatedWithIs(page, `model:${TEXT_1}`);
    const cleaned = toPlainText(RF2_BRIEF, 500)?.text;
    expect(cleaned).toBe(RF2_BRIEF.trimEnd());
    const posts = postsTo(requests, "brief");
    expect(posts).toHaveLength(1);
    expect((posts[0]?.postDataJSON() as { brief?: string } | undefined)?.brief).toBe(cleaned);
    expect(chatRequests(await mockLog(request))).toHaveLength(1);
    // The three colors of the brief lock the three slots, in the text's order.
    const { seeds } = ai.briefColors(cleaned ?? "");
    expect(seeds).toHaveLength(3);
    const slots = [
      ["Primary", "primary"],
      ["Secondary", "secondary"],
      ["Accent", "accent"],
    ] as const;
    for (const [index, [field, slot]] of slots.entries()) {
      const seed = seeds[index];
      if (seed === undefined) throw new Error(`F-BRIEF-RF2: no seed ${index}`);
      const expected = toHex(gamutMap(seed, "srgb"));
      await expect(lockToggle(page, slot)).toHaveAttribute("aria-pressed", "true");
      const shown = await seedField(page, field).inputValue();
      expect(hexWithin(shown, expected, 1), `${slot} ${shown} vs ${expected}`).toBe(true);
    }
  });
});

test.describe("14.11 the image, steer and inspector actions on the shared route", () => {
  /** The four colors of `four-colors.png` (section 4's `FOUR_COLORS`). */
  const FOUR_COLORS = [
    { hex: "#b8422e", share: 0.4 },
    { hex: "#3a6ea5", share: 0.3 },
    { hex: "#f2e6d0", share: 0.2 },
    { hex: "#1a1c1e", share: 0.1 },
  ] as const;
  const PRIVACY =
    "Sends a smaller copy of the image to OpenRouter and the model's provider, through your key or dyelot's shared quota.";
  const VIBE_OUT = OUTPUTS.vibe;
  const RATIONALE_OUT = OUTPUTS.rationale;
  const CRITIQUE_OUT = OUTPUTS.critique;

  test("F-IMG-03 Read the vibe sends a small JPEG and applies the model's preset, pairing, roles and moods as one commit", async ({
    page,
    request,
  }) => {
    await startScenario(request, "ok");
    const requests = recordRequests(page);
    await openAt(page);
    await chooseImage(page, "four-colors.png");
    await expectImageLines(page, extractionLines(imagePalette(FOUR_COLORS)));
    const extracted = await heldDesign(page);
    await expect(readVibe(page)).toHaveAccessibleDescription(PRIVACY);
    await readVibe(page).click();
    await expectImageLines(page, [
      `Made with dyelot's shared AI (${VISION_1}). Mood: ${VIBE_OUT.moodTags.join(", ")}.`,
    ]);
    await expectCreatedWithIs(page, `model:${VISION_1}`);
    // The request holds a JPEG data URL of at most 1 MiB, its longest side at most 768.
    const posts = postsTo(requests, "vibe");
    expect(posts).toHaveLength(1);
    const input = posts[0]?.postDataJSON() as VibeInput;
    const prefix = "data:image/jpeg;base64,";
    expect(input.image.dataUrl.startsWith(prefix)).toBe(true);
    const jpeg = Buffer.from(input.image.dataUrl.slice(prefix.length), "base64");
    expect(jpeg.length).toBeLessThanOrEqual(1_048_576);
    expect([...jpeg.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    expect(Math.max(input.image.width, input.image.height)).toBeLessThanOrEqual(768);
    const chats = chatRequests(await mockLog(request));
    expect(chats.map((entry) => [entry.model, entry.feature])).toEqual([[VISION_1, "vibe"]]);
    // The image goes as an `image_url` part, in R4-09's body.
    expect(chats[0]).toMatchObject({
      keys: CHAT_KEYS,
      response_format: { type: "json_object" },
      plugins: [{ id: "response-healing" }],
      max_tokens: ai.PROMPTS.vibe.maxTokens,
      image: true,
    });
    // The preset organic applies first, then the type vibe's pairing, schibsted-serif. That is not
    // organic's own pairing, so the Preset select reads "Custom" (R2-28) over organic's other values
    // (controller ruling on F-IMG-03).
    const organic = PRESETS.organic.params;
    expect(organic.pairing).not.toBe("schibsted-serif");
    const spec = await specInHash(page);
    const { params } = paramsOfSpec(spec);
    expect(params.pairing).toBe("schibsted-serif");
    expect({
      harmony: params.harmony,
      chroma: params.chroma,
      neutralTint: params.neutralTint,
      contrastLevel: params.contrastLevel,
      scaleMode: params.scaleMode,
      type: params.type.context,
      radius: params.radius,
      depth: params.depth,
      motion: params.motion,
    }).toEqual({
      harmony: organic.harmony,
      chroma: organic.chroma,
      neutralTint: VIBE_OUT.neutralTint,
      contrastLevel: organic.contrastLevel,
      scaleMode: organic.scaleMode,
      type: organic.type.context,
      radius: organic.radius,
      depth: organic.depth,
      motion: organic.motion,
    });
    const preset = inputsPanel(page).getByRole("combobox", { name: "Preset", exact: true });
    await expect(preset).toHaveValue("custom");
    await expect(preset.locator("option:checked")).toHaveText("Custom");
    await expect(
      inputsPanel(page).getByRole("combobox", { name: "Pairing", exact: true }),
    ).toHaveValue("schibsted-serif");
    expect(spec.direction?.adjectives).toEqual([...VIBE_OUT.moodTags]);
    // Primary and secondary from c1 and c2 (the mock names both for four clusters).
    const primary = await seedField(page, "Primary").inputValue();
    const secondary = await seedField(page, "Secondary").inputValue();
    expect(hexWithin(primary, "#b8422e", 2), primary).toBe(true);
    expect(hexWithin(secondary, "#3a6ea5", 2), secondary).toBe(true);
    // One commit: one Undo goes back to the extraction's design.
    await button(page, "Undo").click();
    await expect.poll(() => heldDesign(page)).toEqual(extracted);
  });

  test("F-STEER-03 Refine in words applies the model's ops as one commit and shows its summary", async ({
    page,
    request,
  }) => {
    await startScenario(request, "ok");
    await openAt(page);
    const before = await heldDesign(page);
    await runRefine(page, "warmer and rounder");
    await expectSteerLines(page, [`${sharedLine(TEXT_1)} ${OUTPUTS.refine.summary}`]);
    await expect(panelChoice(page, "Radius", "round")).toBeChecked();
    await expect(panelChoice(page, "Neutral tint", "warm")).toBeChecked();
    await expectCreatedWithIs(page, `model:${TEXT_1}`);
    const chats = chatRequests(await mockLog(request));
    expect(chats.map((entry) => [entry.model, entry.feature])).toEqual([[TEXT_1, "refine"]]);
    await button(page, "Undo").click();
    await expect.poll(() => heldDesign(page)).toEqual(before);
  });

  test("F-RAT-01 Write the rationale stores the model's text, shown as text, and DESIGN.md carries the thesis", async ({
    page,
    request,
  }) => {
    await startScenario(request, "ok");
    await openStudio(page, LINK(named("Rationale One")));
    await writeRationale(page).click();
    await expect(rationaleLines(page).locator("p")).toHaveText([sharedLine(TEXT_1)]);
    await expectCreatedWithIs(page, `model:${TEXT_1}`);
    const section = rationaleSection(page);
    // The thesis "<b>Calm</b> and exact" shows its tags as text and makes no element (R4-28).
    await expect(section.getByText(RATIONALE_OUT.thesis, { exact: true })).toBeVisible();
    await expect(section.locator("b")).toHaveCount(0);
    await expect(
      section.getByRole("list", { name: "Do", exact: true }).getByRole("listitem"),
    ).toHaveText([...RATIONALE_OUT.do]);
    await expect(
      section.getByRole("list", { name: "Don't", exact: true }).getByRole("listitem"),
    ).toHaveText([...RATIONALE_OUT.dont]);
    const spec = await specInHash(page);
    expect(spec.meta.name).toBe("Rationale One");
    expect(spec.meta.oneLiner).toBe(RATIONALE_OUT.oneLiner);
    expect(spec.direction?.thesis).toBe(RATIONALE_OUT.thesis);
    expect(spec.rules).toEqual({ do: RATIONALE_OUT.do, dont: RATIONALE_OUT.dont });
    expect(chatRequests(await mockLog(request)).map((entry) => entry.feature)).toEqual([
      "rationale",
    ]);
    // The export dialog's DESIGN.md preview is the bundle of the held design, the thesis in it as
    // Markdown text.
    await openReady(page);
    const designMd = bundleOf(spec).files.find((file) => file.path === "DESIGN.md")?.text;
    expect(designMd).toContain(mdText(RATIONALE_OUT.thesis));
    expect(await rawText(previewOf(page, "DESIGN.md"))).toBe(designMd);
    await expect(previewOf(page, "DESIGN.md").locator("b")).toHaveCount(0);
  });

  test("F-RAT-02 a tier 1 thesis that names a color is refused, and tier 2 writes the rationale", async ({
    page,
    request,
  }) => {
    await startScenario(request, "tier1-color");
    await openStudio(page, LINK(named("Rationale Two")));
    await writeRationale(page).click();
    await expect(rationaleLines(page).locator("p")).toHaveText([sharedLine(TEXT_2)]);
    await expectCreatedWithIs(page, `model:${TEXT_2}`);
    // Tier 1 answered 200 with "#ff0000" in its thesis; the route read it as `range` and went on.
    const chats = chatRequests(await mockLog(request));
    expect(chats.map((entry) => [entry.model, entry.status])).toEqual([
      [TEXT_1, 200],
      [TEXT_2, 200],
    ]);
    const spec = await specInHash(page);
    expect(spec.direction?.thesis).toBe(RATIONALE_OUT.thesis);
    await expect(rationaleSection(page)).not.toContainText("#ff0000");
  });

  test("F-CRIT-01 Explain the top findings ranks finding 0 without storing it, and a commit clears it for good", async ({
    page,
    request,
  }) => {
    await startScenario(request, "ok");
    const findings = lintSpec(ONE_FAIL);
    await openStudio(page, ONE_FAIL_LINK);
    const before = await heldDesign(page);
    await explainFindings(page).click();
    await expect(findingsLines(page).locator("p")).toHaveText([sharedLine(TEXT_1)]);
    const region = explanation(page);
    await expect(region.locator(":scope > p")).toHaveText([CRITIQUE_OUT.verdict]);
    const items = region.getByRole("listitem");
    await expect(items).toHaveCount(1);
    const [entry] = CRITIQUE_OUT.top;
    expect(entry?.findingIndex).toBe(0);
    const target = findings[0];
    if (target === undefined) throw new Error("F-CRIT-01: ONE_FAIL has no finding");
    const patch = fixFor(target, paramsOfSpec(ONE_FAIL).params);
    if (patch?.contrastLevel === undefined) throw new Error("F-CRIT-01: finding 0 has no fix");
    for (const text of [findingTitle(target.id), target.subject, entry?.why ?? ""]) {
      await expect(items.first()).toContainText(text);
    }
    const fix = items.first().getByRole("button", {
      name: `Raise contrast to ${patch.contrastLevel}`,
      exact: true,
    });
    await expect(fix).toBeVisible();
    expect(chatRequests(await mockLog(request)).map((chat) => chat.feature)).toEqual(["critique"]);
    // Never stored: the design and the link are the ones before.
    expect(await heldDesign(page)).toEqual(before);
    // Raising the contrast level commits: the explanation and its line go.
    await fix.click();
    await settled(page);
    await expect.poll(async () => (await heldDesign(page))[0]).not.toBe(before[0]);
    await expect(explanation(page)).toHaveCount(0);
    await expect(findingsLines(page)).not.toContainText(sharedLine(TEXT_1));
    // Cleared, not hidden: one Undo holds ONE_FAIL again, and neither comes back.
    await button(page, "Undo").click();
    await expect.poll(() => heldDesign(page)).toEqual(before);
    await expect(findingsSection(page).getByRole("status")).toBeEmpty();
    await expect(explanation(page)).toHaveCount(0);
  });
});

test.describe("RF1 a reply that lands after the visitor's edits", () => {
  test("F-AI-RF1 the brief's change builds on the edits made while it read, as one commit after them", async ({
    page,
    request,
  }) => {
    await startScenario(request, "hold");
    await openAt(page);
    await runBrief(page, "edit while it reads, calm");
    await expect(
      inputsPanel(page).getByRole("button", { name: "Reading the brief…", exact: true }),
    ).toHaveAttribute("aria-busy", "true");
    await waitForHeld(request);
    // While the mock holds the reply, the visitor sets Chroma to vivid and locks the secondary.
    await panelChoice(page, "Chroma", "vivid").check();
    await expect(panelChoice(page, "Chroma", "vivid")).toBeChecked();
    await lockToggle(page, "secondary").click();
    await expect(lockToggle(page, "secondary")).toHaveAttribute("aria-pressed", "true");
    const edited = await heldDesign(page);
    const visitorSecondary = paramsOfSpec(await specInHash(page)).params.secondary;
    expect(visitorSecondary).toBeDefined();
    await release(request);
    await expectBriefLines(page, [sharedLine(TEXT_1)]);
    await expectCreatedWithIs(page, `model:${TEXT_1}`);
    const { params } = paramsOfSpec(await specInHash(page));
    // BRIEF_OUT names no secondary hue, so the visitor's lock stays; its chroma replaces vivid.
    expect(BRIEF_OUT.hues?.secondary).toBeUndefined();
    expect(params.secondary).toEqual(visitorSecondary);
    expect(params.chroma).toBe(BRIEF_OUT.chroma);
    await expect(panelChoice(page, "Chroma", "muted")).toBeChecked();
    await expect(lockToggle(page, "secondary")).toHaveAttribute("aria-pressed", "true");
    // One commit after the visitor's: one Undo takes back only the brief's change.
    await button(page, "Undo").click();
    await expect.poll(() => heldDesign(page)).toEqual(edited);
  });
});
