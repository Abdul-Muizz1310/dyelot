# 07 · The finishing pass: M6's residuals, one-run gates and the close records (M7)

> Source note: this milestone spec refines `docs/specs/00-design.md`, the umbrella (sections 13 and 14), and builds on
> `docs/specs/01-color-engine.md` to `docs/specs/06-gallery.md` (M1 to M6). Paths to `knowledge/` point into the private
> `repos` meta-repo. The residuals come from four records of M6: 06's close note (the paragraph "The residuals that ship"),
> the M6 ledger's deferred minors (`m6-rulings-and-minors.md`), the final review and its re-check, and the task reviews
> (`sdd-archive/task-*-review-r*.md`). Every code fact below was read on `main` at `54f0a60` on 2026-11-17; where a fact
> needs a run, a browser or the network, section 12 makes it a probe of Task 7.0.

Status: draft of 2026-11-17, for the owner's approval. No plan, lane or code starts before the owner approves it.

Close note: written at the close (R7-21 to R7-25): the dependency pull request, the on-device eval's result, the Langfuse
check, the gate times and load averages, and the review counts.

On 2026-11-17 the owner ruled "Complete the dyelot": an M7 cleanup milestone that fixes the residual minors M6 shipped
with, run as M6 ran (this spec, the owner's approval, a plan, then test-first lanes). Section 2 lists that ruling and the
controller's decisions. Section 3 turns them into rulings R7-01 to R7-27, and section 14 holds 21 cases (19 `C-` cases
and 2 `F-` cases). A ruling ends with **(decision X#)** when it states a decision of section 2, or **(drafter)** when this
spec supplies a rule the decisions leave open; a ruling that does both says which part is which. Section 6 gives every
residual one disposition: fix, already fixed, or not scheduled. Two residuals need the owner's choice, the timing flows
(section 7) and the mosaic headline (section 8); section 21 holds them with options and a recommendation.

## 1. Purpose and scope

M6 shipped with a list of small residuals and with gates that never passed in one run: a family of flows that hold a time
budget, or a harness timeout, failed under the suite's own parallel load and passed alone, so every gate of M6 needed a
rerun-alone step and a written ruling. M7 closes both. It fixes the residuals section 6 marks "fix", moves the timing
family into a third Playwright project that runs one test at a time after the parallel flows, records the dependency
pull request of 2026-11-17, runs the on-device eval that M4 left, checks that Langfuse still receives traces after its
list endpoint's sunset, and brings the READMEs, the umbrella and the knowledge graph up to date.

| Task | Delivers |
|---|---|
| 7.0 | The probes of section 12, before anything else |
| 7.1 | The `timed` project: the timing family runs one at a time after the parallel flows (owner approval item 1) |
| 7.2 | Gallery data and pages: `briefSpec`'s word rules, the readers' checks, one source for the shared names, `pnpm data:update`, the copy link's announcement, the gallery flows' oracles |
| 7.3 | Share cards: argument checks, and the mosaic headline in two lines (owner approval item 2) |
| 7.4 | The landing: `receiptLines`' checks, the color form's quiet output, F-LAND6-04 without a fixed wait |
| 7.5 | The audit script: one retry per run, a partial record, an origin-only `--base`, one `kind` |
| 7.6 | Test oracles and helpers across M6's composed flows and guards, then C-GUARD7-01 |
| 7.7 | Close M7: the gates, the on-device eval, the Langfuse check, the READMEs, the umbrella, the knowledge graph |

M7 adds no dependency, no route, no UI copy and no committed data. It does not remove "(experimental)" from the on-device
switch, take the dependency bumps itself, or schedule anything 06's section 18 or M5's tables mark "Not scheduled".

### Where this spec refines the umbrella

| Umbrella | This spec | Why |
|---|---|---|
| §13 UI and flows: the Playwright flows | The flows that hold a time budget or failed on a harness timeout under load run in a `timed` project, one at a time, after the parallel flows and the Lighthouse runs (R7-04) | A budget measured beside seven other browsers measures the machine, not the product |
| §14 Milestones: M0 to M6 | An M7 row: the finishing pass; done when both gates pass in one run and the close records are written (R7-25) | M6 was the umbrella's last row; M7 is the owner's ruling of 2026-11-17 |

### Where this spec departs from the controller's decisions

| Decision | This spec | Why |
|---|---|---|
| B1 names C-BLK-01 and F-TPL-17, 20, 27, 36, 38 and 39 in the timing family | They stay where they are, marked already fixed (section 6, rows 21 and 22); probe 2 watches them | C-BLK-01 is a unit case that `4e7cefa` fixed; the F-TPL flows sit in serial groups that share one page, so one test cannot leave its group without its setup, and none has failed since `c5391fa` |
| B1's family | Adds F-STEER-01, F-ABT-02 and F-LAZY5-02, which failed under load in five, five and two M6 logs | The evidence of M6's logs (section 7) |
| B1: a serial project "with its own dependency" after the parallel ones | `timed` depends on `lighthouse`, which depends on `chromium` | The Lighthouse runs and the timed flows then never share the CPU, and C-GUARD6-13's `lighthouse` project stays as it is |
| B2: the widow "changes the committed cards data" | No committed file changes: `cards.json` holds no headline; the words live in `gallery-card.tsx` | Read in the code (section 8) |
| C2: the eval result goes in 07's close note and the README | Also one sentence in 04-ai.md's close note pointing to it (R7-27) | R4-32 names 04's close note as the record's place |

## 2. Decisions M7 implements

**The owner's rulings.** Spec before code; merge when green (the merge deploys `main` to `https://dyelot.vercel.app`);
parallel lanes with the speed-ups of 2026-11-06 (light re-gates after a clean rebase, overlapping waves); no secret and no
Vercel variable. On 2026-11-17: "Complete the dyelot", by an M7 cleanup milestone (decision A1), and the five dependabot
bumps taken in a separate pull request (decision C1).

**The controller's decisions (2026-11-17).**

- **A1.** M7 fixes the residual minors M6 shipped with, run like M6.
- **A2.** Every residual gets one disposition: fix (with a ruling and cases), already fixed (with the commit or the code),
  or not scheduled (with the reason). Nothing 06's section 18 or M5's tables mark "Not scheduled" is scheduled again.
- **B1.** The timing flows: the smallest change that makes `pnpm gate` and `pnpm gate:full` pass in one run without
  weakening any budget. The budgets are product requirements of M3 to M5 and are never raised.
- **B2.** The mosaic headline: whether to fix the widow, and what that changes.
- **C1.** The dependency pull request (lane `deps`) is not an M7 task; M7 records it and rebases onto it.
- **C2.** The controller runs the on-device eval at the close in the installed Chrome 157 with a throwaway profile; the
  result goes in the close note and the README; "(experimental)" stays the owner's decision.
- **C3.** The close makes one live AI action on the deployed site and reads Langfuse for its trace.
- **C4.** The README's webgl-noise credit gets one wording; the meta-repo README's counts are fixed.
- **C5.** The umbrella gets an "M7 sync" line and an M7 row; the close updates `knowledge/products/product-dyelot.md`.
- **D1.** A guard that every M7 case id appears in a test title.
- **D2.** Every fix keeps M1 to M6's cases and goldens passing; section 16 lists each case a fix changes.
- **D3.** A task split, with tasks that touch the same files in one lane.
- **D4.** Facts are verified in the code; what could not be is a probe of Task 7.0.

**Constraints for every task.** Spec-TDD: each case's test first, red, then code, then green, each test titled with its
case id. R-05 in every function this spec names: a wrong type is a `TypeError`, an out-of-domain value a `RangeError`,
each message starting with the function's name, and every argument's type is checked before any value's domain. Pure
core and imperative shell as M6's section 2 states them; `scripts/audit-core.mjs` stays pure. Flows assert state, never
frame counts or timing, except the budgets M3 to M5 own. No test touches the network (R4-58). Copy rules as M6's. M7 adds
no property case. Commits: Conventional Commits, imperative, at most 72 characters, no trailer.

## 3. Rulings

### Scope (every task)

**R7-01 · What M7 delivers.** The eight tasks of section 1, the dispositions of section 6, and the close records of
section 10. Done when section 20 holds. **(decision A1)**

**R7-02 · Which residual M7 fixes.** A residual is fixed when it is (a) a behavior a visitor, a scraper or a
maintainer's command meets; (b) an R-05 gap in a function a spec names; (c) a test that can pass while its row is broken,
an oracle that does not pin a value its row states, or a fixed wait in a flow; or (d) a duplicated rule whose copies
must agree, inside one feature folder M7 already edits: an allow-list or a pattern that guards input, or an R-05 message
helper. It is not scheduled when it is (e) history on `main`, which cannot change without rewriting `main`; (f) a choice
a ruling makes on purpose; (g) a branch no input reaches; (h) test-code style with no false pass; or (i) a duplicate
across a feature or layer boundary, as 06's section 18 declined `src/export`'s copies, or a literal list that cases
already pin against the data. Section 6 applies the rule to each residual. **(decision A2; the rule drafter)**

**R7-03 · What M7 does not do.** It takes no dependency bump (R7-21), removes no "(experimental)" (R7-22), adds no
route, no UI copy and no committed data, changes no budget and no golden, and reschedules none of the items 06's section
18 lists (both of its tables) or 05's section 18 marks "Not scheduled"; section 18 lists them once by reference.
**(decision A2, C1, C2)**

### The timing flows (Task 7.1, owner approval item 1)

**R7-04 · The `timed` project.** `playwright.config.ts` holds three projects, in this order: `chromium` (as today, plus
`grepInvert: TIMED_GREP`), `lighthouse` (C-GUARD6-13's value, unchanged), and `timed`, which takes `chromium`'s `use` and
`testIgnore`, adds `grep: TIMED_GREP`, `dependencies: ["lighthouse"]` and `workers: 1`. Playwright runs `chromium` in
parallel, then the Lighthouse runs one at a time, then the timed flows one at a time, so no budget is measured beside
another browser. No budget, timeout or assertion of a timed flow changes. The `lighthouse` project's comment says it runs
after the parallel flows and before `timed`. To rerun the timed flows alone: `pnpm exec playwright test --project timed
--no-deps`. **(decision B1; owner approval item 1; the shape drafter)**

**R7-05 · The timed list.** `tests/e2e/timed-flows.ts` exports `TIMED_FLOWS`, the eight ids of section 7 in its order,
frozen, and `TIMED_GREP`, which matches a title holding one of those ids whole: a word boundary on each side, so no
letter or digit touches the id. A flow joins the list only by an amendment of section 7 that
cites a failure under load which passed alone; a flow in a serial group that shares one page never joins it alone.
**(decision B1; the list drafter)**

**R7-06 · One run.** From Task 7.1's landing, a gate passes only in one run: a timed flow that fails is a failure, the
rerun-alone rule of the M3 to M6 plans ends, and no ruling turns a failed gate green. A failure on a machine the owner's
own applications load is recorded with its load average and run again on a quieter machine. **(decision B1)**

### Gallery data and pages (Task 7.2)

**R7-07 · `briefSpec` checks R6-12's words.** After its type checks, `briefSpec` refuses, with a `RangeError` naming the
slug: a name that is not 1 to 18 letters and single spaces; a slug that is not the name in lowercase with hyphens; a
brief that is not plain text (`isPlainText`), not 30 to 100 characters, or not one sentence ending in its one period.
The deny list and the copy rules stay in C-GAL6-08 (the deny list lives in `tests/unit/ai/lexicon-deny.ts`), and slug
uniqueness stays there too (it is a property of the list, not of a row). **(decision A2; the split drafter)**

**R7-08 · The readers check what they read.** `entryDescription` and `entryMetadata` check that `entry.summary.contrast`
is an object holding whole-number `requiredPass` and `required` before they read them; `galleryCards` throws `TypeError`,
not `RangeError`, for a specimen that is not an array. **(decision A2)**

**R7-09 · The update command.** `package.json` gains one script, `data:update` (9.1), which runs only the four writers
of the committed data with both update switches on, so an update run exits 0 and never runs a compare case against a
stale file. The writers, the switches and their refusal under `CI` stay as R6-04 and C-LAND5-02 state them; the next
plain run is the check. **(decision A2; the command drafter)**

**R7-10 · One source for the gallery's shared names.** `links.ts` exports `LINK_PAGES` (frozen), `isLinkPage`,
`typeName` and `SLUG`. The open route and the entry page use `LINK_PAGES` and `isLinkPage` and declare no page list;
`data.ts`, `cards.ts` and `build.ts` import `typeName` and `SLUG` from `links.ts`, and `build.ts` takes `isRecord` from
`@/features/studio/guards`. The copies are byte-identical today (read on 2026-11-17), so no message changes. C-GUARD6-05
allows these imports (its modules import each other). **(decision A2; the module drafter)**

**R7-11 · Each copy is announced.** "Copy the studio link" clears its status line before each write and sets "Copied the
studio link." after it, so a second press changes the live region again. **(decision A2)**

### Share cards and the mosaic headline (Task 7.3, owner approval item 2)

**R7-12 · Two lines, no widow.** `MosaicShareCard`'s headline keeps its words, size (56 px), weight (700), tracking and
madder "receipt", and sets them as two line boxes, "24 design systems," and "each with its receipt", each a flex row of
its words with the word gap of today (`HEADLINE_PX * GLYPH_ADVANCE`), the two lines today's row gap apart
(`Math.round(HEADLINE_PX * 0.14)`, 8 px). The column keeps its height (two lines today, two lines after), so the mosaic
and the footer stay where they are. If the owner chooses option A of item 2, this ruling is
struck and C-CARD7-01 moves to section 18. **(decision B2; owner approval item 2; the break drafter)**

**R7-13 · The share cards check their arguments.** `GalleryShareCard` checks that `card` is an object with string `slug`,
`name` and `line`, a `strip` of five lowercase `#rrggbb` hexes, whole-number `passed` and `required`, and that `icon` is a
string; `MosaicShareCard` checks that `cards` is a non-empty array of such cards and `icon` a string. Types first; each
message starts with the component's name. The image routes pass committed, checked data, so no visitor sees a change.
**(decision A2)**

### Receipt lines and the landing (Task 7.4)

**R7-14 · `receiptLines` checks what it prints.** Before any count's domain, `receiptLines` checks that `name` and
`format` are strings, that `contrast.foreground`, `contrast.background` and `contrast.mode` are strings, and that
`finding` is an object or null; each failure is a `TypeError` naming the field. **(decision A2)**

**R7-15 · The color value is not announced on every input.** The color form's `<output>` carries `aria-live="off"`: it
still shows the value, and the brief form's status line stays the section's one announcement. **(decision A2)**

### The audit script (Task 7.5)

**R7-16 · The audit survives one failed run.** `scripts/audit-core.mjs` gains `runPlan(plan, run)` and `partialRecord`.
`runPlan` calls `run(item)` for each item in order; a rejection is retried once; a second rejection stops the plan and
resolves with the records so far and the failure (run, route, form factor, message). `audit-site.mjs` uses it: on a
failure it writes `test-results/audit-site/<date>.partial.json`, prints no README table, names the failed run and exits
with code 1. A complete plan writes the record of 12.2 of M6 as before. **(decision A2; the retry drafter)**

**R7-17 · `--base` takes an origin.** `baseOrigin(text)` in `audit-core.mjs` gives the origin of an `http:` or `https:`
URL whose path is `/` or empty and which has no query and no fragment, and refuses anything else with a `RangeError`;
`audit-site.mjs` reads `--base` through it. `audit-core.mjs` also exports `kind`, which `lighthouse.mjs` imports in place
of its byte-identical copy (R7-02, rule (d)). **(decision A2)**

### Tests and guards (Task 7.6)

**R7-18 · `codeFiles` names a null.** `codeFiles`' `TypeError` names the argument's type the way `describeType` does,
so null reads "null" and an array "array". **(decision A2)**

**R7-19 · Test oracles.** The tests of section 16's M6 rows change as that table says: each pins a value its row states,
drops a probe word that can fail on honest data, names a missing file, or reads a request recorder instead of a fixed
wait. No row's meaning changes except F-GAL6-15 and F-SEC6-01, which grow. **(decision A2)**

**R7-20 · C-GUARD7-01.** A new file, `tests/unit/engine/repo-guards-m7.test.ts`, applies C-GUARD6-01's method to this
spec with the readers of `guard-support.ts` unchanged (`section14`, `caseIds`, `titlesIn`, `unnamedCases`). This is
smaller than extending C-GUARD6-01: that would change an M6 row and its test, while the new file adds about 30 lines and
changes nothing. So this spec keeps 06's section numbers: cases in section 14, coverage in section 15. Task 7.6 writes it
last, after every other case has its test. **(decision D1; the file drafter)**

### The close (Task 7.7)

**R7-21 · Dependencies.** The deps pull request (branch `deps-2026-11-17`) takes TypeScript 6, three and `@types/three`
0.187.0, `remotion`, `@remotion/player` and `@remotion/web-renderer` 4.0.543 with `mediabunny` 1.64.0, zustand 5.1.0 and
`@playwright/test` 1.65.1, with its R5-50 and R5-60 amendment in 05-motion-3d.md. It is not an M7 task. It merges first;
`m7-finish` rebases onto `main` after it, and the M7 lanes are cut from the rebased branch. The close note records its
number and merge commit, and the README's stack row names the new versions if that pull request left them.
**(decision C1)**

**R7-22 · The on-device eval.** At the close the controller runs `/dev/on-device-eval` (R4-32) on `pnpm dev` in the
installed Chrome 157, started with a new, empty `--user-data-dir` that is deleted afterward, and records the pass rate
over `EVAL_BRIEFS` (JSON, schema and engine, per R4-32), or "not run" with the reason (probe 5 says what the model needs).
The result goes in this spec's close note and the README. "(experimental)" stays; removing it is the owner's decision
after the record (04-ai.md section 18). **(decision C2)**

**R7-23 · Langfuse.** Langfuse's list-traces endpoint sunset on 2026-11-16 (06's section 19); ingestion is another
endpoint. The controller makes one live AI action on `https://dyelot.vercel.app` that reaches the shared route (one call
of the visitor cap), then reads Langfuse for its trace by the read path probe 6 finds. The close note records the
trace's arrival, or its absence, which is told to the owner. **(decision C3)**

**R7-24 · The READMEs.** The README's three webgl-noise mentions (the reusers' licenses, the license paragraph and the
credits) take one wording, the /about page's: "the 2D simplex noise of webgl-noise by Ian McEwan and Ashima Arts, under
the MIT license, from stegu/webgl-noise; its notice is kept in the code and in the export", which matches the vendored
header in `src/flavor/flavor.mjs` (author Ian McEwan, Ashima Arts; copyright 2011 Ashima Arts; MIT). The meta-repo
README (`repos/README.md`) gets the edit of section 10, item 4. The README also gains the M7 status line, the gate times and load
averages, and the eval record. **(decision C4)**

