import { deflateSync, Inflate, strFromU8, strToU8 } from "fflate";
import { describeType } from "../engine/color/guards";
import { canonicalize } from "./canonical";
import { fnv1a64 } from "./hash";
import { type DesignSpec, DesignSpecSchema, SPEC_VERSION } from "./schema";

/** Why a link did not open: damaged bytes, another spec version, or a failed schema check. */
export type DecodeReason = "corrupt" | "version" | "schema";

/**
 * `decodeSpec` throws this, and nothing else, for a link it cannot open. `reason` says why, and
 * for `schema` `issues` lists the failing paths. The message names the reason and never quotes
 * the link or its payload.
 */
export class SpecDecodeError extends Error {
  readonly reason: DecodeReason;
  declare readonly issues?: readonly string[];

  constructor(reason: DecodeReason, detail: string, issues?: readonly string[]) {
    super(`Cannot open this design link (${reason}): ${detail}.`);
    this.name = "SpecDecodeError";
    this.reason = reason;
    if (issues !== undefined) this.issues = issues;
  }
}

// R-22: the guards and the trailer.
const MAX_LINK_LENGTH = 65_536;
const MAX_INFLATED_BYTES = 1024 * 1024;
const TRAILER_BYTES = 8;
/**
 * Input bytes per inflate step. Deflate expands at most about 1,032 times, so one step adds at
 * most about 0.5 MiB, and inflating stops soon after the output passes 1 MiB.
 */
const INFLATE_STEP = 512;
const DEFLATE_LEVEL = 9;

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const DIGITS = new Uint8Array(128);
for (let i = 0; i < ALPHABET.length; i++) DIGITS[ALPHABET.charCodeAt(i)] = i;

/** base64url without padding; the unused low bits of a final partial group are zero. */
function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63] + ALPHABET[n & 63];
  }
  if (i + 1 === bytes.length) {
    const n = bytes[i] << 16;
    out += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63];
  } else if (i + 2 === bytes.length) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63];
  }
  return out;
}

/** The bytes of a string already checked against the base64url alphabet. */
function fromBase64Url(text: string): Uint8Array {
  const out = new Uint8Array(Math.floor((text.length * 6) / 8));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < text.length; i++) {
    // At most 6 bits wait in the buffer between characters, so 12 bits hold all that matter.
    buffer = ((buffer & 63) << 6) | DIGITS[text.charCodeAt(i)];
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out;
}

const hexOfBytes = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const corrupt = (detail: string): SpecDecodeError => new SpecDecodeError("corrupt", detail);

