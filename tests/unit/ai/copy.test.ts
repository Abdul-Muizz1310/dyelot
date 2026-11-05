import { describe, expect, it } from "vitest";
import { failureSentence, madeWith, type ProviderFailure, providerLabel } from "@/ai/copy";
import { AI_FEATURES, type AiFeature } from "@/ai/features";
import { type AiPath, ROUTE_CODES } from "@/ai/route-reply";
import { copyProblems, hasEmoji } from "./copy-rules";

// C-AI-14 of docs/specs/04-ai.md, section 14.2: the provider labels of R4-57 and the sentences of
// section 10.3, word for word, under the copy rules.

const SLUG = "test/text-1:free";
const PATHS: Readonly<Record<AiPath["provider"], AiPath>> = {
  "on-device": { provider: "on-device" },
  "visitor-key": { provider: "visitor-key", slug: SLUG, attempts: 2 },
  shared: { provider: "shared", slug: SLUG, tier: "fast", attempts: 2 },
  rules: { provider: "rules" },
};

const RULE_LABELS: Readonly<Record<AiFeature, string>> = {
  brief: "the word list (no model)",
  refine: "the steer words (no model)",
  vibe: "the image's colors (no model)",
  rationale: "the preset's text (no model)",
  critique: "the findings list (no model)",
};

const VERBS: Readonly<Record<AiFeature, string>> = {
  brief: "read the brief",
  refine: "read the request",
  vibe: "read the image",
  rationale: "write the rationale",
  critique: "rank the findings",
};

const RULE_NEXT: Readonly<Record<AiFeature, string>> = {
  brief: "the word list",
  refine: "the steer words",
  vibe: "the image's colors",
  rationale: "the preset's text",
  critique: "the findings list",
};

type Next = "visitor-key" | "shared" | "rules";
const nextWords = (next: Next, feature: AiFeature): string =>
  next === "visitor-key"
    ? "your OpenRouter key"
    : next === "shared"
      ? "its shared quota"
      : RULE_NEXT[feature];

/** Each row of section 10.3: the failure, the providers it may hand on to, and its sentence. */
const ROWS: readonly [ProviderFailure, readonly Next[], (verb: string) => string][] = [
  [
    { provider: "on-device", reason: "unavailable" },
    ["visitor-key", "shared", "rules"],
    () => "Chrome's built-in model is not available on this device, so dyelot used <next>.",
  ],
  [
    { provider: "on-device", reason: "not-downloaded" },
    ["visitor-key", "shared", "rules"],
    () => "Chrome's built-in model is not downloaded yet, so dyelot used <next>.",
  ],
  [
    { provider: "on-device", reason: "failed" },
    ["visitor-key", "shared", "rules"],
    (verb) => `Chrome's built-in model could not ${verb}, so dyelot used <next>.`,
  ],
  [
    { provider: "visitor-key", reason: "refused" },
    ["shared", "rules"],
    () => "OpenRouter refused your key, so dyelot used <next>.",
  ],
  [
    { provider: "visitor-key", reason: "no-models" },
    ["shared", "rules"],
    () => "Your OpenRouter key has no free model to use here, so dyelot used <next>.",
  ],
  [
    { provider: "visitor-key", reason: "failed" },
    ["shared", "rules"],
    (verb) => `Your OpenRouter key's models could not ${verb}, so dyelot used <next>.`,
  ],
  [
    { provider: "shared", reason: "not-configured" },
    ["rules"],
    () => "The shared quota is off here, so dyelot used <next>.",
  ],
  [
    { provider: "shared", reason: "forbidden-origin" },
    ["rules"],
    () => "The shared quota refused this page's address, so dyelot used <next>.",
  ],
  [
    { provider: "shared", reason: "busy" },
    ["rules"],
    () => "The shared quota is busy with another request, so dyelot used <next>.",
  ],
  [
    { provider: "shared", reason: "visitor-cap" },
    ["rules"],
    () => "You have used today's 3 shared actions, so dyelot used <next>.",
  ],
  [
    { provider: "shared", reason: "pool-low" },
    ["rules"],
    () => "The shared quota is nearly used up for today, so dyelot used <next>.",
  ],
  [
    { provider: "shared", reason: "guard-unavailable" },
    ["rules"],
    () => "The shared quota could not be checked, so dyelot used <next>.",
  ],
  [
    { provider: "shared", reason: "all-tiers-failed" },
    ["rules"],
    (verb) => `The shared quota's models could not ${verb}, so dyelot used <next>.`,
  ],
  ...(["unreachable", "invalid", "bad-request", "too-large", "unknown-feature"] as const).map(
    (reason): [ProviderFailure, readonly Next[], () => string] => [
      { provider: "shared", reason },
      ["rules"],
      () => "The shared quota could not be reached, so dyelot used <next>.",
    ],
  ),
];

