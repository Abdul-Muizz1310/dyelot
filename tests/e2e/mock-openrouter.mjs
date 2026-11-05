// @ts-check
// The local mock of OpenRouter for the end-to-end run (docs/specs/04-ai.md, R4-58 and section 4):
// plain node:http, no msw, started by playwright.config.ts as the first web server on 127.0.0.1:3199.
// The e2e app server's OPENROUTER_BASE_URL points here, so the shared route's `/key` reads and chat
// calls reach this file and never the network.
//
// It serves OpenRouter's three paths under /api/v1 and four test paths:
// - `GET /api/v1/key` answers the free pool's `remaining` 50;
// - `POST /api/v1/chat/completions` answers by the scenario. It reads the feature from the keys of
//   the user message's JSON (for vibe, its text part) and replies `{ choices: [{ message: { content } }],
//   usage }` with that feature's output from tests/fixtures/ai/outputs.json, which the unit tests read
//   too; for a vibe input of one cluster the roles leave out `secondary`. Tier 1 is a request whose
//   `model` is `test/text-1:free` or `test/vision-1:free`;
// - `POST /api/v1/auth/keys` answers the PKCE exchange with a made-up key;
// - `POST /__scenario { name }` sets the scenario, answers every reply `hold` held, clears the log,
//   and replies once the held replies are written;
// - `POST /__release` answers every held reply;
// - `GET /__log` lists the requests to /api/v1 since the scenario was set, in order, each `open`
//   until the mock has written its reply (`answered`, with the status) or the caller hung up first
//   (`closed`), a chat request with its model, feature and system message.
//
// The scenarios (section 4): `ok` answers every tier; `tier1-500` answers tier 1 with 500;
// `tier1-color` gives tier 1 a rationale whose thesis holds `#ff0000`; `all-fail` answers every tier
// with 503; `hold` keeps each chat reply until `/__release` or the next `/__scenario`. `/key` answers
// in every scenario. Nothing here is a secret: the test key and secret are made up (section 4).

import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const HOST = "127.0.0.1";
const PORT = 3199;
/** Section 4's five outputs: brief, refine, vibe, rationale and critique. */
const OUTPUTS = JSON.parse(
  readFileSync(new URL("../fixtures/ai/outputs.json", import.meta.url), "utf8"),
);
/** The models a tier 1 call names: the first of section 4's TEXT_SLUGS and VISION_SLUGS. */
const TIER_1 = new Set(["test/text-1:free", "test/vision-1:free"]);
const SCENARIOS = new Set(["ok", "tier1-500", "tier1-color", "all-fail", "hold"]);
/** The free pool's requests left, as `/key` reports them. */
const REMAINING = 50;
/** The most bytes of a request body read: a vibe call carries a JPEG of up to 1 MiB in base64. */
const BODY_MAX = 4 * 1024 * 1024;
/** tier1-color's thesis: a color literal, which the route's output check refuses (R4-38). */
const COLOR_THESIS = "Calm and exact, with #ff0000 for alerts.";
const USAGE = Object.freeze({
  prompt_tokens: 120,
  completion_tokens: 60,
  total_tokens: 180,
  cost: 0,
});
/** The key the PKCE exchange answers with: made up, never a real one. */
const EXCHANGED_KEY = "sk-or-v1-mock-0123456789abcdef0123456789abcdef";

/**
 * @typedef {{
 *   method: string;
 *   path: string;
 *   state: "open" | "answered" | "closed";
 *   status: number | null;
 *   model?: string;
 *   feature?: string | null;
 *   system?: string;
 * }} Entry
 */

let scenario = "ok";
/** @type {Entry[]} The requests to /api/v1 since the scenario was set. */
let log = [];
/** @type {Array<() => Promise<boolean>>} The held chat replies; each writes its reply when called. */
let held = [];

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

/** OpenRouter's error body. @param {number} code @param {string} message */
const failure = (code, message) => ({ error: { code, message } });

/**
 * Writes a JSON reply unless the caller has hung up; resolves once it is written or the connection
 * is gone, with whether it was written.
 * @param {import("node:http").ServerResponse} res
 * @param {Entry | null} entry
 * @param {number} status
 * @param {unknown} body
 * @returns {Promise<boolean>}
 */
function answer(res, entry, status, body) {
  if (res.destroyed || res.writableEnded) return Promise.resolve(false);
  if (entry !== null) entry.status = status;
  return new Promise((resolve) => {
    res.once("close", () => resolve(res.writableFinished));
    res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body), () => resolve(true));
  });
}

/**
 * The body as text, or null when it passes `BODY_MAX`.
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<string | null>}
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size <= BODY_MAX) chunks.push(chunk);
    });
    req.on("end", () => resolve(size > BODY_MAX ? null : Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** @param {string} text */
function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** The message of `role`'s content, as a chat body holds it. @param {unknown} body @param {string} role */
function contentOf(body, role) {
  if (!isRecord(body) || !Array.isArray(body.messages)) return undefined;
  const message = body.messages.find((item) => isRecord(item) && item.role === role);
  return isRecord(message) ? message.content : undefined;
}

/**
 * The user message's JSON: its text, or for vibe its text part (the image is the other part).
 * @param {unknown} body
 */
function userInput(body) {
  const content = contentOf(body, "user");
  if (typeof content === "string") return parseJson(content);
  if (!Array.isArray(content)) return undefined;
  const part = content.find((item) => isRecord(item) && item.type === "text");
  return isRecord(part) && typeof part.text === "string" ? parseJson(part.text) : undefined;
}

/**
 * The feature an input's keys name (section 5.2's input shapes), or null.
 * @param {unknown} input
 */
