import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Locator, type Page, type Request, type Route } from "@playwright/test";
import type { AiFeature, FeatureOutput, RouteCode } from "@/ai";
import type { OnDeviceState } from "@/features/ai/on-device";
import { encodeSpec } from "@/spec";
import { designFor, FRESH, inputsPanel, openStudio, seedOf } from "./studio-support";

// Shared helpers for the AI flows of docs/specs/04-ai.md, section 14.11 (Tasks 4.10 to 4.12). A flow
// that needs the shared step answers `/api/ai/<feature>` itself through `page.route` ("via
// page.route"); the visitor key's calls to OpenRouter and its sign-in are intercepted the same way,
// so no flow here reaches the network (R4-58). The tests compute in Node, through `@/ai`, what the
// page must show.

// `@/ai` imports its prompts with `?raw`, which Playwright's loader does not read: the hook does.
await import("./raw-hooks.mjs");
export const ai = await import("@/ai");

/** Section 4's fixtures. */
export const TEXT_SLUGS = ["test/text-1:free", "test/text-2:free", "test/text-3:free"] as const;
export const VISION_SLUGS = [
  "test/vision-1:free",
  "test/vision-2:free",
  "test/vision-3:free",
] as const;
export const TEST_KEY = "sk-or-test-0123456789abcdef";

/**
 * The link the AI flows open the studio on: a fresh design, so no seed is locked, with its hash
 * written from the start (a fresh studio writes none until a change commits).
 */
export const START = `#s=${encodeSpec(designFor(FRESH, seedOf(7)))}`;

/** Opens the studio on `START`. */
export const openAt = (page: Page) => openStudio(page, START);

/** The five outputs of section 4, from the file the unit tests and the mock read. */
export const OUTPUTS: { readonly [F in AiFeature]: FeatureOutput[F] } = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "../fixtures/ai/outputs.json"), "utf8"),
);
export const BRIEF_OUT = OUTPUTS.brief;

/** The `page.route` pattern of a feature's shared route. */
const sharedRoute = (feature: AiFeature) => `**/api/ai/${feature}`;
const OPENROUTER_CHAT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_KEYS = "https://openrouter.ai/api/v1/auth/keys";
const OPENROUTER_AUTHORIZE = "https://openrouter.ai/auth?**";
/** The headers a cross-origin answer needs: the browser reads the reply under CORS. */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

/** A reply of the shared route: a status and a JSON body (section 11.1). */
export type SharedReply = { readonly status: number; readonly body: unknown };

/** A 200 of section 11.1: `result` from `path`, with the visitor's remaining actions. */
export function sharedOk<F extends AiFeature>(
  feature: F,
  result: FeatureOutput[F] = OUTPUTS[feature],
  options: { slug?: string; attempts?: number; remaining?: number } = {},
): SharedReply {
  const vision = feature === "vibe";
  const slug = options.slug ?? (vision ? VISION_SLUGS[0] : TEXT_SLUGS[0]);
  const group: readonly string[] = vision ? VISION_SLUGS : TEXT_SLUGS;
  const index = group.indexOf(slug);
  const tiers = vision ? ["vision-1", "vision-2", "vision-3"] : ["primary", "fast", "fallback"];
  return {
    status: 200,
    body: {
      ok: true,
      feature,
      result,
      path: {
        provider: "shared",
        slug,
        tier: tiers[Math.max(index, 0)],
        attempts: options.attempts ?? 1,
      },
      remaining: options.remaining ?? 2,
    },
  };
}

/** Each code's status and whether its body carries `remaining`, as section 11.1 writes it. */
const FAILURE_ROWS: Readonly<Record<RouteCode, { status: number; remaining: boolean }>> = {
  "unknown-feature": { status: 404, remaining: false },
  "forbidden-origin": { status: 403, remaining: false },
  "not-configured": { status: 503, remaining: false },
  "too-large": { status: 413, remaining: false },
  "bad-request": { status: 400, remaining: false },
  "visitor-cap": { status: 429, remaining: true },
  busy: { status: 503, remaining: true },
  "guard-unavailable": { status: 503, remaining: true },
  "pool-low": { status: 503, remaining: true },
  "all-tiers-failed": { status: 502, remaining: true },
};

