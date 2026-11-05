import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { type EnvSource, readAiEnv, readSlugs } from "@/server/ai/env";
import { TEST_ENV, TEST_KEY, TEST_SECRET, TEXT_SLUGS, VISION_SLUGS } from "../ai/fixtures";

// C-ENV-01 to 04 of docs/specs/04-ai.md, section 14.7: the environment read at the boundary (R4-20,
// section 11.4). Every value here is made up; no test reads the real environment.

const TEXT = [
  { tier: "primary", slug: TEXT_SLUGS[0] },
  { tier: "fast", slug: TEXT_SLUGS[1] },
  { tier: "fallback", slug: TEXT_SLUGS[2] },
];
const VISION = [
  { tier: "vision-1", slug: VISION_SLUGS[0] },
  { tier: "vision-2", slug: VISION_SLUGS[1] },
  { tier: "vision-3", slug: VISION_SLUGS[2] },
];
const SECRET_BYTES = Uint8Array.from({ length: 32 }, (_, i) => i);
const OPENROUTER = "https://openrouter.ai/api/v1";
const TRIO = {
  LANGFUSE_PUBLIC_KEY: "pk-lf-test-public",
  LANGFUSE_SECRET_KEY: "sk-lf-test-secret",
  LANGFUSE_BASE_URL: "https://us.cloud.langfuse.com",
};

/** TEST_ENV with some variables changed, and those set to `undefined` removed. */
function envWith(changes: Readonly<Record<string, string | undefined>>): EnvSource {
  const source: Record<string, string | undefined> = { ...TEST_ENV, ...changes };
  for (const [name, value] of Object.entries(changes)) {
    if (value === undefined) delete source[name];
  }
  return source;
}

/** The parsed environment of `source`, failing the test when it is not valid. */
function envOf(source: EnvSource) {
  const result = readAiEnv(source);
  if (!result.ok) throw new Error(`expected a valid environment, ${result.variable} was refused`);
  return result.env;
}

