import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { generateSystem, ROLE_NAMES } from "@/engine";
import { freshParams, resolveParams } from "@/features/studio/params";
import { densityVars, themeVars } from "@/theme/vars";
import { deriveTailwind } from "../../engine/lint/tailwind-source";

// The preview source guard of docs/specs/02-studio.md, section 6.10. `findViolations` reads a file's
// text and names every color that is not one of the spec's custom properties: a Tailwind palette
// class (palette names derived from tailwindcss/theme.css, as T3's table is, R2-09), white and black
// utilities, a house theme color that is not a role, the `dark:` variant, a hex literal, a color
// function, a `color-mix()` over anything but `var(--x)` and `transparent`, a CSS named or system color
// used as a value (custom properties, vendor-prefixed properties and `var()` fallbacks included),
// and a `var(--x)` whose name the theme bridge does not write and that is not a `--kit-*` local.

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const GLOBALS = path.join(ROOT, "src/app/globals.css");

/** The utility prefixes that take a color. */
const PREFIXES =
  "bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|fill|stroke|from|via|to|divide|outline|decoration|shadow|accent|caret|placeholder";

/** The CSS named colors (CSS Color 4), keywords such as `transparent` and `currentColor` aside. */
const NAMED_COLORS: ReadonlySet<string> = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet
  brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue
  darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange
  darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise
  darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen
  fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred
  indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
  lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
  lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta
  maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue
  mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
  navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen
  paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red
  rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue
  slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white
  whitesmoke yellow yellowgreen
  canvas canvastext linktext visitedtext activetext buttonface buttontext buttonborder field fieldtext
  highlight highlighttext selecteditem selecteditemtext mark marktext graytext accentcolor
  accentcolortext`.split(/\s+/),
);

/** A property, attribute or key whose value is a color, or holds one. */
const COLOR_PROPERTY =
  /color|background|border|outline|fill|stroke|shadow|caret|accent|decoration|columnrule|scrollbar/;

/** The `--color-<name>` entries of the house Tailwind theme in src/app/globals.css. */
export function houseColors(): Map<string, string> {
  const css = readFileSync(GLOBALS, "utf8");
  const theme = [...css.matchAll(/@theme[^{]*\{([^}]*)\}/g)]
    .map((block) => block[1] ?? "")
    .join("");
  return new Map(
    [...theme.matchAll(/--color-([a-z0-9-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      name ?? "",
      (value ?? "").trim(),
    ]),
  );
}

const alternation = (names: readonly string[]): string =>
  [...names].sort((a, b) => b.length - a.length).join("|");

/** Built once: the palette names come from the same derivation as T3's table (R2-09). */
const RULES = (() => {
  const palettes = deriveTailwind().palettes;
  const theme = houseColors();
  const allowed = new Set(
    [...theme]
      .filter(([name, value]) => isRole(name) && value === `var(--${name})`)
      .map(([n]) => n),
  );
  return {
    palette: new RegExp(`\\b(?:${PREFIXES})-(?:${alternation(palettes)})-\\d{2,3}(?!\\d)`, "g"),
    whiteBlack: new RegExp(`\\b(?:${PREFIXES})-(?:white|black)(?![\\w-])`, "g"),
    theme: new RegExp(`\\b(?:${PREFIXES})-(${alternation([...theme.keys()])})(?![\\w-])`, "g"),
    allowed,
    arbitraryNamed: new RegExp(`-\\[(?:${alternation([...NAMED_COLORS])})\\]`, "gi"),
  };
})();

function isRole(name: string): boolean {
  return (ROLE_NAMES as readonly string[]).includes(name);
}

const HEX = /(?<![&0-9a-zA-Z])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi;
const COLOR_FUNCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi;
const DARK_VARIANT = /(?<![\w-])dark:(?=[\w[(!-])/g;
/** A declaration, attribute or key: a property (vendor-prefixed too) or a custom property, quoted or not. */
const DECLARATION = /(?<![\w-])(["']?)(--[\w-]+|-?[A-Za-z][\w-]*)\1\s*(:|=)(?!=)/g;
/** A `var()` without a fallback: the only form a value may drop before it is read for colors. */
const PLAIN_VAR = /var\(--[\w-]+\)/g;
/** The name read by a `var()` or a Tailwind `(--x)` shorthand, a template part included. */
const VARIABLE = /(?:var\(\s*|(?<=[\w])-\()--((?:[\w-]|\$\{[^}]*\})*)/g;
const KIT_LOCAL = "kit-";
const VAR_ONLY = /^var\(--[a-z0-9-]+\)$/i;

/** The text inside the parentheses that open at `open`, or the rest of the source. */
function balanced(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "(") depth++;
    if (source[i] === ")" && --depth === 0) return source.slice(open + 1, i);
  }
  return source.slice(open + 1);
}

/** The arguments of `inner` split on its top-level commas. */
function topLevelArguments(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "(") depth++;
    if (inner[i] === ")") depth--;
    if (inner[i] === "," && depth === 0) {
      parts.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(inner.slice(start));
  return parts.map((part) => part.trim());
}

/** Every `color-mix()` whose color arguments are not all `var(--x)` or `transparent`. */
function colorMixHits(source: string): string[] {
  const hits: string[] = [];
  for (const match of source.matchAll(/color-mix\(/g)) {
    const open = (match.index ?? 0) + "color-mix".length;
    const colors = topLevelArguments(balanced(source, open)).slice(1);
    const literal = colors
      .map((argument) => argument.replace(/^[\d.]+%\s+/, "").replace(/\s+[\d.]+%$/, ""))
      .filter((color) => !VAR_ONLY.test(color) && color !== "transparent");
    if (literal.length > 0) hits.push(`color-mix over ${literal.join(", ")}`);
  }
  return hits;
}

/** The value written after a declaration's `:` or an attribute's `=`. */
function valueAfter(source: string, at: number, separator: string): string {
  const rest = source.slice(at);
  if (separator === "=") {
    return rest.match(/^\s*("[^"]*"|'[^']*'|\{[^}]*\})/)?.[1] ?? "";
  }
  // A declaration ends at `;`, a line end, `}`, or a comma outside parentheses (the next key).
  let depth = 0;
  for (let i = 0; i < rest.length; i++) {
    const char = rest[i];
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === ";" || char === "\n" || char === "}" || (char === "," && depth <= 0)) {
      return rest.slice(0, i);
    }
  }
  return rest;
}

/**
 * Every named or system color written as the value of a color property, attribute or style key, or
 * of a custom property, whose value may land in any color property. A `var()` with a fallback stays
 * in the value, so the fallback is read.
 */
function namedColorHits(source: string): string[] {
  const hits: string[] = [];
  for (const match of source.matchAll(DECLARATION)) {
    const [whole, , name = "", separator = ":"] = match;
    const custom = name.startsWith("--");
    if (!custom && !COLOR_PROPERTY.test(name.toLowerCase().replaceAll("-", ""))) continue;
    const value = valueAfter(source, (match.index ?? 0) + whole.length, separator);
    const words =
      value
        .replace(PLAIN_VAR, " ")
        .toLowerCase()
        .match(/[a-z]+/g) ?? [];
    for (const word of words) if (NAMED_COLORS.has(word)) hits.push(`named color ${name} ${word}`);
  }
  return hits;
}

/** The custom properties the theme bridge writes: `themeVars` and `densityVars`, read off their output. */
export function bridgeVariables(): ReadonlySet<string> {
  const spec = generateSystem(resolveParams(freshParams(), "seed-1"), "seed-1");
  return new Set([...Object.keys(themeVars(spec, "light")), ...Object.keys(densityVars("dense"))]);
}

const BRIDGE = bridgeVariables();

/** Whether `name` (after `--`) is the bridge's or a kit local; a template part reads as a prefix. */
function allowedVariable(name: string): boolean {
  const template = name.indexOf("${");
  if (template === -1) return name.startsWith(KIT_LOCAL) || BRIDGE.has(`--${name}`);
  const prefix = name.slice(0, template);
  return (
    prefix.startsWith(KIT_LOCAL) || [...BRIDGE].some((known) => known.startsWith(`--${prefix}`))
  );
}

/** Every `var(--x)` or `(--x)` whose name the bridge does not write. */
function variableHits(source: string): string[] {
  return [...source.matchAll(VARIABLE)]
    .filter((match) => !allowedVariable(match[1] ?? ""))
    .map((match) => `variable outside the bridge --${match[1] ?? ""}`);
}

/** The colors in `source` that are not spec variables, one entry per hit. */
export function findViolations(source: string): readonly string[] {
  const hits: string[] = [];
  const each = (pattern: RegExp, label: string) => {
    for (const match of source.matchAll(pattern)) hits.push(`${label} ${match[0]}`);
  };
  each(RULES.palette, "palette class");
  each(RULES.whiteBlack, "white or black utility");
  for (const match of source.matchAll(RULES.theme)) {
    if (!RULES.allowed.has(match[1] ?? "")) hits.push(`house color utility ${match[0]}`);
  }
  each(RULES.arbitraryNamed, "named color in an arbitrary value");
  each(DARK_VARIANT, "dark variant");
  each(HEX, "hex literal");
  each(COLOR_FUNCTION, "color function");
  hits.push(...colorMixHits(source), ...namedColorHits(source), ...variableHits(source));
  return hits;
}

/** Every `.css`, `.ts` and `.tsx` file under `dir`; an empty or unreadable folder throws. */
export function previewFiles(dir: string): string[] {
  const files = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(css|ts|tsx)$/.test(entry.name))
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
  if (files.length === 0) throw new Error(`previewFiles: no .css, .ts or .tsx file under ${dir}`);
  return files;
}

const MADDER = /f66c6d|accent-madder|246[\s,]+108[\s,]+109/i;

/** The chrome files that name madder (C-GUARD-05): globals.css, the studio route and features. */
export function madderFiles(root: string): string[] {
  const sources = [
    path.join(root, "src/app/globals.css"),
    ...["src/app/studio", "src/features"].flatMap((folder) =>
      readdirSync(path.join(root, folder), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.(css|ts|tsx)$/.test(entry.name))
        .map((entry) => path.join(entry.parentPath, entry.name)),
    ),
  ];
  return sources
    .filter((file) => MADDER.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(root, file).split(path.sep).join("/"))
    .sort();
}
