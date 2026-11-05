import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_FEATURES, type AiFeature, briefInput, readRouteReply } from "@/ai";
import { createAiCache } from "@/server/ai/cache";
import { type CascadeGate, createCascadeGate } from "@/server/ai/guard";
import { type AiDeps, handleAi } from "@/server/ai/handle";
import {
  NOW,
  TEST_ENV,
  TEST_KEY,
  TEST_SECRET,
  TEXT_SLUGS,
  TODAY,
  VISION_SLUGS,
} from "../ai/fixtures";
import {
  type Answer,
  API_POLICY,
  abortable,
  BASE,
  capValue,
  chatAnswer,
  cookieOf,
  held,
  INPUTS,
  keyAnswer,
  keyWithoutRemaining,
  makeDeps,
  never,
  OUTPUTS,
  oracleMac,
  padded,
  post,
  type Recording,
  type Reply,
  read,
  recordingFetch,
  SITE_ORIGIN,
  setCookieLine,
  settled,
  statusAnswer,
  streamed,
  throwing,
  UPSTREAM_TEXT,
  watched,
} from "./support";

// C-ROUTE-01 to 08, 10 to 16 and RF5 of docs/specs/04-ai.md, section 14.7: `handleAi`, the shared
// quota's route, with an injected fetch that answers `/key` and the tiers from a script, fake timers
// where a timeout matters, and the made-up key and secret of section 4. Every action goes through
// `act`, which checks after each one what holds over every C-ROUTE case: C-ROUTE-07's bounds on the
// calls, C-ROUTE-11's clean log lines, R4-24's headers and 11.1's reply shapes.

const YESTERDAY = "2026-11-04";
const BRIEF_A = briefInput("Kyoto tea house at dusk, calm and exact", {});
const BRIEF_B = briefInput("A night market in Taipei, loud and warm", {});
const BRIEF_C = briefInput("A quiet Nordic library in winter", {});
const BRIEF_D = briefInput("A desert observatory under clear skies", {});
const BRIEF_E = briefInput("A ferry terminal at seven in the morning", {});
const BRIEF_OK = outputFor("brief");

function outputFor(feature: AiFeature): Answer {
  return chatAnswer(JSON.stringify(OUTPUTS[feature]), {
    prompt_tokens: 100,
    completion_tokens: 20,
  });
}

/** A brief output whose prose holds a color value, which R4-38 sorts as `range`. */
const RANGE_ANSWER = chatAnswer(JSON.stringify({ ...OUTPUTS.brief, oneLiner: "Red as #ff0000." }));
/** A brief output with a key its schema does not know, which is `schema`. */
const SCHEMA_ANSWER = chatAnswer(JSON.stringify({ ...OUTPUTS.brief, extra: 1 }));

afterEach(() => {
  vi.useRealTimers();
});

/** The feature whose reader checks a reply's shape: any feature reads a failure the same way. */
const readerFeature = (feature: string): AiFeature =>
  (AI_FEATURES as readonly string[]).includes(feature) ? (feature as AiFeature) : "brief";

/**
 * C-ROUTE-07 and C-ROUTE-11 for one action, and R4-24 and 11.1 for its reply: at most 3 chat calls
 * and 3 `/key` reads, no tier called twice, no `models` or `provider` sent, no unexpected call; no log
 * line holding the key, the secret or a cookie value; the three headers; a reply 11.1 lists.
 */
function checkAction(
  feature: string,
  calls: Recording["calls"],
  reply: Reply,
  lines: readonly string[],
  cookies: readonly string[],
): void {
  const chats = calls.filter((call) => call.url === `${BASE}/chat/completions`);
  const keys = calls.filter((call) => call.url === `${BASE}/key`);
  expect(calls.length, "every call is a /key read or a chat call").toBe(chats.length + keys.length);
  expect(chats.length, "C-ROUTE-07 chat calls").toBeLessThanOrEqual(3);
  expect(keys.length, "C-ROUTE-07 /key reads").toBeLessThanOrEqual(3);
  const bodies = chats.map((call) => JSON.parse(String(call.init.body)) as Record<string, unknown>);
  const models = bodies.map((body) => body.model);
  expect(new Set(models).size, "C-ROUTE-07 no tier twice").toBe(models.length);
  for (const body of bodies) {
    expect(body, "C-ROUTE-07 no models").not.toHaveProperty("models");
    expect(body, "C-ROUTE-07 no provider").not.toHaveProperty("provider");
  }
  for (const line of lines) {
    expect(line, "C-ROUTE-11").not.toContain(TEST_KEY);
    expect(line, "C-ROUTE-11").not.toContain(TEST_SECRET);
    for (const cookie of cookies) expect(line, "C-ROUTE-11").not.toContain(cookie);
  }
  expect(reply.headers.get("content-type")).toBe("application/json");
  expect(reply.headers.get("cache-control")).toBe("no-store");
  expect(reply.headers.get("content-security-policy")).toBe(API_POLICY);
  const reader = readRouteReply(readerFeature(feature), reply.status, reply.json);
  expect(reader.ok ? "ok" : reader.code, "11.1's shapes").not.toBe("unreachable");
  expect(reply.text).not.toContain(UPSTREAM_TEXT);
}

type Options = Parameters<typeof post>[2];

/** One action through `handleAi`, checked by `checkAction`. */
async function act(
  context: { deps: AiDeps; lines: string[]; recording: Recording },
  feature: string,
  body: unknown,
  options: Options = {},
): Promise<Reply> {
  const from = context.recording.calls.length;
  const pending = handleAi(feature, post(feature, body, options), context.deps);
  return settle(context, feature, pending, { cookie: options.cookie }, from);
}

/** Reads a pending action's reply and checks it as `act` does. */
async function settle(
  context: { lines: string[]; recording: Recording },
  feature: string,
  pending: Promise<Response>,
  options: { cookie?: string | undefined } = {},
  from = 0,
): Promise<Reply> {
  const reply = await read(await pending);
  expect(context.recording.unexpected, "unexpected calls").toEqual([]);
  const sent = (options.cookie ?? "").split(";").map((pair) => pair.slice(pair.indexOf("=") + 1));
  const set =
    reply.setCookie === null ? [] : [cookieOf(reply.setCookie).slice("dyelot_ai=".length)];
  const cookies = [...sent, ...set]
    .map((value) => value.trim())
    .filter((value) => value.length > 8);
  checkAction(feature, context.recording.calls.slice(from), reply, context.lines, cookies);
  return reply;
}

/** A context of fake deps around one scripted fetch. */
function setup(script: Parameters<typeof recordingFetch>[0], overrides: Partial<AiDeps> = {}) {
  const recording = recordingFetch(script);
  const { deps, lines, afters } = makeDeps({ fetch: recording.fetch, ...overrides });
  return { deps, lines, afters, recording };
}

/** 11.1's 200 body, in its key order. */
function okBody(
  feature: AiFeature,
  slug: string,
  tier: string,
  attempts: number,
  remaining: number,
) {
  return {
    ok: true,
    feature,
    result: OUTPUTS[feature],
    path: { provider: "shared", slug, tier, attempts },
    remaining,
  };
}

