// The shapes an import returns (spec section 5.4), the messages of its errors (section 8) and the
// checks both importers run before they read a text. Pure: no DOM, storage, network or clock.

import type {
  Hex,
  Mode,
  NEUTRAL_TINTS,
  PairingId,
  RadiusSet,
  RoleName,
  TypeContext,
} from "@/engine";
import type { DesignSpec } from "@/spec";

/** The longest import, in UTF-8 bytes of the raw text, before any normalization. */
export const IMPORT_MAX_BYTES = 262_144;

export type ImportFormat = "design-md" | "shadcn-css";

export type ImportErrorCode =
  | "empty"
  | "too-large"
  | "binary"
  | "no-roles"
  | "no-primary"
  | "yaml"
  | "yaml-alias"
  | "yaml-group-twice"
  | "yaml-too-large";

export type ImportError = {
  readonly code: ImportErrorCode;
  /** A sentence with a way forward (section 8). */
  readonly message: string;
  /** 1-based, for the YAML errors. */
  readonly line?: number;
};

export type ImportReport = {
  readonly format: ImportFormat;
  /** R3-32: the result is the spec of a DESIGN.md's edit link, unchanged. */
  readonly exact: boolean;
  readonly mapped: readonly { mode: Mode; role: RoleName; source: string }[];
  readonly adjusted: readonly {
    mode: Mode;
    role: RoleName;
    reason: "gamut" | "alpha" | "foreground";
    from: string;
    to: Hex;
  }[];
  readonly generated: {
    readonly light: number;
    readonly dark: number;
    readonly darkGenerated: boolean;
  };
  readonly inferred: {
    tint: (typeof NEUTRAL_TINTS)[number];
    radius: RadiusSet;
    context: TypeContext;
    pairing: PairingId | null;
    customFonts: boolean;
  };
  /** Names and sections the import did not read, in input order, at most `IGNORED_MAX`. */
  readonly ignored: readonly string[];
  /** How many more were ignored. */
  readonly ignoredMore: number;
  /** Text fields `toPlainText` cut or dropped. */
  readonly truncated: readonly string[];
  readonly notes: readonly string[];
};

export type ImportResult =
  | { readonly ok: true; readonly spec: DesignSpec; readonly report: ImportReport }
  | { readonly ok: false; readonly error: ImportError };

/** The importer's half of an `ImportReport`; `buildImport` adds the rest. */
export type ReportDraft = {
  readonly ignored: readonly string[];
  readonly truncated: readonly string[];
  readonly notes: readonly string[];
};

/** The most names `ImportReport.ignored` lists. */
export const IGNORED_MAX = 50;

/** The messages of section 8 that hold no variable part. */
export const ERROR_MESSAGES = Object.freeze({
  empty: "The import is empty. Paste a DESIGN.md or a shadcn theme, or choose a file.",
  "too-large":
    "That is larger than 256 KB. Import a DESIGN.md or a theme stylesheet of at most 256 KB.",
  binary: "That does not look like text. Choose a .md or a .css file.",
  "no-roles":
    "No theme colors were found. A shadcn theme defines variables such as --background and --primary in :root.",
  "no-primary": "No primary color was found. Add a primary color, then import again.",
  "yaml-too-large":
    "The YAML holds more than 64 KB. Keep the tokens under 64 KB, then import again.",
} as const);

export function describeType(value: unknown): string {
  if (value === null) return "null";
  return Array.isArray(value) ? "array" : typeof value;
}

/** A failed import of the code, with its fixed message. */
export function failure(code: keyof typeof ERROR_MESSAGES): {
  readonly ok: false;
  readonly error: ImportError;
} {
  return { ok: false, error: { code, message: ERROR_MESSAGES[code] } };
}

/** At most 1 in 100 characters of a text may be U+FFFD before it reads as binary. */
const REPLACEMENT_SHARE = 100;

/**
 * The checks both importers run, in the order of section 8: the input is a string (a `TypeError`
 * naming `caller` otherwise), its raw UTF-8 length fits, it is not empty after normalization, and
 * it holds no U+0000 and fewer than 1 in 100 U+FFFD. `normalized` drops a leading byte-order mark
 * and turns CRLF and CR into LF.
 */
export function checkInput(
  text: string,
  caller: string,
):
  | { readonly ok: true; readonly normalized: string }
  | { readonly ok: false; readonly error: ImportError } {
  if (typeof text !== "string") {
    throw new TypeError(`${caller}: text must be a string, got ${describeType(text)}`);
  }
  if (text.length > IMPORT_MAX_BYTES || new TextEncoder().encode(text).length > IMPORT_MAX_BYTES) {
    return failure("too-large");
  }
  const normalized = (text.startsWith("﻿") ? text.slice(1) : text).replace(/\r\n?/g, "\n");
  if (normalized.trim() === "") return failure("empty");
  let replacements = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    const unit = normalized.charCodeAt(i);
    if (unit === 0) return failure("binary");
    if (unit === 0xfffd) replacements += 1;
  }
  if (replacements * REPLACEMENT_SHARE >= normalized.length) {
    return failure("binary");
  }
  return { ok: true, normalized };
}
