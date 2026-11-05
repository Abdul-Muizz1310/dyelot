import type { AiEnv } from "./env";
import { describeType } from "./transport";

// The live smoke's plan (docs/specs/04-ai.md, R4-61 and decision D9): which slugs one smoke calls and
// whether the free pool can pay for it. Pure: it makes no request and reads no secret.

export type SmokeCall = { readonly slug: string; readonly kind: "text" | "image" };

/** The most calls one smoke plans (3 text tiers and 3 vision tiers). */
const SMOKE_MAX_CALLS = 6;
/** What the smoke leaves beside the reserve: the route's own guard margin (R4-16). */
const SMOKE_MARGIN = 3;

/**
 * One call per distinct slug, the text tiers' slugs first and the vision tiers' after, at most 6. A
 * slug a vision tier names is an image call (it proves the JSON too), even when a text tier names it
 * as well; any other text slug is a text call. A value that is not an AiEnv is a TypeError.
 */
export function planSmoke(env: AiEnv): readonly SmokeCall[] {
  if (typeof env !== "object" || env === null || Array.isArray(env)) {
    throw new TypeError(`planSmoke: env must be an object, got ${describeType(env)}`);
  }
  const visionSlugs = new Set(env.vision.map((tier) => tier.slug));
  const seen = new Set<string>();
  const calls: SmokeCall[] = [];
  const add = (slug: string, kind: SmokeCall["kind"]) => {
    if (seen.has(slug)) return;
    seen.add(slug);
    calls.push(Object.freeze({ slug, kind }));
  };
  for (const { slug } of env.text) add(slug, visionSlugs.has(slug) ? "image" : "text");
  for (const { slug } of env.vision) add(slug, "image");
  return Object.freeze(calls.slice(0, SMOKE_MAX_CALLS));
}

/**
 * True when the pool's `remaining` requests cover the reserve, the guard's margin of 3 and the `n`
 * planned calls: `remaining >= reserve + 3 + n`. An unread pool (null) is never enough.
 */
export function smokeAllowed(remaining: number | null, reserve: number, n: number): boolean {
  if (remaining !== null && typeof remaining !== "number") {
    throw new TypeError(
      `smokeAllowed: remaining must be a number or null, got ${describeType(remaining)}`,
    );
  }
  if (typeof reserve !== "number") {
    throw new TypeError(`smokeAllowed: reserve must be a number, got ${describeType(reserve)}`);
  }
  if (typeof n !== "number") {
    throw new TypeError(`smokeAllowed: n must be a number, got ${describeType(n)}`);
  }
  if (remaining !== null && !Number.isFinite(remaining)) {
    throw new RangeError(`smokeAllowed: remaining must be finite, got ${remaining}`);
  }
  if (!Number.isFinite(reserve) || reserve < 0) {
    throw new RangeError(
      `smokeAllowed: reserve must be a finite number of 0 or more, got ${reserve}`,
    );
  }
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`smokeAllowed: n must be a whole number of 0 or more, got ${n}`);
  }
  return remaining !== null && remaining >= reserve + SMOKE_MARGIN + n;
}