/** Inflates raw deflate in steps and stops once the output passes 1 MiB (R-22). */
function inflateCapped(deflated: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  let total = 0;
  const inflater = new Inflate((chunk) => {
    total += chunk.length;
    if (total > MAX_INFLATED_BYTES) throw corrupt("the design inflates past 1 MiB");
    parts.push(chunk);
  });
  try {
    for (let start = 0; start < deflated.length; start += INFLATE_STEP) {
      const end = Math.min(start + INFLATE_STEP, deflated.length);
      inflater.push(deflated.subarray(start, end), end === deflated.length);
    }
  } catch (error) {
    if (error instanceof SpecDecodeError) throw error;
    throw corrupt("the payload is not a complete deflate-raw stream");
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Strict UTF-8: the text must encode back to the same bytes, so U+FFFD never stands in. */
function utf8(bytes: Uint8Array): string {
  let text: string;
  try {
    text = strFromU8(bytes);
  } catch {
    // fflate's own decoder, used where TextDecoder is missing, throws on some invalid bytes.
    throw corrupt("the design is not valid UTF-8");
  }
  if (!sameBytes(strToU8(text), bytes)) throw corrupt("the design is not valid UTF-8");
  return text;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw corrupt("the design is not JSON");
  }
}

/** The payload's own `version`, or undefined when it is not an object that has one. */
function versionOf(json: unknown): unknown {
  if (typeof json !== "object" || json === null || Array.isArray(json)) return undefined;
  return Object.hasOwn(json, "version") ? (json as Record<string, unknown>).version : undefined;
}

/** The failing paths, dotted (`color.roles.light.ring`), in order and without repeats. */
function pathsOf(issues: ReadonlyArray<{ readonly path: readonly PropertyKey[] }>): string[] {
  const paths = issues.map((issue) => issue.path.map(String).join(".") || "(root)");
  return [...new Set(paths)];
}

/**
 * A share link for a spec (spec R-22): base64url without padding of
 * `deflateRaw(utf8(canonicalize(spec)), level 9)` followed by the FNV-1a 64 of those deflate
 * bytes, big-endian. The same spec gives the same link. A spec whose canonical form fails the
 * schema throws RangeError naming the paths, so every link this returns opens.
 */
export function encodeSpec(spec: DesignSpec): string {
  const text = canonicalize(spec);
  const checked = DesignSpecSchema.safeParse(JSON.parse(text));
  if (!checked.success) {
    const paths = pathsOf(checked.error.issues).join(", ");
    throw new RangeError(`encodeSpec: spec does not match ${SPEC_VERSION} at ${paths}`);
  }
  const deflated = deflateSync(strToU8(text), { level: DEFLATE_LEVEL });
  const trailer = fnv1a64(deflated);
  const bytes = new Uint8Array(deflated.length + TRAILER_BYTES);
  bytes.set(deflated);
  for (let i = 0; i < TRAILER_BYTES; i++) {
    bytes[deflated.length + i] = Number.parseInt(trailer.slice(2 * i, 2 * i + 2), 16);
  }
  return toBase64Url(bytes);
}

/**
 * Opens a share link (spec R-22, section 6.7), in this order: the length guard; the base64url
 * alphabet; decoding, and re-encoding to the same text; the trailer, checked before anything is
 * inflated; inflating with a 1 MiB cap; strict UTF-8; JSON; the version; the schema; then the
 * schema again on the canonical form, so a valid payload comes back normalized. A failure up
 * to JSON is `corrupt`. A `version` string other than `dyelot.spec/1` is `version`. A missing or
 * non-string version, or any other schema failure, is `schema`, with `issues`. A link that is not
 * a string throws TypeError.
 */
export function decodeSpec(s: string): DesignSpec {
  if (typeof s !== "string") {
    throw new TypeError(`decodeSpec: s must be a string, got ${describeType(s)}`);
  }
  if (s.length > MAX_LINK_LENGTH) throw corrupt("the link is longer than 65,536 characters");
  if (!BASE64URL.test(s)) throw corrupt("the link is empty or has a character outside base64url");
  const bytes = fromBase64Url(s);
  if (toBase64Url(bytes) !== s) throw corrupt("the link is not canonical base64url");
  if (bytes.length <= TRAILER_BYTES) throw corrupt("the link is too short to hold a design");
  const deflated = bytes.subarray(0, bytes.length - TRAILER_BYTES);
  const trailer = bytes.subarray(bytes.length - TRAILER_BYTES);
  if (hexOfBytes(trailer) !== fnv1a64(deflated)) throw corrupt("the integrity check failed");
  const json = parseJson(utf8(inflateCapped(deflated)));
  const version = versionOf(json);
  if (typeof version === "string" && version !== SPEC_VERSION) {
    throw new SpecDecodeError(
      "version",
      `it was made for another spec version than ${SPEC_VERSION}`,
    );
  }
  const parsed = parseSchema(json);
  // A valid payload that is not in canonical form (another engine's key order, more digits) is
  // stored as canonicalize writes it, so the decoded spec equals its canonical form (spec 6.7).
  return parseSchema(JSON.parse(canonicalize(parsed)));
}

/** The schema's parse, with a failure as `SpecDecodeError("schema")` listing the paths. */
function parseSchema(json: unknown): DesignSpec {
  const parsed = DesignSpecSchema.safeParse(json);
  if (!parsed.success) {
    const paths = pathsOf(parsed.error.issues);
    const count = `${paths.length} ${paths.length === 1 ? "path fails" : "paths fail"}`;
    throw new SpecDecodeError("schema", `it does not match ${SPEC_VERSION} (${count})`, paths);
  }
  return parsed.data;
}
