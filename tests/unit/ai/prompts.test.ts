import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AI_FEATURES, type AiFeature } from "@/ai/features";
import { PROMPTS, parsePrompt } from "@/ai/prompts";
import { copyProblems } from "./copy-rules";
import { PROMPT_VERSIONS } from "./prompt-versions";

// C-PROMPT-01 to 05 of docs/specs/04-ai.md, section 14.3 (R4-27, R4-51, section 6): the five prompt
// files, their parser, their record and the bundling rule.

const ROOT = path.resolve(import.meta.dirname, "../../..");
const file = (feature: AiFeature): string =>
  readFileSync(path.join(ROOT, "src/ai/prompts", `${feature}.md`), "utf8");

// Section 6.1's table.
const TABLE: Readonly<
  Record<AiFeature, { version: number; temperature: number; maxTokens: number }>
> = {
  brief: { version: 2, temperature: 0.4, maxTokens: 4000 },
  refine: { version: 2, temperature: 0.2, maxTokens: 4000 },
  vibe: { version: 2, temperature: 0.3, maxTokens: 4000 },
  // Version 3: the rules as bare verb phrases (the final review's finding 2).
  rationale: { version: 3, temperature: 0.6, maxTokens: 4000 },
  critique: { version: 2, temperature: 0.2, maxTokens: 4000 },
};

/** The text after the second `---` line, less its leading blank lines (section 6.1). */
function bodyOf(text: string): string {
  const lines = text.split("\n");
  let rest = lines.slice(lines.indexOf("---", 1) + 1);
  while (rest.length > 0 && rest[0] === "") rest = rest.slice(1);
  return rest.join("\n");
}

const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");

describe("C-PROMPT-01 PROMPTS", () => {
  it("C-PROMPT-01 holds exactly the five features, frozen", () => {
    expect(Object.keys(PROMPTS).sort()).toEqual([...AI_FEATURES].sort());
    expect(Object.isFrozen(PROMPTS)).toBe(true);
    for (const feature of AI_FEATURES) expect(Object.isFrozen(PROMPTS[feature])).toBe(true);
  });

  it.each(AI_FEATURES)("C-PROMPT-01 %s: the table's values and the file's body", (feature) => {
    const prompt = PROMPTS[feature];
    expect(prompt.name).toBe(feature);
    expect(prompt.version).toBe(TABLE[feature].version);
    expect(prompt.temperature).toBe(TABLE[feature].temperature);
    expect(prompt.maxTokens).toBe(TABLE[feature].maxTokens);
    expect(prompt.body).toBe(bodyOf(file(feature)));
    expect(prompt.body.length).toBeGreaterThan(0);
  });

  it("C-PROMPT-01 parses a file's front matter and body", () => {
    const text =
      "---\nname: brief\nversion: 3\ntemperature: 0.25\nmax_tokens: 256\n---\n\n\nHello.\nBye.\n";
    expect(parsePrompt("brief", text)).toEqual({
      name: "brief",
      version: 3,
      temperature: 0.25,
      maxTokens: 256,
      body: "Hello.\nBye.\n",
    });
  });
});

const SENTENCES = [
  "Never write a color value, such as a hex code or an rgb(), hsl() or oklch() function.",
  "Write in plain American English, with no emoji and no exclamation marks.",
  "Fill every required field, and leave out an optional field only when the input gives no basis for it.",
];