describe("C-ROUTE-01 a brief answered by tier 1", () => {
  it("C-ROUTE-01 reads /key once and calls tier primary once, then answers 11.1's 200 body", async () => {
    const context = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] });
    const reply = await act(context, "brief", BRIEF_A);
    expect(reply.status).toBe(200);
    expect(reply.text).toBe(JSON.stringify(okBody("brief", TEXT_SLUGS[0], "primary", 1, 2)));
    expect(Object.keys(reply.json)).toEqual(["ok", "feature", "result", "path", "remaining"]);
    const [key, chat] = context.recording.calls;
    expect(context.recording.calls).toHaveLength(2);
    expect(key?.url).toBe(`${BASE}/key`);
    expect(key?.init.headers).toStrictEqual({ Authorization: `Bearer ${TEST_KEY}` });
    expect(chat?.url).toBe(`${BASE}/chat/completions`);
    expect(JSON.parse(String(chat?.init.body)).model).toBe(TEXT_SLUGS[0]);
    expect(chat?.init.headers).toMatchObject({
      Authorization: `Bearer ${TEST_KEY}`,
      "HTTP-Referer": SITE_ORIGIN,
      "X-OpenRouter-Title": "dyelot",
    });
  });

  it("C-ROUTE-01 sets the cap cookie with count 1 and Max-Age=43200 at NOW", async () => {
    const context = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] });
    const reply = await act(context, "brief", BRIEF_A);
    expect(reply.setCookie).toBe(setCookieLine(`v1.${TODAY}.1.${oracleMac(TODAY, 1)}`, 43200));
  });

  it("C-ROUTE-01 carries R4-24's three headers", async () => {
    const context = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] });
    const reply = await act(context, "brief", BRIEF_A);
    expect(reply.headers.get("content-type")).toBe("application/json");
    expect(reply.headers.get("cache-control")).toBe("no-store");
    expect(reply.headers.get("content-security-policy")).toBe(
      "default-src 'none'; frame-ancestors 'none';",
    );
  });

  it("C-ROUTE-01 answers each of the five features from its first tier", async () => {
    for (const feature of AI_FEATURES) {
      const context = setup({ key: [keyAnswer(50)], chat: [outputFor(feature)] });
      const reply = await act(context, feature, INPUTS[feature]);
      const slug = feature === "vibe" ? VISION_SLUGS[0] : TEXT_SLUGS[0];
      const tier = feature === "vibe" ? "vision-1" : "primary";
      expect(reply.text, feature).toBe(JSON.stringify(okBody(feature, slug, tier, 1, 2)));
    }
  });
});

describe("C-ROUTE-02 the refusals before any fetch", () => {
  it('C-ROUTE-02 feature "poem" is 404 unknown-feature', async () => {
    const context = setup({});
    const reply = await act(context, "poem", BRIEF_A);
    expect(reply.status).toBe(404);
    expect(reply.text).toBe('{"ok":false,"code":"unknown-feature"}');
    expect(context.recording.calls).toEqual([]);
    expect(reply.setCookie).toBeNull();
  });

  it("C-ROUTE-02 an inherited name such as constructor is not a feature", async () => {
    const context = setup({});
    for (const feature of ["constructor", "toString", "__proto__", "BRIEF", ""]) {
      const reply = await act(context, feature, BRIEF_A);
      expect(reply.status, feature).toBe(404);
    }
  });

  it.each([
    ["no Origin", null],
    ["Origin: https://evil.example", "https://evil.example"],
    ["Origin: null", "null"],
    ["a look-alike host", "https://dyelot.vercel.app.evil.example"],
    ["another scheme", "http://dyelot.vercel.app"],
    ["a trailing slash", "https://dyelot.vercel.app/"],
  ])("C-ROUTE-02 %s is 403 forbidden-origin", async (_, origin) => {
    const context = setup({});
    const reply = await act(context, "brief", BRIEF_A, { origin });
    expect(reply.status).toBe(403);
    expect(reply.text).toBe('{"ok":false,"code":"forbidden-origin"}');
    expect(context.recording.calls).toEqual([]);
    expect(reply.setCookie).toBeNull();
  });

  it("C-ROUTE-02 the site's origin passes, and so does one equal to the request's protocol and Host", async () => {
    const site = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] });
    expect((await act(site, "brief", BRIEF_A)).status).toBe(200);
    const local = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] });
    const reply = await act(local, "brief", BRIEF_A, {
      url: "http://localhost:3102/api/ai/brief",
      host: "localhost:3102",
      origin: "http://localhost:3102",
    });
    expect(reply.status).toBe(200);
  });

  it("C-ROUTE-02 an Origin that names another Host or protocol than the request's is 403", async () => {
    const context = setup({});
    for (const [host, origin] of [
      ["localhost:3102", "http://localhost:3103"],
      ["localhost:3102", "https://localhost:3102"],
    ] as const) {
      const reply = await act(context, "brief", BRIEF_A, {
        url: "http://localhost:3102/api/ai/brief",
        host,
        origin,
      });
      expect(reply.status, origin).toBe(403);
    }
    expect(context.recording.calls).toEqual([]);
  });

  it("C-ROUTE-02 a bad env is 503 not-configured with its log line, logged once over two requests", async () => {
    const env = { ...TEST_ENV, OPENROUTER_API_KEY: "sk or test with spaces" };
    const context = setup({}, { env });
    for (let i = 0; i < 2; i += 1) {
      const reply = await act(context, "brief", BRIEF_A);
      expect(reply.status).toBe(503);
      expect(reply.text).toBe('{"ok":false,"code":"not-configured"}');
    }
    expect(context.lines).toEqual(["dyelot ai: OPENROUTER_API_KEY is missing or invalid."]);
    expect(context.recording.calls).toEqual([]);
  });

  it("C-ROUTE-02 logs each bad variable by name, never by value", async () => {
    const env = { ...TEST_ENV, DYELOT_COOKIE_SECRET: "not base64!" };
    const context = setup({}, { env });
    await act(context, "brief", BRIEF_A);
    expect(context.lines).toEqual(["dyelot ai: DYELOT_COOKIE_SECRET is missing or invalid."]);
    expect(context.lines.join("\n")).not.toContain("not base64!");
  });

  it("C-ROUTE-02 a Content-Length of 32,769 is 413 too-large", async () => {
    const context = setup({});
    const reply = await act(context, "brief", BRIEF_A, { headers: { "content-length": "32769" } });
    expect(reply.status).toBe(413);
    expect(reply.text).toBe('{"ok":false,"code":"too-large"}');
    expect(context.recording.calls).toEqual([]);
  });

  it("C-ROUTE-02 a streamed body past 32,768 bytes without a Content-Length is 413 too-large", async () => {
    const context = setup({});
    const request = streamed("brief", 32_769);
    expect(request.headers.get("content-length")).toBeNull();
    const reply = await settle(context, "brief", handleAi("brief", request, context.deps));
    expect(reply.status).toBe(413);
    expect(reply.text).toBe('{"ok":false,"code":"too-large"}');
    expect(context.recording.calls).toEqual([]);
  });

  it.each([
    ["the text {", "{"],
    ["an empty body", ""],
    ["a JSON array", "[]"],
    ["a brief of no text", JSON.stringify({ brief: "", locked: {} })],
    ["a brief with an extra key", JSON.stringify({ ...BRIEF_A, extra: 1 })],
    ["another feature's input", JSON.stringify(INPUTS.refine)],
  ])("C-ROUTE-02 %s is 400 bad-request", async (_, body) => {
    const context = setup({});
    const reply = await act(context, "brief", body);
    expect(reply.status).toBe(400);
    expect(reply.text).toBe('{"ok":false,"code":"bad-request"}');
    expect(context.recording.calls).toEqual([]);
    expect(reply.setCookie).toBeNull();
  });

  it("C-ROUTE-02 bytes that are not UTF-8 are 400 bad-request", async () => {
    const context = setup({});
    const bytes = new Uint8Array([0x7b, 0x22, 0xff, 0x22, 0x7d]);
    const request = new Request(`${SITE_ORIGIN}/api/ai/brief`, {
      method: "POST",
      headers: { origin: SITE_ORIGIN, host: "dyelot.vercel.app" },
      body: bytes,
    });
    const reply = await settle(context, "brief", handleAi("brief", request, context.deps));
    expect(reply.status).toBe(400);
  });

  it("C-ROUTE-02 checks in R4-16's order: feature, origin, env, body", async () => {
    const env = { ...TEST_ENV, OPENROUTER_API_KEY: "" };
    const context = setup({}, { env });
    expect((await act(context, "poem", "{", { origin: null })).status).toBe(404);
    expect((await act(context, "brief", "{", { origin: null })).status).toBe(403);
    expect((await act(context, "brief", "{")).status).toBe(503);
    const valid = setup({});
    const cookie = `dyelot_ai=${capValue(TODAY, 3)}`;
    expect((await act(valid, "brief", "{", { cookie })).status).toBe(400);
  });

  it("C-ROUTE-02 none of these refusals sets a cookie or carries remaining", async () => {
    const context = setup({});
    const replies = [
      await act(context, "poem", BRIEF_A),
      await act(context, "brief", BRIEF_A, { origin: null }),
      await act(context, "brief", "{"),
      await act(context, "brief", BRIEF_A, { headers: { "content-length": "40000" } }),
    ];
    for (const reply of replies) {
      expect(reply.setCookie).toBeNull();
      expect(reply.json).not.toHaveProperty("remaining");
    }
  });
});