const TEXT_FEATURES: readonly AiFeature[] = ["brief", "refine", "rationale", "critique"];

/** The features a failure of this provider can happen for: on-device runs the text features only. */
const featuresOf = (failure: ProviderFailure) =>
  failure.provider === "on-device" ? TEXT_FEATURES : AI_FEATURES;

describe("C-AI-14 the provider labels", () => {
  it.each(AI_FEATURES)(
    "C-AI-14 providerLabel and madeWith give R4-57's labels for %s",
    (feature) => {
      const expected: Record<AiPath["provider"], string> = {
        "on-device": "Chrome's built-in model",
        "visitor-key": `your OpenRouter key (${SLUG})`,
        shared: `dyelot's shared AI (${SLUG})`,
        rules: RULE_LABELS[feature],
      };
      for (const provider of Object.keys(PATHS) as AiPath["provider"][]) {
        expect(providerLabel(PATHS[provider], feature)).toBe(expected[provider]);
        expect(madeWith(PATHS[provider], feature)).toBe(`Made with ${expected[provider]}.`);
      }
    },
  );

  it("C-AI-14 the shared and key labels name the slug that answered", () => {
    const slug = "google/gemma-4-26b-a4b-it:free";
    expect(providerLabel({ provider: "shared", slug, tier: "primary", attempts: 1 }, "brief")).toBe(
      `dyelot's shared AI (${slug})`,
    );
    expect(providerLabel({ provider: "visitor-key", slug, attempts: 3 }, "vibe")).toBe(
      `your OpenRouter key (${slug})`,
    );
  });

  it("C-AI-14 throws TypeError and RangeError naming the function", () => {
    expect(() => providerLabel(null as unknown as AiPath, "brief")).toThrow(TypeError);
    expect(() => providerLabel({ provider: "cloud" } as unknown as AiPath, "brief")).toThrow(
      RangeError,
    );
    expect(() =>
      providerLabel({ provider: "shared", slug: 5 } as unknown as AiPath, "brief"),
    ).toThrow(TypeError);
    expect(() =>
      providerLabel({ provider: "visitor-key", slug: "openrouter/free", attempts: 1 }, "brief"),
    ).toThrow(RangeError);
    expect(() => providerLabel(PATHS.rules, "poem" as AiFeature)).toThrow(/^providerLabel: /);
    expect(() => madeWith(PATHS.rules, "poem" as AiFeature)).toThrow(/^madeWith: /);
    expect(() => madeWith(undefined as unknown as AiPath, "brief")).toThrow(TypeError);
  });
});

