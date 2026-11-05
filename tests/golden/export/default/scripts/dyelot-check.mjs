// @ts-check
// dyelot-check: reads a Next.js app, finds the dyelot theme, compares it with receipt.json,
// measures the required contrast pairs again, reports shadowed definitions and scans the source
// for colors that bypass the theme. One file, no dependencies: Node 18 and its own modules only.
// Usage: node scripts/dyelot-check.mjs [--root <dir>] [--receipt <path>] [--json]

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * @typedef {{ name: string, kind: "file" | "dir" | "link" }} DirEntry
 * @typedef {object} CheckIo
 * @property {(file: string) => string | null} readFile The text of a file, or null when it cannot be read.
 * @property {(dir: string) => readonly DirEntry[] | null} readDir The entries of a folder, or null when it is not one.
 * @property {(file: string) => number} size The size of a file in bytes.
 * @property {string} cwd The folder the run starts in.
 * @property {(text: string) => void} out Receives the report.
 * @property {(text: string) => void} err Receives an unexpected failure.
 *
 * @typedef {object} Finding
 * @property {string} code
 * @property {string} message
 * @property {string} [path]
 * @property {number} [line]
 * @property {number} [column]
 * @property {string} [text]
 *
 * @typedef {{ path: string, line: number, reason: string }} Ignored
 * @typedef {{ name: string, value: string, offset: number, end: number, line: number }} Decl
 * @typedef {{ selector: string, kind: string, decls: Decl[], offset: number }} Block
 * @typedef {{ path: string, text: string }} Sheet
 * @typedef {{ roles: Record<string, Record<string, string>>, radius: string, contrast: Record<string, any>[], files: { path: string, sha256?: string }[], design?: Record<string, any> }} Receipt
 */

const RECEIPT_FORMAT = "dyelot.check/1";
const REPORT_FORMAT = "dyelot.check-report/1";
const GLOBALS = ["app/globals.css", "src/app/globals.css", "styles/globals.css"];
const MAX_BYTES = 1024 * 1024;
const SCAN_EXTENSIONS = new Set(
  ".ts .tsx .js .jsx .mjs .cjs .css .scss .html .vue .svelte .astro .mdx".split(" "),
);
const SKIP_FOLDERS = new Set(["node_modules", ".git", ".next", "dist", "build", "out", "coverage"]);
const PALETTES =
  "red orange amber yellow lime green emerald teal cyan sky blue indigo violet purple fuchsia pink rose slate gray zinc neutral stone mauve olive mist taupe";
const STEPS = "50|100|200|300|400|500|600|700|800|900|950";
const PREFIXES =
  "bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|divide|shadow|accent|caret|placeholder|inset-ring|inset-shadow|drop-shadow";
const SIDES = "(?:-(?:x|y|t|b|l|r|s|e|offset))?";
const HEX = "(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\\w])";
const FUNCTIONS = "(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)";
const SPACES = "(?:display-p3|srgb|srgb-linear|a98-rgb|prophoto-rgb|rec2020|xyz|xyz-d50|xyz-d65)";
const COLOR_CALL = `(?<![\\w-])(?:${FUNCTIONS}\\(\\s*(?:[-+.\\d]|none\\b)|color\\(\\s*${SPACES}\\b)`;
const MARKER = /dyelot-check-ignore:[ \t]*([^\r\n]*?)[ \t]*(?:\*\/|-->|\}|$)/;

const ARBITRARY = new RegExp(`-\\[(?:#${HEX}|(?:${FUNCTIONS}|color)\\()[^\\]]*\\]`, "g");
const RAW_HEX = new RegExp(`(?<![&\\w])#${HEX}`, "g");
const RAW_CALL = new RegExp(COLOR_CALL, "g");
const PALETTE_CLASS = new RegExp(
  `(?<![\\w-])(?:${PREFIXES})${SIDES}-(?:${PALETTES.split(" ").join("|")})-(?:${STEPS})(?![\\w-])`,
  "g",
);

