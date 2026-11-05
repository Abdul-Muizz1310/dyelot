# 03 · The export bundle, the receipt, the checker and import (M3)

> Source note: this milestone spec refines `docs/specs/00-design.md`, the umbrella, and builds on
> `docs/specs/01-color-engine.md` (M1) and `docs/specs/02-studio.md` (M2). Paths to `docs/research/`, `docs/plans/` and
> `knowledge/` point into the private `repos` meta-repo.

Status: rebuilt on 2026-11-05 and approved by the owner on 2026-11-05, as written after review fix round 1. Task 3.0 passed on 2026-11-05: no design threw or raised an error.

The owner approved the first M3 spec on 2026-11-03. That file lived in a draft folder outside git on a machine the owner
no longer has, and it is lost. This file rebuilds it from the M3 plan (`docs/plans/2026-11-03-dyelot-m3-export.md` in the
meta-repo). The plan kept every ruling id (R3-01 to R3-42), every case id, every interface, the counts it measured and
the owner's four decisions (D1 to D4). Where the plan states a rule, this file copies it. Where the plan gives only an id
or a name, this file writes the rule anew. Each ruling in section 3 ends with **(plan)** when the plan states its
content, or **(rebuilt)** when this file supplies it, so the owner can review the rebuilt parts first. A fresh reviewer read the rebuilt spec against the plan and the code on
2026-11-05 (fix round 1); its findings are fixed in place, and the table at the end of section 1 lists every place where this
spec departs from the plan.

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

### Where this spec departs from the plan

| Plan | This spec | Why |
|---|---|---|
| `themeCss(spec, ORIGIN)`, `dtcgFiles(spec, name)`, `motionFiles(spec, name, lot)`, `skillFile(spec, slug)` | Each also takes `origin` (section 5.3) | Each prints the edit link, which needs the origin (fix round 1) |
| `toonFile(spec, lot)` | `toonFile(spec)` | The view holds no header, so the lot has no use (R3-19) |
| `cssFontStack(id)` | `cssFontStack(id, slot)` | A family outside the catalog needs its slot's fallback (6.1) |
| `chosenFormat(picked, fileName, text)` | `chosenFormat(picked, detected)` | App code reaches `detectImport` only through `import()` (R3-38) |
| `blockReason(state, lot)` | `blockReason(state, errors)` | The state's sentence counts errors and never names the lot (R3-42) |
| `STUB_FILES` with placeholder hashes | Stub texts hashed for real, and `app/theme.css` is `themeCss(SPEC, ORIGIN)` | The checker's hash check must hold on the `APP` fixture (section 4) |
| Task 3.5 runs C-IMP-01 to 12 | The `importDesignMd` halves of C-IMP-01 to 05 and 12 join in Task 3.12 | `importDesignMd` exists from Task 3.12 |
| The bundle is built once per open (R3-34 as the plan read it) | It is rebuilt when the committed spec changes while the dialog is open | Review Focus 1 (R3-34) |
| Task 3.0 leaves C-REPO-M2-07 passing | C-REPO-M2-07 changes: `SCAN_TESTS` gains the ten grid files (section 12) | The guard pins the scan set exactly |
| Task 3.2 touches no shared test support | `tests/unit/spec/support.ts` draws plain-text names (section 12) | R3-02 rejects a name with a leading or trailing space |

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

**R3-02 · Plain text.** `isPlainText(value)` is true when `value` is a well-formed string (no lone surrogate) of at least one character that
equals `value.normalize("NFC")`, holds no character of `\p{Cc}`, U+2028, U+2029, U+061C, U+200E, U+200F, U+202A to U+202E or U+2066
to U+2069, and neither starts nor ends with white space (`/\s/`). `toPlainText(raw, max)` follows this order: (1) drop every bidirectional control of that list and every lone surrogate;
(2) replace each run of white space, `\p{Cc}`, U+2028 and U+2029 with one space; (3) NFC; (4) trim; (5) when longer than
`max`, keep the longest prefix of whole code points whose NFC form has at most `max` code units, then NFC it and trim again.
Dropping the controls before NFC matters: `"e"` + U+200E + U+0301 would otherwise come out as a decomposed `"é"`. It returns `null` when the result is empty, and otherwise `{ text, truncated }`, where `truncated` says
step 5 cut. `raw` must be a string (`TypeError`) and `max` an integer of at least 1 (`RangeError`); every message names `toPlainText`.
`isPlainText` of a non-string is a `TypeError` naming `isPlainText`, not `false`: a caller that hands it a number has a bug. The schema requires `isPlainText` of `meta.name`, `meta.oneLiner`, every `direction` text, every `rules`
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
`min(<n>, var(--weight-heading))`. One set in the mono face that F-WGT-01 finds at fault drops to 500, because Fragment Mono, the mono face of 11 of the 20
pairings, holds only 400. Body faces need no cap: C-WGT-06 asserts that every pairing's body family renders 600.
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
each mode, each palette in `PALETTE_NAMES` order and each step: `{ palette, step, mode, excess }`, where `excess` is `gamutExcess(oklch, gamut)`. `measureSpec` checks that every role it reads is a lowercase `#rrggbb` (a
`RangeError` naming the role and `measureSpec`).

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
passing. It cuts the decimal digits of the shortest string that reads back as `x` (`String(x)`, written out in full when it
uses an exponent), never `Math.trunc(x × 10000) / 10000`, which turns 1.13 into `1.1299`. `round1(x)` rounds half away from zero to 1 decimal and returns a number. `round6` is the engine's. Each throws a
`RangeError` for a number that is not finite and a `TypeError` for a non-number. Every piece of user text goes through one of
four helpers. `slug(text)` lowercases, folds U+00C0 to U+017F to ASCII by a fixed table (never `normalize`), turns each run of
characters outside `[a-z0-9]` into `-`, trims `-`, cuts to 48 characters, trims `-` again, and gives `"design"` for an
empty result. `mdText(text)` backslash-escapes `` \ ` * _ [ ] < > # | ~ `` everywhere, and a leading `-`, `+`, `=` or
`<digits>.`. `yamlString(text)` writes a YAML double-quoted scalar, escaping `\` and `"`. `cssComment(text)` writes `/* <text> */` with every `*/` in the text written `* /`. `mdText`, `yamlString` and `cssComment` throw a
`RangeError` for text that `isPlainText` rejects, and every writer that takes a `name` or a `lot` checks them (`isPlainText`,
and `^[0-9a-f]{4}·[0-9a-f]{4}$`). **(plan; the helpers' rules rebuilt)**

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
design with three distinct families that next/font can load. The edit link is `editLink(spec, origin)`: `<origin>/studio#s=<encodeSpec(spec)>`, with the origin checked as above. Per D4,
`DESIGN.md`, `prompt.md`, the skill and the header comment of `theme.css` carry the words "Made with dyelot" and the edit
link, and the receipt records the link. `zipName(bundle)` is `<slug>-<the first 8 digits of the spec id>.zip`. **(plan; the
order rebuilt from the plan's file list)**

**R3-13 · `theme.css` reuses the bridge.** `themeCss(spec, origin)` writes the values of `themeVars(spec, "light")` and the color values of `themeVars(spec, "dark")`
in the layout of section 6.2: every name the bridge also writes carries the bridge's value. Its own values are only the
mappings of R3-14 (`--spacing`, the `--font-weight-*` names, white and black) and the font stacks of `cssFontStack`, which add
Fontsource's variable family names (6.1). Shadow layers stay as the bridge
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
holding the 46 roles, the 88 steps and, in `light`, `radius`; `cssVars.theme` holds the five radii and, for a family with no font item, its `font-*` stack. When the display and body share a family,
its one font item sets `--font-sans`, and `cssVars.theme` holds `"font-heading": "var(--font-sans)"`. Colors never go into `cssVars.theme`, where shadcn's CLI writes them as `--color-color-*`. Each
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
`$description`. A shadow is an array of the bridge's two layers (layered at 1.5 times, alpha capped at 1) with `offsetX` 0, `spread` 0 and
each layer's OKLCH and alpha; a flat design writes one transparent layer of zeros. The
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
order: `{ role, light, dark }`. TOON quotes every string that starts with `#`. `toonFile(spec)` takes no lot, because the view holds no header. The view is not canonical: DESIGN.md's Install
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
   `styles/globals.css` that exists. When that file imports a file named `theme.css` by any relative path (`@import "…"`, `@import '…'` or `@import
   url(…)`, with or without a `layer(…)`, `supports(…)` or media list after it), the theme is the imported file; otherwise, when the global stylesheet itself defines every
   role, it is the theme; otherwise the run stops with exit 2. When the theme is a file named `theme.css`, wherever it sits, its
   SHA-256 must equal the receipt's entry for `app/theme.css` (`theme-changed`). **1b.** In the theme's `:root` and `.dark` blocks each of the 46 roles
   must equal the receipt's hex for that mode, case aside (`role-mismatch`, `role-missing`); `--radius` must equal the
   receipt's (`radius-mismatch`); and, when the theme is the bundle's `theme.css`, every name its `@theme inline` block maps
   (`--color-<role>`, `--color-<palette>-<step>`) must still point at the same variable (`theme-name-changed`).
2. **The pairs.** Each of the 78 required checks is measured again with WCAG 2.2 on the theme's values; a pair below its
   threshold is `contrast-fails`.
3. **Shadows.** A role, `--radius`, or a `--color-<role>` or `--color-<palette>-<step>` name defined again after the theme,
   in the global stylesheet or in another stylesheet that it imports later, with a value other than the theme's (white space
   aside), is `shadowed`, naming both places.
4. **The scan.** Every file with an extension of `.ts .tsx .js .jsx .mjs .cjs .css .scss .html .vue .svelte .astro .mdx`
   under the root is scanned, except folders named `node_modules` at any depth, `.git`, `.next`, `dist`, `build`, `out` and
   `coverage`, the bundle's own files (`receipt.json` and every path its `files` list names) and any file over 1 MiB. A line
   that declares one of the 46 roles, `--radius`, a scale step (`--<palette>-<step>` for the palettes neutral, primary, secondary, accent, success, warning, danger, info and the steps 50, 100 ... 900, 950) or a `--color-*` name is not scanned, in any file: checks 1b and 3 judge
   those, so the theme file of the registry route and shadcn's own blocks are never counted twice. A finding is a raw hex (`#` and 3, 4, 6 or 8 hex digits, not
   followed by a word character), a color function with a literal first argument (`rgb`, `rgba`, `hsl`, `hsla`, `hwb`, `lab`,
   `lch`, `oklab`, `oklch`, `color`, not `var(`), a Tailwind default palette class (a utility prefix such as `bg-`, `text-`,
   `border-`, `ring-`, `fill-`, `stroke-`, `from-`, `via-`, `to-`, `outline-`, `decoration-`, `divide-`, `shadow-`,
   `accent-`, `caret-` or `placeholder-`, then one of the 26 palette names of `tailwindcss` 4.3.3's `theme.css` (red, orange, amber, yellow, lime, green, emerald,
   teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose, slate, gray, zinc, neutral, stone, mauve, olive, mist
   and taupe) and a step 50 to 950; `white` and `black` are not flagged, because `theme.css` keeps them), or an arbitrary color value in brackets (`-[#…]`, `-[rgb(…)]` and the other functions). A bracketed value gives one `arbitrary-color` finding, never also a `raw-color`. Each is reported with path, line,
   column and the matched text.

Exit 0 means no finding; exit 1 means at least one; exit 2 means a usage or setup error (an unknown flag, a missing or
unreadable receipt, a receipt whose `format` is not `dyelot.check/1`, no theme). The human report's last line is `PASS` on
exit 0, `FAIL (<n> findings)` on exit 1 (`FAIL (1 finding)` for one) and `ERROR: <message>` on exit 2. Findings are reported in
check order (1, 1b, 2, 3, 4), the scan's by path in code-unit order, then line, then column. The exit-2 messages are "No
theme found: none of app/globals.css, src/app/globals.css and styles/globals.css exists.", "No theme found: <path> imports
no theme.css and does not define every role.", "Unknown option <flag>.", "No folder at <path>.", "No receipt at
<path>.", "The receipt at <path> is not valid JSON.", "The receipt's format is <x>, not dyelot.check/1." "--receipt needs a path.", "--root needs a path." and "The receipt at <path> lacks <key>." (for a receipt of the right
format without `roles`, `contrast`, `radius` or `files`). With `--json` it prints one JSON object and
nothing else: `{ format: "dyelot.check-report/1", result: "PASS" | "FAIL" | "ERROR", error?, design, findings, ignored, checked }`,
where `error` holds the message on exit 2 and `findings` and `ignored` are then empty.
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
6. **Generation.** `generateSystem` runs on `resolveParams` of `freshParams()` with those values at contrast level `AA`
   (so an import with no pairing gets the seed's automatic pairing, as a fresh design does), and the seed
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
`name`, else the first `#` heading, else "Imported design". The front matter's `description`, through `toPlainText(…, 140)`, becomes `meta.oneLiner`. The first paragraph of
`## Overview` becomes `direction.thesis`.
Bullet lines under `## Do's and Don'ts` that start "Do " or "Don't " become `rules.do` and `rules.dont`: each list keeps
its first 20 entries, each through `toPlainText(…, 200)`, and a cut or dropped entry lists its field in `truncated`. **(plan; the table
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
import takes the token path of R3-30, and the report says the link was ignored because the tokens changed. A link that `decodeSpec` cannot read takes the token
path too, with the note "The edit link could not be read.". **(plan)**

### The studio (Tasks 3.13 to 3.16)

**R3-33 · The store's additions.** The inputs panel gains an About section first, with two text fields, "Name" and
"One line". Each keeps its own raw text while the visitor types, and sends `setParams({ name })` or `setParams({ oneLiner })`
with `toPlainText(raw, max)?.text`, or `undefined` for an empty result, under the coalesce keys `"about-name"` and
`"about-one-liner"`. A field takes the store's value only when `params.name` (or `params.oneLiner`) differs from `toPlainText(raw, max)?.text`,
so typing a trailing space never jumps the cursor, and clearing the field shows its placeholder rather than "untitled". `importDesign(result)` loads `result.spec` as a link load does: the new snapshot is
`{ params, seed, spec, preset: presetOf(spec), provenance: "loaded" }` with the params of `paramsOfSpec`, and the old one
goes onto `history`. The notice `{ kind: "imported", format, exact, light, dark, adjusted }` (the counts of roles the file
set in each mode, and of colors adjusted) belongs to that snapshot: undo clears it, redo restores it. It replaces M2's `custom-fonts` notice for that snapshot;
when the import's fonts are outside the catalog, its text says so (9.3). `rebuild()` regenerates the held design from its own params and seed as a new commit, with
provenance `"generated"`. **(plan)**

**R3-34 · The export dialog.** "Export" sits in the toolbar right after "Copy link", with
`aria-keyshortcuts="Control+E Meta+E"`. It opens a modal dialog labelled by its heading "Export": the rest of the page is
inert, focus moves to the heading, Escape and "Close" shut it and return focus to the element that opened it, and it fades in and out over 150 ms of opacity, with no transition at all under reduced motion. On open it loads `@/export` through `import()`. Its states are `loading`
("Building the bundle…"), `failed` ("The export code did not load." and "Try again"), `waiting` ("Waiting for the design to finish generating…") and `ready`. A ready dialog shows the lot line, the summary lines (section 9.2), the file list in bundle order
with each file's size and a "Copy" button, a preview of the selected file, and "Download <zip name>". The import dialog loads `@/import` the same way, with its own `failed` state: "The import code
did not load." and "Try again". The download builds
the zip, makes a `Blob` URL, clicks a temporary link with `download` set, and revokes the URL on the next task. The plan said
the bundle is built once per open; Review Focus 1 needs more, so the bundle is rebuilt whenever the committed spec changes
while the dialog is open. **(plan; the amendment recorded here, as Task 3.14 asked)**

**R3-35 · `Mod+E` and swallowing.** `shortcutFor` takes `dialogOpen` in its context. With no dialog open, Ctrl+E or Meta+E
(the key `e` or the code `KeyE`, without Alt or Shift, outside a text field) gives `{ kind: "open-export" }`, and a repeat of
it gives `{ kind: "swallow" }`. While a dialog is open, Mod+S and Mod+E give `{ kind: "swallow" }` anywhere, so the save
dialog and the address bar stay shut, and every other key gives `null`: the dialog handles its own keys and Escape. The page calls `preventDefault` for `swallow` and does nothing else. `dialogOpen` is optional, and absent reads as `false`, so every M2 case keeps its answer. As in M2, the canvas region keeps
its keys, so Mod+E there does nothing. **(plan)**

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
decides.** The table below is Task 3.0's record, copied by Task 3.1. **(plan)**

| Rule (severity `error`) | Checks run | Worst margin | Design | Its primary hue |
|---|---|---|---|---|
| C1 | 99,008 | 1.5751802 | A/default/AA/srgb/standard/s0 | 90 |
| C2 | 38,080 | 0.0010746501 | D/default/srgb/standard/s0/oklch(0.62 0.14 85) | 85 |
| C5 | 45,696 | 0.0000969183 | B/default/AA/srgb/standard/s0/#0000ff | 264.052 |
| N1 | 15,232 | 1.2372054 | A/default/AA/srgb/standard/s3 | 135 |
| N2 | 76,160 | 1.2389560 | A/default/AA/srgb/standard/s3 | 135 |
| F1 | 22,848 | 0.9066154553 | D/default/srgb/standard/s0/oklch(0.62 0.14 175) | 175 |
| S1 (below 0.05) | 60,928 | 0.0315125 | A/default/AA/srgb/even/s0 | 90 |
| K1 | 609,280 | 0.001158 | C/editorial/AA/srgb/standard/s0/secondary #ff00ff | 90 |
| G1 | 670,208 | 0.00015728 | C/default/AA/srgb/standard/s0/accent #00ff00 | 90 |
| G3 | 670,208 | none (yes or no) | none | none |

The primary hues of `s0` to `s3`: 90, 159, 29 and 135.

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

A required check is a lint rule of severity `error` (D1); `<n>` counts those findings, and reads "1 required check" when it
is one. The 78 required contrast checks of the summary are a subset of them. `rebuildOutcome(snapshot,
generate)` calls `generate(snapshot.params, snapshot.seed)` and lints the result: `"passes"` with no error, `"fails"` with
one, `"throws"` when `generate` throws. The store computes it once per held blocked design, when it commits or loads that design and before it notifies
subscribers, and keeps it in an internal memo by spec id. `exportState(summary, provenance, outcome)` returns `"passing"`,
`"fixable"`, `"stuck"` or `"fault"`, and throws for a failing loaded design with no outcome, a state the store never shows.
`blockReason(state, errors)` gives the state's sentence. Only the unit tests reach `stuck`: in the browser `generateNow`
runs the real generator, which I-M3-10 says passes. In
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
  Playwright against the production build with axe. A property case uses fast-check with the run count and seed it states; its seed is 3000 plus its task number unless the case names another.
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
  hex or OKLCH, a shadow layer's OKLCH and alpha), formatted by the rules of section 6. No writer invents a color, except the white and black that `theme.css` keeps for
  Tailwind (R3-14) and the transparent layer of zeros DTCG writes for a flat shadow (R3-17).
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
- `APP(files)` writes `themeCss(SPEC, ORIGIN)` as `app/theme.css`, `app/globals.css` holding `@import "./theme.css";`, and
  `receiptJson(SPEC, STUB_FILES, ORIGIN)` as `receipt.json` into a fresh temporary folder, then the given files.
  `SHADCN_APP(files)` writes shadcn's scaffold instead: the full `globals.css` of `shadcn-neutral.css`, a `components.json`
  and `components/ui/button.tsx` as shadcn's `new-york` style writes them, plus the unzipped `BUNDLE`, then the given files.
- `STUB_FILES` holds the 20 paths of a 21-file bundle other than `receipt.json`, each with the text `"stub <path>\n"`, except `app/theme.css`, whose text is `themeCss(SPEC, ORIGIN)` so the checker's hash
  check holds (Task 3.8). The receipt can then be tested before the bundle exists.
- `LONG_NAME` is an 80-character name with no space: `"Saltmarsh"` repeated eight times and `"Tidewater"` cut to 8.
- `ONE_FAIL` is `SPEC` with its light `secondary-foreground` set to `#858585`: one C1 error, and regenerating it from its
  parameters gives `SPEC` again. `LINK(spec)` is `/studio#s=` plus `encodeSpec(spec)`.

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

The writers behind the entry, each pure and each tested on its own. Their signatures:

```ts
function editLink(spec: DesignSpec, origin: string): string; // text.ts, checks the origin (R3-12)
function themeModel(spec: DesignSpec): ThemeModel;
function themeCss(spec: DesignSpec, origin: string): string;
function registryItems(spec: DesignSpec, slug: string): readonly BundleFile[];
function dtcgFiles(spec: DesignSpec, name: string, origin: string): readonly BundleFile[];
function figmaFiles(spec: DesignSpec, name: string): readonly BundleFile[];
function toonFile(spec: DesignSpec): BundleFile;
function motionFiles(spec: DesignSpec, name: string, lot: string, origin: string): readonly BundleFile[];
function receiptJson(spec: DesignSpec, others: readonly BundleFile[], origin: string): string;
function designMdTokens(spec: DesignSpec): Record<string, unknown>;
function designMd(spec: DesignSpec, origin: string): string;
function agentsSnippet(spec: DesignSpec): string;
function promptMd(spec: DesignSpec, origin: string): string;
function skillFile(spec: DesignSpec, slug: string, origin: string): BundleFile;
function cssFontStack(id: string, slot: "display" | "body" | "mono"): string;
```

By file: `fmt4`, `trunc4`, `round1` (`format.ts`); `slug`,
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
  catalog's family name, or the id with each `-` read as a space for a family outside it. `cssFontStack(id, slot)` is `"<Family> Variable", "<Family>", <fallback>` for a variable family (Fontsource's naming) and
  `"<Family>", <fallback>` for a static one; for a family outside the catalog it is `"<familyName(id)>",` followed by the
  bridge's fallback for the slot (sans for display and body, mono for mono). `fontPackage(id)` is `@fontsource-variable/<id>` or `@fontsource/<id>`, or `null` outside the catalog.
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

`cssVars.theme` also holds `font-heading`, `font-sans` or `font-mono` (the stack) for a family that has no font item, and
`"font-heading": "var(--font-sans)"` when the display and body share one family.
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

The comments above are this spec's notes; the file has none. Each step's `fontFamily` names the display family for
display and h1 to h4 and the body family for the others, as the weights of 6.1 do. `designMdTokens(spec)` returns this front matter as an object,
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
   palette classes such as bg-blue-500.", "Don't set body text under <body> px.", where `<body>` is the body step's size (16
   in the product context, 14 in a dense one, so a dense design never contradicts its own tokens).
10. `## Dark mode`, `## Motion` (durations, easings, springs with their settle times, the reduced-motion rule) and
    `## Accessibility` (the contrast level and the four summary lines of section 9.2).
11. `## Install` and `## Self-check before you finish`, word for word as in 6.9.1, `theme.css` embedded verbatim in a
    ` ```css ` fence at the end of Install.

#### 6.9.1 The Install and Self-check text

```markdown
## Install

Two routes put this system into a Next.js app with Tailwind CSS v4. Pick one.

**Route 1: the stylesheet.** Copy `app/theme.css` into your app's `app/` folder. In `app/globals.css`, keep `@import "tailwindcss";` and add `@import "./theme.css";` right after it. If shadcn/ui wrote `globals.css`, delete its `@custom-variant dark`, `:root`, `.dark` and `@theme inline` blocks, because they would override this theme. If the template sets a `font-family` on `body`, remove it, so the theme's fonts apply. Install the fonts with `npm install <packages>` and import each once in `app/layout.tsx`: <one import line per package>. Put the class `dark` on `<html>` to show dark mode.

**Route 2: shadcn.** Run `npx shadcn@latest add ./registry/<slug>.json`, then `npx shadcn@latest add ./registry/font-<id>.json` for each font file. Do not also import `app/theme.css`. This route sets the colors, the radius and the fonts; the type steps, shadows and easings live only in `app/theme.css`, so copy its `@theme` block if you need them.

Either way, copy `scripts/dyelot-check.mjs` and `receipt.json` into the app's root, and add the block in `AGENTS.md.snippet` to your `AGENTS.md`. The files in `tokens/` are the source of truth for design tools; `design.toon` is a compact view of the same colors for prompts.

## Self-check before you finish

Run `node scripts/dyelot-check.mjs` from the app's root before you finish any UI change. It checks the theme against `receipt.json`, measures the 78 required contrast pairs again, and scans the source for raw colors and Tailwind palette classes. Fix every finding until it prints `PASS`. A raw color you must keep needs a comment on its line: `dyelot-check-ignore: <reason>`. Never edit `receipt.json` or `app/theme.css` by hand to make the check pass; change the design in the studio and export it again: <link>
```

When no family has a font item, Route 2's command stops after the theme file: the words "`, then npx shadcn@latest add
./registry/font-<id>.json` for each font file" are left out; when a family is outside the catalog, its
package is left out of Route 1's install line.

### 6.10 `AGENTS.md.snippet` (Task 3.9)

Eleven lines, outside Next.js's managed markers, with `<body>` the body step's size as in 6.9:

```markdown
<!-- dyelot:start <lot> -->
## Design system: <name>
- Read DESIGN.md before any UI change; it is the design brief.
- Colors, type, radius, shadows and motion come only from the tokens in app/theme.css.
- Never write a raw hex, rgb(), hsl() or oklch() color in a component.
- Use the role utilities (bg-background, text-foreground, bg-primary, text-primary-foreground, border-border), never Tailwind's default palette classes such as bg-blue-500.
- Pair every fill with its foreground role, such as bg-primary with text-primary-foreground.
- Set body text with the type steps (text-body and up), never under <body> px.
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
  "radius": "12px",
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
- `findings` holds `lintSpec(spec)` in the linter's order; the `measured` value of a WCAG rule (C1, C2, C5, N1, N2, N3, F1)
  goes through `trunc4`, like the ratios, and every other number through `fmt4`.
- `files` holds the other files in bundle order: 17 to 20 entries.

### 7.2 The checker's report (Task 3.10)

Each finding has a `code` and a message. The codes are `theme-changed`, `role-mismatch`, `role-missing`,
`radius-mismatch`, `theme-name-changed`, `contrast-fails`, `shadowed`, `raw-color`, `palette-class`, `arbitrary-color` and
`marker-without-reason`. A scan finding also has `path`, `line`, `column` (1-based) and the matched `text`.

The human report: a first line `dyelot-check · <lot> · <name>`, then one line per finding,
`<path>:<line>:<column>  <code>  <message>` (or `<code>  <message>` for one with no place), then one line per exempt line,
`ignored  <path>:<line>  <reason>`, then the counts line `<n> roles · <m> pairs · <k> files scanned`, then `PASS`,
`FAIL (<n> findings)` or `ERROR: <message>`.

With `--json`: one object, `{ format: "dyelot.check-report/1", result, error?, design: { specId, lot }, findings, ignored, checked: { theme, roles,
pairs, files } }`, with `error` only on exit 2, written with two-space indent and a newline, and nothing else on stdout.

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
`<n> B`, then `<round1(n / 1024)> KB`), a toggle named "Preview <path>" (`aria-pressed`) and a "Copy" button named "Copy <path>"; the
preview, a focusable `pre` labelled "Preview of <path>" showing the selected file (the first one when the dialog opens);
"Download <zip name>" with the zip's size; "Close". A status region announces copies and the download ("Downloaded <zip
name>."). The dialog fits a 360 × 740 window with no horizontal scroll; long paths and names wrap.