describe("C-ENV-01 readAiEnv reads TEST_ENV and its defaults", () => {
  it("C-ENV-01 gives the key, the 32 secret bytes, reserve 35, the base URL and the six tiers", () => {
    const result = readAiEnv(TEST_ENV);
    expect(result.ok).toBe(true);
    const env = envOf(TEST_ENV);
    expect(env.apiKey).toBe(TEST_KEY);
    expect(env.cookieSecret).toBeInstanceOf(Uint8Array);
    expect(env.cookieSecret).toEqual(SECRET_BYTES);
    expect(env.reserve).toBe(35);
    expect(env.baseUrl).toBe("http://127.0.0.1:3199/api/v1");
    expect(env.text).toEqual(TEXT);
    expect(env.vision).toEqual(VISION);
    expect(env.tracing).toBeNull();
    expect(env.tracingProblem).toBeNull();
  });

  it("C-ENV-01 gives the reserve 35 when it is unset, empty or white space", () => {
    for (const value of [undefined, "", "  ", "\r\n"]) {
      expect(envOf(envWith({ DYELOT_AI_RESERVE: value })).reserve, String(value)).toBe(35);
    }
  });

  it("C-ENV-01 reads a reserve of 0 to 1000 in plain digits", () => {
    for (const [value, reserve] of [
      ["0", 0],
      ["36", 36],
      ["1000", 1000],
    ] as const) {
      expect(envOf(envWith({ DYELOT_AI_RESERVE: value })).reserve).toBe(reserve);
    }
  });

  it("C-ENV-01 gives OpenRouter's base URL when OPENROUTER_BASE_URL is unset or empty", () => {
    expect(envOf(envWith({ OPENROUTER_BASE_URL: undefined })).baseUrl).toBe(OPENROUTER);
    expect(envOf(envWith({ OPENROUTER_BASE_URL: "" })).baseUrl).toBe(OPENROUTER);
  });

  it("C-ENV-01 drops one trailing slash from the base URL and allows http on localhost", () => {
    const base = (value: string) => envOf(envWith({ OPENROUTER_BASE_URL: value })).baseUrl;
    expect(base(`${OPENROUTER}/`)).toBe(OPENROUTER);
    expect(base("https://openrouter.ai")).toBe("https://openrouter.ai");
    expect(base("http://localhost:3199/api/v1")).toBe("http://localhost:3199/api/v1");
    expect(base("http://127.0.0.1:3199/api/v1/")).toBe("http://127.0.0.1:3199/api/v1");
  });

  it("C-ENV-01 drops a tier whose variable is unset or empty", () => {
    expect(envOf(envWith({ OPENROUTER_MODEL_FAST: undefined })).text).toEqual([TEXT[0], TEXT[2]]);
    expect(envOf(envWith({ OPENROUTER_MODEL_PRIMARY: "" })).text).toEqual([TEXT[1], TEXT[2]]);
    expect(envOf(envWith({ OPENROUTER_VISION_MODEL_3: " " })).vision).toEqual([
      VISION[0],
      VISION[1],
    ]);
  });

  it("C-ENV-01 gives vision: [] with no vision variable, and text: [] with no text variable", () => {
    const noVision = envWith({
      OPENROUTER_VISION_MODEL_1: undefined,
      OPENROUTER_VISION_MODEL_2: undefined,
      OPENROUTER_VISION_MODEL_3: undefined,
    });
    expect(envOf(noVision).vision).toEqual([]);
    expect(envOf(noVision).text).toEqual(TEXT);
    const noText = envWith({
      OPENROUTER_MODEL_PRIMARY: undefined,
      OPENROUTER_MODEL_FAST: undefined,
      OPENROUTER_MODEL_FALLBACK: undefined,
    });
    expect(envOf(noText).text).toEqual([]);
  });

  it("C-ENV-01 keeps a slug that two tiers share (cascadePlan drops the repeat)", () => {
    const env = envOf(envWith({ OPENROUTER_MODEL_FAST: TEXT_SLUGS[0] }));
    expect(env.text.map((tier) => tier.slug)).toEqual([
      TEXT_SLUGS[0],
      TEXT_SLUGS[0],
      TEXT_SLUGS[2],
    ]);
  });

  it("C-ENV-01 decodes a base64url secret, padded or not, of 32 bytes or more", () => {
    const bytes = Uint8Array.from({ length: 32 }, (_, i) => 224 + i);
    const url = Buffer.from(bytes).toString("base64url");
    expect(url).toMatch(/[-_]/);
    expect(envOf(envWith({ DYELOT_COOKIE_SECRET: url })).cookieSecret).toEqual(bytes);
    const long = Uint8Array.from({ length: 48 }, (_, i) => i * 5);
    const padded = Buffer.from(long).toString("base64");
    expect(envOf(envWith({ DYELOT_COOKIE_SECRET: padded })).cookieSecret).toEqual(long);
    expect(
      envOf(envWith({ DYELOT_COOKIE_SECRET: TEST_SECRET.replace(/=+$/, "") })).cookieSecret,
    ).toEqual(SECRET_BYTES);
  });

  it("C-ENV-01 accepts a key of 20 and of 200 printable ASCII characters", () => {
    for (const key of ["k".repeat(20), "~".repeat(200), "sk-or-v1-!#$%&'*+/=?^_`{|}~"]) {
      expect(envOf(envWith({ OPENROUTER_API_KEY: key })).apiKey).toBe(key);
    }
  });

  it("C-ENV-01 freezes the environment and its tier lists", () => {
    const env = envOf(TEST_ENV);
    expect(Object.isFrozen(env)).toBe(true);
    expect(Object.isFrozen(env.text)).toBe(true);
    expect(Object.isFrozen(env.vision)).toBe(true);
    expect(Object.isFrozen(env.text[0])).toBe(true);
  });

  it("C-ENV-01 readSlugs gives the six tiers from the slug variables alone, the key unset", () => {
    const slugsOnly = envWith({
      OPENROUTER_API_KEY: undefined,
      DYELOT_COOKIE_SECRET: undefined,
      OPENROUTER_BASE_URL: "ftp://not-read",
    });
    expect(readSlugs(slugsOnly)).toEqual({ ok: true, text: TEXT, vision: VISION });
    expect(readSlugs(envWith({ OPENROUTER_VISION_MODEL_2: undefined }))).toEqual({
      ok: true,
      text: TEXT,
      vision: [VISION[0], VISION[2]],
    });
    expect(readSlugs({})).toEqual({ ok: true, text: [], vision: [] });
  });
});