/**
 * A failure reply of section 11.1 for `code`; `remaining` where its row has one (0 for the cap).
 * `all-tiers-failed` carries one failed tier per slug.
 */
export function sharedFailure(code: RouteCode, remaining = 2): SharedReply {
  const row = FAILURE_ROWS[code];
  const body: Record<string, unknown> = { ok: false, code };
  if (row.remaining) body.remaining = code === "visitor-cap" ? 0 : remaining;
  if (code === "all-tiers-failed") {
    body.failures = [
      { tier: "primary", slug: TEXT_SLUGS[0], kind: "http", status: 503 },
      { tier: "fast", slug: TEXT_SLUGS[1], kind: "timeout" },
      { tier: "fallback", slug: TEXT_SLUGS[2], kind: "json" },
    ];
  }
  return { status: row.status, body };
}

const fulfillJson = (route: Route, reply: SharedReply, headers: Record<string, string> = {}) =>
  route.fulfill({
    status: reply.status,
    contentType: "application/json",
    headers,
    body: JSON.stringify(reply.body),
  });

/**
 * Answers `/api/ai/<feature>` with `reply`, or aborts the request (a network error), until the
 * route is removed. It replaces an earlier answer for the feature and returns the JSON bodies the
 * page posted, in order.
 */
export async function answerShared(
  page: Page,
  feature: AiFeature,
  reply: SharedReply | { readonly abort: true },
): Promise<unknown[]> {
  const bodies: unknown[] = [];
  await page.unroute(sharedRoute(feature));
  await page.route(sharedRoute(feature), async (route) => {
    bodies.push(route.request().postDataJSON());
    if ("abort" in reply) await route.abort("failed");
    else await fulfillJson(route, reply);
  });
  return bodies;
}

/**
 * Holds every request to `/api/ai/<feature>` until the returned release answers them all with
 * `reply` (by default the feature's output from the first text or vision slug).
 */
export async function holdShared(
  page: Page,
  feature: AiFeature,
  reply: SharedReply = sharedOk(feature),
): Promise<() => Promise<void>> {
  const held: Route[] = [];
  await page.unroute(sharedRoute(feature));
  await page.route(sharedRoute(feature), (route) => {
    held.push(route);
  });
  return async () => {
    const routes = held.splice(0);
    // A route whose page canceled the request is already handled.
    await Promise.all(routes.map((route) => fulfillJson(route, reply).catch(() => {})));
  };
}

/** Answers `GET /api/ai/models` with the test slugs (D8: no route of Task 4.7b is needed). */
export async function answerModels(page: Page): Promise<void> {
  await page.route("**/api/ai/models", (route) =>
    fulfillJson(route, { status: 200, body: { text: [...TEXT_SLUGS], vision: [...VISION_SLUGS] } }),
  );
}

/** One call the page made to OpenRouter: its headers and its JSON body. */
export type OpenRouterCall = {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Record<string, unknown>;
};

/** Answers a cross-origin call: its CORS preflight, then the call with `handler`'s reply. */
async function answerCrossOrigin(
  page: Page,
  url: string,
  handler: (call: OpenRouterCall) => SharedReply | Promise<SharedReply>,
): Promise<OpenRouterCall[]> {
  const calls: OpenRouterCall[] = [];
  await page.route(url, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const call: OpenRouterCall = {
      url: request.url(),
      headers: await request.allHeaders(),
      body: request.postDataJSON() as Record<string, unknown>,
    };
    calls.push(call);
    await fulfillJson(route, await handler(call), CORS);
  });
  return calls;
}