describe("C-ROUTE-03 the visitor cap", () => {
  it("C-ROUTE-03 a cookie with count 3 for today is 429 with remaining 0 and no fetch", async () => {
    const context = setup({});
    const cookie = `dyelot_ai=${capValue(TODAY, 3)}`;
    const reply = await act(context, "brief", BRIEF_A, { cookie });
    expect(reply.status).toBe(429);
    expect(reply.text).toBe('{"ok":false,"code":"visitor-cap","remaining":0}');
    expect(reply.setCookie).toBeNull();
    expect(context.recording.calls).toEqual([]);
  });

  it("C-ROUTE-03 finds the cap cookie among other cookies", async () => {
    const context = setup({});
    const cookie = `theme=dark; dyelot_ai=${capValue(TODAY, 3)}; other=1`;
    expect((await act(context, "brief", BRIEF_A, { cookie })).status).toBe(429);
  });

  it("C-ROUTE-03 count 3 from yesterday reads as 0 and proceeds", async () => {
    const context = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] });
    const cookie = `dyelot_ai=${capValue(YESTERDAY, 3)}`;
    const reply = await act(context, "brief", BRIEF_A, { cookie });
    expect(reply.status).toBe(200);
    expect(reply.json.remaining).toBe(2);
    expect(reply.setCookie).toBe(setCookieLine(capValue(TODAY, 1)));
  });

  it("C-ROUTE-03 a tampered cookie reads as 0 and proceeds", async () => {
    const value = capValue(TODAY, 1).replace(`.${TODAY}.1.`, `.${TODAY}.3.`);
    const context = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] });
    const reply = await act(context, "brief", BRIEF_A, { cookie: `dyelot_ai=${value}` });
    expect(reply.status).toBe(200);
    expect(reply.json.remaining).toBe(2);
  });

  it("C-ROUTE-03 a count of 2 today leaves 0 and signs 3", async () => {
    const context = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] });
    const reply = await act(context, "brief", BRIEF_A, {
      cookie: `dyelot_ai=${capValue(TODAY, 2)}`,
    });
    expect(reply.json.remaining).toBe(0);
    expect(reply.setCookie).toBe(setCookieLine(capValue(TODAY, 3)));
  });

  it("C-ROUTE-03 of two cap cookies, the higher valid count holds", async () => {
    const context = setup({});
    const cookie = `dyelot_ai=${capValue(TODAY, 0)}; dyelot_ai=${capValue(TODAY, 3)}`;
    expect((await act(context, "brief", BRIEF_A, { cookie })).status).toBe(429);
  });
});

describe("C-ROUTE-04 the cache", () => {
  it("C-ROUTE-04 the same brief again is 200 with the first reply's path, no fetch, no Set-Cookie and remaining unchanged", async () => {
    const context = setup({ key: [keyAnswer(50)], chat: [statusAnswer(500), BRIEF_OK] });
    const first = await act(context, "brief", BRIEF_A);
    expect(first.json.path).toEqual({
      provider: "shared",
      slug: TEXT_SLUGS[1],
      tier: "fast",
      attempts: 2,
    });
    const cookie = cookieOf(first.setCookie);
    const before = context.recording.calls.length;
    const second = await act(context, "brief", BRIEF_A, { cookie });
    expect(context.recording.calls.length).toBe(before);
    expect(second.status).toBe(200);
    expect(second.setCookie).toBeNull();
    expect(second.text).toBe(first.text);
    expect(second.json).not.toHaveProperty("cached");
  });

  it("C-ROUTE-04 a hit's remaining is the visitor's own", async () => {
    const context = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] });
    await act(context, "brief", BRIEF_A);
    const hit = await act(context, "brief", BRIEF_A, {
      cookie: `dyelot_ai=${capValue(TODAY, 2)}`,
    });
    expect(hit.json.remaining).toBe(1);
  });

  it("C-ROUTE-04 a failed action is not cached: the same brief calls the tiers again", async () => {
    const fail = [statusAnswer(503), statusAnswer(503), statusAnswer(503)];
    const context = setup({ key: [keyAnswer(50), keyAnswer(50)], chat: [...fail, BRIEF_OK] });
    expect((await act(context, "brief", BRIEF_A)).status).toBe(502);
    expect(context.deps.cache.size()).toBe(0);
    const again = await act(context, "brief", BRIEF_A);
    expect(again.status).toBe(200);
    expect(context.recording.chatCalls()).toHaveLength(4);
  });

  it("C-ROUTE-04 a hit is keyed by feature and input: another brief is a miss", async () => {
    const context = setup({ key: [keyAnswer(50), keyAnswer(50)], chat: [BRIEF_OK, BRIEF_OK] });
    await act(context, "brief", BRIEF_A);
    await act(context, "brief", BRIEF_B);
    expect(context.recording.chatCalls()).toHaveLength(2);
    expect(context.deps.cache.size()).toBe(2);
  });

  it("C-ROUTE-04 a cookie at the cap is refused before the cache answers", async () => {
    const context = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] });
    await act(context, "brief", BRIEF_A);
    const reply = await act(context, "brief", BRIEF_A, {
      cookie: `dyelot_ai=${capValue(TODAY, 3)}`,
    });
    expect(reply.status).toBe(429);
  });
});

