import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import type * as types from "@/ai";
import * as ai from "@/ai";
import { type MOOD_TAGS, rationaleChange, type TYPE_VIBES } from "@/ai/apply";
import { cascadePlan, isFreeSlug } from "@/ai/cascade";
import {
  CAP_COOKIE,
  capMacInput,
  capSetCookie,
  formatCapCookie,
  parseCapCookie,
  VISITOR_CAP,
} from "@/ai/cookie";
import { failureSentence, madeWith, providerLabel } from "@/ai/copy";
import {
  AI_FEATURES,
  inputSchema,
  outputJsonSchema,
  outputSchema,
  parseOutput,
} from "@/ai/features";
import { guardVerdict, readKeyRemaining } from "@/ai/guard";
import { briefInput, critiqueInput, rationaleInput, refineInput, vibeInput } from "@/ai/inputs";
import { PROMPTS } from "@/ai/prompts";
import { ROUTE_CODES, readRouteReply } from "@/ai/route-reply";
import type { CHROMA_LEVELS, NEUTRAL_TINTS } from "@/engine";

// C-ENTRY4-02 of docs/specs/04-ai.md, section 14.2 (R4-04): the `@/ai` entry's runtime keys are
// exactly the 41 names of section 5.2, each the object its home module exports, and the entry holds
// only `export … from` lines.

/** The 41 runtime names of section 5.2. */
const AI_KEYS = [
  "AI_FEATURES",
  "CAP_COOKIE",
  "OPENROUTER_ORIGIN",
  "PROMPTS",
  "ROUTE_CODES",
  "VISITOR_CAP",
  "authorizeUrl",
  "base64url",
  "briefChange",
  "briefColors",
  "briefInput",
  "buildChatRequest",
  "cacheKey",
  "capMacInput",
  "capSetCookie",
  "cascadePlan",
  "chatMessages",
  "critiqueInput",
  "failureSentence",
  "formatCapCookie",
  "guardVerdict",
  "imageChange",
  "inputSchema",
  "isFreeSlug",
  "madeWith",
  "matchLexicon",
  "outputJsonSchema",
  "outputSchema",
  "parseCapCookie",
  "parseOutput",
  "providerLabel",
  "rationaleChange",
  "rationaleInput",
  "readCallback",
  "readKeyRemaining",
  "readReply",
  "readRouteReply",
  "refineChange",
  "refineInput",
  "vibeChange",
  "vibeInput",
] as const;

/**
 * The keys a later task of M4 adds with its module: 4.2b (`chat.ts`, `cache-key.ts`), 4.3 (`PROMPTS`),
 * 4.4 (the brief), 4.5 (refine), 4.6b (image) and 4.9 (PKCE). Each task adds its `export … from`
 * lines and deletes its keys here; the entry holds exactly the rest.
 */
const PENDING_KEYS: readonly string[] = [
  "OPENROUTER_ORIGIN",
  "buildChatRequest",
  "cacheKey",
  "chatMessages",
  "readReply",
  "briefChange",
  "briefColors",
  "matchLexicon",
  "refineChange",
  "imageChange",
  "vibeChange",
  "authorizeUrl",
  "base64url",
  "readCallback",
];

const sorted = (keys: readonly string[]): string[] => [...keys].sort();

/** One `export … from` statement of the entry, from a module inside src/ai (a nested path included). */
const EXPORT_LINE = /^export\s+(?:type\s+)?\{[^}]*\}\s+from\s+"\.\/[\w-]+(?:\/[\w-]+)*"$/;