/**
 * The text with comments blanked, so offsets and lines stay those of the original.
 * @param {string} text
 */
function blank(text) {
  return text.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, (match) => match.replace(/[^\n]/g, " "));
}

/**
 * The 1-based line of an offset.
 * @param {string} text
 * @param {number} offset
 */
function lineOf(text, offset) {
  let line = 1;
  for (let at = text.indexOf("\n"); at !== -1 && at < offset; at = text.indexOf("\n", at + 1)) {
    line += 1;
  }
  return line;
}

/**
 * The offset of the brace that closes the one at `open`, or the end of the text.
 * @param {string} text
 * @param {number} open
 */
function closeOf(text, open) {
  let depth = 0;
  for (let at = open; at < text.length; at += 1) {
    const char = text[at];
    if (char === '"' || char === "'") {
      const end = text.indexOf(char, at + 1);
      at = end === -1 ? text.length : end;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return at;
    }
  }
  return text.length;
}

/**
 * The custom property declarations at the top level of a rule body.
 * @param {string} source
 * @param {string} text
 * @param {number} from
 * @param {number} to
 * @returns {Decl[]}
 */
function declsOf(source, text, from, to) {
  /** @type {Decl[]} */
  const decls = [];
  let depth = 0;
  let start = from;
  for (let at = from; at <= to; at += 1) {
    const char = at < to ? text[at] : ";";
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    else if (char === ";" && depth === 0) {
      const piece = text.slice(start, at);
      const match = /^(\s*)(--[\w-]+)\s*:([\s\S]*)$/.exec(piece);
      if (match) {
        const offset = start + (match[1] ?? "").length;
        decls.push({
          name: match[2] ?? "",
          value: (match[3] ?? "").trim(),
          offset,
          end: at,
          line: lineOf(source, offset),
        });
      }
      start = at + 1;
    }
  }
  return decls;
}

/**
 * The rule blocks of a stylesheet, in order, with those inside `@layer`, `@media` and `@supports`
 * flattened. A block holds its selector or at-rule prelude, its kind (`rule`, or `theme` and
 * `theme-inline` for `@theme`) and its custom property declarations.
 * @param {string} source
 * @returns {Block[]}
 */
export function parseBlocks(source) {
  const text = blank(source);
  /** @type {Block[]} */
  const blocks = [];
  /** @param {number} from @param {number} to */
  const walk = (from, to) => {
    let start = from;
    let at = from;
    while (at < to) {
      const char = text[at];
      if (char === ";" || char === "}") {
        start = at + 1;
        at += 1;
      } else if (char === "{") {
        const close = closeOf(text, at);
        const prelude = text.slice(start, at).trim();
        if (/^@(?:layer|media|supports|container)\b/.test(prelude)) {
          walk(at + 1, close);
        } else {
          const theme = /^@theme\b\s*(inline)?/.exec(prelude);
          blocks.push({
            selector: prelude,
            kind: theme ? (theme[1] ? "theme-inline" : "theme") : "rule",
            decls: declsOf(source, text, at + 1, close),
            offset: at,
          });
        }
        start = close + 1;
        at = close + 1;
      } else {
        at += 1;
      }
    }
  };
  walk(0, text.length);
  return blocks;
}

/** @param {Block} block @param {string} wanted */
function hasSelector(block, wanted) {
  return block.kind === "rule" && block.selector.split(",").some((part) => part.trim() === wanted);
}

/**
 * The relative stylesheets a file imports, in order, with the offset of each `@import`.
 * @param {string} source
 * @returns {{ target: string, offset: number }[]}
 */