describe("C-ROUTE-05 the first /key read", () => {
  it("C-ROUTE-05 remaining 37 is 503 pool-low with remaining and no chat call", async () => {
    const context = setup({ key: [keyAnswer(37)] });
    const reply = await act(context, "brief", BRIEF_A);
    expect(reply.status).toBe(503);
    expect(reply.text).toBe('{"ok":false,"code":"pool-low","remaining":3}');
    expect(context.recording.chatCalls()).toEqual([]);
    expect(reply.setCookie).toBeNull();
  });

  it("C-ROUTE-05 remaining 38 is admitted", async () => {
    const context = setup({ key: [keyAnswer(38), keyAnswer(38)], chat: [BRIEF_OK] });
    expect((await act(context, "brief", BRIEF_A)).status).toBe(200);
  });

  it.each([
    ["a /key 500", statusAnswer(500)],
    ["a missing field", keyWithoutRemaining],
    ["a body that is not JSON", (() => Promise.resolve(new Response("<html>"))) as Answer],
    ["a fetch that throws", throwing],
  ])("C-ROUTE-05 %s is 503 guard-unavailable", async (_, answer) => {
    const context = setup({ key: [answer] });
    const cookie = `dyelot_ai=${capValue(TODAY, 1)}`;
    const reply = await act(context, "brief", BRIEF_A, { cookie });
    expect(reply.status).toBe(503);
    expect(reply.text).toBe('{"ok":false,"code":"guard-unavailable","remaining":2}');
    expect(context.recording.chatCalls()).toEqual([]);
    expect(reply.setCookie).toBeNull();
  });

  it("C-ROUTE-05 a /key read with no answer is 503 guard-unavailable at 5,000 ms", async () => {
    vi.useFakeTimers();
    const key = watched(never);
    const context = setup({ key: [key.answer] });
    const pending = handleAi("brief", post("brief", BRIEF_A), context.deps);
    await key.called;
    await vi.advanceTimersByTimeAsync(4999);
    expect(await settled(pending)).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const reply = await settle(context, "brief", pending);
    expect(reply.text).toBe('{"ok":false,"code":"guard-unavailable","remaining":3}');
    expect(reply.setCookie).toBeNull();
  });

  it("C-ROUTE-05 a reserve of 0 admits remaining 3 and refuses 2", async () => {
    const env = { ...TEST_ENV, DYELOT_AI_RESERVE: "0" };
    const low = setup({ key: [keyAnswer(2)] }, { env });
    expect((await act(low, "brief", BRIEF_A)).json.code).toBe("pool-low");
    const enough = setup({ key: [keyAnswer(3), keyAnswer(3)], chat: [BRIEF_OK] }, { env });
    expect((await act(enough, "brief", BRIEF_A)).status).toBe(200);
  });
});