describe("C-ENV-02 invisible bytes are stripped before validation", () => {
  it("C-ENV-02 a key written BOM + TEST_KEY + CRLF and a slug with a trailing LF parse clean", () => {
    const env = envOf(
      envWith({
        OPENROUTER_API_KEY: `\uFEFF${TEST_KEY}\r\n`,
        OPENROUTER_MODEL_PRIMARY: `${TEXT_SLUGS[0]}\n`,
      }),
    );
    expect(env.apiKey).toBe(TEST_KEY);
    expect(env.text[0]).toEqual({ tier: "primary", slug: TEXT_SLUGS[0] });
  });

  it("C-ENV-02 strips every variable the same way: secret, reserve, base URL, slugs and tracing", () => {
    const env = envOf(
      envWith({
        DYELOT_COOKIE_SECRET: `\uFEFF${TEST_SECRET}\r\n`,
        DYELOT_AI_RESERVE: " 36\t",
        OPENROUTER_BASE_URL: `\uFEFF${OPENROUTER}/\r\n`,
        OPENROUTER_VISION_MODEL_1: `\t${VISION_SLUGS[0]} `,
        LANGFUSE_PUBLIC_KEY: `\uFEFF${TRIO.LANGFUSE_PUBLIC_KEY}\r\n`,
        LANGFUSE_SECRET_KEY: `${TRIO.LANGFUSE_SECRET_KEY}\n`,
        LANGFUSE_BASE_URL: ` ${TRIO.LANGFUSE_BASE_URL}\r\n`,
        APP_ENV: "\uFEFFpreview\n",
      }),
    );
    expect(env.cookieSecret).toEqual(SECRET_BYTES);
    expect(env.reserve).toBe(36);
    expect(env.baseUrl).toBe(OPENROUTER);
    expect(env.vision[0]).toEqual({ tier: "vision-1", slug: VISION_SLUGS[0] });
    expect(env.tracing).toEqual({
      publicKey: TRIO.LANGFUSE_PUBLIC_KEY,
      secretKey: TRIO.LANGFUSE_SECRET_KEY,
      baseUrl: TRIO.LANGFUSE_BASE_URL,
      environment: "preview",
    });
  });

  it("C-ENV-02 readSlugs strips a slug's BOM and line ending too", () => {
    const result = readSlugs({ OPENROUTER_MODEL_FALLBACK: `\uFEFF${TEXT_SLUGS[2]}\r\n` });
    expect(result).toEqual({ ok: true, text: [TEXT[2]], vision: [] });
  });

  it("C-ENV-02 counts a value of only a BOM and white space as unset", () => {
    expect(readAiEnv(envWith({ OPENROUTER_API_KEY: "\uFEFF\r\n" }))).toEqual({
      ok: false,
      variable: "OPENROUTER_API_KEY",
    });
    expect(envOf(envWith({ DYELOT_AI_RESERVE: "\uFEFF \n" })).reserve).toBe(35);
  });
});

