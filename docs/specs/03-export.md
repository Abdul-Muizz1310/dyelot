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