describe("C-ROUTE-06 the cascade", () => {
  it('C-ROUTE-06 tier 1 answers 500 and tier 2 validly: 200 with tier "fast" and attempts 2', async () => {
    const context = setup({ key: [keyAnswer(50)], chat: [statusAnswer(500), BRIEF_OK] });
    const reply = await act(context, "brief", BRIEF_A);
    expect(reply.text).toBe(JSON.stringify(okBody("brief", TEXT_SLUGS[1], "fast", 2, 2)));
    expect(reply.setCookie).toBe(setCookieLine(capValue(TODAY, 1)));
    const models = context.recording
      .chatCalls()
      .map((call) => JSON.parse(String(call.init.body)).model);
    expect(models).toEqual([TEXT_SLUGS[0], TEXT_SLUGS[1]]);
  });

  it.each([
    ["a 429", statusAnswer(429)],
    ["empty", chatAnswer("")],
    ["json", chatAnswer("not json at all")],
    ["schema", SCHEMA_ANSWER],
    ["range", RANGE_ANSWER],
    ["a fetch that throws", throwing],
  ])("C-ROUTE-06 a tier-1 failure (%s) moves on to tier 2", async (_, answer) => {
    const context = setup({ key: [keyAnswer(50)], chat: [answer, BRIEF_OK] });
    const reply = await act(context, "brief", BRIEF_A);
    expect(reply.status).toBe(200);
    expect(reply.json.path).toMatchObject({ tier: "fast", attempts: 2 });
  });

  it("C-ROUTE-06 a tier-1 timeout at 20,000 ms moves on to tier 2", async () => {
    vi.useFakeTimers();
    const tier1 = watched(never);
    const context = setup({ key: [keyAnswer(50)], chat: [tier1.answer, BRIEF_OK] });
    const pending = handleAi("brief", post("brief", BRIEF_A), context.deps);
    await tier1.called;
    await vi.advanceTimersByTimeAsync(19_999);
    expect(context.recording.chatCalls()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    const reply = await settle(context, "brief", pending);
    expect(reply.json.path).toMatchObject({ tier: "fast", attempts: 2 });
  });

  it("C-ROUTE-06 three failures are 502 with each tier's failure, no upstream text, and the count raised by one", async () => {
    const context = setup({
      key: [keyAnswer(50)],
      chat: [statusAnswer(503), SCHEMA_ANSWER, throwing],
    });
    const reply = await act(context, "brief", BRIEF_A, {
      cookie: `dyelot_ai=${capValue(TODAY, 1)}`,
    });
    expect(reply.status).toBe(502);
    expect(reply.text).toBe(
      JSON.stringify({
        ok: false,
        code: "all-tiers-failed",
        remaining: 1,
        failures: [
          { tier: "primary", slug: TEXT_SLUGS[0], kind: "http", status: 503 },
          { tier: "fast", slug: TEXT_SLUGS[1], kind: "schema" },
          { tier: "fallback", slug: TEXT_SLUGS[2], kind: "http", status: 0 },
        ],
      }),
    );
    expect(reply.text).not.toContain("upstream");
    expect(reply.text).not.toContain("extra");
    expect(reply.setCookie).toBe(setCookieLine(capValue(TODAY, 2)));
  });

  it("C-ROUTE-06 a failure that read a content keeps it out of the reply", async () => {
    const context = setup({
      key: [keyAnswer(50)],
      chat: [RANGE_ANSWER, RANGE_ANSWER, RANGE_ANSWER],
    });
    const reply = await act(context, "brief", BRIEF_A);
    expect(reply.status).toBe(502);
    expect(reply.text).not.toContain("#ff0000");
    expect((reply.json.failures as { kind: string }[]).map((f) => f.kind)).toEqual([
      "range",
      "range",
      "range",
    ]);
  });
});

describe("C-ROUTE-07 the bounds on one action", () => {
  it("C-ROUTE-07 makes 2 chat calls at most when _FAST is unset", async () => {
    const env = { ...TEST_ENV, OPENROUTER_MODEL_FAST: "" };
    const fail = [statusAnswer(500), statusAnswer(500), statusAnswer(500)];
    const context = setup(
      { key: [keyAnswer(40), keyAnswer(40), keyAnswer(40)], chat: fail },
      { env },
    );
    const reply = await act(context, "brief", BRIEF_A);
    expect(reply.status).toBe(502);
    expect(context.recording.chatCalls()).toHaveLength(2);
    expect((reply.json.failures as { tier: string }[]).map((f) => f.tier)).toEqual([
      "primary",
      "fallback",
    ]);
  });

  it("C-ROUTE-07 never calls a slug twice when two tiers name it", async () => {
    const env = { ...TEST_ENV, OPENROUTER_MODEL_FALLBACK: TEXT_SLUGS[0] };
    const fail = [statusAnswer(500), statusAnswer(500), statusAnswer(500)];
    const context = setup({ key: [keyAnswer(50)], chat: fail }, { env });
    await act(context, "brief", BRIEF_A);
    expect(context.recording.chatCalls()).toHaveLength(2);
  });

  it("C-ROUTE-07 makes at most 3 chat calls and 3 /key reads when every tier fails with re-reads", async () => {
    const fail = [statusAnswer(500), statusAnswer(500), statusAnswer(500)];
    const context = setup({ key: [keyAnswer(40), keyAnswer(40), keyAnswer(40)], chat: fail });
    const reply = await act(context, "brief", BRIEF_A);
    expect(reply.status).toBe(502);
    expect(context.recording.chatCalls()).toHaveLength(3);
    expect(context.recording.keyCalls()).toHaveLength(3);
  });

  it("C-ROUTE-07 sends R4-09's body keys only, never models, provider or require_parameters", async () => {
    const context = setup({ key: [keyAnswer(50)], chat: [statusAnswer(500), BRIEF_OK] });
    await act(context, "brief", BRIEF_A);
    for (const call of context.recording.chatCalls()) {
      expect(Object.keys(JSON.parse(String(call.init.body)))).toEqual([
        "model",
        "messages",
        "response_format",
        "plugins",
        "max_tokens",
        "temperature",
        "usage",
      ]);
    }
  });
});

describe("C-ROUTE-08 vibe and the body caps", () => {
  it("C-ROUTE-08 vibe uses the vision tiers and sends its data URL", async () => {
    const context = setup({ key: [keyAnswer(50)], chat: [statusAnswer(500), outputFor("vibe")] });
    const reply = await act(context, "vibe", INPUTS.vibe);
    expect(reply.json.path).toEqual({
      provider: "shared",
      slug: VISION_SLUGS[1],
      tier: "vision-2",
      attempts: 2,
    });
    const bodies = context.recording.chatCalls().map((call) => JSON.parse(String(call.init.body)));
    expect(bodies.map((body) => body.model)).toEqual([VISION_SLUGS[0], VISION_SLUGS[1]]);
    expect(bodies[0].messages[1].content[1]).toEqual({
      type: "image_url",
      image_url: { url: INPUTS.vibe.image.dataUrl },
    });
  });

  it("C-ROUTE-08 reads a vibe body of exactly 1,572,864 bytes", async () => {
    const context = setup({ key: [keyAnswer(50)], chat: [outputFor("vibe")] });
    const reply = await act(context, "vibe", padded(INPUTS.vibe, 1_572_864));
    expect(reply.status).toBe(200);
  });

  it("C-ROUTE-08 a vibe body of 1,572,865 bytes is 413, by its length or by reading it", async () => {
    const context = setup({});
    const reply = await act(context, "vibe", padded(INPUTS.vibe, 1_572_865));
    expect(reply.status).toBe(413);
    const streamedReply = await settle(
      context,
      "vibe",
      handleAi("vibe", streamed("vibe", 1_572_865), context.deps),
    );
    expect(streamedReply.status).toBe(413);
    expect(context.recording.calls).toEqual([]);
  });

  it("C-ROUTE-08 reads a brief body of exactly 32,768 bytes, and a vibe-sized brief is 413", async () => {
    const context = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] });
    expect((await act(context, "brief", padded(BRIEF_A, 32_768))).status).toBe(200);
    expect((await act(context, "brief", padded(BRIEF_B, 32_769))).status).toBe(413);
    const vibeCap = await act(context, "brief", BRIEF_C, {
      headers: { "content-length": "1572864" },
    });
    expect(vibeCap.status).toBe(413);
  });

  it("C-ROUTE-08 a Content-Length the body does not match is read by its bytes", async () => {
    const context = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] });
    const reply = await act(context, "brief", BRIEF_A, { headers: { "content-length": "nope" } });
    expect(reply.status).toBe(200);
  });
});

describe("C-ROUTE-10 a feature with no tier", () => {
  it("C-ROUTE-10 with no vision variable, vibe is 503 not-configured and brief still answers 200", async () => {
    const env: Record<string, string> = { ...TEST_ENV };
    delete env.OPENROUTER_VISION_MODEL_1;
    delete env.OPENROUTER_VISION_MODEL_2;
    delete env.OPENROUTER_VISION_MODEL_3;
    const context = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] }, { env });
    const vibe = await act(context, "vibe", INPUTS.vibe);
    expect(vibe.status).toBe(503);
    expect(vibe.text).toBe('{"ok":false,"code":"not-configured"}');
    expect(context.recording.calls).toEqual([]);
    expect(context.lines).toEqual([]);
    expect((await act(context, "brief", BRIEF_A)).status).toBe(200);
  });

  it("C-ROUTE-10 with no text variable, the text features are 503 not-configured", async () => {
    const env = {
      ...TEST_ENV,
      OPENROUTER_MODEL_PRIMARY: "",
      OPENROUTER_MODEL_FAST: " ",
      OPENROUTER_MODEL_FALLBACK: "",
    };
    const context = setup({}, { env });
    for (const feature of ["brief", "refine", "rationale", "critique"] as const) {
      const reply = await act(context, feature, INPUTS[feature]);
      expect(reply.json.code, feature).toBe("not-configured");
    }
  });
});