A blocked dialog (R3-42) keeps the heading, the lot line and the summary lines, then the state's sentence, then the list of
failing checks (each finding of severity `error` as `<subject>, <mode>: <measured> against <threshold>`, the measure through `trunc4` and
the threshold through `fmt4`), then the file list
without sizes, the disabled buttons and "Fix in the inspector" or "Show the findings".

### 9.3 The import dialog (Task 3.16)

"Import…" opens a modal dialog labelled "Import" on the rules of R3-34 (inert page, focus to the heading, Escape, return of
focus, reduced motion). It holds a radio group "Format" ("DESIGN.md", "shadcn theme CSS") that follows `chosenFormat(picked, detected)`, where `detected` is the loaded module's `detectImport(text, fileName)`,
until the visitor picks one; a file input "Choose a file" accepting `.md`,
`.markdown`, `.css` and `.txt`; a textarea "Paste the text", described by the error region; "Import"; and "Cancel".
`fileAccepted(name, size)` refuses another extension ("Choose a .md or a .css file.") or a size over `IMPORT_MAX_BYTES` (the
`too-large` message) before reading the file. A chosen file's text fills the textarea. With no format picked and none
detected, "Import" shows "Choose DESIGN.md or shadcn theme CSS.". An error keeps the dialog open with its message in the
error region and focus on the textarea. A success closes the dialog, calls `store.importDesign`, shows the `imported` notice
and moves focus to the canvas region.

The `imported` notice reads "Imported the DESIGN.md exactly, from its edit link." for an exact import, and otherwise
"Imported a <DESIGN.md | shadcn theme>: <a> of 46 light roles and <b> of 46 dark roles came from the file." followed, when
any color was adjusted, by "1 color was adjusted to fit sRGB or drop alpha." for one, "<n> colors were adjusted to fit sRGB or drop alpha." otherwise, then, when the import's fonts are outside the catalog, by "Its fonts are not in dyelot's catalog, so the canvas shows a
fallback.", and always by "Undo returns to the design before.".

### 9.4 The inspector's Receipt section (Task 3.15)

After "Findings", the inspector shows a section "Receipt": the four summary lines, and when export is off, the state's
sentence of R3-42. It follows every committed change.

## 10. Cases

Each case below becomes a test that carries its id. A row's Kind and Origin read as section 4 says; a case that names
a task belongs to that task, and every other case to the task of its subsection.

### 10.1 The spec model (Task 3.2)

Tests: `tests/unit/spec/schema-m3.test.ts`, `tests/unit/spec/text.test.ts`, `tests/unit/spec/lot.test.ts`,
`tests/unit/engine/generate-text.test.ts`, `tests/unit/features/studio/params-m3.test.ts`, and the amended
`tests/unit/engine/entry.test.ts`, `tests/unit/spec/schema.test.ts` (C-SCHEMA-14) and `tests/unit/engine/generate.test.ts`
(C-GEN-10). Invisible characters are written as escapes in the tests (`"\u202e"`, `"e\u0301"`), never as raw characters.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-SPEC3-01 | pass | `isPlainText` is true for `"Saltmarsh"`, `"a b"`, `"Crème brûlée"` (NFC), `"日本語"`, `"😀"` and a string of 280 `x` | plan, ruling R3-02 |
| C-SPEC3-02 | pass | `isPlainText` is false for `""`, `" a"`, `"a "`, `"a\tb"`, `"a\u0000b"`, `"a\u007fb"`, `"a\u0085b"`, `"a\u2028b"`, `"a\u2029b"`, `"a\u061cb"`, `"a\u200eb"`, `"a\u200fb"`, each of U+202A to U+202E and U+2066 to U+2069 inside `"a…b"`, and the decomposed `"e\u0301"`, and the lone surrogate `"a\ud800b"` | plan, ruling R3-02 |
| C-SPEC3-03 | pass | `toPlainText` follows R3-02's order: `"  a\t\tb  "` gives `{ text: "a b", truncated: false }`; `"e\u0301"` gives `"é"`; `"a\u202eb"` gives `"ab"`; `"a\u2028\u2029b"` gives `"a b"`; `"a\u0000\u0001b"` gives `"a b"`; `"\u0000"`, `"   "` and `""` give `null`; `"e\u200e\u0301"` gives the composed `"\u00e9"` (the control goes before NFC); `"a\ud800b"` gives `"ab"` | plan, ruling R3-02 |
| C-SPEC3-04 | pass | Cutting: `toPlainText("abcdef", 3)` is `{ text: "abc", truncated: true }`; `toPlainText("ab cd", 3)` is `{ text: "ab", truncated: true }` (the cut is trimmed again); `toPlainText("ab😀", 3)` is `{ text: "ab", truncated: true }` (the cut would split the pair); `toPlainText("abc", 3)` is `{ text: "abc", truncated: false }` | plan, ruling R3-02 |
| C-SPEC3-05 | pass | Property, 1,000 runs, `seed: 3002`, over `fc.fullUnicodeString` up to 400 code units and `max` in 1 to 300: the result is `null` or its `text` passes `isPlainText` and has a length of at most `max`; `toPlainText(text, max)` of a non-null result returns the same text with `truncated: false` | ruling R3-02 |
| C-SPEC3-06 | failure | `toPlainText(5, 3)` and `toPlainText("a", "3")` throw `TypeError`; `toPlainText("a", 0)`, `toPlainText("a", 1.5)` and `toPlainText("a", NaN)` throw `RangeError`; `isPlainText(5)` throws `TypeError`. Each message names its function | plan, ruling R3-02, R-05 |
| C-SPEC3-07 | pass | `DesignSpecSchema` accepts SPEC with `meta.oneLiner` of 1 and of 140 characters, and with a `direction` holding only `thesis`, only `adjectives`, only `like`, only `unlike`, or all four at their upper bounds (280; 5 entries of 24; 5 entries of 80; 5 entries of 80); `normalizeSpec` keeps them; `decodeSpec(encodeSpec(s))` deep-equals `s` | plan, ruling R3-01 |
| C-SPEC3-08 | failure | The schema rejects, each naming its path: `meta.oneLiner` of 0 or 141 characters; `direction: {}`; a `direction` with an unknown key; `adjectives: []`, 6 entries, or an entry of 25 characters; `like` or `unlike` of 6 entries or with an entry of 81 characters; `thesis` of 281 characters; any of these texts failing `isPlainText` (`" a"`, `"a\u202eb"`) | plan, ruling R3-01, R3-02 |
| C-SPEC3-09 | failure | The plain-text rule reaches the existing fields: `meta.name` of `" Saltmarsh"` or `"a\u0000b"`; a `rules.do` entry `""` (the new lower bound) or `"x\n"`; a policy (`components.cards`, `.emphasis`, `.inputs` or `.icons.library`) of `"x "` each fail the schema | plan, ruling R3-02 |
| C-SPEC3-10 | pass | `lotTag` of `@/spec` is the same object the studio's `lot.ts` re-exports; `lotTag("0123456789abcdef")` is `"0123·4567"`. `lotTag(5)` throws `TypeError`; `lotTag("0123")` and `lotTag("0123456789ABCDEF")` throw `RangeError`; each message names `lotTag` | plan, ruling R3-03 |
| C-SPEC3-11 | pass | I-M3-06: SPEC's spec id and every M1 and M2 share-link golden are unchanged; a spec with `oneLiner` and `direction` has a spec id different from the same spec without them, and its link round-trips | plan, I-M3-06 |
| C-GEN3-01 | pass | `generateSystem({ ...DEFAULT_PARAMS, oneLiner: "Tide charts for small boats", direction: { thesis: "Calm and exact", adjectives: ["calm", "exact"] }, rules: { do: ["Use one accent"], dont: ["No gradients"] } }, "seed-1")` writes `meta.oneLiner`, `direction` and `rules` equal to the inputs, and is otherwise deep-equal to SPEC except `meta` key order | plan, ruling R3-01 |
| C-GEN3-02 | pass | Without the three params, `generateSystem(DEFAULT_PARAMS, "seed-1")` deep-equals the M2 SPEC: `meta` has no `oneLiner` key, the spec has no `direction` key, and `rules` is `{ do: [], dont: [] }` | plan, I-M3-06 |
| C-GEN3-03 | failure | `generateSystem` throws `RangeError` naming the field for `oneLiner` of `""`, 141 characters or `" x"` (`generateSystem: params.oneLiner`); `direction: {}` (`params.direction`); 6 adjectives (`params.direction.adjectives`); a `rules.do` entry `""` (`params.rules.do`); `name: " x"` (`params.name`); and `TypeError` for `oneLiner: 5`, `direction: "x"` and `rules: []` | plan, ruling R3-01, R3-02 |
| C-GEN3-04 | pass | For 25 specs over all presets with `oneLiner`, `direction` and `rules` set, `generateSystem(resolveParams(paramsOfSpec(spec).params, spec.meta.seed), spec.meta.seed)` deep-equals the spec (C-STORE-30 with the new fields) | plan, ruling R3-03 |
| C-PAR3-01 | pass | `freshParams`, `resolveParams` and `paramsOfSpec` of `@/engine` are the same objects that `src/features/studio/params.ts` exports; every M2 test that imports them from the studio still passes | plan, ruling R3-03 |
| C-PAR3-02 | pass | `paramsOfSpec` reads `oneLiner`, `direction` and `rules` back from a spec that has them; a spec whose `rules` are `{ do: [], dont: [] }` gives params with no `rules` key; a spec with `rules: { do: ["x"], dont: [] }` gives `rules` with both lists | plan, ruling R3-03 |
| C-PAR3-03 | pass | `DIRECTION_PARAM_KEYS` equals `["primary", "secondary", "accent", "harmony", "chroma", "neutralTint", "gamut", "scaleMode", "contrastLevel", "type", "radius", "depth", "motion", "pairing", "name", "oneLiner", "direction", "rules"]` | plan, ruling R3-03 |
| C-PAR3-04 | pass | The studio's `parseParams` keeps `oneLiner`, `direction` and `rules` within R3-01's bounds, and returns `null` for `oneLiner` of 141 characters or `" x"`, `direction: {}`, a `rules.do` entry `""`, or `rules` that is not `{ do, dont }` | plan, ruling R3-03 |
| C-PAR3-05 | pass | `mergeParams` sets `oneLiner`, `direction` and `rules` from a patch and removes each for a patch value of `undefined`; `touchesPreset(before, after)` is false when only these three, or `name`, differ | plan, ruling R3-03 |
| C-PAR3-06 | pass | `paramsMatchSpec(params, spec)` is true for params with `oneLiner` and `direction` and the spec generated from them, and false when the spec's `meta.oneLiner` differs from `params.oneLiner` | ruling R3-03 |
| C-PAR3-07 | failure | `paramsOfSpec(null)`, `resolveParams(null, "s")` and `resolveParams({ ...freshParams() }, 5)` throw `TypeError` naming their function; `mergeParams(freshParams(), { about: "x" })` throws `RangeError` naming `patch.about` | added, R-05 |
| C-ENTRY3-01 | pass | The spec entry's key set is M2's plus exactly `lotTag`, `isPlainText` and `toPlainText` (Task 3.2). The engine entry's key set is M2's plus exactly `freshParams`, `resolveParams` and `paramsOfSpec` (Task 3.2), `CONTRAST_CHECKS`, `measureSpec` and `summarize` (Task 3.3), and `typeWeights`, `presetOf`, `springCurve`, `onFill`, `round6` and `roundHue` (Task 3.4); each is the same object its home module exports. Each task extends the expected set by its own names | plan, ruling R3-38 |
| C-ENTRY3-02 | pass | The export entry's key set is exactly `buildBundle`, `zipBundle`, `zipName`, `sha256` and `RECEIPT_FORMAT`, with `RECEIPT_FORMAT === "dyelot.check/1"` (Task 3.11). The import entry's key set is exactly `importDesignMd`, `importShadcnCss`, `detectImport` and `IMPORT_MAX_BYTES`, with `IMPORT_MAX_BYTES === 262144` (Task 3.12) | plan, ruling R3-38 |

