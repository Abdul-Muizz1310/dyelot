# 03 · The export bundle, the receipt, the checker and import (M3)

> Source note: this milestone spec refines `docs/specs/00-design.md`, the umbrella, and builds on
> `docs/specs/01-color-engine.md` (M1) and `docs/specs/02-studio.md` (M2). Paths to `docs/research/`, `docs/plans/` and
> `knowledge/` point into the private `repos` meta-repo.

Status: rebuilt on 2026-11-05. It awaits the owner's approval, and no M3 code starts before it has that approval.

The owner approved the first M3 spec on 2026-11-03. That file lived in a draft folder outside git on a machine the owner
no longer has, and it is lost. This file rebuilds it from the M3 plan (`docs/plans/2026-11-03-dyelot-m3-export.md` in the
meta-repo). The plan kept every ruling id (R3-01 to R3-42), every case id, every interface, the counts it measured and
the owner's four decisions (D1 to D4). Where the plan states a rule, this file copies it. Where the plan gives only an id
or a name, this file writes the rule anew. Each ruling in section 3 ends with **(plan)** when the plan states its
content, or **(rebuilt)** when this file supplies it, so the owner can review the rebuilt parts first.

Section 2 copies the plan's decisions word for word. Section 3 lists the rulings that close gaps in them. Tasks 3.2 to 3.16
implement against the cases in section 10. The external formats were checked again on 2026-11-05 against the pinned
packages and the vendored schemas; section 6 records what was checked and where.

## 1. Purpose and scope

M2 built a studio where a visitor edits a design system and sees it live. M3 lets the visitor take the design home and bring
one in. A design leaves as one zip of plain text files that a coding agent can build from: a DESIGN.md brief, an AGENTS.md
block, a prompt, a Tailwind v4 `theme.css`, a shadcn registry theme, DTCG tokens, Figma token files, a TOON view, motion
files, an agent skill, a zero-dependency checker and a measured receipt. A DESIGN.md or a shadcn theme comes in through an
import that lays its colors over a generated base. A design that fails a required check never leaves the studio (D1).

```text
DesignSpec --measureSpec--> Measurements --summarize(+ lintSpec findings)--> Summary
DesignSpec --buildBundle({ spec, origin })--> Bundle: 18 to 21 files, receipt.json last --zipBundle--> zip bytes
DESIGN.md text --importDesignMd--> ImportResult { spec, report }     shadcn CSS --importShadcnCss--> ImportResult
ImportResult --store.importDesign--> the studio, as a loaded design
receipt.json + app/theme.css + the app's source files --node scripts/dyelot-check.mjs--> exit 0, 1 or 2
```

| Task | Delivers |
|---|---|
| 3.0 | The measurement of 3,808 generated designs against the required checks, before anything else (R3-41) |
| 3.1 | This spec moves into the repo with the measured record; the umbrella gains its "Refined in M3" notes |
| 3.2 | The new spec fields, plain text, the text parameters and the moved helpers |
| 3.3 | The shared contrast table, `measureSpec` and `summarize` |
| 3.4 | Type weights, the preset match, spring curves, `sha256` and the entry additions |
| 3.5 | The import core and the shadcn CSS importer |
| 3.6 | The text helpers, the theme model, `theme.css` and the registry items |
| 3.7 | DTCG tokens, the Figma files and the TOON view |
| 3.8 | The motion files and the receipt writer |
| 3.9 | DESIGN.md, the AGENTS block, the prompt and the skill |
| 3.10 | The checker |
| 3.11 | The bundle, the zip, the goldens and the import guards |
| 3.12 | The DESIGN.md importer |
| 3.13 | The About section, and the M2 hygiene |
| 3.14 | The export dialog for a passing design |
| 3.15 | Export off for a failing design, and the inspector's receipt |
| 3.16 | The import dialog and the composed flows |
| 3.17 | Close M3 |

M3 does not deliver AI of any kind (M4), the brief box or the image drop (M4), the `flavor/` folder, the shader, the video or
view transitions (M5), the gallery, `/about`, the share cards or lazy-loaded templates (M6). Section 14 assigns each
deferred item to a milestone.

### Where this spec refines the umbrella

| Umbrella | This spec | Why |
|---|---|---|
| §1 Goal 4: one download with DESIGN.md, AGENTS.md, `theme.css`, DTCG, a shadcn install file, a TOON view and a prompt | 18 to 21 files in a fixed order (R3-12): those, plus Figma token files, three motion files, an agent skill, the checker and the receipt. `flavor/` waits for M5 | The plan fixes the list |
| §1 The receipt: the contrast of every role pair in both modes | The 40 checks of `CONTRAST_CHECKS` in each mode, 80 in all, of which 78 are required; the border pair is advisory (R3-08). `summary.pass` means the linter found no error (R3-23) | One table serves the linter and the receipt, so they cannot disagree |
| §1 The checker fails on raw color literals or off-token classes | A line may carry `dyelot-check-ignore: <reason>` (D3, R3-24); the checker also compares every role with the receipt and reports shadowed definitions (R3-25) | Owner decision D3; an agent needs a way to keep an intended literal |
| §3 Architecture: an Export layer of pure generators | `src/export/` is pure except the checker's `nodeIo` adapter (R3-39). A new pure layer, `src/import/`, reads DESIGN.md and shadcn CSS | The checker must read files; import needs a home |
| §3 Data flow and state | A snapshot records whether the studio generated it or loaded it (R3-42) | The export block needs to know which designs can be rebuilt |
| §4 `meta.name`, one-liner; `direction` with thesis, adjectives, preset id, like and unlike, density | `meta.oneLiner` and `direction` (thesis, adjectives, like, unlike) are optional plain text (R3-01, R3-02). The preset is derived by `presetOf`, and density stays a view setting (R3-04, R3-07) | A stored preset id could disagree with the stored values |
| §4 Type steps with weight | Weights are derived by `typeWeights` and never stored (R3-04, R3-05) | Every M1 and M2 spec id holds (I-M3-06) |
| §8 Inspector: the receipt; Keyboard: `Mod+E` opens export | The inspector gains a Receipt section (R3-36); `Mod+E` opens the export dialog (R3-35); the inputs panel gains About and Import (R3-33) | M2 deferred them to M3 |
| §9 The bundle's files | Each file's format is fixed in section 6; `registry/` holds one theme item and one font item per family next/font can load (R3-16); `skills/` is always included | The plan fixes the list |
| §9 Import reads DESIGN.md and shadcn CSS, then lints | Import never throws for a string, reads at most 262,144 bytes, and lays the imported colors over a generated base (R3-29 to R3-32) | A pasted file is untrusted input |
| §12 Stack | Exact pins of R3-37: `yaml` 2.9.1, `@csstools/css-color-parser` 4.2.7, `fflate` 0.8.3, `@toon-format/toon` 4.4.0; dev `@google/design.md` 0.4.0, `ajv` 8.20.0, `ajv-formats` 3.0.1. `motion` stays 14.3.0. No GSAP, shadcn CLI, Style Dictionary or Terrazzo in the repo | Pins make the goldens reproducible |
| §13 Export cases | Section 10. Goldens for the 14 presets and one import (R3-27); the validators run on vendored schemas with no network (R3-28) | Tests must not depend on the network |
| §16 Risks: DESIGN.md is alpha | The pinned linter runs in a unit test on every golden (R3-21) | The extension sections are checked, not assumed |

## 2. Decisions M3 implements

These are the plan's decisions, copied word for word. Where a ruling in section 3 changes one, the ruling wins and names
the decision it changes.

**The owner's decisions of 2026-11-03.**

- **D1 B.** A design that fails a required check cannot be exported: download, copy and the file preview are off, with the
  reason and a way to the fix.
- **D2 A.** Style traits as DESIGN.md prose now, tokens in M5.
- **D3 A.** The checker's per-line `dyelot-check-ignore: <reason>`.
- **D4 A.** "Made with dyelot" and the edit link in the bundle.

**The plan's decisions.**

- **Spec fields (R3-01 to R3-03).** `dyelot.spec/1` stays; new optional `meta.oneLiner` and `direction` (thesis, adjectives,
  like, unlike), carried by `DirectionParams.oneLiner`, `.direction`, `.rules`. Plain text (R3-02) for every text field and the
  four policies: no `Cc`, no U+2028/2029, no bidirectional controls, trimmed, NFC. `freshParams`, `resolveParams`,
  `paramsOfSpec` move to `@/engine`; `lotTag` to `@/spec`. Every M1 and M2 golden holds (I-M3-06).
- **Derived, never stored (R3-04 to R3-08).** `typeWeights` (650 heading, 500 label, 400 body, clamped to the face), three
  weight properties in `themeVars` (207), `presetOf`, the 40-check `CONTRAST_CHECKS` shared by the linter and the receipt,
  `measureSpec`, `summarize`.
- **The measurement first (R3-41).** 3,808 generated designs in five fixed grids, no throw and no lint error; a failure stops M3.
- **The bundle (R3-09 to R3-27).** 21 files in a fixed order (R3-12), UTF-8 and LF, one trailing newline except `design.toon`;
  numbers through `fmt4`, `trunc4`, `round1`, `round6`; user text through `slug`, `mdText`, `yamlString`, `cssComment`.
  `theme.css` reuses `themeVars` (shadow layers stay `oklch(… / a)`), resets the palette, maps Tailwind's and shadcn's names.
  Registry: one theme item and three font items with `next/font/google` import names. DTCG: every token typed. Zip: local-time
  mtime `"1980-01-01T00:00:00"`, entries in bundle order.
- **The receipt and the checker (R3-23 to R3-25).** `dyelot.check/1`; `summary.pass` is "no lint error"; the checker resolves
  the theme a stylesheet imports (else `globals.css`), compares every role, re-measures every required pair, reports shadowed
  definitions and scans source files; exit 0, 1 or 2; every exit 0 ends `PASS`.
- **Import (R3-29 to R3-32).** Never throws for a string; at most 262,144 raw UTF-8 bytes; the import's colors laid over a
  generated base; DESIGN.md links that still match their tokens re-import exactly.
- **The studio (R3-33 to R3-36, R3-42).** About fields with raw local text; Export (Mod+E) and Import dialogs loaded on demand;
  export off while `summary.lint.error > 0` in three states (fixable with "Rebuild from the parameters", fault, stuck); the
  inspector's Receipt section.

**Constraints the plan sets for every task.** Spec-TDD: the case's test first, red, then code, then green, and each test is
named with its case id. R-05 in pure modules: a wrong type is a `TypeError`, an out-of-domain value a `RangeError`, each
naming the function. The UI never shows a raw error (I-M2-03). App code reaches `@/export` and `@/import` only through a
dynamic `import()`. `src/export/**` and `src/import/**` read no DOM, storage, network, clock, randomness or locale, except
the checker's `nodeIo` adapter. No network in tests: schemas and import fixtures are vendored.

## 3. Rulings that close gaps in the decisions

Each ruling picks the smallest answer that makes the cases testable. The sections and cases cite them as R3-nn. A ruling
marked **(plan)** states what the M3 plan states; one marked **(rebuilt)** supplies a rule the lost spec held and the plan
names without stating. The owner can overturn any ruling by editing this file before the task that uses it starts.

### The spec model (Task 3.2)

**R3-01 · The new spec fields.** `dyelot.spec/1` keeps its version, and two optional fields join it, absent unless set.
`meta.oneLiner` follows `meta.name`: plain text (R3-02) of 1 to 140 characters. `direction` follows `meta`: a strict
object with at least one of `thesis` (plain text, 1 to 280 characters), `adjectives` (1 to 5 entries of plain text, 1 to
24 characters each), `like` and `unlike` (each 1 to 5 entries of plain text, 1 to 80 characters each). An empty list is
never stored: the key is left out instead. A character is a UTF-16 code unit, as `NAME_MAX` counts it. `DirectionParams`
gains `oneLiner?`, `direction?` and `rules?: { do: readonly string[]; dont: readonly string[] }`. `generateSystem` checks
each against the same bounds (a `RangeError` naming the field, a `TypeError` for a wrong type) and copies it to
`meta.oneLiner`, `direction` and `rules`. With a field absent it writes nothing, and `rules` stays M1's two empty lists, so a
spec generated without them equals its M2 self byte for byte (I-M3-06). In M3 the About fields set `name` and `oneLiner`
(R3-33); `direction` and `rules` arrive by import (R3-30) and, in M4, by the AI layer. **(plan; bounds rebuilt)**

