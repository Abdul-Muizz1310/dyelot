import { normalizeSeed, type Oklch, parseColor } from "@/engine";
import { type DesignSpec, decodeSpec, encodeSpec, SpecDecodeError, toPlainText } from "@/spec";
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
  | { readonly kind: "copy-blocked" }
  | {
      /** An import's notice (R3-33): the roles the file set in each mode and the colors adjusted. */
      readonly kind: "imported";
      readonly format: "design-md" | "shadcn-css";
      readonly exact: boolean;
      readonly light: number;
      readonly dark: number;
      readonly adjusted: number;
      /** Present, and true, when the file's fonts are outside the catalog. */
      readonly customFonts?: true;
    };

export type HashResult =
  | { readonly kind: "none" }
  | { readonly kind: "spec"; readonly spec: DesignSpec }
  | { readonly kind: "error"; readonly reason: LinkReason; readonly issues?: readonly string[] };

const PREFIX = "#s=";
const NOTICE_KINDS = [
  "link",
  "generation",
  "custom-fonts",
  "draft-restored",
  "copy-blocked",
  "imported",
];
const FORMAT_NAMES = { "design-md": "DESIGN.md", "shadcn-css": "shadcn theme" } as const;
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

/** What an entry hash asks the studio to start from (R6-23). */
export type EntryHash =
  | { readonly kind: "color"; readonly seed: Oklch }
  | { readonly kind: "brief"; readonly text: string }
  | { readonly kind: "image" };

export type EntryResult =
  | { readonly kind: "none" }
  | { readonly kind: "entry"; readonly entry: EntryHash }
  | { readonly kind: "malformed" };

const ENTRY_PREFIXES = ["#color=", "#brief=", "#start="] as const;
const HEX6 = /^[0-9a-fA-F]{6}$/;
const BRIEF_RAW_MAX = 6000;
const BRIEF_MAX = 500;
const MALFORMED: EntryResult = Object.freeze({ kind: "malformed" });

function entryOf(entry: EntryHash): EntryResult {
  return Object.freeze({ kind: "entry", entry: Object.freeze(entry) });
}

/**
 * Reads the studio's entry hashes (R6-23, 10.1): `#color=<six hex digits>`, `#brief=<text>` and
 * `#start=image`. Another hash, `#s=` included, is `none`; a prefixed hash that is not valid is
 * `malformed`. A `+` in a brief stays a `+`. Only a non-string throws.
 */
export function readEntry(hash: string): EntryResult {
  assertString(hash, "readEntry: hash");
  const prefix = ENTRY_PREFIXES.find((item) => hash.startsWith(item));
  if (prefix === undefined) return Object.freeze({ kind: "none" });
  const value = hash.slice(prefix.length);
  if (prefix === "#color=") {
    if (!HEX6.test(value)) return MALFORMED;
    return entryOf({ kind: "color", seed: normalizeSeed(parseColor(`#${value.toLowerCase()}`)) });
  }
  if (prefix === "#start=") return value === "image" ? entryOf({ kind: "image" }) : MALFORMED;
  if (value.length > BRIEF_RAW_MAX) return MALFORMED;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return MALFORMED;
  }
  const plain = toPlainText(decoded, BRIEF_MAX);
  if (plain === null || plain.truncated) return MALFORMED;
  return entryOf({ kind: "brief", text: plain.text });
}

/** `encodeSpec`, with a failure renamed for the public function that called it. */
export function encodeLink(spec: DesignSpec, caller: string): string {
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
  return `${PREFIX}${encodeLink(spec, "writeHash")}`;
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
  return `${origin}/studio${PREFIX}${encodeLink(spec, "linkUrl")}`;
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
    case "imported": {
      assertOneOf(notice.format, Object.keys(FORMAT_NAMES), "bannerFor: notice.format");
      const undo = "Undo returns to the design before.";
      if (notice.exact) {
        return { message: "Imported the DESIGN.md exactly, from its edit link.", detail: undo };
      }
      const rest: string[] = [];
      if (notice.adjusted > 0) {
        rest.push(
          notice.adjusted === 1
            ? "1 color was adjusted to fit sRGB or drop alpha."
            : `${notice.adjusted} colors were adjusted to fit sRGB or drop alpha.`,
        );
      }
      if (notice.customFonts === true) {
        rest.push("Its fonts are not in dyelot's catalog, so the canvas shows a fallback.");
      }
      rest.push(undo);
      return {
        message: `Imported a ${FORMAT_NAMES[notice.format]}: ${notice.light} of 46 light roles and ${notice.dark} of 46 dark roles came from the file.`,
        detail: rest.join(" "),
      };
    }
  }
}
