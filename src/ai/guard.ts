import { assertInteger, describeType, isRecord } from "./assert";

// The guard's arithmetic (docs/specs/04-ai.md, R4-16, R4-17 and section 11.3). Reading `/key` is the
// server shell's work; this reads its body and judges what it says.

/** The actions one cascade may spend: one attempt per tier. */
const MAX_ATTEMPTS = 3;
const RESERVE_MAX = 1000;

/**
 * `data.free_model_daily_requests.remaining` of OpenRouter's `/key` body when it is a finite number
 * of at least 0, else null. It never throws: a body of any shape is read.
 */
export function readKeyRemaining(json: unknown): number | null {
  const data = isRecord(json) ? json.data : undefined;
  const daily = isRecord(data) ? data.free_model_daily_requests : undefined;
  const remaining = isRecord(daily) ? daily.remaining : undefined;
  return typeof remaining === "number" && Number.isFinite(remaining) && remaining >= 0
    ? remaining
    : null;
}

/**
 * Whether the shared pool admits an action: `guard-unavailable` when `/key` could not be read,
 * `pool-low` when `remaining < reserve + 3`, else `ok`. The reserve is an integer from 0 to 1000.
 */
export function guardVerdict(
  remaining: number | null,
  reserve: number,
): "ok" | "pool-low" | "guard-unavailable" {
  assertInteger(reserve, 0, RESERVE_MAX, "guardVerdict: reserve");
  if (remaining === null) return "guard-unavailable";
  if (typeof remaining !== "number") {
    throw new TypeError(
      `guardVerdict: remaining must be a number or null, got ${describeType(remaining)}`,
    );
  }
  if (!Number.isFinite(remaining) || remaining < 0) {
    throw new RangeError(
      `guardVerdict: remaining must be a finite number of at least 0, got ${remaining}`,
    );
  }
  return remaining < reserve + MAX_ATTEMPTS ? "pool-low" : "ok";
}