**R3-02 · Plain text.** `isPlainText(value)` is true when `value` is a string of at least one character that equals
`value.normalize("NFC")`, holds no character of `\p{Cc}`, U+2028, U+2029, U+061C, U+200E, U+200F, U+202A to U+202E or U+2066
to U+2069, and neither starts nor ends with white space (`/\s/`). `toPlainText(raw, max)` follows this order: (1) NFC;
(2) drop every bidirectional control of that list; (3) replace each run of white space, `\p{Cc}`, U+2028 and U+2029 with
one space; (4) trim; (5) when longer than `max`, cut to `max` code units, or `max − 1` when the cut would split a surrogate
pair; (6) trim again. It returns `null` when the result is empty, and otherwise `{ text, truncated }`, where `truncated` says
step 5 cut. `raw` must be a string (`TypeError`) and `max` an integer of at least 1 (`RangeError`); every message names
`toPlainText`. The schema requires `isPlainText` of `meta.name`, `meta.oneLiner`, every `direction` text, every `rules`
entry and the four policies (`components.cards`, `.emphasis`, `.inputs`, `.icons.library`). The bounds of R-20 stay, and a
`rules` entry gains a lower bound of 1. **(plan)**

**R3-03 · The moved helpers.** `freshParams`, `resolveParams` and `paramsOfSpec` move to `src/engine/params.ts` with
`pairingWith`, `UNNAMED` and the spec check, and export from `@/engine`. `lotTag` moves to `src/spec/lot.ts` and exports from
`@/spec`. The studio's `params.ts` and `lot.ts` keep re-exports, so every M2 import still works (C-STORE-30). `paramsOfSpec`
also reads `meta.oneLiner`, `direction` and `rules` back into `oneLiner`, `direction` and `rules` (the last only when either
list is non-empty), so a regenerate keeps a loaded design's text. `DIRECTION_PARAM_KEYS` gains `"oneLiner"`, `"direction"`
and `"rules"` after `"name"`. The studio's `parseParams` (drafts) accepts them within R3-01's bounds, and `mergeParams`
treats them as it treats `name`: a value sets the field, `undefined` removes it. **(plan)**

### Derived values (Tasks 3.3 and 3.4)

**R3-04 · Derived, never stored.** Type weights, the preset a design matches, the measurements and the summary are computed
from a spec when needed and never stored in it. `dyelot.spec/1` gains no field for them, so no spec id changes. Export
files write the derived values; an import derives them again. **(plan)**

**R3-05 · `typeWeights`.** `typeWeights(spec, catalog = FONT_CATALOG)` returns integers `{ heading, label, body }`. The base
weights are 650 for `heading`, read on the display family, and 500 for `label` and 400 for `body`, read on the body family.
For a variable family of the catalog the weight is clamped to its `weights` range `[min, max]`. For a static family it is
the nearest of the weights the catalog copies, a tie going to the heavier. A family outside the catalog keeps the base
weight. A spec that is not an object, or lacks `type.families`, is a `TypeError`; a catalog that is not an array is a
`TypeError`. **(plan)**

**R3-06 · Weights on the canvas.** `themeVars` gains `--weight-heading`, `--weight-label` and `--weight-body`, in that order,
right after `--font-mono`, each the integer of `typeWeights(spec)` written as text: 207 properties. `options.vision` leaves
them unchanged. On the canvas, a `font-weight` of 600 or more on an element set in the display face becomes
`min(<n>, var(--weight-heading))`. One set in the mono face that F-WGT-01 finds at fault drops to 500, because two mono
faces of the catalog hold only 400. Body faces need no cap: C-WGT-06 asserts that every pairing's body family renders 600.
The plan counted six rules to change. That count came from a measurement the lost spec recorded; Task 3.4 lists the rules
it changes in its report, and F-WGT-01 is the check. **(plan; the rule list rebuilt)**

**R3-07 · `presetOf`.** `presetOf(spec)` returns the first id in `PRESET_IDS` whose preset the spec matches, or `null`. A
spec made by import (`meta.createdWith` is `"import"`) never matches. A preset matches when the spec's `harmony`,
`chroma`, `neutralTint` and `scaleMode` equal the preset's; its contrast level is at or above the preset's, since
`applyPreset` never lowers it (R2-06); its type context, radius set, depth style and motion feel equal the preset's; and its
three families equal the preset's pairing's, or, for a preset with no pairing, the families of the pairing
`choosePairing(meta.seed)` picks. The gamut and the seeds are not compared. **(plan)**

**R3-08 · One contrast table.** `CONTRAST_CHECKS` lists the 40 WCAG checks of the linter, in its order: C1's 13 pairs, C2's 5,
C5's 6, N1's 2, N2's 10, N3's 1 and F1's 3. An entry is `{ id, rule, foreground, background, threshold, kind, required }`:
`id` is `"<rule>:<foreground>/<background>"`; `threshold` is 4.5 for C1 and C5 and 3 for the others; `kind` is `"text"` for
C1 and C5, `"large-text"` for C2 and `"ui"` for N1, N2, N3 and F1; `required` is false for N3 alone. The array and every
entry are frozen. The linter's seven WCAG rules are built from the table with M2's subjects, severities and order, so every
finding of every golden is unchanged (C-MEAS-07).

`measureSpec(spec)` returns `{ contrast, separation, gamut }`. `contrast` holds 80 entries, the 40 checks in light mode then
the 40 in dark: `{ check, mode, ratio, lc, pass }`, where `ratio` is `wcagRatio` on the stored hexes as a full float, `lc`
is `perceptualLc` (advisory) and `pass` is `ratio >= threshold`. `separation` holds 16 entries, for each mode, for the sets
`status` (success, warning, destructive, info) and `chart` (chart-1 to chart-5), for each view of `VIEWS` (none, protan,
deutan, tritan): `{ set, mode, view, minDeltaE }`, the smallest pairwise ΔEOK S1 measures. `gamut` holds 176 entries, for
each mode, each palette in `PALETTE_NAMES` order and each step: `{ palette, step, mode, excess }`, where `excess` is
`gamutExcess(oklch, gamut)`.

`summarize(measurements, findings, gamut)` returns `{ pass, contrast, separation, gamut, lint }`: `pass` is
`lint.error === 0`; `contrast` is `{ checks, required, requiredPass, advisoryBelow }`, counted from the measurements (80,
78, the passing required checks, the failing advisory ones); `separation` is `{ checks, below }`, with `below` counting
`minDeltaE < 0.08`; `gamut` is `{ gamut, values, outside }`, with `outside` counting `excess > STORED_GAMUT_TOLERANCE`; and
`lint` is `{ error, warn, info }`, the findings counted by severity. M2 final review M-4 rides along: `describeType` returns
`"array"` for an array, and `canonical.ts` uses it. **(plan; the entry shapes rebuilt)**

### The bundle (Tasks 3.6 to 3.11)

**R3-09 · Files are text.** A `BundleFile` is `{ path, text }`. A path is relative, uses `/`, holds only `[a-z0-9._/-]`,
never starts with `/` or `.` and never holds `..`. The text is UTF-8 with LF line ends, no byte-order mark and no line that
ends in a space or a tab, and it ends in exactly one newline, except `design.toon`, which ends with none (R3-19). A file's
byte length and hash are those of its UTF-8 encoding. **(plan; path rule rebuilt)**