### 10.2 Derived values (Tasks 3.0, 3.3 and 3.4)

Tests: `tests/unit/engine/measure.test.ts` and `tests/unit/engine/measure-agreement.test.ts` (Task 3.3);
`tests/unit/engine/measure-grid-1.test.ts` to `measure-grid-10.test.ts` with `tests/unit/engine/measure-grid-support.ts`, in
the `scan` project (Task 3.0); `tests/unit/engine/tokens/weights.test.ts`, `tests/unit/engine/tokens/spring.test.ts`,
`tests/unit/engine/presets-match.test.ts`, `tests/unit/export/sha256.test.ts` and F-WGT-01 in `tests/e2e/canvas.spec.ts`
(Task 3.4).

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-MEAS-01 | pass | `CONTRAST_CHECKS` has 40 entries with unique ids: C1 13, C2 5, C5 6, N1 2, N2 10, N3 1 and F1 3, in that order; the first id is `"C1:foreground/background"` and the last `"F1:ring/muted"`. The foreground and background of each rule's entries equal the M2 linter's pairs for that rule, in its order. `threshold` is 4.5 for C1 and C5 and 3 for the rest; `kind` is `text` for C1 and C5, `large-text` for C2 and `ui` for the rest; `required` is false for the N3 entry only. The array and each entry are frozen | plan, ruling R3-08 |
| C-MEAS-02 | pass | Property, 200 runs, `seed: 3003`, random role overlays on `GOLDENS` specs (each run picks a golden, a mode and 1 to 5 roles, and sets each to a random hex): every contrast entry's `ratio` equals `wcagRatio` of its two roles' hexes; `pass` is `ratio >= threshold`; and the findings of C1, C2, C5, N1, N2, N3 and F1 from `lintSpec` are exactly the failing entries, with subject `"<foreground>/<background>"`, the same mode, `measured` equal to `ratio`, the entry's threshold, and severity `info` for N3 and `error` for the rest | plan, ruling R3-08 |
| C-MEAS-03 | pass | `measureSpec(SPEC)`: `contrast` has 80 entries, the 40 checks in table order in light mode then in dark; `separation` has 16, ordered by mode, then set (`status`, `chart`), then view (`none`, `protan`, `deutan`, `tritan`); `gamut` has 176, ordered by mode, then palette in `PALETTE_NAMES` order, then step; every number is finite | ruling R3-08 |
| C-MEAS-04 | pass | Each separation entry's `minDeltaE` equals `minPairwiseDeltaE` of its set's four or five role colors under its view, the measure S1 reads; each gamut entry's `excess` equals `gamutExcess(step.oklch, spec.color.params.gamut)` | ruling R3-08 |
| C-MEAS-05 | pass | `summarize(measureSpec(SPEC), lintSpec(SPEC), "srgb")` is `{ pass: true, contrast: { checks: 80, required: 78, requiredPass: 78, advisoryBelow: 2 }, separation: { checks: 16, below: <the number of S1 findings> }, gamut: { gamut: "srgb", values: 176, outside: 0 }, lint: <the counts of lintSpec(SPEC) by severity> }`. With SPEC's light `secondary-foreground` set to `#858585`, the summary has `pass: false`, `requiredPass: 77` and `lint.error: 1` | plan, ruling R3-08 |
| C-MEAS-06 | failure | `measureSpec(null)` throws `TypeError`; a role value `"red"` throws `RangeError` naming the role; `summarize` with a `contrast` list of 79 entries throws `RangeError`, with `findings` that is not an array `TypeError`, and with gamut `"rec2020"` `RangeError`. Each message names its function | added, R-05 |
| C-MEAS-07 | pass | `lintSpec` of the 14 preset goldens and of SPEC equals `tests/unit/engine/__fixtures__/lint-before-m3.json`, which Task 3.3 wrote and committed before rebuilding the seven WCAG rules from the table | plan, ruling R3-08 |
| C-MEAS-08 | pass | For SPEC and each of the 14 preset goldens, the summary reads 78 of 78 required checks passing, `advisoryBelow: 2` (the border pair in each mode) and `lint.error: 0` | plan, ruling R3-08 |
| C-MEAS-09 | pass | Grid A (`measure-grid-1` and `-2`): each of the 672 designs generates without a throw and lints with no finding of severity `error`; a failure message names the design's label; each file prints its `GridRecord` with `console.table` | plan, ruling R3-41, I-M3-10 |
| C-MEAS-10 | pass | Grid B (`measure-grid-3` to `-7`), the same assertions over its 2,184 designs | plan, ruling R3-41, I-M3-10 |
| C-MEAS-11 | pass | Grid C (`measure-grid-8`), the same assertions over its 336 designs | plan, ruling R3-41, I-M3-10 |
| C-MEAS-12 | pass | Grid D (`measure-grid-9`), the same assertions over its 448 designs | plan, ruling R3-41, I-M3-10 |
| C-MEAS-13 | pass | Grid E (`measure-grid-10`), the same assertions over its 168 designs; and `gridDesigns` returns 672, 2,184, 336, 448 and 168 designs for A to E, 3,808 in all, with no label repeated | plan, ruling R3-41, I-M3-10 |
| C-WGT-01 | pass | `typeWeights(SPEC)` is `{ heading: 650, label: 500, body: 400 }` (Host Grotesk, variable 300 to 800) | plan, ruling R3-05 |
| C-WGT-02 | pass | Static display faces: a spec with the `gloock-albert`, `young-onest` or `tiny5-spline` pairing has `heading: 400`; one with `redaction-redhat` has `heading: 700`, the nearest of 400 and 700 to 650; each has `label: 500` and `body: 400` | plan, ruling R3-05 |
| C-WGT-03 | pass | With a test catalog: a variable display family of `[300, 600]` gives `heading: 600`; a variable body family of `[550, 900]` gives `label: 550` and `body: 550`; a static body family of `[400, 600]` gives `label: 600` (500 is a tie, which goes to the heavier); a static body family of `[300]` gives `label: 300` and `body: 300` | plan, ruling R3-05 |
| C-WGT-04 | pass | Families outside the catalog (`inter`, `inter`, `jetbrains-mono`) give `{ heading: 650, label: 500, body: 400 }`; `typeWeights(spec, catalog)` reads the given catalog in place of `FONT_CATALOG` | plan, ruling R3-05 |
| C-WGT-05 | failure | `typeWeights(null)` and `typeWeights({})` throw `TypeError`; `typeWeights(SPEC, "x")` throws `TypeError`; each message names `typeWeights` | added, R-05 |
| C-WGT-06 | pass | For each of the 20 `PAIRINGS`, the body family's catalog entry renders 600: a variable family whose range reaches 600 or a static family that copies a weight of 600 or more | plan, ruling R3-06 |
| F-WGT-01 | pass | A computed-style walk of every element in every template, at the 1280 frame in light mode, for the presets `maximalism`, `organic` and `dithering-pixel`, the `redaction-redhat` pairing and the default pairing (`host-grotesk`), finds no element whose computed `font-weight` is 600 or more while its first computed font family is a catalog face whose heaviest available weight is below 600. The canvas's `--weight-heading`, `--weight-label` and `--weight-body` equal `typeWeights(spec)` | plan, ruling R3-06 |
| C-SPR-01 | pass | `springCurve` of SPEC's springs: snappy `{ 0.25, 0.1 }` gives `settleMs` 411 and 26 samples; smooth `{ 0.4, 0 }` gives 706 and 44; bouncy `{ 0.5, 0.35 }` gives 1,056 and 65. Each first sample is 0, each last 1, and every sample has at most 4 decimals | plan, ruling R3-20 |
| C-SPR-02 | pass | For each of the three springs, the envelope of R3-20 is at most 0.001 at every whole millisecond from `settleMs` and above 0.001 at `settleMs − 1`; sampled every millisecond up to `3 × settleMs`, the curve stays within 0.001 of 1 from `settleMs` on | ruling R3-20 |
| C-SPR-03 | pass | Motion agreement: the `spring` generator of `motion-dom` 14.3.0, read from `node_modules/.pnpm/motion-dom@14.3.0/node_modules/motion-dom/dist/es/animation/generators/spring.mjs` and run with `keyframes: [0, 1]` and the same `visualDuration` and `bounce`, matches each sample within 0.005 (Motion's rest delta, at which it snaps to the target) for the three springs and for 20 random springs (fast-check 20 runs, `seed: 3004`, `visualDuration` in [0.1, 2], `bounce` in [0, 0.9]) | plan, ruling R3-20 |
| C-SPR-04 | pass | The sample count is clamped: `{ visualDuration: 0.05, bounce: 0 }` gives 11 samples (n = 10); `{ visualDuration: 4, bounce: 0.9 }` gives 121 (n = 120); `bounce: 1` uses the damping floor `ζ = 0.05` and returns finite samples | ruling R3-20 |
| C-SPR-05 | failure | `springCurve` throws `RangeError` for `visualDuration` 0, −1, `NaN` or `Infinity` and for `bounce` −0.1 or 1.1, and `TypeError` for `null` or a string field; each message names `springCurve` | added, R-05 |
| C-PMATCH-01 | pass | `presetOf` of each of the 14 preset goldens is that golden's id | plan, ruling R3-07 |
| C-PMATCH-02 | pass | A preset golden regenerated one contrast level higher still matches its preset; the `minimal-swiss` golden regenerated at `AA` (below its `AA+`) gives `null`; switching a golden's gamut or locking a seed keeps the match | plan, ruling R3-07 |
| C-PMATCH-03 | pass | Changing any one of harmony, chroma, neutral tint, scale mode, type context, radius set, depth style, motion feel or the pairing of a preset golden, and regenerating, gives `null` or the id of another preset whose values the result matches, never the golden's own id | plan, ruling R3-07 |
| C-PMATCH-04 | pass | `presetOf(IMPORTED)` is `null`; a preset golden with `meta.createdWith` set to `"import"` gives `null`; the default golden regenerated with an explicit pairing other than `choosePairing("seed-1")` gives `null` | plan, ruling R3-07 |
| C-PMATCH-05 | failure | `presetOf(null)` and a spec without `color.params` throw `TypeError` naming `presetOf` | added, R-05 |
| C-SHA-01 | pass | `sha256("")` is `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; `sha256("abc")` is `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`; 1,000,000 `a` give `cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0`; `sha256("é")` equals `sha256(new Uint8Array([0xc3, 0xa9]))` | plan |
| C-SHA-02 | pass | Property against `node:crypto`'s `createHash("sha256")`, 500 runs, `seed: 3004`: arbitrary full-Unicode strings (hashed as UTF-8) and byte arrays up to 4,096 bytes, with lengths 55, 56, 63, 64 and 65 always included, give equal lowercase hex | plan |
| C-SHA-03 | failure | `sha256(5)`, `sha256(null)` and `sha256([1, 2])` throw `TypeError` naming `sha256`; every result matches `^[0-9a-f]{64}$` | plan, R-05 |

### 10.3 Text and number helpers (Task 3.6)

Tests: `tests/unit/export/text.test.ts`, `tests/unit/export/format.test.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-TEXT-01 | pass | `slug`: `"Saltmarsh Tide"` gives `"saltmarsh-tide"`; `"Crème Brûlée!"` gives `"creme-brulee"`; `"Łódź Straße"` gives `"lodz-strasse"`; `"  --A__B--  "` gives `"a-b"`; `"日本"` and `"!!!"` give `"design"`; `LONG_NAME` gives its first 48 characters lowercased, with no trailing `-` | plan, ruling R3-10 |
| C-TEXT-02 | pass | Property, 1,000 runs, `seed: 3006`, over full-Unicode strings: `slug` always matches `^[a-z0-9]+(-[a-z0-9]+)*$` and has at most 48 characters; `src/export/text.ts` holds no `.normalize(` | plan, ruling R3-10 |
| C-TEXT-03 | pass | `mdText`: `"a*b_c"` gives `"a\*b\_c"`; `"[x](y)"` gives `"\[x\](y)"`; `"<b>"` gives `"\<b\>"`; `` "a`b|c~d#e\f" `` escapes each of `` ` | ~ # \ ``; `"- x"`, `"+ x"`, `"= x"` and `"12. x"` escape their first `-`, `+`, `=` or `.`; `"a - b"` keeps its inner `-`. Property, 1,000 runs, `seed: 3006`, over plain texts: removing each `\` before a character of the set gives back the input | plan, ruling R3-10 |
| C-TEXT-04 | pass | `yamlString('He said "hi" \ ok')` is `"He said \"hi\" \\ ok"` wrapped in double quotes; property, 1,000 runs, `seed: 3006`, over plain texts that include `#`, `:`, `- `, `yes`, `null`, `@`, `%`, `{` and `&`: `parse` of `yaml` 2.9.1 (core schema) reads `yamlString(text)` back as the string `text` | plan, ruling R3-10 |
| C-TEXT-05 | pass | `cssComment("a */ b")` is `"/* a * / b */"`; property, 1,000 runs, `seed: 3006`: the first `*/` in `cssComment(text)` is its last two characters | plan, ruling R3-10 |
| C-TEXT-06 | failure | `slug`, `mdText`, `yamlString` and `cssComment` throw `TypeError` for a non-string; `mdText`, `yamlString` and `cssComment` throw `RangeError` for a string that `isPlainText` rejects (`""`, `"a\nb"`). Each message names its helper | added, R-05, I-M3-08 |
| C-TEXT-07 | pass | `familyName("source-serif-4")` is `"Source Serif 4"` and `familyName("inter")` is `"inter"`; `cssFontStack("host-grotesk", "body")` starts `"Host Grotesk Variable", "Host Grotesk",`; `cssFontStack("gloock", "display")` starts `"Gloock",`; outside the catalog `cssFontStack("inter", "body")` is `"inter",` and the bridge's sans fallback, and `cssFontStack("jetbrains-mono", "mono")` ends with the mono fallback; `fontPackage("fragment-mono")` is `@fontsource/fragment-mono` and `fontPackage("inter")` is `null`; `describeDesign(SPEC)` is one plain-text sentence ending in a period that names no hex | added, section 6.1, R3-22 |
| C-TEXT-08 | failure | `familyName`, `cssFontStack` and `fontPackage` throw `TypeError` for a non-string id and `RangeError` for an id that does not match `FAMILY_ID` (`"Bad Id"`); `cssFontStack` throws `RangeError` for a slot other than `display`, `body` and `mono`; `describeDesign(null)` throws `TypeError`; each message names its function | added, R-05 |
| C-FMT-01 | pass | `fmt4`: `0.1` gives `"0.1"`; `1 / 3` gives `"0.3333"`; `2 / 3` gives `"0.6667"`; `0.00005` gives `"0.0001"`; `-0.00005` gives `"-0.0001"`; `1e-7` and `-1e-7` give `"0"`; `-0` gives `"0"`; `1e21` gives `"1000000000000000000000"`. `trunc4`: `4.49999` gives `"4.4999"`; `2.99999999` gives `"2.9999"`; `-1.23456` gives `"-1.2345"`; `21` gives `"21"`. `round1`: `2.25` gives `2.3`; `-2.25` gives `-2.3`; `12.04` gives `12` | plan, ruling R3-10 |
| C-FMT-02 | pass | Property, 10,000 runs, `seed: 3006`, over values within 0.001 of each threshold 0.05, 0.08, 0.1, 3, 4.5 and 7 and over [0, 25]: when `Number(trunc4(x)) >= t` then `x >= t`; `Number(trunc4(x)) <= x` for `x >= 0`; `Number(fmt4(x))` lies within 0.00005 of `x`; neither output holds `e` | plan, ruling R3-10 |
| C-FMT-03 | failure | `fmt4`, `trunc4` and `round1` throw `RangeError` for `NaN`, `Infinity` and `-Infinity` and `TypeError` for `"1"` and `null`; each message names its helper | plan, R-05 |

### 10.4 `theme.css` and the registry (Task 3.6)

Tests: `tests/unit/export/theme-css.test.ts`, `tests/unit/export/theme-compile.test.ts`,
`tests/unit/export/registry.test.ts`, `tests/unit/export/schemas.test.ts`, with `tests/unit/export/golden-support.ts` and
`tests/unit/export/schema-support.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-CSS-01 | pass | `themeCss(SPEC, ORIGIN)` is, in order: three header comment lines, `@custom-variant dark (&:is(.dark *));`, then `@theme`, `:root`, `.dark` and `@theme inline`, each once, blocks separated by one empty line; declarations indented two spaces; LF only; no line ends in a space; one trailing newline; no comment other than the header | plan, ruling R3-13 |
| C-CSS-02 | pass | The header lines are `cssComment` of "dyelot design system: <name> (LOT <lot>)", "Made with dyelot. Edit this design: <link>" and the fixed third line, where `<link>` is `<ORIGIN>/studio#s=<encodeSpec(SPEC)>`; a name holding `*/` is written with `* /` and the comment stays closed | plan, ruling R3-12, R3-13 |
| C-CSS-03 | pass | `@theme` holds 86 declarations in section 6.2's order: the reset and `--color-white: #ffffff`, `--color-black: #000000`; five families; three `--font-weight-*`; for each of the 10 steps `--text-<step>` and its three companions; 10 `--leading-*`; 10 `--tracking-*`; `--spacing: 4px`; five radii; five shadows; four easings | plan, ruling R3-14 |
| C-CSS-04 | pass | `:root` holds 145 declarations: `--radius` (the `lg` radius in px), the 46 roles and 88 steps of `themeVars(SPEC, "light")` in its order, the seven durations, `--spring-duration`, `--spring-bounce` and `--icon-stroke`, each equal to the bridge's value | plan, ruling R3-13 |
| C-CSS-05 | pass | `.dark` holds 134 declarations: the 46 roles and 88 steps of `themeVars(SPEC, "dark")`; `@theme inline` holds 134 declarations `--color-<name>: var(--<name>)`, roles in `ROLE_NAMES` order, then the steps | plan, ruling R3-13, R3-14 |
| C-CSS-06 | pass | For every golden, each value `theme.css` writes under a name the bridge also writes (the roles, steps, type, leading, tracking, radii, shadows, durations, easings, spring and icon stroke) equals that bridge value; soft and layered shadows keep `oklch(L C H / a)` with the bridge's scaling; a flat design writes `none` for all five | plan, ruling R3-13 |
| C-CSS-07 | pass | Each `--text-<step>--line-height` equals `--leading-<step>` and each `--letter-spacing` equals `--tracking-<step>`; `--font-weight` is `var(--font-weight-heading)` for display and h1 to h4, `var(--font-weight-label)` for label and `var(--font-weight-body)` for caption, body-sm, body and lead; a `marketing` or `editorial` spec writes the display step's `clamp()` with `vw` | plan, ruling R3-14 |
| C-CSS-08 | pass | `--font-display` and `--font-heading` equal `cssFontStack` of the display family, `--font-body` and `--font-sans` that of the body family, `--font-mono` that of the mono family; a variable family's stack starts `"<Family> Variable", "<Family>",`, a static family's `"<Family>",`; `--font-weight-*` equal `typeWeights(spec)` | plan, ruling R3-05, R3-14 |
| C-CSS-09 | pass | The `calm` design writes durations 63, 125, 188, 250, 375, 500 and 500 ms; `--radius` equals `--radius-lg`; the file never names `--space-` | plan, ruling R3-14 |
| C-CSS-10 | pass | Every golden's `theme.css` is free of `;`, `{` and `}` inside a value, holds every role exactly once in `:root` and once in `.dark`, and is equal on two calls | plan, I-M3-01 |
| C-CSS-11 | pass | `compile` of `tailwindcss` 4.3.3, with a `loadStylesheet` over `node_modules/tailwindcss`, of `@import "tailwindcss"; @import "./theme.css";` built with the candidates `bg-primary`, `text-primary-foreground`, `bg-primary-600`, `dark:bg-background`, `text-body`, `font-heading`, `font-mono`, `rounded-lg`, `shadow-2`, `ease-standard`, `p-3` and `text-white`: each yields a rule; `bg-primary` sets `background-color: var(--primary)`; `p-3` uses `calc(var(--spacing) * 3)`; `dark:bg-background` is scoped to `:is(.dark *)` | plan, ruling R3-14 |
| C-CSS-12 | pass | The same compile with `bg-blue-500`, `text-red-600`, `bg-slate-50` and `border-zinc-200` yields no rule for any of them, and the output declares no `--color-blue-500` | plan, ruling R3-14 |
| C-CSS-13 | pass | Every golden compiles as in C-CSS-11 with no warning or error; `IMPORTED`'s theme writes its overlaid roles | plan |
| C-CSS-14 | failure | `themeCss(null)` throws `TypeError` naming `themeCss`; a spec whose role value is `"#FFF"` throws the bridge's `RangeError` naming `themeVars` and the role | added, R-05 |
| C-CSS-15 | pass | `themeModel(SPEC)` lists 46 roles and 88 steps with both modes' hexes, the three families with `id`, `family`, `stack`, `package` and `nextImport` (`host-grotesk` with `@fontsource-variable/host-grotesk` and `Host_Grotesk`), 10 type steps whose `weight` follows 6.1's roles, the weights of `typeWeights`, the radii with `radius` equal to `lg`, five shadows, seven durations, four easings, the spring and the icon stroke, each equal to the bridge's value | added, section 6.1 |
| C-CSS-16 | failure | `themeModel(null)` throws `TypeError` naming `themeModel`; `themeCss(SPEC, "http://dyelot.vercel.app")` and `themeCss(SPEC, "https://dyelot.vercel.app/")` throw `RangeError` naming `editLink`; `editLink(SPEC, 42)` throws `TypeError` | added, R-05, R3-12 |
| C-REG-01 | pass | `registry/<slug>.json` of SPEC has the keys `$schema`, `name`, `type`, `title`, `description`, `cssVars`, in that order, with `$schema` `"https://ui.shadcn.com/schema/registry-item.json"`, `name` the slug, `type` `"registry:theme"`, `title` the name, and `description` the one-liner (else `describeDesign(spec)`) followed by " Made with dyelot." | plan, ruling R3-16 |
| C-REG-02 | pass | `cssVars.light` has 135 keys (`radius`, the 46 roles, the 88 steps) and `cssVars.dark` 134, each value the theme model's hex; keys carry no `--` | plan, ruling R3-16 |
| C-REG-03 | pass | `cssVars.theme` holds `radius-sm` to `radius-2xl` in px and no value that is a color (no hex, no color function) | plan, ruling R3-16 |
| C-REG-04 | pass | Font items follow the distinct families in display, body, mono order: SPEC (`host-grotesk`, `host-grotesk`, `fragment-mono`) gives `registry/font-host-grotesk.json` and `registry/font-fragment-mono.json`; a spec with the `schibsted-serif` pairing gives three items | plan, ruling R3-12, R3-16 |
| C-REG-05 | pass | A font item is `{ $schema, name: "font-<id>", type: "registry:font", title: <Family>, font }`, and `font` is `{ family, provider: "google", import, variable, weight?, subsets: ["latin"] }`; `import` is the family with spaces as underscores (`Source_Serif_4`); `variable` is `--font-sans` for the body family, `--font-heading` for a distinct display family and `--font-mono` for the mono family | plan, ruling R3-16 |
| C-REG-06 | pass | A static family lists its catalog weights as strings (`fragment-mono` `["400"]`, `courier-prime` `["400", "700"]`); a variable family's `font` has no `weight` key | plan, ruling R3-16 |
| C-REG-07 | pass | A family outside the catalog gets no item, and the theme item's `cssVars.theme` then holds its `font-*` stack | plan, ruling R3-16 |
| C-REG-08 | pass | `NEXT_FONT_MISSING` equals `["redaction"]`; a spec with the `redaction-redhat` pairing gets items for `red-hat-text` and `red-hat-mono` only, and its theme item's `cssVars.theme.font-heading` is Redaction's stack | plan, ruling R3-16 |
| C-REG-09 | pass | Every catalog family not in `NEXT_FONT_MISSING` is a key of `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json` under its family name, and each family in `NEXT_FONT_MISSING` is absent | plan, ruling R3-16 |
| C-REG-10 | pass | Every `import` of every golden's font items, read with `_` as a space, is a key of that `font-data.json`, and a static family's listed weights are among that entry's `weights` | plan, ruling R3-16 |
| C-REG-11 | pass | Every registry item of every golden validates with `registryValidator()`: one Ajv 8.20.0 instance with `ajv-formats`, which first adds `{ ...draft7, $id: "https://json-schema.org/draft-07/schema#" }` from `ajv/dist/refs/json-schema-draft-07.json`, then the vendored item schema under the key `shadcn-registry-item`. Mutated copies fail: `type: "registry:fonts"`, `font.weight: [400]`, a font item without `font`, a theme item with `font`. `tests/fixtures/schemas/sources.json` names the URL, fetch date and SHA-256 of `registry-item.json`, and the file's SHA-256 matches | plan, ruling R3-28 |
| C-REG-12 | failure | `registryItems(null, "x")` throws `TypeError` naming `registryItems`; a slug that is empty, over 48 characters or not of the form `^[a-z0-9]+(-[a-z0-9]+)*$` throws `RangeError` naming it | added, R-05 |

### 10.5 DTCG, Figma and TOON (Task 3.7)

Tests: `tests/unit/export/dtcg.test.ts`, `tests/unit/export/figma.test.ts`, `tests/unit/export/toon.test.ts`, with
`formatValidator()` and `resolverValidator()` in `tests/unit/export/schema-support.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-DTCG-01 | pass | `dtcgFiles(SPEC, name, ORIGIN)` returns `tokens/base.tokens.json`, `tokens/light.tokens.json`, `tokens/dark.tokens.json` and `tokens/design.resolver.json`, in that order; each text is `JSON.stringify(value, null, 2)` plus one newline | plan, ruling R3-11, R3-12 |
| C-DTCG-02 | pass | `base.tokens.json` holds the groups `font` (3), `font-weight` (3), `type` (10), `space` (12), `radius` (6), `shadow` (5), `duration` (7), `easing` (4) and `spring` (3 groups of 2), 56 tokens in all, in that order, with the root `$description` "<name>. Made with dyelot: <link>" | plan, ruling R3-17 |
| C-DTCG-03 | pass | In all four token files of every golden, every token carries its own `$type`, no group carries one, and every name matches `^[^${}.][^{}.]*$` | plan, ruling R3-17 |
| C-DTCG-04 | pass | `light.tokens.json` and `dark.tokens.json` each hold `color.role` (46) and `color.scale.<palette>.<step>` (88): 134 `color` tokens `{ colorSpace: "oklch", components: [l, c, h], hex }`. A step's components are its stored OKLCH through `round6` and `roundHue`; a role's come from `rgbToOklch(hexToRgb(hex), "srgb")` with the same rounding; a null hue is written `"none"` (SPEC's white `background`) | plan, ruling R3-15, R3-17 |
| C-DTCG-05 | pass | Each color token's `hex` is the stored hex of that step or role in that mode; the light and dark files have equal token names and types and differ only in values | plan, ruling R3-17 |
| C-DTCG-06 | pass | Each `type.<step>` is a `typography` token: `fontFamily` the family's array, `fontSize` `{ value: sizePx, unit: "px" }`, `fontWeight` the step role's weight from `typeWeights`, `letterSpacing` `{ value: round6(trackingEm × sizePx), unit: "px" }`, `lineHeight` `round6(lineHeightPx / sizePx)`; a fluid display step writes its `sizePx` and names its `clamp` in `$description` | plan, ruling R3-17 |
| C-DTCG-07 | pass | `space` holds `0` to `32` in px equal to `spec.space.scale`; `radius` holds sm to 2xl and `full` (9999) in px; `duration` equals the bridge's durations in ms (the `calm` golden: 63, 125, 188, 250, 375, 500, 500); `easing` holds the four Béziers; `spring.<name>.visual-duration` and `.bounce` are the stored numbers | plan, ruling R3-17 |
| C-DTCG-08 | pass | A soft or layered golden's `shadow.<n>` is an array of two layers `{ color, offsetX: { value: 0, unit: "px" }, offsetY, blur, spread: { value: 0, unit: "px" } }` whose OKLCH, alpha, `offsetY` and `blur` equal the bridge's layer (layered at 1.5 times, alpha capped at 1); a flat golden's is one layer of zeros with `alpha: 0` | plan, ruling R3-17 |
| C-DTCG-09 | failure | Mutated copies of the `default` golden's files fail the vendored schemas: a radius `{ value: 4, unit: "em" }`; a typography value without `fontWeight`; a role `$value` of `"#ff0000"`; a duration `{ value: 200, unit: "m" }`; a resolver whose `mode` modifier has only the `light` context | plan, ruling R3-17, R3-28 |
| C-DTCG-10 | pass | For every golden, `base`, `light` and `dark` validate with `formatValidator()` and the resolver with `resolverValidator()`, two separate Ajv instances with `ajv-formats` and no `loadSchema`; `sources.json` names the URL, date and SHA-256 of `format.json` and `resolver.json`, and both files' SHA-256 match | plan, ruling R3-28 |
| C-DTCG-11 | pass | `design.resolver.json` deep-equals section 6.4's object with the golden's name and link; every `$ref` to a file names a token file of the bundle | plan, ruling R3-17 |
| C-DTCG-12 | pass | Integer-like keys come first in ascending order (`space` `0` to `32`, steps `50` to `950`, `shadow` `1` to `5`); the other keys keep the order of section 6.4; two calls give equal text | plan, ruling R3-11, I-M3-01 |
| C-DTCG-13 | failure | `dtcgFiles(null, "x", ORIGIN)` throws `TypeError`; a non-string name throws `TypeError`; a name that `isPlainText` rejects throws `RangeError`; each message names `dtcgFiles` | added, R-05 |
| C-DTCG-14 | pass | Property, 1,000 runs, `seed: 3007`, over random presets, seeds, contrast levels, gamuts and scale modes: every DTCG file validates; every `hex` matches `^#[0-9a-f]{6}$`; every OKLCH has `l` in [0, 1], `c >= 0` and `h` in [0, 360) or `"none"`; no value is `NaN` or infinite | plan, ruling R3-17 |
| C-FIG-01 | pass | `figmaFiles(SPEC, name)` returns `tokens/figma/light.tokens.json` and `tokens/figma/dark.tokens.json`, each with 188 tokens: 134 colors, 3 font families, 10 sizes, 10 line heights, 12 space, 6 radii, 7 durations and 6 spring numbers; the two files have equal names and types | plan, ruling R3-18 |
| C-FIG-02 | pass | Every token's `$type` is one of `color`, `dimension`, `duration`, `number` and `fontFamily`; there is no `typography`, `shadow`, `fontWeight` or `cubicBezier`; every dimension is in `px`; every duration is in `s` with the value `round6(ms / 1000)`; every font family is a single string, the family name | plan, ruling R3-18 |
| C-FIG-03 | pass | Each color is `{ colorSpace: "srgb", components: [r, g, b], hex }` with `round6` components of the hex's channels over 255 and `hex` the stored hex; only color values differ between the two files | plan, ruling R3-18 |
| C-FIG-04 | pass | Both files of every golden validate with `formatValidator()` | plan, ruling R3-18, R3-28 |
| C-FIG-05 | failure | Mutated copies of the `default` golden's Figma files fail `formatValidator()`: a dimension in `em`, a duration in `m`, a color `$value` of `"#ff0000"` | plan, ruling R3-18 |
| C-FIG-06 | failure | `figmaFiles(null, "x")` throws `TypeError` naming `figmaFiles`; a name that `isPlainText` rejects throws `RangeError` naming it | added, R-05 |
| C-TOON-01 | pass | `toonFile(SPEC)` has the path `design.toon` and the text `encode({ scales, roles })` of `@toon-format/toon` 4.4.0 with default options, byte for byte, with no trailing newline | plan, ruling R3-19 |
| C-TOON-02 | pass | The text's first line is `scales[16]{palette,mode,s50,s100,s200,s300,s400,s500,s600,s700,s800,s900,s950}:`, and its 16 rows run palette by palette in `PALETTE_NAMES` order, light then dark, holding the stored hexes | plan, ruling R3-19 |
| C-TOON-03 | pass | The roles table's header is `roles[46]{role,light,dark}:`, and its rows follow `ROLE_NAMES` order with each mode's hex | plan, ruling R3-19 |
| C-TOON-04 | pass | `decode(text)` of `@toon-format/toon` 4.4.0, strict, deep-equals `{ scales, roles }` for every golden | plan, ruling R3-19 |
| C-TOON-05 | pass | Every hex in the text is quoted (`"#…"`); no row key is integer-like; two calls give equal text | plan, ruling R3-11, R3-19 |
| C-TOON-06 | failure | `toonFile(null)` throws `TypeError` naming `toonFile`; a spec whose role value is `"#FFF"` throws `RangeError` naming `toonFile` and the role | added, R-05 |

### 10.6 Motion and the receipt (Task 3.8)

Tests: `tests/unit/export/motion.test.ts`, `tests/unit/export/receipt.test.ts`, in the `core` project. C-RCPT-08's bundle
half and C-RCPT-10 live in `tests/unit/export/bundle.test.ts` (Task 3.11).

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-MOT-01 | pass | `motionFiles(SPEC, "untitled", lotTag(specId(SPEC)), ORIGIN)` returns exactly three files, `motion/motion.css`, `motion/motion.ts` and `motion/gsap.ts` in that order; each text is LF only, ends in exactly one newline and has no line ending in a space or a tab (R3-09) | plan, ruling R3-09 |
| C-MOT-02 | pass | `motion.css` starts with the three header comments of 6.2, then `:root` holds, in this order, the 7 `--duration-<name>` equal to `themeVars(SPEC, "light")`'s, the 4 `--ease-<name>` equal to the bridge's, `--spring-snappy`, `--spring-smooth` and `--spring-bouncy` each `linear(` plus `springCurve(spring).samples` joined by `, ` plus `)` (26, 44 and 65 values, the first `0`, the last `1`), and `--spring-snappy-settle: 411ms`, `--spring-smooth-settle: 706ms`, `--spring-bouncy-settle: 1056ms`. The `@media (prefers-reduced-motion: reduce)` block sets each spring to `linear(0, 1)` and each settle time to `var(--duration-fast)` | plan, ruling R3-20 |
| C-MOT-03 | pass | `motion.ts` holds no `import` and no `require`. Transpiled with TypeScript's `transpileModule` (module `ESNext`) and evaluated, it exports `durations` equal to `{ instant: 50, fast: 100, quick: 150, base: 200, slow: 300, slower: 400, slowest: 500 }` for SPEC (`brisk`), `easings` equal to SPEC's four tuples, `springs.snappy` deep-equal to `{ type: "spring", visualDuration: 0.25, bounce: 0.1 }` (and `smooth`, `bouncy` from SPEC), and `springSettleMs` equal to `{ snappy: 411, smooth: 706, bouncy: 1056 }` | plan |
| C-MOT-04 | pass | `gsap.ts` holds no `import` and no `require`, and names `CustomEase.create` only in a comment. Transpiled and evaluated, it exports `durations` in seconds (`0.05`, `0.1`, `0.15`, `0.2`, `0.3`, `0.4`, `0.5` for SPEC) and `eases` with `standard` `"0.2,0,0,1"`, `decelerate` `"0,0,0,1"`, `accelerate` `"0.3,0,1,1"` and `emphasized` `"0.05,0.7,0.1,1"`. For the `editorial` golden (`calm`) all three files carry the scaled durations 63, 125, 188, 250, 375, 500 and 500 ms (`0.063` to `0.5` s in `gsap.ts`) | plan, ruling R3-13 |
| C-MOT-05 | failure | `motionFiles` with a spec that is not an object throws `TypeError` naming `motionFiles`; with a `lot` that does not match `^[0-9a-f]{4}·[0-9a-f]{4}$` it throws `RangeError` naming `motionFiles`; with a non-string name it throws `TypeError` | added |
| C-RCPT-01 | pass | `receiptJson(SPEC, STUB_FILES, ORIGIN)` is `JSON.stringify(receipt, null, 2)` plus `"\n"`; its top-level keys are exactly `format`, `generator`, `design`, `summary`, `contrast`, `separation`, `gamut`, `roles`, `radius`, `findings`, `files`, in that order; `format` equals `RECEIPT_FORMAT`, `"dyelot.check/1"`. Two calls return equal text, and the text is equal under `TZ=UTC` and `TZ=Asia/Kolkata`; it holds no ISO date or time | plan, ruling R3-23, I-M3-01 |
| C-RCPT-02 | pass | `generator` is `{ name: "dyelot", site: ORIGIN, engineVersion: "dyelot.engine/1" }`. `design` has the keys of 7.1 in order: `name` `"untitled"`, `specId` `specId(SPEC)`, `lot` `lotTag(specId(SPEC))`, `link` `ORIGIN + "/studio#s=" + encodeSpec(SPEC)`, `createdWith` `"controls"`, `preset` `presetOf(SPEC)`, `gamut` and `contrastLevel` from `SPEC.color.params`, and no `oneLiner` key. For SPEC generated with `oneLiner: "Tide tables for small harbors"`, `design.oneLiner` equals it and follows `name` | plan, ruling R3-01 |
| C-RCPT-03 | pass | `summary` deep-equals `summarize(measureSpec(SPEC), lintSpec(SPEC), SPEC.color.params.gamut)` with the keys of `Summary` in order. `contrast` holds 80 entries in `measureSpec`'s order, each with the keys of 7.1 in order: `check`, `rule`, `kind`, `threshold` and `required` from its `CONTRAST_CHECKS` entry, `fg` and `bg` the hexes of its roles in its mode, `ratio` equal to `Number(trunc4(full))`, `lc` equal to `round1` of `perceptualLc`. `findings` equals `lintSpec(SPEC)` in the linter's order with the keys `id`, `severity`, `mode`, `subject`, `measured`, `threshold`, `source`; a WCAG rule's `measured` goes through `trunc4` (an overlaid C1 finding at 4.49996 writes `4.4999`) and every other number through `fmt4` | plan, ruling R3-08, R3-23 |
| C-RCPT-04 | pass | Property, 500 runs, `seed: 3008`, over random light and dark overlays of the 46 roles on SPEC: in every receipt, each `contrast` entry has `pass === (full ratio >= threshold)` and `ratio <= full ratio`; an entry whose written `ratio` is `4.5` never has a full ratio below 4.5; an entry with a full ratio in `[4.4999, 4.5)` writes `4.4999` and `pass: false` | ruling R3-23, R3-10 |
| C-RCPT-05 | pass | `separation` holds 16 entries in `measureSpec`'s order, each `{ set, mode, view, minDeltaE, threshold: 0.08, pass }` with `minDeltaE` through `trunc4` and `pass` from the full float. `gamut` is `{ gamut: "srgb", values: 176, outside: [] }` for SPEC; with SPEC's light `primary` step 500 overlaid to `{ l: 0.7, c: 0.37, h: 145 }`, `outside` lists exactly `{ palette: "primary", step: 500, mode: "light", excess }` with `excess` through `fmt4` and above `STORED_GAMUT_TOLERANCE` | plan, ruling R3-08 |
| C-RCPT-06 | pass | `roles.light` and `roles.dark` each hold the 46 roles in `ROLE_NAMES` order with SPEC's hexes; `radius` equals the value `themeCss(SPEC, ORIGIN)` writes for `--radius` | plan, ruling R3-14 |
| C-RCPT-07 | pass | With SPEC's light `secondary-foreground` overlaid to `#858585`, the receipt has `summary.contrast.requiredPass` 77, `summary.lint.error` 1 and `summary.pass` false; the light entry `C1:secondary-foreground/secondary` has `pass: false`; `findings` holds that C1 error | plan |
| C-RCPT-08 | pass | Stub half: `files` lists the 20 `STUB_FILES` in their order, each `{ path, bytes, sha256 }` with `bytes` the UTF-8 length and `sha256` equal to `sha256(text)`, and never lists `receipt.json`. Bundle half (Task 3.11): `BUNDLE`'s receipt lists every other file of `BUNDLE` in bundle order, and each `bytes` and `sha256` matches that file's text (I-M3-03) | plan, I-M3-03 |
| C-RCPT-09 | failure | `receiptJson` with a spec that is not an object throws `TypeError`; with `others` that is not an array throws `TypeError`; with an origin of `"http://dyelot.vercel.app"` or `"https://dyelot.vercel.app/"` throws `RangeError`; with `others` holding `receipt.json` or the same path twice throws `RangeError`. Every message names `receiptJson` | added |
| C-RCPT-10 | pass | Task 3.11. For each of the 15 `GOLDENS`, `bundle.receipt` deep-equals `JSON.parse` of the last file, whose path is `receipt.json`, and `bundle.summary` deep-equals `bundle.receipt.summary` | plan |

### 10.7 The checker (Task 3.10)

Tests: `tests/unit/export/checker.test.ts` (in process through `main(argv, io)`), `tests/unit/export/checker-entry.test.ts`
(C-CHK-24 and C-CHK-26, which spawn `node`), with the fixtures in `tests/unit/export/checker-support.ts`. C-CHK-25 lives in
`tests/unit/export/bundle.test.ts` (Task 3.11). Each case builds a fresh `APP` or `SHADCN_APP` folder. "Exit `n`" means the
value `main` returns; "last line" means the last line of everything `io.out` received.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-CHK-01 | pass | `APP()`, `main(["--root", dir], io)`: exit 0; the first line is `dyelot-check · <lotTag(specId(SPEC))> · untitled`; the counts line is `92 roles · 78 pairs · <k> files scanned`; the last line is `PASS`; `io.err` received nothing | plan, ruling R3-25 |
| C-CHK-02 | pass | With no `--root`, the root is `io.cwd`: `main([], io)` in an `APP` folder gives exit 0 and `PASS`. `--receipt <path>` reads the receipt from that path: with `receipt.json` moved to `other/r.json` and `--receipt other/r.json`, exit 0 | ruling R3-25 |
| C-CHK-03 | pass | Theme order: with `app/globals.css` removed and `src/app/globals.css` importing `./theme.css` beside it, exit 0 and `checked.theme` is `src/app/theme.css`; with both `app/globals.css` and `src/app/globals.css` present, `app/globals.css` decides; with neither, `styles/globals.css` decides | ruling R3-25 |
| C-CHK-04 | pass | Each of `@import "./theme.css";`, `@import './theme.css';` and `@import "../styles/theme.css";` (theme moved to `styles/theme.css`) resolves to the named file relative to the global stylesheet, and the run passes | ruling R3-25 |
| C-CHK-05 | pass | The registry route: an `APP` whose `app/globals.css` imports no `theme.css` and defines the 46 roles of `receipt.roles` in `:root` and `.dark` and `--radius` in `:root`, with `app/theme.css` deleted: the global stylesheet is the theme, `checked.theme` is `app/globals.css`, exit 0. Role values are compared case aside: the same file with every hex in upper case also passes | ruling R3-25 |
| C-CHK-06 | failure | No global stylesheet (none of the three paths exists): exit 2; the last line starts `ERROR: ` and the message names the three paths; no finding is printed | ruling R3-25 |
| C-CHK-07 | failure | `SHADCN_APP()` as written: `globals.css` imports no `theme.css` and defines 31 of the 46 roles, so there is no theme: exit 2 and a last line starting `ERROR: ` | plan, ruling R3-25 |
| C-CHK-08 | failure | `theme-changed`: an `APP` whose `app/theme.css` gains one character inside its third header comment: exit 1; exactly one finding, `theme-changed`, with no place; no role finding | ruling R3-25 |
| C-CHK-09 | failure | A tampered theme: `app/theme.css`'s light `--primary` set to `#ff0000`: the findings include `theme-changed` and `role-mismatch` naming `primary`, `light`, the receipt's hex and `#ff0000`, plus `contrast-fails` for every required pair with `primary` that falls below its threshold on `#ff0000`; exit 1; the last line is `FAIL (<n> findings)` with `n` the number of findings | plan, ruling R3-25 |
| C-CHK-10 | failure | `role-missing`: through the registry route of C-CHK-05, `--ring` deleted from `.dark`: one `role-missing` naming `ring` and `dark`; exit 1 | ruling R3-25 |
| C-CHK-11 | failure | `radius-mismatch`: through the registry route, `--radius` changed to `0px`: one `radius-mismatch` naming the receipt's value and `0px`; exit 1 | ruling R3-25 |
| C-CHK-12 | failure | `theme-name-changed`: an `APP` whose `app/theme.css` maps `--color-primary: var(--accent)` in `@theme inline`: the findings include `theme-name-changed` naming `--color-primary`; and a later `@theme inline` block of `app/globals.css` that maps `--color-ring: var(--primary)` gives a `shadowed` finding naming `--color-ring` (check 3), not `theme-name-changed` | ruling R3-25 |
| C-CHK-13 | failure | `contrast-fails`: through the registry route, light `--muted-foreground` set to `#9a9a9a` while the receipt holds SPEC's: the findings include `role-mismatch` and `contrast-fails` for `C1:muted-foreground/muted` and `C1:muted-foreground/background` in light mode, each message holding the measured ratio through `trunc4` and the threshold `4.5` | plan, ruling R3-25 |
| C-CHK-14 | failure | `shadowed`: an `APP` whose `app/globals.css` adds `:root { --primary: #000000; }` after its import: one `shadowed` finding naming `primary`, `app/theme.css` with its line and `app/globals.css` with its line; the same when the later definition sits in `app/extra.css`, imported after `theme.css` | plan, ruling R3-25 |
| C-CHK-15 | failure | Install route 1: `SHADCN_APP` with `@import "./theme.css";` added right after `@import "tailwindcss";`: exit 1, with one `shadowed` finding for each role that shadcn's `:root` or `.dark` defines with a value other than the theme's, and one for `--radius`; shadcn's `@theme inline` names map `--color-<role>: var(--<role>)` as the theme does, so they give no finding; no finding names `components/ui/button.tsx`, and the role lines of `globals.css` give no `raw-color`. With shadcn's `@custom-variant dark`, `:root`, `.dark` and `@theme inline` blocks then deleted, exit 0 and `PASS` | plan, decision 6.9.1, ruling R3-25 |
| C-CHK-16 | failure | `raw-color` hex: `src/a.tsx` holding `color: "#ff0000"`, `"#f00"`, `"#f00a"` and `"#ff0000aa"` on four lines: four `raw-color` findings with path `src/a.tsx`, 1-based line and column, and the matched text. `"#abcde"`, `href="#top"` and `"#fffg"` give no finding | ruling R3-25 |
| C-CHK-17 | failure | `raw-color` functions: `rgb(255 0 0)`, `rgba(0,0,0,.5)`, `hsl(0 100% 50%)`, `hwb(0 0% 0%)`, `lab(50 20 30)`, `lch(50 30 20)`, `oklab(0.5 0.1 0)`, `oklch(0.7 0.1 20)` and `color(display-p3 1 0 0)` in a `.css` file each give one `raw-color`; `rgb(var(--x))` and `oklch(var(--l) 0.1 20)` give none | ruling R3-25 |
| C-CHK-18 | failure | `palette-class`: `className="bg-blue-500 text-slate-50 hover:border-rose-950 bg-blue-500/50"` gives four `palette-class` findings; `bg-primary`, `text-primary-600`, `border-border`, `bg-white`, `text-black`, `bg-white/80` and `blue-500` with no utility prefix give none | plan, ruling R3-25, R3-14 |
| C-CHK-19 | failure | `arbitrary-color`: `bg-[#ff0000]`, `text-[rgb(0,0,0)]` and `border-[oklch(0.5_0.1_20)]` each give one finding, `arbitrary-color`, and no `raw-color` for the same text; `bg-[var(--primary)]` and `w-[12px]` give none | ruling R3-25 |
| C-CHK-20 | pass | The scan reads only `.ts .tsx .js .jsx .mjs .cjs .css .scss .html .vue .svelte .astro .mdx`: the same `#ff0000` in `a.json`, `a.md`, `a.svg` and `a.txt` gives no finding, and in each listed extension gives one | ruling R3-25 |
| C-CHK-21 | pass | The pairs: for every one of the 78 required pairs of an `APP`, the checker's `wcag(fg, bg)` equals the engine's `wcagRatio(hexToRgb(fg), hexToRgb(bg))` exactly; property, 1,000 runs, `seed: 3010`, over random hex pairs: `wcag` equals `wcagRatio` on the full float | plan |
| C-CHK-22 | pass | The marker: `const brand = "#ff0000"; // dyelot-check-ignore: brand color from the logo guidelines` gives no `raw-color`, and `ignored` lists `{ path, line, reason: "brand color from the logo guidelines" }`. The forms `/* dyelot-check-ignore: logo red */`, `<!-- dyelot-check-ignore: logo red -->` and `{/* dyelot-check-ignore: logo red */}` each exempt their line with the reason `logo red`. The next line's `#00ff00` is still a finding: a marker exempts its own line only | decision D3, ruling R3-24 |
| C-CHK-23 | failure | `marker-without-reason`: `// dyelot-check-ignore:`, `// dyelot-check-ignore: ok` and `// dyelot-check-ignore:  a b ` on lines holding `#ff0000` each give a `raw-color` and a `marker-without-reason` for that line, and add nothing to `ignored` | decision D3, ruling R3-24 |
| C-CHK-24 | pass | Spawned: `node scripts/dyelot-check.mjs --json` in an `APP` folder with the checker copied in exits 0 and writes one JSON object to stdout. The source's imports are exactly a subset of `node:fs`, `node:path`, `node:url`, `node:crypto` and `node:process`, with no other `import`, `require` or `import()`; it names none of `toSorted`, `toReversed`, `toSpliced`, `Object.groupBy`, `Promise.withResolvers`, `Array.fromAsync`, `import.meta.dirname`, `import.meta.filename`, `globSync`, `styleText` and `loadEnvFile`, which Node 18 lacks | plan, ruling R3-39 |
| C-CHK-25 | pass | Task 3.11. `BUNDLE`'s `scripts/dyelot-check.mjs` equals `CHECKER_SOURCE` and the file `src/export/checker/dyelot-check.mjs` byte for byte. `BUNDLE`'s zip, unzipped into a fresh folder with `app/globals.css` holding `@import "./theme.css";`, passes a spawned `node scripts/dyelot-check.mjs`: exit 0, last line `PASS` | plan |
| C-CHK-26 | pass | Spawned: importing the checker (`node --input-type=module -e "await import('<path>')"`) prints nothing and exits 0, because the entry guard holds; running it through a symbolic link to the file runs it as the entry | plan, ruling R3-39 |
| C-CHK-27 | failure | Exit 2 with a last line starting `ERROR: `: an unknown flag `--fix`; `--root` naming no folder; no `receipt.json` at the root; a receipt that is not JSON; a receipt whose `format` is `"dyelot.check/2"`; `--receipt` with no value; `--root` with no value; a receipt of the right format without `roles`. Each message equals R3-25's text | ruling R3-25 |
| C-CHK-28 | pass | `--json`: stdout holds exactly one JSON object, written with two-space indent and a newline, with the keys `format` (`"dyelot.check-report/1"`), `result`, `design` (`specId`, `lot`), `findings`, `ignored` and `checked` (`theme`, `roles` 92, `pairs` 78, `files`). For C-CHK-09's folder, `result` is `"FAIL"`, exit 1 and `findings` holds the same codes as the human report; for C-CHK-06's, `result` is `"ERROR"` and exit 2; for `APP()`, `result` is `"PASS"` and exit 0 | ruling R3-25 |
| C-CHK-29 | pass | The scan skips folders named `node_modules` at any depth, `.git`, `.next`, `dist`, `build`, `out` and `coverage`, any file over 1 MiB, and the bundle's own files: with `#ff0000` added to a `.ts` file in each skipped folder, to a 1.1 MiB `.ts` file, and to `motion/motion.css` and `scripts/dyelot-check.mjs` (paths the receipt lists, whose hashes the checker does not compare), exit 0; `checked.files` counts only the files scanned. A line declaring `--primary`, `--radius` or `--color-primary` with a hex, in any scanned `.css` file, gives no `raw-color` | ruling R3-25 |
| C-CHK-30 | pass | Report lines: a scan finding prints `<path>:<line>:<column>  <code>  <message>` with the path relative to the root and written with `/`; a finding with no place prints `<code>  <message>`; each exempt line prints `ignored  <path>:<line>  <reason>`; the counts line precedes the last line | ruling R3-25, section 7.2 |
| C-CHK-34 | pass | A Route-2-shaped app (`app/globals.css` holding the receipt's roles, `--radius` and the 88 scale steps in `:root` and `.dark`, no `theme.css`) exits 0 and prints PASS; a `--brand: #ff0000` line beside them still gives one `raw-color`, and so does `--neutral-75: #ff0000` | ruling R3-25, task 3.17a |
| C-CHK-RF5 | pass | A generated folder of 5,000 small `.tsx` files plus `packages/a/node_modules/x/index.js` holding `#ff0000`: in process, `main` returns 0 in under 10 s, and `io.readFile` is never called with a path holding `/node_modules/` | RF5 |

### 10.8 DESIGN.md, the AGENTS block, the prompt and the skill (Task 3.9)

Tests: `tests/unit/export/design-md.test.ts`, `tests/unit/export/design-md-lint.test.ts`, `tests/unit/export/agents.test.ts`,
`tests/unit/export/prompt.test.ts`, `tests/unit/export/skill.test.ts`, in the `core` project. The lint cases import `lint`
from `@google/design.md/linter`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-DMD-01 | pass | `designMd(SPEC, ORIGIN)` starts `---\n`; the front matter's top-level keys are `version`, `name`, `description`, `colors`, `typography`, `rounded`, `spacing`, `components`, in that order; `version` is `alpha`; `description` is `describeDesign(SPEC)` for a spec with no one-liner and the one-liner otherwise; the text is LF only and ends in one newline | plan, section 6.9 |
| C-DMD-02 | pass | `colors` holds exactly the 46 light roles in `ROLE_NAMES` order, each value SPEC's light hex written as a quoted lowercase `#rrggbb` | plan, ruling R3-21 |
| C-DMD-03 | pass | `typography` holds the 10 steps, caption to display, each with `fontFamily` (the family name), `fontSize` `"<sizePx>px"`, `fontWeight` the bare integer of the step's role in `typeWeights(SPEC)`, `lineHeight` `"<lineHeightPx>px"` and `letterSpacing` `"<trackingEm>em"`, numbers through `fmt4` | plan, ruling R3-21, R3-05 |
| C-DMD-04 | pass | `rounded` holds `sm`, `md`, `lg`, `xl`, `2xl` as `"<px>px"` and `full` as `"9999px"`; `spacing` holds the 12 keys `"0"` to `"32"` with `"<4 × unit>px"` | plan, ruling R3-21 |
| C-DMD-05 | pass | `components` holds the 29 components of 6.9 in table order, each with the properties and references of its row; the set of `{colors.<role>}` references across them is exactly the 46 roles | plan, ruling R3-21 |
| C-DMD-06 | pass | `designMdTokens(spec)` deep-equals `parse` of the front matter by `yaml` 2.9.1 with `{ schema: "core", uniqueKeys: true }`, for every golden | plan, ruling R3-32 |
| C-DMD-07 | pass | Outside code fences the headings are exactly, in order: `# <name>`, `## Overview`, `## Colors`, `## Typography`, `## Layout`, `## Elevation & Depth`, `## Shapes`, `## Components`, `## Do's and Don'ts`, `## Dark mode`, `## Motion`, `## Accessibility`, `## Install`, `## Self-check before you finish`; the apostrophe is U+0027 | plan, ruling R3-21 |
| C-DMD-08 | pass | Overview holds `describeDesign(spec)` and the line `Made with dyelot. Edit this design: <link>` with the link as a raw autolink equal to the bundle's `link`. For the `glass` golden it also holds `Style: Glass. <summary>` and `Traits the tokens cannot hold yet: Backdrop blur of 12 to 24 px, A 10 to 25% white fill, A reduced-transparency fallback.`; for the `default` golden, which has no unexpressed traits, no "Traits" line | plan, decision D2, D4 |
| C-DMD-09 | pass | Colors holds the table `\| Role \| Light \| Dark \| Use for \|` with 46 rows in `ROLE_NAMES` order, each with the role's two hexes and `USE_FOR[role]`; every `USE_FOR` entry is plain text of at most 90 characters | plan, ruling R3-22 |
| C-DMD-10 | pass | Typography names the three families with their `fontPackage` and holds the step table with 10 rows; Layout names the 4 px base, the 8 px rhythm and the 12 units; Elevation & Depth names the depth style and the five shadows; Shapes holds the five radii and the sentence on the nesting rule | plan, section 6.9 |
| C-DMD-11 | pass | Do's and Don'ts lists the spec's `rules.do` and `rules.dont`, then the matched preset's guards with R3-22's five rewordings applied (the `neo-brutalism` golden holds "Hard offset shadows belong to this style; do not mix them with soft shadows." and not "Hard shadows exist only here"), then the four fixed lines of 6.9 word for word, the last reading "Don't set body text under 16 px." for SPEC and "Don't set body text under 14 px." for the dense `dark-dev-tool` golden | plan, ruling R3-22 |
| C-DMD-12 | pass | Install and Self-check equal 6.9.1 with its placeholders filled: for SPEC the install line names `@fontsource-variable/host-grotesk` and `@fontsource/fragment-mono`, Route 2 names `registry/untitled.json` and one `font-<id>` file per item, and the ` ```css ` fence at the end of Install holds `themeCss(SPEC, ORIGIN)` verbatim. For a spec whose three families are `redaction`, Route 2's command stops after the theme file (the words "`, then npx shadcn@latest add ./registry/font-<id>.json` for each font file" are left out); for a family outside the catalog, its package is left out of the install line | plan, section 6.9.1 |
| C-DMD-13 | pass | User text: for a name `My *bold* [link](x) <b>#1`, the first heading is `# ` plus `mdText(name)`, the front matter's `name` is `yamlString(name)`, and outside the front matter and fences no unescaped `*`, `[`, `]` or `<` from the name appears | ruling R3-10, I-M3-08 |
| C-DMD-14 | pass | For each of the 14 preset goldens, `lint(designMd(spec, ORIGIN))` has `summary.errors` 0 and `summary.warnings` 0, and no finding of severity `error` or `warning` without a `rule` | plan, ruling R3-21 |
| C-DMD-15 | pass | For `IMPORTED`, `lint` has `summary.errors` 0, and every warning has the rule `contrast-ratio` | plan, ruling R3-21 |
| C-DMD-16 | pass | Copy check over the 14 preset goldens: no exported string of DESIGN.md, the prompt or the skill holds a British spelling of a fixed list (`colour`, `grey`, `behaviour`, `centre`, `licence`, `organise`, `favour`) or a word the writing convention bans, and none holds one of R3-22's five original guards | plan, ruling R3-22 |
| C-DMD-17 | failure | `designMd` with a spec that is not an object throws `TypeError` naming `designMd`; with an origin of `"http://dyelot.vercel.app"` or `"https://dyelot.vercel.app/x"` it throws `RangeError` naming `designMd` | added |
| C-DMD-18 | pass | For every golden, the front matter holds no anchor, alias or `<<` key and no repeated key; every color is a quoted lowercase `#rrggbb`; every size, line height, letter spacing, radius and spacing value is a quoted dimension ending `px` or `em`; every `fontWeight` is a bare integer; two calls return equal text | ruling R3-21, I-M3-01 |
| C-DMD-19 | failure | `designMdTokens(null)` and `designMd(null, ORIGIN)` throw `TypeError` naming their function | added, R-05 |
| C-AGT-01 | pass | `agentsSnippet(SPEC)` is exactly the 11 lines of 6.10 with `<lot>`, `<name>` and `<body>` (16) filled, and ends in one newline | plan, section 6.10 |
| C-AGT-02 | pass | The snippet starts `<!-- dyelot:start <lot> -->`, ends `<!-- dyelot:end -->`, holds no `nextjs-agent-rules` marker, and names `DESIGN.md`, `app/theme.css` and `node scripts/dyelot-check.mjs` | plan |
| C-AGT-03 | failure | `agentsSnippet` with a spec that is not an object throws `TypeError` naming `agentsSnippet`. A name holding `-->` is written through `mdText`, so the snippet still has exactly two HTML comments | added, I-M3-08 |
| C-PRM-01 | pass | `promptMd(SPEC, ORIGIN)` holds, in order: a title line naming the design, the instruction paragraph, the brief (one-liner when present, `describeDesign`, the thesis when present, the role table, the type step table), the eight rules of the AGENTS snippet as a list, a ` ```css ` fence holding `themeCss(SPEC, ORIGIN)` verbatim, and `Made with dyelot. Edit this design: <link>` | plan, section 6.11 |
| C-PRM-02 | pass | Property, 200 runs, `seed: 3009`, over plain-text names, one-liners and theses that include `*`, `_`, `[`, backticks, `#` and runs of three backticks: the prompt holds each as `mdText(text)`, holds exactly one opening and one closing code fence, and the css fence's content equals `themeCss(spec, ORIGIN)` | plan, ruling R3-10 |
| C-PRM-03 | failure | `promptMd(null, ORIGIN)` throws `TypeError` naming `promptMd`; an origin of `"http://dyelot.vercel.app"` throws `RangeError` naming `editLink` | added, R-05 |
| C-SKL-01 | pass | `skillFile(SPEC, "untitled", ORIGIN)` has the path `skills/untitled-design/SKILL.md`; its front matter's `name` is `untitled-design`, matching `^[a-z0-9-]{1,64}$`, and its `description` is the sentence of 6.12 with the name filled, at most 1,024 characters, written through `yamlString` | plan, section 6.12 |
| C-SKL-02 | pass | The body names `DESIGN.md`, holds the two workflows "Restyle a component" and "Audit the app", names `node scripts/dyelot-check.mjs` and `PASS`, and ends with the edit link | plan |
| C-SKL-03 | failure | `skillFile` with a slug that is empty, over 48 characters, or not of the form `^[a-z0-9]+(-[a-z0-9]+)*$` throws `RangeError` naming `skillFile`; a non-string slug throws `TypeError`. With `LONG_NAME` the description stays at most 1,024 characters | added |

### 10.9 The bundle, the zip and the guards (Task 3.11)

Tests: `tests/unit/export/bundle.test.ts`, `tests/unit/export/zip.test.ts`, `tests/unit/export/golden.test.ts`,
`tests/unit/export/entry.test.ts`, `tests/unit/engine/repo-guards.test.ts` (the guards). C-GUARD3-05 belongs to Task 3.12.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-BND-01 | pass | `BUNDLE.files` lists the paths of R3-12 in order: `DESIGN.md`, `AGENTS.md.snippet`, `prompt.md`, `app/theme.css`, `registry/untitled.json`, then `registry/font-host-grotesk.json` and `registry/font-fragment-mono.json` (SPEC's display and body share one family), the four `tokens/` files, the two `tokens/figma/` files, `design.toon`, the three `motion/` files, `skills/untitled-design/SKILL.md`, `scripts/dyelot-check.mjs` and `receipt.json`: 20 files | plan, ruling R3-12, R3-16 |
| C-BND-02 | pass | Every file of every golden obeys R3-09: its path matches `^[a-z0-9._/-]+$` and never starts with `/` or `.` or holds `..`; its text has no `\r`, no byte-order mark and no line ending in a space or a tab; it ends in exactly one newline, except `design.toon`, which ends with none | plan, ruling R3-09 |
| C-BND-03 | pass | `BUNDLE.slug` is `"untitled"`, `specId` is `specId(normalizeSpec(SPEC))`, `lot` is `lotTag(specId)`, `link` is `ORIGIN + "/studio#s=" + encodeSpec(SPEC)`, `receipt` deep-equals `JSON.parse` of the last file and `summary` deep-equals `receipt.summary` | plan, section 5.3 |
| C-BND-04 | pass | Font items: a golden with three distinct families in next/font has 21 files with three `registry/font-*` items in display, body, mono order; a spec whose display family is `redaction` has no `registry/font-redaction.json`; a family outside the catalog gets no item; a family shared by display and body gets one item whose `variable` is `--font-sans` | plan, ruling R3-16 |
| C-BND-05 | pass | `buildBundle` normalizes: a spec equal to SPEC but built with its keys in another order gives files equal to `BUNDLE`'s, byte for byte | plan, ruling R3-12 |
| C-BND-06 | pass | For each of the 15 `GOLDENS`, every file's byte length and SHA-256 and the zip's SHA-256 equal `tests/golden/export/manifest.json`; the `default` golden's files equal `tests/golden/export/default/**` byte for byte. With `DYELOT_UPDATE_GOLDENS=1` and `CI` both set, the test fails | plan, ruling R3-27 |
| C-BND-07 | failure | `buildBundle` with an origin of `"http://dyelot.vercel.app"`, `"https://dyelot.vercel.app/"`, `"https://dyelot.vercel.app/studio"`, `"https://dyelot.vercel.app?x=1"`, `"https://dyelot.vercel.app#x"` or `""` throws `RangeError` naming `buildBundle`; an origin of `42` throws `TypeError`; a spec that fails the schema throws the `RangeError` of `normalizeSpec`; an input that is not an object throws `TypeError` | plan, ruling R3-12 |
| C-BND-08 | pass | I-M3-01 in Node: two builds of `BUNDLE` give equal files and equal zips, and so do builds under `TZ=UTC` and `TZ=Pacific/Kiritimati`. `zipName(BUNDLE)` is `untitled-` plus the first 8 digits of the spec id plus `.zip`; with `LONG_NAME` the slug has 48 characters and the zip name is that slug, a `-`, 8 digits and `.zip` | plan, RF3, I-M3-01 |
| C-ZIP-01 | pass | `unzipSync(zipBundle(BUNDLE))` returns exactly the bundle's files, the entries in bundle order, each entry's bytes the UTF-8 encoding of the file's text | plan, ruling R3-26 |
| C-ZIP-02 | pass | Read from the zip's bytes: every local and central header has DOS time `0x0000` and date `0x0021`, compression method 8, no extra field and no comment; there is no folder entry; the end-of-central-directory comment length is 0 | plan, ruling R3-26 |
| C-ZIP-03 | pass | For each zone of `Intl.supportedValuesOf("timeZone")`, with `process.env.TZ` set to it, `sha256(zipBundle(BUNDLE))` equals the value under `UTC` | plan, ruling R3-26, I-M3-01 |
| C-ZIP-04 | pass | Two calls of `zipBundle(BUNDLE)` return equal bytes, and the `default` golden's zip SHA-256 equals the manifest's | plan |
| C-ZIP-05 | pass | `zipName` follows the slug: a name `Café Crème` gives `cafe-creme-<8 digits>.zip`; a name of only punctuation gives `design-<8 digits>.zip` | ruling R3-10, R3-12 |
| C-ZIP-06 | failure | `zipBundle` with a value that is not a bundle throws `TypeError` naming `zipBundle`; with files holding the same path twice, or a path of `../x`, `/x` or `A.txt`, it throws `RangeError` naming `zipBundle` | added |
| C-ZIP-07 | failure | `zipName(null)` and `zipName({})` throw `TypeError` naming `zipName` | added, R-05 |
| C-GUARD3-01 | pass | No file under `src/features`, `src/app`, `src/components` or `src/lib` holds a static `import` or `export … from` of `@/export`, `@/import`, a path under them, or a relative path into `src/export` or `src/import`; `import type` and `import("@/export")` are allowed. A probe file with a static import makes the guard report it | plan, ruling R3-38 |
| C-GUARD3-02 | pass | I-M3-02: no file under `src/export` or `src/import` names `Date`, `Math.random`, `getRandomValues`, `performance`, `Intl`, `toLocale`, `localeCompare`, `document`, `window`, `localStorage`, `sessionStorage`, `fetch` or `XMLHttpRequest`, and only `src/export/checker/dyelot-check.mjs` imports a `node:` module. A probe proves each pattern is seen | plan, I-M3-02, ruling R3-39 |
| C-GUARD3-03 | pass | `src/export/index.ts` and `src/import/index.ts` hold only `export … from` lines, and every `import()` in app code names exactly `@/export` or `@/import`, never a path under them | plan, ruling R3-38 |
| C-GUARD3-04 | pass | `biome.json`'s `noRestrictedImports` rejects `@/export/**`, `@/import/**` and relative paths into `src/export` and `src/import` from `src/features`, `src/app`, `src/components` and `src/lib`; Biome run on a probe file in `src/features` that imports `@/export/zip` reports the rule | plan, ruling R3-38 |
| C-GUARD3-05 | pass | Task 3.12. Files under `src/import` import from `src/export` only `sha256.ts` and `design-md-tokens.ts`; a probe importing `../export/zip` makes the guard report it | plan, ruling R3-38 |

### 10.10 Import (Tasks 3.5 and 3.12)

Tests: `tests/unit/import/common.test.ts`, `tests/unit/import/css.test.ts`, `tests/unit/import/fuzz-css.test.ts` (Task 3.5);
`tests/unit/import/design-md.test.ts`, `tests/unit/import/fuzz-md.test.ts`, `tests/unit/import/entry.test.ts` (Task 3.12), in
the `core` project. The `importDesignMd` halves of C-IMP-01, 02, 04 and 05, C-IMP-03's DESIGN.md half and C-IMP-12's DESIGN.md rows belong to Task 3.12, when `importDesignMd` exists.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-IMP-01 | failure | `importShadcnCss`, `importDesignMd` and `detectImport` with a first argument that is not a string throw `TypeError` naming the function; `detectImport` with a `fileName` that is neither a string nor absent throws `TypeError` | plan, I-M3-05 |
| C-IMP-02 | failure | A text whose UTF-8 length is 262,145 bytes (262,145 `a`, or 131,072 `é` and one `a`) gives `{ ok: false, error: { code: "too-large" } }` with the message of section 8; a text of exactly 262,144 bytes is not `too-large`; the length is the raw text's, counted before the byte-order mark is dropped | plan, section 8 |
| C-IMP-03 | pass | Property, I-M3-05. CSS half: 300 runs, `seed: 3005`, over CSS-like strings (selectors, blocks, declarations, comments, quoted strings, unbalanced braces) and arbitrary strings up to 256 KiB, through `importShadcnCss`. DESIGN.md half: 300 runs, `seed: 3012`, over front-matter-like and arbitrary strings, through `importDesignMd`. Neither throws; each result is `{ ok: false }` with a code of section 8, or `{ ok: true }` with a spec that equals `normalizeSpec(spec)` and lints without throwing | plan, I-M3-05 |
| C-IMP-04 | failure | `""`, `"   \n\t"` and a lone byte-order mark give the code `empty` with the message of section 8 | plan, section 8 |
| C-IMP-05 | failure | A text holding U+0000 gives `binary`; a text of 1,000 characters with 10 U+FFFD gives `binary`; with 9 U+FFFD it is not `binary` | plan, section 8 |
| C-IMP-06 | pass | Normalization: one CSS text written with LF, CRLF and CR line ends, and with and without a leading byte-order mark, gives equal specs and equal reports | plan, section 5.4 |
| C-IMP-07 | pass | The same text gives the same spec id twice; `meta.seed` is `"import-"` plus the first 16 digits of `sha256` of the normalized text | plan, ruling R3-29 |
| C-IMP-08 | pass | `buildImport` infers per R3-29: light `muted` with chroma 0.004 gives tint `none`; a hue within 30° of the primary's gives `brand`; hue 60 gives `warm`; hue 250 gives `cool`. A `--radius` of 10 px gives `soft`; 14 px (equal distance to `soft`'s 12 and `round`'s 16) gives `round`; no radius gives `soft`. Body 14 px gives `dense`; 16 px `product`; 18 px with display 64 px `marketing`; 18 px with display 48 px `editorial`; no body size `product` | plan, ruling R3-29 |
| C-IMP-09 | pass | The overlay: an imported `oklch(0.7 0.4 145)` primary becomes its gamut-mapped hex with an `adjusted` entry of reason `gamut`; an imported light border `rgb(0 0 0 / 50%)` over a white background becomes `#808080` (±1 per channel) with reason `alpha`; a primary imported without `primary-foreground` gets `onFill(primary)` with reason `foreground`; with no dark block, `report.generated.dark` is 46 and `darkGenerated` is true | plan, ruling R3-29 |
| C-IMP-10 | pass | A result has `meta.createdWith` `"import"`, contrast level `AA` and `presetOf(spec)` `null`; `report.generated.light` is 46 minus the light roles mapped; `mapped`, `adjusted` and `ignored` follow input order; with 60 ignored names, `ignored` holds the first 50 and `ignoredMore` is 10 | plan, ruling R3-07, R3-29 |
| C-IMP-11 | pass | `importShadcnCss` of `shadcn-neutral.css` returns `ok: true` even though the result has `summary.lint.error` above 0; the measured count is recorded in section 15 | plan, ruling R3-29 |
| C-IMP-12 | pass | `detectImport`: `"x.md"` with CSS text gives `design-md`; `"theme.css"` with markdown gives `shadcn-css`; `"x.markdown"` gives `design-md`. Without a file name: a first non-empty line `---` or a line starting `## Colors` gives `design-md`; `:root {`, `.dark{` or a declaration of `--primary:` gives `shadcn-css`; `"hello"` gives `null` | plan, section 8 |
| C-IMP-13 | failure | `buildImport(null)` throws `TypeError` naming `buildImport`; a draft whose `primary` has `l` 1.5 or a `roles.light` that is not an object throws `RangeError` or `TypeError` naming it. `buildImport` is internal, so a bad draft is a bug in an importer, never a visitor's input | added, R-05 |
| C-CSSI-01 | pass | `shadcn-neutral.css`: `ok: true`; each of shadcn's 31 role variables in `:root` and in `.dark` is mapped, its hex the sRGB conversion of the fixture's value (±1 per channel); `destructive-foreground` gets `onFill` with reason `foreground` in both modes; the radius `0.625rem` (10 px) gives `soft`; the name is `Imported theme` | plan, ruling R3-31 |
| C-CSSI-02 | pass | `shadcn-v3-hsl.css`: its blocks inside `@layer base` count; each bare triple such as `0 0% 100%` is read as `hsl(0 0% 100%)`; `destructive-foreground` is mapped; the sidebar roles, which the file lacks, keep the generated values; `--radius: 0.5rem` (8 px, equal distance to `sharp`'s 4 and `soft`'s 12) gives `soft` | plan, ruling R3-31 |
| C-CSSI-03 | pass | Selectors: declarations under `:root, .light`, `html`, `[data-theme="light"]` and `:root:not(.dark)` are light; under `.dark`, `:root.dark`, `html.dark`, `[data-theme="dark"]` and `:root` inside `@media (prefers-color-scheme: dark)` dark; `--primary` under `.card` is ignored | plan, ruling R3-31 |
| C-CSSI-04 | pass | A later declaration wins within a mode; `!important` is dropped before parsing | ruling R3-31 |
| C-CSSI-05 | pass | `/* --primary: red */` is ignored; `content: "}"` and `content: '/*'` inside a block do not end it or open a comment; a role declared only inside a comment is not mapped | plan, ruling R3-31 |
| C-CSSI-06 | pass | `--primary: var(--brand); --brand: #3a6ea5;` maps primary to `#3a6ea5`; a two-step chain `var(--a)` to `var(--b)` and a `var()` to a missing name are listed as unreadable and skipped | ruling R3-31 |
| C-CSSI-07 | pass | Fonts and names: `--font-sans: "Inter", sans-serif` gives the custom family `inter` for body and display, with `customFonts` true; `--font-serif: Gloock` gives the display family `gloock`; three ids that form a pairing set `pairing`. `--chart-6` and `--sidebar-width` are listed in `ignored` | ruling R3-29, R3-31 |
| C-CSSI-08 | failure | `.btn { color: red }` alone gives `no-roles`; role declarations only in `.dark` give `no-roles`; both with the message of section 8 | plan, section 8 |
| C-CSSI-09 | failure | `--primary: oklch(0.7 0.17 22` (unclosed, which the parser reads but reports) and `--background: garbage` are listed as unreadable and skipped; a text whose only `--primary` is unreadable gives `no-primary` | plan, ruling R3-31 |
| C-CSSI-10 | pass | Real alpha: `shadcn-neutral.css`'s dark `--border` and `--input` (white at 10% and 15%) are flattened over its dark background with reason `alpha` | plan, ruling R3-29 |
| C-DMI-01 | pass | `design-md-readme.md` imports with `ok: true`; each color token whose name is a role or in the alias table is mapped, and every other token name is in `ignored` | plan, ruling R3-30 |
| C-DMI-02 | pass | The alias table: `surface` and `background` map to `background`; `on-surface`, `on-background` and `text` to `foreground`; `on-primary` to `primary-foreground`; `error` to `destructive`; `on-error` to `destructive-foreground`; `outline` to `border`; every role name to itself; `neutral` and `brand-50` are ignored | plan, ruling R3-30 |
| C-DMI-03 | pass | Seeds: `secondary` with chroma 0.1 sets the secondary seed; `tertiary` sets the accent seed, and `accent` does when there is no `tertiary`; a `secondary` with chroma 0.03 sets no seed | ruling R3-29, R3-30 |
| C-DMI-04 | pass | Type: the body size comes from `typography.body`, else `body-md`, else the first key starting `body`; the display size from `display`, else `display-lg`, else the first key starting `display` or `headline`; the families from those tokens' `fontFamily`; the mono family from the first token whose name holds `mono` or `code` | plan, ruling R3-30 |
| C-DMI-05 | pass | Text: the name is the front matter's `name`, else the first `#` heading, else `Imported design`; `direction.thesis` is the first paragraph of `## Overview` through `toPlainText(…, 280)`, listed in `truncated` when cut; bullets under `## Do's and Don'ts` that start `Do ` or `Don't ` fill `rules.do` and `rules.dont` | plan, ruling R3-30 |
| C-DMI-06 | pass | A ` ```yaml ` block in a section adds its groups; a ` ```yaml ` block inside a ` ```markdown ` fence is ignored | plan, ruling R3-30 |
| C-DMI-07 | failure | A tab-indented line, an unclosed quote and a repeated key each give `yaml` with `line` the 1-based line in the whole file of the first error and the message of section 8 | plan, ruling R3-30 |
| C-DMI-08 | failure | An anchor (`&a`) or an alias (`*a`) on a map, a scalar or a key gives `yaml-alias` with its line; a `<<` key is read as a plain key and ignored | plan, ruling R3-30 |
| C-DMI-09 | failure | `colors` in the front matter and again in a ` ```yaml ` block gives `yaml-group-twice` with `colors` in the message; YAML of 65,537 bytes in all gives `yaml-too-large`; 65,536 bytes does not | plan, ruling R3-30 |
| C-DMI-10 | pass | Exact re-import: for each of the 14 preset goldens, `importDesignMd(designMd(spec, ORIGIN))` returns `ok: true` with a spec that deep-equals `normalizeSpec(spec)` and `report.exact` true | plan, ruling R3-32 |
| C-DMI-11 | pass | An edited file: with one color of a golden's front matter changed, the import takes the token path, `report.exact` is false, `notes` holds `The edit link was ignored because the tokens changed.`, and the changed role holds the new hex | plan, ruling R3-32 |
| C-DMI-12 | failure | A DESIGN.md with no front matter and no YAML block, and one whose colors map nothing to `primary`, each give `no-primary`; a front matter with only `colors.primary` gives `ok: true` with every other role generated | plan, section 8 |

### 10.11 Studio units (Tasks 3.13 to 3.16)

Tests: `tests/unit/features/studio/store-text.test.ts` (C-STOR3-06), `tests/unit/features/studio/store-import.test.ts`
(C-STOR3-01 to 05 and 07), `tests/unit/features/studio/rebuild.test.ts` (C-STOR3-08 to 10, C-REB),
`tests/unit/features/export/blocked-states.test.tsx` (C-BLK), `tests/unit/features/export/files.test.ts` (C-EXPUI-01 to 03,
05 and 06), `tests/unit/features/import/form.test.ts` (C-EXPUI-04), `tests/unit/features/studio/shortcuts.test.ts`
(C-KEYS3), all in the `web` project (jsdom). The store cases use M2's `StubClient`, fake clock and fake timers.
`ONE_FAIL` is `SPEC` with its light `secondary-foreground` set to `#858585` (C-RCPT-07's overlay): one C1 error, and
regenerating it from its parameters gives `SPEC` again.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-STOR3-01 | pass | `importDesign(importShadcnCss(readFixture("shadcn-neutral.css")))` holds `IMPORTED`: the new snapshot is `{ params: paramsOfSpec(IMPORTED).params, seed: IMPORTED.meta.seed, spec: IMPORTED, preset: presetOf(IMPORTED), provenance: "loaded" }`, the previous snapshot is the last entry of `history`, `future` is empty, and the client received no `request` (an import is a load, not a generation) | plan, ruling R3-33 |
| C-STOR3-02 | pass | After that import `status.notice` deep-equals `{ kind: "imported", format: "shadcn-css", exact: false, light, dark, adjusted }` with `light` and `dark` the counts of the report's mapped roles per mode and `adjusted` the length of its `adjusted` list, and `status.phase` is `"idle"` | plan, ruling R3-33 |
| C-STOR3-03 | pass | The notice belongs to the imported snapshot: `undo()` restores the previous snapshot and clears it (`status.notice` is `null`); `redo()` restores `IMPORTED` and the same notice, deep-equal; a later commit from `setParams` clears it | plan, ruling R3-33 |
| C-STOR3-04 | pass | 300 ms after the import, `history.replaceState` was called once with `#s=` plus `encodeSpec(IMPORTED)`, and the draft holds `IMPORTED`; before 300 ms neither was written | plan |
| C-STOR3-05 | failure | `importDesign` with `{ ok: false, error }`, with `null`, or with a result whose `spec` is not an object throws `TypeError` naming `importDesign`; a result whose `spec` fails `dyelot.spec/1` throws `RangeError` naming `importDesign`. Each leaves every field of the state unchanged | added |
| C-STOR3-06 | pass | The About path: five `setParams({ name })` calls ("S" to "Salts") with `{ coalesce: "about-name" }` 200 ms apart commit one `history` entry whose spec has `meta.name` "Salts"; `setParams({ name: undefined })` commits a spec with `meta.name` "untitled" and no `name` in `params`; `setParams({ oneLiner: "Reads the tide" }, { coalesce: "about-one-liner" })` gives `meta.oneLiner` "Reads the tide"; `setParams({ name: " a" })` ends in a `generation` notice naming `generateSystem: params.name` and keeps the held spec (the field cleans text first, the generator still checks it) | plan, ruling R3-33, R3-02 |
| C-STOR3-07 | pass | An import while a request is in flight wins: the store issues request 7, then imports `IMPORTED`, then the stub answers request 7; the held spec stays `IMPORTED` and the late reply changes nothing (I-M2-02) | added |
| C-STOR3-08 | pass | Provenance: a commit from `setParams`, `applyPreset`, `regenerate`, `toggleLock`, a fix and `rebuild` is `"generated"`; `loadFromHash`, a restored draft and `importDesign` are `"loaded"`; after a load and two changes, `undo()` twice returns provenance `"generated"` then `"loaded"` and `redo()` restores each in turn | plan, ruling R3-42 |
| C-STOR3-09 | pass | `rebuild()` on the loaded `ONE_FAIL` issues one request with `ONE_FAIL`'s params and seed; its reply commits `SPEC` (`specId` equal) with provenance `"generated"` as a new `history` entry; `undo()` returns to `ONE_FAIL` with provenance `"loaded"` | plan, ruling R3-33, R3-42 |
| C-STOR3-10 | pass | The outcome is computed once per held blocked design: holding `ONE_FAIL` calls `client.generateNow` exactly once with its params and seed, also after three `setView` calls and a `dismissNotice`; holding `SPEC` (no error) calls it never; loading a second blocked design calls it once more | plan, ruling R3-42 |
| C-STOR3-11 | pass | Importing a CSS whose `--font-sans` is `"Inter", sans-serif` holds a spec with the custom families and sets the notice `{ kind: "imported", … }`, never `custom-fonts`; its text (9.3) holds "Its fonts are not in dyelot's catalog, so the canvas shows a fallback." | ruling R3-33 |
| C-REB-01 | pass | `rebuildOutcome(snapshot of ONE_FAIL, generateSystem)` is `"passes"`, since `generateSystem(params, seed)` gives `SPEC` and `lintSpec(SPEC)` has no `error` | plan, ruling R3-42 |
| C-REB-02 | pass | With `generate` a stub returning `ONE_FAIL` the outcome is `"fails"`; with a stub that throws `RangeError("forced")` it is `"throws"`, and `rebuildOutcome` itself does not throw | plan, ruling R3-42 |
| C-REB-03 | failure | A snapshot that is not an object, or lacks `params` or `seed`, throws `TypeError` naming `rebuildOutcome`; a `generate` that is not a function throws `TypeError` naming `rebuildOutcome` | added |
| C-BLK-01 | pass | The dialog in the fixable state for `ONE_FAIL` shows "This design fails 1 required check. It came from a link or a file, and rebuilding it from its parameters makes every check pass.", the failing-check list with one row for the C1 finding, the file list with no sizes, no element labelled "Preview of …", a button "Fix in the inspector", and "Download" and every "Copy" with `aria-disabled="true"` and `aria-describedby` naming the sentence's element | plan, ruling R3-42, D1 |
| C-BLK-02 | pass | The stuck state (outcome `"fails"`, and again `"throws"`) shows "This design fails 1 required check, and rebuilding it from its parameters does not fix them. Change the parameters until every check passes." and "Show the findings", and no "Rebuild from the parameters" anywhere; the fault state (provenance `"generated"`) shows "This design fails 1 required check although the studio generated it. That is a fault in dyelot: change any parameter to generate it again." and "Show the findings". With 2 errors each sentence reads "2 required checks". Only jsdom reaches stuck: `generateNow` runs the real generator on the page thread | plan, ruling R3-42 |
| C-BLK-03 | failure | In each blocked state, clicking "Download" and each "Copy", and pressing Enter and Space on them, calls neither `URL.createObjectURL` nor `navigator.clipboard.writeText` and shows no file text (I-M3-04) | plan, D1 |
| C-EXPUI-01 | pass | `formatBytes`: 0 is "0 B", 1023 is "1023 B", 1024 is "1 KB", 1536 is "1.5 KB", 18234 is "17.8 KB", 2000000 is "1953.1 KB" | plan |
| C-EXPUI-02 | pass | `summaryLines(summarize(measureSpec(SPEC), lintSpec(SPEC), "srgb"))` is four strings: "78 of 78 required contrast checks pass", "<16 − below> of 16 color-vision checks keep status and chart colors apart", "176 of 176 colors inside sRGB", and the lint line built from `lintSpec(SPEC)`'s counts. The lint line reads "No lint errors, 0 warnings, 2 notes" for counts 0, 0, 2; "1 lint error, 1 warning, 1 note" for 1, 1, 1; "3 lint errors, 2 warnings, 0 notes" for 3, 2, 0. A `p3` summary reads "… colors inside Display P3" | plan |
| C-EXPUI-03 | failure | `formatBytes(-1)`, `formatBytes(1.5)` and `formatBytes(NaN)` throw `RangeError` naming `formatBytes`, and `formatBytes("1")` a `TypeError`; `summaryLines(null)` throws `TypeError` naming `summaryLines`, and a summary with a negative or fractional count, or `below` above `checks`, a `RangeError` | added |
| C-EXPUI-04 | pass | `chosenFormat(picked, detected)`: a picked format wins over any detection (`chosenFormat("design-md", "shadcn-css")` is `"design-md"`); with none picked, the detected one (`chosenFormat(null, "shadcn-css")` is `"shadcn-css"`); `null` when neither gives one. `fileAccepted`: "a.md", "a.MARKDOWN", "a.css" and "a.txt" of 262,144 bytes are `{ ok: true }`; "a.json" is `{ ok: false, message: "Choose a .md or a .css file." }`; "a.css" of 262,145 bytes is `{ ok: false }` with the `too-large` message of section 8; a negative or fractional size throws `RangeError`, a non-string name `TypeError`, each naming the function | plan, ruling R3-33, R3-38 |
| C-EXPUI-05 | pass | `exportState(summary, provenance, outcome)`: `"passing"` when `summary.lint.error` is 0, whatever else; `"fault"` with errors and `"generated"`; `"fixable"` with errors, `"loaded"` and `"passes"`; `"stuck"` with errors, `"loaded"` and `"fails"` or `"throws"`. A failing loaded summary with no outcome throws `TypeError` naming `exportState`, and an unknown provenance or outcome a `RangeError` | plan, ruling R3-42 |
| C-EXPUI-06 | pass | `blockReason(state, errors)` gives R3-42's sentence for `"fixable"`, `"stuck"` and `"fault"` with "1 required check" for 1 and "<n> required checks" otherwise; `"passing"` and an `errors` of 0 or below, or fractional, throw `RangeError` naming `blockReason` | plan, ruling R3-42 |
| C-EXPUI-07 | failure | `chosenFormat("pdf", null)` and `chosenFormat(null, "x")` throw `RangeError` naming `chosenFormat`; `chosenFormat(5, null)` throws `TypeError` | added, R-05 |
| C-KEYS3-01 | pass | With no dialog open, Ctrl+E and Meta+E outside a text field give `{ kind: "open-export" }`, matched on the key `e` or the code `KeyE` (a Cyrillic layout types `у`); a repeat gives `{ kind: "swallow" }`; with Alt or Shift held, or inside a text field, they give `null` | ruling R3-35 |
| C-KEYS3-02 | pass | With `dialogOpen: true`, Ctrl+S, Meta+S, Ctrl+E and Meta+E give `{ kind: "swallow" }` outside and inside a text field, on a first press and on a repeat | ruling R3-35 |
| C-KEYS3-03 | pass | With `dialogOpen: true`, Space, ← and → on the page, L on a seed control, Alt+T and Escape give `null`; with `dialogOpen` absent or `false`, every M2 C-KEYS case gives its M2 answer | ruling R3-35, I-M3-06 |
| C-KEYS3-04 | failure | A context whose `dialogOpen` is present but not a boolean (`"yes"`, `1`, `null`) throws `TypeError` naming `shortcutFor`; an absent `dialogOpen` reads as `false` | added |

### 10.12 Flows (Tasks 3.13 to 3.16)

Tests: `tests/e2e/about.spec.ts` (F-ABT), `tests/e2e/export.spec.ts` with `tests/e2e/export-support.ts` (F-EXP and the
export parts of F-A11Y3-01 to 04), `tests/e2e/receipt.spec.ts` (F-RCPT, F-A11Y3-06 and 07), `tests/e2e/import.spec.ts`
(F-IMP, the import parts of F-A11Y3-01 to 03, and F-A11Y3-05), and `tests/e2e/studio.spec.ts` (the changes of section 12).

Every flow runs against the production build at 1280 × 800 unless it names another viewport, and opens a link built in the
test: `LINK(spec)` is `/studio#s=` plus `encodeSpec(spec)`. `SPEC_LINK` is `LINK(SPEC)`, `GOLDEN_LINK` is `LINK` of the
`default` golden, `ONE_FAIL_LINK` is `LINK(ONE_FAIL)` (fixable, one error) and `IMPORTED_LINK` is `LINK(IMPORTED)` (fixable,
with IMPORTED's error count, recorded in section 15). The tests import `@/spec`, `@/engine`, `@/export` and `@/import` in
Node to compute what the page must show. A flow that reads the canvas first waits for `canvasAtRest`, as in M2. The echo
stub is F-STUDIO-19's technique: an init script wraps `window.Worker` so that, once the test sets `window.__dyelotEcho` to a spec, the next request is answered with `{ id, ok: true, spec }` of that spec and every other request goes to the real worker. Setting `window.__dyelotHold = true` holds the next reply, from the stub or the real worker, until the test calls `window.__dyelotRelease()`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| F-EXP-01 | pass | On `SPEC_LINK`, a button named "Export" with `aria-keyshortcuts="Control+E Meta+E"` follows "Copy link" in the toolbar. Clicking it opens a `role="dialog"` with `aria-modal="true"` whose accessible name is "Export"; focus is on its heading; every element outside the dialog is inert (a focus call on "Regenerate" leaves focus in the dialog) | plan, ruling R3-34 |
| F-EXP-02 | pass | With focus on "Regenerate", Ctrl+E opens the dialog; a held Ctrl+E (three repeats) leaves exactly one dialog and `document.hasFocus()` true; in the dialog Ctrl+S and Ctrl+E reach `keydown` listeners with `defaultPrevented` true, show no "copied" message and open nothing | plan, ruling R3-35 |
| F-EXP-03 | pass | The ready dialog shows "LOT <lotTag(specId(SPEC))> · <SPEC's name>", equal to the header's lot tag, and four list items equal to `summaryLines(buildBundle({ spec: SPEC, origin: ORIGIN }).summary)` | plan |
| F-EXP-04 | pass | On `GOLDEN_LINK`, "Download <zip name>" starts one download whose suggested file name is the golden's `zipName`; unzipped with `fflate`'s `unzipSync`, its entries are the manifest's paths in bundle order, each with the manifest's byte length and SHA-256, and the zip's SHA-256 is the manifest's. The same holds in a context with `timezoneId: "Pacific/Kiritimati"` and one with `"America/St_Johns"` (I-M3-01 in Chromium) | plan, ruling R3-26, R3-27 |
| F-EXP-05 | pass | The file list holds one row per file of `buildBundle({ spec: SPEC, origin: ORIGIN })`, in order, each with the path and `formatBytes` of its UTF-8 length. On open the first file is selected: its preview toggle has `aria-pressed="true"` and the focusable `pre` labelled "Preview of DESIGN.md" holds the file's text exactly. Pressing the toggle of `app/theme.css` selects it and the preview shows `theme.css` | plan |
| F-EXP-06 | pass | With clipboard permission granted, "Copy app/theme.css" writes the file's text exactly (`navigator.clipboard.readText()`); the button reads "Copied", and after 2 seconds of the page clock "Copy" again; the status region reads "Copied app/theme.css." | plan, ruling R3-40 |
| F-EXP-07 | failure | With `navigator.clipboard` deleted by an init script, and again with clipboard writing denied, "Copy app/theme.css" selects `app/theme.css` in the preview with its whole text selected (`getSelection().toString()` equals the text) and the status region reads "Copy is blocked here. The text is selected: press Ctrl+C or ⌘C." | ruling R3-40, I-M2-05 |
| F-EXP-08 | pass | Escape closes the dialog and focus returns to "Export"; "Close" does the same; a dialog opened by Ctrl+E from "Regenerate" returns focus to "Regenerate" | plan, ruling R3-34 |
| F-EXP-09 | failure | On `IMPORTED_LINK`, "Export" opens the blocked dialog: the lot line and the four summary lines; the fixable sentence with IMPORTED's error count; one failing-check row per finding of severity `error`, in `lintSpec` order; the file paths without sizes; no "Preview of …" element. "Download" and every "Copy" have `aria-disabled="true"`; clicking them and pressing Enter on them starts no download within 2 seconds, leaves a sentinel clipboard text unchanged, and puts no file text in the page | plan, ruling R3-42, D1 |
| F-EXP-10 | pass | After the download the status region reads "Downloaded <zip name>.". An init script that wraps `URL.createObjectURL`, `HTMLAnchorElement.prototype.click` and `URL.revokeObjectURL` records create, click and revoke in that order for one URL, with the revoke in a later task than the click | plan, ruling R3-34 |
| F-EXP-11 | pass | With `__dyelotHold` set, a change of contrast level then Ctrl+E opens the dialog in its waiting state ("Waiting for the design to finish generating…", no file list, no "Download"); `__dyelotRelease()` then shows the ready dialog for the new design, whose lot line names the new spec id | plan, ruling R3-34 |
| F-EXP-12 | failure | After the first load, every new request for a JavaScript chunk is aborted; "Export" shows "The export code did not load." and "Try again". With the abort removed, "Try again" shows the ready dialog. The studio behind it keeps working in both states | plan, ruling R3-34, I-M2-03 |
| F-EXP-13 | pass | At 360 × 740 the ready dialog fits the window: the page and the dialog scroll no wider than they are, every path and the lot line wrap inside the dialog, and each button has a hit area of at least 24 × 24 px and is reachable by Tab | plan |
| F-EXP-14 | pass | With `reducedMotion: "reduce"`, the dialog has no running animation or transition (`getAnimations({ subtree: true })` is empty) in the first frame after it opens, and it closes the same way | plan, ruling R3-34 |
| F-EXP-15 | pass | Lazy layers (I-M3-09): no JavaScript response of the first load of `/studio` contains `dyelot.check/1` or `yaml-group-twice`; opening "Export" fetches a response containing `dyelot.check/1`, and opening "Import…" one containing `yaml-group-twice` | plan |
| F-EXP-16 | pass | In the blocked dialog of `ONE_FAIL_LINK`, "Fix in the inspector" closes the dialog and moves focus to the Findings heading in the inspector column; at 360 × 740 it opens the inspector drawer with focus on that heading | plan, ruling R3-42 |
| F-EXP-17 | pass | On `ONE_FAIL_LINK`, "Rebuild from the parameters" in the Findings section commits a design whose spec id equals `specId(SPEC)`; "Export" then opens the ready dialog with "Download" enabled; Undo returns to `ONE_FAIL` and the blocked dialog | plan, ruling R3-42 |
| F-EXP-18 | pass | On `ONE_FAIL_LINK`, the blocked dialog reads "This design fails 1 required check. It came from a link or a file, and rebuilding it from its parameters makes every check pass."; M2's fix for its C1 finding, "Raise contrast to AA+", regenerates the design at `AA+` and the dialog opened after it is ready | plan, ruling R3-42 |
| F-EXP-19 | pass | "Export" follows "Copy link" in the DOM and in Tab order at 1280 × 800, and at 360 × 740 with the "View" group closed and open | plan, ruling R3-34 |
| F-EXP-20 | failure | Fault: on `ONE_FAIL_LINK` the test sets the echo stub to `ONE_FAIL` and presses "Rebuild from the parameters"; the committed design is `ONE_FAIL` with provenance `"generated"`, and both the dialog and the Receipt section read "This design fails 1 required check although the studio generated it. That is a fault in dyelot: change any parameter to generate it again."; the dialog offers "Show the findings" and no download | plan, ruling R3-42 |
| F-EXP-RF1 | pass | The design changes while the dialog is open: open `SPEC_LINK`, set `location.hash` to `GOLDEN_LINK`'s hash, open "Export", then `history.back()`; the dialog's lot line names `SPEC`'s lot, and the downloaded `receipt.json` has `design.specId` equal to `specId(SPEC)` | RF1, ruling R3-34 |
| F-EXP-RF2 | pass | On `GOLDEN_LINK`, two downloads in a row, and a download right after "Copy DESIGN.md", each unzip to the manifest's files, byte for byte; each `Blob` URL is revoked only after its own click | RF2 |
| F-EXP-RF3 | pass | At 360 × 740, with the name `LONG_NAME` typed into "Name", the dialog's lot line, its file rows and the About field wrap with no horizontal scroll, and the download's file name is `saltmarshsaltmarshsaltmarshsaltmarshsaltmarshsal-<the first 8 digits of the spec id>.zip` (the 48-character slug) | RF3, ruling R3-10, R3-12 |
| F-IMP-01 | pass | "Import…" opens a `role="dialog"` with `aria-modal="true"` named "Import", focus on its heading, the page inert; in Tab order it holds the radio group "Format" ("DESIGN.md", "shadcn theme CSS"), "Choose a file", "Paste the text", "Import" and "Cancel" | plan, ruling R3-33 |
| F-IMP-02 | pass | Pasting `shadcn-neutral.css` into "Paste the text" checks "shadcn theme CSS"; replacing it with `design-md-readme.md` checks "DESIGN.md"; once the visitor checks a format, a later paste never changes it | plan |
| F-IMP-03 | pass | Importing `shadcn-neutral.css` closes the dialog and shows the notice "Imported a shadcn theme: <a> of 46 light roles and <b> of 46 dark roles came from the file." with `a` and `b` the report's mapped counts per mode, then "1 color was adjusted to fit sRGB or drop alpha." when `n` is 1 or "<n> colors were adjusted to fit sRGB or drop alpha." when `n` is above 1, then "Undo returns to the design before."; the hash is `#s=` plus `encodeSpec(IMPORTED)`, the canvas's `--primary` is `IMPORTED`'s light `primary`, and focus is on the canvas region | plan, ruling R3-33 |
| F-IMP-04 | pass | After that import, Undo restores the previous design and removes the notice; Redo restores `IMPORTED` and the same notice | plan, ruling R3-33 |
| F-IMP-05 | pass | "Choose a file" with `design-md-readme.md` fills the textarea with its text and checks "DESIGN.md"; "Import" holds `importDesignMd(text).spec` (spec id equal) and the notice starts "Imported a DESIGN.md:" | plan |
| F-IMP-06 | pass | The `DESIGN.md` of the `default` golden's bundle, pasted and imported, holds the golden's spec (spec id equal) and the notice reads "Imported the DESIGN.md exactly, from its edit link." | plan, ruling R3-32 |
| F-IMP-07 | failure | "Import" with an empty textarea shows "The import is empty. Paste a DESIGN.md or a shadcn theme, or choose a file." in the error region, which the textarea's `aria-describedby` names; the dialog stays open, focus is on the textarea, and the held design is unchanged | plan, I-M2-03 |
| F-IMP-08 | failure | "Choose a file" with `a.json` shows "Choose a .md or a .css file." and with a `.css` file of 262,145 bytes the `too-large` message; in both the textarea keeps its text and the file is never read (no `FileReader` and no `Blob.text` call, recorded by an init script) | plan |
| F-IMP-09 | failure | A DESIGN.md whose front matter has a tab-indented line on line 4 shows "The YAML on line 4 could not be read. Check its indentation and quotes, then import again."; one with an anchor on line 6 shows "The YAML uses an anchor or an alias on line 6. Write the values out in full, then import again." | plan, ruling R3-30 |
| F-IMP-10 | failure | The text "hello" with no format checked and no file shows "Choose DESIGN.md or shadcn theme CSS."; checking "shadcn theme CSS" then "Import" shows the `no-roles` message | plan |
| F-IMP-11 | pass | Importing `shadcn-neutral.css` holds a loaded design that fails: the Receipt section shows the fixable sentence, the Findings section shows "Rebuild from the parameters", and "Export" opens the blocked dialog. "Cancel" and Escape in a reopened import dialog close it and return focus to "Import…" | plan, ruling R3-42 |
| F-IMP-12 | failure | After the first load, every new request for a JavaScript chunk is aborted; "Import…" opens the dialog with "The import code did not load." and "Try again"; with the abort removed, "Try again" shows the form. The studio behind it keeps working | ruling R3-34, I-M2-03 |
| F-IMP-RF4 | pass | A 256 KiB DESIGN.md (front matter under the 64 KiB YAML limit of R3-30, the rest prose) and a 256 KiB shadcn CSS (valid declarations padded with comments), each pasted and imported, show the `imported` notice within 2 seconds of the click on "Import", and a `PerformanceObserver` of type `longtask` records no task over 1 second | RF4 |
| F-ABT-01 | pass | The inputs panel opens with the section "About" before "Seeds": a text field named "Name" with the placeholder "untitled" and the hint "Up to 80 characters", a text field named "One line" with the hint "Up to 140 characters", and a button "Import…" | plan, ruling R3-33 |
| F-ABT-02 | pass | Typing "Saltmarsh" into "Name" at a steady pace commits one history entry: after the hash updates, its spec has `meta.name` "Saltmarsh", the export dialog's lot line ends "· Saltmarsh", and one Undo restores `meta.name` "untitled" | plan, ruling R3-33 |
| F-ABT-03 | pass | Plain text: typing "Tide  app" then a space keeps the field's value as typed with the caret at the end after every key, while the spec's name is "Tide app"; pasting "a" U+202E "b" gives the name "ab"; the hash never holds a control or bidirectional character | plan, ruling R3-02, R3-33 |
| F-ABT-04 | pass | Typing 81 characters into "Name" shows "Cut to 80 characters." and a name of the first 80; 141 into "One line" shows "Cut to 140 characters."; clearing "Name" gives the name "untitled" and shows the placeholder; opening a link of a design named "Kelp" fills "Name" with "Kelp" | plan, ruling R3-33 |
| F-RCPT-01 | pass | On `SPEC_LINK` the inspector shows a section "Receipt" right after "Findings" whose four list items equal `summaryLines` of `SPEC`'s summary | plan, ruling R3-36 |
| F-RCPT-02 | pass | Raising the contrast level to `AAA` updates the four lines to the new design's summary once the change commits, and never shows the old design's lines with the new lot | plan, ruling R3-36 |
| F-RCPT-03 | pass | On `IMPORTED_LINK` the Receipt section shows the four lines and the fixable sentence; after "Rebuild from the parameters" the sentence is gone and the lines are the rebuilt design's | plan, ruling R3-36, R3-42 |
| F-A11Y3-01 | pass | axe finds no violation in the ready export dialog and in the import dialog (empty and showing an error), at 1280 × 800 and 360 × 740, with the canvas in light and in dark mode | plan |
| F-A11Y3-02 | pass | In each dialog Tab and Shift+Tab cycle through its controls only, by the shared `tabStops` rule, and a click on the inert page behind leaves focus in the dialog | plan |
| F-A11Y3-03 | pass | Every control of both dialogs has an accessible name and a hit area of at least 24 × 24 px; each preview toggle's name names its file; the status region has `role="status"` | plan |
| F-A11Y3-04 | pass | The export dialog works by keyboard alone: Tab reaches each file's preview toggle and "Copy" in bundle order, then the preview, then "Download" and "Close"; Space and the arrows scroll the focused preview | plan |
| F-A11Y3-05 | pass | The import dialog's radio group is a `fieldset` with the legend "Format"; the file input is named "Choose a file"; an error is announced through the error region (`role="alert"`), which the textarea's `aria-describedby` names | plan |
| F-A11Y3-06 | pass | axe finds no violation in the blocked dialog of `IMPORTED_LINK` at 1280 × 800 and 360 × 740; the disabled "Download" and "Copy" buttons stay focusable, and each one's accessible description is the state's sentence | plan, ruling R3-42 |
| F-A11Y3-07 | pass | axe finds no violation in the inspector with the Receipt section and the "Rebuild from the parameters" note shown, at 1280 × 800 and in the 360 × 740 drawer; the receipt lines are a list, and Tab reaches "Rebuild from the parameters" after the findings | plan, ruling R3-36 |

## 11. Coverage

`pnpm vitest run --coverage` keeps M2's scope and floors and adds the new pure code:

| Scope | Lines, statements, functions | Branches |
|---|---|---|
| The whole coverage scope | 80, 80, 75 | 70 |
| `src/engine/**`, `src/spec/**`, `src/theme/**`, each pure studio and preview helper of M2 | 95 | 90 |
| `src/export/**` (the checker included) and `src/import/**` | 90 | 85 |
| The new pure studio helpers: `src/features/export/files.ts`, `src/features/studio/rebuild.ts`, `src/features/import/form.ts` | 95 | 90 |

Each case is written from its row, never from an uncovered-line report. The components and dialogs are covered by the flows
of section 10.12, not by the floors.

## 12. Changes to M1 and M2 cases

| Case | Was | Now | Why |
|---|---|---|---|
| C-ENTRY-01 (M2) | The engine entry's key set equals M2's set exactly | M2's set plus exactly `freshParams`, `resolveParams`, `paramsOfSpec`, `typeWeights`, `presetOf`, `springCurve`, `CONTRAST_CHECKS`, `measureSpec`, `summarize`, `onFill`, `round6` and `roundHue`, each the object its home module exports | R3-38 |
| C-ENTRY-03 (M2) | The spec entry's key set equals M2's set exactly | M2's set plus exactly `lotTag`, `isPlainText` and `toPlainText` | R3-38 |
| C-SCHEMA-14 (M1) | Bounds of `meta.name`, `meta.seed`, `rules` and the policies | The same, plus: `meta.oneLiner` empty or of 141 characters; a `direction` with no key; `direction.thesis` of 281; `adjectives` empty, of 6 entries, or with an entry of 25; `like` or `unlike` of 6 entries or with an entry of 81; a `rules` entry of 0 characters; and any text field or policy that fails `isPlainText` (a leading space, U+0007, U+202E, a decomposed "é") | R3-01, R3-02 |
| C-GEN-10 (M1) | Invalid parameters throw `RangeError` naming the field | The same, plus `oneLiner`, `direction` and `rules` outside R3-01's bounds, and a `name`, `oneLiner`, `direction` text or `rules` entry that is not plain text; a wrong type is a `TypeError` | R3-01, R3-02 |
| C-THEME-01 (M2) | 204 properties per mode, in the order of 5.6 | 207: `--weight-heading`, `--weight-label` and `--weight-body` follow `--font-mono` | R3-06 |
| C-THEME-22 (M2) | The 204 names are distinct | The 207 names are distinct | R3-06 |
| F-CANVAS-01 (M2) | The frame carries exactly the 204 properties plus the two density properties | 207 plus the two density properties | R3-06 |
| Canvas weights (M2 §7.4, no case) | Kit and template rules set literal weights (500 to 650) | A weight of 600 or more on the display face is `min(<n>, var(--weight-heading))`; a mono rule F-WGT-01 finds at fault drops to 500; F-WGT-01 checks it | R3-06 |
| F-INPUT-01 (M2) | The panel holds exactly the table's controls, in order, and no brief, image or import control | The About section first ("Name", "One line", "Import…"), then the table's controls in order; still no brief or image control | R3-33, 9.1 |
| F-INPUT-02 (M2) | Each control's accessible name equals its label | The same for "Name", "One line" and "Import…" | R3-33, 9.1 |
| C-KEYS-07 (M2) | Any other Ctrl or Meta chord gives `null` | Any other chord but Ctrl+E and Meta+E, which C-KEYS3-01 covers | R3-35 |
| F-CANVAS-19 (M2) | Tab order ends Undo, Redo, Copy link | Tab order ends Undo, Redo, Copy link, Export; the closed toolbar at 360 × 740 is still at most 170 px tall | R3-34 |
| F-INPUT-16 (M2) | `aria-keyshortcuts` on "Regenerate", the mode switch and "Copy link" | Also `Control+E Meta+E` on "Export" | R3-34, R3-35 |
| C-STORE-10 (M2) | `history` keeps 100 steps, compared through the `snap` helper | The same; `snap` also compares `provenance` | R3-42 |
| F-INSP-09 (M2) | A fix regenerates the design and clears its finding | The same; the regenerated design has provenance `"generated"`, and the Receipt section's lines follow it | R3-36, R3-42 |
| F-INSP-10 (M2) | At `AAA`, "Contrast is already AAA." and no fix button | The same; the tampered-link fixture is a loaded design whose rebuild passes, so the Findings section also shows "Rebuild from the parameters" | R3-42 |
| F-INSP-14 (M2) | Every inspector control is reachable by keyboard | The same, and Tab reaches "Rebuild from the parameters" and the Receipt section after the findings | R3-36, R3-42 |

| C-GEN-04, C-GEN-05, C-GEN-13, C-CANON-04, C-CANON-07, C-NORM-04, C-URL-01 (M1 and M2) | `anyDirection` and `edgeDirection` in `tests/unit/spec/support.ts` draw `name` with `fc.string({ minLength: 1, maxLength: 80 })` | They draw names that pass `isPlainText`: the same strings mapped through `toPlainText(…, 80)`, keeping the non-null ones; the cases' assertions are unchanged | R3-02 rejects a name with a leading or trailing space (Task 3.2) |
| C-REPO-M2-07 (M2) | `SCAN_TESTS` equals exactly the two fix-scan files of C-INSPECT-16 | The two fix-scan files plus `measure-grid-1` to `measure-grid-10`, each with its measured time | R3-41 (Task 3.0) |

Every other M1 and M2 case stands as written (I-M3-06).

## 13. Review Focus coverage

| Review Focus | Input | Cases |
|---|---|---|
| RF1 | The design changes while the export dialog is open | F-EXP-RF1 (Task 3.14) |
| RF2 | Two downloads in a row, and a download right after a Copy | F-EXP-RF2 (Task 3.14) |
| RF3 | An 80-character name with no spaces at 360 px | F-EXP-RF3 (Task 3.14), with F-EXP-13's frame |
| RF4 | The largest import: a 256 KiB DESIGN.md and a 256 KiB shadcn CSS | F-IMP-RF4 (Task 3.16) |
| RF5 | The checker in a monorepo: `node_modules` at any depth, 5,000 source files | C-CHK-RF5 (Task 3.10) |

## 14. Deferred, and the seams for later milestones

| Item | Comes from | Milestone |
|---|---|---|
| `flavor/`: the shader component, the vanilla module, the CSS fallback, the brand video and the Remotion source | umbrella §9 | M5 |
| Tokens for the unexpressed style traits (hard offset shadows, blur, grain and the rest); M3 writes them as prose | D2 | M5 |
| Animations and keyframes in `theme.css` (umbrella §9 lists "animations") | umbrella §9 | M5, with the motion lab |
| AI: the brief box, model-written rationale, critique and refine; `meta.createdWith` values `lexicon`, `model:*`, `on-device`, `visitor-key` | umbrella §10 | M4 |
| Lazy-loaded templates (M2 final review M-12) | M2 final review | M6 |
| Each family's italic files for the canvas and the exports | M2 section 9 | M6 polish |
| A fluid `display` step for the `poster` context | M2 section 9 | Not scheduled; revisit with M6 polish |
| Linting DESIGN.md in the browser | R3-21 | Not scheduled: the pinned linter needs Node |
| Importing DTCG or Figma token files | umbrella §9 names DESIGN.md and shadcn CSS only | Not scheduled |
| Type steps, shadows and easings in the shadcn registry route | R3-16 | Not scheduled; Route 1 carries them |

The seams M3 leaves: M4's AI layer fills `DirectionParams.direction`, `.oneLiner` and `.rules`, which M3's schema, export and
import already carry; M6's gallery opens a card as a link, which the store treats as a loaded design (R3-42).

## 15. Risks

- **DESIGN.md is alpha.** `main` of `google-labs-code/design.md` has moved past 0.4.0 (fenced YAML blocks, a duplicate-key
  error). The pin holds the goldens; an upgrade re-runs C-DMD-14 and 15 and re-reads the format.
- **shadcn's CLI moves.** Route 2 depends on `shadcn add` reading a local file and on how it writes `cssVars`. The hand smoke of
  Task 3.17 runs `shadcn@4.23.0` and records the result; the Install text says `@latest`. shadcn's v4 themes have no
  `destructive-foreground`; dyelot's bundle defines it.
- **Figma's import of OKLCH is undocumented.** The Figma files use sRGB only (R3-18), so nothing depends on it.
- **A browser parses dates.** R3-26 relies on a date-time string without an offset reading as local time, as ECMA-262 says.
  F-EXP-04 compares the zip Chromium builds with the manifest Node builds.
- **next/font's data changes.** C-REG-09 and 10 read the installed `font-data.json`, so an upgrade that adds or removes a family
  fails a test before it ships a broken font item.
- **An import can fail the linter.** Task 3.5 records here how many errors `IMPORTED` raises; the studio holds it as a loaded
  design with export off until it is fixed (R3-42).
- **Task 3.0 can stop M3.** If any generated design fails, M3 waits for the owner (R3-41).

## 16. Done when

- Every case in section 10 has a test that carries its id, and every `failure` case fails the way its row says.
- `pnpm gate:full` passes with the floors of section 11, the slow set and the `scan` project included; `pnpm gate` passes too,
  and both times are recorded.
- Every M1 and M2 case passes except the changes of section 12, and every M1 and M2 golden holds (I-M3-06).
- Every validator passes in CI: the DTCG and shadcn schemas, the pinned DESIGN.md linter, Tailwind's `compile`, the TOON round
  trip, and the checker on `APP` and `SHADCN_APP`.
- The hand smoke of Task 3.17 installs the `default` golden's bundle into a fresh Next.js 16.4 app by both routes, and the
  checker prints `PASS` in each; the README records the commands and results.
- `docs/specs/00-design.md` carries an in-place note, starting "Refined in M3", at each row of section 1's table.
- The README states M3 as done with measured claims only: the case counts, the coverage, the golden sizes, and Task 3.0's grid
  and time.
- The pull request merges once CI is green (the owner's ruling of 2026-11-04).