describe("C-ENV-03 a bad variable is named, never its value", () => {
  const KEY_19 = TEST_KEY.slice(0, 19);
  const SECRET_31 = Buffer.from(Uint8Array.from({ length: 31 }, (_, i) => i)).toString("base64");

  it.each([
    ["OPENROUTER_API_KEY", undefined],
    ["OPENROUTER_API_KEY", ""],
    ["OPENROUTER_API_KEY", "sk-or-test 0123456789abcdef"],
    ["OPENROUTER_API_KEY", KEY_19],
    ["OPENROUTER_API_KEY", "k".repeat(201)],
    ["OPENROUTER_API_KEY", `${TEST_KEY}é`],
    ["OPENROUTER_API_KEY", `${TEST_KEY}\u0000`],
    ["DYELOT_COOKIE_SECRET", undefined],
    ["DYELOT_COOKIE_SECRET", "not base64!"],
    ["DYELOT_COOKIE_SECRET", SECRET_31],
    ["DYELOT_COOKIE_SECRET", "A"],
    ["DYELOT_COOKIE_SECRET", `${TEST_SECRET}=`],
    ["DYELOT_COOKIE_SECRET", `A${TEST_SECRET}`],
    ["DYELOT_AI_RESERVE", "-1"],
    ["DYELOT_AI_RESERVE", "1001"],
    ["DYELOT_AI_RESERVE", "35.0"],
    ["DYELOT_AI_RESERVE", "+3"],
    ["DYELOT_AI_RESERVE", "3e1"],
    ["DYELOT_AI_RESERVE", "abc"],
    ["DYELOT_AI_RESERVE", "035"],
    ["DYELOT_AI_RESERVE", "3 5"],
    ["DYELOT_AI_RESERVE", "0x10"],
    ["OPENROUTER_BASE_URL", "ftp://x"],
    ["OPENROUTER_BASE_URL", "http://example.com"],
    ["OPENROUTER_BASE_URL", "http://localhost.example.com/api/v1"],
    ["OPENROUTER_BASE_URL", `${OPENROUTER}?region=eu`],
    ["OPENROUTER_BASE_URL", `${OPENROUTER}?`],
    ["OPENROUTER_BASE_URL", `${OPENROUTER}#top`],
    ["OPENROUTER_BASE_URL", "openrouter.ai/api/v1"],
    ["OPENROUTER_BASE_URL", "https://user:pass@openrouter.ai/api/v1"],
    ["OPENROUTER_BASE_URL", `${OPENROUTER}//`],
    ["OPENROUTER_MODEL_PRIMARY", "test/text-1"],
    ["OPENROUTER_MODEL_PRIMARY", "Test/text-1:free"],
    ["OPENROUTER_MODEL_FAST", "test/text-2"],
    ["OPENROUTER_MODEL_FALLBACK", "test/TEXT-3:free"],
    ["OPENROUTER_VISION_MODEL_1", "test/vision-1"],
    ["OPENROUTER_VISION_MODEL_2", "TEST/vision-2:free"],
    ["OPENROUTER_VISION_MODEL_3", "test/vision-3:paid"],
  ])(
    "C-ENV-03 %s %j gives exactly { ok: false, variable }, holding no value",
    (variable, value) => {
      expect(readAiEnv(envWith({ [variable]: value }))).toStrictEqual({ ok: false, variable });
    },
  );

  it("C-ENV-03 stops at the first bad variable, in section 11.4's order", () => {
    const allBad: Record<string, string> = {
      OPENROUTER_API_KEY: "short",
      DYELOT_COOKIE_SECRET: "not base64!",
      DYELOT_AI_RESERVE: "-1",
      OPENROUTER_BASE_URL: "ftp://x",
      OPENROUTER_MODEL_PRIMARY: "a",
      OPENROUTER_MODEL_FAST: "b",
      OPENROUTER_MODEL_FALLBACK: "c",
      OPENROUTER_VISION_MODEL_1: "d",
      OPENROUTER_VISION_MODEL_2: "e",
      OPENROUTER_VISION_MODEL_3: "f",
    };
    const order = Object.keys(allBad);
    for (const [i, variable] of order.entries()) {
      const fixed = Object.fromEntries(order.slice(0, i).map((name) => [name, TEST_ENV[name]]));
      const source = { ...TEST_ENV, ...allBad, ...fixed };
      expect(readAiEnv(source)).toStrictEqual({ ok: false, variable });
    }
  });

  it("C-ENV-03 readSlugs names the first bad slug variable and ignores a bad key", () => {
    expect(readSlugs(envWith({ OPENROUTER_API_KEY: "short" })).ok).toBe(true);
    expect(
      readSlugs(envWith({ OPENROUTER_MODEL_FAST: "x/y", OPENROUTER_VISION_MODEL_1: "x/y" })),
    ).toStrictEqual({ ok: false, variable: "OPENROUTER_MODEL_FAST" });
    expect(readSlugs(envWith({ OPENROUTER_VISION_MODEL_3: "x/y" }))).toStrictEqual({
      ok: false,
      variable: "OPENROUTER_VISION_MODEL_3",
    });
  });

  it("C-ENV-03 a source that is not an object is a TypeError naming the function", () => {
    for (const source of [null, undefined, "OPENROUTER_API_KEY=x", 5, []]) {
      expect(() => readAiEnv(source as unknown as EnvSource), String(source)).toThrow(TypeError);
      expect(() => readAiEnv(source as unknown as EnvSource)).toThrow(/^readAiEnv: /);
      expect(() => readSlugs(source as unknown as EnvSource)).toThrow(/^readSlugs: /);
    }
  });

  it("C-ENV-03 a value that is not a string is a TypeError naming the variable, never the value", () => {
    const source = { ...TEST_ENV, OPENROUTER_API_KEY: 1234567890123456 };
    expect(() => readAiEnv(source as unknown as EnvSource)).toThrow(TypeError);
    expect(() => readAiEnv(source as unknown as EnvSource)).toThrow(
      /^readAiEnv: OPENROUTER_API_KEY must be a string or unset, got number$/,
    );
    const slug = { ...TEST_ENV, OPENROUTER_MODEL_FAST: ["test/text-2:free"] };
    expect(() => readSlugs(slug as unknown as EnvSource)).toThrow(
      /^readSlugs: OPENROUTER_MODEL_FAST must be a string or unset, got array$/,
    );
    const tracing = { ...TEST_ENV, APP_ENV: null };
    expect(() => readAiEnv(tracing as unknown as EnvSource)).toThrow(/^readAiEnv: APP_ENV /);
  });
});