describe("C-ROUTE-11 the log lines", () => {
  it("C-ROUTE-11 no line holds TEST_KEY, TEST_SECRET or a cookie value, whatever the route logs", async () => {
    const badKey = setup({}, { env: { ...TEST_ENV, OPENROUTER_API_KEY: `${TEST_KEY} x` } });
    const cookie = `dyelot_ai=${capValue(TODAY, 1)}`;
    await act(badKey, "brief", BRIEF_A, { cookie });
    const badSecret = setup(
      {},
      { env: { ...TEST_ENV, DYELOT_COOKIE_SECRET: TEST_SECRET.slice(4) } },
    );
    await act(badSecret, "brief", BRIEF_A, { cookie });
    const lines = [...badKey.lines, ...badSecret.lines];
    expect(lines).toEqual([
      "dyelot ai: OPENROUTER_API_KEY is missing or invalid.",
      "dyelot ai: DYELOT_COOKIE_SECRET is missing or invalid.",
    ]);
  });

  it("C-ROUTE-11 a partial Langfuse set logs its variable once, by name, and the action still answers", async () => {
    const env = { ...TEST_ENV, LANGFUSE_PUBLIC_KEY: "pk-lf-visible-value" };
    const context = setup(
      { key: [keyAnswer(50), keyAnswer(50)], chat: [BRIEF_OK, BRIEF_OK] },
      { env },
    );
    expect((await act(context, "brief", BRIEF_A)).status).toBe(200);
    expect((await act(context, "brief", BRIEF_B)).status).toBe(200);
    expect(context.lines).toEqual([
      "dyelot ai: LANGFUSE_SECRET_KEY is missing or invalid, so tracing is off.",
    ]);
    expect(context.lines.join("\n")).not.toContain("pk-lf-visible-value");
  });
});

describe("C-ROUTE-12 handleAi's wiring", () => {
  it.each(["fetch", "now", "cache", "gate"] as const)(
    "C-ROUTE-12 deps missing %s throws TypeError naming handleAi",
    async (name) => {
      const context = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] });
      const deps = { ...context.deps } as Record<string, unknown>;
      delete deps[name];
      await expect(handleAi("brief", post("brief", BRIEF_A), deps as AiDeps)).rejects.toThrow(
        TypeError,
      );
      await expect(handleAi("brief", post("brief", BRIEF_A), deps as AiDeps)).rejects.toThrow(
        new RegExp(`^handleAi: deps\\.${name} `),
      );
      expect(context.recording.calls).toEqual([]);
    },
  );

  it.each(["env", "tracerFor", "after", "log", "siteOrigin"] as const)(
    "C-ROUTE-12 deps missing %s throws TypeError naming handleAi",
    async (name) => {
      const deps = { ...setup({}).deps } as Record<string, unknown>;
      delete deps[name];
      await expect(handleAi("brief", post("brief", BRIEF_A), deps as AiDeps)).rejects.toThrow(
        new RegExp(`^handleAi: deps\\.${name} `),
      );
    },
  );

  it("C-ROUTE-12 refuses deps, a feature and a request of the wrong type, and a site origin that is not one", async () => {
    const { deps } = setup({});
    await expect(handleAi("brief", post("brief", BRIEF_A), null as never)).rejects.toThrow(
      /^handleAi: deps must be an object/,
    );
    await expect(handleAi(5 as never, post("brief", BRIEF_A), deps)).rejects.toThrow(
      /^handleAi: feature must be a string/,
    );
    await expect(handleAi("brief", {} as never, deps)).rejects.toThrow(
      /^handleAi: request must be a Request/,
    );
    await expect(
      handleAi("brief", post("brief", BRIEF_A), {
        ...deps,
        cache: { get: () => undefined } as never,
      }),
    ).rejects.toThrow(/^handleAi: deps\.cache /);
    await expect(
      handleAi("brief", post("brief", BRIEF_A), { ...deps, gate: {} as never }),
    ).rejects.toThrow(/^handleAi: deps\.gate /);
    await expect(
      handleAi("brief", post("brief", BRIEF_A), { ...deps, siteOrigin: "https://x.test/path" }),
    ).rejects.toThrow(RangeError);
    await expect(
      handleAi("brief", post("brief", BRIEF_A), { ...deps, now: () => Number.NaN }),
    ).rejects.toThrow(/^handleAi: deps\.now\(\) /);
  });
});

/** A gate that counts the releases each request it let in called. */
function countingGate(): { gate: CascadeGate; releases: number[]; handed: (() => void)[] } {
  const inner = createCascadeGate();
  const releases: number[] = [];
  const handed: (() => void)[] = [];
  return {
    releases,
    handed,
    gate: {
      enter() {
        const release = inner.enter();
        if (release === null) return null;
        const index = releases.push(0) - 1;
        const counted = () => {
          releases[index] = (releases[index] ?? 0) + 1;
          release();
        };
        handed.push(counted);
        return counted;
      },
    },
  };
}