describe("C-AI-14 the failure sentences", () => {
  it("C-AI-14 covers every route code", () => {
    const shared = ROWS.filter(([failure]) => failure.provider === "shared").map(
      ([failure]) => failure.reason,
    );
    expect(shared).toEqual(expect.arrayContaining([...ROUTE_CODES, "unreachable", "invalid"]));
  });

  for (const [failure, nexts, sentence] of ROWS) {
    it(`C-AI-14 gives the row ${failure.provider} ${failure.reason} for each feature and next`, () => {
      for (const feature of featuresOf(failure)) {
        for (const next of nexts) {
          expect(failureSentence(failure, feature, next)).toBe(
            sentence(VERBS[feature]).replace("<next>", nextWords(next, feature)),
          );
        }
      }
    });
  }

  it("C-AI-14 throws RangeError for a next that cannot follow the failure, naming failureSentence", () => {
    const shared: ProviderFailure = { provider: "shared", reason: "busy" };
    const key: ProviderFailure = { provider: "visitor-key", reason: "refused" };
    const device: ProviderFailure = { provider: "on-device", reason: "failed" };
    for (const [failure, next] of [
      [shared, "visitor-key"],
      [shared, "shared"],
      [shared, "on-device"],
      [key, "visitor-key"],
      [key, "on-device"],
      [device, "on-device"],
      [device, "robots"],
    ] as const) {
      expect(() => failureSentence(failure, "brief", next as never)).toThrow(RangeError);
      expect(() => failureSentence(failure, "brief", next as never)).toThrow(/^failureSentence: /);
    }
  });

  it("C-AI-14 throws RangeError for an on-device failure of vibe, which never runs on the device", () => {
    expect(() =>
      failureSentence({ provider: "on-device", reason: "unavailable" }, "vibe", "shared"),
    ).toThrow(RangeError);
  });

  it("C-AI-14 throws TypeError and RangeError for a failure outside its type", () => {
    expect(() => failureSentence(null as never, "brief", "rules")).toThrow(TypeError);
    expect(() => failureSentence({ provider: "cloud" } as never, "brief", "rules")).toThrow(
      RangeError,
    );
    expect(() =>
      failureSentence({ provider: "shared", reason: "refused" } as never, "brief", "rules"),
    ).toThrow(RangeError);
    expect(() =>
      failureSentence({ provider: "visitor-key", reason: 5 } as never, "brief", "rules"),
    ).toThrow(TypeError);
    expect(() =>
      failureSentence({ provider: "shared", reason: "busy" }, "poem" as AiFeature, "rules"),
    ).toThrow(RangeError);
    expect(() =>
      failureSentence({ provider: "shared", reason: "busy" }, "brief", 3 as never),
    ).toThrow(TypeError);
  });
});

describe("C-AI-14 the copy rules", () => {
  /** Every label and sentence copy.ts can write, with the paths and failures above. */
  function everyText(): { text: string; shared: boolean }[] {
    const texts: { text: string; shared: boolean }[] = [];
    for (const feature of AI_FEATURES) {
      for (const path of Object.values(PATHS)) {
        const shared = path.provider === "shared";
        texts.push({ text: providerLabel(path, feature), shared });
        texts.push({ text: madeWith(path, feature), shared });
      }
    }
    for (const [failure, nexts] of ROWS) {
      for (const feature of featuresOf(failure)) {
        for (const next of nexts) {
          texts.push({ text: failureSentence(failure, feature, next), shared: false });
        }
      }
    }
    return texts;
  }

  it("C-AI-14 no label or sentence holds a banned word, an exclamation mark, an emoji or a British spelling", () => {
    const bad = everyText().flatMap(({ text }) =>
      copyProblems(text).map((problem) => `${text}: ${problem}`),
    );
    expect(bad).toEqual([]);
  });

  it('C-AI-14 "AI" appears only in the shared label', () => {
    const texts = everyText();
    expect(texts.filter(({ text, shared }) => !shared && /\bAI\b/.test(text))).toEqual([]);
    expect(texts.filter(({ shared }) => shared).every(({ text }) => /\bAI\b/.test(text))).toBe(
      true,
    );
  });

  it("C-AI-14 the copy rules see each problem they name", () => {
    expect(copyProblems("Just do it")).toEqual(['banned word "just"']);
    expect(copyProblems("It is EASY")).toEqual(['banned word "easy"']);
    expect(copyProblems("simply, obviously, basically")).toHaveLength(3);
    expect(copyProblems("The colours of the centre")).toEqual([
      'British "colour"',
      'British "centre"',
    ]);
    expect(copyProblems("Grey behaviour, licence, analysed, catalogue")).toHaveLength(5);
    expect(copyProblems("organisation, favourite, cancelled")).toHaveLength(3);
    expect(copyProblems("Done!")).toEqual(["exclamation mark"]);
    expect(copyProblems("Tea \u{1F375}")).toEqual(["emoji"]);
    expect(hasEmoji("\u{1F1EF}\u{1F1F5}")).toBe(true);
    expect(copyProblems("justify the gray color, canceled")).toEqual([]);
  });
});