/** Answers the visitor key's chat calls to OpenRouter (R4-34) and returns them. */
export function answerOpenRouter(
  page: Page,
  handler: (call: OpenRouterCall) => SharedReply | Promise<SharedReply>,
): Promise<OpenRouterCall[]> {
  return answerCrossOrigin(page, OPENROUTER_CHAT, handler);
}

/** An OpenRouter chat reply whose message holds `output` as JSON. */
export const chatReply = (output: unknown): SharedReply => ({
  status: 200,
  body: { choices: [{ message: { content: JSON.stringify(output) } }] },
});

/** Answers the PKCE code exchange (R4-33) and returns its calls. */
export function answerExchange(
  page: Page,
  handler: (call: OpenRouterCall) => SharedReply | Promise<SharedReply>,
): Promise<OpenRouterCall[]> {
  return answerCrossOrigin(page, OPENROUTER_KEYS, handler);
}

/**
 * Intercepts the navigation to OpenRouter's sign-in and sends the browser to `callback(url)`, the
 * callback address OpenRouter would return to. It returns the authorize URLs the page opened.
 */
export async function answerAuthorize(
  page: Page,
  callback: (authorize: URL) => string,
): Promise<URL[]> {
  const opened: URL[] = [];
  await page.route(OPENROUTER_AUTHORIZE, async (route) => {
    const url = new URL(route.request().url());
    opened.push(url);
    await route.fulfill({ status: 302, headers: { Location: callback(url) } });
  });
  return opened;
}

/** Records the page's requests to its own origin and to OpenRouter. */
export function recordRequests(page: Page): Request[] {
  const requests: Request[] = [];
  page.on("request", (request) => requests.push(request));
  return requests;
}

/** Whether a request went to the AI layer: dyelot's `/api/ai/` or OpenRouter. */
export const isAiRequest = (request: Request): boolean => {
  const url = new URL(request.url());
  return url.pathname.startsWith("/api/ai/") || url.hostname === "openrouter.ai";
};

/**
 * Installs a fake `LanguageModel` (Chrome's Prompt API, R4-31) before the page's scripts run: its
 * `availability` answers `state`; a session's `prompt` answers `reply`. A `create` with a monitor
 * (the download) reports each fraction of `download` 500 ms apart, then the model is available.
 * With `hold`, a `prompt` ignores its signal and answers only once the test calls
 * `window.__lmRelease()`, then sets `window.__lm.replied`. `window.__lm` counts the calls.
 */
export async function fakeLanguageModel(
  page: Page,
  options: { state: OnDeviceState; reply?: string; download?: readonly number[]; hold?: boolean },
): Promise<void> {
  await page.addInitScript(
    ({ state, reply, download, hold }) => {
      const STEP_MS = 500;
      const wait = () => new Promise((resolve) => setTimeout(resolve, STEP_MS));
      let current = state;
      const calls = { availability: 0, create: 0, prompt: 0, destroy: 0, replied: false };
      const host = window as unknown as { __lm: typeof calls; __lmRelease: () => void };
      host.__lm = calls;
      let release = () => {};
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      host.__lmRelease = () => release();
      const session = () => ({
        prompt: async () => {
          calls.prompt += 1;
          if (hold) await released;
          calls.replied = true;
          return reply;
        },
        destroy: () => {
          calls.destroy += 1;
        },
      });
      const LanguageModel = {
        availability: async () => {
          calls.availability += 1;
          return current;
        },
        create: async (created: { monitor?: (target: EventTarget) => void }) => {
          calls.create += 1;
          if (typeof created?.monitor === "function") {
            const target = new EventTarget();
            created.monitor(target);
            current = "downloading";
            for (const loaded of download) {
              await wait();
              const event = new Event("downloadprogress");
              Object.defineProperty(event, "loaded", { value: loaded });
              target.dispatchEvent(event);
            }
            await wait();
            current = "available";
          }
          if (current !== "available") throw new DOMException("No model.", "NotAllowedError");
          return session();
        },
      };
      Object.defineProperty(globalThis, "LanguageModel", {
        value: LanguageModel,
        configurable: true,
      });
    },
    {
      state: options.state,
      hold: options.hold ?? false,
      reply: options.reply ?? "",
      download: [...(options.download ?? [0, 1])],
    },
  );
}

