import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  BriefOutput,
  CritiqueOutput,
  RationaleOutput,
  RefineOutput,
  VibeOutput,
} from "@/ai/features";
import { briefInput, critiqueInput, rationaleInput, refineInput, vibeInput } from "@/ai/inputs";
import { imagePalette, LOCKABLE, type Lockable, lintSpec, type Oklch } from "@/engine";
import { lockSeed } from "@/features/studio/params";
import type { DesignSpec } from "@/spec";
import { FOUR_COLORS } from "../engine/image/support";
import { SPEC } from "../export/golden-support";
import { ONE_FAIL } from "../export/one-fail-support";
import { DEFAULT_PARAMS } from "../spec/support";

// The fixtures of docs/specs/04-ai.md, section 4. The five outputs live in
// tests/fixtures/ai/outputs.json, which the mock OpenRouter of Task 4.12a reads too.

export { FOUR_COLORS };

const AI_FIXTURES = path.resolve(import.meta.dirname, "../../fixtures/ai");

export const TEXT_SLUGS = ["test/text-1:free", "test/text-2:free", "test/text-3:free"] as const;
export const VISION_SLUGS = [
  "test/vision-1:free",
  "test/vision-2:free",
  "test/vision-3:free",
] as const;

export const TEST_KEY = "sk-or-test-0123456789abcdef";
/** The base64 of the bytes 0 to 31. */
export const TEST_SECRET = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

/** The test environment of every server test and of the Playwright app server, and nothing else. */
export const TEST_ENV: Readonly<Record<string, string>> = Object.freeze({
  OPENROUTER_API_KEY: TEST_KEY,
  DYELOT_COOKIE_SECRET: TEST_SECRET,
  OPENROUTER_BASE_URL: "http://127.0.0.1:3199/api/v1",
  OPENROUTER_MODEL_PRIMARY: TEXT_SLUGS[0],
  OPENROUTER_MODEL_FAST: TEXT_SLUGS[1],
  OPENROUTER_MODEL_FALLBACK: TEXT_SLUGS[2],
  OPENROUTER_VISION_MODEL_1: VISION_SLUGS[0],
  OPENROUTER_VISION_MODEL_2: VISION_SLUGS[1],
  OPENROUTER_VISION_MODEL_3: VISION_SLUGS[2],
});

/** 2026-11-05T12:00:00Z. */
export const NOW = 1793880000000;
export const TODAY = "2026-11-05";

/** The three slots' `lockSeed` of `spec`. */
export function seedsOf(spec: DesignSpec): Readonly<Record<Lockable, Oklch>> {
  return Object.fromEntries(LOCKABLE.map((slot) => [slot, lockSeed(spec, slot)])) as Record<
    Lockable,
    Oklch
  >;
}

/** `tiny.jpg`, a 2 × 2 JPEG, as the data URL "Read the vibe" sends. */
export const TINY_JPEG_DATA_URL = `data:image/jpeg;base64,${readFileSync(
  path.join(AI_FIXTURES, "tiny.jpg"),
).toString("base64")}`;

export const BRIEF_IN = briefInput("Kyoto tea house at dusk, calm and exact", {});
export const REFINE_IN = refineInput("warmer and rounder", DEFAULT_PARAMS, seedsOf(SPEC));
export const VIBE_IN = vibeInput(imagePalette(FOUR_COLORS), {
  dataUrl: TINY_JPEG_DATA_URL,
  width: 2,
  height: 2,
});
export const RATIONALE_IN = rationaleInput(SPEC, "default");
export const CRITIQUE_IN = critiqueInput(lintSpec(ONE_FAIL));

type Outputs = {
  readonly brief: BriefOutput;
  readonly refine: RefineOutput;
  readonly vibe: VibeOutput;
  readonly rationale: RationaleOutput;
  readonly critique: CritiqueOutput;
};

/** A fresh copy of the five outputs of section 4, so a test may change one without touching another. */
export function readOutputs(): Outputs {
  return JSON.parse(readFileSync(path.join(AI_FIXTURES, "outputs.json"), "utf8")) as Outputs;
}

const OUTPUTS = readOutputs();
export const BRIEF_OUT: BriefOutput = OUTPUTS.brief;
export const REFINE_OUT: RefineOutput = OUTPUTS.refine;
export const VIBE_OUT: VibeOutput = OUTPUTS.vibe;
export const RATIONALE_OUT: RationaleOutput = OUTPUTS.rationale;
export const CRITIQUE_OUT: CritiqueOutput = OUTPUTS.critique;