function importsOf(source) {
  const text = blank(source);
  const found = [];
  const pattern = /@import\s+(?:url\(\s*(["']?)([^)"']*)\1\s*\)|(["'])([^"']*)\3)[^;]*;/g;
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    const target = match[2] ?? match[4] ?? "";
    if (target.startsWith(".")) found.push({ target, offset: match.index });
  }
  return found;
}

/** @param {string} value */
const normalize = (value) => value.replace(/\s+/g, "").toLowerCase();

/**
 * The names of the roles a stylesheet declares in `:root` or `.dark`.
 * @param {Block[]} blocks
 * @returns {Set<string>}
 */
function definedRoles(blocks) {
  /** @type {Set<string>} */
  const names = new Set();
  for (const block of blocks) {
    if (hasSelector(block, ":root") || hasSelector(block, ".dark")) {
      for (const decl of block.decls) names.add(decl.name.slice(2));
    }
  }
  return names;
}

/**
 * Finds the theme under `root`: the first existing global stylesheet, the `theme.css` it imports,
 * or the stylesheet itself when it defines every role.
 * @param {string} root
 * @param {CheckIo} io
 * @param {readonly string[]} roles The role names the receipt holds.
 * @returns {{ ok: true, global: Sheet, theme: Sheet, imports: { target: string, offset: number, sheet: Sheet | null }[], importAt: number } | { ok: false, error: string }}
 */
export function resolveTheme(root, io, roles) {
  const present = GLOBALS.map((rel) => ({ rel, text: io.readFile(path.join(root, rel)) })).find(
    (entry) => entry.text !== null,
  );
  if (present === undefined) {
    return {
      ok: false,
      error:
        "No theme found: none of app/globals.css, src/app/globals.css and styles/globals.css exists.",
    };
  }
  const global = { path: present.rel, text: present.text ?? "" };
  const imports = importsOf(global.text).map((entry) => {
    const rel = path.posix.normalize(
      path.posix.join(path.posix.dirname(global.path), entry.target),
    );
    const text = io.readFile(path.join(root, rel));
    return { ...entry, sheet: text === null ? null : { path: rel, text } };
  });
  const named = imports.find(
    (entry) => entry.sheet !== null && path.posix.basename(entry.sheet.path) === "theme.css",
  );
  if (named?.sheet)
    return { ok: true, global, theme: named.sheet, imports, importAt: named.offset };
  const defined = definedRoles(parseBlocks(global.text));
  if (roles.every((name) => defined.has(name))) {
    return { ok: true, global, theme: global, imports, importAt: -1 };
  }
  return {
    ok: false,
    error: `No theme found: ${global.path} imports no theme.css and does not define every role.`,
  };
}

/**
 * The WCAG 2.2 contrast ratio of two `#rrggbb` colors, on the engine's constants.
 * @param {string} fg
 * @param {string} bg
 * @returns {number}
 */
export function wcag(fg, bg) {
  /** @param {string} hex */
  const luminance = (hex) => {
    /** @param {number} at */
    const channel = (at) => {
      const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return Math.min(1, 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5));
  };
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * A ratio cut toward zero at 4 decimals, from the digits of `String(x)`.
 * @param {number} x
 */
function trunc4(x) {
  const [whole = "0", fraction = ""] = String(x).split(".");
  const cut = fraction.slice(0, 4).replace(/0+$/, "");
  return cut === "" ? whole : `${whole}.${cut}`;
}

const SCALE_PALETTES = [
  "neutral",
  "primary",
  "secondary",
  "accent",
  "success",
  "warning",
  "danger",
  "info",
];
const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/**
 * The text with each span blanked, line ends kept, so lines and columns stay those of the original.
 * @param {string} text
 * @param {readonly [number, number][]} spans
 */
function masked(text, spans) {
  if (spans.length === 0) return text;
  const units = text.split("");
  for (const [from, to] of spans) {
    for (let at = from; at < to; at += 1) {
      if (units[at] !== "\n" && units[at] !== "\r") units[at] = " ";
    }
  }
  return units.join("");
}

/**
 * The color call that starts at `from`: the whole call when its closing parenthesis is on the
 * line, else the function's name and its opening parenthesis. `named` is what a message prints.
 * @param {string} line
 * @param {number} from
 * @returns {{ text: string, named: string }}
 */
function callAt(line, from) {
  const open = line.indexOf("(", from);
  let depth = 0;
  for (let at = open; at < line.length; at += 1) {
    if (line[at] === "(") depth += 1;
    else if (line[at] === ")") {
      depth -= 1;
      if (depth === 0) {
        const text = line.slice(from, at + 1);
        return { text, named: text };
      }
    }
  }
  const head = line.slice(from, open + 1);
  return { text: head, named: `${head})` };
}

/**
 * Scans one line of source, whose judged declarations are already masked.
 * @param {string} line
 * @returns {{ findings: { code: string, column: number, text: string, message: string }[], ignored: string | null }}
 */
export function scanLine(line) {
  /** @type {{ code: string, column: number, text: string, message: string }[]} */
  const findings = [];
  /** @param {RegExpMatchArray} match */
  const start = (match) => match.index ?? 0;
  const marker = MARKER.exec(line);
  if (marker) {
    const reason = (marker[1] ?? "").trim();
    if (reason.replace(/\s/g, "").length >= 3) return { findings: [], ignored: reason };
  }
  /** @type {[number, number][]} */
  const taken = [];
  /** @param {string} code @param {RegExpMatchArray} match @param {string} message @param {string} [text] */
  const add = (code, match, message, text = match[0]) => {
    findings.push({ code, column: start(match) + 1, text, message });
    taken.push([start(match), start(match) + text.length]);
  };
  for (const match of line.matchAll(ARBITRARY)) {
    add(
      "arbitrary-color",
      match,
      `The arbitrary color ${match[0]} skips the theme. Use a role class such as bg-primary.`,
    );
  }
  /** @param {RegExpMatchArray} match */
  const free = (match) => !taken.some(([from, to]) => start(match) >= from && start(match) < to);
  for (const match of line.matchAll(RAW_HEX)) {
    if (free(match))
      add(
        "raw-color",
        match,
        `The color ${match[0]} skips the theme. Use a role such as var(--primary).`,
      );
  }
  for (const match of line.matchAll(RAW_CALL)) {
    if (free(match)) {
      const call = callAt(line, start(match));
      add(
        "raw-color",
        match,
        `The color function ${call.named} skips the theme. Use a role such as var(--primary).`,
        call.text,
      );
    }
  }
  for (const match of line.matchAll(PALETTE_CLASS)) {
    add(
      "palette-class",
      match,
      `The class ${match[0]} uses a Tailwind default color. Use a role class such as bg-primary.`,
    );
  }
  if (marker) {
    findings.push({
      code: "marker-without-reason",
      column: start(marker) + 1,
      text: marker[0],
      message:
        "dyelot-check-ignore needs a reason of at least 3 characters, as in dyelot-check-ignore: brand logo.",
    });
  }
  findings.sort((a, b) => a.column - b.column);
  return { findings, ignored: null };
}

/**
 * The role, radius and mapping declarations of a stylesheet's blocks, in order, with their keys.
 * @param {Block[]} blocks
 * @param {{ roles: Set<string>, colors: Set<string> }} names
 * @returns {{ key: string, group: string, decl: Decl }[]}
 */
function themeDecls(blocks, names) {
  /** @type {{ key: string, group: string, decl: Decl }[]} */
  const keyed = [];
  for (const block of blocks) {
    let group = null;
    if (hasSelector(block, ":root")) group = "light";
    else if (hasSelector(block, ".dark")) group = "dark";
    else if (block.kind !== "rule") group = "map";
    if (group === null) continue;
    for (const decl of block.decls) {
      const plain = decl.name.slice(2);
      const role =
        group !== "map" && (names.roles.has(plain) || (group === "light" && plain === "radius"));
      const mapped = group === "map" && names.colors.has(decl.name);
      if (role || mapped) keyed.push({ key: `${group}:${decl.name}`, group, decl });
    }
  }
  return keyed;
}

/** @param {string} root @param {string} dir @param {CheckIo} io @param {Set<string>} own @param {{ path: string, text: string }[]} out */
function walkFiles(root, dir, io, own, out) {
  const entries = io.readDir(path.join(root, dir)) ?? [];
  for (const entry of entries) {
    const rel = dir === "" ? entry.name : `${dir}/${entry.name}`;
    if (entry.kind === "dir") {
      if (!SKIP_FOLDERS.has(entry.name)) walkFiles(root, rel, io, own, out);
    } else if (entry.kind === "file") {
      if (!SCAN_EXTENSIONS.has(path.extname(entry.name)) || own.has(rel)) continue;
      const full = path.join(root, rel);
      if (io.size(full) > MAX_BYTES) continue;
      const text = io.readFile(full);
      if (text !== null) out.push({ path: rel, text });
    }
  }
}

class Stop extends Error {}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  throw new Stop(message);
}

/**
 * The receipt in `text`, checked for its format and the keys the checker reads.
 * @param {string} text
 * @param {string} receiptPath
 * @returns {Receipt}
 */
function readReceipt(text, receiptPath) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail(`The receipt at ${receiptPath} is not valid JSON.`);
  }
  if (parsed === null || typeof parsed !== "object" || parsed.format !== RECEIPT_FORMAT) {
    return fail(`The receipt's format is ${parsed?.format}, not ${RECEIPT_FORMAT}.`);
  }
  /** @param {unknown} value */
  const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const roles = parsed.roles;
  /** @param {unknown} mode */
  const hexes = (mode) =>
    isObject(mode) &&
    Object.values(/** @type {object} */ (mode)).every((v) => /^#[0-9a-f]{6}$/i.test(String(v)));
  if (!isObject(roles) || !hexes(roles.light) || !hexes(roles.dark)) {
    return fail(`The receipt at ${receiptPath} lacks roles.`);
  }
  for (const key of ["contrast", "radius", "files"]) {
    const ok = key === "radius" ? typeof parsed.radius === "string" : Array.isArray(parsed[key]);
    if (!ok) return fail(`The receipt at ${receiptPath} lacks ${key}.`);
  }
  if (!parsed.contrast.every(isObject)) {
    return fail(`The receipt at ${receiptPath} lacks a valid contrast list.`);
  }
  if (
    !parsed.files.every(
      (/** @type {any} */ file) => isObject(file) && typeof file.path === "string",
    )
  ) {
    return fail(`The receipt at ${receiptPath} lacks a valid files list.`);
  }
  return parsed;
}

/**
 * Runs the checker and returns the exit code.
 * @param {readonly string[]} argv
 * @param {CheckIo} io
 * @returns {number}
 */
export function main(argv, io) {
  const json = argv.includes("--json");
  let design = { specId: null, lot: null, name: null };
  /** @type {Finding[]} */
  let findings = [];
  /** @type {Ignored[]} */
  let ignored = [];
  /** @type {{ theme: string | null, roles: number, pairs: number, files: number }} */
  let checked = { theme: null, roles: 0, pairs: 0, files: 0 };

  /** @param {number} code @param {string} [error] */
  const emit = (code, error) => {
    const result = code === 0 ? "PASS" : code === 1 ? "FAIL" : "ERROR";
    if (json) {
      const head = { format: REPORT_FORMAT, result };
      const body = {
        design: { specId: design.specId, lot: design.lot },
        findings,
        ignored,
        checked,
      };
      const report = error === undefined ? { ...head, ...body } : { ...head, error, ...body };
      io.out(`${JSON.stringify(report, null, 2)}\n`);
      return code;
    }
    const lines = [];
    if (error === undefined) {
      lines.push(`dyelot-check · ${design.lot} · ${design.name}`);
      for (const f of findings) {
        lines.push(
          f.path === undefined
            ? `${f.code}  ${f.message}`
            : `${f.path}:${f.line}:${f.column}  ${f.code}  ${f.message}`,
        );
      }
      for (const i of ignored) lines.push(`ignored  ${i.path}:${i.line}  ${i.reason}`);
      lines.push(
        `${checked.roles} roles · ${checked.pairs} pairs · ${checked.files} files scanned`,
      );
      lines.push(
        code === 0
          ? "PASS"
          : `FAIL (${findings.length} ${findings.length === 1 ? "finding" : "findings"})`,
      );
    } else {
      lines.push(`ERROR: ${error}`);
    }
    io.out(`${lines.join("\n")}\n`);
    return code;
  };
  try {
    let rootArg = null;
    let receiptArg = null;
    for (let at = 0; at < argv.length; at += 1) {
      const arg = argv[at];
      if (arg === "--json") continue;
      if (arg === "--root" || arg === "--receipt") {
        const value = argv[at + 1];
        if (value === undefined) fail(`${arg} needs a path.`);
        if (arg === "--root") rootArg = value;
        else receiptArg = value;
        at += 1;
      } else fail(`Unknown option ${arg}.`);
    }
    const root = path.resolve(io.cwd, rootArg ?? ".");
    if (io.readDir(root) === null) fail(`No folder at ${root}.`);
    let receiptPath = path.resolve(io.cwd, receiptArg ?? path.join(root, "receipt.json"));
    let receiptText = io.readFile(receiptPath);
    if (receiptText === null && receiptArg !== null) {
      receiptPath = path.resolve(root, receiptArg);
      receiptText = io.readFile(receiptPath);
    }
    if (receiptText === null) return fail(`No receipt at ${receiptPath}.`);
    const receipt = readReceipt(receiptText, receiptPath);
    const info = receipt.design ?? {};
    design = { specId: info.specId ?? null, lot: info.lot ?? null, name: info.name ?? null };

    const roleNames = Object.keys(receipt.roles.light);
    const resolved = resolveTheme(root, io, roleNames);
    if (!resolved.ok) return fail(resolved.error);
    const { global, theme, imports, importAt } = resolved;
    const themeBlocks = parseBlocks(theme.text);
    const required = receipt.contrast.filter((entry) => entry.required === true);
    checked = { theme: theme.path, roles: roleNames.length * 2, pairs: required.length, files: 0 };

    /** @param {string} code @param {string} message @param {Partial<Finding>} [place] */
    const report = (code, message, place = {}) => findings.push({ code, message, ...place });

    // Check 1: the theme file against the receipt. The receipt hashes the LF file the bundle
    // wrote; a checkout may add a byte order mark or turn LF into CRLF (Git for Windows does).
    if (path.posix.basename(theme.path) === "theme.css") {
      const entry = receipt.files.find((file) => file.path === "app/theme.css");
      const lf = theme.text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
      const hash = createHash("sha256").update(lf, "utf8").digest("hex");
      if (entry?.sha256 !== hash) {
        report(
          "theme-changed",
          `${theme.path} differs from the file in the receipt: export the design again, or restore the file.`,
        );
      }
    }
    // Check 1b: roles, radius and mappings.
    const decls = themeDecls(themeBlocks, {
      roles: new Set([...roleNames, "radius"]),
      colors: new Set(),
    });
    const first = new Map();
    for (const item of decls) if (!first.has(item.key)) first.set(item.key, item.decl);
    /** @type {Record<string, Record<string, string>>} */
    const values = { light: {}, dark: {} };
    for (const mode of ["light", "dark"]) {
      for (const name of roleNames) {
        const want = receipt.roles[mode][name];
        const decl = first.get(`${mode}:--${name}`);
        if (decl === undefined) {
          report("role-missing", `--${name} is missing in ${mode} mode: the receipt has ${want}.`);
          continue;
        }
        values[mode][name] = decl.value;
        if (decl.value.toLowerCase() !== String(want).toLowerCase()) {
          report(
            "role-mismatch",
            `--${name} in ${mode} mode is ${decl.value}, the receipt has ${want}.`,
          );
        }
      }
    }
    const radius = first.get("light:--radius");
    if (radius === undefined || radius.value !== receipt.radius) {
      report(
        "radius-mismatch",
        `--radius is ${radius === undefined ? "missing" : radius.value}, the receipt has ${receipt.radius}.`,
      );
    }
    const escaped = roleNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const scale = `(?:${SCALE_PALETTES.join("|")})-(?:${SCALE_STEPS.join("|")})`;
    /** @param {Decl} decl A `--color-<name>` mapping, which must point at `var(--<name>)`. */
    const judgeMapping = (decl) => {
      const name = decl.name.slice(8);
      if (normalize(decl.value) !== `var(--${name})`) {
        report("theme-name-changed", `${decl.name} points at ${decl.value}, not var(--${name}).`);
      }
    };
    const mapped = new Map();
    /** @type {Decl[]} The registry route's mappings in the theme: check 1b judges them, check 4 masks them. */
    const themeMaps = [];
    if (path.posix.basename(theme.path) === "theme.css") {
      for (const block of themeBlocks) {
        if (block.kind !== "theme-inline") continue;
        for (const decl of block.decls) {
          if (!decl.name.startsWith("--color-")) continue;
          mapped.set(decl.name, decl);
          judgeMapping(decl);
        }
      }
      for (const name of roleNames) {
        if (!mapped.has(`--color-${name}`))
          report("theme-name-changed", `--color-${name} is not mapped in @theme inline.`);
      }
    } else {
      // The registry route: shadcn's CLI writes the mappings, a set that varies by version, so none is
      // required; each role or step mapping the theme's @theme or @theme inline holds keeps its variable.
      const mapping = new RegExp(`^--color-(?:${escaped}|${scale})$`);
      for (const block of themeBlocks) {
        if (block.kind === "rule") continue;
        for (const decl of block.decls) {
          if (!mapping.test(decl.name)) continue;
          themeMaps.push(decl);
          judgeMapping(decl);
        }
      }
    }

    // Check 2: the required pairs, measured again.
    for (const entry of required) {
      const fg = values[entry.mode]?.[entry.foreground];
      const bg = values[entry.mode]?.[entry.background];
      if (!/^#[0-9a-f]{6}$/i.test(fg ?? "") || !/^#[0-9a-f]{6}$/i.test(bg ?? "")) continue;
      const ratio = wcag(fg, bg);
      if (ratio < entry.threshold) {
        report(
          "contrast-fails",
          `${entry.check} in ${entry.mode} mode is ${trunc4(ratio)}, below ${entry.threshold}.`,
        );
      }
    }

    // Check 3: definitions that come after the theme and differ from it.
    const colorNames = new Set(mapped.keys());
    if (path.posix.basename(theme.path) !== "theme.css") {
      for (const block of themeBlocks) {
        if (block.kind === "theme-inline")
          for (const decl of block.decls)
            if (decl.name.startsWith("--color-")) colorNames.add(decl.name);
      }
    }
    const names = { roles: new Set([...roleNames, "radius"]), colors: colorNames };
    const stream = themeDecls(themeBlocks, names).map((item) => ({ ...item, path: theme.path }));
    if (theme !== global) {
      const after = parseBlocks(global.text).filter((block) => block.offset > importAt);
      for (const item of themeDecls(after, names)) stream.push({ ...item, path: global.path });
    }
    for (const entry of imports) {
      if (entry.sheet === null || entry.sheet.path === theme.path || entry.offset <= importAt)
        continue;
      for (const item of themeDecls(parseBlocks(entry.sheet.text), names))
        stream.push({ ...item, path: entry.sheet.path });
    }
    const seen = new Map();
    for (const item of stream) {
      const base = seen.get(item.key);
      if (base === undefined) {
        seen.set(item.key, item);
      } else if (normalize(base.decl.value) !== normalize(item.decl.value)) {
        const place = item.group === "map" ? "@theme" : item.group === "light" ? ":root" : ".dark";
        report(
          "shadowed",
          `${item.decl.name} in ${place} is defined at ${base.path}:${base.decl.line} as ${base.decl.value} and again at ${item.path}:${item.decl.line} as ${item.decl.value}.`,
        );
      }
    }

    // Check 4: the scan.
    // It masks exactly the declarations checks 1b and 3 judge, so none is counted twice: the
    // roles, --radius and --color-<role> or --color-<palette>-<step> mappings in check 3's stream,
    // and on the registry route the theme's own mappings, which check 1b judges. It also masks the
    // scale steps in the theme's :root and .dark, where the registry route writes them (no check
    // judges a step). Every other declaration is scanned like any line, and so is the rest of a
    // masked one's line.
    const judged = new RegExp(`^--(?:${escaped}|radius|color-(?:${escaped}|${scale}))$`);
    const step = new RegExp(`^--${scale}$`);
    /** @type {Map<string, [number, number][]>} */
    const spans = new Map();
    /** @param {string} file @param {Decl} decl */
    const hide = (file, decl) => {
      const list = spans.get(file) ?? [];
      list.push([decl.offset, decl.end]);
      spans.set(file, list);
    };
    for (const item of stream) if (judged.test(item.decl.name)) hide(item.path, item.decl);
    for (const decl of themeMaps) hide(theme.path, decl);
    for (const block of themeBlocks) {
      if (!hasSelector(block, ":root") && !hasSelector(block, ".dark")) continue;
      for (const decl of block.decls) if (step.test(decl.name)) hide(theme.path, decl);
    }
    // The theme file is the bundle's own, wherever the user moved it: check 1 judged its hash.
    const own = new Set(["receipt.json", ...receipt.files.map((file) => file.path)]);
    if (path.posix.basename(theme.path) === "theme.css") own.add(theme.path);
    /** @type {{ path: string, text: string }[]} */
    const files = [];
    walkFiles(root, "", io, own, files);
    files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    checked.files = files.length;
    for (const file of files) {
      const lines = masked(file.text, spans.get(file.path) ?? []).split(/\r\n|\r|\n/);
      lines.forEach((line, index) => {
        const result = scanLine(line);
        if (result.ignored !== null)
          ignored.push({ path: file.path, line: index + 1, reason: result.ignored });
        for (const f of result.findings) {
          report(f.code, f.message, {
            path: file.path,
            line: index + 1,
            column: f.column,
            text: f.text,
          });
        }
      });
    }
    return emit(findings.length === 0 ? 0 : 1);
  } catch (error) {
    if (error instanceof Stop) {
      findings = [];
      ignored = [];
      return emit(2, error.message);
    }
    findings = [];
    ignored = [];
    return emit(
      2,
      `dyelot-check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** @type {CheckIo} */
export const nodeIo = {
  readFile(file) {
    try {
      return readFileSync(file, "utf8");
    } catch {
      return null;
    }
  },
  readDir(dir) {
    try {
      return readdirSync(dir, { withFileTypes: true }).map((entry) => ({
        name: entry.name,
        kind: entry.isSymbolicLink() ? "link" : entry.isDirectory() ? "dir" : "file",
      }));
    } catch {
      return null;
    }
  },
  size(file) {
    try {
      return statSync(file).size;
    } catch {
      return 0;
    }
  },
  cwd: process.cwd(),
  out: (text) => {
    process.stdout.write(text);
  },
  err: (text) => {
    process.stderr.write(text);
  },
};

if (
  process.argv[1] !== undefined &&
  realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = main(process.argv.slice(2), nodeIo);
}