/** Removes the browser's own `LanguageModel` (Chromium ships the Prompt API) before the page runs. */
export async function noLanguageModel(page: Page): Promise<void> {
  await page.addInitScript(() => {
    delete (globalThis as { LanguageModel?: unknown }).LanguageModel;
  });
}

// ——— The Brief section ———

/** The inputs panel's Brief section. */
export const briefSection = (page: Page): Locator =>
  inputsPanel(page).getByRole("region", { name: "Brief", exact: true });
export const briefField = (page: Page): Locator =>
  inputsPanel(page).getByRole("textbox", { name: "Describe the product or mood", exact: true });
export const readBrief = (page: Page): Locator =>
  inputsPanel(page).getByRole("button", { name: "Read the brief", exact: true });
/** The Brief section's result region: the failure sentences, then the result line (section 13). */
export const briefLines = (page: Page): Locator => briefSection(page).locator("[data-ai-lines]");
export const aiSettingsButton = (page: Page): Locator =>
  inputsPanel(page).getByRole("button", { name: "AI settings", exact: true });
export const aiSettings = (page: Page): Locator =>
  inputsPanel(page).getByRole("region", { name: "AI settings", exact: true });
export const onDeviceSwitch = (page: Page): Locator =>
  inputsPanel(page).getByRole("switch", {
    name: "Use Chrome's built-in model (experimental)",
    exact: true,
  });

/** Opens AI settings, unless they are open. */
export async function openAiSettings(page: Page): Promise<void> {
  const button = aiSettingsButton(page);
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  await expect(aiSettings(page)).toBeVisible();
}

/** Types `text` into the brief and reads it. */
export async function runBrief(page: Page, text: string): Promise<void> {
  await briefField(page).fill(text);
  await readBrief(page).click();
}

/** Waits until the Brief section shows exactly `lines`, the failure sentences then the result. */
export async function expectBriefLines(page: Page, lines: readonly string[]): Promise<void> {
  await expect(briefLines(page).locator("p")).toHaveText([...lines]);
}

/** The lexicon's result line for a brief's text, as 13.1 writes it. */
export function lexiconLine(text: string): string {
  const { rest } = ai.briefColors(text);
  const { terms, draft } = ai.matchLexicon(rest);
  if (draft === null) throw new Error(`lexiconLine: no term matches ${JSON.stringify(text)}`);
  return `Made with the word list (no model). Matched: ${terms.join(", ")}.`;
}

// ——— The inspector: Rationale and the critique (13.5) ———

/** The inspector's landmark, as studio-support's `inspectorPanel` finds it. */
const inspector = (page: Page): Locator =>
  page.getByRole("complementary", { name: "Inspector", exact: true });

/** The inspector's Rationale section and its controls. */
export const rationaleSection = (page: Page): Locator =>
  inspector(page).getByRole("region", { name: "Rationale", exact: true });
export const writeRationale = (page: Page): Locator =>
  inspector(page).getByRole("button", { name: "Write the rationale", exact: true });
/** The Rationale section's result region: the failure sentences, then the result line (13). */
export const rationaleLines = (page: Page): Locator =>
  rationaleSection(page).locator("[data-ai-lines]");

/** The inspector's Findings section, its critique button and the critique's explanation. */
export const findingsSection = (page: Page): Locator =>
  inspector(page).getByRole("region", { name: "Findings", exact: true });
export const explainFindings = (page: Page): Locator =>
  inspector(page).getByRole("button", { name: "Explain the top findings", exact: true });
export const explanation = (page: Page): Locator =>
  findingsSection(page).getByRole("region", { name: "Explanation", exact: true });
/** The Findings section's one status region: the critique's lines, then a fix's outcome (13). */
export const findingsLines = (page: Page): Locator => findingsSection(page).getByRole("status");