function featureOf(input) {
  if (!isRecord(input)) return null;
  if ("brief" in input && "locked" in input) return "brief";
  if ("text" in input && "current" in input) return "refine";
  if ("clusters" in input && Array.isArray(input.clusters)) return "vibe";
  if ("families" in input && "checks" in input) return "rationale";
  if ("findings" in input) return "critique";
  return null;
}

/**
 * The output a tier answers: the feature's from outputs.json, with vibe's roles fitted to one
 * cluster and tier1-color's thesis on tier 1.
 * @param {string} feature
 * @param {Record<string, unknown>} input
 * @param {boolean} tier1
 */
function outputFor(feature, input, tier1) {
  if (feature === "vibe" && Array.isArray(input.clusters) && input.clusters.length === 1) {
    const { secondary: _secondary, ...roleMap } = OUTPUTS.vibe.roleMap;
    return { ...OUTPUTS.vibe, roleMap };
  }
  if (feature === "rationale" && tier1 && scenario === "tier1-color") {
    return { ...OUTPUTS.rationale, thesis: COLOR_THESIS };
  }
  return OUTPUTS[feature];
}

/** Whether the call carries a bearer key, as OpenRouter requires. @param {import("node:http").IncomingMessage} req */
const authorized = (req) => /^Bearer \S+$/.test(req.headers.authorization ?? "");

/**
 * `POST /api/v1/chat/completions` by the scenario.
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {Entry} entry
 */
async function chat(req, res, entry) {
  const text = await readBody(req);
  if (text === null) return answer(res, entry, 413, failure(413, "The body is too large."));
  const body = parseJson(text);
  const system = contentOf(body, "system");
  const input = userInput(body);
  const feature = featureOf(input);
  const model = isRecord(body) && typeof body.model === "string" ? body.model : "";
  entry.model = model;
  entry.feature = feature;
  entry.system = typeof system === "string" ? system : "";
  if (!authorized(req)) return answer(res, entry, 401, failure(401, "No auth credentials found."));
  if (feature === null || !isRecord(input)) {
    return answer(res, entry, 400, failure(400, "No feature in the user message."));
  }
  const tier1 = TIER_1.has(model);
  if (scenario === "all-fail") return answer(res, entry, 503, failure(503, "No provider."));
  if (scenario === "tier1-500" && tier1) {
    return answer(res, entry, 500, failure(500, "Internal error."));
  }
  const reply = {
    choices: [{ message: { content: JSON.stringify(outputFor(feature, input, tier1)) } }],
    usage: USAGE,
  };
  if (scenario === "hold") {
    held.push(() => answer(res, entry, 200, reply));
    return;
  }
  return answer(res, entry, 200, reply);
}

/** Writes every held reply; resolves with how many reached a caller still there. */
async function releaseHeld() {
  const replies = held;
  held = [];
  const written = await Promise.all(replies.map((write) => write()));
  return written.filter(Boolean).length;
}

/**
 * The test paths: the scenario, the release and the log.
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {string} path
 */
async function control(req, res, path) {
  if (path === "/__log" && req.method === "GET") {
    return answer(res, null, 200, { scenario, requests: log });
  }
  if (path === "/__release" && req.method === "POST") {
    return answer(res, null, 200, { released: await releaseHeld() });
  }
  if (path === "/__scenario" && req.method === "POST") {
    const text = await readBody(req);
    const body = text === null ? undefined : parseJson(text);
    const name = isRecord(body) ? body.name : undefined;
    if (typeof name !== "string" || !SCENARIOS.has(name)) {
      return answer(res, null, 400, failure(400, `Unknown scenario ${JSON.stringify(name)}.`));
    }
    const released = await releaseHeld();
    scenario = name;
    log = [];
    return answer(res, null, 200, { scenario, released });
  }
  return answer(res, null, 404, failure(404, "Not found."));
}

/**
 * OpenRouter's three paths, each logged from the moment it arrives.
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @param {string} path
 */
async function openRouter(req, res, path) {
  /** @type {Entry} */
  const entry = { method: req.method ?? "", path, state: "open", status: null };
  log.push(entry);
  res.once("finish", () => {
    entry.state = "answered";
  });
  res.once("close", () => {
    if (!res.writableFinished) entry.state = "closed";
  });
  if (path === "/api/v1/key" && req.method === "GET") {
    if (!authorized(req)) {
      return answer(res, entry, 401, failure(401, "No auth credentials found."));
    }
    return answer(res, entry, 200, {
      data: { free_model_daily_requests: { used: 0, remaining: REMAINING } },
    });
  }
  if (path === "/api/v1/chat/completions" && req.method === "POST") return chat(req, res, entry);
  if (path === "/api/v1/auth/keys" && req.method === "POST") {
    const text = await readBody(req);
    const body = text === null ? undefined : parseJson(text);
    const complete =
      isRecord(body) &&
      typeof body.code === "string" &&
      typeof body.code_verifier === "string" &&
      body.code_challenge_method === "S256";
    if (!complete) return answer(res, entry, 400, failure(400, "Invalid code exchange."));
    return answer(res, entry, 200, { key: EXCHANGED_KEY });
  }
  return answer(res, entry, 404, failure(404, "Not found."));
}

const server = createServer((req, res) => {
  const path = new URL(req.url ?? "/", `http://${HOST}`).pathname;
  const handle = path.startsWith("/__") ? control(req, res, path) : openRouter(req, res, path);
  handle.catch(() => {
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify(failure(500, "The mock failed.")));
  });
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`mock OpenRouter on http://${HOST}:${PORT}\n`);
});