**R3-10 · Numbers and user text.** Every number a writer prints goes through one of four helpers. `fmt4(x)` rounds half away
from zero to 4 decimals, drops trailing zeros and a trailing point, never uses exponent notation and writes −0 as `0`.
`trunc4(x)` cuts toward zero at 4 decimals and formats like `fmt4`, so a ratio of 4.49999 prints `4.4999` and never reads as
passing. `round1(x)` rounds half away from zero to 1 decimal and returns a number. `round6` is the engine's. Each throws a
`RangeError` for a number that is not finite and a `TypeError` for a non-number. Every piece of user text goes through one of
four helpers. `slug(text)` lowercases, folds U+00C0 to U+017F to ASCII by a fixed table (never `normalize`), turns each run of
characters outside `[a-z0-9]` into `-`, trims `-`, cuts to 48 characters, trims `-` again, and gives `"design"` for an
empty result. `mdText(text)` backslash-escapes `` \ ` * _ [ ] < > # | ~ `` everywhere, and a leading `-`, `+`, `=` or
`<digits>.`. `yamlString(text)` writes a YAML double-quoted scalar, escaping `\` and `"`. `cssComment(text)` writes
`/* <text> */` with every `*/` in the text written `* /`. **(plan; the helpers' rules rebuilt)**

**R3-11 · JSON layout and key order.** Every JSON file is `JSON.stringify(value, null, 2)` plus a newline. Objects are built in
the key order section 6 lists. JavaScript lists integer-like keys (a step such as `"50"`) first, in ascending order, whatever
the build order; the writers follow that rule rather than fight it, so in a scale group the steps come first. **(plan)**

**R3-12 · The files, their order and the origin.** `buildBundle({ spec, origin })` normalizes the spec with `normalizeSpec`.
`origin` must be a string equal to `new URL(origin).origin` with the protocol `https:`, so it has no path, query, hash or
trailing slash; otherwise it is a `RangeError` (a non-string is a `TypeError`). The app passes `SITE.url`. With `<slug>` the
`slug` of `meta.name` and `<family>` each distinct family id among display, body and mono, in that order, that has a
`next/font/google` import name (R3-16), the files are, in this order:

1. `DESIGN.md`
2. `AGENTS.md.snippet`
3. `prompt.md`
4. `app/theme.css`
5. `registry/<slug>.json`
6. `registry/font-<family>.json`, once per such family (0 to 3 files)
7. `tokens/base.tokens.json`, `tokens/light.tokens.json`, `tokens/dark.tokens.json`, `tokens/design.resolver.json`
8. `tokens/figma/light.tokens.json`, `tokens/figma/dark.tokens.json`
9. `design.toon`
10. `motion/motion.css`, `motion/motion.ts`, `motion/gsap.ts`
11. `skills/<slug>-design/SKILL.md`
12. `scripts/dyelot-check.mjs`
13. `receipt.json`, always last

That is 18 files plus one per font item: 18 to 21. The decision's "21 files" and "three font items" are the count for a
design with three distinct families that next/font can load. The edit link is `<origin>/studio#s=<encodeSpec(spec)>`. Per D4,
`DESIGN.md`, `prompt.md`, the skill and the header comment of `theme.css` carry the words "Made with dyelot" and the edit
link, and the receipt records the link. `zipName(bundle)` is `<slug>-<the first 8 digits of the spec id>.zip`. **(plan; the
order rebuilt from the plan's file list)**

**R3-13 · `theme.css` reuses the bridge.** `themeCss(spec)` writes the values of `themeVars(spec, "light")` and the color
values of `themeVars(spec, "dark")`, never values of its own, in the layout of section 6.2. Shadow layers stay as the bridge
writes them, `oklch(L C H / a)`, so a tinted shadow keeps its tint. Mode-independent values go into `@theme`; the 46 roles,
the 88 steps and the durations go into `:root`, and the roles and steps again into `.dark`. **(plan)**

**R3-14 · Tailwind's and shadcn's names.** `theme.css` resets Tailwind's palette with `--color-*: initial`, then adds back
`--color-white` and `--color-black` (shadcn's own components use `text-white`) and maps every role and step to
`--color-<name>: var(--<name>)` in `@theme inline`, so `bg-primary` and `bg-primary-600` exist and `bg-blue-500` does not.
Type steps keep the bridge's names, which are Tailwind's (`--text-*`, `--leading-*`, `--tracking-*`), and gain the
`--text-<step>--line-height`, `--letter-spacing` and `--font-weight` companions. Families keep `--font-display`,
`--font-body` and `--font-mono` and add shadcn's `--font-sans` (the body) and `--font-heading` (the display). Weights are
written `--font-weight-heading`, `--font-weight-label` and `--font-weight-body`. Radii keep `--radius-sm` to `--radius-2xl`;
`--radius` (shadcn's base) is the `lg` radius. The space scale becomes Tailwind's `--spacing: 4px`, since every unit is a
multiple of 4. Shadows keep `--shadow-1` to `--shadow-5` and easings `--ease-<name>`. **(plan; the name list rebuilt)**

**R3-15 · OKLCH in exports.** A color written as OKLCH uses the stored `l`, `c` and `h` (through `round6`, and `roundHue` for
`h`); an achromatic hue (`null`) is written `none`. A role, which the spec stores as a hex only, is converted with
`rgbToOklch(hexToRgb(hex), "srgb")` and the same rounding. **(plan)**

**R3-16 · The registry items.** `registry/<slug>.json` is one `registry:theme` item with `cssVars.light` and `cssVars.dark`
holding the 46 roles, the 88 steps and, in `light`, `radius`; `cssVars.theme` holds the five radii and, for a family with no
font item, its `font-*` stack. Colors never go into `cssVars.theme`, where shadcn's CLI writes them as `--color-color-*`. Each
distinct family that `next/font/google` can import gets one `registry:font` item `registry/font-<id>.json`, whose `font` is
`{ family, provider: "google", import, variable, weight?, subsets: ["latin"] }`: `import` is the family name with spaces as
underscores; `variable` is `--font-sans` for the body family, else `--font-heading` for the display family and `--font-mono`
for the mono family; `weight` lists a static family's catalog weights as strings and is absent for a variable family.
`NEXT_FONT_MISSING` lists the catalog families absent from the `font-data.json` of next 16.4.3: exactly `["redaction"]`. A
family outside the catalog gets no item. **(plan; the item fields re-verified on 2026-11-05)**

**R3-17 · DTCG.** The four token files follow DTCG 2025.10 and validate against its vendored schemas (R3-28). Every token
carries its own `$type`, and no group carries one: the official schema checks a value only against the token's own
`$type`. Colors are `{ colorSpace: "oklch", components: [l, c, h], hex }` (R3-15) with the stored hex as the fallback.
Dimensions are `{ value, unit: "px" }`, durations `{ value, unit: "ms" }`. A typography token's `lineHeight` is the number
`round6(lineHeightPx / sizePx)` and its `letterSpacing` the dimension `round6(trackingEm × sizePx)` px, because the format
allows neither `em` nor a dimension line height. A fluid `display` step writes its base `sizePx` and names its `clamp` in
`$description`. A shadow is an array of its two layers with `offsetX` 0, `spread` 0 and the layer's OKLCH and alpha. The
resolver joins `base` with a `mode` modifier of two contexts, `light` (the default) and `dark`; the schema rejects a
modifier with one context. **(plan; the conversions rebuilt)**

**R3-18 · The Figma files.** `tokens/figma/light.tokens.json` and `dark.tokens.json` hold only what Figma imports: colors as
`{ colorSpace: "srgb", components, hex }` with components from the hex, dimensions in `px`, durations in `s`, numbers, and
font families as a single string. They hold no typography, shadow, font weight or cubic Bézier token. Both files hold the
same token names with the same types, because Figma creates a variable only when every mode's file has it. Both also
validate against the DTCG format schema. **(plan; the subset re-verified on 2026-11-05)**

**R3-19 · The TOON view.** `design.toon` is exactly `encode(source)` of `@toon-format/toon` 4.4.0 with the default options,
and has no trailing newline: `encode` joins lines with `\n` and adds none. `source` is `{ scales, roles }` and nothing else.
`scales` holds 16 rows, for each palette in `PALETTE_NAMES` order, light then dark: `{ palette, mode, s50, s100, …, s950 }`
with the stored hexes. The step keys carry an `s` so no key is integer-like (R3-11). `roles` holds 46 rows in `ROLE_NAMES`
order: `{ role, light, dark }`. TOON quotes every string that starts with `#`. The view is not canonical: DESIGN.md's Install
section and the prompt say the token files are the source of truth. **(plan; the row shapes rebuilt)**

**R3-20 · Spring curves.** `springCurve({ visualDuration, bounce })` follows Motion 14.3.0's spring model (`motion-dom`
`generators/spring.mjs`): damping ratio `ζ = max(1 − bounce, 0.05)`, natural frequency `ω = 2π / (1.2 × visualDuration)`
in radians per second, mass 1, starting at rest at 0 and moving to 1. The curve is `x(t) = 1 − e^(−ζωt)(cos(ω_d t) +
(ζω/ω_d) sin(ω_d t))` with `ω_d = ω√(1 − ζ²)` when `ζ < 1`, and `x(t) = 1 − (1 + ωt)e^(−ωt)` when `ζ = 1`. `settleMs` is the
first whole millisecond `T` at which the envelope is at most 0.001 from then on: `e^(−ζωt)·√(1 + (ζω/ω_d)²)` when `ζ < 1`,
`(1 + ωt)e^(−ωt)` when `ζ = 1`. It is an envelope, not the curve itself, so it never cuts a late ripple short. With
`n = clamp(ceil(T × 60 / 1000), 10, 120)`, `samples` holds `n + 1` values `x(i × T / n)` for `i = 0 … n`, each rounded to 4
decimals, the first written 0 and the last 1. SPEC's springs give `settleMs` 411, 706 and 1,056 (snappy, smooth, bouncy) and
26, 44 and 65 samples. `visualDuration` must be finite and positive and `bounce` in [0, 1]: otherwise a `RangeError` naming
`springCurve`. **(plan; the formulas rebuilt and re-measured)**

**R3-21 · DESIGN.md lints clean.** `@google/design.md` 0.4.0, pinned, lints every golden's `DESIGN.md` in a unit test through
`lint` from `@google/design.md/linter`. Every preset golden has 0 errors and 0 warnings; `IMPORTED`'s has warnings of the rule
`contrast-ratio` only. The linter cannot run in a browser (it reads files from disk when its module loads), so the studio
never lints DESIGN.md at run time, and no app chunk imports the package. The writer obeys what the linter rejects or silently
drops: colors are lowercase `#rrggbb`; every size, line height, letter spacing, radius and spacing value is a quoted
dimension in `px` or `em`; `fontWeight` is a bare integer; there are no YAML anchors, aliases, merge keys or repeated keys;
the eight canonical sections appear with their exact headings in canonical order; the extension sections follow
`## Do's and Don'ts`; `spacing` and `rounded` are never empty; and the 29 components of section 6.9 reference all 46 light
roles, so no color token is orphaned. **(plan; the linter facts re-verified on 2026-11-05)**

**R3-22 · Where the prose comes from.** Prose in `DESIGN.md`, the prompt and the skill comes only from the spec's own text
(name, one-liner, direction, rules), `describeDesign(spec)`, `USE_FOR`, the matched preset (`presetOf`: its label, summary,
guards and unexpressed traits, the traits as prose per D2), and the fixed text of section 6. `describeDesign(spec)` is one
sentence built from fixed phrase tables over the harmony, chroma, neutral tint, contrast level, gamut, the three family
names, the radius set, the depth style and the motion feel; it never names a color. `USE_FOR` gives each of the 46 roles one
plain sentence of at most 90 characters saying what it paints. Five guards read as studio notes, not instructions, and are
reworded on export:

| Preset guard | Exported as |
|---|---|
| Hard shadows exist only here | Hard offset shadows belong to this style; do not mix them with soft shadows. |
| No vibration | Never set saturated text on a saturated fill of a far hue. |
| Not wellness beige | Keep the earth tones saturated enough to read as a choice, not a default beige. |
| Reading order stays | Overlap and rotation never change the reading or focus order. |
| Familiar patterns stay | Keep familiar interface patterns; the expression lives in shape and motion. |

Every other guard is exported as written. A copy check over the 14 preset goldens finds no British spelling and none of the
words the writing convention bans. **(plan names the five rewordings; the table rebuilt)**

**R3-23 · The receipt.** `receipt.json` holds `format: "dyelot.check/1"` and the keys of section 7.1 in that order. Every ratio
is written with `trunc4`, and `pass` comes from the full float, so a written `4.4999` always has `pass: false`. `kind` is
`text`, `large-text` or `ui`. The required checks are the 78 required entries of the measurements. `summary.pass` is true
exactly when the linter found no error. The receipt reads no clock, locale or randomness, so it has no timestamp.
**(plan)**

**R3-24 · The ignore marker.** A source line is exempt from the checker's scan when it holds `dyelot-check-ignore:` followed
by a reason. The marker matches `/dyelot-check-ignore:[ \t]*([^\r\n]*?)[ \t]*(?:\*\/|-->|\}|$)/`, and the reason is the first
group trimmed. It must hold at least 3 characters that are not white space. A marker with a shorter reason exempts nothing and
is itself a finding (`marker-without-reason`). A marker exempts its own line only. Every exempt line appears in the report
under `ignored` with its path, line and reason. **(plan)**

**R3-25 · The checker.** `node scripts/dyelot-check.mjs [--root <dir>] [--receipt <path>] [--json]` reads `<root>/receipt.json`
by default, with the current folder as the root. It runs four checks in this order and reports every finding of all four.

1. **The theme.** It looks for a global stylesheet, the first of `app/globals.css`, `src/app/globals.css` and
   `styles/globals.css` that exists. When that file imports a file named `theme.css` (`@import "./theme.css"` or any relative
   path ending in `theme.css`), the theme is the imported file; otherwise, when the global stylesheet itself defines every
   role, it is the theme; otherwise the run stops with exit 2. When the theme is a file named `theme.css`, wherever it sits, its
   SHA-256 must equal the receipt's entry for `app/theme.css` (`theme-changed`). **1b.** In the theme's `:root` and `.dark` blocks each of the 46 roles
   must equal the receipt's hex for that mode, case aside (`role-mismatch`, `role-missing`); `--radius` must equal the
   receipt's (`radius-mismatch`); and, when the theme is the bundle's `theme.css`, every name its `@theme inline` block maps
   (`--color-<role>`, `--color-<palette>-<step>`) must still point at the same variable (`theme-name-changed`).
2. **The pairs.** Each of the 78 required checks is measured again with WCAG 2.2 on the theme's values; a pair below its
   threshold is `contrast-fails`.
3. **Shadows.** A role or `--radius` defined again after the theme, in the global stylesheet or in another stylesheet that
   it imports later, is `shadowed`, naming both places.
4. **The scan.** Every file with an extension of `.ts .tsx .js .jsx .mjs .cjs .css .scss .html .vue .svelte .astro .mdx`
   under the root is scanned, except folders named `node_modules` at any depth, `.git`, `.next`, `dist`, `build`, `out` and
   `coverage`, the bundle's own files and any file over 1 MiB. A finding is a raw hex (`#` and 3, 4, 6 or 8 hex digits, not
   followed by a word character), a color function with a literal first argument (`rgb`, `rgba`, `hsl`, `hsla`, `hwb`, `lab`,
   `lch`, `oklab`, `oklch`, `color`, not `var(`), a Tailwind default palette class (a utility prefix such as `bg-`, `text-`,
   `border-`, `ring-`, `fill-`, `stroke-`, `from-`, `via-`, `to-`, `outline-`, `decoration-`, `divide-`, `shadow-`,
   `accent-`, `caret-` or `placeholder-`, then one of Tailwind's 22 palette names and a step 50 to 950, or `black` or
   `white`), or an arbitrary color value in brackets (`-[#…]`, `-[rgb(…)]` and the other functions). Each is reported with
   path, line, column and the matched text.

Exit 0 means no finding; exit 1 means at least one; exit 2 means a usage or setup error (an unknown flag, a missing or
unreadable receipt, a receipt whose `format` is not `dyelot.check/1`, no theme). The human report's last line is `PASS` on
exit 0, `FAIL (<n> findings)` on exit 1 and `ERROR: <message>` on exit 2. With `--json` it prints one JSON object and
nothing else: `{ format: "dyelot.check-report/1", result: "PASS" | "FAIL" | "ERROR", findings, ignored, checked }`.
**(plan; the patterns and finding names rebuilt)**

**R3-26 · The zip.** `zipBundle(bundle)` calls `zipSync` of `fflate` 0.8.3 with one object whose keys are the files' paths in
bundle order and whose values are their UTF-8 bytes, and the global options `{ level: 6, mtime: "1980-01-01T00:00:00" }`
and nothing else. Without an offset that string reads as local midnight, which fflate writes with the local-time fields, so
every time zone writes the same DOS date (`0x0021`) and time (`0x0000`). A number, a `Date` built from UTC or a date-only
string would not: they shift with the zone, or throw before 1980. No comment is set, because fflate copies a global comment
onto every entry. Paths always hold `.` or `/` (R3-09), so no key is integer-like and the entries keep bundle order. No
folder entries are written. **(plan; the zone facts re-verified on 2026-11-05)**

**R3-27 · The goldens.** `tests/golden/export/manifest.json` records, for each of the 15 `GOLDENS`, its spec id and, for every
file of its bundle with `ORIGIN`, the path, the byte length and the SHA-256, plus the zip's SHA-256. The `default` golden's
files are committed in full under `tests/golden/export/default/` as the reviewable form of every writer. C-BND-06 compares
every golden with the manifest. `DYELOT_UPDATE_GOLDENS=1` rewrites the manifest and the `default` files; the test fails when
that variable is set together with `CI`. **(plan)**

**R3-28 · Vendored schemas.** `tests/fixtures/schemas/` holds `registry-item.json` (from
`https://ui.shadcn.com/schema/registry-item.json`), `format.json` and `resolver.json` (from
`https://www.designtokens.org/schemas/2025.10/`), each fetched once, byte for byte, and `sources.json` with each file's `url`,
`fetched` date and `sha256`. A test checks every hash. All three declare JSON Schema draft-07 and embed their sub-schemas, so
nothing is fetched at run time. Each validator is its own Ajv 8.20.0 instance (default class) with `ajv-formats` and no
`loadSchema`: two instances for DTCG, because `resolver.json` embeds a copy of `format.json` with the same `$id`, and one for
shadcn's item, which declares its meta-schema as `https://json-schema.org/draft-07/schema#`; that instance first adds Ajv's
own draft-07 meta-schema under that `https` id. **(plan)**

### Import (Tasks 3.5 and 3.12)

**R3-29 · How an import becomes a design.** An importer reads the text into an `ImportDraft` (section 5.4), then
`buildImport(draft)` makes the spec:

1. **Seeds.** `primary` is the imported light `primary` color. `secondary` and `accent` come from a DESIGN.md's `secondary`
   and `tertiary` (or `accent`) colors when their chroma is at least 0.04; shadcn CSS gives no secondary or accent seed,
   because its `secondary` and `accent` roles are tints.
2. **Tint.** From the light `muted` color, or `background` when `muted` is absent: chroma under 0.005 is `none`; within 30°
   of the primary's hue is `brand`; a hue in [0, 140) or [330, 360) is `warm`; any other hue is `cool`.
3. **Radius.** From `--radius` (CSS) or `rounded.lg` (DESIGN.md), compared with each radius set's `lg`, or from `rounded.md`
   compared with each set's `md`, when `lg` is absent. The nearest set wins; a tie goes to the rounder set. Absent: `soft`.
4. **Context.** From the body size: under 15 px is `dense`; 18 px or more is `marketing` when the display size is 64 px or
   more and `editorial` otherwise; any other size, or none, is `product`.
5. **Fonts.** Family names map to ids by R2-03's rule. Three ids that form a pairing set `pairing`. Otherwise the ids that
   match `FAMILY_ID` replace the generated families after generation, which the studio shows as custom fonts (R2-14 item 4).
6. **Generation.** `generateSystem` runs on `freshParams()` with those values at contrast level `AA`, and the seed
   `"import-"` plus the first 16 digits of `sha256(normalized text)`, so the same text always makes the same design.
7. **Overlay.** Each imported role replaces the generated one in its mode. A color inside sRGB becomes its hex; one outside is
   gamut-mapped to sRGB first (reported `gamut`); one with alpha below 1 is flattened over that mode's background, the
   imported one if there is one (reported `alpha`). A fill of a C5 pair imported without its foreground gets
   `onFill(fill)` (reported `foreground`). Roles the import does not name keep the generated values, and a missing dark mode
   keeps the generated dark roles (reported `dark-generated`).
8. **Result.** `meta.createdWith` is `"import"` and the name is the import's (R3-30, R3-31), cut by `toPlainText`. The import
   succeeds even when the result fails the linter; the studio then holds a loaded design that cannot be exported until it is
   fixed (R3-42). **(plan; the thresholds rebuilt)**

**R3-30 · DESIGN.md import.** The front matter (the text between a first line `---` and the next line `---`) and every fenced
` ```yaml ` block outside other fences are parsed with `yaml` 2.9.1, `parseDocument(text, { schema: "core", uniqueKeys:
true, maxAliasCount: 0 })`. Any entry of `doc.errors` is the error `yaml` with its line. A document holding an anchor or an
alias, found by `visit`, is the error `yaml-alias`. A top-level group defined in two blocks is the error `yaml-group-twice`.
All YAML together may hold at most 65,536 bytes (the error `yaml-too-large`), because `uniqueKeys` checks keys in quadratic
time. Colors map to roles by this alias table, then by name: every dyelot role name maps to itself; `surface` and
`background` to `background`; `on-surface`, `on-background` and `text` to `foreground`; `on-primary` to
`primary-foreground`; `error` to `destructive`; `on-error` to `destructive-foreground`; `outline` to `border`. The body size
is the first of `typography.body`, `typography.body-md` and the first key starting `body`; the display size the first of
`display`, `display-lg` and the first key starting `display` or `headline`. Families come from those tokens'
`fontFamily`, and the mono family from the first token whose name holds `mono` or `code`. The name is the front matter's
`name`, else the first `#` heading, else "Imported design". The first paragraph of `## Overview` becomes `direction.thesis`.
Bullet lines under `## Do's and Don'ts` that start "Do " or "Don't " become `rules.do` and `rules.dont`. **(plan; the table
rebuilt)**

**R3-31 · shadcn CSS import.** A scanner removes comments, respects quoted strings and counts braces. Light declarations come
from rules whose selector list holds `:root`, `:root:not(.dark)`, `html`, `.light` or `[data-theme="light"]`; dark ones from
`.dark`, `:root.dark`, `html.dark`, `[data-theme="dark"]`, or `:root` inside `@media (prefers-color-scheme: dark)`. Rules
inside `@layer` blocks count. A later declaration wins. The importer reads `--<role>` for the 46 roles, `--radius`,
`--font-sans` (body and display), `--font-serif` (display, when present) and `--font-mono`; every other name is listed in
the report as ignored. A value is read by `@csstools/css-color-parser` 4.2.7 after trimming and dropping `!important`. A bare
HSL triple such as `222.2 84% 4.9%` (shadcn's v3 form) is read as `hsl(222.2 84% 4.9%)`. A `var(--x)` resolves once against
the same mode's declarations. A value the parser rejects, or reads with a parse error, is listed as unreadable and skipped.
Conversion to sRGB goes through relative color syntax (`color(from <value> srgb r g b / alpha)`), which keeps channels
outside [0, 1] for R3-29's gamut step. The name is "Imported theme". A text with no role declaration in a light block is the
error `no-roles`. **(plan; the selector list rebuilt)**

**R3-32 · Exact re-import.** A DESIGN.md that dyelot wrote carries its edit link. When the importer finds a link of the form
`<…/studio#s=…>` that `decodeSpec` reads, and `designMdTokens(decoded)` deep-equals the file's parsed front matter, the result
is the decoded spec itself, unchanged, with `report.exact` true. When the tokens differ (someone edited the file), the
import takes the token path of R3-30, and the report says the link was ignored because the tokens changed. **(plan)**

### The studio (Tasks 3.13 to 3.16)

**R3-33 · The store's additions.** The inputs panel gains an About section first, with two text fields, "Name" and
"One line". Each keeps its own raw text while the visitor types, and sends `setParams({ name })` or `setParams({ oneLiner })`
with `toPlainText(raw, max)?.text`, or `undefined` for an empty result, under the coalesce keys `"about-name"` and
`"about-one-liner"`. A field takes the store's value only when that value differs from `toPlainText(raw)`, so typing a
trailing space never jumps the cursor. `importDesign(result)` loads `result.spec` as a link load does: the new snapshot is
`{ params, seed, spec, preset: presetOf(spec), provenance: "loaded" }` with the params of `paramsOfSpec`, and the old one
goes onto `history`. The notice `{ kind: "imported", format, exact, light, dark, adjusted }` (the counts of roles the file
set in each mode, and of colors adjusted) belongs to that snapshot: undo clears it, redo restores it. `rebuild()` regenerates the held design from its own params and seed as a new commit, with
provenance `"generated"`. **(plan)**

**R3-34 · The export dialog.** "Export" sits in the toolbar right after "Copy link", with
`aria-keyshortcuts="Control+E Meta+E"`. It opens a modal dialog labelled by its heading "Export": the rest of the page is
inert, focus moves to the heading, Escape and "Close" shut it and return focus to the element that opened it, and under
reduced motion it opens with no transition. On open it loads `@/export` through `import()`. Its states are `loading`
("Building the bundle…"), `failed` ("The export code did not load." and "Try again"), `waiting` (the studio is still
generating) and `ready`. A ready dialog shows the lot line, the summary lines (section 9.2), the file list in bundle order
with each file's size and a "Copy" button, a preview of the selected file, and "Download <zip name>". The download builds
the zip, makes a `Blob` URL, clicks a temporary link with `download` set, and revokes the URL on the next task. The plan said
the bundle is built once per open; Review Focus 1 needs more, so the bundle is rebuilt whenever the committed spec changes
while the dialog is open. **(plan; the amendment recorded here, as Task 3.14 asked)**

**R3-35 · `Mod+E` and swallowing.** `shortcutFor` takes `dialogOpen` in its context. With no dialog open, Ctrl+E or Meta+E
(the key `e` or the code `KeyE`, without Alt or Shift, outside a text field) gives `{ kind: "open-export" }`, and a repeat of
it gives `{ kind: "swallow" }`. While a dialog is open, Mod+S and Mod+E give `{ kind: "swallow" }` anywhere, so the save
dialog and the address bar stay shut, and every other key gives `null`: the dialog handles its own keys and Escape. The page
calls `preventDefault` for `swallow` and does nothing else. **(plan)**

**R3-36 · The inspector's receipt.** The inspector gains a section "Receipt" after "Findings". It shows the same summary lines
as the export dialog, and, when export is off, one more line with the state's sentence of R3-42. **(plan)**

### Repository rules (every task)

**R3-37 · Pins and exclusions.** Exactly: `fflate` 0.8.3, `@toon-format/toon` 4.4.0, `yaml` 2.9.1,
`@csstools/css-color-parser` 4.2.7 with `@csstools/css-tokenizer` and `@csstools/css-parser-algorithms` 4.0.2, `tailwindcss`
and `@tailwindcss/postcss` 4.3.3; dev `@google/design.md` 0.4.0, `ajv` 8.20.0 and `ajv-formats` 3.0.1. `motion` stays 14.3.0.
No GSAP, shadcn CLI, Style Dictionary or Terrazzo enters the repo; the hand smoke of Task 3.17 runs the shadcn CLI outside it.
**(plan)**

**R3-38 · The entry points.** The spec entry gains exactly `lotTag`, `isPlainText` and `toPlainText`. The engine entry gains
exactly `freshParams`, `resolveParams`, `paramsOfSpec`, `typeWeights`, `presetOf`, `springCurve`, `CONTRAST_CHECKS`,
`measureSpec`, `summarize`, `onFill`, `round6` and `roundHue`. The export entry (`src/export/index.ts`) is exactly
`buildBundle`, `zipBundle`, `zipName`, `sha256` and `RECEIPT_FORMAT`, with the types `Bundle`, `BundleFile`, `BundleInput`
and `Receipt`. The import entry (`src/import/index.ts`) is exactly `importDesignMd`, `importShadcnCss`, `detectImport` and
`IMPORT_MAX_BYTES`, with the types `ImportResult`, `ImportReport` and `ImportError`. App code (`src/features`, `src/app`,
`src/components`, `src/lib`) reaches `@/export` and `@/import` only through `import()`; a type-only import is allowed, since
it leaves no code. `src/import/**` imports from `src/export` only `sha256.ts` and `design-md-tokens.ts`. **(plan)**

**R3-39 · The checker's carve-out.** The checker is one plain JavaScript file, `src/export/checker/dyelot-check.mjs`, shipped
byte for byte as `scripts/dyelot-check.mjs`. It is the only file under `src/export` that imports a Node module, and only
`node:fs`, `node:path`, `node:url`, `node:crypto` and `node:process`, using APIs that Node 18 has. Its `nodeIo` adapter is the
only code that touches the file system. Everything else in it (`resolveTheme`, `parseBlocks`, `scanLine`, `wcag` and `main`,
which takes its I/O as a parameter) is pure. It runs as a script only when it is the entry module
(`realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)`), so importing it in a test runs nothing. The app reads
its text through `CHECKER_SOURCE`, a `?raw` import that a Turbopack rule serves as a string. TypeScript checks it with
`checkJs` and its JSDoc types. **(plan)**

### Copy, the measurement and provenance

**R3-40 · Copy.** A file's "Copy" button writes its text with `navigator.clipboard.writeText`. On success the button reads
"Copied" for 2 seconds and the dialog's status region says "Copied <path>.". When the clipboard is missing or refuses, the
preview shows that file with its text selected, and the status region says "Copy is blocked here. The text is selected:
press Ctrl+C or ⌘C.". **(rebuilt)**

**R3-41 · Measure first.** Before any other M3 task, Task 3.0 generates five fixed grids and lints each design. `P` is every
preset of `PRESET_IDS` written after `applyPreset` at each contrast level `AA`, `AA+` and `AAA`, in each gamut and each scale
mode (168 sets). Grid A is `P` × the seeds `s0` to `s3` (672). Grid B is `P` × `s0` × the 13 primaries `#fefefe`, `#010101`,
`#808080`, `oklch(0.6 0 none)`, `oklch(0.5 0.02 250)`, `#ff0000`, `#0000ff`, `#ffff00`, `oklch(0.98 0.35 110)`,
`oklch(0.7 0.37 145)`, `#1a1c1e`, `#171717` and `#3a6ea5`, each as `primary: parseColor(text)` (2,184). Grid C is `P` × `s0` ×
a locked `secondary: parseColor("#ff00ff")` or a locked `accent: parseColor("#00ff00")` (336). Grid D is the 14 presets at
their own level × the gamuts × the scale modes × `s0` × `oklch(0.62 0.14 h)` for h = 60, 85, 175, 205, 230, 290, 320 and 345
(448). Grid E is `freshParams()` with the tints `none`, `warm` and `cool` × the gamuts × the scale modes at `AA` × the 13
primaries (156), plus those 12 sets with a `#1a1c1e` primary and a `#b8422e` accent (12). The pairing is
`resolveParams(params, seed)`. That is 3,808 designs. Each must generate without a throw and lint with no `error`. For each
rule of severity `error`, the record keeps how many checks ran, the worst margin (the measured value minus the threshold, in
the direction that passes), the design that had it and that design's primary hue, plus the four primary hues of `s0` to
`s3`. **If any design throws or raises an error, M3 stops for the owner's decision; no later task starts until the owner
decides.** Task 3.1 fills the table below from Task 3.0's report. **(plan)**

| Rule (severity `error`) | Checks run | Worst margin | Design | Its primary hue |
|---|---|---|---|---|
| C1, C2, C5, N1, N2, F1 (each its own row) | Task 3.1 | Task 3.1 | Task 3.1 | Task 3.1 |
| S1 (below 0.05), K1, G1, G3 (each its own row) | Task 3.1 | Task 3.1 | Task 3.1 | Task 3.1 |

The primary hues of `s0` to `s3`: recorded by Task 3.1.

**R3-42 · Provenance and the three blocked states.** A snapshot records `provenance`: `"generated"` when the store made it from
a generator reply to its own request (a change of parameters, a preset, regenerate, a lock, a fix, `rebuild`), and
`"loaded"` when it came from a link, a draft or an import. Undo and redo restore a snapshot's own provenance. While
`summary.lint.error` is above 0, export is off in one of three states:

- **fixable**: the design was loaded, and `rebuildOutcome` is `"passes"`. Sentence: "This design fails <n> required checks.
  It came from a link or a file, and rebuilding it from its parameters makes every check pass." The Findings section shows
  "Rebuild from the parameters".
- **stuck**: the design was loaded, and `rebuildOutcome` is `"fails"` or `"throws"`. Sentence: "This design fails <n> required
  checks, and rebuilding it from its parameters does not fix them. Change the parameters until every check passes."
- **fault**: the design was generated in this session. I-M3-10 says this cannot happen; the state exists so a broken engine
  never ships a failing design. Sentence: "This design fails <n> required checks although the studio generated it. That is a
  fault in dyelot: change any parameter to generate it again."

`<n>` counts the findings of severity `error`, and reads "1 required check" when it is one. `rebuildOutcome(snapshot,
generate)` calls `generate(snapshot.params, snapshot.seed)` and lints the result: `"passes"` with no error, `"fails"` with
one, `"throws"` when `generate` throws. The store memoizes it per spec id and computes it once per held blocked design. In
the dialog the blocked state replaces the preview with the list of failing checks, keeps the file list without sizes, and
gives "Download" and every "Copy" `aria-disabled="true"`, described by the sentence. "Fix in the inspector" ("Show the
findings" in the stuck and fault states) closes the dialog and moves focus to the Findings heading, opening the inspector
drawer below 1280 px. **(plan; the sentences rebuilt)**

## 4. Conventions, invariants and fixtures

### Reading the cases

- **Kind and origin** read as in M2: `pass` or `failure`; `plan` (the plan's Step 1 lists it), `RF1` to `RF5` (a Review
  Focus item of the plan), `decision` (section 2), `ruling` (section 3), `added` (a boundary or failure case this spec adds).
- **Tolerances.** As in M1 and M2: hex channels ±1, OKLCH L and C ±0.001, H ±0.1°, a contrast ratio on its full float.
  "Equal bytes" means `Uint8Array` equality, never a tolerance.
- **Layers.** Pure cases (prefix `C-`) run in Vitest: the `core` project (plain Node) for `src/engine`, `src/spec`,
  `src/theme`, `src/export` and `src/import`; the `web` project (jsdom) for `src/features`. Flow cases (prefix `F-`) run in
  Playwright against the production build with axe. A property case uses fast-check with the run count and seed it states.
- **Case ids.** `C-SPEC3`, `C-GEN3`, `C-PAR3`, `C-ENTRY3`, `C-MEAS`, `C-WGT`, `C-SPR`, `C-PMATCH`, `C-SHA`, `C-TEXT`,
  `C-FMT`, `C-CSS`, `C-REG`, `C-DTCG`, `C-FIG`, `C-TOON`, `C-MOT`, `C-RCPT`, `C-CHK`, `C-DMD`, `C-AGT`, `C-PRM`, `C-SKL`,
  `C-BND`, `C-ZIP`, `C-GUARD3`, `C-IMP`, `C-CSSI`, `C-DMI`, `C-STOR3`, `C-REB`, `C-BLK`, `C-EXPUI`, `C-KEYS3`; flows
  `F-WGT`, `F-EXP`, `F-IMP`, `F-ABT`, `F-RCPT`, `F-A11Y3`. A Review Focus test carries `RF` in its id (`F-EXP-RF1`).

### Invariants

- **I-M3-01 · Same input, same bytes.** `buildBundle` and `zipBundle` give byte-identical output for the same spec and origin,
  on every run, in every time zone, in Node and in Chromium.
- **I-M3-02 · The new cores are pure.** `src/export/**` and `src/import/**` read no DOM, storage, network, clock, randomness or
  locale. No file there names `Date`, `Math.random`, `getRandomValues`, `performance`, `Intl`, `toLocale` or `localeCompare`,
  except the checker's `nodeIo` adapter (R3-39).
- **I-M3-03 · What the receipt says is what ships.** Every file a bundle holds appears in its receipt with its byte length and
  its SHA-256, and every hash matches the file's UTF-8 bytes.
- **I-M3-04 · No failing design leaves.** While a design's `summary.lint.error` is above 0, no download starts, no copy writes
  to the clipboard and no file text is shown (D1).
- **I-M3-05 · Import never throws for a string.** `importDesignMd` and `importShadcnCss` return `{ ok: false, error }` for every
  string they cannot read, whatever its size or content. A non-string is a `TypeError` (R-05).
- **I-M3-06 · M1 and M2 hold.** Every M1 and M2 case passes, except the cases section 12 changes, and every M1 and M2 golden
  (spec ids, share links, lint findings) holds: the new fields are optional and absent unless set.
- **I-M3-07 · Colors come from the spec.** Every color an export file writes is a value the spec stores (a role hex, a step's
  hex or OKLCH, a shadow layer's OKLCH and alpha), formatted by the rules of section 6. No writer invents a color.
- **I-M3-08 · User text is plain and escaped.** User text reaches a file only as plain text (R3-02) and only through `slug`,
  `mdText`, `yamlString`, `cssComment` or `JSON.stringify`.
- **I-M3-09 · The lazy layers stay lazy.** The first load of `/studio` fetches no chunk of `src/export` or `src/import`; the
  export and import dialogs load them when they open.
- **I-M3-10 · Generated designs pass.** Every design of the five grids of R3-41 generates without a throw and with no lint
  finding of severity `error`. This is the premise of D1: a design the studio generates can always be exported.

### Fixtures

- `DEFAULT_PARAMS`, `HUES` and `SPEC` are M1's: `SPEC` is `generateSystem(DEFAULT_PARAMS, "seed-1")`.
- `ORIGIN` is `"https://dyelot.vercel.app"`, the value of `SITE.url`.
- `GOLDENS` holds 15 specs: for each of the 14 presets in `PRESET_IDS` order,
  `generateSystem(resolveParams({ ...applyPreset(freshParams(), id), name: PRESETS[id].label }, "seed-1"), "seed-1")` under
  the preset's id, then `IMPORTED` under the id `imported-shadcn`.
- `IMPORTED` is `importShadcnCss(readFixture("shadcn-neutral.css")).spec`.
- `BUNDLE` is `buildBundle({ spec: SPEC, origin: ORIGIN })`.
- Import fixtures live in `tests/fixtures/import/`: `shadcn-neutral.css` and `shadcn-v3-hsl.css`, fetched once from
  `https://ui.shadcn.com/docs/theming` on the day of Task 3.5 with a leading comment naming the URL and the date, and
  `design-md-readme.md`, the README example of `google-labs-code/design.md` with its Apache-2.0 notice in a leading HTML
  comment (Task 3.12).
- `APP(files)` writes `themeCss(SPEC)` as `app/theme.css`, `app/globals.css` holding `@import "./theme.css";`, and
  `receiptJson(SPEC, STUB_FILES, ORIGIN)` as `receipt.json` into a fresh temporary folder, then the given files.
  `SHADCN_APP(files)` writes shadcn's scaffold instead: the full `globals.css` of `shadcn-neutral.css`, a `components.json`
  and `components/ui/button.tsx` as shadcn's `new-york` style writes them, plus the unzipped `BUNDLE`, then the given files.
- `STUB_FILES` holds the 20 paths of a 21-file bundle other than `receipt.json`, each with the text `"stub <path>\n"`
  (Task 3.8), so the receipt can be tested before the bundle exists.
- `LONG_NAME` is an 80-character name with no space: `"Saltmarsh"` repeated eight times and `"Tidewater"` cut to 8.

## 5. Public API of the new modules

### 5.1 The spec additions (Task 3.2)

Files: `src/spec/text.ts`, `src/spec/lot.ts`, `src/spec/schema.ts`, `src/spec/index.ts`.

```ts
// src/spec/text.ts (R3-02)
function isPlainText(value: string): boolean;
function toPlainText(raw: string, max: number): { text: string; truncated: boolean } | null;

// src/spec/lot.ts (moved from src/features/studio/lot.ts, R3-03)
function lotTag(id: string): string; // "0123456789abcdef" -> "0123·4567"

// src/spec/schema.ts (R3-01): DesignSpec gains two optional fields
type Direction = {
  readonly thesis?: string;                 // plain text, 1 to 280
  readonly adjectives?: readonly string[];  // 1 to 5 entries, each 1 to 24
  readonly like?: readonly string[];        // 1 to 5 entries, each 1 to 80
  readonly unlike?: readonly string[];      // 1 to 5 entries, each 1 to 80
}; // strict, at least one key
// meta: { name; oneLiner?; seed; engineVersion; createdWith }   direction?: Direction (after meta)
const ONE_LINER_MAX = 140;
```

### 5.2 The engine additions (Tasks 3.2 to 3.4)

Files: `src/engine/params.ts`, `src/engine/measure.ts`, `src/engine/tokens/weights.ts`, `src/engine/tokens/spring.ts`,
`src/engine/presets.ts`, `src/engine/index.ts`.

```ts
// src/engine/params.ts (moved, R3-03)
function freshParams(): DirectionParams;
function resolveParams(params: DirectionParams, seed: string): DirectionParams;
function paramsOfSpec(spec: DesignSpec): { params: DirectionParams; customFonts: boolean };
// DirectionParams gains oneLiner?: string; direction?: Direction; rules?: { do: readonly string[]; dont: readonly string[] }

// src/engine/measure.ts (R3-08)
type ContrastKind = "text" | "large-text" | "ui";
type ContrastCheck = {
  readonly id: string; // "C1:foreground/background"
  readonly rule: "C1" | "C2" | "C5" | "N1" | "N2" | "N3" | "F1";
  readonly foreground: RoleName;
  readonly background: RoleName;
  readonly threshold: 4.5 | 3;
  readonly kind: ContrastKind;
  readonly required: boolean;
};
const CONTRAST_CHECKS: readonly ContrastCheck[]; // 40, frozen
type Measurements = {
  readonly contrast: readonly { check: string; mode: Mode; ratio: number; lc: number; pass: boolean }[]; // 80
  readonly separation: readonly { set: "status" | "chart"; mode: Mode; view: View; minDeltaE: number }[]; // 16
  readonly gamut: readonly { palette: PaletteName; step: Step; mode: Mode; excess: number }[]; // 176
};
type Summary = {
  readonly pass: boolean;
  readonly contrast: { checks: number; required: number; requiredPass: number; advisoryBelow: number };
  readonly separation: { checks: number; below: number };
  readonly gamut: { gamut: Gamut; values: number; outside: number };
  readonly lint: { error: number; warn: number; info: number };
};
function measureSpec(spec: LintedSpec): Measurements;
function summarize(measurements: Measurements, findings: readonly Finding[], gamut: Gamut): Summary;

// src/engine/tokens/weights.ts (R3-05)
function typeWeights(spec: Pick<DesignSpec, "type">, catalog?: readonly FontEntry[]): {
  heading: number; label: number; body: number;
};

// src/engine/tokens/spring.ts (R3-20)
function springCurve(spring: { visualDuration: number; bounce: number }): {
  settleMs: number; samples: readonly number[];
};

// src/engine/presets.ts (R3-07)
function presetOf(spec: DesignSpec): PresetId | null;

// re-exported from their M1 homes: onFill (roles.ts), round6 and roundHue (round.ts)
```

### 5.3 The export entry (Tasks 3.6 to 3.11)

Files: `src/export/*.ts`, `src/export/checker/*`, `src/export/index.ts`. Loaded by the app only through `import()`.

```ts
type BundleFile = { readonly path: string; readonly text: string };
type BundleInput = { readonly spec: DesignSpec; readonly origin: string };
type Bundle = {
  readonly slug: string;      // slug(meta.name), R3-10
  readonly specId: string;    // specId of the normalized spec
  readonly lot: string;       // lotTag(specId)
  readonly link: string;      // the edit link, R3-12
  readonly files: readonly BundleFile[]; // 18 to 21, receipt.json last
  readonly receipt: Receipt;  // section 7.1, parsed back from the file
  readonly summary: Summary;
};
function buildBundle(input: BundleInput): Bundle;
function zipBundle(bundle: Bundle): Uint8Array;  // R3-26
function zipName(bundle: Bundle): string;         // "<slug>-<first 8 digits of specId>.zip"
function sha256(input: string | Uint8Array): string; // lowercase hex; a string is hashed as UTF-8
const RECEIPT_FORMAT = "dyelot.check/1";
```

The writers behind the entry, each pure and each tested on its own: `fmt4`, `trunc4`, `round1` (`format.ts`); `slug`,
`mdText`, `yamlString`, `cssComment` (`text.ts`); `describeDesign`, `USE_FOR` (`prose.ts`); `NEXT_FONT_MISSING`,
`familyName`, `cssFontStack`, `fontPackage` (`fonts.ts`); `themeModel` (`model.ts`); `themeCss` (`theme-css.ts`);
`registryItems` (`registry.ts`); `dtcgFiles` (`dtcg.ts`); `figmaFiles` (`figma.ts`); `toonFile` (`toon.ts`); `motionFiles`
(`motion.ts`); `receiptJson(spec, others, origin)` (`receipt.ts`: the origin is a third parameter because `design.link`
needs it); `designMdTokens` (`design-md-tokens.ts`), `designMd` (`design-md.ts`); `agentsSnippet` (`agents.ts`);
`promptMd` (`prompt.ts`); `skillFile` (`skill.ts`); `CHECKER_SOURCE` (`checker/source.ts`).

### 5.4 The import entry (Tasks 3.5 and 3.12)

Files: `src/import/{detect,css,color,map,build,report,design-md,index}.ts`. Loaded by the app only through `import()`.

```ts
const IMPORT_MAX_BYTES = 262_144;
type ImportFormat = "design-md" | "shadcn-css";
function detectImport(text: string, fileName?: string): ImportFormat | null;
function importShadcnCss(text: string): ImportResult;
function importDesignMd(text: string): ImportResult;

type ImportResult =
  | { readonly ok: true; readonly spec: DesignSpec; readonly report: ImportReport }
  | { readonly ok: false; readonly error: ImportError };
type ImportError = {
  readonly code:
    | "empty" | "too-large" | "binary" | "no-roles" | "no-primary"
    | "yaml" | "yaml-alias" | "yaml-group-twice" | "yaml-too-large";
  readonly message: string;   // a sentence with a way forward, section 8
  readonly line?: number;     // 1-based, for the YAML errors
};
type ImportReport = {
  readonly format: ImportFormat;
  readonly exact: boolean;                                   // R3-32
  readonly mapped: readonly { mode: Mode; role: RoleName; source: string }[];
  readonly adjusted: readonly { mode: Mode; role: RoleName; reason: "gamut" | "alpha" | "foreground"; from: string; to: Hex }[];
  readonly generated: { readonly light: number; readonly dark: number; readonly darkGenerated: boolean };
  readonly inferred: { tint: NeutralTint; radius: RadiusSet; context: TypeContext; pairing: PairingId | null; customFonts: boolean };
  readonly ignored: readonly string[];                       // names and sections, input order, at most 50
  readonly ignoredMore: number;                              // how many more were ignored
  readonly truncated: readonly string[];                     // text fields toPlainText cut
  readonly notes: readonly string[];                         // e.g. "The edit link was ignored because the tokens changed."
};

// build.ts, shared by both importers (R3-29)
type ParsedColor = { readonly rgb: Rgb; readonly alpha: number; readonly inGamut: boolean; readonly source: string };
type ImportDraft = {
  readonly source: ImportFormat;
  readonly normalized: string;
  readonly primary: Oklch;
  readonly secondary?: Oklch;
  readonly accent?: Oklch;
  readonly tintFrom?: Rgb;
  readonly radiusPx?: { readonly value: number; readonly from: "css" | "md" | "lg" };
  readonly bodyPx?: number;
  readonly displayPx?: number;
  readonly families?: { readonly display?: string; readonly body?: string; readonly mono?: string };
  readonly roles: {
    readonly light: Partial<Record<RoleName, ParsedColor>>;
    readonly dark: Partial<Record<RoleName, ParsedColor>>;
  };
  readonly text: { name?: string; oneLiner?: string; thesis?: string; do?: string[]; dont?: string[] };
  readonly report: ReportDraft; // the importer's half of ImportReport
};
function buildImport(draft: ImportDraft): ImportResult;
```

`IMPORT_MAX_BYTES` is measured on the raw UTF-8 length before any normalization. `normalized` is the text after a leading
byte-order mark is dropped and CRLF and CR become LF.

## 6. The bundle's files

Checked on 2026-11-05 against the pinned packages: the DESIGN.md format and linter in `@google/design.md` 0.4.0 (`dist/spec.md`
and the bundled linter), the DTCG 2025.10 schemas, shadcn's `registry-item.json` and its 4.23.0 CLI, Tailwind 4.3.3's
`compile`, `next/font`'s `font-data.json` in next 16.4.3, `@toon-format/toon` 4.4.0, `fflate` 0.8.3 and `motion-dom` 14.3.0.
In the layouts below, `<…>` is a value the writer fills, and every user text goes through the helper R3-10 names.

### 6.1 The theme model (Task 3.6)

`themeModel(spec)` gathers, once, what `theme.css`, the registry and the token files write, all from `themeVars` (R3-13),
`typeWeights` and the font helpers:

- `roles`: 46 entries `{ name, light, dark }` in `ROLE_NAMES` order; `steps`: 88 entries `{ name: "<palette>-<step>", light,
  dark }` in palette then step order; both hold hexes.
- `families`: `display`, `body` and `mono`, each `{ id, family, stack, package, nextImport }`. `familyName(id)` is the
  catalog's family name, or the id with each `-` read as a space for a family outside it. `cssFontStack(id)` is
  `"<Family> Variable", "<Family>", <fallback>` for a variable family (Fontsource's naming) and `"<Family>", <fallback>` for a
  static one. `fontPackage(id)` is `@fontsource-variable/<id>` or `@fontsource/<id>`, or `null` outside the catalog.
  `nextImport` is the family name with spaces as underscores, or `null` for `NEXT_FONT_MISSING` or a family outside the
  catalog.
- `typeSteps`: 10 entries `{ name, size, lineHeight, tracking, weight }`: the bridge's `--text-*`, `--leading-*` and
  `--tracking-*` values, and the weight of the step's role: `heading` for display, h1, h2, h3 and h4; `label` for label;
  `body` for caption, body-sm, body and lead.
- `weights`, `radii` (sm to 2xl, and `radius`, the `lg` value), `shadows` (5 strings), `durations` (7, scaled by the feel as
  the bridge scales them), `easings` (4), `spring` and `iconStroke`.

### 6.2 `app/theme.css` (Task 3.6)

```css
/* dyelot design system: <name> (LOT <lot>) */
/* Made with dyelot. Edit this design: <link> */
/* Generated: change the design in the studio and export it again, not by hand. */
@custom-variant dark (&:is(.dark *));

@theme {
  --color-*: initial;
  --color-white: #ffffff;
  --color-black: #000000;
  --font-display: <display stack>;
  --font-heading: <display stack>;
  --font-body: <body stack>;
  --font-sans: <body stack>;
  --font-mono: <mono stack>;
  --font-weight-heading: <n>;
  --font-weight-label: <n>;
  --font-weight-body: <n>;
  --text-<step>: <size>;                    /* 10 steps, caption to display; display may be a clamp() */
  --text-<step>--line-height: <px>;
  --text-<step>--letter-spacing: <em>;
  --text-<step>--font-weight: var(--font-weight-<heading | label | body>);
  --leading-<step>: <px>;                   /* 10 */
  --tracking-<step>: <em>;                  /* 10 */
  --spacing: 4px;
  --radius-sm: <px>;                        /* sm, md, lg, xl, 2xl */
  --shadow-<1 to 5>: <the bridge's value>;  /* none for a flat design */
  --ease-<standard | decelerate | accelerate | emphasized>: cubic-bezier(<x1>, <y1>, <x2>, <y2>);
}

:root {
  --radius: <lg px>;
  --<role>: <light hex>;                    /* 46, in ROLE_NAMES order */
  --<palette>-<step>: <light hex>;          /* 88 */
  --duration-<name>: <ms>;                  /* 7 */
  --spring-duration: <s>;
  --spring-bounce: <n>;
  --icon-stroke: <n>;
}

.dark {
  --<role>: <dark hex>;                     /* 46 */
  --<palette>-<step>: <dark hex>;           /* 88 */
}

@theme inline {
  --color-<role>: var(--<role>);            /* 46 */
  --color-<palette>-<step>: var(--<palette>-<step>); /* 88 */
}
```

The comments shown inside the blocks are this spec's notes, not part of the file; the file's only comments are its three
header lines, each written by `cssComment`. Declarations are indented two spaces, blocks are separated by one empty line, and
the file ends with one newline.

### 6.3 The registry items (Task 3.6)

`registry/<slug>.json`, keys in this order (R3-16):

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry-item.json",
  "name": "<slug>",
  "type": "registry:theme",
  "title": "<name>",
  "description": "<one-liner, else describeDesign(spec)> Made with dyelot.",
  "cssVars": {
    "theme": { "radius-sm": "<px>", "radius-md": "<px>", "radius-lg": "<px>", "radius-xl": "<px>", "radius-2xl": "<px>" },
    "light": { "radius": "<lg px>", "<role>": "<hex>", "<palette>-<step>": "<hex>" },
    "dark": { "<role>": "<hex>", "<palette>-<step>": "<hex>" }
  }
}
```

`cssVars.theme` also holds `font-heading`, `font-sans` or `font-mono` (the stack) for a family that has no font item.
`registry/font-<id>.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema/registry-item.json",
  "name": "font-<id>",
  "type": "registry:font",
  "title": "<Family>",
  "font": { "family": "<Family>", "provider": "google", "import": "<Family_With_Underscores>",
            "variable": "--font-<sans | heading | mono>", "weight": ["400"], "subsets": ["latin"] }
}
```

### 6.4 DTCG tokens (Task 3.7)

`tokens/base.tokens.json` holds the mode-independent tokens, each with its own `$type` (R3-17):

| Group | Tokens | `$type` and `$value` |
|---|---|---|
| `font` | `display`, `body`, `mono` | `fontFamily`: an array, the family then the fallback stack's names |
| `font-weight` | `heading`, `label`, `body` | `fontWeight`: the integer |
| `type` | the 10 steps | `typography`: `fontFamily` (array), `fontSize` (px), `fontWeight` (integer), `letterSpacing` (px), `lineHeight` (number) |
| `space` | `0` to `32`, the 12 units | `dimension`, px |
| `radius` | `sm`, `md`, `lg`, `xl`, `2xl`, `full` | `dimension`, px |
| `shadow` | `1` to `5` | `shadow`: an array of the two layers; a flat design writes one transparent layer of zeros |
| `duration` | the 7 names | `duration`, ms, scaled by the feel |
| `easing` | the 4 names | `cubicBezier` |
| `spring` | `snappy`, `smooth`, `bouncy`, each with `visual-duration` and `bounce` | `number` |

The root group carries `$description`: "<name>. Made with dyelot: <link>". `tokens/light.tokens.json` and
`tokens/dark.tokens.json` each hold `color.role.<role>` (46) and `color.scale.<palette>.<step>` (88), each a `color` token
(R3-15). Roles and palettes share names (`primary`), so they live in separate groups. `tokens/design.resolver.json`:

```json
{
  "version": "2025.10",
  "name": "<name>",
  "description": "Made with dyelot: <link>",
  "sets": { "base": { "sources": [{ "$ref": "base.tokens.json" }] } },
  "modifiers": {
    "mode": {
      "default": "light",
      "contexts": { "light": [{ "$ref": "light.tokens.json" }], "dark": [{ "$ref": "dark.tokens.json" }] }
    }
  },
  "resolutionOrder": [{ "$ref": "#/sets/base" }, { "$ref": "#/modifiers/mode" }]
}
```

### 6.5 The Figma files (Task 3.7)

`tokens/figma/light.tokens.json` and `tokens/figma/dark.tokens.json` (R3-18) hold `color.role.<role>` and
`color.scale.<palette>.<step>` as `{ colorSpace: "srgb", components: [r, g, b], hex }` with `round6` components;
`font.display`, `font.body` and `font.mono` as `fontFamily` single strings; `size.<step>` and `line-height.<step>` as px
dimensions; `space` and `radius` as px dimensions; `duration.<name>` in `s` (`round6(ms / 1000)`); and the spring numbers.
Everything but the colors is equal in the two files.

### 6.6 `design.toon` (Task 3.7)

`encode({ scales, roles })` per R3-19, written as `encode` returns it, with no newline added.

### 6.7 The motion files (Task 3.8)

- `motion/motion.css`: the three header comments of 6.2, then `:root` with `--duration-<name>` (7, as the bridge writes
  them), `--ease-<name>` (4), `--spring-<name>: linear(<samples>)` (3, the samples of R3-20 joined by `, `) and
  `--spring-<name>-settle: <settleMs>ms` (3); then `@media (prefers-reduced-motion: reduce)`, where each spring becomes
  `linear(0, 1)` and each settle time `var(--duration-fast)`, so movement turns into a short fade.
- `motion/motion.ts`: a TypeScript module, no imports, exporting `durations` (milliseconds), `easings` (four-number tuples),
  `springs` (`{ type: "spring", visualDuration, bounce }` objects that Motion accepts) and `springSettleMs`, each `as const`.
- `motion/gsap.ts`: a TypeScript module, no imports, exporting `durations` in seconds and `eases` as the strings
  `"<x1>,<y1>,<x2>,<y2>"` that GSAP's `CustomEase.create(name, value)` reads, with a comment saying so. GSAP itself is never
  bundled or named as a dependency.

### 6.8 The bundle and the zip (Task 3.11)

`buildBundle` writes the files of R3-12 in its order, each with its writer, the receipt last over the others. `zipBundle`
follows R3-26. `SPEC`, whose display and body share Host Grotesk, has two font items and 20 files. The `default` golden, set
in Young Serif, Onest and Fragment Mono, has three and 21.

### 6.9 `DESIGN.md` (Task 3.9)

The front matter, keys in this order, every string through `yamlString`, every dimension through `fmt4`:

```yaml
---
version: alpha
name: "<name>"
description: "<one-liner, else describeDesign(spec)>"
colors:
  background: "#ffffff"          # the 46 light roles, ROLE_NAMES order
typography:
  caption:                       # the 10 steps, caption to display
    fontFamily: "<Family>"
    fontSize: "<px>px"
    fontWeight: <integer>
    lineHeight: "<px>px"
    letterSpacing: "<em>em"
rounded:
  sm: "<px>px"                   # sm, md, lg, xl, 2xl, full
spacing:
  "0": "0px"                     # the 12 units
components:
  page:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
---
```

The comments above are this spec's notes; the file has none. `designMdTokens(spec)` returns this front matter as an object,
and the writer prints it by hand in this order (the importer parses it back with `yaml`, R3-32). The 29 components, which
reference all 46 light roles so no color token is orphaned (R3-21):

| Component | `backgroundColor` | `textColor` | Also |
|---|---|---|---|
| `page` | background | foreground | `typography: body` |
| `card` | card | card-foreground | `rounded: lg` |
| `popover` | popover | popover-foreground | `rounded: md` |
| `sidebar` | sidebar | sidebar-foreground | |
| `muted-panel` | muted | muted-foreground | |
| `muted-text` | background | muted-foreground | `typography: body-sm` |
| `button-primary` | primary | primary-foreground | `typography: label`, `rounded: md`, `height: 40px` |
| `button-secondary` | secondary | secondary-foreground | `typography: label`, `rounded: md`, `height: 40px` |
| `menu-item-active` | accent | accent-foreground | |
| `sidebar-item-active` | sidebar-accent | sidebar-accent-foreground | |
| `sidebar-button-primary` | sidebar-primary | sidebar-primary-foreground | |
| `button-destructive` | destructive | destructive-foreground | `typography: label`, `rounded: md` |
| `alert-destructive` | destructive-subtle | destructive-subtle-foreground | |
| `badge-success` | success | success-foreground | |
| `alert-success` | success-subtle | success-subtle-foreground | |
| `badge-warning` | warning | warning-foreground | |
| `alert-warning` | warning-subtle | warning-subtle-foreground | |
| `badge-info` | info | info-foreground | |
| `alert-info` | info-subtle | info-subtle-foreground | |
| `divider` | border | | |
| `input-outline` | input | | |
| `focus-ring` | ring | | |
| `sidebar-divider` | sidebar-border | | |
| `sidebar-focus-ring` | sidebar-ring | | |
| `chart-1` to `chart-5` | chart-1 to chart-5 | | |

Every pair in the table is a C1 or C5 pair, so a passing design draws no `contrast-ratio` warning. The body follows, its
sections in this order, with these exact headings:

1. `# <name>`, then the one-liner when there is one.
2. `## Overview`: `describeDesign(spec)`; the thesis when there is one; for a matched preset, "Style: <label>. <summary>"
   and, when it has unexpressed traits, "Traits the tokens cannot hold yet: <traits>." (D2); then "Made with dyelot. Edit
   this design: <link>", the link as a raw autolink.
3. `## Colors`: a table `| Role | Light | Dark | Use for |` with the 46 roles (`USE_FOR`), then one sentence naming the 8
   scales and where they live (`app/theme.css`, `tokens/`).
4. `## Typography`: the three families with their packages, then `| Step | Size | Line height | Tracking | Weight |`.
5. `## Layout`: the 4 px base, the 8 px rhythm, the 12 units.
6. `## Elevation & Depth`: the depth style, the five shadows, and that dark mode shows elevation by surface lightness.
7. `## Shapes`: the radius set, its values, and the nesting rule (inner radius = outer radius − padding).
8. `## Components`: the four policies and the icon library with its stroke width.
9. `## Do's and Don'ts`: the spec's `rules`, the preset's guards (R3-22), then the fixed lines "Do pair every fill with its
   foreground role.", "Don't write a raw hex, rgb(), hsl() or oklch() value in a component.", "Don't use Tailwind's default
   palette classes such as bg-blue-500.", "Don't set body text under 16 px.".
10. `## Dark mode`, `## Motion` (durations, easings, springs with their settle times, the reduced-motion rule) and
    `## Accessibility` (the contrast level and the four summary lines of section 9.2).
11. `## Install` and `## Self-check before you finish`, word for word as in 6.9.1, `theme.css` embedded verbatim in a
    ` ```css ` fence at the end of Install.

#### 6.9.1 The Install and Self-check text

```markdown
## Install

Two routes put this system into a Next.js app with Tailwind CSS v4. Pick one.

**Route 1: the stylesheet.** Copy `app/theme.css` into your app's `app/` folder. In `app/globals.css`, keep `@import "tailwindcss";` and add `@import "./theme.css";` right after it. If shadcn/ui wrote `globals.css`, delete its `@custom-variant dark`, `:root`, `.dark` and `@theme inline` blocks, because they would override this theme. Install the fonts with `npm install <packages>` and import each once in `app/layout.tsx`: <one import line per package>. Put the class `dark` on `<html>` to show dark mode.

**Route 2: shadcn.** Run `npx shadcn@latest add ./registry/<slug>.json`, then `npx shadcn@latest add ./registry/font-<id>.json` for each font file. Do not also import `app/theme.css`. This route sets the colors, the radius and the fonts; the type steps, shadows and easings live only in `app/theme.css`, so copy its `@theme` block if you need them.

Either way, copy `scripts/dyelot-check.mjs` and `receipt.json` into the app's root, and add the block in `AGENTS.md.snippet` to your `AGENTS.md`. The files in `tokens/` are the source of truth for design tools; `design.toon` is a compact view of the same colors for prompts.

## Self-check before you finish

Run `node scripts/dyelot-check.mjs` from the app's root before you finish any UI change. It checks the theme against `receipt.json`, measures the 78 required contrast pairs again, and scans the source for raw colors and Tailwind palette classes. Fix every finding until it prints `PASS`. A raw color you must keep needs a comment on its line: `dyelot-check-ignore: <reason>`. Never edit `receipt.json` or `app/theme.css` by hand to make the check pass; change the design in the studio and export it again: <link>
```

When every family is outside next/font, Route 2's second sentence is left out; when a family is outside the catalog, its
package is left out of Route 1's install line.

### 6.10 `AGENTS.md.snippet` (Task 3.9)

Eleven lines, outside Next.js's managed markers:

```markdown
<!-- dyelot:start <lot> -->
## Design system: <name>
- Read DESIGN.md before any UI change; it is the design brief.
- Colors, type, radius, shadows and motion come only from the tokens in app/theme.css.
- Never write a raw hex, rgb(), hsl() or oklch() color in a component.
- Use the role utilities (bg-background, text-foreground, bg-primary, text-primary-foreground, border-border), never Tailwind's default palette classes such as bg-blue-500.
- Pair every fill with its foreground role, such as bg-primary with text-primary-foreground.
- Set body text with the type steps (text-body and up), never under 16 px.
- Animate with the tokens in motion/, and honor prefers-reduced-motion.
- Before you finish, run `node scripts/dyelot-check.mjs` and fix every finding until it prints PASS.
<!-- dyelot:end -->
```

### 6.11 `prompt.md` (Task 3.9)

A paste-ready message for v0, Lovable, Bolt or a coding agent's first turn: a title line naming the design; one paragraph
that says to build with this design system and to follow its rules; the brief inline (the one-liner, `describeDesign`, the
thesis, the role table of DESIGN.md's Colors, the type step table); the rules of the AGENTS snippet as a list; `app/theme.css`
in a ` ```css ` fence; and "Made with dyelot. Edit this design: <link>". Every user text goes through `mdText`.

### 6.12 `skills/<slug>-design/SKILL.md` (Task 3.9)

An Agent Skill. Front matter: `name: <slug>-design` and `description:` "Restyle or audit UI against the <name> design system:
its color roles, type steps, radius, shadows and motion. Use when building or changing UI in this app, or when checking it
against DESIGN.md." The body names DESIGN.md as the brief and gives two workflows: "Restyle a component" (read the
component, map every color to a role utility, every size to a type step, every radius and shadow to its token, then run the
checker) and "Audit the app" (run `node scripts/dyelot-check.mjs`, group the findings by file, fix them, run it again until
`PASS`). It ends with the edit link.

## 7. The receipt and the checker

### 7.1 `receipt.json` (`dyelot.check/1`, Task 3.8)

`receiptJson(spec, others, origin)` writes one object, keys in this order (R3-11, R3-23). `others` are the bundle's other
files; the receipt lists each with its UTF-8 byte length and SHA-256 (I-M3-03).

```json
{
  "format": "dyelot.check/1",
  "generator": { "name": "dyelot", "site": "https://dyelot.vercel.app", "engineVersion": "dyelot.engine/1" },
  "design": {
    "name": "Default",
    "oneLiner": "present only when the spec has one",
    "specId": "16 lowercase hex digits",
    "lot": "0123·4567",
    "link": "https://dyelot.vercel.app/studio#s=…",
    "createdWith": "controls",
    "preset": "default",
    "gamut": "srgb",
    "contrastLevel": "AA"
  },
  "summary": { "pass": true, "contrast": {}, "separation": {}, "gamut": {}, "lint": {} },
  "contrast": [
    { "check": "C1:foreground/background", "rule": "C1", "kind": "text", "mode": "light",
      "foreground": "foreground", "fg": "#0b0b0c", "background": "background", "bg": "#ffffff",
      "ratio": 19.8137, "threshold": 4.5, "required": true, "pass": true, "lc": 104.2 }
  ],
  "separation": [ { "set": "status", "mode": "light", "view": "none", "minDeltaE": 0.1712, "threshold": 0.08, "pass": true } ],
  "gamut": { "gamut": "srgb", "values": 176, "outside": [] },
  "roles": { "light": { "background": "#ffffff" }, "dark": { "background": "#0d0e10" } },
  "radius": "0.75rem",
  "findings": [ { "id": "N3", "severity": "info", "mode": "light", "subject": "border/background",
                  "measured": 1.3021, "threshold": 3, "source": "WCAG 2.2 SC 1.4.11 (decorative dividers are exempt)" } ],
  "files": [ { "path": "DESIGN.md", "bytes": 18234, "sha256": "64 lowercase hex digits" } ]
}
```

- `design.preset` is `presetOf(spec)` or `null`; `design.oneLiner` is absent when the spec has none.
- `summary` is `summarize(measureSpec(spec), lintSpec(spec), gamut)`, its keys in the order of `Summary`.
- `contrast` holds the 80 measurements in `measureSpec`'s order. `ratio` is `trunc4` of the full float; `lc` is `round1` of
  the advisory score. `separation` holds the 16 entries with `minDeltaE` through `trunc4`; `pass` is `minDeltaE >= 0.08`.
- `gamut.outside` lists only the steps over the tolerance, as `{ palette, step, mode, excess }` with `excess` through `fmt4`.
- `roles` holds the 46 hexes of each mode in `ROLE_NAMES` order; `radius` is the value `theme.css` writes for `--radius`.
- `findings` holds `lintSpec(spec)` in the linter's order, every number through `fmt4`.
- `files` holds the other files in bundle order: 17 to 20 entries.

### 7.2 The checker's report (Task 3.10)

Each finding has a `code` and a message. The codes are `theme-changed`, `role-mismatch`, `role-missing`,
`radius-mismatch`, `theme-name-changed`, `contrast-fails`, `shadowed`, `raw-color`, `palette-class`, `arbitrary-color` and
`marker-without-reason`. A scan finding also has `path`, `line`, `column` (1-based) and the matched `text`.

The human report: a first line `dyelot-check · <lot> · <name>`, then one line per finding,
`<path>:<line>:<column>  <code>  <message>` (or `<code>  <message>` for one with no place), then one line per exempt line,
`ignored  <path>:<line>  <reason>`, then the counts line `<n> roles · <m> pairs · <k> files scanned`, then `PASS`,
`FAIL (<n> findings)` or `ERROR: <message>`.

With `--json`: one object, `{ format: "dyelot.check-report/1", result, design: { specId, lot }, findings, ignored,
checked: { theme, roles, pairs, files } }`, written with two-space indent and a newline, and nothing else on stdout.

## 8. Import: errors and messages (Tasks 3.5 and 3.12)

Both importers check, in this order: the input is a string (`TypeError` otherwise, R-05); its raw UTF-8 length is at most
`IMPORT_MAX_BYTES`; it is not empty after normalization; it holds no U+0000 and fewer than 1 in 100 U+FFFD characters.
Every error carries a sentence with a way forward, written as text, never as HTML:

| Code | Message |
|---|---|
| `empty` | The import is empty. Paste a DESIGN.md or a shadcn theme, or choose a file. |
| `too-large` | That is larger than 256 KB. Import a DESIGN.md or a theme stylesheet of at most 256 KB. |
| `binary` | That does not look like text. Choose a .md or a .css file. |
| `no-roles` | No theme colors were found. A shadcn theme defines variables such as --background and --primary in :root. |
| `no-primary` | No primary color was found. Add a primary color, then import again. |
| `yaml` | The YAML on line <n> could not be read. Check its indentation and quotes, then import again. |
| `yaml-alias` | The YAML uses an anchor or an alias on line <n>. Write the values out in full, then import again. |
| `yaml-group-twice` | The YAML defines <group> twice. Keep one definition, then import again. |
| `yaml-too-large` | The YAML holds more than 64 KB. Keep the tokens under 64 KB, then import again. |

`detectImport(text, fileName)` returns `"design-md"` for a file name ending `.md` or `.markdown` and `"shadcn-css"` for one
ending `.css`, whatever the text. Without such a name it returns `"design-md"` when the first non-empty line is `---` or a
line starts with `## Colors`, `"shadcn-css"` when the text holds `:root` or `.dark` followed by `{`, or a declaration of
`--background` or `--primary`, and `null` otherwise. It never throws for a string.

## 9. The studio's new UI (Tasks 3.13 to 3.16)

### 9.1 About (Task 3.13)

The inputs panel opens with a section "About": a text field "Name" (placeholder "untitled", hint "Up to 80 characters"), a
text field "One line" (hint "Up to 140 characters") and a button "Import…" (Task 3.16). When `toPlainText` cuts the text, the
field's message reads "Cut to 80 characters." or "Cut to 140 characters.". A burst of typing within the coalesce window is
one history entry (R2-13 item 6). An empty field removes the value: the name returns to "untitled".

### 9.2 The export dialog (Tasks 3.14 and 3.15)

`summaryLines(summary)` gives four lines, used by the dialog and the inspector:

1. `<requiredPass> of <required> required contrast checks pass`
2. `<checks − below> of <checks> color-vision checks keep status and chart colors apart`
3. `<values − outside> of <values> colors inside sRGB` (or `Display P3`)
4. `No lint errors` or `<n> lint errors` (`1 lint error`), then `, <w> warnings` and `, <i> notes`, singular for 1

A ready, passing dialog reads, top to bottom: the heading "Export"; the lot line `LOT <lot> · <name>`; the four summary lines
as a list; the file list, one row per file in bundle order with the path, the size by `formatBytes` (under 1,024 bytes
`<n> B`, then `<round1(n / 1024)> KB`), a "Preview" toggle (`aria-pressed`) and a "Copy" button named "Copy <path>"; the
preview, a focusable `pre` labelled "Preview of <path>" showing the selected file (the first one when the dialog opens);
"Download <zip name>" with the zip's size; "Close". A status region announces copies and the download ("Downloaded <zip
name>."). The dialog fits a 360 × 740 window with no horizontal scroll; long paths and names wrap.

A blocked dialog (R3-42) keeps the heading, the lot line and the summary lines, then the state's sentence, then the list of
failing checks (each finding of severity `error` as `<subject>, <mode>: <measured> against <threshold>`), then the file list
without sizes, the disabled buttons and "Fix in the inspector" or "Show the findings".

### 9.3 The import dialog (Task 3.16)

"Import…" opens a modal dialog labelled "Import" on the rules of R3-34 (inert page, focus to the heading, Escape, return of
focus, reduced motion). It holds a radio group "Format" ("DESIGN.md", "shadcn theme CSS") that follows
`chosenFormat(picked, fileName, text)` until the visitor picks one; a file input "Choose a file" accepting `.md`,
`.markdown`, `.css` and `.txt`; a textarea "Paste the text", described by the error region; "Import"; and "Cancel".
`fileAccepted(name, size)` refuses another extension ("Choose a .md or a .css file.") or a size over `IMPORT_MAX_BYTES` (the
`too-large` message) before reading the file. A chosen file's text fills the textarea. With no format picked and none
detected, "Import" shows "Choose DESIGN.md or shadcn theme CSS.". An error keeps the dialog open with its message in the
error region and focus on the textarea. A success closes the dialog, calls `store.importDesign`, shows the `imported` notice
and moves focus to the canvas region.

The `imported` notice reads "Imported the DESIGN.md exactly, from its edit link." for an exact import, and otherwise
"Imported a <DESIGN.md | shadcn theme>: <a> of 46 light roles and <b> of 46 dark roles came from the file." followed, when
any color was adjusted, by "<n> colors were adjusted to fit sRGB or drop alpha." and always by "Undo returns to the design
before.".

### 9.4 The inspector's Receipt section (Task 3.15)

After "Findings", the inspector shows a section "Receipt": the four summary lines, and when export is off, the state's
sentence of R3-42. It follows every committed change.