// The first sentence of each file's own line in section 6.2's table, as a spot check of its content.
const OWN: Readonly<Record<AiFeature, readonly string[]>> = {
  brief: [
    "You turn a short product or mood brief into design parameters for dyelot, a design-system studio.",
    "Hues are integers from 0 to 359 on the OKLCH hue wheel.",
    "Give a hue only for a slot the input does not list in `locked`.",
    "The name is at most 40 characters and names no real brand.",
    "Pick a preset and a pairing only from the schema's lists.",
  ],
  refine: [
    "You turn a request to change the current design into one to six operations.",
    "`current` holds the design as it is.",
    "Use `shiftHue` only for a slot whose hue is not null, with at most 60 degrees either way.",
    "The summary says in one sentence what changed.",
  ],
  vibe: [
    "You read the image and its color clusters.",
    "only by cluster id.",
    "the type vibe and a preset from the schema's lists.",
    "one to five mood tags",
  ],
  rationale: [
    "You write the reasons behind a design system for its own documentation:",
    "rules to follow (`do`) and rules to avoid (`dont`)",
    'call it "perceptual contrast (advisory)" and never by any other name, acronym or brand.',
    'Write each rule as a bare verb phrase that reads on after "Do" in `do` and after "Don\'t" in `dont`: start it with a lowercase verb, as in "keep body text at 16 px or more", and never with Do, Do not, Don\'t, Never or Avoid.',
  ],
  critique: [
    "You rank up to three of the given findings by how much they hurt the people who use the product,",
    "naming the finding by its index.",
    "The verdict is one or two sentences.",
    "Never invent a finding or a fix.",
  ],
};

