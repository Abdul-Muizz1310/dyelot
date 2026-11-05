import { assertOneOf, isRecord } from "./assert";
import { isFreeSlug, TEXT_TIERS, type TierName, VISION_TIERS } from "./cascade";
import { FAILURE_KINDS } from "./chat";
import { VISITOR_CAP } from "./cookie";
import { AI_FEATURES, type AiFeature } from "./features";

// The shared-route client's reader (docs/specs/04-ai.md, R4-35 and section 11.1): each reply of the
// table to its `RouteReply`, and anything else, a reply of another shape included, to "unreachable".
// A 200's `result` is checked again by `parseOutput` in the client; here it only has to be there.

export const ROUTE_CODES = Object.freeze([
  "unknown-feature",
  "forbidden-origin",
  "not-configured",
  "too-large",
  "bad-request",
  "visitor-cap",
  "busy",
  "guard-unavailable",
  "pool-low",
  "all-tiers-failed",
] as const);
export type RouteCode = (typeof ROUTE_CODES)[number];

export type AiPath =
  | { readonly provider: "on-device" }
  | { readonly provider: "visitor-key"; readonly slug: string; readonly attempts: number }
  | {
      readonly provider: "shared";
      readonly slug: string;
      readonly tier: TierName;
      readonly attempts: number;
    }
  | { readonly provider: "rules" };

export type RouteReply =
  | {
      readonly ok: true;
      readonly feature: AiFeature;
      readonly result: unknown;
      readonly path: Extract<AiPath, { provider: "shared" }>;
      readonly remaining: number;
    }
  | {
      readonly ok: false;
      readonly code: RouteCode | "unreachable";
      readonly remaining: number | null;
    };

const UNREACHABLE: RouteReply = Object.freeze({ ok: false, code: "unreachable", remaining: null });
/** The most attempts of one cascade: one per tier. */
const MAX_ATTEMPTS = 3;
const MAX_STATUS = 599;

/**
 * Each code's row of 11.1: its status, whether it carries `remaining` (`0` when it must be 0), and
 * whether it carries `failures` ("may" for a re-read's refusal, "must" when every tier failed).
 */
const ROWS: Readonly<
  Record<
    RouteCode,
    {
      readonly status: number;
      readonly remaining: "none" | "zero" | "any";
      readonly failures: "no" | "may" | "must";
    }
  >
> = {
  "unknown-feature": { status: 404, remaining: "none", failures: "no" },
  "forbidden-origin": { status: 403, remaining: "none", failures: "no" },
  "not-configured": { status: 503, remaining: "none", failures: "no" },
  "too-large": { status: 413, remaining: "none", failures: "no" },
  "bad-request": { status: 400, remaining: "none", failures: "no" },
  "visitor-cap": { status: 429, remaining: "zero", failures: "no" },
  busy: { status: 503, remaining: "any", failures: "no" },
  "guard-unavailable": { status: 503, remaining: "any", failures: "may" },
  "pool-low": { status: 503, remaining: "any", failures: "may" },
  "all-tiers-failed": { status: 502, remaining: "any", failures: "must" },
};

/** Whether an object has exactly these keys. */
function hasKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
}

/** Whether `value` is an integer from `min` to `max`. */
const isIntegerIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

const isRouteCode = (value: unknown): value is RouteCode =>
  typeof value === "string" && (ROUTE_CODES as readonly string[]).includes(value);

/** Whether `value` names a tier of the feature's cascade. */
const isTierOf = (feature: AiFeature, value: unknown): value is TierName =>
  typeof value === "string" &&
  (feature === "vibe" ? VISION_TIERS : TEXT_TIERS).some((tier) => tier === value);

/** A path of the shared route: `{ provider, slug, tier, attempts }`, the tier from the feature's group. */
function sharedPath(
  value: unknown,
  feature: AiFeature,
): Extract<AiPath, { provider: "shared" }> | null {
  if (!isRecord(value) || !hasKeys(value, ["provider", "slug", "tier", "attempts"])) return null;
  const { provider, slug, tier, attempts } = value;
  if (provider !== "shared" || typeof slug !== "string" || !isFreeSlug(slug)) return null;
  if (!isTierOf(feature, tier) || !isIntegerIn(attempts, 1, MAX_ATTEMPTS)) return null;
  return { provider, slug, tier, attempts };
}

/** One tier's failure: `{ tier, slug, kind, status? }`, with a status for `http` alone. */
function isFailure(value: unknown, feature: AiFeature): boolean {
  if (!isRecord(value)) return false;
  const { tier, slug, kind, status } = value;
  const keys = kind === "http" ? ["tier", "slug", "kind", "status"] : ["tier", "slug", "kind"];
  return (
    hasKeys(value, keys) &&
    isTierOf(feature, tier) &&
    typeof slug === "string" &&
    typeof kind === "string" &&
    (FAILURE_KINDS as readonly string[]).includes(kind) &&
    (kind !== "http" || isIntegerIn(status, 0, MAX_STATUS))
  );
}

function readFailure(
  feature: AiFeature,
  status: number,
  json: Readonly<Record<string, unknown>>,
): RouteReply {
  const { code, remaining, failures } = json;
  if (!isRouteCode(code)) return UNREACHABLE;
  const row = ROWS[code];
  if (status !== row.status) return UNREACHABLE;
  const keys = ["ok", "code"];
  if (row.remaining !== "none") keys.push("remaining");
  const tried = row.failures === "must" || (row.failures === "may" && "failures" in json);
  if (tried) keys.push("failures");
  if (!hasKeys(json, keys)) return UNREACHABLE;
  let left: number | null = null;
  if (row.remaining !== "none") {
    const max = row.remaining === "zero" ? 0 : VISITOR_CAP;
    if (!isIntegerIn(remaining, 0, max)) return UNREACHABLE;
    left = remaining;
  }
  if (tried) {
    const list = Array.isArray(failures) ? failures : [];
    const sized = list.length >= 1 && list.length <= MAX_ATTEMPTS;
    if (!sized || !list.every((failure) => isFailure(failure, feature))) return UNREACHABLE;
  }
  return { ok: false, code, remaining: left };
}

/**
 * The shared route's reply as the client reads it (R4-35): a row of 11.1, or "unreachable" for any
 * other status, shape, code, `remaining` outside 0 to 3, or a 200 for another feature.
 */
export function readRouteReply(feature: AiFeature, status: number, json: unknown): RouteReply {
  assertOneOf(feature, AI_FEATURES, "readRouteReply: feature");
  if (typeof status !== "number") {
    throw new TypeError(`readRouteReply: status must be a number, got ${typeof status}`);
  }
  if (!Number.isInteger(status) || status < 0) {
    throw new RangeError(`readRouteReply: status must be an integer of at least 0, got ${status}`);
  }
  if (!isRecord(json)) return UNREACHABLE;
  if (json.ok === false) return readFailure(feature, status, json);
  if (json.ok !== true || status !== 200) return UNREACHABLE;
  if (!hasKeys(json, ["ok", "feature", "result", "path", "remaining"])) return UNREACHABLE;
  const path = sharedPath(json.path, feature);
  const { remaining } = json;
  if (json.feature !== feature || path === null || !isIntegerIn(remaining, 0, VISITOR_CAP)) {
    return UNREACHABLE;
  }
  return { ok: true, feature, result: json.result, path, remaining };
}