describe("C-ENV-04 tracing: the Langfuse trio and APP_ENV never invalidate the environment", () => {
  it("C-ENV-04 turns tracing on with all three Langfuse variables, APP_ENV unset being production", () => {
    const env = envOf(envWith(TRIO));
    expect(env.tracing).toStrictEqual({
      publicKey: TRIO.LANGFUSE_PUBLIC_KEY,
      secretKey: TRIO.LANGFUSE_SECRET_KEY,
      baseUrl: TRIO.LANGFUSE_BASE_URL,
      environment: "production",
    });
    expect(Object.isFrozen(env.tracing)).toBe(true);
    expect(env.tracingProblem).toBeNull();
    expect(envOf(envWith({ ...TRIO, APP_ENV: "" })).tracing?.environment).toBe("production");
  });

  it("C-ENV-04 reads APP_ENV when it matches its pattern", () => {
    for (const name of ["preview", "e2e_local", "a", "x".repeat(40), "lang-fuse"]) {
      expect(envOf(envWith({ ...TRIO, APP_ENV: name })).tracing?.environment).toBe(name);
    }
  });

  it.each([
    ["LANGFUSE_PUBLIC_KEY", { ...TRIO, LANGFUSE_PUBLIC_KEY: undefined }],
    ["LANGFUSE_SECRET_KEY", { ...TRIO, LANGFUSE_SECRET_KEY: "" }],
    ["LANGFUSE_BASE_URL", { ...TRIO, LANGFUSE_BASE_URL: " \r\n" }],
    ["LANGFUSE_SECRET_KEY", { LANGFUSE_PUBLIC_KEY: TRIO.LANGFUSE_PUBLIC_KEY }],
    ["LANGFUSE_PUBLIC_KEY", { LANGFUSE_BASE_URL: TRIO.LANGFUSE_BASE_URL }],
    ["LANGFUSE_BASE_URL", { ...TRIO, LANGFUSE_BASE_URL: "http://us.cloud.langfuse.com" }],
    ["LANGFUSE_BASE_URL", { ...TRIO, LANGFUSE_BASE_URL: "us.cloud.langfuse.com" }],
    ["APP_ENV", { ...TRIO, APP_ENV: "Prod" }],
    ["APP_ENV", { ...TRIO, APP_ENV: "langfuse-x" }],
    ["APP_ENV", { ...TRIO, APP_ENV: "langfuse" }],
    ["APP_ENV", { ...TRIO, APP_ENV: "x".repeat(41) }],
    ["APP_ENV", { ...TRIO, APP_ENV: "pre view" }],
    ["LANGFUSE_SECRET_KEY", { ...TRIO, LANGFUSE_SECRET_KEY: undefined, APP_ENV: "Prod" }],
  ])(
    "C-ENV-04 turns tracing off with tracingProblem %s, the environment still valid",
    (problem, changes) => {
      const result = readAiEnv(envWith(changes));
      expect(result.ok).toBe(true);
      const env = envOf(envWith(changes));
      expect(env.tracing).toBeNull();
      expect(env.tracingProblem).toBe(problem);
      expect(env.apiKey).toBe(TEST_KEY);
      expect(env.text).toEqual(TEXT);
    },
  );

  it("C-ENV-04 with no Langfuse variable tracing is off with no problem, whatever APP_ENV holds", () => {
    for (const appEnv of [undefined, "preview", "Prod"]) {
      const env = envOf(envWith({ APP_ENV: appEnv }));
      expect(env.tracing).toBeNull();
      expect(env.tracingProblem).toBeNull();
    }
  });

  it("C-ENV-04 a copy of .env.example with a key and a secret leaves tracing off with no problem", () => {
    const example = readFileSync(
      path.resolve(import.meta.dirname, "../../../.env.example"),
      "utf8",
    );
    const entries = example
      .split(/\r?\n/)
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]);
    const copied = {
      ...Object.fromEntries(entries),
      OPENROUTER_API_KEY: TEST_KEY,
      DYELOT_COOKIE_SECRET: TEST_SECRET,
    };
    const env = envOf(copied);
    expect(env.tracing).toBeNull();
    expect(env.tracingProblem).toBeNull();
    expect(env.reserve).toBe(35);
    expect(env.text).toHaveLength(3);
  });

  it("C-ENV-04 a bad environment fails first: tracing never hides a bad key", () => {
    expect(readAiEnv(envWith({ ...TRIO, OPENROUTER_API_KEY: undefined }))).toStrictEqual({
      ok: false,
      variable: "OPENROUTER_API_KEY",
    });
  });
});