describe("C-ENTRY4-02 the @/ai entry", () => {
  it("C-ENTRY4-02 lists 41 names, of which the pending ones are a part", () => {
    expect(AI_KEYS).toHaveLength(41);
    expect(new Set(AI_KEYS).size).toBe(41);
    for (const key of PENDING_KEYS) expect(AI_KEYS).toContain(key);
  });

  it("C-ENTRY4-02 exports the 41 names of section 5.2 and nothing else, bar the keys a later task adds", () => {
    expect(sorted(Object.keys(ai))).toEqual(
      sorted(AI_KEYS.filter((key) => !PENDING_KEYS.includes(key))),
    );
  });

  it("C-ENTRY4-02 exports, for every key, the very object its home module exports", () => {
    const homes: Record<string, unknown> = {
      AI_FEATURES,
      CAP_COOKIE,
      PROMPTS,
      ROUTE_CODES,
      VISITOR_CAP,
      briefInput,
      capMacInput,
      capSetCookie,
      cascadePlan,
      critiqueInput,
      failureSentence,
      formatCapCookie,
      guardVerdict,
      inputSchema,
      isFreeSlug,
      madeWith,
      outputJsonSchema,
      outputSchema,
      parseCapCookie,
      parseOutput,
      providerLabel,
      rationaleChange,
      rationaleInput,
      readKeyRemaining,
      readRouteReply,
      refineInput,
      vibeInput,
    };
    const exported: Record<string, unknown> = { ...ai };
    expect(sorted(Object.keys(homes))).toEqual(sorted(Object.keys(exported)));
    for (const [key, home] of Object.entries(homes)) expect(exported[key], key).toBe(home);
  });

  it("C-ENTRY4-02 holds only export … from lines", () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../../../src/ai/index.ts"),
      "utf8",
    );
    const code = source.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
    const statements = code
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) expect(statement).toMatch(EXPORT_LINE);
  });

  it("C-ENTRY4-02 reads an export line from a nested module and refuses any other statement", () => {
    expect('export { words } from "./lexicon/match"').toMatch(EXPORT_LINE);
    expect('export type { LexiconEntry } from "./lexicon/match"').toMatch(EXPORT_LINE);
    expect('export { parseOutput } from "./features"').toMatch(EXPORT_LINE);
    for (const statement of [
      "export const x = 1",
      'import { a } from "./a"',
      'export { a } from "@/engine"',
      'export { a } from "../engine/a"',
      'export * from "./features"',
    ]) {
      expect(statement).not.toMatch(EXPORT_LINE);
    }
  });

  it("C-ENTRY4-02 carries the types of section 5.2 as type-only exports", () => {
    expectTypeOf<types.AiFeature>().toEqualTypeOf<
      "brief" | "refine" | "vibe" | "rationale" | "critique"
    >();
    expectTypeOf<types.ChromaLevel>().toEqualTypeOf<(typeof CHROMA_LEVELS)[number]>();
    expectTypeOf<types.NeutralTint>().toEqualTypeOf<(typeof NEUTRAL_TINTS)[number]>();
    expectTypeOf<types.FeatureInput["brief"]>().toEqualTypeOf<types.BriefInput>();
    expectTypeOf<types.FeatureOutput["critique"]>().toEqualTypeOf<types.CritiqueOutput>();
    expectTypeOf<types.BriefDraft>().toEqualTypeOf<Partial<types.BriefOutput>>();
    expectTypeOf<types.RouteCode>().toEqualTypeOf<(typeof ROUTE_CODES)[number]>();
    expectTypeOf<types.MoodTag>().toEqualTypeOf<(typeof MOOD_TAGS)[number]>();
    expectTypeOf<types.TypeVibe>().toEqualTypeOf<(typeof TYPE_VIBES)[number]>();
    expectTypeOf<types.Tier["tier"]>().toEqualTypeOf<types.TierName>();
    expectTypeOf<types.AiChange["patch"]>().toEqualTypeOf<types.AiPatch>();
    expectTypeOf<types.CapCookie>().toHaveProperty("signed");
    expectTypeOf<Extract<types.AiPath, { provider: "shared" }>>().toHaveProperty("tier");
    expectTypeOf<types.RouteReply>().toHaveProperty("remaining");
    expectTypeOf<types.ProviderFailure["provider"]>().toEqualTypeOf<
      "on-device" | "visitor-key" | "shared"
    >();
    expectTypeOf<types.RefineOp["op"]>().toEqualTypeOf<types.RefineOpName>();
    expectTypeOf<types.VibeOutput["typeVibe"]>().toEqualTypeOf<types.TypeVibe>();
    expectTypeOf<types.Hue>().toEqualTypeOf<number>();
    expectTypeOf<types.HueOrNull>().toEqualTypeOf<number | null>();
    expectTypeOf<types.VibeInput["image"]>().toHaveProperty("dataUrl");
    expectTypeOf<types.RationaleInput["checks"][number]>().toHaveProperty("ratio");
    expectTypeOf<types.RationaleOutput>().toHaveProperty("dont");
    expectTypeOf<types.CritiqueInput["findings"][number]>().toHaveProperty("threshold");
    expectTypeOf<types.RefineInput["current"]>().toHaveProperty("hues");
    expectTypeOf<types.RefineOutput>().toHaveProperty("summary");
  });
});