describe("C-ROUTE-13 the cascade gate", () => {
  it("C-ROUTE-13 a second brief started while the first's fetch is held answers 503 busy with remaining and no fetch, and so does a third", async () => {
    const hold = held();
    const context = setup({ key: [keyAnswer(50), keyAnswer(50)], chat: [hold.answer, BRIEF_OK] });
    const first = handleAi("brief", post("brief", BRIEF_A), context.deps);
    const call = await hold.called;
    const calls = context.recording.calls.length;
    const cookie = `dyelot_ai=${capValue(TODAY, 1)}`;
    const second = await act(context, "brief", BRIEF_B, { cookie });
    expect(second.status).toBe(503);
    expect(second.text).toBe('{"ok":false,"code":"busy","remaining":2}');
    expect(second.setCookie).toBeNull();
    const third = await act(context, "brief", BRIEF_C);
    expect(third.text).toBe('{"ok":false,"code":"busy","remaining":3}');
    expect(context.recording.calls.length).toBe(calls);
    hold.release(await BRIEF_OK(call));
    expect((await settle(context, "brief", first)).status).toBe(200);
    expect((await act(context, "brief", BRIEF_D)).status).toBe(200);
  });

  it("C-ROUTE-13 a brief cached before still answers 200 while the gate is held", async () => {
    const hold = held();
    const context = setup({ key: [keyAnswer(50), keyAnswer(50)], chat: [BRIEF_OK, hold.answer] });
    await act(context, "brief", BRIEF_A);
    const from = context.recording.calls.length;
    const pending = handleAi("brief", post("brief", BRIEF_B), context.deps);
    const call = await hold.called;
    const hit = await act(context, "brief", BRIEF_A);
    expect(hit.status).toBe(200);
    expect(hit.setCookie).toBeNull();
    hold.release(await BRIEF_OK(call));
    expect((await settle(context, "brief", pending, {}, from)).status).toBe(200);
  });

  /** One scenario that ends an action, then the request that must find the gate open. */
  const ENDINGS: ReadonlyArray<readonly [string, Parameters<typeof recordingFetch>[0], number]> = [
    ["a success", { key: [keyAnswer(50)], chat: [BRIEF_OK] }, 200],
    [
      "a 502",
      { key: [keyAnswer(50)], chat: [statusAnswer(500), statusAnswer(500), statusAnswer(500)] },
      502,
    ],
    ["a first-read pool-low", { key: [keyAnswer(37)] }, 503],
    ["a first-read guard-unavailable", { key: [statusAnswer(500)] }, 503],
    [
      "a refusal by a re-read",
      { key: [keyAnswer(40), keyAnswer(37)], chat: [statusAnswer(500)] },
      503,
    ],
    ["a fetch that throws", { key: [throwing] }, 503],
    [
      "a chat fetch that throws",
      { key: [keyAnswer(50)], chat: [throwing, throwing, throwing] },
      502,
    ],
  ];

  it.each(ENDINGS)(
    "C-ROUTE-13 the gate opens after %s, released once",
    async (_, script, status) => {
      const counting = countingGate();
      const context = setup(script, { gate: counting.gate });
      expect((await act(context, "brief", BRIEF_A)).status).toBe(status);
      expect(counting.releases).toEqual([1]);
      const next = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] }, { gate: counting.gate });
      expect((await act(next, "brief", BRIEF_B)).status).toBe(200);
      expect(counting.releases).toEqual([1, 1]);
    },
  );

  it("C-ROUTE-13 the gate opens after an aborted request.signal", async () => {
    const counting = countingGate();
    const controller = new AbortController();
    const tier1 = watched(abortable);
    const context = setup({ key: [keyAnswer(50)], chat: [tier1.answer] }, { gate: counting.gate });
    const pending = handleAi(
      "brief",
      post("brief", BRIEF_A, { signal: controller.signal }),
      context.deps,
    );
    await tier1.called;
    controller.abort();
    await settle(context, "brief", pending);
    expect(counting.releases).toEqual([1]);
    expect(counting.gate.enter()).not.toBeNull();
  });

  it("C-ROUTE-13 the gate opens after a thrown error, which still reaches the caller", async () => {
    const counting = countingGate();
    const broken = createAiCache({ now: () => NOW });
    const cache = {
      get: broken.get,
      size: broken.size,
      set: () => {
        throw new TypeError("AiCache.set: broken for this test");
      },
    };
    const context = setup(
      { key: [keyAnswer(50)], chat: [BRIEF_OK] },
      { gate: counting.gate, cache },
    );
    await expect(handleAi("brief", post("brief", BRIEF_A), context.deps)).rejects.toThrow(
      "AiCache.set: broken for this test",
    );
    expect(counting.releases).toEqual([1]);
    expect(counting.gate.enter()).not.toBeNull();
  });

  it("C-ROUTE-13 a busy request releases nothing, and a second call of a release changes nothing", async () => {
    const counting = countingGate();
    const hold = held();
    const context = setup(
      { key: [keyAnswer(50), keyAnswer(50)], chat: [BRIEF_OK, hold.answer] },
      { gate: counting.gate },
    );
    await act(context, "brief", BRIEF_A);
    const stale = counting.handed[0] as () => void;
    const from = context.recording.calls.length;
    const pending = handleAi("brief", post("brief", BRIEF_B), context.deps);
    const call = await hold.called;
    expect((await act(context, "brief", BRIEF_C)).json.code).toBe("busy");
    stale();
    expect((await act(context, "brief", BRIEF_D)).json.code).toBe("busy");
    expect(counting.releases).toEqual([2, 0]);
    hold.release(await BRIEF_OK(call));
    expect((await settle(context, "brief", pending, {}, from)).status).toBe(200);
    expect(counting.releases).toEqual([2, 1]);
  });
});

describe("C-ROUTE-14 the re-reads of R4-17 (c)", () => {
  it("C-ROUTE-14 a first read of 41 makes no re-read", async () => {
    const context = setup({
      key: [keyAnswer(41)],
      chat: [statusAnswer(500), statusAnswer(500), BRIEF_OK],
    });
    const reply = await act(context, "brief", BRIEF_A);
    expect(reply.json.path).toMatchObject({ tier: "fallback", attempts: 3 });
    expect(context.recording.keyCalls()).toHaveLength(1);
  });

  it("C-ROUTE-14 a first read of 40 with tier 1 failing re-reads /key before tier 2, and a re-read of 37 answers 503 pool-low", async () => {
    const context = setup({ key: [keyAnswer(40), keyAnswer(37)], chat: [statusAnswer(500)] });
    const reply = await act(context, "brief", BRIEF_A, {
      cookie: `dyelot_ai=${capValue(TODAY, 1)}`,
    });
    expect(reply.status).toBe(503);
    expect(reply.text).toBe(
      JSON.stringify({
        ok: false,
        code: "pool-low",
        remaining: 1,
        failures: [{ tier: "primary", slug: TEXT_SLUGS[0], kind: "http", status: 500 }],
      }),
    );
    expect(reply.setCookie).toBe(setCookieLine(capValue(TODAY, 2)));
    expect(context.recording.calls.map((call) => call.url)).toEqual([
      `${BASE}/key`,
      `${BASE}/chat/completions`,
      `${BASE}/key`,
    ]);
  });

  it("C-ROUTE-14 a re-read of 39 runs tier 2, and re-reads again before tier 3", async () => {
    const context = setup({
      key: [keyAnswer(40), keyAnswer(39), keyAnswer(38)],
      chat: [statusAnswer(500), statusAnswer(500), BRIEF_OK],
    });
    const reply = await act(context, "brief", BRIEF_A);
    expect(reply.json.path).toMatchObject({ tier: "fallback", attempts: 3 });
    expect(context.recording.calls.map((call) => call.url.slice(BASE.length))).toEqual([
      "/key",
      "/chat/completions",
      "/key",
      "/chat/completions",
      "/key",
      "/chat/completions",
    ]);
  });

  it("C-ROUTE-14 a success at tier 1 makes no re-read", async () => {
    const context = setup({ key: [keyAnswer(38)], chat: [BRIEF_OK] });
    expect((await act(context, "brief", BRIEF_A)).status).toBe(200);
    expect(context.recording.keyCalls()).toHaveLength(1);
  });

  it("C-ROUTE-14 a re-read that times out at 2,000 ms answers 503 guard-unavailable the same way", async () => {
    vi.useFakeTimers();
    const reread = watched(never);
    const context = setup({
      key: [keyAnswer(40), reread.answer],
      chat: [statusAnswer(500), BRIEF_OK],
    });
    const pending = handleAi("brief", post("brief", BRIEF_A), context.deps);
    await reread.called;
    await vi.advanceTimersByTimeAsync(1999);
    expect(await settled(pending)).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const reply = await settle(context, "brief", pending);
    expect(reply.status).toBe(503);
    expect(reply.text).toBe(
      JSON.stringify({
        ok: false,
        code: "guard-unavailable",
        remaining: 2,
        failures: [{ tier: "primary", slug: TEXT_SLUGS[0], kind: "http", status: 500 }],
      }),
    );
    expect(reply.setCookie).toBe(setCookieLine(capValue(TODAY, 1)));
    expect(context.recording.chatCalls()).toHaveLength(1);
  });

  it("C-ROUTE-14 a re-read refused before tier 3 lists both tiers tried", async () => {
    const context = setup({
      key: [keyAnswer(40), keyAnswer(39), statusAnswer(500)],
      chat: [statusAnswer(500), chatAnswer("")],
    });
    const reply = await act(context, "brief", BRIEF_A);
    expect(reply.json).toEqual({
      ok: false,
      code: "guard-unavailable",
      remaining: 2,
      failures: [
        { tier: "primary", slug: TEXT_SLUGS[0], kind: "http", status: 500 },
        { tier: "fast", slug: TEXT_SLUGS[1], kind: "empty" },
      ],
    });
  });
});