describe("C-PROMPT-02 the bodies' words", () => {
  it.each(AI_FEATURES)(
    "C-PROMPT-02 %s: the three sentences, JSON and its own content",
    (feature) => {
      const { body } = PROMPTS[feature];
      for (const sentence of SENTENCES) expect(body).toContain(sentence);
      expect(body).toContain("JSON");
      for (const part of OWN[feature]) expect(body).toContain(part);
    },
  );

  it.each(AI_FEATURES)(
    "C-PROMPT-02 %s: passes the copy check and never spells the score",
    (feature) => {
      const text = file(feature);
      expect(copyProblems(text)).toEqual([]);
      // The four-letter acronym is spelled by no file in src/ (M1's I-10), so the pattern hides it.
      expect(text).not.toMatch(/\ba[p]ca\b/i);
    },
  );

  it("C-PROMPT-02 asks for no color value in any body, only for the JSON shape", () => {
    for (const feature of AI_FEATURES) {
      expect(PROMPTS[feature].body).not.toMatch(/#[0-9a-f]{3,8}\b/i);
      expect(PROMPTS[feature].body).not.toMatch(/\b(?:rgb|hsl|oklch)\(\s*\d/i);
    }
  });
});

describe("C-PROMPT-03 parsePrompt refuses a malformed file", () => {
  const GOOD = [
    "---",
    "name: brief",
    "version: 1",
    "temperature: 0.4",
    "max_tokens: 4000",
    "---",
    "",
    "Body.",
  ];
  const make = (lines: readonly string[]): string => lines.join("\n");
  const expectRange = (feature: AiFeature, text: string): void => {
    expect(() => parsePrompt(feature, text)).toThrow(RangeError);
    expect(() => parsePrompt(feature, text)).toThrow(new RegExp(`^parsePrompt: ${feature}\\.md`));
  };

  it("C-PROMPT-03 reads the good file", () => {
    expect(parsePrompt("brief", make(GOOD)).body).toBe("Body.");
  });

  it("C-PROMPT-03 refuses no front matter", () => {
    expectRange("brief", "Just a body.\n");
    expectRange("brief", "");
    expectRange("brief", make(GOOD.slice(1)));
    expectRange("brief", make([...GOOD.slice(0, 5)]));
  });

  it.each([1, 2, 3, 4])("C-PROMPT-03 refuses a missing field (line %i)", (index) => {
    expectRange("brief", make(GOOD.filter((_, i) => i !== index)));
  });

  it("C-PROMPT-03 refuses a repeated, an out-of-order and an extra field", () => {
    expectRange("brief", make([...GOOD.slice(0, 3), GOOD[2] as string, ...GOOD.slice(3)]));
    expectRange("brief", make([GOOD[0], GOOD[2], GOOD[1], ...GOOD.slice(3)] as string[]));
    expectRange("brief", make([...GOOD.slice(0, 5), "top_p: 1", ...GOOD.slice(5)]));
    expectRange("brief", make([GOOD[0], GOOD[1], GOOD[3], GOOD[2], ...GOOD.slice(4)] as string[]));
  });

  it("C-PROMPT-03 refuses a name that differs from the file", () => {
    expectRange("refine", make(GOOD));
    expectRange("brief", make(GOOD.map((l) => (l === "name: brief" ? "name: other" : l))));
  });

  it.each([
    ["version: 0"],
    ["version: 1.5"],
    ["version: 10000"],
    ["version: -1"],
    ["version: one"],
    ["version: 01"],
    ["version:1"],
    ["temperature: 2.5"],
    ["temperature: -0.1"],
    ["temperature: 0.123"],
    ["temperature: warm"],
    ["max_tokens: 255"],
    ["max_tokens: 16001"],
    ["max_tokens: 4000.5"],
  ])("C-PROMPT-03 refuses %s", (line) => {
    const key = line.split(":")[0] as string;
    expectRange("brief", make(GOOD.map((l) => (l.startsWith(`${key}:`) ? line : l))));
  });

  it("C-PROMPT-03 reads the range's ends", () => {
    const edge = (key: string, value: string): string =>
      make(GOOD.map((l) => (l.startsWith(`${key}:`) ? `${key}: ${value}` : l)));
    expect(parsePrompt("brief", edge("version", "9999")).version).toBe(9999);
    expect(parsePrompt("brief", edge("temperature", "0")).temperature).toBe(0);
    expect(parsePrompt("brief", edge("temperature", "2")).temperature).toBe(2);
    expect(parsePrompt("brief", edge("temperature", "1.25")).temperature).toBe(1.25);
    expect(parsePrompt("brief", edge("max_tokens", "256")).maxTokens).toBe(256);
    expect(parsePrompt("brief", edge("max_tokens", "16000")).maxTokens).toBe(16000);
  });

  it("C-PROMPT-03 refuses an empty body and a carriage return", () => {
    expectRange("brief", make([...GOOD.slice(0, 6)]));
    expectRange("brief", `${make(GOOD.slice(0, 6))}\n\n\n`);
    expectRange("brief", make(GOOD).replace("version: 1", "version: 1\r"));
    expectRange("brief", `${make(GOOD)}\r\n`);
  });

  it("C-PROMPT-03 refuses a wrong type and an unknown feature (R-05)", () => {
    expect(() => parsePrompt("brief", 7 as unknown as string)).toThrow(TypeError);
    expect(() => parsePrompt("brief", 7 as unknown as string)).toThrow(/^parsePrompt/);
    expect(() => parsePrompt("nope" as AiFeature, make(GOOD))).toThrow(RangeError);
    expect(() => parsePrompt(3 as unknown as AiFeature, make(GOOD))).toThrow(TypeError);
  });
});

describe("C-PROMPT-04 the version record", () => {
  it.each(AI_FEATURES)(
    "C-PROMPT-04 %s: the body's SHA-256 equals its version's record",
    (feature) => {
      const record = PROMPT_VERSIONS[feature];
      expect(PROMPTS[feature].version).toBe(record.version);
      expect(sha256(PROMPTS[feature].body)).toBe(record.sha256);
    },
  );

  it("C-PROMPT-04 holds a record for exactly the five features", () => {
    expect(Object.keys(PROMPT_VERSIONS).sort()).toEqual([...AI_FEATURES].sort());
  });
});

describe("C-PROMPT-05 the bundling rule", () => {
  it("C-PROMPT-05 next.config.ts holds the *.md raw rule beside *.mjs", () => {
    const source = readFileSync(path.join(ROOT, "next.config.ts"), "utf8");
    expect(source).toMatch(
      /"\*\.md":\s*\{\s*condition:\s*\{\s*query:\s*\/\[\?&\]raw\(\?=&\|\$\)\/\s*\},\s*type:\s*"raw"\s*\}/,
    );
    expect(source).toMatch(/"\*\.mjs":\s*\{\s*condition:/);
  });

  it("C-PROMPT-05 src/types/raw.d.ts declares *.md?raw as a string", () => {
    const source = readFileSync(path.join(ROOT, "src/types/raw.d.ts"), "utf8");
    expect(source).toMatch(
      /declare module "\*\.md\?raw"\s*\{\s*const text: string;\s*export default text;\s*\}/,
    );
  });
});
