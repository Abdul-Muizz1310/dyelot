import { assertOneOf, assertString } from "./assert";
import { AI_FEATURES, type AiFeature } from "./features";
import brief from "./prompts/brief.md?raw";
import critique from "./prompts/critique.md?raw";
import rationale from "./prompts/rationale.md?raw";
import refine from "./prompts/refine.md?raw";
import vibe from "./prompts/vibe.md?raw";

// The five prompt files, parsed (docs/specs/04-ai.md, R4-51 and section 6). One text serves the
// server, the visitor key and the on-device model; `version` is part of the cache key. Each file is
// imported with `?raw`: a Turbopack rule in next.config.ts bundles it as text (R4-27) and Vitest
// handles the query itself. The schema is not here: the request builder appends it (R4-10).

export type PromptFile = {
  readonly name: AiFeature;
  readonly version: number;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly body: string;
};

const FRONT_MATTER =
  /^---\nname: ([^\n]*)\nversion: ([^\n]*)\ntemperature: ([^\n]*)\nmax_tokens: ([^\n]*)\n---\n/;
const INTEGER = /^(?:0|[1-9]\d*)$/;
const DECIMAL = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

function refuse(file: AiFeature, reason: string): never {
  throw new RangeError(`parsePrompt: ${file}.md ${reason}`);
}

/** Reads one prompt file's text: the four front-matter lines of section 6.1, then a non-empty body. */
export function parsePrompt(file: AiFeature, text: string): PromptFile {
  assertOneOf(file, AI_FEATURES, "parsePrompt: file");
  assertString(text, "parsePrompt: text");
  if (text.includes("\r")) refuse(file, "must not hold a carriage return");
  const match = FRONT_MATTER.exec(text);
  if (match === null) {
    refuse(file, "must start with the lines ---, name, version, temperature, max_tokens and ---");
  }
  const [head, name, version, temperature, maxTokens] = match as unknown as [
    string,
    string,
    string,
    string,
    string,
  ];
  if (name !== file) refuse(file, `has the name ${JSON.stringify(name)}, not ${file}`);
  if (!INTEGER.test(version) || Number(version) < 1 || Number(version) > 9999) {
    refuse(file, `has a version that is not an integer from 1 to 9999: ${JSON.stringify(version)}`);
  }
  if (!DECIMAL.test(temperature) || Number(temperature) > 2) {
    refuse(file, `has a temperature that is not from 0 to 2: ${JSON.stringify(temperature)}`);
  }
  if (!INTEGER.test(maxTokens) || Number(maxTokens) < 256 || Number(maxTokens) > 16000) {
    refuse(
      file,
      `has max_tokens that is not an integer from 256 to 16000: ${JSON.stringify(maxTokens)}`,
    );
  }
  const body = text.slice(head.length).replace(/^\n+/, "");
  if (body.trim() === "") refuse(file, "has an empty body");
  return Object.freeze({
    name: file,
    version: Number(version),
    temperature: Number(temperature),
    maxTokens: Number(maxTokens),
    body,
  });
}

const TEXTS: Readonly<Record<AiFeature, string>> = { brief, refine, vibe, rationale, critique };

export const PROMPTS: Readonly<Record<AiFeature, PromptFile>> = Object.freeze(
  Object.fromEntries(
    AI_FEATURES.map((feature) => [feature, parsePrompt(feature, TEXTS[feature])]),
  ) as Record<AiFeature, PromptFile>,
);