**R7-25 · The umbrella and the knowledge graph.** `00-design.md` gains an "M7 sync" line after M6's, a note "Refined in
M7" in section 13's UI and flows row, and an M7 row in section 14's table; the close updates
`knowledge/products/product-dyelot.md` as `.claude/rules/knowledge-graph.md` says, and `validate_graph.py` passes.
**(decision C5)**

**R7-26 · Task 7.0.** Task 7.0 runs the probes of section 12 on the rebased branch before any other task and records
each result in this ruling; a probe that fails takes the fallback section 12 states. **(decision D4)**

**R7-27 · Amendments to earlier specs' text.** The close amends three texts, each marked "Amended in M7": 06's 9.3 says
that from 640 px the active mark keeps M5's place on the nav's border (`sm:after:-bottom-[11px]`), which the code does
and F-NAV6-01 checks; 06's 8.2 says the headline sets two lines (if R7-12 stands); and 04's close note gains one sentence
pointing to the eval record of R7-22, since R4-32 names that note. **(decision A2, C2; the placement drafter)**

## 4. Conventions, invariants and fixtures

Each case of section 14 becomes a test whose title starts with its id. A case that names a task belongs to that task,
and every other case to the task of its subsection.

- **I-M7-01.** Every M1 to M6 case passes except section 16's changes; every golden, `gallery.json`, `cards.json`,
  `receipt-excerpt.json` and `hero-cards.json` is unchanged at the close.