describe("C-ROUTE-15 one reading of the clock", () => {
  it("C-ROUTE-15 an action that starts at 23:59:59 signs 2026-11-05 with Max-Age=1, though now says 00:00:01 after", async () => {
    const start = Date.UTC(2026, 10, 5, 23, 59, 59);
    const later = Date.UTC(2026, 10, 6, 0, 0, 1);
    let reads = 0;
    const now = () => (reads++ === 0 ? start : later);
    const context = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] }, { now });
    const reply = await act(context, "brief", BRIEF_A);
    expect(reply.setCookie).toBe(setCookieLine(capValue("2026-11-05", 1), 1));
    expect(reads).toBe(1);
  });

  it("C-ROUTE-15 a cookie from the day the action started counts", async () => {
    const start = Date.UTC(2026, 10, 5, 23, 59, 59);
    let reads = 0;
    const now = () => (reads++ === 0 ? start : start + 2000);
    const context = setup({}, { now });
    const reply = await act(context, "brief", BRIEF_A, {
      cookie: `dyelot_ai=${capValue("2026-11-05", 3)}`,
    });
    expect(reply.status).toBe(429);
  });
});

describe("C-ROUTE-16 a visitor's cancel", () => {
  it("C-ROUTE-16 an abort while tier 1 waits stops the cascade: no later tier, nothing cached, the gate open, the count raised by one", async () => {
    const controller = new AbortController();
    const tier1 = watched(abortable);
    const context = setup({ key: [keyAnswer(50)], chat: [tier1.answer, BRIEF_OK, BRIEF_OK] });
    const pending = handleAi(
      "brief",
      post("brief", BRIEF_A, { signal: controller.signal }),
      context.deps,
    );
    const call = await tier1.called;
    expect(call.init.signal?.aborted).toBe(false);
    controller.abort();
    expect(call.init.signal?.aborted).toBe(true);
    const reply = await settle(context, "brief", pending);
    expect(context.recording.chatCalls()).toHaveLength(1);
    expect(context.deps.cache.size()).toBe(0);
    expect(reply.setCookie).toBe(setCookieLine(capValue(TODAY, 1)));
    expect(reply.json).toEqual({
      ok: false,
      code: "all-tiers-failed",
      remaining: 2,
      failures: [{ tier: "primary", slug: TEXT_SLUGS[0], kind: "http", status: 0 }],
    });
    expect(context.deps.gate.enter()).not.toBeNull();
  });

  it("C-ROUTE-16 passes request.signal to the /key read too: an abort there reads as guard-unavailable, uncounted", async () => {
    const controller = new AbortController();
    const key = watched(abortable);
    const context = setup({ key: [key.answer] });
    const pending = handleAi(
      "brief",
      post("brief", BRIEF_A, { signal: controller.signal }),
      context.deps,
    );
    const call = await key.called;
    controller.abort();
    expect(call.init.signal?.aborted).toBe(true);
    const reply = await settle(context, "brief", pending);
    expect(reply.json.code).toBe("guard-unavailable");
    expect(reply.setCookie).toBeNull();
  });

  it("C-ROUTE-16 an abort during a re-read stops before tier 2", async () => {
    const controller = new AbortController();
    const reread = watched(abortable);
    const context = setup({
      key: [keyAnswer(40), reread.answer],
      chat: [statusAnswer(500), BRIEF_OK],
    });
    const pending = handleAi(
      "brief",
      post("brief", BRIEF_A, { signal: controller.signal }),
      context.deps,
    );
    await reread.called;
    controller.abort();
    const reply = await settle(context, "brief", pending);
    expect(context.recording.chatCalls()).toHaveLength(1);
    expect(reply.setCookie).toBe(setCookieLine(capValue(TODAY, 1)));
  });
});

describe("C-ROUTE-RF5 quota edges", () => {
  it("C-ROUTE-RF5 four actions in a row, each sending the cookie the last reply set, give remaining 2, 1, 0 and then 429", async () => {
    const context = setup({
      key: [keyAnswer(50), keyAnswer(49), keyAnswer(48)],
      chat: [BRIEF_OK, BRIEF_OK, BRIEF_OK],
    });
    let cookie: string | undefined;
    const remaining: unknown[] = [];
    for (const brief of [BRIEF_A, BRIEF_B, BRIEF_C, BRIEF_D]) {
      const reply = await act(context, "brief", brief, cookie === undefined ? {} : { cookie });
      remaining.push(reply.status === 429 ? 429 : reply.json.remaining);
      if (reply.setCookie !== null) cookie = cookieOf(reply.setCookie);
    }
    expect(remaining).toEqual([2, 1, 0, 429]);
  });

  it("C-ROUTE-RF5 a second action started while the first is held answers 503 busy with no fetch and proceeds once the first ends", async () => {
    const hold = held();
    const context = setup({ key: [keyAnswer(50), keyAnswer(49)], chat: [hold.answer, BRIEF_OK] });
    const first = handleAi("brief", post("brief", BRIEF_A), context.deps);
    const call = await hold.called;
    const before = context.recording.calls.length;
    expect((await act(context, "brief", BRIEF_E)).json.code).toBe("busy");
    expect(context.recording.calls.length).toBe(before);
    hold.release(await BRIEF_OK(call));
    expect((await settle(context, "brief", first)).status).toBe(200);
    expect((await act(context, "brief", BRIEF_E)).status).toBe(200);
  });

  it("C-ROUTE-RF5 yesterday's count-3 cookie starts again at 0", async () => {
    const context = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] });
    const reply = await act(context, "brief", BRIEF_A, {
      cookie: `dyelot_ai=${capValue(YESTERDAY, 3)}`,
    });
    expect(reply.json.remaining).toBe(2);
  });

  it("C-ROUTE-RF5 a request with no Origin is 403, and a failing /key is 503", async () => {
    const context = setup({ key: [statusAnswer(500)] });
    expect((await act(context, "brief", BRIEF_A, { origin: null })).status).toBe(403);
    expect((await act(context, "brief", BRIEF_A)).json.code).toBe("guard-unavailable");
  });

  it("C-ROUTE-RF5 every reply is a JSON body of 11.1, as the client's reader reads it", async () => {
    const context = setup({ key: [keyAnswer(50)], chat: [BRIEF_OK] });
    const replies = [
      await act(context, "poem", BRIEF_A),
      await act(context, "brief", BRIEF_A, { origin: null }),
      await act(context, "brief", "{"),
      await act(context, "brief", BRIEF_A, { cookie: `dyelot_ai=${capValue(TODAY, 3)}` }),
      await act(context, "brief", BRIEF_A),
      await act(context, "brief", BRIEF_A),
    ];
    const codes = replies.map((reply) => {
      const reader = readRouteReply("brief", reply.status, reply.json);
      return reader.ok ? "ok" : reader.code;
    });
    expect(codes).toEqual([
      "unknown-feature",
      "forbidden-origin",
      "bad-request",
      "visitor-cap",
      "ok",
      "ok",
    ]);
  });
});
