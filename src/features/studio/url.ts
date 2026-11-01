import { type DesignSpec, decodeSpec, encodeSpec, SpecDecodeError } from "@/spec";
import { assertOneOf, assertRecord, assertString } from "./guards";

// The share link in the URL hash and the words of the studio's notices (spec R2-14, section 5.7).
// Pure: the store reads `location.hash` and writes `history` itself.

/** Why a link did not open: `SpecDecodeError`'s reasons. */
export type LinkReason = "corrupt" | "version" | "schema";

/**
 * A message the studio shows instead of an error (I-M2-03). `fallback` says which design the
 * studio holds instead of a link it could not open: the last draft, a fresh design, or, for a bad
 * link that arrives mid-session (`hashchange`), the current design.
 */
export type Notice =
  | {
      readonly kind: "link";
      readonly reason: LinkReason;
      readonly issues?: readonly string[];
      readonly fallback: "draft" | "fresh" | "current";
    }
  | { readonly kind: "generation"; readonly message: string }
  | { readonly kind: "custom-fonts" }
  | { readonly kind: "draft-restored" }
  | { readonly kind: "copy-blocked" };

export type HashResult =
  | { readonly kind: "none" }
  | { readonly kind: "spec"; readonly spec: DesignSpec }
  | { readonly kind: "error"; readonly reason: LinkReason; readonly issues?: readonly string[] };

const PREFIX = "#s=";
const NOTICE_KINDS = ["link", "generation", "custom-fonts", "draft-restored", "copy-blocked"];
const REASONS: readonly LinkReason[] = ["corrupt", "version", "schema"];
const FALLBACKS = ["draft", "fresh", "current"] as const;

/**
 * Reads a URL hash (R2-14 item 1). A hash that does not start with `#s=` is no link; `#s=` with
 * a rest that `decodeSpec` rejects is an error with the decoder's reason and, for `schema`, the
 * failing paths. A decoded spec is already normalized: `decodeSpec` checks its canonical form.
 */
export function readHash(hash: string): HashResult {
  assertString(hash, "readHash: hash");
  if (!hash.startsWith(PREFIX)) return { kind: "none" };
  try {
    return { kind: "spec", spec: decodeSpec(hash.slice(PREFIX.length)) };
  } catch (error) {
    if (!(error instanceof SpecDecodeError)) throw error;
    return error.issues === undefined
      ? { kind: "error", reason: error.reason }
      : { kind: "error", reason: error.reason, issues: error.issues };
  }
}

/** `encodeSpec`, with a failure renamed for the public function that called it. */
function linkOf(spec: DesignSpec, caller: string): string {
  assertRecord(spec, `${caller}: spec`);
  try {
    return encodeSpec(spec);
  } catch (error) {
    if (error instanceof RangeError) throw new RangeError(`${caller}: ${error.message}`);
    if (error instanceof TypeError) throw new TypeError(`${caller}: ${error.message}`);
    throw error;
  }
}

/** The hash that holds a spec: `#s=<encodeSpec(spec)>`. */
export function writeHash(spec: DesignSpec): string {
  return `${PREFIX}${linkOf(spec, "writeHash")}`;
}

/** The share link of a spec: `<origin>/studio#s=...`. `origin` is a bare origin, no path. */
export function linkUrl(origin: string, spec: DesignSpec): string {
  assertString(origin, "linkUrl: origin");
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new RangeError(`linkUrl: origin must be a URL origin, got ${JSON.stringify(origin)}`);
  }
  if (parsed.origin !== origin) {
    throw new RangeError(`linkUrl: origin must have no path, got ${JSON.stringify(origin)}`);
  }
  return `${origin}/studio${PREFIX}${linkOf(spec, "linkUrl")}`;
}

const LINK_MESSAGES: Readonly<Record<Exclude<LinkReason, "schema">, string>> = {
  corrupt: "This link is damaged or cut short, so the studio cannot open it.",
  version:
    "This link comes from another version of the design format, so the studio cannot open it.",
};

const FALLBACK_DETAILS: Readonly<Record<(typeof FALLBACKS)[number], string>> = {
  draft: "The studio opened your last draft instead.",
  fresh: "The studio opened a fresh design instead.",
  current: "The studio kept the current design.",
};

function schemaMessage(issues: readonly string[] | undefined): string {
  const count = issues?.length ?? 0;
  if (count === 0) return "This link holds a design the studio cannot read.";
  const fields = count === 1 ? "1 field fails" : `${count} fields fail`;
  return `This link holds a design the studio cannot read: ${fields} the format check.`;
}

/**
 * The words of a notice: a first sentence and a second that says what the studio did (R2-14 item
 * 3, C-HASH-10). No message quotes a link, a payload or an engine error (I-M2-03).
 */
export function bannerFor(notice: Notice): { message: string; detail: string } {
  assertRecord(notice, "bannerFor: notice");
  assertOneOf(notice.kind, NOTICE_KINDS, "bannerFor: notice.kind");
  switch (notice.kind) {
    case "link": {
      assertOneOf(notice.reason, REASONS, "bannerFor: notice.reason");
      assertOneOf(notice.fallback, FALLBACKS, "bannerFor: notice.fallback");
      const message =
        notice.reason === "schema" ? schemaMessage(notice.issues) : LINK_MESSAGES[notice.reason];
      return { message, detail: FALLBACK_DETAILS[notice.fallback] };
    }
    case "generation":
      return {
        message: "The studio could not generate this change.",
        detail: "Revert to return to the last design.",
      };
    case "custom-fonts":
      return {
        message: "This design uses fonts outside the studio's pairings.",
        detail: "Editing it resets the fonts to the automatic pairing.",
      };
    case "draft-restored":
      return { message: "Restored your last draft.", detail: "" };
    case "copy-blocked":
      return { message: "Copy blocked. Select the link below.", detail: "" };
  }
}
