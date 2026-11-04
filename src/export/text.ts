import { type DesignSpec, encodeSpec, isPlainText } from "@/spec";

// The text helpers of the export (R3-10, I-M3-08): user text reaches a file only through `slug`,
// `mdText`, `yamlString`, `cssComment` or `JSON.stringify`.

const SLUG_MAX = 48;
const FALLBACK_SLUG = "design";

function describeType(value: unknown): string {
  return value === null ? "null" : typeof value;
}

function needString(value: unknown, who: string): asserts value is string {
  if (typeof value !== "string") {
    throw new TypeError(`${who}: text must be a string, got ${describeType(value)}`);
  }
}

function needPlain(value: unknown, who: string): string {
  needString(value, who);
  if (!isPlainText(value)) {
    throw new RangeError(`${who}: text must be plain text, got ${JSON.stringify(value)}`);
  }
  return value;
}

// The fixed fold table of U+00C0 to U+017F (never `normalize`): each run is `[ASCII, how many
// code points]`, from U+00C0 on. U+00D7 and U+00F7 are signs, not letters, and stay out.
const FOLD_RUNS: readonly (readonly [string, number])[] = [
  ["a", 6],
  ["ae", 1],
  ["c", 1],
  ["e", 4],
  ["i", 4],
  ["d", 1],
  ["n", 1],
  ["o", 5],
  ["-", 1],
  ["o", 1],
  ["u", 4],
  ["y", 1],
  ["th", 1],
  ["ss", 1],
  ["a", 6],
  ["ae", 1],
  ["c", 1],
  ["e", 4],
  ["i", 4],
  ["d", 1],
  ["n", 1],
  ["o", 5],
  ["-", 1],
  ["o", 1],
  ["u", 4],
  ["y", 1],
  ["th", 1],
  ["y", 1],
  ["a", 6],
  ["c", 8],
  ["d", 4],
  ["e", 10],
  ["g", 8],
  ["h", 4],
  ["i", 10],
  ["ij", 2],
  ["j", 2],
  ["k", 3],
  ["l", 10],
  ["n", 7],
  ["ng", 2],
  ["o", 6],
  ["oe", 2],
  ["r", 6],
  ["s", 8],
  ["t", 6],
  ["u", 12],
  ["w", 2],
  ["y", 3],
  ["z", 6],
  ["s", 1],
];

const FOLD: ReadonlyMap<number, string> = new Map(
  FOLD_RUNS.flatMap(([ascii, count]) => Array.from({ length: count }, () => ascii)).map(
    (ascii, index) => [0xc0 + index, ascii] as const,
  ),
);

function fold(text: string): string {
  let out = "";
  for (const char of text) {
    out += FOLD.get(char.codePointAt(0) as number) ?? char;
  }
  return out;
}

/** The file-name form of a name: ASCII lowercase letters and digits joined by single dashes. */
export function slug(text: string): string {
  needString(text, "slug");
  const folded = fold(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const cut = folded
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
  return cut === "" ? FALLBACK_SLUG : cut;
}

/** Markdown-safe text: backslash-escapes the markup characters and a leading list marker. */
export function mdText(text: string): string {
  needPlain(text, "mdText");
  return text
    .replace(/[\\`*_[\]<>#|~]/g, "\\$&")
    .replace(/^[-+=]/, "\\$&")
    .replace(/^(\d+)\./, "$1\\.");
}

/** A YAML double-quoted scalar. */
export function yamlString(text: string): string {
  needPlain(text, "yamlString");
  return `"${text.replace(/[\\"]/g, "\\$&")}"`;
}

/** A CSS comment that the text cannot close early. */
export function cssComment(text: string): string {
  needPlain(text, "cssComment");
  return `/* ${text.replaceAll("*/", "* /")} */`;
}

/**
 * The link that opens a design in the studio (R3-12): `<origin>/studio#s=<encodeSpec(spec)>`. The
 * origin must be an `https:` origin with no path, query, hash or trailing slash.
 */
export function editLink(spec: DesignSpec, origin: string): string {
  if (typeof origin !== "string") {
    throw new TypeError(`editLink: origin must be a string, got ${describeType(origin)}`);
  }
  let parsed: string | null = null;
  try {
    const url = new URL(origin);
    parsed = url.protocol === "https:" && url.origin === origin ? origin : null;
  } catch {
    parsed = null;
  }
  if (parsed === null) {
    throw new RangeError(
      `editLink: origin must be an https origin with no path, got ${JSON.stringify(origin)}`,
    );
  }
  return `${parsed}/studio#s=${encodeSpec(spec)}`;
}
