import { assertString, describeType } from "@/features/studio/guards";
import type { ImportReport } from "@/import";

// The import dialog's pure helpers (spec section 9.3, R3-33). The dialog loads `@/import` only
// through `import()`, so the byte limit and the `too-large` sentence are written here too; the form
// test checks the limit against the module's own.

/** The two formats of an import (`@/import` keeps the name private). */
export type ImportFormat = ImportReport["format"];

/** `IMPORT_MAX_BYTES` of `@/import`: a file over this is refused before it is read. */
const MAX_BYTES = 262_144;
const FORMATS: readonly string[] = ["design-md", "shadcn-css"];
const EXTENSIONS = [".md", ".markdown", ".css", ".txt"];

const TOO_LARGE =
  "That is larger than 256 KB. Import a DESIGN.md or a theme stylesheet of at most 256 KB.";
const WRONG_EXTENSION = "Choose a .md or a .css file.";

function checkFormat(value: unknown, what: string): ImportFormat | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new TypeError(
      `chosenFormat: ${what} must be a string or null, got ${describeType(value)}`,
    );
  }
  if (!FORMATS.includes(value)) {
    throw new RangeError(
      `chosenFormat: ${what} must be "design-md" or "shadcn-css", got ${JSON.stringify(value)}`,
    );
  }
  return value as ImportFormat;
}

/** The format the dialog uses: the visitor's pick, else what `detectImport` found, else none. */
export function chosenFormat(
  picked: ImportFormat | null,
  detected: ImportFormat | null,
): ImportFormat | null {
  const pick = checkFormat(picked, "picked");
  const detect = checkFormat(detected, "detected");
  return pick ?? detect;
}

/** Whether a file may be read: its extension and size, checked before any read. */
export function fileAccepted(
  name: string,
  size: number,
): { readonly ok: true } | { readonly ok: false; readonly message: string } {
  assertString(name, "fileAccepted: name");
  if (typeof size !== "number") {
    throw new TypeError(`fileAccepted: size must be a number, got ${describeType(size)}`);
  }
  if (!Number.isInteger(size) || size < 0) {
    throw new RangeError(`fileAccepted: size must be a whole number of bytes, got ${size}`);
  }
  const lower = name.toLowerCase();
  if (!EXTENSIONS.some((extension) => lower.endsWith(extension))) {
    return { ok: false, message: WRONG_EXTENSION };
  }
  if (size > MAX_BYTES) return { ok: false, message: TOO_LARGE };
  return { ok: true };
}