- **I-M7-02.** No budget changes: F-IMP-RF4's 2,000 ms and 1,000 ms, F-STEER-01's 1 s, `RECORD_BUDGET` (61,000 ms),
  `RENDER_BUDGET` (36,000 ms), and every test timeout a timed flow has today.
- **I-M7-03.** `package.json` gains the `data:update` script and nothing else; the `dependencies` and `devDependencies`
  are the deps pull request's.

Fixtures: `KERMES` (the `kermes` entry of `GALLERY_DATA`), `RECEIPT_EXCERPT`, `GALLERY_CARDS`, and the M6 support files.

## 5. Public API changes

| Module | Change |
|---|---|
| `src/features/gallery/links.ts` | Exports `LINK_PAGES: readonly LinkPage[]` (frozen), `isLinkPage(page: string): page is LinkPage` (a `TypeError` for a non-string), `typeName(value: unknown): string` and `SLUG: RegExp` |
| `src/features/gallery/build.ts` | `briefSpec(def, ai)`: the same signature, more `RangeError`s (R7-07) |
| `src/features/gallery/data.ts`, `cards.ts` | `entryDescription`, `entryMetadata`: more `TypeError`s; `galleryCards`: a `TypeError` for a specimen that is not an array (R7-08) |
| `src/features/landing/receipt.ts` | `receiptLines`: more `TypeError`s (R7-14) |
| `src/lib/site/gallery-card.tsx` | `GalleryShareCard`, `MosaicShareCard`: the same props; they throw for bad ones (R7-13); the headline's two lines (R7-12) |
| `scripts/audit-core.mjs` | `runPlan(plan, run)`, `partialRecord(parts)`, `baseOrigin(text)`, and `kind` exported (R7-16, R7-17) |
| `tests/e2e/timed-flows.ts` | `TIMED_FLOWS`, `TIMED_GREP` (R7-05) |
| `package.json` | The `data:update` script (R7-09) |

`runPlan` resolves `{ records, failure, retried }`: `records` in plan order, `failure` null or `{ run, route,
formFactor, message }`, `retried` the items that needed their one retry. `partialRecord({ date, base, runs, load,
records, failure })` gives 12.2 of M6's record with `lighthouse` holding `records`, `medians`, `firstByte` and `weight`
left out, and `failure` added.

## 6. The residual ledger

Sources: CN, 06's close note; DM, the M6 ledger's deferred minors; FR, the final review (I-n Important, n Minor); RC, its
re-check; TR, a task review (M Minor). Rows group residuals that share a disposition and a fix.

