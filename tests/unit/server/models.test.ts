import { afterEach, describe, expect, it, vi } from "vitest";
import { handleModels } from "@/server/ai/handle";
import { TEST_ENV, TEXT_SLUGS, VISION_SLUGS } from "../ai/fixtures";
import { API_POLICY } from "./support";

// C-ROUTE-09 of docs/specs/04-ai.md, section 14.7: `GET /api/ai/models` (R4-21) answers the slugs
// from the slug variables alone, calls nothing and reads no secret.

afterEach(() => {
  vi.restoreAllMocks();
});

/** handleModels's deps: the environment and a log that records its lines. */
function depsOf(env: Readonly<Record<string, string | undefined>>) {
  const lines: string[] = [];
  return { deps: { env, log: (line: string) => void lines.push(line) }, lines };
}

/** R4-24's three headers. */
function expectHeaders(response: Response): void {
  expect(response.headers.get("content-type")).toBe("application/json");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("content-security-policy")).toBe(API_POLICY);
}

describe("C-ROUTE-09 handleModels", () => {
  it("C-ROUTE-09 answers 200 { text: TEXT_SLUGS, vision: VISION_SLUGS } with no-store and no fetch", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const { deps, lines } = depsOf(TEST_ENV);
    const response = handleModels(deps);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(JSON.stringify({ text: TEXT_SLUGS, vision: VISION_SLUGS }));
    expectHeaders(response);
    expect(fetch).not.toHaveBeenCalled();
    expect(lines).toEqual([]);
  });

  it("C-ROUTE-09 answers the same with OPENROUTER_API_KEY and the cookie secret unset", async () => {
    const { OPENROUTER_API_KEY, DYELOT_COOKIE_SECRET, ...slugs } = TEST_ENV;
    const response = handleModels(depsOf(slugs).deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ text: TEXT_SLUGS, vision: VISION_SLUGS });
    expect(OPENROUTER_API_KEY).toBeDefined();
    expect(DYELOT_COOKIE_SECRET).toBeDefined();
  });

  it("C-ROUTE-09 skips an unset tier and gives an empty list for a group with none", async () => {
    const response = handleModels(
      depsOf({
        OPENROUTER_MODEL_PRIMARY: TEXT_SLUGS[0],
        OPENROUTER_MODEL_FAST: "",
        OPENROUTER_MODEL_FALLBACK: TEXT_SLUGS[2],
      }).deps,
    );
    expect(await response.json()).toEqual({ text: [TEXT_SLUGS[0], TEXT_SLUGS[2]], vision: [] });
  });

  it("C-ROUTE-09 a bad slug is 503 not-configured, logged once by name and never by value", async () => {
    const { deps, lines } = depsOf({ ...TEST_ENV, OPENROUTER_VISION_MODEL_2: "Test/Vision:free" });
    for (let i = 0; i < 2; i += 1) {
      const response = handleModels(deps);
      expect(response.status).toBe(503);
      expect(await response.text()).toBe('{"ok":false,"code":"not-configured"}');
      expectHeaders(response);
    }
    expect(lines).toEqual(["dyelot ai: OPENROUTER_VISION_MODEL_2 is missing or invalid."]);
  });

  it("C-ROUTE-09 refuses deps of the wrong type, naming itself", () => {
    expect(() => handleModels(null as never)).toThrow(TypeError);
    expect(() => handleModels(null as never)).toThrow(/^handleModels: deps /);
    expect(() => handleModels({ env: TEST_ENV } as never)).toThrow(/^handleModels: deps\.log /);
    expect(() => handleModels({ env: null, log: () => {} } as never)).toThrow(
      /^handleModels: deps\.env /,
    );
  });
});
