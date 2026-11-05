import { applyPreset, freshParams, generateSystem } from "@/engine";
import type { AiModule } from "@/features/ai/load";
import { readOnDeviceReply } from "@/features/ai/on-device";
import { describeType, isRecord } from "@/features/studio/guards";
import { mergeParams } from "@/features/studio/params";

// The on-device eval set (docs/specs/04-ai.md, R4-32): the briefs the dev-only page
// `/dev/on-device-eval` runs through Chrome's built-in model, and the reader that says, per reply,
// whether it was JSON, passed the schema (R4-38) and passed the engine (`generateSystem` on
// `briefChange` of fresh parameters). The owner records the pass rate before "(experimental)" leaves
// the switch's label.

/** At least 20 distinct briefs of plain text, 1 to 500 characters, across moods, trades and places. */
export const EVAL_BRIEFS: readonly string[] = Object.freeze([
  "Kyoto tea house at dusk, calm and exact",
  "A neighborhood bakery that opens at five, warm and unhurried",
  "Budgeting app for freelancers who dread spreadsheets",
  "Night train timetable for a coastal rail line",
  "Field guide to alpine wildflowers, quiet and precise",
  "Indie record shop with a loud, playful streak",
  "Hospital wayfinding signs that stay legible under stress",
  "A climbing gym that feels bold and a little rough",
  "Children's science museum, bright and curious",
  "Law firm site that should feel trustworthy, never stiff",
  "Ocean research lab sharing deep sea footage",
  "Minimal note taking tool for writers who work at night",
  "Desert spa retreat with sand, clay and long shadows",
  "Retro arcade bar with neon signs and dark corners",
  "Farmers market newsletter, earthy and friendly",
  "Developer dashboard for watching server health at 3 a.m.",
  "Botanical tea blends in forest green and cream",
  "Public library reading room, warm wood and soft light",
  "Electric bike rental for a rainy northern city",
  "Watch boutique, dark, exact and restrained",
  "Community radio station run by volunteers, scrappy and warm",
  "Ski lodge menu with pine, snow and amber light",
  "Meditation app for shift workers, soft and slow",
  "Architecture studio portfolio in concrete gray and black",
]);

/** The seed every engine check generates with, so a verdict never depends on the clock. */
const EVAL_SEED = "on-device-eval";

/** What one reply was: JSON, valid against the schema and its checks, and a design the engine makes. */
export type EvalVerdict = { json: boolean; schema: boolean; engine: boolean };

/**
 * Reads one on-device reply to a brief (R4-32): `json` when it is one JSON object (after trimming and
 * one code fence, as readReply reads), `schema` when `parseOutput` accepts it (R4-38), and `engine`
 * when `generateSystem` makes a design from `briefChange` applied to fresh parameters, as the store's
 * `applyAi` applies it (the preset first, then the patch). Each is false once one before it is.
 */
export function evaluateReply(ai: AiModule, text: string): EvalVerdict {
  if (!isRecord(ai)) {
    throw new TypeError(`evaluateReply: ai must be the @/ai module, got ${describeType(ai)}`);
  }
  if (typeof text !== "string") {
    throw new TypeError(`evaluateReply: text must be a string, got ${describeType(text)}`);
  }
  // A brief's output schema does not depend on the brief, so any brief of the set reads every reply.
  const input = ai.briefInput(EVAL_BRIEFS[0] as string, {});
  const outcome = readOnDeviceReply(ai, "brief", input, text);
  if (!outcome.ok) {
    const json = outcome.kind === "schema" || outcome.kind === "range";
    return { json, schema: false, engine: false };
  }
  let engine: boolean;
  try {
    const fresh = freshParams();
    const change = ai.briefChange(outcome.output, { params: fresh, literals: [] });
    const base = change.preset === undefined ? fresh : applyPreset(fresh, change.preset);
    generateSystem(mergeParams(base, change.patch), EVAL_SEED, { createdWith: "on-device" });
    engine = true;
  } catch {
    engine = false;
  }
  return { json: true, schema: true, engine };
}