| # | Residual | Source | Disposition | Ruling, cases, or evidence |
|---|---|---|---|---|
| 1 | `briefSpec` checks field types but not R6-12's domains | CN; DM 6.1a; TR 6.1a M2 | Fix | R7-07; C-GAL7-01 |
| 2 | `entryDescription` and `entryMetadata` read `entry.summary.contrast` unchecked; `galleryCards` throws `RangeError` for a specimen that is not an array | FR 4 | Fix | R7-08; C-GAL7-02, C-CARD7-03 |
| 3 | `receiptLines` checks no type of the name, the format or the contrast's strings; `finding` undefined reads as present; no mixed-argument case; no case for the JSON text "5" | CN; DM 6.1b; TR 6.1b M1 to M3 | Fix | R7-14; C-REC7-01 |
| 4 | An update run of the gallery data exits 1, its compare cases reading the stale JSON | CN; DM 6.1a; TR 6.1a M3 | Fix | R7-09; C-DATA7-01 |
| 5 | The share-card components check no argument types | CN; DM 6.3; TR 6.3 M3 | Fix | R7-13; C-CARD7-02 |
| 6 | The mosaic headline leaves "receipt" alone on its second line | CN; DM 6.3; TR 6.3 M2; the hand check | Owner item 2; recommended: fix | R7-12; C-CARD7-01 |
| 7 | The open pages listed three times; `typeName` four times and the slug pattern twice in the gallery modules; `isRecord` in `build.ts` | DM 6.2; TR 6.2 M4; FR 3 | Fix | R7-10; C-GAL7-03 |
| 8 | A second "Copied" press is not announced again | CN; DM 6.2; TR 6.2 M7 | Fix | R7-11; F-GAL7-01 |
| 9 | The color form's `<output>` updates a live region on every input event | FR 6 | Fix | R7-15; F-LAND7-01 |
| 10 | One failed Lighthouse run aborts `audit-site.mjs`'s 48 runs and writes nothing | CN; DM 6.10a; TR 6.10a M4 | Fix | R7-16; C-AUD7-01 to 03 |
| 11 | `--base` drops any path; `kind` copied in `lighthouse.mjs` | CN; DM 6.10a; TR 6.10a M5; FR 3 | Fix | R7-17; C-AUD7-04 to 06 |
| 12 | `codeFiles`' `TypeError` prints `typeof`, so null reads "object" | FR 4 | Fix | R7-18; C-HYG7-01 |
| 13 | F-GAL6-01 does not pin 6 and 18; F-GAL6-04's bare "script"; F-GAL6-06's unnamed failure for a missing `receipt.json`; F-GAL6-15 has no encoded-slash path | CN; DM 6.2; TR 6.2 M1, M2, M6, M8; FR 10 | Fix | R7-19; section 16 |
| 14 | C-GAL6-05 and C-GAL6-07 loop without pinning 24 | FR 7; TR 6.1a M1 | Fix | R7-19; section 16 |
| 15 | F-LAND6-04's fixed 500 ms wait | FR 2; TR 6.6b M3 | Fix | R7-19; section 16 |
| 16 | F-SEC6-01 checks the 72 open-route `Location`s by prefix only | TR 6.11a M3 | Fix | R7-19; section 16 |
| 17 | C-GUARD6-12's probe tries 2 of the 6 never-use hosts | TR 6.11a M4 | Fix | R7-19; section 16 |
| 18 | F-A11Y6-04's "receipt `h2` is the last heading" and its count of hidden headings; F-A11Y6-03's six tags written out | DM 6.11b; TR 6.11b M2, M3, M5 | Fix | R7-19; section 16 |
| 19 | 9.3's text does not name the `sm:after:-bottom-[11px]` the nav keeps from 640 px | CN; DM 6.6a; TR 6.6a M1 | Fix (spec text) | R7-27 |
| 20 | The timing family fails under parallel load; one flake in `chromium` skips the 18 Lighthouse runs | CN; DM 6.5b; FR 10; TR 6.10b | Owner item 1; recommended: fix | R7-04 to R7-06; C-SER7-01 to 03 |
| 21 | C-BLK-01's 1 s wait over a cold `import("@/export")` | DM 6.5b; FR I-3 | Already fixed | `4e7cefa` (lane `d77ab03`) warms the loader in `beforeAll`; both close gates' unit runs passed |
| 22 | `showTemplate`'s waits span a lazy chunk load (F-TPL-17, 20, 27, 36, 38, 39) | DM 6.7; FR I-2 | Already fixed | `c5391fa` (lane `a673da0`): `openPreloaded` in the four serial groups and a 15 s root wait; none failed in the three full runs after it (lane 6.12's 581 flows, the close's two gates); probe 2 checks again |
| 23 | F-A11Y6-01's twelve axe runs outgrow 30 s | the close gate | Already fixed | `1a832ed`: `test.slow()` |
| 24 | The start-from section and its groups had no names | FR I-1 | Already fixed | `8094643` (lane `2dd6b52`) |
| 25 | No guard of M6's case ids | close Step 1 | Already fixed | `01de3f9` (lane `8871384`): C-GUARD6-01, 172 of 172 |
| 26 | `landing-m6.spec.ts`' header; the British spelling in `load.ts`' comment; `video-m6.test.ts`' lint warnings; `loaders-m6.test.ts` read by a regex | FR 1, 5, 9, 10; DM 6.6c, 6.9; TR 6.9 M1 | Already fixed | `3c6c514` (lane `c79fd59`) |
| 27 | 8.1 and 8.2's gaps and tracking; R6-33's F-TPL6-07 and "could make"; section 16's "which flips"; section 18's F-VT-03 cell; F-TPL6-05's row | DM 6.3, 6.7; TR 6.3 M1; TR 6.7 r0 M3, r1 M1 to M3 | Already fixed | `b80a111` |
| 28 | The meta-repo plan's 171 cases | TR 6.7 r1 | Already fixed | `e4c3fd1` (meta-repo) |
| 29 | `galleryEntry` checks no type of `terms` or `def.tags` | TR 6.1a M2 | Already fixed | `68c2894`; `build.ts:168-169` |
| 30 | 6.4's five minors (the import forms, R6-21's reason, the link prose, extra prose, `REPOSITORY_URL`) | TR 6.4 M1 to M5 | Already fixed | `0ec96bf` |
| 31 | `readEntry`: no row for mixed or repeated keys; coverage unconfirmed | DM 6.5a; TR 6.5a M1, M2 | Already fixed | `c011cd0` (`url-entry.test.ts:48-50`); `url.ts`' own floor passed in the close's `gate:full` (`fe1de25`) |
| 32 | `noModelRuns` and the mock's shared log; the copied store helpers; C-STORE6-09's direct call | TR 6.5b M-1 to M-3 | Already fixed | `fc84ad1`: `studio-entry.spec.ts:61-64`; `draftOf` from `./support`; `store-entry.test.ts:153-157` dispatches `hashchange` |
| 33 | C-GUARD-05's whole-file exception; the brief whose NFC form is longer | TR 6.6b M1, M2 | Already fixed | `256d7e0`, `4755d66` |
| 34 | F-LAND6-01 checked `at > 0` only | TR 6.6b M3 | Already fixed | `256d7e0` (`landing-m6.spec.ts:269`) |
| 35 | The nav found by position; an unexplained `networkidle`; a vacuous mark check; `typeof` in `metadata.ts` | TR 6.6c M2 to M5 | Already fixed | `3ae2910` (`landing-m6.spec.ts:38`, `:184-186`, `:193`; `metadata.ts:86`) |
| 36 | The alert across a switch; `load.ts`' own `describeType`; `LAZY_TEMPLATES`' order | TR 6.7 r0 M1, M2, M4 | Already fixed | `07545fd`; `load.ts:2`; `template-support.ts:1139` |
| 37 | `brandDescription`'s unreached branches; `violations(page, extraRules)` with no caller; a silent restart focus | TR 6.8 M1, M2, M4; FR 11 | Already fixed | `c5a6f79` (`video-m6.test.ts:70-90`, `ExploreClient.tsx:217`); `71f7a6a` (`a11y-m6.spec.ts:76`) |
| 38 | The `performance` allowance; the gallery's own card unchecked by the page policy | TR 6.11a M1, M2 | Already fixed | 6.11a's review round 1 (06 section 14.12's ruling); `39a1f6b` (`security-m6.spec.ts:42`) |
| 39 | `auditTable`'s, `finite`'s and `runLighthouse`'s types; a mixed-argument case | TR 6.10a M1 to M3, M7 | Already fixed | `f43c2b3` |
| 40 | Unverified at review: the long `Location` on Vercel, F-LAND6-01's role queries, 6.11a's guards, the coverage floors | FR; RC 3 | Already fixed | the hand check of 2026-11-17 (06's close note); both close gates |
| 41 | `ce95795` and `9ef20b6` (lane `b7f85dc`) leave M4's rationale flow red until `0b4110e` | CN; DM 6.5b; TR 6.5b M-4 | Not scheduled | History: a bisect gap on `main` cannot close without rewriting `main` |
| 42 | `256d7e0`'s subject has 75 characters | FR 8 | Not scheduled | History, on `main` |
| 43 | Flows with no red run (F-NAV6-01, 02 and RF5, and 06's other test-order notes); 6.2's first commit; two reports' misstatements | TR 6.6c M1; TR 6.2 note; TR 6.1b M4; TR 6.6a M4 | Not scheduled | History; 06's close note records them |
| 44 | `summaryLines(entry.summary)[0] ?? ""` | DM 6.2; TR 6.2 M5 | Not scheduled | A branch no input reaches: `summaryLines` gives four lines for every summary (M3), so no test could turn a throw there red |
| 45 | The facts and swatch markup and the link class, twice | DM 6.2; TR 6.2 M3 | Not scheduled | Presentation; F-GAL6-02, 05 and 12 pin what each renders |
| 46 | `typeName` in `receipt.ts` and `metadata.ts`, `typeOf` in `start.ts`, `familyName` twice, the specimen steps and palettes twice | FR 3; DM 6.6c | Not scheduled | Feature and layer boundaries keep them apart (landing against gallery; `start.ts` imports nothing by R6-28; `src/lib/site` sits below the features); C-GAL6-07 and C-CARD6-01 pin the specimen's steps and palettes against the data |
| 47 | `story.ts` imports `describeType` from `@/features/studio/guards` | DM 6.9; TR 6.9 M2 | Not scheduled | The preview's helpers import it the same way; that file imports nothing |
| 48 | No unit test of the nav's class strings | CN; DM 6.6a; TR 6.6a M2 | Not scheduled | F-NAV6-01, 02 and RF5 check the rendered mark; a class-string test pins markup |
| 49 | `color-support.ts`' comment and `allowed` alias; `loaders-m6.test.ts`' blank line; Biome's info on a landing test's concatenation; the inline `TestInfo` type | DM 6.6a, 6.10b; TR 6.6a M3; TR 6.10b; RC 1, 2 | Not scheduled | Test-code style with no false pass; `pnpm lint` passes |
| 50 | `M5_PINS` copied in `gate.test.ts` | DM 6.10a; TR 6.10a M6 | Not scheduled | The deps pull request edits both copies in one commit, and a drift fails both guards, never passes them |
| 51 | F-LH6's hand-written titles; `lighthouse`'s dependency on `chromium` | DM 6.10b; TR 6.10b | Not scheduled | C-GUARD6-01 needs literal titles; C-GUARD6-13 pins the dependency (row 20 moves the flakes instead) |
| 52 | `BrandPlayer`'s `biome-ignore` (a `<figure>` would also meet 13.2) | DM 6.8; TR 6.8 M3 | Not scheduled | R6-35 and F-FIX6-01 name `role="figure"` on the existing div |
| 53 | The e2e oracle repeats 9.2's wording | DM 6.6c; TR 6.6c M6 | Not scheduled | By design: the spec text is the one source |
| 54 | `metadata.ts`' `site` argument unchecked | TR 6.6c M5 | Not scheduled | Every caller passes the frozen `SITE` that `defineSite` checked |
| 55 | `scrollThrough`'s 30 ms step; the ring check reads the outline's width; optional probes for F-A11Y6-01 to 03; F-LAND6-01's selector on `TerminalWindow`'s markup; the plan's `TemplateBoundary` line | DM 6.11b; TR 6.11b M1, M4; TR 6.6b M3; TR 6.7 r1 | Not scheduled | No assertion waits on the 30 ms; the row asks for the width; FR 11 settled the rules from axe's source; a markup change fails loudly; a plan records its time |
| 56 | 06's section 18 (both tables) and 05's section 18 | 06 §18; 05 §18 | Not scheduled | Approved for v1 (06's owner approval item 6); listed once, by reference |

Tally: 20 rows to fix (two through the owner's items), 20 already fixed, 16 not scheduled.

## 7. The timing flows (owner approval item 1)

The family, from the failure lines of M6's 20 lane folders and the close's logs. Each failed under the suite's own eight
workers and passed alone: the close's `gate:full` began at a load average of 1.70, and 06's close note records load
averages up to 17 from the suites' own workers.

| Order | Id | Spec | Budget or wait | Failed in M6 logs | Measured |
|---|---|---|---|---|---|
| 1 | F-INSP-15 | M2 | Playwright's 30 s test timeout | 20, both close gates | |
| 2 | F-STUDIO-05 (two tests) | M2 | The 30 s test timeout | 10 | 21.6 s, passing, in the close's `gate:full` |
| 3 | F-IMP-RF4 (two tests) | M3, RF4 | Product: the notice within 2 s, no long task over 1 s | 26, both close gates | 2,128 to 2,156 ms under load; 762 and 784 ms alone |
| 4 | F-ABT-02 | M3, R3-33 | Product: steady typing is one history entry | 5 | |
| 5 | F-STEER-01 | M4, R4-44 | Product: three presses within 1 s are one entry | 5 | 1,088 to 1,961 ms for the three presses |
| 6 | F-LOOP-01 | M5, R5-64 | Product: `RECORD_BUDGET`, 61 s | 11 | 48.5 s, passing, in the close's `gate:full` |
| 7 | F-RENDER-01 | M5, R5-64 | Product: `RENDER_BUDGET`, 36 s | 6 | 32.5 s, passing, in the close's `gate:full` |
| 8 | F-LAZY5-02 | M5, R5-61 | A 5 s state wait | 2 | |

Nine source titles, ten tests. The change (Task 7.1):

```ts
// tests/e2e/timed-flows.ts
export const TIMED_FLOWS = Object.freeze([
  "F-INSP-15", "F-STUDIO-05", "F-IMP-RF4", "F-ABT-02", "F-STEER-01", "F-LOOP-01", "F-RENDER-01", "F-LAZY5-02",
] as const);
export const TIMED_GREP = new RegExp(`\\b(?:${TIMED_FLOWS.join("|")})\\b`);

// playwright.config.ts, projects
const DESKTOP = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } };
{ name: "chromium", use: DESKTOP, testIgnore: /lighthouse-m6\.spec\.ts/, grepInvert: TIMED_GREP },
{ name: "lighthouse", /* unchanged */ },
{ name: "timed", use: DESKTOP, testIgnore: /lighthouse-m6\.spec\.ts/, grep: TIMED_GREP,
  dependencies: ["lighthouse"], workers: 1 },
```

Per-project `workers` is in the installed Playwright's types (`playwright@1.64.1`, `types/test.d.ts`, "workers limit for
this project"); probe 1 checks it on 1.65.1. CI runs one worker already, so its order changes and its time does not.
Locally the timed phase adds about two minutes to each gate (probe 2 measures it). No test file changes.

## 8. The mosaic headline (owner approval item 2)

At 56 px the fit model gives `Math.floor(1056 / (56 × 0.58))` = 32 columns. "24 design systems, each with its" is 32
characters, so greedy wrapping leaves "receipt" alone on line two, as the hand check of 2026-11-17 saw on the deployed
card. `cards.json` holds each entry's slug, name, line, strip and counts, not the headline, so no committed file changes
under any option, and `/gallery/opengraph-image` is prerendered, so the new card ships with the deploy.

| Option | What changes | Cases |
|---|---|---|
| A. Keep it | Nothing; the highlight sits on its own line | C-CARD7-01 moves to section 18 |
| B. Two balanced lines, "24 design systems," and "each with its receipt" (18 and 21 characters) | `gallery-card.tsx` only; same words, size, color and height | C-CARD7-01; C-CARD6-05's row stands (its test reads the runs across two lines) |
| C. One line at 44 px (40 characters fit 41 columns at 44 px, not 37 at 48) | The headline's size, and the mosaic moves up about 80 px | C-CARD6-05's row changes (44 px) |
| D. One line of new copy, "24 design systems with receipts" (31 characters at 56 px) | The headline's words, R6-19 and 8.2, and the mosaic moves up about 70 px | C-CARD6-05's row changes; one column of margin |

F-SHARE6-03 (the first strip's pixel row) holds under A and B; under C and D the row moves and the flow still finds it.

## 9. The update command and the audit script

### 9.1 `pnpm data:update`

```json
"data:update": "DYELOT_UPDATE_GALLERY=1 DYELOT_UPDATE_HEROES=1 vitest run --project web --project web-slow tests/unit/features/gallery/data.test.ts tests/unit/features/gallery/cards.test.ts tests/unit/features/landing/receipt.test.ts tests/unit/features/landing/heroes.test.ts -t rewrites"
```

The filter selects the four writers by the word "rewrites" in their titles; each writer still refuses under `CI`.
`data.test.ts` runs in `web-slow` and the other three in `web`. The README's testing section names the command.

### 9.2 `audit-site.mjs`

The shell builds `plan = auditPlan(routes, FORM_FACTORS, runs)` and `run = (item) => runLighthouse(...).then(auditRecord)`,
then `runPlan(plan, run)`. A run whose report holds a `runtimeError` makes `auditRecord` throw, so it counts as a failure
and is retried. On a failure the shell writes `partialRecord(...)` and exits 1 before the first-byte and weight passes.

## 10. The close (Task 7.7)

1. **Gates.** `pnpm gate:full` and `pnpm gate` on the M7 tip, each in one run, with the time and the load average at
   start and end recorded in the close note and the README.
2. **The on-device eval** (R7-22) and **the Langfuse check** (R7-23), recorded in the close note; the eval also in the
   README's AI section and its "Not done in M4" row.
3. **This repository's README** (R7-24): the webgl-noise wording in its three places, the stack row's versions, the
   end-to-end row (one run, no rerun), the gate times, `pnpm data:update`, and "M7, done."
4. **The meta-repo README** (`repos/README.md`): the intro's "the 13 product repositories" and the tree's
   "`<13 product repos>/`" say 16, as its table's heading and the knowledge indexes do; both clone lists gain
   `inkthread-backend`, `inkthread-frontend` and `dyelot`; `inkgrid` joins them only if probe 7 finds its GitHub
   repository, and then its row drops "so it is not in the clone lists yet".
5. **The umbrella and the knowledge graph** (R7-25), and the three text amendments of R7-27.
6. **The pull request** merges once CI is green, which deploys it; the controller then opens
   `/gallery/opengraph-image` on the deployed site and records what the headline shows.

## 11. Task split

| Task | What | Files | Model | Wave |
|---|---|---|---|---|
| 7.0 | Probes of section 12 | none committed but R7-26's record | Opus | 0 |
| 7.1 | The `timed` project | `playwright.config.ts`, `tests/e2e/timed-flows.ts`, `tests/unit/scripts/gate.test.ts` | Opus | 1, first to land |
| 7.2 | Gallery data and pages | `src/features/gallery/{build,data,cards,links,CopyLink}.ts(x)`, `src/app/gallery/[slug]/page.tsx`, `src/app/gallery/[slug]/open/[page]/route.ts`, `package.json`, `tests/unit/features/gallery/*` (new `finish-m7.test.ts`), `tests/e2e/gallery.spec.ts` | Sonnet | 1 |
| 7.3 | Share cards | `src/lib/site/gallery-card.tsx`, `tests/unit/site/gallery-card.test.tsx` | Sonnet | 1 |
| 7.4 | The landing | `src/features/landing/{receipt.ts,StartFrom.tsx}`, `tests/unit/features/landing/receipt.test.ts`, `tests/e2e/landing-m6.spec.ts` | Sonnet | 1 |
| 7.5 | The audit script | `scripts/audit-core.mjs`, `scripts/audit-site.mjs`, `scripts/lighthouse.mjs`, `tests/unit/scripts/audit-core.test.ts` | Sonnet | 1 |
| 7.6 | Oracles, helpers, the guard | `tests/unit/engine/guard-support.ts`, `tests/unit/engine/guard-support-m6.test.ts`, `tests/unit/engine/repo-guards-m6.test.ts`, new `repo-guards-m7.test.ts`, `tests/e2e/security-m6.spec.ts`, `tests/e2e/a11y-m6.spec.ts` | Sonnet | 2 |
| 7.7 | Close | `README.md`, `docs/specs/{00-design,04-ai,06-gallery,07-finish}.md`; meta-repo `README.md`, `knowledge/` | Opus (controller) | 3 |

No two lanes share a file: `gate.test.ts` is 7.1's alone (C-DATA7-01 lives in 7.2's new file), and `gallery.spec.ts` is
7.2's alone. Task 7.1 lands first so the other lanes' gates run in one run too.

## 12. Probes (Task 7.0)

1. **The `timed` project on 1.65.1.** On the rebased branch with section 7's change only: `playwright test --list` shows
   the ten tests under `timed` and none under `chromium`; the projects run in the order `chromium`, `lighthouse`,
   `timed`; `--project timed --no-deps` runs the ten alone, one worker. Fallback if per-project `workers` is not honored:
   `test:e2e` becomes two invocations, `--project chromium --project lighthouse`, then `--project timed --workers 1`
   (about a minute more for the second build), and C-SER7-01 changes with it.
2. **One run.** On that branch, two `pnpm gate:full` runs and one `pnpm gate`, each recording time and load averages. Each
   must pass in one run. A flow outside section 7 that fails under load and passes alone is reported; it joins section 7
   by an amendment (R7-05), or it is a regression. This also watches rows 21 to 23's flows.
3. **The two-line headline** (if option B): render `/gallery/opengraph-image` on `next start` and look: two lines, no
   clipping, the tiles and the footer where the hand check saw them.
4. **`pnpm data:update`**: on a scratch copy with `cards.json` edited stale, it exits 0 and restores the file; `-t
   rewrites` selects four tests.
5. **The on-device model in Chrome 157**: whether a page on `localhost` reaches the Prompt API without a flag, what the
   model download needs (disk, time), and that a fresh `--user-data-dir` holds it. Fallback: R7-22's "not run".
6. **Langfuse's read path** after the list-traces sunset: which view or endpoint shows one trace by its time or id.
   Fallback: the close note says the trace could not be read and tells the owner.
7. **`inkgrid`'s GitHub repository**: whether `github.com/Abdul-Muizz1310/inkgrid` exists (its local clone names that
   remote), for section 10, item 4.

## 13. Amendments to earlier specs

R7-27's three texts, and 00-design.md's lines of R7-25. Each is marked "Amended in M7" or "Refined in M7" where it stands;
none edits a ruling's own words.

## 14. Cases

### 14.1 Gallery data and pages (Task 7.2)

Tests: `tests/unit/features/gallery/finish-m7.test.ts`, `tests/e2e/gallery.spec.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-GAL7-01 | failure | `briefSpec` refuses, each with a `RangeError` whose message starts `briefSpec:` and names the slug: the names "Abcdefghijklmnopqrs" (19 letters), "Red 2" and "Two  Spaces"; the slug "kermes" with the name "Cochineal"; briefs of 29 and 101 characters, one with no final period, one of two sentences ("A tea house. At dusk."), and one holding a control character; a row whose name is 5 and whose brief has 101 characters throws `TypeError` (types first); each of the 18 brief rows of `GALLERY_DEFS` still builds | ruling R7-07, R6-12, R-05; ledger 1 |
| C-GAL7-02 | failure | `entryDescription` and `entryMetadata` of a `KERMES` copy with no `summary`, with `summary.contrast` null, and with `requiredPass` "78" throw `TypeError` whose message starts with the function's name and names the field; `KERMES` itself still gives C-GAL6-11's text | ruling R7-08, R-05; ledger 2 |
| C-CARD7-03 | failure | `galleryCards` of data whose `kermes` entry has `specimen: "x"` throws `TypeError` naming `galleryCards` and `kermes`; a specimen that lacks `danger` still throws C-CARD6-03's `RangeError` | ruling R7-08, R-05; ledger 2 |
| C-GAL7-03 | pass | `LINK_PAGES` is `["studio", "explore", "motion"]`, frozen; `isLinkPage` is true for each, false for "lab", "Studio", "" and "__proto__", and throws `TypeError` naming `isLinkPage` for 3; read from the syntax trees, `route.ts` and `[slug]/page.tsx` import from `links.ts` and declare no list of pages, `links.ts` is the one gallery module that declares `typeName` and `SLUG`, and `build.ts` declares no `isRecord` | ruling R7-10; ledger 7 |
| C-DATA7-01 | pass | `package.json`'s `data:update` is 9.1's string; in the four files it names, the `describe` and `it` titles holding "rewrites" are exactly the writers of C-GAL6-02, C-CARD6-02, C-REC6-02 and C-LAND5-02, each inside its file's `if (process.env.DYELOT_UPDATE_...)` block | ruling R7-09; ledger 4 |
| F-GAL7-01 | pass | With clipboard permission, two presses of "Copy the studio link" on `/gallery/kermes`: a `MutationObserver` on the status line records "Copied the studio link.", then the empty text, then "Copied the studio link." again | ruling R7-11; ledger 8 |

### 14.2 Share cards (Task 7.3)

Tests: `tests/unit/site/gallery-card.test.tsx`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-CARD7-01 | pass | `MosaicShareCard`'s headline is two line boxes 8 px apart, each a flex row: "24 design systems," and "each with its receipt"; each line has at most `Math.floor(CONTENT_WIDTH / (56 * GLYPH_ADVANCE))` (32) characters and more than one word; every run is 700 at 56 px with the M0 tracking, and only "receipt" is in `SITE.accent`; the tiles and the footer are C-CARD6-05's (moves to section 18 under option A of owner item 2) | ruling R7-12, R6-19; ledger 6 |
| C-CARD7-02 | failure | `GalleryShareCard` throws `TypeError` for `card: null`, a card whose `passed` is "78" and an `icon` of 5, and `RangeError` for a strip of four hexes and a strip holding "red"; `MosaicShareCard` throws `TypeError` for `cards: "x"` and `RangeError` for `cards: []`; each message starts with the component's name; every committed card still renders as C-CARD6-04 and C-CARD6-05 say | ruling R7-13, R-05; ledger 5 |

### 14.3 The landing (Task 7.4)

Tests: `tests/unit/features/landing/receipt.test.ts`, `tests/e2e/landing-m6.spec.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-REC7-01 | failure | `receiptLines` throws `TypeError` starting `receiptLines:` and naming the field for an excerpt whose `name` is 5, whose `format` is null, whose contrast `foreground`, `background` or `mode` is not a string, and whose `finding` is undefined; an excerpt with `required` 77.5 and `requiredPass` "78" throws `TypeError` (types before values); `receiptExcerpt("5")` throws `RangeError` starting `receiptExcerpt:`; `RECEIPT_EXCERPT` still gives C-REC6-04's six sentences | ruling R7-14, R-05; ledger 3 |
| F-LAND7-01 | pass | On `/`, the color form's `<output>` carries `aria-live="off"` and shows each of three values set in turn on the color input; the brief form's status line still reads "Write a few words first." for "1234" (F-LAND6-04) | ruling R7-15; ledger 9 |

### 14.4 The audit script (Task 7.5)

Tests: `tests/unit/scripts/audit-core.test.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-AUD7-01 | pass | `runPlan(auditPlan(["/a", "/b"], FORM_FACTORS, 1), run)` with a fake `run` that rejects once for the third item: a record for each of the four items in plan order, `failure` null, `run` called five times, and `retried` holding the third item | ruling R7-16; ledger 10 |
| C-AUD7-02 | failure | A fake `run` that rejects twice for the third item: `records` holds the first two, `failure` is `{ run: 1, route: "/b", formFactor: "desktop", message }`, and no later item is called; `partialRecord` of those parts has `lighthouse` equal to the two records, `failure` equal to it, and no `medians`, `firstByte` or `weight` | ruling R7-16; ledger 10 |
| C-AUD7-03 | failure | `runPlan(null, run)` and `runPlan(plan, 3)` throw `TypeError`, `runPlan([], run)` `RangeError`; `partialRecord(null)` throws `TypeError`; each message starts with the function's name | ruling R7-16, R-05; ledger 10 |
| C-AUD7-04 | pass | `baseOrigin` gives `https://dyelot.vercel.app` for "https://dyelot.vercel.app" and "https://dyelot.vercel.app/", and `http://localhost:3100` for "http://localhost:3100" | ruling R7-17; ledger 11 |
| C-AUD7-05 | failure | `baseOrigin` throws `RangeError` naming `baseOrigin` for "https://a.test/x", "https://a.test/?q=1", "https://a.test/#top", "ftp://a.test" and "not a url", and `TypeError` for 3 | ruling R7-17, R-05; ledger 11 |
| C-AUD7-06 | pass | `kind` from `audit-core.mjs` gives "null", "an array" and "number" for null, `[]` and 3; read from the syntax tree, `lighthouse.mjs` imports `kind` from `./audit-core.mjs` and declares no function of that name | ruling R7-17; ledger 11 |

### 14.5 The timed project (Task 7.1)

Tests: `tests/unit/scripts/gate.test.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-SER7-01 | pass | `playwright.config.ts`'s projects are `chromium`, `lighthouse` and `timed`, in order; `timed` equals `{ name: "timed", use, testIgnore, grep: TIMED_GREP, dependencies: ["lighthouse"], workers: 1 }` with `chromium`'s `use` and `testIgnore`; `chromium` has `grepInvert: TIMED_GREP`; `lighthouse` is C-GUARD6-13's value | ruling R7-04; ledger 20 |
| C-SER7-02 | pass | `TIMED_FLOWS` is section 7's eight ids in its order, frozen; read from the syntax tree of every file under `tests/e2e`, the `test` titles `TIMED_GREP` matches are exactly section 7's nine, and no other | ruling R7-05; ledger 20 |
| C-SER7-03 | failure | `TIMED_GREP` matches "timed import.spec.ts F-IMP-RF4 a 256 KiB DESIGN.md" and none of "F-IMP-RF40 x", "XF-LOOP-01 x", "F-LOOP-010 x" or "F-LOOP-0 x"; C-SER7-01's check reports a probe config whose `timed` lacks `workers: 1`, one whose `timed` depends on `chromium`, and one whose `chromium` lacks the `grepInvert` | ruling R7-04, R7-05; ledger 20 |

### 14.6 Helpers and the guard (Task 7.6)

Tests: `tests/unit/engine/guard-support-m6.test.ts`, `tests/unit/engine/repo-guards-m7.test.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-HYG7-01 | failure | `codeFiles(null)` and `codeFiles([])` throw `TypeError` whose messages end "got null" and "got array"; C-HYG6-02's cases stand | ruling R7-18; ledger 12 |
| C-GUARD7-01 | pass | The ids are read from the rows of `docs/specs/07-finish.md` between `\n## 14. ` and `\n## 15. `, one per row, each once; every `C-` id appears whole in a `describe` or `it` title under `tests/unit` and every `F-` id in a `test` title under `tests/e2e`, read from each file's syntax tree; a probe id with no title is reported | ruling R7-20, decision D1 |

## 15. Coverage

M6's scope and floors stand. `links.ts`, `data.ts`, `cards.ts` and `build.ts` keep `GALLERY_HELPERS`' 95 and 90,
`receipt.ts` `LANDING_HELPERS`', and `gallery-card.tsx` `src/lib/site/**`'s 80, 80, 75 and 70.
`scripts/audit-core.mjs` stays outside the coverage scope; C-AUD7-01 to 06 cover `runPlan`, `partialRecord`,
`baseOrigin` and `kind`. Each case is written from its row, never from an uncovered-line report.

## 16. Changes to M1 to M6 cases

| Case | Was | Now | Why |
|---|---|---|---|
| F-INSP-15, F-STUDIO-05 (M2), F-IMP-RF4, F-ABT-02 (M3), F-STEER-01 (M4), F-LOOP-01, F-RENDER-01, F-LAZY5-02 (M5) | Run in `chromium`, beside up to seven other workers | Run in `timed`, one at a time, after `lighthouse`; rows, budgets and assertions stand | R7-04 |
| F-GAL6-01 (M6) | The intro's numbers are counted from the data | Also `[HERO_COUNT, BRIEF_COUNT]` equals `[6, 18]`; the row stands | R7-19 |
| F-GAL6-04 (M6) | The markup probe also looks for the bare word "script" | Looks for "<script>" and "alert(1)" only; the row stands | R7-19 |
| F-GAL6-06 (M6) | A missing `receipt.json` fails as a `SyntaxError` | `expect(file, "receipt.json").toBeDefined()` first; the row stands | R7-19 |
| F-GAL6-15 (M6) | Three 404 paths | Also `/gallery/kermes/open/%2F%2Fevil.example`: 404 and no `Location` | R7-19 |
| C-GAL6-05, C-GAL6-07 (M6) | Loop over the entries | Also assert 24 entries first; the rows stand | R7-19 |
| F-LAND6-04 (M6) | A 500 ms wait, then the URL | A document-request recorder from before the press; no request leaves `/`; no wait; the row stands | R7-19 |
| F-SEC6-01 (M6) | Each `Location` starts with `/studio#s=`, `/explore#s=` or `/motion#s=` | Each of the 72 equals `entryHref(page, entry.link)` (which also starts so) | R7-19 |
| C-GUARD6-12 (M6) | The probe tries two never-use hosts | It tries each of `NEVER_USE_HOSTS`; the row stands | R7-19 |
| F-A11Y6-03 (M6) | The six tags written out | Read from `GALLERY_TAGS`; the row stands | R7-19 |
| F-A11Y6-04 (M6) | Counts hidden headings; the receipt `h2` must be the last heading | Counts rendered headings (`checkVisibility()`); the receipt `h2` follows the story's headings; the row stands | R7-19 |
| C-CARD6-05 (M6) | The headline's runs share one wrapping box | Its test reads the runs across the two line boxes (option B); the row stands | R7-12 |

Every other M1 to M6 case stands as written (I-M7-01), C-GUARD6-13 and C-HYG6-02 among them, and every golden.

## 17. Review Focus

| RF | Input | Cases |
|---|---|---|
| RF1 | The timed split: an id inside a longer one, a template-literal title, a project order that lets Lighthouse and a timed flow overlap | C-SER7-01 to 03 |
| RF2 | R-05 across fields: two bad fields, one a type and one a domain | C-GAL7-01, C-GAL7-02, C-CARD7-02, C-REC7-01 |
| RF3 | The audit's failure path: a run failing once, twice, first or last | C-AUD7-01 to 03 |
| RF4 | An update run that touches only the writers | C-DATA7-01 |

## 18. Deferred, and what is not scheduled

| Item | Comes from | Milestone |
|---|---|---|
| Every item of 06's section 18 (both tables) and of 05's section 18 marked "Not scheduled" | 06, 05 | Not scheduled, as the owner approved for v1; not listed again |
| Section 6's rows 41 to 55 | Section 6 | Not scheduled, for each row's reason |
| Removing "(experimental)" from the on-device switch | 04-ai.md section 18 | The owner's, after R7-22's record |
| Launch and marketing copy | 06 section 18 | Outside the milestones: the owner's |
| C-CARD7-01, if the owner chooses option A of item 2 | R7-12 | Not scheduled; no test carries it then |

## 19. Risks

- **The machine's own load.** The timed phase removes the suite's load, not the owner's applications'. A timed failure
  is then a failure (R7-06): the load average is recorded and the gate runs again on a quieter machine.
- **A dependency hides results.** A failure in `chromium` skips `lighthouse` and `timed` ("did not run"), as one failure
  skipped the 18 Lighthouse runs in M6; the gate is red either way, and `--no-deps` reruns a phase.
- **Longer gates.** About two minutes per local gate (probe 2 measures it); CI's time does not change.
- **Cached cards.** Scrapers keep the old mosaic card until they fetch it again.
- **The on-device model may not load.** The record says "not run" with the reason (R7-22).
- **Langfuse's read path** may differ after the sunset (probe 6); ingestion does not depend on it.
- **TypeScript 6** may flag code the M6 lanes wrote; the M7 lanes start from the rebased branch, where the deps pull
  request has made `pnpm typecheck` pass.

## 20. Done when

- Every case of section 14 has a test that carries its id (C-GUARD7-01), and every `failure` case fails as its row says.
- `pnpm gate:full` and `pnpm gate` each pass in one run on the M7 tip, with no rerun and no timing ruling; both times and
  load averages are recorded.
- Every M1 to M6 case passes except section 16's changes; every golden and committed JSON file holds (I-M7-01).
- Task 7.0's probe results are in R7-26, and section 18's conditional row is struck or kept.
- The pull request merges once CI is green, which deploys it; the deployed mosaic card is looked at and recorded.
- The on-device eval's pass rate, or "not run" with the reason, and the Langfuse check are in this spec's close note;
  the eval's record is also in the README and pointed to from 04's close note.
- The README holds R7-24's edits; the meta-repo README holds those of section 10, item 4.
- `00-design.md` holds the M7 sync line, the note in section 13 and the M7 row; `product-dyelot.md` is updated; and
  `validate_graph.py` passes.

## 21. Owner approval items

Each item ends with a recommendation, the drafter's.

1. **The timing flows** (section 7, R7-04 to R7-06). Options: **A.** A `timed` project, one worker, after `lighthouse`,
   holding the eight ids of section 7 (ten tests); no budget changes, about two minutes more per local gate. **B.**
   `test.slow()` on the flows that hit a harness timeout: F-IMP-RF4, F-STEER-01, F-ABT-02 and the M5 budgets would still
   fail under load, so the gates still need reruns. **C.** Fewer local workers (for example four): longer gates for every
   flow, and no proof the 2 s budget holds at four. **D.** Keep the rerun-alone rule and a written ruling per gate.
   *Recommendation: A; it is the one option that measures each budget on a quiet CPU without changing a budget.*
2. **The mosaic headline** (section 8, R7-12). Options: **A.** keep "receipt" on its own line; **B.** two balanced
   lines, same words, size and height; **C.** one line at 44 px; **D.** one line of new copy. No committed data changes
   under any option. *Recommendation: B; it ends the widow and moves nothing else on the card.*
3. **The ledger** (section 6, R7-02): 20 rows fixed, 20 already fixed, 16 not scheduled, by R7-02's rule.
   *Recommendation: accept.*
4. **A new command, `pnpm data:update`** (R7-09, 9.1), which rewrites the four committed data files at once and exits 0.
   *Recommendation: accept.*
5. **The close's live actions** (R7-22, R7-23): the on-device eval in Chrome 157 with a throwaway profile (the model may
   download several gigabytes), and one live AI action on the deployed site, which spends one call of the shared quota.
   "(experimental)" stays. *Recommendation: accept.*
6. **The meta-repo README's counts and clone lists** (section 10, item 4), edited at the close in the `repos` meta-repo.
   *Recommendation: accept.*
