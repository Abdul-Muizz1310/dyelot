# 06 · The gallery and finishing: gallery, landing, about, share cards and audits (M6)

> Source note: this milestone spec refines `docs/specs/00-design.md`, the umbrella (sections 1, 3, 5, 7, 13, 14 and 16
> above all), and builds on `docs/specs/01-color-engine.md` (M1), `docs/specs/02-studio.md` (M2), `docs/specs/03-export.md`
> (M3), `docs/specs/04-ai.md` (M4) and `docs/specs/05-motion-3d.md` (M5). Paths to `docs/research/`, `docs/plans/` and
> `knowledge/` point into the private `repos` meta-repo. Next.js facts cite the docs shipped with next 16.4.3 under
> `node_modules/next/dist/docs/` (written `NDOCS/` below), as `AGENTS.md` requires. Package facts were read from the npm
> registry on 2026-11-07. The gallery's table (section 6) was run through the repository's own code on 2026-11-07, on
> `m6-gallery` at 244af3a, in a scratch run outside the tree: every brief matched the terms and the preset the table
> states, every design passed 78 of 78 required checks with no lint error, and each one rebuilt from its own parameters
> to the same spec id. Task 6.0 (R6-57) repeats that run as a test before any other task.

Status: draft for the owner's approval, 2026-11-07.

Section 2 lists the owner's standing rulings and the controller's decisions of 2026-11-07. Section 3 turns each decision
into rulings R6-01 to R6-60, and section 14 holds 169 cases (93 `C-` cases and 76 `F-` cases). A ruling ends with
**(decision X#)** when it states a controller decision, or **(drafter)** when this spec supplies a rule the decisions
leave open; a ruling that does both says which part is which. The owner can overturn any ruling by editing this file
before the task that uses it starts. Task 6.0 (R6-57) probes every external fact this spec could not verify before any
other task, in six probes, and says what happens when a probe fails.

## 1. Purpose and scope

M5 made dyelot move. M6 finishes it for a visitor who arrives cold: a gallery of 24 original design systems, each one a
link the studio opens and rebuilds, each with its own share card; a landing page that starts a design from a color, a
brief, an image or the gallery, and explains the receipt in one screen; an `/about` page that says how the math works,
what leaves the browser and whose work dyelot builds on; Lighthouse in the test suite, which fails the build when an
accessibility score drops below 95, and a measured performance record of the deployed site; and the fixes earlier
milestones deferred to M6 (umbrella section 14: M6 is done when it is deployed with the owner's OK and its live flows are
checked).

```text
src/features/gallery/defs.ts: 24 rows, 6 heroes by index and 18 briefs, each with a slug, a name, tags and a seed
  hero row  --heroSpec(i)------------------------------------------------------------------> spec ("controls")
  brief row --briefColors (none) --matchLexicon(rest)--> draft --briefChange(draft, { params: fresh + name + one-liner })
            --applyPreset, mergeParams--> generateSystem(resolveParams(params, seed), seed, { createdWith: "lexicon" }) --> spec
  spec --galleryEntry--> { slug, name, line, tags, preset, lot, link, summary, specimen, scales, roles, type ladder }
galleryData(ai) == gallery.json (committed; C-GAL6-02 rebuilds and compares; DYELOT_UPDATE_GALLERY=1 rewrites, never with CI)
gallery.json --galleryCards--> cards.json (committed: a strip of five hexes and a count per slug)
receipt.json of buildBundle(heroSpec(0)) --receiptExcerpt--> receipt-excerpt.json (committed, the same switch)

server, per request, no engine: gallery.json --> /gallery[?tag=<tag>], /gallery/<slug>, sitemap.xml
                                cards.json  --> /gallery/opengraph-image, /gallery/<slug>/opengraph-image (PNG)
                                receipt-excerpt.json --> the receipt section of "/"
"/" start-from (client, no engine): color --colorHref--> /studio#color=f66c6d | brief --briefHref--> /studio#brief=<text>
                                    /studio#start=image | /gallery
/studio first load: "#s=" --readHash--> a loaded design, its preset and that preset's view
                    "#color=" "#brief=" "#start=" --readEntry--> a fresh design, then the normal "#s=" link 300 ms later
tests/e2e/lighthouse-m6.spec.ts: next start --Playwright's Chromium + Lighthouse 13.5.0--> 8 routes x 2 form factors, a11y >= 0.95
scripts/audit-site.mjs: https://dyelot.vercel.app --3 interleaved runs--> medians, first-byte times, chunk sizes --> README
```

| Task | Delivers |
|---|---|
| 6.0 | The probes of R6-57, before anything else |
| 6.1 | Gallery data: `defs.ts`, the builder, `gallery.json`, `cards.json`, the receipt excerpt, the update switch |
| 6.2 | The gallery pages: `/gallery` with its mood filter, `/gallery/[slug]`, "Copy the studio link" |
| 6.3 | Share cards: one per entry and one for `/gallery` |
| 6.4 | `/about` |
| 6.5 | The studio's entry hashes, and the view a loaded design opens with (decision G6) |
| 6.6 | Landing polish: the start-from section, the receipt section, the nav and the sitemap |
| 6.7 | Lazy templates and the settings template's clip margin (decisions G1, G2) |
| 6.8 | Accessibility fixes: the Player's text alternative, the two "Pause" names, the explorer's restart focus, FlatView's ids (G3, G5) |
| 6.9 | Code fixes: `codeFiles`, `loadOnce` for the three loaders, the export's shared guards, `storySteps` and `tokenRow` (G4, G5) |
| 6.10 | Audits: Lighthouse in the end-to-end suite, the audit script and its pure core |
| 6.11 | Composed flows: axe and Lighthouse on every new page, the laziness and security pins, the guards |
| 6.12 | Close M6: the deployed audits, the hand check after the merge, the README, the knowledge graph, the umbrella notes |

Task 6.2 builds on 6.1, 6.3 on 6.1, 6.6 on 6.2, 6.4 and 6.5, and 6.11 on 6.2 to 6.10; the plan sets the lanes.

M6 does not deliver the Sanzo Wada combinations, a model-made gallery, a share card for an arbitrary studio link, a
short-link service, each family's italic font files, larger chrome text, launch or marketing copy, or the end of
"(experimental)" on the on-device switch. Section 18 assigns each.

### Where this spec refines the umbrella

| Umbrella | This spec | Why |
|---|---|---|
| §1 Goal 1: start from "a curated system" | The gallery's 24 original systems: the six M5 hero designs and 18 made from one-sentence briefs by the M4 word list, with no model (R6-05, R6-06) | Original work is the product's difference, and the word list makes them with zero model calls |
| §3 The server makes "share-card images" | A share card for each gallery entry and one for `/gallery`; a studio link keeps the site's card (R6-18 to R6-20) | The hash never reaches a server, and a link of about 7 KB in a query exceeds safe scraper lengths |
| §5 Generators: "the Sanzo Wada combinations" (M1 moved them to M6) | Not scheduled: the rights check was not clean (R6-02) | The owner's rule: add only if clean, else drop |
| §7 `/`: "the receipt explained in one screen, entry points: start from a color, a brief, an image, or the gallery" | The start-from section and the receipt section (R6-27 to R6-29); the studio reads `#color=`, `#brief=` and `#start=image` (R6-23 to R6-25) | M5 left both to M6 |
| §7 `/gallery`: "Curated original systems and the Sanzo Wada combinations; any card opens in the studio" | 24 original systems in six mood tags; every card opens in the studio as a design it can rebuild (R6-05, R6-10, R6-13) | No Wada (R6-02) |
| §7 `/about`: "the math, the receipt, the licenses, the privacy note for in-browser video" | Also AI and privacy: what reaches OpenRouter, what is traced, what stays on the device (R6-21) | M4 left the AI privacy page to M6 (04-ai.md section 18) |
| §8 State: the link in the hash opens a loaded design | A loaded design takes `presetOf(spec)` as its preset, and the first load shows that preset's mode and density, as a draft does (R6-26) | M2 deferred the draft's view settings to M6, and a gallery card should open as its card shows it |
| §13 UI and flows: "axe finds no violations on every route" | Also Lighthouse's accessibility score of at least 95 on every public route at desktop and mobile, gated in the end-to-end suite (R6-44) | The umbrella's M6 row names the number |
| §14 M6 done when: "Deployed with the owner's OK; live flows checked" | The owner's merge-when-green ruling is the OK; section 20 lists the live checks (R6-58) | The owner's ruling of 2026-11-04 |
| §16 Bundle weight: heavy code loads only where it is needed | Also the canvas templates load one at a time (R6-33); the chunk sizes of every route are measured and recorded (R6-48) | M2 deferred lazy templates (M-12); M5 deferred the real chunk sizes (R5-64) |

### Where this spec departs from the controller's decisions

| Decision | This spec | Why |
|---|---|---|
| F1: Lighthouse "run with `CHROME_PATH` set to Playwright's Chromium" | The flow launches Playwright's Chromium itself, with a debugging port, and passes that port to Lighthouse's Node API (R6-44) | The Node API launches no browser; `CHROME_PATH` is read only by `chrome-launcher`, a dependency of Lighthouse that pnpm does not let the repository import, and the decisions allow no other new package |
| G4: "every guard that walks `src` asserts a positive file count" | `codeFiles` itself throws for a missing folder, an unreadable one and a folder with no code file, so every walk is positive by construction; a probe folder that vanishes mid-walk is skipped (R6-39) | One check in the helper covers every caller, the next guard included; a per-call count can be forgotten |
| G6: drafts restore the preset's view settings | Also a link: a loaded design's preset is `presetOf(spec)`, and the first load shows that preset's mode and density (R6-26); C-HASH-16 changes (section 16) | Without it a gallery card for a dark preset opens on a light canvas, and the studio's preset select reads "Custom" for a design the card names |
| C1: entry forms are "read once on load and then replaced by the normal `#s=` link after the first commit" | The entry's load counts as that first commit: 300 ms after load the hash is the normal link and the draft holds the design; `#brief=` and `#start=image` open a fresh design too (R6-24) | A design opened from the landing has no commit until the visitor edits it; without this a reload of `#color=` would make another design with a new seed |
| G2: "the top and save bars use `overflow: clip` with `overflow-clip-margin`" | The clip moves to `.st`, the bars' clipping ancestor (the bars themselves clip nothing); the save bar also sits inside `.st-scroll`, a scroll container, where a clip margin does nothing; probe 6 decides, and a failure drops G2 to section 18 (R6-34) | M3 found that `overflow: clip` on the settings page left axe's contrast check undecided (R3-06), and a scroll container cannot take a clip margin |
| J1: five probes | Six: probe 6 is the settings template's clip margin (R6-57) | G2 has the one external behavior M3 already saw fail |

## 2. Decisions M6 implements

**The owner's standing rulings (2026-11-04 to 2026-11-06).**

- **Spec before code.** This spec is approved before any plan or code.
- **Merge when green.** Once `pnpm gate:full` and CI pass, the pull request merges without a further stop, and the owner
  is told. Main deploys to `https://dyelot.vercel.app`, so the merge is the deploy.
- **Parallel lanes.** The owner chose parallel lanes and lighter per-task test runs in M3, and that style carries into
  M6. Each lane runs its end-to-end suite on a port of its own with `reuseExistingServer: false`.
- **The speed-ups of 2026-11-06, kept for M6.** After a clean rebase a lane re-gates with lint, typecheck, `test:fast`
  and its own end-to-end files; only a conflicted rebase re-runs its full gate, and each task's first gate stays full for
  a UI task. The last waves overlap: composed-flow tasks (6.11) start before the final feature task lands. The close
  drafts the README and the knowledge graph in parallel with the final review and CI.
- **The gallery.** Original curated systems; the Sanzo Wada sets only if a license check in M6 comes back clean, else
  dropped (2026-11-04). The check was not clean (decision A2).
- **No secret.** M6 sets no Vercel variable and holds no key.

**The controller's decisions (2026-11-07)**, A to L, are stated by the rulings that cite them, and section 1's second
table lists where this spec departs from them.

**Constraints for every task.** Spec-TDD: each case's test first, red, then code, then green, each test named with its
case id. R-05 in every pure module and every helper this spec names: a wrong type is a `TypeError`, an out-of-domain
value a `RangeError`, each message starting with the function's name, and every argument's type is checked before any
value's domain. Pure core and imperative shell: `src/engine`, `src/spec`, `src/theme`, `src/export` and `src/ai` read no
DOM, storage, network, clock, randomness, environment, locale or Web Crypto, and the pure helpers this spec adds under
`src/features/` and `scripts/` read none either; everything that touches the DOM, a timer, a file or a browser is a
shell. The UI never shows a raw error (I-M2-03). Every zod schema imports `z` from `src/spec/zod.ts`. App code reaches
`@/export`, `@/import` and `@/ai` only through `import()` (C-GUARD3-01, C-GUARD4-03); a builder that needs `@/ai` takes the
module as an argument. Copy is American English with no emoji, no exclamation mark and none of the words simply, just,
easy, obviously or basically; no copy names the perceptual score's formula by its trade name, and no copy names a host of
`knowledge/infrastructure/infra-never-use-hosts.md`. No gallery entry's name, slug, brief or tag holds a brand, company,
product or trademark name. A flow asserts state (data attributes, which sentence shows, which chunks loaded, a score in a
report), never frame counts or timing. No test touches the network (R4-58), except the audit script of R6-46, which is not
a test. Property cases use fast-check with the seed 6000 plus the task number. Nothing calls `flushSync` inside a
transition, and no `<video>` element exists (R5-02).

## 3. Rulings

### Scope and layers (every task)

**R6-01 · What M6 delivers.**

| Piece | Where | Data it reads | Runs the engine per request |
|---|---|---|---|
| Gallery | `/gallery`, `/gallery?tag=<tag>` | `gallery.json` | No |
| Gallery entry | `/gallery/<slug>` | `gallery.json` | No |
| Share cards | `/gallery/opengraph-image`, `/gallery/<slug>/opengraph-image` | `cards.json` | No |
| Start-from section | `/`, under the hero | Nothing; the forms build links on the client | No |
| Receipt section | `/`, after the story | `receipt-excerpt.json` | No |
| About | `/about` | The copy table of 11.2 | No |
| Entry hashes | `/studio#color=`, `#brief=`, `#start=image` | The hash | In the browser, as any fresh design |
| Audits | `tests/e2e/lighthouse-m6.spec.ts`, `scripts/audit-site.mjs` | The pages | Not part of the product |

Done when section 20 holds. **(decision A1)**

**R6-02 · Out of M6.** The Sanzo Wada combinations are dropped: the rights check of 2026-11-07 came back unclear and
leaning not clean. The 1933 and 1934 volumes are likely under US copyright through 2028 and 2029 by URAA restoration, the
selection and ordering of the 348 combinations is the part a court could protect, and no MIT-labeled dataset documents its
provenance or a rights check (the controller's research of 2026-11-07, from the US Copyright Office's Compendium,
section 313.4(K), 17 USC 104A and the datasets' own READMEs; the README's credits record the outcome at the close, R6-50;
owner approval item 1). Also out: a gallery of 100 to 200
model-made briefs (AI02; M6 makes no model call), a share card for an arbitrary studio link (the hash never reaches a
server, and a 7 KB link in a query exceeds safe scraper lengths; Vercel answers 414 above 14 KB), a short-link service
(umbrella §15: no server-side storage of designs), each family's italic font files, larger chrome text than 11 px,
launch or marketing copy, and the end of "(experimental)" on the on-device switch (it needs the owner's eval record).
Section 18 assigns each. **(decision A2)**

**R6-03 · Layers.**

- Pure, in `src/features/gallery/`: `defs.ts` (the 24 rows), `tags.ts`, `data.ts`, `cards.ts`, `links.ts` (no engine,
  spec or export at run time) and `build.ts` (the builder: engine and spec, and `@/ai` as an argument). The helpers join
  `GALLERY_HELPERS` at the pure floors (section 15).
- Pure, in `src/features/landing/`: `receipt.ts` (the excerpt) and `start.ts` (the start-from links), both with no engine,
  spec or export; they join `LANDING_HELPERS`.
- Pure, in `src/features/about/`: `copy.ts` (the copy table of 11.2), in `ABOUT_HELPERS`.
- Pure, in `src/features/studio/`: `readEntry` in `url.ts` and `presetView` in `view.ts` (already in `STUDIO_HELPERS`).
- Pure, in `src/features/preview/templates/load.ts`: the loaders and the idle preload (in `PREVIEW_HELPERS`).
- Pure, in `src/export/guards.ts`: `describeType` and `httpsOrigin` (in the export floor).
- Pure, in `scripts/audit-core.mjs`: the audit's arithmetic, with `// @ts-check`.
- Shells: the pages `src/app/gallery/page.tsx`, `src/app/gallery/[slug]/page.tsx` and `src/app/about/page.tsx`; the image
  routes `src/app/gallery/opengraph-image.tsx` and `src/app/gallery/[slug]/opengraph-image.tsx`; the components
  `src/features/gallery/{GalleryCard,Specimen,CopyLink}.tsx`, `src/features/landing/{StartFrom,ReceiptSection}.tsx` and
  `src/lib/site/gallery-card.tsx`; `scripts/lighthouse.mjs` and `scripts/audit-site.mjs`; and edits to the studio, the
  preview, the flavor dialog and the explorer.

No page or image route runs `generateSystem`, `lintSpec` or `measureSpec` for a gallery entry per request. **(decision
A3; the file list drafter)**

**R6-04 · Committed data and the update switch.** `gallery.json` and `cards.json` (in `src/features/gallery/`) and
`receipt-excerpt.json` (in `src/features/landing/`) are committed, written as R3-11 writes JSON
(`JSON.stringify(value, null, 2)` and one newline), and checked against their builders in every unit run:
`GALLERY` must deep-equal `galleryData(ai)` (C-GAL6-02), `GALLERY_CARDS` must deep-equal `galleryCards(GALLERY)`
(C-CARD6-02), and `RECEIPT_EXCERPT` must deep-equal `receiptExcerpt(<receipt.json of buildBundle({ spec: heroSpec(0),
origin: "https://dyelot.vercel.app" })>)` (C-REC6-02). With `DYELOT_UPDATE_GALLERY=1` the three tests write their files
instead, and each fails before writing when `CI` is set, as C-LAND5-02 does for `hero-cards.json`. When the engine's output
changes, the goldens, `hero-cards.json` and these three files change together. **(decision A3; the second and third file
drafter)**

### Gallery data (Task 6.1)

**R6-05 · The 24 entries.** Section 6 is the table: the six M5 hero designs of R5-31, by index, then 18 designs made from
one-sentence briefs, in `PRESET_IDS` order of the preset each brief chose. The 18 cover every one of the 14 presets at
least once (the six heroes match no preset, 6.3), and the six mood tags each hold at least four entries. Names are dyes,
pigments and minerals; slugs are the names in lowercase with a hyphen for a space. **(decision B1; the briefs, names,
slugs, seeds and tags drafter; owner approval item 2)**

**R6-06 · How a brief entry is built.** `briefSpec(def, ai)` runs the studio's own rule-based path, as a visitor would who
types a name and a one-liner in About, writes the brief in Brief and presses "Read the brief" with no model answering:

1. `ai.briefColors(def.brief)` must find no color (its `seeds` empty), so the literals are `[]`, as the studio would pass.
2. `ai.matchLexicon(rest)` must match at least one term; its `draft` is not null.
3. `base` is `mergeParams(freshParams(), { name: def.name, oneLiner: def.brief })`.
4. `ai.briefChange(draft, { params: base, literals: [] })` gives `{ preset?, patch }`.
5. `params` is `mergeParams(preset === undefined ? base : applyPreset(base, preset), patch)`, as `applyAi` composes it.
6. The spec is `generateSystem(resolveParams(params, def.seed), def.seed, { createdWith: "lexicon" })`, as the studio's
   worker runs a request (R4-37).

The brief rides as the design's one-liner, so the export's `DESIGN.md`, the brand video and the receipt carry it. A brief
that fails step 1 or 2 is a `RangeError` naming `briefSpec` and the slug. `ai` is the `@/ai` entry, passed in: the
builder imports `@/ai` with `import type` only, so app code still reaches the AI core only through `import()` (R4-04).
**(decision B1; the one-liner and the injected module drafter)**

**R6-07 · Mood tags.** `GALLERY_TAGS` is `["calm", "bold", "editorial", "technical", "playful", "natural"]`, frozen.
Each entry carries one or two tags, in that order, never one twice. `readTag(value)` reads `?tag=`: `undefined` is
`"all"`; a string equal to a tag is that tag; any other string, the empty string, and an array (a repeated `tag`) are
`"unknown"`. The filter runs on the server; there is no client filter state. **(decision B2; the six names drafter)**

**R6-08 · What an entry holds.** Each entry of `gallery.json` holds, for its spec: `slug`, `name`, `source` (`"hero"` or
`"brief"`), `line` (the brief, or for a hero "One locked seed, <primary hex>, and the studio's defaults."), `brief` (the
brief, or null), `terms` (the matched terms in text order, or `[]`), `tags`, `preset` (`presetOf(spec)`), `presetLabel`
(`PRESETS[preset].label`, or "Custom" for null, the studio's word), `specId`, `lot` (`lotTag(specId)`), `createdWith`,
`link` (`encodeSpec(spec)`, with no prefix), `summary` (`summarize(measureSpec(spec), lintSpec(spec),
spec.color.params.gamut)` as the receipt writes it), `families` (the catalog family names of display, body and mono),
`specimen` (primary, secondary, accent, neutral and danger, the brand video's five rows (6.5 of M5), each at steps 100,
300, 500, 700 and 900 in light mode), `scales` (the eight palettes' eleven hexes in each mode), `roles` (the six roles of
the story, 7.2 of M5, in each mode) and `type` (the ten steps, each with its size, line height and family role). Every hex
is lowercase `#rrggbb`. **(decision B3, B4; the fields drafter)**

**R6-09 · The share cards' data.** `galleryCards(data)` projects each entry to `{ slug, name, line, strip, passed,
required }`: `strip` is the five specimen palettes at step 500, and `passed` and `required` are
`summary.contrast.requiredPass` and `summary.contrast.required`. `cards.json` holds that projection; the image routes read
it and nothing else, so the large `gallery.json` never enters an image route's bundle (D1's 500 KB limit, probe 2).
**(decision D1; the projection drafter)**

**R6-10 · Loaded, rebuildable, never blocked.** No code change: a gallery link opens as a loaded design (R3-42), and every
entry passes every required check with no lint error, so `exportState` is `"passing"` and the export is never blocked,
whatever the provenance. `paramsOfSpec` reads `meta.createdWith` from the spec, the store keeps it, and "Rebuild" or any
regeneration stamps `"lexicon"` again (`regenerated`, R4-37). For every entry, decoding `link`, then
`generateSystem(resolveParams(paramsOfSpec(spec).params, spec.meta.seed), spec.meta.seed, { createdWith:
spec.meta.createdWith })`, gives the same spec id (C-GAL6-05), and the flow F-GAL6-06 opens a card in the studio and
downloads its export. **(decision B5: the verification, with the smallest change, none)**

**R6-11 · The receipt excerpt.** `receiptExcerpt(text)` reads the text of a `receipt.json` and keeps: `format`, the
design's `name`, `summary` as it is, `checks` (the length of `contrast`), `contrast` (its first entry) and `finding` (the
first entry of `findings`, or null). For the first hero design that is "C1:foreground/background" in light mode and the
`D3` warning on `primary-600` in dark mode (2026-11-07). `RECEIPT_EXCERPT` is the committed result (R6-04). **(decision
C2; the fields drafter)**

**R6-12 · The entries' words.** Each name is 1 to 24 characters of letters and single spaces; each slug matches
`^[a-z]+(-[a-z]+)*$` and is unique; each brief is plain text of 30 to 100 characters, one sentence ending in a period,
with no color literal; each hero's line is computed. No name, slug, brief or tag holds a word of the M4 deny list
(`tests/unit/ai/lexicon-deny.ts`, R4-42), and each passes the copy rules. No entry's link spells, in any case, the
perceptual formula's trade name, which C-CONTRAST-12 of M1 forbids in every text file under `src/`, `.json` included: a
base64url link of about 7,000 characters spells a given four letters, in any case, by chance in about one link of 150,
and the first name tried for row 18, "Umber", did (2026-11-07), so the row is "Sepia". When an engine change makes a
link spell it, that entry's seed takes the suffix `-2` and section 6 says so. The cards also show the font families'
names and the preset's label as the catalog and the preset table hold them (section 19). **(decision B1; the bounds
drafter)**

### Gallery pages (Task 6.2)

**R6-13 · `/gallery`.** A server page in `PageFrame active="gallery"`, with `pageMetadata` (7.1). It reads
`await searchParams`, filters with `readTag` and `entriesTagged`, and renders the intro, the filter (a `nav` of seven
plain links, "all" and the six tags, `aria-current="page"` on the active one), the count line and the cards in `defs.ts`
order. An unknown tag shows every entry and a sentence that does not repeat the query (7.1). **(decision B2, B3; the copy drafter)**

**R6-14 · The card.** Each card is an `article` named by its `h2` (the entry's name) holding, in order: the line; the
tags; the specimen (7.3), framed, the only color on the page; the type pairing's display and body family names; the preset
label; the receipt line `summaryLines(summary)[0]` ("78 of 78 required contrast checks pass"); the lot; and two links,
"Open in the studio" (`/studio#s=<link>`) and "Details" (`/gallery/<slug>`), each with the name in its accessible name
(7.2). The chrome stays achromatic; every number is Geist Mono with tabular numerals. **(decision B3; the order and the
names drafter)**

**R6-15 · `/gallery/[slug]`.** A server page that awaits `params`, looks the slug up with `entryOf` and calls `notFound()`
for an unknown one, so the 404 page answers. It shows the name, how it was made, the tags, the preset, the lot,
the receipt summary (all four of `summaryLines`), the scales in light and dark, the six roles in each mode, the type ladder
by family name, the links "Open in the studio", "Open in the explorer" and "Open in the motion lab" (`/<page>#s=<link>`),
"Copy the studio link", and a link back to the gallery (7.4). It loads none of the design's fonts. **(decision B4; the
layout drafter)**

**R6-16 · Copy the studio link.** A client component taking only the entry's absolute studio link, built on the server as
`<SITE origin>/studio#s=<link>`. A press writes it with `navigator.clipboard.writeText`; success says "Copied the studio
link."; a refusal shows the link in a read-only field, selected, with "Copy blocked. Select the link below." (M2's
words), as the studio's own "Copy link" does. **(decision B4; the words drafter)**

**R6-17 · Metadata.** `/gallery` takes `pageMetadata(SITE, "/gallery", ...)` (7.1); each entry takes
`generateMetadata` built by `entryMetadata(entry)`, whose title is the name and whose description is "<line> <passed> of
<required> required contrast checks pass." (50 to 160 characters for every entry, C-GAL6-11), with the canonical
`/gallery/<slug>`. The image is the segment's `opengraph-image.tsx` (R6-18); Next copies it to `twitter:image`.
**(decision B4, D1; the description drafter)**

### Share cards (Task 6.3)

**R6-18 · One card per entry.** `src/app/gallery/[slug]/opengraph-image.tsx` exports `size` (1200 × 630),
`contentType` `"image/png"` and `alt` `GALLERY_CARD_ALT` (a file's `alt` is one string for every slug,
`NDOCS/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md`), awaits `params`, finds the card with
`cardOf` (an unknown slug calls `notFound()`), and returns `new ImageResponse(<GalleryShareCard card={card} icon={icon}
/>, { ...size, fonts })` with `shareCardAssets()`'s Geist Mono and icon. The card (8.1) has the M0 card's look: the dot
grid, the brand row, a `//` comment line, the name as the headline, the line, the strip of five colors, the receipt count
and the footer.
Flexbox only, inline styles, no `display: grid` (Satori). The route imports `cards.ts`, `gallery-card.tsx`, `assets.ts`
and `next/og` and nothing else of the app (C-GUARD6-07). It lives under `/gallery/`, never `/api/`, so robots allow it.
**(decision D1; the layout drafter)**

**R6-19 · The gallery's card.** `src/app/gallery/opengraph-image.tsx` draws the brand row, `// gallery`, the headline "24
design systems, each with its receipt" with "receipt" in madder, and a mosaic of the 24 strips in four rows of six
(8.2). **(decision D1; the layout drafter)**

**R6-20 · Studio links keep the site's card.** `/studio#s=...` shares the M0 card: the hash never reaches a server, so no
per-design card exists for it. This refines umbrella §3 (section 1). **(decision D2; owner approval item 3)**

### About (Task 6.4)

**R6-21 · `/about`.** A server page in `PageFrame active="about"` with `pageMetadata(SITE, "/about", ...)`: a prompt, the
`h1` "How dyelot works", an intro, and four sections, each an `h2` with its paragraphs: "The color math", "The receipt and
the checker", "AI and privacy" and "Licenses". Every sentence is in the copy table of 11.2, which names the ruling each
fact restates; the page renders `ABOUT_SECTIONS` and holds no other prose. Its end-to-end file is
`tests/e2e/about-page.spec.ts`, since `tests/e2e/about.spec.ts` holds M3's About fields. **(decision E1, E2; the copy
drafter)**

**R6-22 · No analytics, verified.** No package of `package.json` is an analytics, error-reporting or advertising client,
no file under `src` names one of their hosts, and the CSP's `connect-src` names only `'self'`, `https://openrouter.ai` and
`https://www.remotion.pro` (R5-58), so `/about`'s sentence "dyelot has no analytics" holds by construction (C-GUARD6-09).
**(decision E1's "verify"; the guard drafter)**

### Studio entry hashes (Task 6.5)

**R6-23 · Three entry forms.** `readEntry(hash)` reads the hash on the studio's first load, beside `readHash`:

| Form | Valid when | Gives |
|---|---|---|
| `#color=<value>` | `value` is exactly six hex digits, either case | `{ kind: "color", seed }`, the color as an OKLCH seed through `normalizeSeed` |
| `#brief=<value>` | `value` has at most 6,000 characters, `decodeURIComponent(value)` succeeds, and `toPlainText(decoded, 500)` is neither null nor truncated | `{ kind: "brief", text }`, the cleaned text |
| `#start=<value>` | `value` is `image` | `{ kind: "image" }` |

A hash with one of the three prefixes that is not valid is `{ kind: "malformed" }`; any other hash, `#s=` included, is
`{ kind: "none" }`. A `+` in a brief stays a `+` (the hash is not a query). The forms are read on the first load only: a
later `hashchange` to an entry form changes nothing, as `loadFromHash` ignores a hash that is not `#s=`. **(decision C1; the
grammar drafter; owner approval item 5)**

**R6-24 · What the store does with an entry.** On the first load an entry outranks the draft, as a link does:

- `color`: a fresh design with the primary locked at the color: the params `{ ...freshParams(), primary: <the color's
  OKLCH> }`, the generator's seed from `newSeed()`, preset `"default"`, provenance `"generated"`, `createdWith`
  `"controls"`.
- `brief` and `image`: a fresh design, as the store's `fresh()` makes one, and `entry` holds `{ kind: "brief", text }`
  or `{ kind: "image" }` until the studio takes it with `takeEntry()`. The shell then opens the inputs drawer when the inputs panel is
  a drawer (below 1024 px), and puts the text in the Brief box and focuses it, or focuses the Image section's "Choose an
  image" input. Nothing runs: no model, no word list, no worker, until the visitor presses "Read the brief" or chooses a
  file.

In all three the load counts as the first commit: the store schedules its persist at once, so 300 ms later the hash is the
normal `#s=` link of the shown design and the draft holds it. **(decision C1; the fresh base and the persist drafter, a
departure in section 1)**

**R6-25 · A malformed entry.** The studio opens a fresh design and shows the link notice of a damaged link: "This link is
damaged or cut short, so the studio cannot open it." and "The studio opened a fresh design instead." (`bannerFor({ kind:
"link", reason: "corrupt", fallback: "fresh" })`, M2's words). As with a bad link, nothing is persisted until the first
commit. **(decision C1)**

**R6-26 · A loaded design's preset and view.** `snapshotOf(spec, draft)` without a matching draft gives the preset
`presetOf(spec)` instead of null, so a gallery card's preset shows in the select. On the first load, the view is
`presetView(DEFAULT_VIEW, snapshot.preset)`: the preset's mode and density, or `DEFAULT_VIEW` for null; this covers a
draft (with its stored preset), a link and an entry's fresh design. A later `hashchange` load keeps the view the visitor
has. **(decision G6 for drafts; the link half drafter, a departure in section 1)**

### Landing polish (Task 6.6)

**R6-27 · The start-from section.** Between the hero and `start.log`, a `TerminalWindow` titled `start-from.log` holds
four groups, each an `h3` under the section's `h2` "Start a design from": a color (a form with a color input and a submit),
a brief (a form with a textarea of at most 500 characters, a counter and a submit), an image (a link to
`/studio#start=image`) and the gallery (a link to `/gallery`). Section 9.1 fixes every string. **(decision C1; the layout
and copy drafter)**

**R6-28 · The forms build links with no engine.** `StartFrom.tsx` is a client component; a submit calls `colorHref(hex)`
or `briefHref(text)` from `start.ts` and then `window.location.assign(href)`, a full load, so the studio reads the hash
on its first load. `start.ts` imports nothing; the static value-import graph of `StartFrom.tsx` reaches no file under
`src/engine`, `src/spec` or `src/export` (C-GUARD6-05). A brief with no letter keeps the page and shows "Write a few words
first." **(decision C1; the full load drafter)**

**R6-29 · The receipt section.** After the story, a server-rendered `section` named by its `h2` "The receipt" shows the
copy of 9.2 with three framed excerpts from `RECEIPT_EXCERPT`, each a `pre` holding `JSON.stringify(part, null, 2)`, and
the checker's command `node scripts/dyelot-check.mjs`. The numbers in its sentences come from the excerpt, not from the
copy. **(decision C2; the copy drafter)**

**R6-30 · The nav.** `AppNav` shows, in order, "home", "studio", "explore", "motion", "gallery", "about" and "github";
`AppNavProps["active"]` becomes `"home" | "explore" | "motion" | "gallery" | "about"`. Below 640 px the links wrap into at
most two rows beside the brand tile, each link stays 32 px tall, the nav grows to fit, and the active mark sits 2 px under
its own link; at 360 px nothing scrolls sideways (9.3). **(decision C3; the wrap drafter)**

**R6-31 · The sitemap.** `SITE.routes.sitemap` becomes `["/", "/studio", "/explore", "/motion", "/gallery", "/about"]`,
and `sitemap()` lists those six and then `/gallery/<slug>` for every entry in `defs.ts` order, 30 absolute URLs in all.
`sitemapEntries(site, more)` takes the extra routes; robots do not change. **(decision C3; the second argument drafter)**

**R6-32 · `start.log`.** It gains "open the gallery" and "open the about page" after "open the motion lab", so the window
keeps one way into every page that shipped (the page's comment, M5). **(decision C3; the lines drafter)**

### Templates (Task 6.7)

**R6-33 · Lazy templates.** `templates/index.tsx` stops importing the six templates. `load.ts` holds one loader per
template, each a `loadOnce(() => import("./<Name>"))`; `Template` renders the shown template through `React.lazy` of its
loader inside a `Suspense` whose fallback is the sentence "Loading the template…" (`role="status"`). After the studio's
first paint, `preloadTemplates(shown, idle)` calls the other five loaders when the browser is idle
(`requestIdleCallback`, else a 1,000 ms `setTimeout`), so a later switch finds its chunk loaded. A switch with motion
allowed stays a transition (the deferred value of R5-46), so a template still loading keeps the old one on screen and the
switch commits once, with one `startViewTransition`; under reduced motion it shows the fallback while it loads. A failed
load shows "This template could not load." and "Try again", which calls the loader again (its failure is forgotten) and
mounts a new lazy component; it never shows a raw error. **(decision G1; the strings and the timeout drafter)**

**R6-34 · The settings template's clip margin.** `.st` takes `overflow: clip` and `overflow-clip-margin: 12px` (the
`canvas.css` pattern) in place of `overflow: hidden`, so the "Show me" outline of `.st-top` and `.st-save-bar` shows whole
at `.st`'s edge; if probe 6 finds the save bar's outline still cut by `.st-scroll`, `.st-save-bar` takes `bottom: 4px`
(the outline's reach) and `.st-scroll` a 4 px bottom padding. If probe 6 finds axe's color-contrast check undecided on the
settings page with either form (as M3 did, R3-06), G2 is dropped to section 18 and `.st` keeps `overflow: hidden`.
**(decision G2; the forms and the fallback drafter, a departure in section 1)**

### Accessibility fixes (Task 6.8)

**R6-35 · The Player's text alternative.** `BrandPlayer`'s wrapper takes `role="figure"`, the name "Brand video preview"
and `aria-describedby` pointing at a visually hidden paragraph that holds `brandDescription(props)` (13.1); the
composition frame stays `aria-hidden` (13.3 of M5). Spec 13.3 of M5 gains a note pointing here. **(decision G3; the role
and the sentence drafter)**

**R6-36 · Two "Pause" names.** The Flavor dialog's two buttons read "Pause the background" and "Pause the video"
(`FLAVOR_LINES["pause-background"]` and `["pause-video"]`); the hero's stays "Pause". **(decision G5; the words drafter)**

**R6-37 · "Restart the 3D view" keeps focus.** Pressing it moves focus to the "Turn" slider, the first of the view's
camera controls, before the button goes away, so focus never falls to the body. **(decision G5; the target drafter)**

**R6-38 · FlatView's ids.** `FlatView` builds its caption's and list's ids with `useId`, so two flat views on one page
never share an id. **(decision G5)**

### Code fixes (Task 6.9)

**R6-39 · `codeFiles` is never vacuous.** `codeFiles(directory, read = readdirSync)` walks the folder itself, one level at
a time, never descends into a folder named `PROBE_DIR`, skips `GUARD3_04_PROBE`, and skips a child folder whose read fails
with `ENOENT` only when it is a probe path; any other read error throws with the path. It throws a `RangeError` naming
`codeFiles` when `directory` is missing or holds no code file, and a `TypeError` for a non-string. **(decision G4, a
departure in section 1)**

**R6-40 · `loadOnce` for the three loaders.** `loadAi`, `loadExport` and `loadImport` become `loadOnce(() =>
import("@/ai"))` and the like; their behavior (once per page, forgotten after a failure) does not change. **(decision G5)**

**R6-41 · The export's shared guards.** `src/export/guards.ts` exports `describeType(value)` (`"null"`, `"array"` or
`typeof`) and `httpsOrigin(origin, caller)` (a `TypeError` for a non-string, a `RangeError` for anything but an `https`
origin with no path, each message starting with `caller`); `bundle.ts` and `flavor.ts` import both and keep their messages
word for word. **(decision G5; the module drafter)**

**R6-42 · `storySteps` and `tokenRow` check shapes.** Each checks, before it reads them, that every section it reads is an
object (or an array where it reads one), and throws a `TypeError` naming itself and the path (`storySteps:
spec.color.params must be an object, got undefined`) instead of a native `TypeError`. **(decision G5)**

### Audits (Tasks 6.10 and 6.12)

**R6-43 · The Lighthouse pin.** Exactly `lighthouse` 13.5.0 as a dev dependency: published 2026-09-18, the newest
release at least two weeks before 2026-11-07 (13.6.0 came out on 2026-10-27, eleven days before), with `engines.node`
`>=22.19`, which Node 22.22 and Node 24 meet. It runs only in tests and local scripts. **(decision F1, J2; the version
drafter)**

**R6-44 · The Lighthouse flow.** `tests/e2e/lighthouse-m6.spec.ts` runs against the end-to-end production server
(`next build` and `next start`, the nonce CSP on). For each route of `AUDIT_ROUTES` (`/`, `/gallery`, `/gallery/madder`,
`/about`, `/studio`, `/explore`, `/motion`, `/connect`) and each form factor (`desktop`, `mobile`), one test calls
`runLighthouse(url, formFactor)` (`scripts/lighthouse.mjs`, 12.1) and fails when `categories.accessibility.score` is
below 0.95, naming each failing accessibility audit. The tests run serially in one worker. The other three categories are
recorded, never gated. **(decision F1; the launch a departure in section 1)**

**R6-45 · What a run records.** Each run writes `test-results/lighthouse/<route name>-<form factor>.json` with the four
category scores, the five metrics of 12.2 and the script bytes of `resource-summary`, and attaches it to the test; the
report itself is not committed. **(decision F1; the record drafter)**

**R6-46 · Performance is measured on the deployed site.** At the close, `node scripts/audit-site.mjs` runs Lighthouse on
`https://dyelot.vercel.app` for every route and form factor, three runs each, interleaved: run 1 visits every route at
both form factors, then run 2 does, then run 3, so no route's runs sit side by side. The README records each median with
the date and the machine's load average. Section 12.3 states goals; a miss is recorded with its cause, never hidden. **(decision F2; the goals drafter;
owner approval item 4)**

**R6-47 · The cost of the nonce CSP.** The same script times the first byte of `/` and `/gallery` against `/robots.txt`,
a static metadata route, in ten interleaved rounds, and the README records each median (12.4). DR-0040 stays binding.
**(decision F3)**

**R6-48 · Real chunk sizes.** The same script loads each route in a fresh Playwright page and sums every script response up
to the `load` event, as decoded bytes and as transferred bytes; the README records both per route (12.4). **(decision F4;
the method drafter)**

### Security (every task)

**R6-49 · No new surface.** No CSP change and no new `connect-src`; no new runtime dependency; the share-card routes are
outside `/api/`; the new pages render per request under the nonce CSP like every page (R4-26), and each answers with the
policy of 12.2 of M5 and no `securitypolicyviolation`. **(decision I)**

### Docs and knowledge (Task 6.12)

**R6-50 · The README.** An M6 section ("The gallery and finishing today (M6)") after M5's; the Lighthouse table and the
chunk sizes, measured only; the status says M0 to M6 are done; the scope and the credits (no Wada, why) updated; the "Not
done in M3" and "Not done in M4" rows rewritten as items land. **(decision H1)**

**R6-51 · The knowledge graph.** `knowledge/products/product-dyelot.md` in the products contract's format; the root and
products indexes count nine products across 16 repositories (the meta-repo README's table lists 15 repositories and no
dyelot row, so the close adds the row); the research index's heading drops "name pending"; `validate_graph.py` passes.
**(decision H2; the README row drafter, owner approval item 9)**

**R6-52 · The umbrella.** `docs/specs/00-design.md` gains an "M6 sync" line in its header and a note starting "Refined in
M6" at each row of section 1's first table. **(decision H3)**

### Repository rules (every task)

**R6-53 · Pins.** Exactly `lighthouse` 13.5.0 (dev). No other new package, runtime or dev. Every M5 pin holds.
**(decision J2)**

**R6-54 · Tests.** Each case's test comes first, red, then green, titled with its id. C-GUARD6-01 checks that every case
id of section 14 of this file has a test (C-GUARD5-01's method with this file's path). The folders
`tests/unit/features/gallery/` and `tests/unit/features/about/` run in `web` (jsdom); `tests/unit/engine/repo-guards-m6.test.ts`
and `tests/unit/scripts/audit-core.test.ts` run in `core`; each unit file runs in one project (C-REPO-M2-06). New pure helpers join vitest's helper lists at the
pure floors (section 15). Property cases use seed 6000 plus the task number. **(decision J2; the placement drafter)**

**R6-55 · Earlier milestones hold.** Every M1 to M5 case passes except the changes of section 16; every golden holds; no
spec id of an earlier fixture changes. **(decision J3)**

**R6-56 · Client imports.** The static value-import graphs of the gallery's client file (`CopyLink.tsx`) and the landing's
client files (`Hero.tsx`, `StartFrom.tsx`) reach no file under `src/engine`, `src/spec` or `src/export`; `gallery.json`,
`build.ts` and `defs.ts` are imported as values only by server files and tests (C-GUARD6-04, C-GUARD6-05). **(decision
A3, C1)**

**R6-57 · Task 6.0, the probes.** Before any other task, each probe runs and its result is recorded here, in the style of
R5-64:

1. **Lighthouse under the nonce CSP.** `lighthouse` 13.5.0's Node API, given the debugging port of Playwright's Chromium
   (12.1), audits `/` of `next build` and `next start` at desktop and mobile. Passes when each run returns all four
   categories with numeric scores and no `runtimeError`, the page logs no `securitypolicyviolation`, and the run takes at
   most 60 s. The probe records each route's baseline accessibility score at both form factors (all eight routes), the
   time of one run, and Chromium's version. Fails when a category is null or a run errors: if the debugging-port launch
   fails, the fallback is Lighthouse's own CLI (`node_modules/.bin/lighthouse`) run by `scripts/lighthouse.mjs` as a child
   process with `CHROME_PATH` set to `chromium.executablePath()` (decision F1's form); if both fail, M6 stops for the
   owner. A baseline below 95 is not a failure of the probe: it becomes a fix in Task 6.11.

   Result (date):

2. **A per-slug share card.** A scratch `src/app/gallery/[slug]/opengraph-image.tsx` reading a scratch `cards.json` of 24
   entries renders `/gallery/madder/opengraph-image` as `image/png`, 1200 × 630, under the nonce CSP. Passes when it
   renders and `next build` reports no image route over the 500 KB bundle limit. The probe records whether Next serves it
   statically (prerendered at build) or per request, its `Cache-Control` header, and its bytes. Fails when the build
   refuses the route or the image does not render: the fallback is a route handler
   `src/app/gallery/[slug]/card.png/route.ts` with the same tree and `metadata.openGraph.images` set by `generateMetadata` (R6-17 then repeats the title,
   description and URL, which an `openGraph` key replaces, `metadata.ts`'s note).

   Result (date):

3. **Lazy templates inside the view transition.** With R6-33's loaders and `Suspense` inside `<ViewTransition>`, in the
   studio after the idle preload: one template switch from the toolbar makes one `startViewTransition` call and the record
   at `ready` holds `::view-transition-group(dyelot-template)` (M5's `VT_RECORD`); with `requestIdleCallback` replaced by
   a no-op, the first load fetches the landing template's chunk and none of the other five (by a marker string per
   template, which the probe records), and a switch to "dashboard" before its chunk arrives still makes one call, after the
   chunk lands. Fails when a switch makes two calls or none: the fallback preloads every template right after the first
   paint (no idle wait) and the probe runs again; if that fails too, the templates stay eager and G1 moves to section 18.

   Result (date):

4. **A lexicon design's link is rebuildable.** In the studio, `/studio#s=<the link of a brief entry>` opens with the
   entry's name and lot; the Receipt section reads passing; the export dialog's "Download" is enabled; "Rebuild from the
   parameters" does not show; pressing Space (regenerate) keeps `meta.createdWith` `"lexicon"`. Fails when the export is
   blocked: M6 stops for a ruling, since R6-10 found no code path that blocks it.

   Result (date):

5. **The 18 briefs build deterministically.** In the `web` project, each brief of section 6 built twice by `briefSpec`
   with the real `@/ai` module gives the same spec id; each matches the terms and the preset of section 6; each passes 78
   of 78 required checks with no lint error. Passes when all 18 hold (the scratch run of 2026-11-07 says they do). Fails
   when one does not: its brief is rewritten until it does, and section 6 and the owner's approval item 2 are amended.

   Result (date):

6. **The settings template's clip margin.** With `.st { overflow: clip; overflow-clip-margin: 12px }` on a scratch
   branch, F-TPL-27's axe runs on the settings template at 1280 and 360 px in light and dark, and decides every
   color-contrast node it decided before (none newly `incomplete`); and with "Show me" on the roles of `.st-top` and
   `.st-save-bar`, each outline lies inside every clipping ancestor's box, `.st-scroll`'s padding box included. Passes
   when both hold. When only the second fails: R6-34's `bottom: 4px` form, and the probe runs again. When the first
   fails: G2 is dropped (R6-34), and section 18 says so.

   Result (date):

**(decision J1; probe 1's fallback, probe 3's markers and probe 6 drafter)**

**R6-58 · The hand check after the merge.** On `https://dyelot.vercel.app`: `/gallery` and `/about` load with no console
error; one card's "Open in the studio" opens the design with its name, lot and preset, and its export downloads;
`/gallery/madder/opengraph-image` fetches as a PNG of 1200 × 630; `/studio#color=f66c6d` opens a design whose primary is
locked at that color and whose hash becomes `#s=` within a second; the audit script's accessibility scores are at least
95 on every route at both form factors. The results go into this spec's close note. **(decision K)**

**R6-59 · Copy.** Every string of sections 7 to 13 follows the copy rules. A unit case checks every exported copy table,
every entry's name, slug, brief and line, and the string literals of the new components (C-GUARD6-08). **(drafter)**

**R6-60 · The case-id guard and the guards' counts.** C-GUARD6-01 reads this file's section 14 as C-GUARD5-01 reads
M5's. Every M6 guard that walks a folder walks it with `codeFiles` (R6-39). **(decision J2)**

## 4. Conventions, invariants and fixtures

### Reading the cases

- **Kind and origin** read as in M5: `pass` or `failure`; `decision` (section 2), `ruling R6-nn`, `RF1` to `RF5`
  (section 17), `added` (a boundary or failure case this spec adds).
- **Layers.** `C-` cases run in Vitest: the `core` project (Node) for `tests/unit/engine/**`, `tests/unit/export/**` and
  `tests/unit/scripts/**`; the `web` project (jsdom) for `tests/unit/features/**` and `tests/unit/site/**`. `F-` cases run
  in Playwright against the production build, at 1280 × 800 unless a row names another size; 360 × 740 is "phone".
- **Case ids.** `C-GAL6`, `C-CARD6`, `C-REC6`, `C-TAG6`, `C-ABOUT6`, `C-HASH6`, `C-STORE6`, `C-START6`, `C-SITE6`,
  `C-TPL6`, `C-FLAV6`, `C-HYG6`, `C-AUD6`, `C-GUARD6`; flows `F-GAL6`, `F-SHARE6`, `F-ABOUT6`, `F-HASH6`, `F-LAND6`,
  `F-NAV6`, `F-TPL6`, `F-FIX6`, `F-LH6`, `F-A11Y6`, `F-LAZY6`, `F-SEC6`. A Review Focus test carries `RF` in its id.
- **Tolerances.** Hex channels ±1 when a pixel is read back from a PNG; Lighthouse scores are compared as the report's
  numbers, never rounded first.

### Invariants

- **I-M6-01 · Committed data is what the builders give.** `gallery.json`, `cards.json` and `receipt-excerpt.json` equal
  their builders' output in every unit run; no page or image route generates a gallery design per request.
- **I-M6-02 · Every gallery design is whole.** Each passes every required check with no lint error, rebuilds from its own
  parameters to the same spec id, and opens in the studio with its export enabled.
- **I-M6-03 · No engine on the client of the new pages.** The gallery's and the landing's client code reach no file of
  `src/engine`, `src/spec` or `src/export` (R6-56).
- **I-M6-04 · Every fallback is a sentence.** A malformed entry hash, an unknown tag, a template that does not load, a
  blocked clipboard: each shows a sentence of this spec, never a raw error.
- **I-M6-05 · Accessibility holds by number.** Every public route scores at least 95 in Lighthouse's accessibility
  category at desktop and mobile, and axe finds no violation at the house tags (`AXE_TAGS` of M5).
- **I-M6-06 · Color only in specimens.** On `/gallery`, `/gallery/<slug>`, `/about` and the new sections of `/`, the only
  colors outside the achromatic chrome and madder are inside `[data-specimen]`.
- **I-M6-07 · M1 to M5 hold.** Every earlier case passes except the changes of section 16, and every golden holds.
- **I-M6-08 · No test touches the network.**

### Fixtures

- `SPEC`, `ORIGIN`, `HERO` and `HERO_PARAMS` are earlier milestones'. `AI` is the `@/ai` entry, imported statically by a
  test (tests are not app code).
- `GALLERY` is the committed data and `DEFS` is `GALLERY_DEFS`; `ENTRY(slug)` is `entryOf(slug)` and `SPEC_OF(slug)` is
  `decodeSpec(ENTRY(slug).link)`. `BRIEFS` are the 18 brief rows and `HEROES` the six hero rows.
- `MADDER` is `ENTRY("madder")`, `KERMES` is `ENTRY("kermes")` (a brief entry with the `editorial` preset) and `TURQUOISE`
  is `ENTRY("turquoise")` (a brief entry with the dark `dark-dev-tool` preset).
- `RECEIPT_TEXT` is the text of `receipt.json` in `buildBundle({ spec: heroSpec(0), origin: "https://dyelot.vercel.app"
  })`.
- `NO_IDLE` (`tests/e2e/flavor-support.ts`) is an init script that replaces `requestIdleCallback` with one that never runs
  its callback; `ABORT_CHUNK(page, marker)` and `VT_RECORD` are M5's.
- `CLIPBOARD_DENY` is an init script that makes `navigator.clipboard.writeText` reject.
- `STORAGE_DRAFT(spec, preset)` is an init script that writes M2's draft record for `spec` with `preset` before the load.
- Every new flow file imports `test` from `tests/e2e/flavor-support.ts`, so the watch fixture fails it on any console
  error, page error, unhandled rejection or `securitypolicyviolation` it does not allow by name.

## 5. Public API of the new modules

### 5.1 The gallery (Tasks 6.1 to 6.3)

```ts
// src/features/gallery/tags.ts (R6-07): pure, imports nothing
const GALLERY_TAGS: readonly ["calm", "bold", "editorial", "technical", "playful", "natural"];   // frozen
type GalleryTag = (typeof GALLERY_TAGS)[number];
type TagChoice = GalleryTag | "all" | "unknown";
function readTag(value: string | readonly string[] | undefined): TagChoice;

// src/features/gallery/defs.ts (R6-05, R6-12): data, imports nothing but ./tags (type)
type HeroDef = { readonly slug: string; readonly source: "hero"; readonly hero: number; readonly tags: readonly GalleryTag[] };
type BriefDef = { readonly slug: string; readonly source: "brief"; readonly name: string; readonly seed: string;
  readonly brief: string; readonly tags: readonly GalleryTag[] };
type GalleryDef = HeroDef | BriefDef;
const GALLERY_DEFS: readonly GalleryDef[];   // section 6's 24 rows, in order, deep-frozen

// src/features/gallery/data.ts (R6-08): types and the committed entries; no engine, spec or export at run time
type SpecimenPalette = "primary" | "secondary" | "accent" | "neutral" | "danger";
type GallerySummary = {
  readonly pass: boolean;
  readonly contrast: { readonly checks: number; readonly required: number; readonly requiredPass: number; readonly advisoryBelow: number };
  readonly separation: { readonly checks: number; readonly below: number };
  readonly gamut: { readonly gamut: "srgb" | "p3"; readonly values: number; readonly outside: number };
  readonly lint: { readonly error: number; readonly warn: number; readonly info: number };
};
type GalleryEntry = {
  readonly slug: string;
  readonly name: string;
  readonly source: "hero" | "brief";
  readonly line: string;
  readonly brief: string | null;
  readonly terms: readonly string[];
  readonly tags: readonly GalleryTag[];
  readonly preset: PresetId | null;
  readonly presetLabel: string;
  readonly specId: string;
  readonly lot: string;
  readonly createdWith: "controls" | "lexicon";
  readonly link: string;                                   // encodeSpec(spec), no "#s=" prefix
  readonly summary: GallerySummary;
  readonly families: { readonly display: string; readonly body: string; readonly mono: string };
  readonly specimen: readonly { readonly palette: SpecimenPalette; readonly hexes: readonly string[] }[];   // 5 rows of 5
  readonly scales: Readonly<Record<"light" | "dark", Readonly<Record<PaletteName, readonly string[]>>>>;   // 8 x 11 each
  readonly roles: Readonly<Record<"light" | "dark", readonly { readonly name: RoleName; readonly hex: string }[]>>;   // 6 each
  readonly type: readonly { readonly name: TypeStepName; readonly sizePx: number; readonly lineHeightPx: number;
    readonly family: "display" | "body" }[];   // 10, caption to display
};
type GalleryData = { readonly entries: readonly GalleryEntry[] };   // 24
const GALLERY: GalleryData;   // ./gallery.json
function entryOf(slug: string): GalleryEntry | null;
function entriesTagged(choice: TagChoice): readonly GalleryEntry[];   // "all" and "unknown" give every entry
function galleryRoutes(): readonly `/gallery/${string}`[];            // in GALLERY_DEFS order
function entryDescription(entry: GalleryEntry): string;              // R6-17, 50 to 160 characters
function entryMetadata(entry: GalleryEntry): Metadata;               // R6-17: title, description, canonical

// src/features/gallery/links.ts (R6-14 to R6-16): pure, imports nothing
type LinkPage = "studio" | "explore" | "motion";
function entryHref(page: LinkPage, link: string): string;            // `/${page}#s=${link}`
function absoluteStudioLink(origin: string, link: string): string;   // `${origin}/studio#s=${link}`

// src/features/gallery/build.ts (R6-06, R6-08): pure; imported as a value only by tests
type GalleryAi = Pick<typeof import("@/ai"), "briefColors" | "matchLexicon" | "briefChange">;   // import type only
function briefSpec(def: BriefDef, ai: GalleryAi): { readonly spec: DesignSpec; readonly terms: readonly string[] };
function galleryEntry(spec: DesignSpec, def: GalleryDef, terms: readonly string[]): GalleryEntry;
function galleryData(ai: GalleryAi): GalleryData;

// src/features/gallery/cards.ts (R6-09): pure, no engine
type GalleryCard = { readonly slug: string; readonly name: string; readonly line: string;
  readonly strip: readonly string[]; readonly passed: number; readonly required: number };   // strip: 5 hexes
type GalleryCards = { readonly cards: readonly GalleryCard[] };   // 24
function galleryCards(data: GalleryData): GalleryCards;
const GALLERY_CARDS: GalleryCards;   // ./cards.json
function cardOf(slug: string): GalleryCard | null;

// src/lib/site/gallery-card.tsx (R6-18, R6-19): Satori-safe, inline styles, flexbox only
function GalleryShareCard(props: { card: GalleryCard; icon: string }): ReactElement;
function MosaicShareCard(props: { cards: readonly GalleryCard[]; icon: string }): ReactElement;   // 24 cards
const GALLERY_CARD_ALT: string;   // 8.1
const MOSAIC_ALT: string;         // 8.2
```

Errors: `readTag` takes `undefined`, a string or an array, and anything else is a `TypeError`. `entryOf`, `cardOf`
take a string (else a `TypeError`) and give null for an unknown slug. `entriesTagged` takes a `TagChoice` (a non-string is a
`TypeError`, another string a `RangeError`). `entryHref` checks `page` (one of the three, else a `RangeError`) and `link`
(a non-empty string of `[A-Za-z0-9_-]` of at most 65,536 characters, else a `RangeError`; a non-string a `TypeError`);
`absoluteStudioLink` also checks `origin` as `httpsOrigin` does, with its own name. `briefSpec` checks `def` (an object
with `source: "brief"` and the fields of R6-12) and `ai` (an object whose three names are functions) before it runs;
`galleryEntry` checks `def.slug` and the spec's sections as `paramsOfSpec` does; `galleryData` is a `TypeError` for an
`ai` that is not an object; `entryDescription` is a `TypeError` for a non-object and a `RangeError` when its text falls
outside 50 to 160 characters, and `entryMetadata` checks its entry as `entryDescription` does; `galleryCards` checks
that every entry's `specimen` holds the five palettes in order. `GalleryShareCard` and `MosaicShareCard` take checked
data and never throw for a card of `GALLERY_CARDS`.

### 5.2 The landing (Task 6.6)

```ts
// src/features/landing/start.ts (R6-27, R6-28): pure, imports nothing
const START_BRIEF_MAX = 500;
const IMAGE_HREF = "/studio#start=image";
const GALLERY_HREF = "/gallery";
function colorHref(hex: string): string;     // "#F66C6D" or "f66c6d" -> "/studio#color=f66c6d"
function briefHref(text: string): string;    // trimmed, 1 to 500 characters, holding a letter -> "/studio#brief=" + encodeURIComponent
function briefReady(text: string): boolean;  // whether briefHref accepts it
const START_LINES: Readonly<Record<string, string>>;   // 9.1, frozen

// src/features/landing/receipt.ts (R6-11): pure, imports nothing at run time (GallerySummary is a type import)
type ReceiptExcerpt = {
  readonly format: "dyelot.check/1";
  readonly name: string;
  readonly checks: number;
  readonly summary: GallerySummary;
  readonly contrast: Readonly<Record<string, string | number | boolean>>;
  readonly finding: Readonly<Record<string, string | number>> | null;
};
function receiptExcerpt(receipt: string): ReceiptExcerpt;
const RECEIPT_EXCERPT: ReceiptExcerpt;   // ./receipt-excerpt.json
function excerptText(part: Readonly<Record<string, unknown>>): string;   // JSON.stringify(part, null, 2)
const RECEIPT_LINES: Readonly<Record<string, string>>;   // 9.2's fixed sentences, frozen
function receiptLines(excerpt: ReceiptExcerpt): readonly string[];   // 9.2's sentences with the excerpt's numbers
```

`colorHref` is a `TypeError` for a non-string and a `RangeError` for anything but six hex digits with or without a leading
`#`. `briefHref` is a `TypeError` for a non-string and a `RangeError` for a text that `briefReady` refuses; `briefReady` is a
`TypeError` for a non-string. `excerptText` and `receiptLines` are a `TypeError` for a non-object, and `receiptLines` a
`RangeError` for counts that are not whole numbers. `receiptExcerpt` is a `TypeError` for a non-string and a `RangeError`
for text that is not JSON, whose `format` is not `dyelot.check/1`, or that lacks `design.name`, `summary`, a non-empty
`contrast` or a `findings` array.

### 5.3 About (Task 6.4)

```ts
// src/features/about/copy.ts (R6-21): pure, imports nothing
type AboutParagraph = { readonly text: string; readonly restates: readonly string[] };   // ruling ids, never shown
type AboutSection = { readonly id: "math" | "receipt" | "privacy" | "licenses"; readonly heading: string;
  readonly paragraphs: readonly AboutParagraph[] };
const ABOUT_INTRO: AboutParagraph;
const ABOUT_SECTIONS: readonly AboutSection[];   // 11.2, deep-frozen
type AboutLink = { readonly label: string; readonly href: string };
const ABOUT_LINKS: readonly AboutLink[];         // 11.3, deep-frozen
```

### 5.4 The studio (Task 6.5)

```ts
// src/features/studio/url.ts (R6-23): pure, additions
type EntryHash = { readonly kind: "color"; readonly seed: Oklch } | { readonly kind: "brief"; readonly text: string }
  | { readonly kind: "image" };
type EntryResult = { readonly kind: "none" } | { readonly kind: "entry"; readonly entry: EntryHash }
  | { readonly kind: "malformed" };
function readEntry(hash: string): EntryResult;

// src/features/studio/view.ts (R6-26): pure, addition
function presetView(view: View, preset: PresetId | null): View;   // the preset's mode and density, else `view` itself

// src/features/studio/store.ts (R6-24): additions
type StudioEntry = { readonly kind: "brief"; readonly text: string } | { readonly kind: "image" };
// StudioState gains: readonly entry: StudioEntry | null;
// StudioActions gains: takeEntry(): StudioEntry | null;   // the entry once, then null
```

`readEntry` is a `TypeError` for a non-string and never throws for a string. `presetView` checks `view` as `mergeView`
does and `preset` against `PRESET_IDS` or null.

### 5.5 The preview and the flavor dialog (Tasks 6.7 and 6.8)

```ts
// src/features/preview/templates/load.ts (R6-33)
type TemplateProps = { readonly spec: DesignSpec; readonly view: View };
type TemplateModule = { readonly default: ComponentType<TemplateProps> };
const TEMPLATE_LOADERS: Readonly<Record<TemplateId, () => Promise<TemplateModule>>>;   // loadOnce each, frozen
type IdleScheduler = (run: () => void) => () => void;   // schedules `run`, returns its cancel
function idleScheduler(win: Pick<Window, "setTimeout" | "clearTimeout"> &
  Partial<Pick<Window, "requestIdleCallback" | "cancelIdleCallback">>): IdleScheduler;
function preloadTemplates(shown: TemplateId, schedule: IdleScheduler,
  loaders?: Readonly<Record<TemplateId, () => Promise<unknown>>>): () => void;   // the other five; returns a cancel
const TEMPLATE_LINES: Readonly<Record<"loading" | "failed" | "retry", string>>;  // R6-33, frozen

// src/features/flavor/video.ts (R6-35, R6-36): additions
function brandDescription(props: BrandProps): string;   // 13.1
// FLAVOR_LINES gains "pause-background" and "pause-video"
```

Each template file gains a default export of its component (the named export stays for its tests). `preloadTemplates` is a
`RangeError` for a `shown` outside `TEMPLATE_IDS` and a `TypeError` for a `schedule` that is not a function; a loader that
fails is not retried by the preload (the next switch tries it). `brandDescription` checks `props` as `brandProps`' output:
`name`, `oneLiner` and `lot` strings, `fonts` an object of two strings, `checks` two whole numbers, `palettes` an array
of five; else a `TypeError` or
`RangeError` naming `brandDescription`.

### 5.6 Code fixes and audits (Tasks 6.9 and 6.10)

```ts
// tests/unit/engine/guard-support.ts (R6-39)
function codeFiles(directory: string, read?: typeof readdirSync): string[];   // non-empty, or it throws

// src/export/guards.ts (R6-41): pure, internal to src/export
function describeType(value: unknown): string;
function httpsOrigin(origin: unknown, caller: string): string;

// src/lib/load-once.ts: unchanged; loadAi, loadExport and loadImport use it (R6-40)
```

```js
// scripts/audit-core.mjs (R6-44 to R6-48): pure, // @ts-check, imports nothing
export const AUDIT_ROUTES;      // ["/", "/gallery", "/gallery/madder", "/about", "/studio", "/explore", "/motion", "/connect"]
export const FORM_FACTORS;      // ["desktop", "mobile"]
export const A11Y_FLOOR;        // 0.95
export const CATEGORIES;        // ["performance", "accessibility", "best-practices", "seo"]
export function routeName(route);                // "/" -> "home", "/gallery/madder" -> "gallery-madder"
export function categoryScores(lhr);             // { performance, accessibility, "best-practices", seo }, each 0 to 1
export function auditRecord(lhr);                // R6-45's record: scores, the five metrics, script bytes
export function a11yFailures(lhr);               // ids of accessibility audits with score below 1 and weight above 0
export function a11yVerdict(lhr);                // { pass: score >= A11Y_FLOOR, score, failures: a11yFailures(lhr) }
export function auditPlan(routes, formFactors, runs);   // interleaved: [{ run, route, formFactor }], R1 then R2 then R3
export function median(values);                  // the middle value; the mean of the two middle ones for an even count
export function ttfbPlan(paths, rounds);         // [{ round, path }], each round every path in order
export function scriptTotals(responses);         // { files, bytes, transferred }
export function auditTable(rows);                // README markdown, 12.4

// scripts/lighthouse.mjs (R6-44): the shell
export async function runLighthouse(url, formFactor, options);   // the LHR; options: { timeoutMs }
```

`categoryScores`, `auditRecord` and `a11yFailures` are a `TypeError` for an `lhr` that is not an object and a `RangeError`
for one without `categories` or with a `runtimeError`. `auditPlan` is a `RangeError` for an empty list or a `runs` that is
not a whole number from 1 to 10. `median` is a `RangeError` for an empty list or a value that is not a finite number.
`scriptTotals` is a `TypeError` for a non-array and a `RangeError` for a response without numeric `bytes` and
`transferred`. `ttfbPlan` is a `RangeError` for an empty list or a `rounds` that is not a whole number from 1 to 100.
`routeName` is a `TypeError` for a non-string and a `RangeError` for a route that does not start with `/`. `auditTable`
is a `TypeError` for a non-array. `runLighthouse` is a `TypeError` for a non-string URL and a `RangeError` for a form
factor outside `FORM_FACTORS`, both before it launches a browser, and closes its browser on every path.

## 6. The gallery entries (Task 6.1)

### 6.1 The table

Rows 1 to 6 are R5-31's six hero designs by reference, in its order: each is `heroSpec(i)` for row `i + 1`, its seed is
`hero-<slug>`, its `createdWith` is `"controls"`, and its line is "One locked seed, <its hex>, and the studio's
defaults." Rows 7 to 24 are brief entries in `PRESET_IDS` order of their preset: each is `briefSpec` of its row (R6-06),
its seed is `gallery-<slug>`, its `createdWith` is `"lexicon"` and its line is its brief. The terms are what
`matchLexicon` returned on 2026-11-07, in text order (a suffixed word reads as its term: "frosted" as `frost`,
"layered" as `layer`). The pairing column gives the display and body families the design ended with.

| # | Slug | Name | Brief, or the hero's line | Terms the word list matched | Preset | Display and body | Tags |
|---|---|---|---|---|---|---|---|
| 1 | `madder` | Madder | One locked seed, #f66c6d, and the studio's defaults. | (a hero) | none: "Custom" | Host Grotesk, Host Grotesk | bold |
| 2 | `weld` | Weld | One locked seed, #e3c23b, and the studio's defaults. | (a hero) | none: "Custom" | Host Grotesk, Host Grotesk | playful, natural |
| 3 | `verdigris` | Verdigris | One locked seed, #4bae87, and the studio's defaults. | (a hero) | none: "Custom" | Host Grotesk, Host Grotesk | calm, natural |
| 4 | `woad` | Woad | One locked seed, #0e84b7, and the studio's defaults. | (a hero) | none: "Custom" | Host Grotesk, Host Grotesk | calm, technical |
| 5 | `logwood` | Logwood | One locked seed, #7652ac, and the studio's defaults. | (a hero) | none: "Custom" | Host Grotesk, Host Grotesk | editorial |
| 6 | `cochineal` | Cochineal | One locked seed, #cd3f9b, and the studio's defaults. | (a hero) | none: "Custom" | Host Grotesk, Host Grotesk | bold, playful |
| 7 | `realgar` | Realgar | A balanced, versatile planner for small teams, professional and fast, in orange. | balanced, versatile, professional, fast, orange | `default` | Schibsted Grotesk, Source Serif 4 | technical |
| 8 | `cinnabar` | Cinnabar | A Swiss grid for an architecture studio, stark and precise, with one red. | swiss, grid, architecture, stark, precise, red | `minimal-swiss` | Host Grotesk, Host Grotesk | bold, technical |
| 9 | `ochre` | Ochre | A minimal concrete grid, neutral and crisp, with one ochre mark. | minimal, concrete, grid, neutral, crisp, ochre | `minimal-swiss` | Host Grotesk, Host Grotesk | editorial |
| 10 | `kermes` | Kermes | A slow longform magazine set in serif on warm paper, with burgundy headings. | slow, longform, magazine, serif, warm, paper, burgundy | `editorial` | Schibsted Grotesk, Source Serif 4 | calm, editorial |
| 11 | `lapis` | Lapis | A formal law journal, classic serif on quiet paper, with navy rules. | formal, law, journal, classic, serif, quiet, paper, navy | `editorial` | Schibsted Grotesk, Source Serif 4 | editorial |
| 12 | `gamboge` | Gamboge | A loud, confident neo brutalism store page in saturated yellow with sharp edges. | loud, confident, neo brutalism, saturated, yellow, sharp | `neo-brutalism` | Anybody, Albert Sans | bold, playful |
| 13 | `smalt` | Smalt | A frosted glass landing page for a weather startup, cool azure and high contrast. | frost, glass, landing page, startup, cool, azure, high contrast | `glass` | Funnel Display, Funnel Sans | calm, technical |
| 14 | `turquoise` | Turquoise | A dense, fast terminal for API work, flat panels and one teal accent. | dense, fast, terminal, api, flat, teal | `dark-dev-tool` | Hubot Sans, Mona Sans | technical |
| 15 | `safflower` | Safflower | A friendly bento of modular tiles for a mobile app in rose. | friendly, bento, modular, tile, mobile app, rose | `bento` | Commissioner, Commissioner | playful |
| 16 | `verditer` | Verditer | A slow northern lights gradient for a storefront, vivid and cool. | slow, northern lights, gradient, storefront, vivid, cool | `aurora` | Zalando Sans Expanded, Zalando Sans | calm, natural |
| 17 | `tyrian` | Tyrian | Neon synthwave, holographic and magenta, playful as the eighties. | neon, synthwave, holographic, magenta, playful, eighties | `retro-futurism` | Unbounded, Golos Text | bold, playful |
| 18 | `sepia` | Sepia | A handcrafted leather workshop, warm and layered. | handcrafted, leather, workshop, warm, layer | `tactile` | Big Shoulders, Red Hat Text | natural |
| 19 | `fustic` | Fustic | An embossed brewery label in warm amber, lit from one side. | embossed, brewery, warm, amber | `tactile` | Big Shoulders, Red Hat Text | bold, natural |
| 20 | `rhodonite` | Rhodonite | A maximalist poster collage, wild and festive, with fuchsia everywhere. | maximalist, poster, collage, wild, festive, fuchsia | `maximalism` | Gloock, Albert Sans | bold, playful |
| 21 | `turmeric` | Turmeric | A cozy organic bakery in honey and cream, slow and handmade. | cozy, organic, bakery, honey, cream, slow, handmade | `organic` | Young Serif, Onest | calm, natural |
| 22 | `terre-verte` | Terre verte | A quiet matcha tea house, slow and handmade. | quiet, matcha, tea house, slow, handmade | `organic` | Young Serif, Onest | calm, natural |
| 23 | `malachite` | Malachite | A stark pixel bitmap in black and lime, sharp and flat. | stark, pixel, bitmap, black, lime, sharp, flat | `dithering-pixel` | Tiny5, Spline Sans | technical, playful |
| 24 | `azurite` | Azurite | A bouncy, expressive habit tracker, friendly and animated, in blue. | bouncy, expressive, friendly, animated, blue | `m3-expressive` | Google Sans Flex, Google Sans Flex | playful |

Each brief entry's `presetOf(spec)` equals the preset the brief chose: every field its draft votes for is either the
preset's own value or a contrast level at or above the preset's, so `touchesPreset` finds nothing and the studio's select
names the preset (R6-26). Every one of the 24 passed 78 of 78 required contrast checks with no lint error on 2026-11-07,
and every link is 6,611 to 7,504 characters long after `#s=`.

### 6.2 Coverage

| Preset | Entries |
|---|---|
| `default` | realgar |
| `minimal-swiss` | cinnabar, ochre |
| `editorial` | kermes, lapis |
| `neo-brutalism` | gamboge |
| `glass` | smalt |
| `dark-dev-tool` | turquoise |
| `bento` | safflower |
| `aurora` | verditer |
| `retro-futurism` | tyrian |
| `tactile` | sepia, fustic |
| `maximalism` | rhodonite |
| `organic` | turmeric, terre-verte |
| `dithering-pixel` | malachite |
| `m3-expressive` | azurite |
| none ("Custom") | madder, weld, verdigris, woad, logwood, cochineal |

| Tag | Count | Entries |
|---|---|---|
| calm | 7 | verdigris, woad, kermes, smalt, verditer, turmeric, terre-verte |
| bold | 7 | madder, cochineal, cinnabar, gamboge, tyrian, fustic, rhodonite |
| editorial | 4 | logwood, ochre, kermes, lapis |
| technical | 6 | woad, realgar, cinnabar, smalt, turquoise, malachite |
| playful | 8 | weld, cochineal, gamboge, safflower, tyrian, rhodonite, malachite, azurite |
| natural | 7 | weld, verdigris, verditer, sepia, fustic, turmeric, terre-verte |

The primary hues spread around the wheel: the heroes at 22°, 95°, 165°, 235°, 300° and 345°, and the briefs' word-list hues
at 10° (rose), 15° (burgundy), 29° (red), 50° (leather), 55° (orange), 75° (amber), 80° (honey, ochre), 100° (yellow),
128° (matcha and tea house), 130° (lime), 160° (northern lights), 190° (teal), 240° (azure), 260° (blue), 265° (navy),
330° (magenta) and 340° (fuchsia). Three presets show dark canvases (`dark-dev-tool`, `retro-futurism`,
`dithering-pixel`), which R6-26 opens in dark mode.

### 6.3 The heroes and the presets

M5 made the heroes with `generateSystem({ ...freshParams(), primary, name }, seed)` and no `resolveParams`, so each holds
M1's default families (the Host Grotesk pairing) rather than the pairing `choosePairing(seed)` picks, and `presetOf` finds
no preset for any of them (the `default` preset's families are the automatic pairing's, R3-07). The gallery says "Custom",
as the studio's select and the receipt's `design.preset: null` do. The heroes stay as M5 committed them: their cards are
`hero-cards.json`, and each gallery hero's `link` equals its hero card's `href` after `/studio#s=` (C-GAL6-06).

## 7. The gallery pages (Task 6.2)

### 7.1 `/gallery`

Metadata: `pageMetadata(SITE, "/gallery", { title: "Gallery", description: "24 original design systems made by dyelot,
each with a receipt of its contrast checks. Open any of them in the studio, the explorer or the motion lab." })` (150
characters). The page: `PageFrame active="gallery" statusLeft="dyelot ~/gallery" statusRight="muizz-lab · MIT"`, then a
`section` (`max-w-6xl`) holding:

1. `<Prompt>dyelot gallery</Prompt>` and the `h1` "The gallery".
2. The intro: "Original design systems made by dyelot: <h> from one seed color each, and <b> from a one-sentence brief that the
   studio's word list read, with no model. Each passes every required check of its receipt. Open one in the studio and
   make it yours." `<h>` and `<b>` are the counts of hero and brief entries (6 and 18).
3. The filter: `<nav aria-label="Filter by mood">` with the links "all" (`/gallery`) and each tag (`/gallery?tag=<tag>`),
   in `GALLERY_TAGS` order, each 32 px tall; the current one carries `aria-current="page"` ("all" for `"all"` and
   `"unknown"`).
4. For `"unknown"` only, the sentence "That mood is not one of the six, so every design shows." (the query is never
   repeated on the page).
5. The count line: "All 24 designs." for `"all"` and `"unknown"`, else "<n> of 24 designs are tagged <tag>."
6. The cards: a `ul` of the matching entries in `GALLERY_DEFS` order, one `li` each; one column below 768 px, two from
   768 px and three from 1280 px.

### 7.2 The card

Each `li` holds `<article aria-labelledby={<id>} data-gallery-card data-slug={slug}>`, a `rounded-xl border border-border
bg-panel p-5` box, and in it, in order:

| Part | Markup and text |
|---|---|
| Name | `<h2 id>` the name, `font-mono text-lg font-semibold` |
| Line | `<p>` the line, muted |
| Tags | `<p data-tags>` "mood: " and the tags joined by ", " |
| Specimen | 7.3 |
| Facts | `<dl>` of four rows: "Type" with "<display> and <body>" (one name when they are the same family), "Preset" with the preset label, "Receipt" with `summaryLines(summary)[0]`, "Lot" with the lot in Geist Mono |
| Links | "Open in the studio" to `entryHref("studio", link)` and "Details" to `/gallery/<slug>`, each `min-h-8`; the accessible names are "Open <name> in the studio" and "Details of <name>" (a visually hidden span adds the name, so the visible words stay inside the name, WCAG 2.5.3) |

`GalleryCard.tsx` is a server component; the page sends no `gallery.json` to the browser.

### 7.3 The specimen

`<figure data-specimen>` with a `figcaption` (visually hidden) "Five palettes of <name> in light mode: primary,
secondary, accent, neutral and danger, at steps 100, 300, 500, 700 and 900." and five rows, one per palette, each a label
(the palette's name, `font-mono text-xs`, muted) and five swatches of 24 × 24 px, `aria-hidden`, each with a 1 px border
of `border` and its hex as `background-color`. The specimen is the only place on the card where the design's colors
appear (I-M6-06).

### 7.4 `/gallery/[slug]`

`generateMetadata({ params })` gives `{ title: name, description: entryDescription(entry), alternates: { canonical:
"/gallery/<slug>" } }`, and `notFound()` for an unknown slug. The page: `PageFrame active="gallery"
statusLeft="dyelot ~/gallery/<slug>" statusRight="muizz-lab · MIT"`, then:

1. `<Prompt>dyelot gallery <slug></Prompt>`, the `h1` the name, and the line.
2. How it was made: for a brief entry "Made from this brief by the studio's word list, with no model. It matched: <terms
   joined by ", ">."; for a hero "Made from one seed color with the studio's controls."
3. A `dl`: "Mood" with the tags, "Preset" with the label, "Type" with "<display>, <body> and <mono>" (each family once),
   "Lot" with the lot.
4. `h2` "Receipt" and a `ul` of the four `summaryLines(summary)`.
5. `h2` "Scales" and two figures, `data-specimen` each, captioned "Light mode: eight palettes of eleven steps." and "Dark
   mode: eight palettes of eleven steps.", each eight rows of a label and eleven 20 × 20 px swatches, `aria-hidden`.
6. `h2` "Roles" and two figures, `data-specimen` each, captioned "Light mode" and "Dark mode", each a list of six rows of
   a swatch (`aria-hidden`), the role's name and its hex in Geist Mono.
7. `h2` "Type" and a `table` with the caption "The type ladder" and the columns "Step", "Size", "Line height" and
   "Family": ten rows, caption to display, sizes as "<n> px", the family's name (display or body).
8. `h2` "Open it": the links "Open in the studio", "Open in the explorer" and "Open in the motion lab" (`entryHref`), the
   button "Copy the studio link" (R6-16) and its status line, and the link "Back to the gallery".

The page holds no color outside its specimens and the chrome (I-M6-06).

## 8. The share cards (Task 6.3)

### 8.1 One entry's card

`GalleryShareCard({ card, icon })`: the M0 card's ground (`INK.background`, `DOT_GRID`, the madder glow) and, in a flex
column with 64 px padding:

1. The brand row: the icon at 48 px and "dyelot" (Geist Mono 700, 40 px), as `ShareCard` draws it.
2. `// gallery/<slug>` (400, 28 px, `INK.muted`).
3. The name (700, 96 px, `INK.foreground`).
4. The line (400, 30 px, `INK.muted`), wrapped by `wrapLines` into at most two lines (a line of at most 100 characters
   always fits two at this size).
5. The strip: five blocks of 200 × 96 px with 8 px gaps and a 12 px radius, each the color of `card.strip` in order,
   with a 1 px border of `INK.border`.
6. "<passed> of <required> required checks pass" (400, 28 px, `INK.foreground`).
7. The footer: `$ open <host>/gallery/<slug>` and `muizz-lab`, as the M0 card's footer.

The parts sit 16 px apart; with the line on two lines the column fits 630 px, and if it does not, Task 6.3 narrows the
gaps, never the type sizes. `GALLERY_CARD_ALT` is "A design system from dyelot's gallery, with its name, its one-line
description, five of its colors and its receipt count."

### 8.2 The gallery's card

`MosaicShareCard({ cards, icon })`: the same ground, brand row and footer (`$ open <host>/gallery`), the comment
`// gallery`, the headline "24 design systems, each with its receipt" (700, 56 px, "receipt" in `SITE.accent`), and a
mosaic of four rows of six tiles in `GALLERY_DEFS` order, each tile 160 × 40 px made of its card's five strip colors as
equal bands, with 12 px gaps. `MOSAIC_ALT` is "dyelot's gallery: 24 design systems, each shown as five of its colors."

## 9. The landing (Task 6.6)

### 9.1 The start-from section

`StartFrom.tsx` renders, inside `<TerminalWindow title="start-from.log">`, a `section` named by its `h2` "Start a design
from" and four groups, each named by an `h3`:

| Key of `START_LINES` | Text | Where |
|---|---|---|
| `heading` | Start a design from | `h2` |
| `color` | a color | `h3` |
| `colorLabel` | Seed color | label of `<input type="color">`, value `#f66c6d` at first |
| `colorSubmit` | Open the studio with this color | submit |
| `brief` | a brief | `h3` |
| `briefLabel` | Describe the product or mood | label of the `textarea` (`maxLength` 500, 3 rows) |
| `briefPlaceholder` | A tea house at dusk, calm and exact | placeholder (M4's) |
| `briefNote` | The studio puts it in its Brief box. Nothing reads it until you press Read the brief there. | under the field |
| `briefSubmit` | Take this brief to the studio | submit |
| `briefEmpty` | Write a few words first. | the form's `role="status"` line, after a submit `briefReady` refuses |
| `image` | an image | `h3` |
| `imageNote` | The studio finds an image's colors in this browser. Nothing leaves your device until you ask a model to read it. | paragraph |
| `imageLink` | Open the studio's image drop | link to `IMAGE_HREF` |
| `gallery` | the gallery | `h3` |
| `galleryNote` | Original design systems made by dyelot, each with its receipt. | paragraph |
| `galleryLink` | Browse the gallery | link to `GALLERY_HREF` |

The color input shows its hex beside it in Geist Mono (`<output>` for the input); the brief's counter reads "<n> of 500
characters", as the studio's does. The color form submits `colorHref(input.value)`; the brief form submits
`briefHref(text)` when `briefReady(text)`, else it shows `briefEmpty` and keeps focus in the field. Every control is at
least 32 px tall. Below 768 px the four groups stack; from 768 px they form two columns.

### 9.2 The receipt section

`ReceiptSection.tsx`, a server component, renders `<section aria-labelledby="receipt-heading" data-receipt>` after the
story, with these parts in order. `RECEIPT_LINES` holds the fixed sentences; `receiptLines(excerpt)` fills the numbers.

1. `h2` "The receipt".
2. "Every export carries receipt.json, in the format <format>: the measurements of the design, written by the engine that
   made it. Here are three parts of the receipt of <name>, the design of the story above."
3. A figure (`data-excerpt="summary"`) captioned "The summary: <requiredPass> of <required> required contrast checks
   pass, and the linter found <errors>." (`<errors>` is "no error", "1 error" or "<n> errors"), holding a `pre` of
   `excerptText(excerpt.summary)`.
4. A figure (`data-excerpt="contrast"`) captioned "One of the <checks> contrast checks: <foreground> on <background> in
   <mode> mode, measured and never rounded.", holding a `pre` of `excerptText(excerpt.contrast)`.
5. A figure (`data-excerpt="finding"`) captioned "One finding of the linter, with the rule it comes from.", holding a
   `pre` of `excerptText(excerpt.finding)`; when `finding` is null, the caption "The linter found nothing to note in this
   design." and no `pre`.
6. "The export also holds a checker with no dependencies. A coding agent runs it from the app's root before it
   finishes:" and a `pre` reading `$ node scripts/dyelot-check.mjs`.
7. "It checks the theme against receipt.json, measures the <required> required contrast pairs again and scans the source
   for raw colors and Tailwind palette classes. It prints PASS when the code keeps to the design."

Each `pre` wraps (`white-space: pre-wrap; overflow-wrap: anywhere`), so nothing scrolls sideways at 360 px. The section
holds no color: the hexes are text.

### 9.3 The nav and the sitemap

`AppNav` (R6-30): the brand tile, then "home", "studio", "explore", "motion", "gallery", "about" and "github". From 640 px
the links share one row, as today. Below 640 px the links' row takes `flex-wrap` with `justify-end`, a row gap of 0 and a
column gap of 12 px, at most two rows; the nav's height is `min-h-14` instead of `h-14`, with 4 px of vertical padding; the
active link's underline sits 2 px below its own box (`after:-bottom-[2px]`) instead of on the nav's border. The 404 page
marks no link (M0's test "the nav marks no link as current on the 404 page" stands).

`src/app/sitemap.ts` returns `sitemapEntries(SITE, galleryRoutes())`, so `/sitemap.xml` lists `/`, `/studio`, `/explore`,
`/motion`, `/gallery`, `/about` and then the 24 entry pages. `sitemapEntries(site, more = [])` is a `RangeError` for a
route in `more` that repeats one of `site.routes.sitemap` or that `site.routes.disallow` would disallow.

### 9.4 `start.log`

The window's lines become: "open the studio", "open the explorer", "open the motion lab", "open the gallery", "open the
about page" and the repository line, then the cursor (`StartLink` labels "the gallery" and "the about page").

## 10. The studio's entry hashes (Task 6.5)

### 10.1 The grammar

`readEntry(hash)` reads, in order: a hash that does not start with `#color=`, `#brief=` or `#start=` is `none`. Then:

| Hash | Result |
|---|---|
| `#color=f66c6d` or `#color=F66C6D` | `entry`, `color`, the seed of `#f66c6d` |
| `#color=f66c6`, `#color=f66c6d0`, `#color=`, `#color=gg6c6d`, `#color=%23f66c6d`, `#color=#f66c6d` | `malformed` |
| `#brief=A%20tea%20house%20at%20dusk` | `entry`, `brief`, "A tea house at dusk" |
| `#brief=caf%C3%A9%20%26%20bar` | `entry`, `brief`, "café & bar" |
| `#brief=tea+house` | `entry`, `brief`, "tea+house" (a `+` stays a `+`) |
| `#brief=`, `#brief=%20%20`, `#brief=%E0%A4%A` (a broken escape) | `malformed` |
| `#brief=` with a value of more than 6,000 characters, or whose decoded and cleaned text is longer than 500 characters | `malformed` |
| `#start=image` | `entry`, `image` |
| `#start=`, `#start=Image`, `#start=brief` | `malformed` |
| `#s=...`, `#top`, the empty hash, `#colors=f66c6d` | `none` |

The brief's text is `toPlainText(decodeURIComponent(value), 500)`'s text when that result exists and is not truncated;
`readEntry` checks the raw value's length (at most 6,000 characters, twelve per character for the longest UTF-8
encoding) before it decodes.

### 10.2 The store and the shell

`createStudioStore`'s first load reads `readHash(location.hash)` first; when it is `none`, it reads
`readEntry(location.hash)`:

| `readEntry` | Snapshot | Notice | `entry` | Persist at load |
|---|---|---|---|---|
| `color` | fresh, the primary locked at the color, preset `"default"` | none | null | yes |
| `brief` | fresh | none | `{ kind: "brief", text }` | yes |
| `image` | fresh | none | `{ kind: "image" }` | yes |
| `malformed` | fresh | `link`, `corrupt`, `fresh` | null | no |
| `none` | the draft, else fresh (M2) | as M2 | null | no |

"Persist at load" schedules the store's persist as a commit does: 300 ms later `replaceState` writes `#s=<the shown
design>` and the draft is written. The fresh snapshot of an entry is built as `fresh()` builds one, with the primary added
for `color`; its history is empty, so Undo does nothing.

The studio shell takes the entry once, in an effect after its first render: `store.getState().takeEntry()`. For `brief`,
it opens the inputs drawer when the inputs panel is a drawer (`isDrawer.inputs`, its opener the toolbar's "Inputs"
button), gives the Brief section the text (its `value`) and focuses its textarea; for `image`, it opens the drawer the same
way and focuses the Image section's "Choose an image" input. In React's development double-render the second
`takeEntry()` returns null, so nothing happens twice.

### 10.3 The view a loaded design opens with

`presetView(view, preset)` returns `{ ...view, mode: PRESETS[preset].view.mode, density: PRESETS[preset].view.density }`,
or `view` itself for null. The first load's view is `presetView(DEFAULT_VIEW, first.snapshot.preset)`. `snapshotOf(spec,
draft)` returns, without a matching draft, the preset `presetOf(spec)`; with one, the draft's stored preset, as today. So:
a draft of a `dark-dev-tool` design reloads dark and dense; `/studio#s=<turquoise's link>` opens dark and dense with the
select on "Dark dev tool"; a hero's link opens light with "Custom"; an entry's fresh design opens on `DEFAULT_VIEW`.

## 11. `/about` (Task 6.4)

### 11.1 The page

Metadata: `pageMetadata(SITE, "/about", { title: "About", description: "How dyelot works: the color math, the receipt and
its checker, what AI sees and what stays in your browser, and the licenses of what it builds on." })` (146 characters).
The page: `PageFrame active="about" statusLeft="dyelot ~/about" statusRight="muizz-lab · MIT"`, then a `section`
(`max-w-3xl`) holding `<Prompt>dyelot about</Prompt>`, the `h1` "How dyelot works", `ABOUT_INTRO`, and for each section of
`ABOUT_SECTIONS` an `h2` (its heading, with `id` its section id) and its paragraphs in order, with the links of 11.3 after
the paragraphs they belong to. No fact on the page shows a ruling id; the table below holds them.

### 11.2 The copy

| Id | Heading | Paragraph | Restates |
|---|---|---|---|
| intro | (none) | dyelot turns one color, a few words or an image into a design system, measures every color it makes and writes the measurements down. This page says how it works, what leaves your browser and whose work it builds on. | umbrella §1 |
| math | The color math | Every color is stored in OKLCH, a color space whose lightness steps look even to the eye. Each palette has eleven steps, from 50 to 950, in a light mode and a dark mode. | umbrella §4, §5; R-01 |
| math | | Each step has a target contrast against the page, from 1.06 to 1 for step 50 up to 15.5 to 1 for step 950: against white in light mode, and against a dark gray page in dark mode. The engine searches each step's lightness until the color, brought inside its gamut, meets its target, then picks the 8-bit hex nearest it. Steps 500, 600 and 700 must reach 3, 4.5 and 7 to 1 on that hex. | umbrella §5 Scales and its M1 note; R-06 |
| math | | WCAG 2.2 contrast is the only pass or fail test, computed without rounding, so 4.499 to 1 fails a 4.5 check. Beside it the studio shows a score labeled "perceptual contrast (advisory)", from dyelot's own MIT implementation of a published formula; it never decides a check. | umbrella §5 Contrast; DR-0038 |
| math | | Status and chart colors are checked under simulated protanopia, deuteranopia and tritanopia, so they stay apart for people who see color differently. | umbrella §5 Color blindness and its M1 note |
| math | | The same seed and settings always give the same design. The link holds the whole design, and one design always exports the same bytes. | umbrella §3 Determinism; R-21, R-22 |
| receipt | The receipt and the checker | Every export carries receipt.json, in the format dyelot.check/1. It holds the 80 contrast checks of the design, 40 in each mode, of which 78 are required; the color-vision checks; whether every color sits inside its gamut; the linter's findings; and a hash of every other file in the export. | umbrella §1 and its M3 note; R3-08, R3-23 |
| receipt | | The export also carries scripts/dyelot-check.mjs, a checker with no dependencies. A coding agent runs it before it finishes: it checks the theme against the receipt, measures the 78 required contrast pairs again and scans the source for raw colors and Tailwind palette classes. It prints PASS when the code keeps to the design. | R3-24, R3-25; 6.9.1 of M3 |
| receipt | | The studio will not export a design that fails a required check, so every design that leaves dyelot passes its own receipt. | R3-42 |
| privacy | AI and privacy | The studio works with no model at all. A word list reads a brief, seven chips steer a design, and the colors of an image are found in your browser. When a model answers, it only chooses settings that the engine checks; it never writes a color value. | umbrella §10; R4-01, R4-07, R4-42, R4-44 |
| privacy | | When you ask for AI, dyelot tries, in order: the model built into Chrome, if you turned it on; your own OpenRouter key, if you connected one; dyelot's shared free quota; then the word list. Each result says which one answered. | R4-30 |
| privacy | | The model built into Chrome runs on your device, and what you type stays there. Its switch is marked experimental. | R4-31; DR-0039 |
| privacy | | Your own key stays in this browser tab, unless you choose to remember it on this device, and it never reaches dyelot's server: your browser calls OpenRouter directly, and dyelot records nothing of those calls. | R4-29, R4-33, R4-34 |
| privacy | | With your key or the shared quota, what an action needs goes to OpenRouter and the model's provider: your brief, your words for Refine, the design's settings and findings, or, for Read the vibe, a copy of your image at most 768 pixels on its longest side. On the shared quota it passes through dyelot's server first. | R4-09, R4-39, R4-45, R4-46, R4-48 to R4-50 |
| privacy | | On the shared quota, dyelot records each action in Langfuse, a tracing service, to see which free models fail: the messages sent, your brief and your words for Refine among them, and the models' answers. An image is recorded only as its size in bytes and its width and height. | R4-52; the owner's ruling of 2026-11-05 |
| privacy | | Each visitor gets three shared actions a day. A signed cookie counts them; it holds the day and the count, and nothing that names you. | R4-18 |
| privacy | | An image you choose is read in your browser. Nothing of it leaves your device until you press Read the vibe. | R4-46 |
| privacy | | The brand video is made in your browser by Remotion, the video library dyelot uses. Remotion sends one usage event to remotion.pro for each render, with your IP address and this site's address. It never sends the video or the design, and dyelot cannot turn it off. A note says so before the first render, and recording the shader loop sends nothing. | R5-53 to R5-56 |
| privacy | | dyelot has no analytics, no advertising and no tracking. A design lives in its link and, as a draft, in this browser's storage; dyelot's server keeps no design. | umbrella §3, §15; R5-58; R6-22 |
| licenses | Licenses | dyelot is open source under the MIT license. | umbrella §12 |
| licenses | | Every font family is under the SIL Open Font License, the Apache License 2.0 or the Ubuntu Font License, and dyelot serves each one from its own site, with no request to a font service. | umbrella §6; R2-03 |
| licenses | | Remotion, which makes the brand video, is source-available under its own license, not open source. It is free for individuals and for companies of up to three people; a company of four or more people needs a Remotion Company License to use it. dyelot uses it as an individual's project. | R5-55; 11.4 of M5 |
| licenses | | Mediabunny, which records the shader loop, is under the Mozilla Public License 2.0 and is used unmodified. | R5-50; `README.md` |
| licenses | | The noise in the animated background is the simplex noise of webgl-noise by Ian McEwan and Ashima Arts, under the MIT license; its notice is kept in the code and in the export. | R5-24; `src/flavor/flavor.mjs` |
| licenses | | Color names come from color-name-list, under the MIT license. | umbrella §5 Names |
| licenses | | The colors of an image are found with colorthief by Lokesh Dhakar, under the MIT license. | umbrella §5 Image to palette; R4-60 |
| licenses | | The 3D explorer was inspired by oklch-picker by Evil Martians, under the MIT license; dyelot uses none of its code. | R5-07; 11.4 of M5 |

### 11.3 The links

| Label | Href | After the paragraph |
|---|---|---|
| The source on GitHub | `REPOSITORY_URL` (`https://github.com/Abdul-Muizz1310/dyelot`) | licenses, "dyelot is open source…" |
| Remotion's license | `https://remotion.pro/license` | licenses, "Remotion, which makes…" |

External links open in the same tab and carry `rel="noopener noreferrer"`. No other link is in `main`; the nav and the
status bar are the frame's.

## 12. The audits (Tasks 6.10 and 6.12)

### 12.1 The invocation

`scripts/lighthouse.mjs` (`// @ts-check`):

```js
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import lighthouse, { desktopConfig } from "lighthouse";
import { CATEGORIES, FORM_FACTORS } from "./audit-core.mjs";

export async function runLighthouse(url, formFactor, { timeoutMs = 120_000 } = {}) {
  // formFactor is checked against FORM_FACTORS first (RangeError naming runLighthouse)
  const dir = mkdtempSync(join(tmpdir(), "dyelot-lh-"));
  const context = await chromium.launchPersistentContext(dir, {
    headless: true,
    args: ["--remote-debugging-port=0"],
  });
  try {
    const port = await debuggingPort(dir);   // the first line of <dir>/DevToolsActivePort, polled for up to 10 s
    const flags = { port, output: "json", logLevel: "error", onlyCategories: [...CATEGORIES], maxWaitForLoad: 45_000 };
    const result = await withTimeout(lighthouse(url, flags, formFactor === "desktop" ? desktopConfig : undefined), timeoutMs);
    if (result === undefined) throw new RangeError("runLighthouse: Lighthouse returned no result");
    return result.lhr;
  } finally {
    await context.close();
    rmSync(dir, { recursive: true, force: true });
  }
}
```

Mobile is Lighthouse's default configuration (a mobile screen and simulated slow 4G with four times CPU slowdown); desktop
is `desktopConfig` (a desktop screen, simulated dense 4G, no CPU slowdown). Both are lab measures in Playwright's bundled
Chromium.

### 12.2 The flow

`tests/e2e/lighthouse-m6.spec.ts` configures `test.describe.configure({ mode: "serial" })` and a 180 s timeout per test.
For each route of `AUDIT_ROUTES` and each form factor, in that order, one test titled with its F-LH6 id, the route and the
form factor:

1. `const lhr = await runLighthouse(new URL(route, baseURL).href, formFactor)`.
2. `auditRecord(lhr)` is written to `test-results/lighthouse/<routeName(route)>-<formFactor>.json` and attached.
3. `expect(lhr.categories.accessibility.score, a11yFailures(lhr).join(", ")).toBeGreaterThanOrEqual(0.95)`.

`auditRecord(lhr)` is `{ url, formFactor, lighthouseVersion, fetchTime, scores: categoryScores(lhr), metrics: { fcp, lcp,
tbt, cls, si }, scripts: { requests, transferSize } }`: the metrics are the `numericValue`s of
`first-contentful-paint`, `largest-contentful-paint`, `total-blocking-time`, `cumulative-layout-shift` and `speed-index`,
and the scripts come from the `resource-summary` audit's `script` row.

### 12.3 Goals for the deployed site (owner approval item 4)

Medians of three runs on `https://dyelot.vercel.app`; accessibility is the one gate, and the e2e suite already enforces
it.

| Routes | Desktop performance | Mobile performance | Accessibility | Best practices | SEO | Desktop CLS |
|---|---|---|---|---|---|---|
| `/`, `/gallery`, `/gallery/madder`, `/about` | at least 90 | at least 70 | at least 95 | at least 90 | at least 90 | at most 0.1 |
| `/studio`, `/explore`, `/motion` | at least 70 | recorded | at least 95 | at least 90 | at least 90 | at most 0.1 |
| `/connect` | at least 90 | at least 70 | at least 95 | at least 90 | recorded (it is `noindex` by design, R4-22) | at most 0.1 |

A miss is recorded in the README with its cause (for example the hero's shader on mobile, or per-request rendering's
first byte), and section 18 of the next spec or the owner decides; it never blocks the merge.

### 12.4 The deployed measures and the README

`node scripts/audit-site.mjs [--base <origin>] [--runs <n>]` (defaults `https://dyelot.vercel.app` and 3) writes
`test-results/audit-site/<YYYY-MM-DD>.json` and prints `auditTable` for the README:

1. **Lighthouse.** `auditPlan(AUDIT_ROUTES, FORM_FACTORS, runs)`: run 1 visits every route at desktop then mobile, then
   run 2 the same, then run 3; the medians per route, form factor, category and metric.
2. **First byte.** After one uncounted request per path, ten rounds of `/`, `/robots.txt` and `/gallery` in that order
   (`ttfbPlan`), each the time from the request's start to its response headers (`fetch` resolving, `cache: "no-store"`);
   the medians, and the medians of `/` and `/gallery` less that of `/robots.txt`, the cost of per-request rendering under
   the nonce CSP (R4-26).
3. **Chunk sizes.** For each route, a fresh Chromium context loads it and waits for `load`; `scriptTotals` sums every
   response whose request's resource type is `script`: its decoded body length and its transferred size
   (`request.sizes().responseBodySize`).
4. The machine's `os.loadavg()` before and after, and the date.

The README's M6 section records the three tables: Lighthouse medians (route, form factor, the four scores, LCP, TBT,
CLS), first-byte medians (path, median ms, the difference from `/robots.txt`), and chunk sizes (route, scripts, decoded
KB, transferred KB), each headed "Measured on <date>" with the load average. Nothing is rounded before the table: scores
as 0 to 100 integers as Lighthouse shows them, times in whole milliseconds, sizes in KB to one decimal.

## 13. The deferred fixes (Tasks 6.7 to 6.9)

### 13.1 The Player's text alternative (G3)

`BrandPlayer`'s wrapper `div` (`data-brand-player`) gains `role="figure"`, `aria-label="Brand video preview"` and
`aria-describedby={<id>}`; beside it, a `<p id={<id>} className="sr-only">` holds `brandDescription(props)`:

"A six-second video of <name>, with <its one-liner in quotation marks, or nothing when it is empty>: five rows of eleven
swatches (primary, secondary, accent, neutral and danger), a sample card with a Get started button, and the line
<passed> of <required> required checks pass, with the lot <lot>. It is set in <display> and <body>."

`<display>` and `<body>` are the first family of each font stack of `props.fonts`, unquoted. With no one-liner the text
reads "A six-second video of <name>: five rows…". The frame inside stays `aria-hidden` and the axe flows keep their one
named exclusion (13.3 of M5). Spec 05's 13.3 gains: "Amended in M6: the wrapper is a figure described by the video's
contents (06-gallery.md, R6-35)."

### 13.2 Focus and names (G5)

- `FLAVOR_LINES` gains `"pause-background": "Pause the background"` and `"pause-video": "Pause the video"`; the dialog's
  Background section uses the first, `BrandPlayer` the second; `pause` stays "Pause" for the hero.
- `ExploreClient`'s restart moves focus to the "Turn" slider (`ref`) in the same click handler that bumps `mount`.
- `FlatView` takes `const id = useId()` and uses `${id}-caption` and `${id}-steps` for `aria-labelledby` and the list.

### 13.3 Lazy templates (G1)

`templates/index.tsx` keeps `TEMPLATE_LABELS`, `FIXED_FRAMES` and `Template`, and `Template` renders `<LazyTemplate
id={view.template} spec={spec} view={view} />`: a component that keeps one `React.lazy` per template id (created from
`TEMPLATE_LOADERS[id]` on first use, and again after "Try again"), inside `<Suspense fallback={<p role="status"
data-template-loading>Loading the template…</p>}>` and an error boundary whose fallback is `<div role="alert"
data-template-failed>` with "This template could not load." and a "Try again" button. Each template file adds `export
default <Name>`. `Canvas.tsx` starts `preloadTemplates(view.template, idleScheduler(window))` in an effect after its first
render and cancels it on unmount. `idleScheduler` uses `requestIdleCallback(run, { timeout: 2000 })` when the window has
it, else `setTimeout(run, 1000)`.

### 13.4 The settings template's clip margin (G2)

Form A: `.st { overflow: clip; overflow-clip-margin: 12px; }` with the comment the `canvas.css` rule carries. Form B (when
probe 6 finds the save bar cut by `.st-scroll`): Form A plus `.st-save-bar { bottom: 4px; }` and `.st-scroll {
padding-bottom: 4px; }`. F-CANVAS-11's clip-edge test then lists `["settings", ".st-top"]` and `["settings",
".st-save-bar"]`, and its check also treats a scroll container's padding box as a clip box. When probe 6 rules G2 out,
none of this lands and section 18's row says why.

### 13.5 Code fixes (G4, G5)

- `codeFiles` (R6-39) keeps a stack of folders, reads each with `read(folder, { withFileTypes: true })`, pushes child
  folders whose name is not `PROBE_DIR`, and collects files matching `CODE_FILE` that are not `GUARD3_04_PROBE`; a child
  read that fails with `ENOENT` on a probe path is skipped, any other failure throws `Error("codeFiles: cannot read
  <folder>: <code>")`; an empty result is a `RangeError` "codeFiles: <directory> holds no code file".
- `src/features/ai/load.ts`, `src/features/export/useBundle.ts` and `src/features/import/ImportDialog.tsx` build their
  loaders with `loadOnce` (R6-40).
- `src/export/guards.ts` (R6-41); `bundle.ts` calls `httpsOrigin(input.origin, "buildBundle")` and `flavor.ts`
  `httpsOrigin(origin, "flavorFiles")`, with the messages of today: "<caller>: origin must be a string, got <type>" and
  "<caller>: origin must be an https origin with no path, got <JSON>".
- `storySteps` checks `spec.color`, `spec.color.params`, `spec.color.palettes`, `spec.color.palettes.primary`,
  `spec.color.palettes.primary.light` (an array), `spec.color.roles`, `spec.color.roles.light`, `spec.type`,
  `spec.type.families`, `spec.space` and `spec.space.scale` (an array), in that order; `tokenRow` checks `spec.color`,
  `spec.color.palettes`, `spec.color.palettes[palette]`, `spec.color.palettes[palette][mode]` (an array),
  `spec.color.roles` and `spec.color.roles[mode]`, after its argument checks. Each failure is a `TypeError` "<function>:
  <path> must be an object, got <type>" (or "an array").

## 14. Cases

Each case below becomes a test whose title starts with its id. A case that names a task belongs to that task, and every
other case to the task of its subsection. A property case that generates designs runs with `PROPERTY_TIMEOUT`
(`tests/unit/spec/support.ts`), and its file joins `SLOW_WEB_TESTS` or `SLOW_CORE_TESTS` when its measured solo time
reaches 10 s (R2-31). The flows compute what a page must show by importing `@/engine`, `@/spec`, `@/export` and the
committed data in Node (with `tests/e2e/raw-hooks.mjs` for `?raw`). A flow that installs `ABORT_CHUNK` allows exactly the
two console lines of 14.11 of M5. A case row that depends on a probe says what happens when the probe rules its piece
out.

### 14.1 Gallery data (Task 6.1)

Tests: `tests/unit/features/gallery/defs.test.ts`, `tests/unit/features/gallery/build.test.ts`,
`tests/unit/features/gallery/data.test.ts`, `tests/unit/features/gallery/tags.test.ts`,
`tests/unit/features/gallery/links.test.ts`, `tests/unit/features/gallery/cards.test.ts`,
`tests/unit/features/landing/receipt.test.ts`, with `AI` the `@/ai` entry imported statically.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-GAL6-01 | pass | `GALLERY_DEFS` equals section 6's table: 24 rows in order; rows 1 to 6 are heroes with `hero` 0 to 5 and the tags of the table; rows 7 to 24 hold the slug, the name, the seed `gallery-<slug>`, the brief and the tags of the table; the array, each row and each tag list are frozen | ruling R6-05 |
| C-GAL6-02 | pass | `GALLERY` (the committed JSON) deep-equals `galleryData(AI)`; with `DYELOT_UPDATE_GALLERY=1` the test writes `gallery.json` as R3-11 writes JSON, and with `CI` also set it fails before writing | ruling R6-04, I-M6-01 |
| C-GAL6-03 | pass | For each brief row, `briefSpec(row, AI)` equals the six steps of R6-06 written out in the test; its `terms` equal section 6's column; `presetOf(spec)` equals the preset column; `meta.createdWith` is `"lexicon"`, `meta.name` the name, `meta.oneLiner` the brief and `meta.seed` the seed; `AI.briefColors(brief).seeds` is empty | ruling R6-06 |
| C-GAL6-04 | pass | Every entry's `summary` has `pass` true, `contrast.requiredPass` equal to `contrast.required` (78) and `lint.error` 0, and equals `summarize(measureSpec(spec), lintSpec(spec), gamut)` of its decoded link | ruling R6-08, I-M6-02 |
| C-GAL6-05 | pass | Every entry rebuilds: `spec = decodeSpec(link)`, then `generateSystem(resolveParams(paramsOfSpec(spec).params, spec.meta.seed), spec.meta.seed, { createdWith: spec.meta.createdWith })` has `specId(spec)`; `lintSpec(spec)` has no error; `exportState(summary, "loaded")` is `"passing"` | ruling R6-10, I-M6-02 |
| C-GAL6-06 | pass | The six hero entries: `link` equals `HERO_CARDS.cards[i].href` after `/studio#s=`; `specId` is `specId(heroSpec(i))`; `createdWith` `"controls"`; `preset` null and `presetLabel` "Custom"; `line` "One locked seed, <hex of R5-31's row>, and the studio's defaults."; `brief` null and `terms` `[]` | ruling R6-05, 6.3 |
| C-GAL6-07 | pass | For every entry: `specId` is `specId(decodeSpec(link))` and `lot` is `lotTag(specId)`; `presetLabel` is `PRESETS[preset].label` or "Custom"; `families` are `FONT_CATALOG`'s family names of the spec's three ids; `specimen` holds primary, secondary, accent, neutral and danger in that order, each the light hexes of steps 100, 300, 500, 700 and 900; `scales` hold each mode's 8 × 11 hexes; `roles` hold the six roles of 7.2 of M5 in each mode; `type` holds the ten steps with the spec's sizes and line heights, the display family for `display` and `h1` to `h4` and the body family for the rest, as `dtcg.ts`'s `HEADING_STEPS` assigns them; every hex is lowercase `#rrggbb` | ruling R6-08 |
| C-GAL6-08 | pass | Words: each name is 1 to 24 characters of letters and single spaces; each slug matches `^[a-z]+(-[a-z]+)*$`, is unique and is the name in lowercase with hyphens; each brief is plain text (`isPlainText`) of 30 to 100 characters ending in one period, with no color literal; no word of `DENY_LIST` (whole words, any case) is in a name, slug, brief or tag; each name, brief and line passes C-GUARD6-08's copy check; no entry's `link` holds C-CONTRAST-12's forbidden four letters in any case | ruling R6-12 |
| C-GAL6-09 | pass | Coverage: the 18 brief entries' presets hold all 14 `PRESET_IDS`; each entry has one or two tags in `GALLERY_TAGS` order, none twice; the tag counts equal 6.2 (7, 7, 4, 6, 8, 7) | ruling R6-05, R6-07 |
| C-GAL6-10 | failure | `briefSpec` refuses: a brief holding `#ff0000` (a color) and one matching no term ("Nothing here reads as a mood or a place.") throw `RangeError` naming `briefSpec` and the slug; `briefSpec(null, AI)` and a row of `source: "hero"` throw `TypeError` and `RangeError`; an `ai` without `briefChange` throws `TypeError`; each message starts with `briefSpec`; `galleryData(null)` throws `TypeError` naming `galleryData` | ruling R6-06, R-05 |
| C-GAL6-11 | pass | `entryDescription(entry)` is "<line> <passed> of <required> required contrast checks pass." for every entry and has 50 to 160 characters; the entry page's metadata has the name as title and `/gallery/<slug>` as canonical | ruling R6-17 |
| C-GAL6-12 | failure | `entryOf(3)` and `entriesTagged(5)` throw `TypeError`; `entriesTagged("loud")` throws `RangeError`; `entryOf("Madder")`, `entryOf("nope")` and `entryOf("")` give null; `galleryEntry(null, DEFS[0], [])` throws `TypeError` and `galleryEntry(SPEC, { ...DEFS[6], slug: "Bad Slug" }, [])` `RangeError`; `entryDescription(null)` throws `TypeError` and an entry whose line has 130 characters (161 in all) `RangeError`; each message starts with its function's name | ruling R6-08, R6-17, R-05 |
| C-GAL6-13 | pass | `entriesTagged("all")` and `entriesTagged("unknown")` give the 24 entries in order; `entriesTagged("calm")` the seven of 6.2 in `GALLERY_DEFS` order; `galleryRoutes()` gives the 24 `/gallery/<slug>` in order | ruling R6-07, R6-31 |
| C-GAL6-14 | pass | Property (50 runs, seed 6001): a brief row made of a slug, a name of letters, a seed and 3 to 8 lexicon terms joined by ", " and ending in a period (padded with "and more." to 30 characters), built twice by `briefSpec`, gives one spec id both times, `meta.createdWith` `"lexicon"`, and a spec `DesignSpecSchema` accepts | ruling R6-06, decision J1 |
| C-GAL6-RF2 | failure | Drift: `galleryData` with an `ai` whose `matchLexicon` returns another draft for one brief gives data that is not deep-equal to `GALLERY`, and the comparison's message names that entry's slug and says to run the update with `DYELOT_UPDATE_GALLERY=1` | RF2, ruling R6-04 |
| C-TAG6-01 | pass | `GALLERY_TAGS` is the six of R6-07 in order, frozen; `readTag(undefined)` is `"all"`; `readTag(tag)` is `tag` for each of the six | ruling R6-07 |
| C-TAG6-02 | failure | `readTag("")`, `readTag("CALM")`, `readTag("calm ")`, `readTag("loud")` and `readTag(["calm", "bold"])` are `"unknown"`; `readTag(5)` and `readTag(null)` throw `TypeError` naming `readTag` | ruling R6-07, R-05 |
| C-GAL6-15 | pass | `entryHref("studio", L)` is `/studio#s=L`, and likewise for `explore` and `motion`; `absoluteStudioLink("https://dyelot.vercel.app", L)` is `https://dyelot.vercel.app/studio#s=L`, for `L` each entry's link | ruling R6-14, R6-16 |
| C-GAL6-16 | failure | `entryHref("gallery", L)`, `entryHref("studio", "")`, `entryHref("studio", "a b")` and `entryHref("studio", "x".repeat(65_537))` throw `RangeError`; `entryHref(3, L)` and `entryHref("studio", 3)` `TypeError`; `absoluteStudioLink("http://a.test", L)` and `absoluteStudioLink("https://a.test/x", L)` `RangeError`, `absoluteStudioLink(null, L)` `TypeError`; each names its function | ruling R6-14, R-05 |
| C-CARD6-01 | pass | `galleryCards(GALLERY)` gives 24 cards in order, each `{ slug, name, line, strip, passed, required }` with `strip` the five specimen palettes' step-500 hexes in order and the two counts from `summary.contrast` | ruling R6-09 |
| C-CARD6-02 | pass | `GALLERY_CARDS` (the committed JSON) deep-equals `galleryCards(GALLERY)`; the update switch acts as in C-GAL6-02; `cards.json` is under 16 KB | ruling R6-04, R6-09 |
| C-CARD6-03 | failure | `galleryCards(null)` throws `TypeError`; an entry whose specimen lacks `danger` throws `RangeError` naming `galleryCards` and the slug; `cardOf(1)` throws `TypeError`; `cardOf("nope")` gives null | ruling R6-09, R-05 |
| C-REC6-01 | pass | `receiptExcerpt(RECEIPT_TEXT)`: `format` `"dyelot.check/1"`, `name` "Madder", `checks` 80, `summary` equal to the receipt's, `contrast` equal to its first entry (`C1:foreground/background`, light, required, passing) and `finding` equal to its first finding (`D3`, dark, `primary-600`) | ruling R6-11 |
| C-REC6-02 | pass | `RECEIPT_EXCERPT` (the committed JSON) deep-equals `receiptExcerpt(RECEIPT_TEXT)`; the update switch acts as in C-GAL6-02; a receipt with `findings: []` gives `finding` null | ruling R6-04, R6-11 |
| C-REC6-03 | failure | `receiptExcerpt(5)` throws `TypeError`; `"not json"`, a receipt with `format` `"dyelot.check/2"`, one without `summary`, one with `contrast: []` and one without `findings` throw `RangeError`; each names `receiptExcerpt`; `excerptText(null)` and `receiptLines(null)` throw `TypeError`, and `receiptLines` of an excerpt whose `summary.contrast.required` is not a whole number `RangeError`, each naming its function | ruling R6-11, R6-29, R-05 |
| C-REC6-04 | pass | `receiptLines(RECEIPT_EXCERPT)` gives 9.2's sentences with "dyelot.check/1", "Madder", 78 of 78, "no error", 80 and "foreground on background in light mode", and 78 in the last; with `lint.error` 1 and 3 the caption says "1 error" and "3 errors"; with `finding` null the third caption is "The linter found nothing to note in this design."; `excerptText(x)` is `JSON.stringify(x, null, 2)`; `RECEIPT_LINES` is frozen | ruling R6-29 |

### 14.2 The gallery pages (Task 6.2)

Tests: `tests/e2e/gallery.spec.ts`, with `tests/e2e/flavor-support.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| F-GAL6-01 | pass | `/gallery`: one `h1` "The gallery"; the intro with 6 and 18; the filter `nav` "Filter by mood" with "all" and the six tags in order, "all" carrying `aria-current="page"`; "All 24 designs."; 24 `[data-gallery-card]` in `GALLERY_DEFS` order by `data-slug`; the nav's "gallery" link is current | ruling R6-13 |
| F-GAL6-02 | pass | The cards of `madder` and `kermes`: the `h2` name, the line, "mood: bold" and "mood: calm, editorial", 25 specimen swatches whose computed background colors are the specimen's hexes in order, "Host Grotesk" (one name) and "Schibsted Grotesk and Source Serif 4", "Custom" and "Editorial", "78 of 78 required contrast checks pass", the lot; "Open Madder in the studio" with `href` `/studio#s=<link>` and "Details of Madder" with `/gallery/madder` | ruling R6-14, R6-08 |
| F-GAL6-03 | pass | `/gallery?tag=calm`: "7 of 24 designs are tagged calm.", the seven cards of 6.2 in order, "calm" current and "all" not | ruling R6-13, R6-07 |
| F-GAL6-04 | failure | `/gallery?tag=loud`, `?tag=`, `?tag=calm&tag=bold` and `?tag=%3Cscript%3Ealert(1)%3C%2Fscript%3E`: "That mood is not one of the six, so every design shows.", "All 24 designs.", 24 cards, "all" current; the page's text holds none of the query values; no console error and no dialog | RF2, ruling R6-07, R6-13 |
| F-GAL6-05 | pass | `/gallery/kermes`: the `h1` "Kermes", the line, "Made from this brief by the studio's word list, with no model. It matched: slow, longform, magazine, serif, warm, paper, burgundy."; the `dl`; the four lines of `summaryLines`; two scale figures of 88 swatches each whose colors are `scales.light` and `scales.dark`; the six roles per mode with their hexes; the type table's ten rows; "Open in the studio", "Open in the explorer" and "Open in the motion lab" with `entryHref` hrefs; "Back to the gallery". `/gallery/madder` says "Made from one seed color with the studio's controls." | ruling R6-15 |
| F-GAL6-06 | pass | The round trip: on `/gallery`, "Open Kermes in the studio" opens the studio with the name "Kermes", the lot `KERMES.lot` and the preset select on "Editorial"; the Receipt section passes; no "Rebuild from the parameters"; the export dialog's "Download" is enabled and the zip's `receipt.json` holds `design.createdWith` `"lexicon"` and `summary.pass` true | ruling R6-10, I-M6-02, decision B5 |
| F-GAL6-07 | failure | `/gallery/nope`, `/gallery/Madder` and `/gallery/madder%20` answer 404 with the terminal 404 page; no nav link is current | ruling R6-15 |
| F-GAL6-08 | pass | With clipboard permission, "Copy the studio link" on `/gallery/kermes` puts `<origin>/studio#s=<KERMES.link>` on the clipboard and the status line reads "Copied the studio link." | ruling R6-16 |
| F-GAL6-09 | failure | With `CLIPBOARD_DENY`, the press shows a read-only field holding the link, selected, and "Copy blocked. Select the link below."; no console error and no raw error | ruling R6-16, I-M6-04 |
| F-GAL6-10 | pass | From `/gallery/turquoise`, "Open in the explorer" opens `/explore` whose summary (`[data-explorer-summary]`) names Turquoise, and "Open in the motion lab" opens `/motion` with `#s=<TURQUOISE.link>` and an empty notice line (`[data-lab-notice]`) | ruling R6-15 |
| F-GAL6-11 | pass | Metadata: `/gallery` has the title "Gallery — dyelot", 7.1's description and the canonical `<origin>/gallery`; `/gallery/kermes` has "Kermes — dyelot", `entryDescription(KERMES)` and `<origin>/gallery/kermes`, and its `og:image` and `twitter:image` start with `<origin>/gallery/kermes/opengraph-image` | ruling R6-17 |
| F-GAL6-12 | pass | Color only in specimens: on `/gallery` and `/gallery/kermes`, every element outside `[data-specimen]` has a computed `color`, `background-color` and `border-color` that is transparent, achromatic (OKLCH chroma below 0.02 through the shared sRGB resolver) or madder `#f66c6d` | ruling R6-14, I-M6-06 |
| F-GAL6-13 | pass | No `/_next/static/chunks/*.js` file that `/gallery` or `/gallery/kermes` loads holds the first 40 characters of any entry's link | ruling R6-56, I-M6-03 |

### 14.3 The share cards (Task 6.3)

Tests: `tests/unit/site/gallery-card.test.tsx`, `tests/e2e/share-cards.spec.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-CARD6-04 | pass | `GalleryShareCard({ card: GALLERY_CARDS.cards[i], icon })`'s element tree, for `kermes` and `terre-verte`: holds `// gallery/<slug>`, the name, the line, five strip blocks whose `backgroundColor`s are `card.strip` in order, "<passed> of <required> required checks pass" and the footer `$ open dyelot.vercel.app/gallery/<slug>`; every element with more than one child sets `display: flex`; no style sets `display: grid`; `GALLERY_CARD_ALT` is 8.1's sentence | ruling R6-18 |
| C-CARD6-05 | pass | `MosaicShareCard({ cards: GALLERY_CARDS.cards, icon })`: the headline "24 design systems, each with its receipt" with "receipt" in `SITE.accent`; four rows of six tiles in order, each holding five bands colored by its strip; `MOSAIC_ALT` is 8.2's sentence | ruling R6-19 |
| C-CARD6-RF4 | pass | Fit: for every card, `wrapLines(line, 30 px)` over the card's text width with Geist Mono's advance gives at most two lines, and the name fits one line at 96 px; a probe line of 101 characters is refused by C-GAL6-08's bound before it can reach a card | RF4, ruling R6-12, R6-18 |
| F-SHARE6-01 | pass | `GET /gallery/madder/opengraph-image` answers 200 with `content-type` `image/png`; the body starts with the PNG signature, its `IHDR` reads 1200 × 630, and it is at most 512 KB | ruling R6-18 |
| F-SHARE6-02 | pass | Contents: the PNG of `/gallery/kermes/opengraph-image`, drawn on a canvas in a blank page, holds a row of pixels with, left to right, five runs of at least 150 px whose colors are `KERMES`'s strip within ±1 per channel, and its top-left pixel is `#0a0a0a` ±1 | ruling R6-18 |
| F-SHARE6-03 | pass | `GET /gallery/opengraph-image` answers `image/png`, 1200 × 630; a row of its pixels holds the first card's five strip colors, each as a run of at least 24 px, in order | ruling R6-19 |
| F-SHARE6-04 | failure | `GET /gallery/nope/opengraph-image` and `GET /gallery/Madder/opengraph-image` answer 404 and no `image/png` | RF4, ruling R6-18 |
| F-SHARE6-05 | pass | `/studio`, `/about` and `/` keep the site's card: their `og:image` starts with `<origin>/opengraph-image`; `/robots.txt` disallows only `/api/` and `/connect/callback`, so `/gallery/` and its image routes stay allowed | ruling R6-20, decision D2 |

### 14.4 About (Task 6.4)

Tests: `tests/unit/features/about/copy.test.ts`, `tests/e2e/about-page.spec.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-ABOUT6-01 | pass | `ABOUT_INTRO` and `ABOUT_SECTIONS` equal 11.2's table word for word, in order: four sections `math`, `receipt`, `privacy`, `licenses` with their headings, each paragraph's `text` and `restates`; `ABOUT_LINKS` equals 11.3's two rows; all deep-frozen | ruling R6-21 |
| C-ABOUT6-02 | pass | Copy: no paragraph holds a banned word, `!`, an emoji, "colour", "behaviour", "grey", "centre" or "cancelled", the perceptual formula's trade name that umbrella §5 forbids (in any case), or a host of the never-use list (`bastion.vercel.app`, `paper-trail-backend.onrender.com`, `paper-trail-frontend.vercel.app`, a `-7h27` or `-izzu` host, `abdulmuizz.dev`); every link is `https:` | ruling R6-21, R6-59 |
| C-ABOUT6-03 | pass | Every `restates` entry is an umbrella section 00-design.md has, a ruling whose `**<id> ·` heading exists in its spec file (`R-` in 01, `R2-` in 02, `R3-` in 03, `R4-` in 04, `R5-` in 05, `R6-` in this file), a DR id 00-design.md names, a section of an earlier spec (its number and "of M<k>"), a repository file that exists, or the owner's ruling of 2026-11-05 | ruling R6-21 |
| C-ABOUT6-04 | pass | The copy's numbers are the code's: 80, 40 and 78 against `CONTRAST_CHECKS` (40 per mode, 39 required per mode); "three shared actions" against `VISITOR_CAP`; 768 pixels against the image worker's JPEG bound; 1.06 and 15.5 against the light targets of `scale.ts`; "seven chips" against the steer chips; 3, 4.5 and 7 against the threshold steps | ruling R6-21 |
| C-ABOUT6-05 | failure | The check of C-ABOUT6-04 reports a probe copy that says "79 are required" or "four shared actions", naming the paragraph | ruling R6-21 |
| F-ABOUT6-01 | pass | `/about`: the title "About — dyelot", 11.1's description and the canonical `<origin>/about`; one `h1` "How dyelot works"; the four `h2` in order; every paragraph of `ABOUT_INTRO` and `ABOUT_SECTIONS` shows, in order; the nav's "about" is current | ruling R6-21 |
| F-ABOUT6-02 | pass | `main` holds exactly two links, "The source on GitHub" (`REPOSITORY_URL`) and "Remotion's license" (`https://remotion.pro/license`), each with `rel="noopener noreferrer"`, placed after their paragraphs | ruling R6-21 |
| F-ABOUT6-03 | pass | `/about` holds no color but the chrome's achromatic ones and madder (F-GAL6-12's check with no specimen allowed) | ruling R6-21, I-M6-06 |

### 14.5 The studio's entry hashes (Task 6.5)

Tests: `tests/unit/features/studio/url-entry.test.ts`, `tests/unit/features/studio/store-entry.test.ts`,
`tests/unit/features/studio/view-m6.test.ts`, `tests/e2e/studio-entry.spec.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-HASH6-01 | pass | `readEntry` gives `entry` for 10.1's valid rows: `#color=f66c6d` and `#color=F66C6D` with the seed `normalizeSeed(parseColor("#f66c6d"))`; the three brief rows with "A tea house at dusk", "café & bar" and "tea+house"; `#start=image` | ruling R6-23 |
| C-HASH6-02 | failure | `readEntry` gives `malformed` for every malformed row of 10.1: the six color values, the three brief values, a raw value of 6,001 characters, a decoded value of 501 characters, and the three start values | ruling R6-23 |
| C-HASH6-03 | pass | `readEntry` gives `none` for `#s=<a valid link>`, `#top`, the empty string and `#colors=f66c6d`, and `readHash` still reads `#s=` as before | ruling R6-23 |
| C-HASH6-04 | failure | `readEntry(5)` and `readEntry(null)` throw `TypeError` naming `readEntry` | ruling R6-23, R-05 |
| C-HASH6-05 | pass | The brief is cleaned as the studio's box is: `#brief=` of `%E2%80%AEA%20%20tea%0Ahouse` (a bidirectional control, two spaces, a newline) gives "A tea house"; a decoded value of exactly 500 characters gives an entry of 500 | ruling R6-23 |
| C-HASH6-RF1 | failure | Property (500 runs, seed 6005): for any string `s` of unicode text, `readEntry("#brief=" + s)`, `readEntry("#color=" + s)` and `readEntry("#start=" + s)` never throw and give `entry` or `malformed`; a brief entry's text is plain (`isPlainText`) and at most 500 characters | RF1, ruling R6-23 |
| C-STORE6-01 | pass | First load with `#color=f66c6d` and a draft present: `params` is `{ ...freshParams(), primary: <the seed> }`, preset `"default"`, provenance `"generated"`, `createdWith` `"controls"`, no notice, `entry` null; the draft is not used; after 300 ms of fake time `replaceState` was called with `writeHash(spec)` and the draft holds the new design | ruling R6-24 |
| C-STORE6-02 | pass | First load with `#brief=A%20tea%20house`: a fresh design; `entry` is `{ kind: "brief", text: "A tea house" }`; `takeEntry()` returns it and then null; `client.request` was never called; the persist runs at 300 ms | ruling R6-24 |
| C-STORE6-03 | pass | First load with `#start=image`: a fresh design; `takeEntry()` returns `{ kind: "image" }` once | ruling R6-24 |
| C-STORE6-04 | failure | First load with `#color=zzz` and a draft present: a fresh design, the notice `{ kind: "link", reason: "corrupt", fallback: "fresh" }`, `entry` null; after 300 ms `replaceState` was not called and the draft is unchanged | ruling R6-25 |
| C-STORE6-05 | pass | `loadFromHash("#color=f66c6d")` mid-session changes nothing: spec, notice, history and view are as before | ruling R6-23 |
| C-STORE6-06 | pass | `snapshotOf` without a matching draft: the link of `TURQUOISE` gives preset `"dark-dev-tool"` and a first-load view of mode `dark`, density `dense`; the link of `MADDER` gives null and `DEFAULT_VIEW`; a draft of a `retro-futurism` design with that stored preset reloads with mode `dark`, density `comfortable` | ruling R6-26, decision G6 |
| C-STORE6-07 | pass | `presetView(DEFAULT_VIEW, id)` for each of the 14 presets has that preset's mode and density and `DEFAULT_VIEW`'s other fields; `presetView(v, null)` is `v` itself | ruling R6-26 |
| C-STORE6-08 | failure | `presetView(null, "default")` and `presetView(DEFAULT_VIEW, 3)` throw `TypeError`, `presetView(DEFAULT_VIEW, "nope")` `RangeError`, each naming `presetView` | ruling R6-26, R-05 |
| C-STORE6-09 | pass | A `hashchange` load of `TURQUOISE`'s link takes the preset `"dark-dev-tool"` and keeps the view the visitor had (mode `light`) | ruling R6-26 |
| F-HASH6-01 | pass | `/studio#color=f66c6d` (with `stubSeeds`): the primary seed row reads `#f66c6d` and is locked; within 1 s the address's hash starts with `#s=` and decodes to the shown spec; a reload shows the same lot | ruling R6-23, R6-24 |
| F-HASH6-02 | pass | `/studio#brief=A%20tea%20house%20at%20dusk` at 1440 × 900: the Brief textarea holds "A tea house at dusk" and has focus; the Brief section shows no result line and the mock OpenRouter logged no request | ruling R6-24 |
| F-HASH6-03 | pass | The same at 360 × 740: the inputs drawer is open with the textarea focused; Escape closes the drawer and focus lands on the toolbar's "Inputs" button | ruling R6-24 |
| F-HASH6-04 | pass | `/studio#start=image`: the "Choose an image" input has focus at 1440 × 900, and inside the open inputs drawer at 360 × 740 | ruling R6-24 |
| F-HASH6-05 | failure | `/studio#color=nothex`, `/studio#brief=%E0%A4%A` and `/studio#start=video`: the banner "This link is damaged or cut short, so the studio cannot open it." with "The studio opened a fresh design instead."; the canvas shows a design; no console error; after 1 s the hash is unchanged | ruling R6-25, I-M6-04 |
| F-HASH6-06 | pass | `/studio#s=<TURQUOISE.link>` opens with `[data-canvas]` `data-mode="dark"` and `data-density="dense"` and the preset select on "Dark dev tool"; `/studio#s=<MADDER.link>` opens `light`, `comfortable`, "Custom" | ruling R6-26 |
| F-HASH6-07 | pass | With `STORAGE_DRAFT(<a dark-dev-tool design>, "dark-dev-tool")`, `/studio` restores the draft with `data-mode="dark"` and `data-density="dense"` | ruling R6-26, decision G6 |

### 14.6 Landing, nav and sitemap (Task 6.6)

Tests: `tests/unit/features/landing/start.test.ts`, `tests/unit/features/landing/receipt-section.test.tsx`,
`tests/unit/site/config-m6.test.ts`, `tests/unit/site/nav.test.tsx` (amended), `tests/unit/site/routes.test.ts` (amended),
`tests/e2e/landing-m6.spec.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-START6-01 | pass | `colorHref("#f66c6d")` and `colorHref("F66C6D")` give `/studio#color=f66c6d`; `briefHref("A tea house at dusk")` gives `/studio#brief=A%20tea%20house%20at%20dusk`; `briefHref("  café + bar  ")` gives `/studio#brief=caf%C3%A9%20%2B%20bar`; `briefReady` is true for those and false for "", "   " and "1234"; `IMAGE_HREF` and `GALLERY_HREF` are R6-27's; `START_LINES` equals 9.1's table, frozen | ruling R6-27, R6-28 |
| C-START6-02 | failure | `colorHref("#f66c6")`, `colorHref("red")` and `colorHref("#f66c6dff")` throw `RangeError`, `colorHref(5)` `TypeError`; `briefHref("")`, `briefHref("   ")`, `briefHref("1234 #fff")` and `briefHref("a".repeat(501))` throw `RangeError`, `briefHref(null)` and `briefReady(3)` `TypeError`; each names its function | ruling R6-28, R-05 |
| C-START6-03 | pass | Property (300 runs, seed 6006): for any text with a letter, of 1 to 500 characters after trimming, `readEntry` of the hash `briefHref(text)` builds gives a brief entry whose text is `toPlainText(text, 500).text`; and for any six hex digits, `readEntry` of `colorHref`'s hash gives the color's seed | RF1, ruling R6-23, R6-28 |
| C-REC6-05 | pass | `ReceiptSection` renders the `h2` "The receipt", the opening sentence, three figures whose captions are `receiptLines(RECEIPT_EXCERPT)`'s and whose `pre` texts are `excerptText` of the summary, the contrast entry and the finding, the command `$ node scripts/dyelot-check.mjs` and the closing sentence; no element carries an inline color | ruling R6-29 |
| C-SITE6-01 | pass | `SITE.routes.sitemap` is the six routes of R6-31; `sitemap()` lists 30 absolute URLs, the six then the 24 entry pages in order; `robots()` is C-SITE4-01's value | ruling R6-31 |
| C-SITE6-02 | failure | `sitemapEntries(SITE, ["/studio"])` (a repeat), `sitemapEntries(SITE, ["/api/x"])` (disallowed) and `sitemapEntries(SITE, ["gallery"])` (no leading slash) throw `RangeError`, and `sitemapEntries(SITE, "/gallery")` `TypeError`, each naming `sitemapEntries` | ruling R6-31, R-05 |
| C-SITE6-03 | pass | The metadata of `/gallery` and `/about`: titles "Gallery" and "About", the descriptions of 7.1 and 11.1 (150 and 146 characters), canonicals `/gallery` and `/about` | ruling R6-13, R6-21 |
| C-SITE6-04 | pass | `AppNav` renders "home", "studio", "explore", "motion", "gallery", "about" and "github" in order with their hrefs; `active="gallery"` marks only "gallery" and `active="about"` only "about"; `AppNavProps["active"]` is the five pages or undefined (`expectTypeOf`) | ruling R6-30 |
| F-LAND6-01 | pass | `/`: `start-from.log` sits after the hero's window and before `start.log`; it holds the `h2` "Start a design from", the four `h3` in order and every string of 9.1 | ruling R6-27 |
| F-LAND6-02 | pass | The color form: setting the input to `#0e84b7` and pressing "Open the studio with this color" loads `/studio#color=0e84b7` (the first navigation's URL), and the studio's primary seed row reads `#0e84b7`, locked | ruling R6-27, R6-28 |
| F-LAND6-03 | pass | The brief form: typing "A tea house at dusk" and pressing "Take this brief to the studio" loads the studio with the Brief box holding it, focused | ruling R6-27, R6-28 |
| F-LAND6-04 | failure | The brief form with "   " or "1234": the page stays on `/`, the status reads "Write a few words first.", focus stays in the textarea, and no navigation starts | ruling R6-28, I-M6-04 |
| F-LAND6-05 | pass | "Open the studio's image drop" opens `/studio#start=image` with "Choose an image" focused; "Browse the gallery" opens `/gallery` | ruling R6-27 |
| F-LAND6-06 | pass | The receipt section follows the story; its captions read 9.2's sentences with 78, 78, "no error", 80 and "foreground on background in light mode"; each `pre`'s text parses to the matching part of `RECEIPT_EXCERPT`; the command `pre` reads `$ node scripts/dyelot-check.mjs` | ruling R6-29 |
| F-LAND6-07 | pass | `start.log` holds, as siblings in one `div`, the links to `/studio`, `/explore`, `/motion`, `/gallery`, `/about` and the repository, reading "open the studio" to "open the about page" | ruling R6-32 |
| F-NAV6-01 | pass | At 1280 × 800 the nav's seven links share one row in 9.3's order; "gallery" is current on `/gallery` and `/gallery/kermes`, "about" on `/about` | ruling R6-30 |
| F-NAV6-02 | pass | At 360 × 740 on `/`, `/gallery`, `/gallery/kermes`, `/about`, `/explore`, `/motion`, `/connect` and the 404 page: the seven links are visible, each at least 32 px tall and 24 px wide, with at most two distinct top edges; the document does not scroll sideways; the active link's mark lies inside the nav's box | ruling R6-30, decision C3 |
| F-NAV6-03 | pass | `/sitemap.xml` lists the 30 URLs of C-SITE6-01 in order | ruling R6-31 |
| F-NAV6-RF5 | pass | At 320 × 640 on `/` and `/gallery`, the nav still holds its seven links in at most two rows and nothing scrolls sideways | RF5, ruling R6-30 |

### 14.7 Templates (Task 6.7)

Tests: `tests/unit/features/preview/load.test.ts`, `tests/e2e/templates-lazy.spec.ts`, the amended
`tests/e2e/inspector.spec.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-TPL6-01 | pass | `TEMPLATE_LOADERS` has the six `TEMPLATE_IDS`, frozen; each resolves to a module whose `default` is that template's component | ruling R6-33 |
| C-TPL6-02 | pass | `preloadTemplates("landing", schedule, fakes)` with a fake scheduler calls no loader until the scheduled callback runs, then calls the other five once each in `TEMPLATE_IDS` order; the cancel it returns, called before the run, stops them all; a fake loader that rejects is not called again and leaves no unhandled rejection | ruling R6-33 |
| C-TPL6-03 | pass | `idleScheduler` with `requestIdleCallback` schedules with `{ timeout: 2000 }` and cancels with `cancelIdleCallback`; without it, with `setTimeout(run, 1000)` and `clearTimeout` | ruling R6-33 |
| C-TPL6-04 | failure | `preloadTemplates("nope", s)` throws `RangeError` and `preloadTemplates("landing", 3)` `TypeError`; `idleScheduler(null)` throws `TypeError`; each names its function; `TEMPLATE_LINES` is R6-33's three strings, frozen | ruling R6-33, R-05 |
| F-TPL6-01 | pass | With `NO_IDLE`, the studio's first load fetches the landing template's chunk (probe 3's marker) and none of the other five; choosing "dashboard" fetches its chunk and shows `[data-template="dashboard"]` | ruling R6-33, decision G1 |
| F-TPL6-02 | pass | Without `NO_IDLE`, after the load the other five chunks are fetched with no switch (the response list, polled) | ruling R6-33 |
| F-TPL6-03 | pass | With `VT_RECORD` and `NO_IDLE`, a switch to "settings" before its chunk arrives makes one `startViewTransition` call whose record holds `::view-transition-group(dyelot-template)`; the old template stays in the canvas until settings shows, and the loading sentence never appears | ruling R6-33, R5-46, probe 3 |
| F-TPL6-04 | pass | Under `emulateMedia({ reducedMotion: "reduce" })` with `NO_IDLE`, choosing "editorial" shows "Loading the template…" (`role="status"`) and then the template; every animation `VT_RECORD` holds lasts 0 ms | ruling R6-33 |
| F-TPL6-05 | failure | With `ABORT_CHUNK(page, <the dashboard marker>)` and `NO_IDLE`, choosing "dashboard" shows "This template could not load." and "Try again" (`role="alert"`), no raw error; after `release()`, "Try again" shows the dashboard | ruling R6-33, I-M6-04 |
| F-TPL6-RF3 | pass | With `NO_IDLE` and motion allowed, choosing "dashboard" and then "mobile" before either chunk arrives ends with `[data-template="mobile"]` shown, at most two `startViewTransition` calls, and no loading sentence | RF3, ruling R6-33 |
| F-TPL6-06 | pass | The settings template's bars (if probe 6 keeps G2): F-CANVAS-11's clip-edge check passes for `.st-top` and `.st-save-bar` with scroll containers counted as clip boxes, and F-TPL-27 passes unchanged. If probe 6 drops G2, this row moves to section 18 with it | ruling R6-34, decision G2 |

### 14.8 Accessibility fixes (Task 6.8)

Tests: `tests/unit/features/flavor/video-m6.test.ts`, `tests/unit/features/explore/flat-view-m6.test.tsx`,
`tests/e2e/fixes-m6.spec.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-FLAV6-01 | pass | `brandDescription(brandProps(HERO, "light"))` is 13.1's sentence for Madder with no one-liner; for `KERMES`'s spec it holds the brief in quotation marks; the fonts are the first families of `props.fonts`' stacks, unquoted | ruling R6-35 |
| C-FLAV6-02 | failure | `brandDescription(null)` throws `TypeError`; props with four palettes throw `RangeError`; props with `checks.passed` `"78"` throw `TypeError`; each names `brandDescription` | ruling R6-35, R-05 |
| C-FLAV6-03 | pass | `FLAVOR_LINES` holds 6.4's keys of M5 and `"pause-background"` "Pause the background" and `"pause-video"` "Pause the video", frozen | ruling R6-36 |
| C-FLAV6-04 | pass | Two `FlatView`s rendered on one page have distinct caption and list ids, and each figure's `aria-labelledby` names its own caption | ruling R6-38 |
| F-FIX6-01 | pass | In the Flavor dialog, `[data-brand-player]` has `role="figure"`, the name "Brand video preview" and the description `brandDescription` of the design; the frame inside is `aria-hidden`; axe with `AXE_TAGS` and M5's one exclusion finds no violation | ruling R6-35, decision G3 |
| F-FIX6-02 | pass | The dialog's Tab order is "Pause the background", "Pause the video", "Render the brand video", "Record the shader loop", "Close", every name unique in the dialog | ruling R6-36 |
| F-FIX6-03 | failure | On `/explore`, after `loseContext`, pressing "Restart the 3D view" with the keyboard leaves focus on the "Turn" slider, never on `body`, and the view returns to `3d` | ruling R6-37 |
| F-FIX6-04 | pass | The hero's "Pause" keeps its name "Pause" (F-A11Y5-02's hero order stands) | ruling R6-36 |

### 14.9 Code fixes (Task 6.9)

Tests: `tests/unit/engine/guard-support-m6.test.ts`, `tests/unit/export/guards.test.ts`,
`tests/unit/features/landing/story-m6.test.ts`, `tests/unit/features/studio/token-row-m6.test.ts`,
`tests/unit/features/loaders-m6.test.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-HYG6-01 | pass | `codeFiles` on a temporary tree (`a/b.ts`, `a/c/d.tsx`, `a/e.md`, `a/__entry-probe__/x.ts`) gives exactly `a/b.ts` and `a/c/d.tsx`; on `src` it gives more than 300 files | ruling R6-39 |
| C-HYG6-02 | failure | `codeFiles` of a missing folder and of a folder holding only `e.md` throws `RangeError` naming `codeFiles`; `codeFiles(3)` throws `TypeError`; a fake `read` that throws `EACCES` for a child folder, or `ENOENT` for a child that is not a probe, makes it throw an error naming that folder | ruling R6-39, decision G4 |
| C-HYG6-03 | pass | A fake `read` that throws `ENOENT` for `<dir>/__entry-probe__` (gone mid-walk) is skipped, and the walk returns every other file | ruling R6-39 |
| C-HYG6-04 | pass | `src/features/ai/load.ts`, `src/features/export/useBundle.ts` and `src/features/import/ImportDialog.tsx` each define their loader as `loadOnce(() => import("<entry>"))` (read from the syntax tree) and hold no `loading ??=` memo; `loadAi`, `loadExport` and `loadImport` keep their exported names | ruling R6-40 |
| C-HYG6-05 | pass | `describeType` gives `"null"`, `"array"`, `"number"` and `"object"`; `httpsOrigin("https://a.test", "f")` gives `"https://a.test"`; `bundle.ts` and `flavor.ts` import both from `./guards` and declare neither | ruling R6-41 |
| C-HYG6-06 | failure | `httpsOrigin(3, "buildBundle")` throws `TypeError` "buildBundle: origin must be a string, got number"; `httpsOrigin("http://a.test", "flavorFiles")` and `httpsOrigin("https://a.test/x", "flavorFiles")` throw `RangeError` "flavorFiles: origin must be an https origin with no path, got <JSON>"; `buildBundle` and `flavorFiles` throw those exact messages for those origins | ruling R6-41, R-05 |
| C-HYG6-07 | failure | `storySteps({})` throws `TypeError` "storySteps: spec.color must be an object, got undefined"; for each path of 13.5 in order, a spec whose earlier paths hold and whose path is missing (or not an array) throws a `TypeError` naming that path; no message lacks the `storySteps:` start | ruling R6-42 |
| C-HYG6-08 | failure | `tokenRow({}, "light", "primary", 500)` throws `TypeError` naming `spec.color`; `tokenRow({ color: { palettes: {} } }, ...)` names `spec.color.palettes.primary`; every message starts with `tokenRow:` | ruling R6-42 |

### 14.10 Audits (Task 6.10)

Tests: `tests/unit/scripts/audit-core.test.ts` with the trimmed reports `tests/unit/scripts/fixtures/lhr-*.json`,
`tests/e2e/lighthouse-m6.spec.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-AUD6-01 | pass | `AUDIT_ROUTES`, `FORM_FACTORS`, `A11Y_FLOOR` and `CATEGORIES` are R6-44's values, frozen; `routeName` gives "home", "gallery", "gallery-madder", "about", "studio", "explore", "motion" and "connect" | ruling R6-44 |
| C-AUD6-02 | pass | On a passing fixture report: `categoryScores` gives the four scores; `auditRecord` gives 12.2's record with the five metrics and the script row; `a11yFailures` is empty and `a11yVerdict` passes | ruling R6-45 |
| C-AUD6-03 | failure | On a fixture whose `color-contrast` and `button-name` fail (accessibility 0.88): `a11yVerdict` fails with score 0.88 and the failures `["button-name", "color-contrast"]`; an audit of weight 0 that fails is not listed | ruling R6-44 |
| C-AUD6-04 | failure | `categoryScores`, `auditRecord`, `a11yFailures` and `a11yVerdict` each throw `TypeError` for `null`, and `RangeError` for a report without `categories`, one with a `runtimeError` and one whose accessibility score is null, naming the function | ruling R6-44, R-05 |
| C-AUD6-05 | pass | `auditPlan(["/a", "/b"], ["desktop", "mobile"], 3)` gives 12 items: run 1 `/a` desktop, `/a` mobile, `/b` desktop, `/b` mobile, then run 2 the same, then run 3; `ttfbPlan(["/", "/r", "/g"], 10)` gives 30 items, each round the three paths in order | ruling R6-46, R6-47 |
| C-AUD6-06 | failure | `auditPlan([], FORM_FACTORS, 3)`, `auditPlan(AUDIT_ROUTES, FORM_FACTORS, 0)`, `(…, 11)` and `(…, 1.5)` throw `RangeError`; `median([])` and `median([1, Number.NaN])` throw `RangeError`; `scriptTotals(null)` throws `TypeError` and `scriptTotals([{ bytes: "1", transferred: 1 }])` `RangeError`; `ttfbPlan([], 10)` and `ttfbPlan(["/"], 0)` throw `RangeError`; `routeName(3)` and `auditTable(null)` throw `TypeError` and `routeName("gallery")` `RangeError`; each names its function | ruling R6-46 to R6-48, R-05 |
| C-AUD6-07 | pass | `median([3, 1, 2])` is 2 and `median([4, 1, 3, 2])` 2.5; `scriptTotals` sums files, bytes and transferred bytes; `auditTable` gives 12.4's three tables with scores as integers 0 to 100, times in whole milliseconds and sizes in KB to one decimal, rows in `AUDIT_ROUTES` order | ruling R6-46 to R6-48 |
| C-AUD6-08 | pass | Property (500 runs, seed 6010): for any non-empty array of finite numbers, `median` lies between its minimum and maximum and equals the middle of the sorted array (the mean of the two middle values for an even length) | ruling R6-46 |
| F-LH6-01 | pass | `/` at desktop: Lighthouse's accessibility score is at least 0.95, and the record is written | ruling R6-44, decision F1 |
| F-LH6-02 | pass | `/` at mobile: accessibility at least 0.95 | ruling R6-44 |
| F-LH6-03 | pass | `/gallery` at desktop: accessibility at least 0.95 | ruling R6-44 |
| F-LH6-04 | pass | `/gallery` at mobile: accessibility at least 0.95 | ruling R6-44 |
| F-LH6-05 | pass | `/gallery/madder` at desktop: accessibility at least 0.95 | ruling R6-44 |
| F-LH6-06 | pass | `/gallery/madder` at mobile: accessibility at least 0.95 | ruling R6-44 |
| F-LH6-07 | pass | `/about` at desktop: accessibility at least 0.95 | ruling R6-44 |
| F-LH6-08 | pass | `/about` at mobile: accessibility at least 0.95 | ruling R6-44 |
| F-LH6-09 | pass | `/studio` at desktop: accessibility at least 0.95 | ruling R6-44 |
| F-LH6-10 | pass | `/studio` at mobile: accessibility at least 0.95 | ruling R6-44 |
| F-LH6-11 | pass | `/explore` at desktop: accessibility at least 0.95 | ruling R6-44 |
| F-LH6-12 | pass | `/explore` at mobile: accessibility at least 0.95 | ruling R6-44 |
| F-LH6-13 | pass | `/motion` at desktop: accessibility at least 0.95 | ruling R6-44 |
| F-LH6-14 | pass | `/motion` at mobile: accessibility at least 0.95 | ruling R6-44 |
| F-LH6-15 | pass | `/connect` at desktop: accessibility at least 0.95 | ruling R6-44 |
| F-LH6-16 | pass | `/connect` at mobile: accessibility at least 0.95 | ruling R6-44 |
| F-LH6-17 | failure | `runLighthouse(<origin>/, "tablet")` rejects with a `RangeError` and `runLighthouse(5, "desktop")` with a `TypeError`, each naming `runLighthouse` and launching no browser | ruling R6-44, R-05 |

### 14.11 Composed flows (Task 6.11)

Tests: `tests/e2e/a11y-m6.spec.ts`, `tests/e2e/lazy-m6.spec.ts`, `tests/e2e/security-m6.spec.ts`. The axe runs use M5's
`AXE_TAGS` (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`).

| Id | Kind | Case | Origin |
|---|---|---|---|
| F-A11Y6-01 | pass | axe finds no violation on `/gallery`, `/gallery?tag=calm`, `/gallery/kermes`, `/gallery/turquoise`, `/about` and `/` (scrolled through the start-from and receipt sections, under reduced motion as M0's test runs), at 1280 × 800 and 360 × 740 | ruling R6-13, R6-15, R6-21, R6-27, I-M6-05 |
| F-A11Y6-02 | pass | At 360 × 740, `/gallery`, `/gallery/kermes`, `/about` and `/` do not scroll sideways (`overflowOf` of M5) | ruling R6-13, R6-15, R6-21, R6-27 |
| F-A11Y6-03 | pass | Keyboard: on `/gallery`, Tab from the filter's "all" reaches the six tags, then "Open Madder in the studio" and "Details of Madder"; on `/gallery/kermes`, the three open links, "Copy the studio link" and "Back to the gallery" in order; each stop shows the focus ring and a hit area of at least 24 × 24 px | ruling R6-14, R6-15 |
| F-A11Y6-04 | pass | Each new page has one `h1`, and its headings never skip a level; on `/` the order is `h1`, the hero, the start-from `h2` and `h3`s, the story's `h2` and `h3`s, the receipt's `h2` | ruling R6-27, R6-29 |
| F-A11Y6-05 | pass | `/` keeps the color rule of I-M6-06 in its new sections: inside `start-from.log` and `[data-receipt]` every color is achromatic or madder | ruling R6-27, R6-29, I-M6-06 |
| F-LAZY6-01 | pass | No chunk that `/gallery`, `/gallery/kermes` or `/about` loads holds the engine's marker `dyelot.engine/1`, the export's `dyelot.check/1`, three's `THREE.WebGLRenderer` or Remotion's `No video config found`; `/` loads none of the engine's, the export's or Remotion's | ruling R6-56, I-M6-03, R5-61 |
| F-LAZY6-02 | pass | The studio's first load, with `NO_IDLE`, still fetches no chunk of three, R3F, Remotion or Mediabunny (R5-61's markers) and only the landing template's | ruling R6-33, R5-61 |
| F-SEC6-01 | pass | `/gallery`, `/gallery/kermes` and `/about` answer with 12.2 of M5's policy and a fresh nonce per response, the headers of R4-27, and no `securitypolicyviolation` on load; `/gallery/madder/opengraph-image` answers outside `/api/`'s policy | ruling R6-49 |
| F-SEC6-02 | pass | `connect-src` on every page is exactly `'self' https://openrouter.ai https://www.remotion.pro`; no request from `/gallery`, `/gallery/kermes` or `/about` leaves the origin | ruling R6-22, R6-49 |

### 14.12 Repository guards (every task)

Tests: `tests/unit/engine/repo-guards-m6.test.ts`, `tests/unit/scripts/gate.test.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-GUARD6-01 | pass | The ids are read from the rows of `docs/specs/06-gallery.md` between `\n## 14. ` and `\n## 15. ` (`^\| [CF]-[A-Z0-9]+-[A-Z0-9]+ \|`, one per row, each once); every `C-` id appears whole in a `describe` or `it` title under `tests/unit` and every `F-` id in a `test` title under `tests/e2e`, read from each file's syntax tree; a probe id with no title is reported | ruling R6-54, R6-60 |
| C-GUARD6-02 | pass | `package.json`'s `devDependencies` hold `lighthouse` exactly `13.5.0` and its `dependencies` do not; the `dependencies` key set is M5's; every pin of C-GUARD5-02 holds | ruling R6-43, R6-53 |
| C-GUARD6-03 | pass | `vitest.config.ts` holds section 15's lists and floors: `GALLERY_HELPERS`, `ABOUT_HELPERS`, `LANDING_HELPERS` with `receipt` and `start`, `PREVIEW_HELPERS` with `templates/load`; `tests/unit/features/{gallery,about}/**` run in `web`, `tests/unit/scripts/**` in `core`; each named file exists | ruling R6-54 |
| C-GUARD6-04 | pass | `gallery.json` is imported only by `data.ts`; `data.ts` as a value only by `src/app/gallery/**`, `src/app/sitemap.ts`, `src/features/gallery/{GalleryCard,Specimen}.tsx` and tests; `build.ts` and `defs.ts` (as values) only by tests and `build.ts`; `cards.ts` only by the two image routes and tests; a probe import of `data.ts` from a `"use client"` file is reported | ruling R6-56 |
| C-GUARD6-05 | pass | The static value-import graphs of `CopyLink.tsx`, `StartFrom.tsx` and `Hero.tsx` reach no file under `src/engine`, `src/spec` or `src/export`; `start.ts`, `receipt.ts`, `tags.ts`, `links.ts`, `cards.ts` and `data.ts` import nothing as a value but JSON and each other (`import type` exempt); a probe of each is reported | ruling R6-28, R6-56, I-M6-03 |
| C-GUARD6-06 | pass | `build.ts` names `@/ai` only in an `import type`; C-GUARD4-03 finds no static `@/ai` import under `src/features` with it in place; a probe value import of `@/ai` in `build.ts` is reported | ruling R6-06 |
| C-GUARD6-07 | pass | The two `opengraph-image.tsx` files import only `next/og`, `next/navigation`, `@/features/gallery/cards`, `@/lib/site/assets`, `@/lib/site/config` and `@/lib/site/gallery-card`; neither imports `data.ts` or `gallery.json` | ruling R6-18 |
| C-GUARD6-08 | pass | Copy: `START_LINES`, `RECEIPT_LINES`, `receiptLines(RECEIPT_EXCERPT)`, `ABOUT_INTRO`, `ABOUT_SECTIONS`, `ABOUT_LINKS`' labels, `TEMPLATE_LINES`, `FLAVOR_LINES`' new keys, `brandDescription` of every entry's `brandProps`, `GALLERY_CARD_ALT`, `MOSAIC_ALT`, every entry's name, brief and line, and the string literals of `GalleryCard.tsx`, `Specimen.tsx`, `CopyLink.tsx`, `StartFrom.tsx`, `ReceiptSection.tsx` and the three page files hold no banned word, no `!`, no emoji, and none of "colour", "behaviour", "cancelled", "grey" or "centre" | ruling R6-59 |
| C-GUARD6-09 | pass | No analytics: `package.json` holds none of `@vercel/analytics`, `@vercel/speed-insights`, `@sentry/nextjs`, `@sentry/browser`, `posthog-js`, `plausible-tracker`, `mixpanel-browser`, `react-ga4` or a package under `@segment/`; no file under `src` names `googletagmanager.com`, `google-analytics.com`, `plausible.io`, `posthog.com`, `segment.io`, `sentry.io` or `/_vercel/insights`; a probe of each is reported | ruling R6-22 |
| C-GUARD6-10 | pass | Purity: C-REPO-01's and C-GUARD3-02's scanners list `src/export/guards.ts` and find nothing in it; the same scan finds no DOM, storage, network, clock, randomness, environment or locale API in `src/features/gallery/{tags,defs,data,cards,links,build}.ts`, `src/features/landing/{start,receipt}.ts`, `src/features/about/copy.ts` and `scripts/audit-core.mjs` | ruling R6-03 |
| C-GUARD6-11 | pass | No file under `tests/unit` but `guard-support.ts` calls `readdirSync` with `recursive`; the guard files walk folders only through `codeFiles` or `filesUnder`; a probe file that does is reported | ruling R6-39, R6-60 |
| C-GUARD6-12 | pass | No entry's name, slug, brief or tag, no About paragraph and no string of 9.1 or 9.2 holds the perceptual formula's trade name (in any case) or a host of the never-use list | ruling R6-12, R6-21, R6-59 |

## 15. Coverage

`pnpm vitest run --coverage` keeps M5's scope and floors and adds:

| Scope | Lines, statements, functions | Branches |
|---|---|---|
| The whole coverage scope | 80, 80, 75 | 70 |
| `GALLERY_HELPERS`: `src/features/gallery/{tags,defs,data,cards,links,build}.ts`, each by name | 95 | 90 |
| `LANDING_HELPERS` gains `src/features/landing/{receipt,start}.ts` | 95 | 90 |
| `ABOUT_HELPERS`: `src/features/about/copy.ts` | 95 | 90 |
| `PREVIEW_HELPERS` gains `src/features/preview/templates/load.ts` | 95 | 90 |
| `STUDIO_HELPERS` (`url.ts` and `view.ts` gain `readEntry` and `presetView`), `FLAVOR_HELPERS` (`video.ts` gains `brandDescription`) | 95 | 90 |
| `src/export/**` (now with `guards.ts`) | 90 | 85 |
| `src/lib/site/**` (now with `gallery-card.tsx`) | 80, 80, 75 | 70 |

`scripts/audit-core.mjs` sits outside the coverage scope, as `scripts/copy-fonts.mjs` does; its C-AUD6 cases cover it.
The pages, the image routes, `GalleryCard.tsx`, `Specimen.tsx`, `CopyLink.tsx`, `StartFrom.tsx`, `ReceiptSection.tsx`,
the store's entry path and `scripts/{lighthouse,audit-site}.mjs` are covered by the flows, not by floors. Each case is
written from its row, never from an uncovered-line report.

## 16. Changes to M1 to M5 cases

| Case | Was | Now | Why |
|---|---|---|---|
| C-GUARD5-05 (M5) | `heroes.ts` is imported as a value only by `src/app/page.tsx`, `src/app/explore/page.tsx` and `src/app/motion/page.tsx` | Also by `src/features/gallery/build.ts`, which only tests import as a value (C-GUARD6-04); the rest of the row stands | R6-05, R6-56 |
| C-SITE5-02 (M5), C-SITE4-01 (M4) | `SITE.routes.sitemap` is the four routes and `sitemap()` lists them | The six routes of R6-31, and `sitemap()` lists 30 URLs (C-SITE6-01); `robots()` is unchanged | R6-31 |
| T-FE-20 (M0, amended in M4 and M5) | `SITE.routes.sitemap` is `["/", "/studio", "/explore", "/motion"]` | `["/", "/studio", "/explore", "/motion", "/gallery", "/about"]`; `disallow` unchanged | R6-31 |
| F-HOME-03 (M2, amended in M5), F-SEC4-03 (M4, amended in M5) | `/sitemap.xml` lists the four routes in order | The 30 URLs of C-SITE6-01, in order | R6-31 |
| M0's sitemap test (`tests/unit/site/routes.test.ts`, "lists the sitemap routes, as absolute URLs, once each") | The four routes | The 30 URLs, once each | R6-31 |
| C-SITE5-04 (M5) | `AppNav` renders five links; `active` is `"home" \| "explore" \| "motion"` | Seven links in R6-30's order; `active` adds `"gallery"` and `"about"` (C-SITE6-04) | R6-30 |
| F-HOME5-04 (M5) | At 360 × 740 the nav's five links share one row | At 360 × 740 the seven links fit in at most two rows (F-NAV6-02); the pages still fit with no sideways scroll | R6-30 |
| F-HOME-01 (M2, amended in M5) | One `div` holds the studio, explorer, motion lab and repository links | The same `div` also holds the gallery and about links (F-LAND6-07) | R6-32 |
| C-DLG-04 (M5) | `FLAVOR_LINES` holds 6.4's six keys | Also `"pause-background"` and `"pause-video"` (C-FLAV6-03) | R6-36 |
| F-A11Y5-02 (M5), "the Flavor dialog's order, ring and hit area" | The stops are "Pause", "Pause", "Render the brand video", "Record the shader loop", "Close" | "Pause the background", "Pause the video", then the same three (F-FIX6-02) | R6-36 |
| F-FLAVOR-01, F-FLAVOR-02, F-FLAVOR-03, F-FLAVOR-05, F-FLAVOR-06 (M5) | A section's "Pause" is found by the name "Pause" | By "Pause the background" in Background and "Pause the video" in Brand video; each row's assertions stand | R6-36 |
| C-HASH-16 (M2) | A valid hash beats a draft: `paramsOfSpec`, preset null | `paramsOfSpec`, preset `presetOf(spec)`, and the first load's view `presetView(DEFAULT_VIEW, preset)` | R6-26 |
| C-DRAFT-13 (M2) | A matching draft with a bad field is not used: `paramsOfSpec`, preset null | `paramsOfSpec`, preset `presetOf(spec)` | R6-26 |
| M2's store test "a draft restore whose params fail falls back to paramsOfSpec and drops the preset" (`tests/unit/features/studio/store-persist.test.ts`) | Preset null | Preset `presetOf(spec)` | R6-26 |
| F-CANVAS-11 (M2), "the outline of a part at a clip edge shows whole" | Leaves out the settings template's top and save bars | Includes `.st-top` and `.st-save-bar`, and counts a scroll container's padding box as a clip box (F-TPL6-06); unchanged if probe 6 drops G2 | R6-34 |
| C-REPO-M2-03 (M2), C-GUARD4-10 (M4), C-GUARD5-09 (M5) | The coverage include and floors of M5's section 15 | Also section 15's new lists (C-GUARD6-03) | R6-54 |
| M5's spec 13.3 | The Brand video region keeps its name | Plus the figure and its description of R6-35 (a note in 13.3) | R6-35 |

Every other M1 to M5 case stands as written (I-M6-07), among them C-LAND5-02 (the hero cards), F-HERO-01 to 06 (the
hero's "Pause" keeps its name, F-FIX6-04), F-A11Y5-01 (axe on `/`, with the new sections inside its page), F-SEC4-01
and F-SEC4-02 (their page lists stay; F-SEC6-01 covers the new pages), F-TPL-27, F-VT-01 to 07 (one `startViewTransition`
per switch, now with lazy templates, F-TPL6-03), F-LAZY4-01 and F-LAZY5-01, every golden, and the guards C-GUARD3-01 to
04, C-GUARD4-01 to 12 and C-GUARD5-01 to 12 (each walk now positive by R6-39's construction).

## 17. Review Focus

The five input classes most likely to bite a visitor, each with the tests that pin it:

| RF | Input | Cases |
|---|---|---|
| RF1 | Entry hashes at their edges: a broken escape, 501 characters, a `+`, a second `#`, a `#start` value other than `image`, any unicode | C-HASH6-RF1, C-HASH6-02, C-HASH6-05, C-START6-03, F-HASH6-05 |
| RF2 | Data that drifts and queries that probe: the engine changes and the committed files go stale; `?tag=` empty, repeated or holding markup; an unknown or capitalized slug | C-GAL6-RF2, C-GAL6-02, F-GAL6-04, F-GAL6-07 |
| RF3 | Templates that load late or not at all: two switches before either chunk arrives, a failed chunk, reduced motion during a load | F-TPL6-RF3, F-TPL6-03, F-TPL6-04, F-TPL6-05 |
| RF4 | Share cards at their limits: the longest brief and name, an unknown slug, the image route's size | C-CARD6-RF4, F-SHARE6-01, F-SHARE6-04 |
| RF5 | Narrow screens: the nav's two rows at 320 and 360 px, the gallery and About at 360 px, Lighthouse at mobile | F-NAV6-RF5, F-NAV6-02, F-A11Y6-02, F-LH6-02 |

## 18. Deferred, and what is not scheduled

| Item | Comes from | Milestone |
|---|---|---|
| The Sanzo Wada combinations | umbrella §5 and §7; M1 section 18; decision A2 | Not scheduled: the rights check of 2026-11-07 was not clean; revisit after 31 December 2029 (the last volume's likely US term) or with written permission from the publisher |
| A gallery of 100 to 200 model-made, human-checked briefs (AI02) | 04-ai.md section 18; decision A2 | Not scheduled (M6 makes no model call) |
| A share card for any studio link, and a short-link service | umbrella §3 and §15; decisions A2, D2 | Not scheduled: the hash never reaches a server, and a short link needs server storage |
| Each family's italic files for the canvas and the exports | 02-studio.md section 9; 03-export.md section 14 | Not scheduled (owner approval item 6) |
| Chrome text at 11 px | 02-studio.md section 9 | Not scheduled (owner approval item 6) |
| A fluid `display` step for the `poster` context | 02-studio.md section 9; 03-export.md section 14 | Not scheduled |
| Launch and marketing copy | decision A2 | Outside the milestones: the owner's, with `knowledge/research/index.md`'s rules |
| Removing "(experimental)" from the on-device switch | 04-ai.md section 18 | When the owner records the on-device eval |
| "Read the vibe" on the device, an embedding model, WebLLM, Trusted Types, a pool meter, a shared cache, a per-IP cap, a "more contrast" chip | 04-ai.md section 18 | Not scheduled, as M4 left them |
| Remotion 5.0's terms | 05-motion-3d.md section 18 | When Remotion 5.0 ships |
| The settings template's clip margin, if probe 6 drops it | decision G2 | Not scheduled; the row is struck if probe 6 passes |
| Lazy templates, if probe 3 keeps them eager | decision G1 | Not scheduled; the row is struck if probe 3 passes |
| `describeType`'s other private copies in `src/export/` (`model.ts`, `design-md.ts` and twelve more), which name an array "object" | R6-41 | Not scheduled: sharing them would change their messages for an array |
| Cosine and Poline-style generators, tokens for the unexpressed style traits, animations in `theme.css`, WebGL in the canvas templates, GIF, glTF, dotLottie, WebGPU, audio, a motion budget | 05-motion-3d.md section 18 | Not scheduled, as M5 left them |

M5's remaining minors (the M5 ledger's deferred list, `m5-rulings-and-minors.md`), apart from the six decision G5
chose and the two of G3 and G4:

| Items | Disposition |
|---|---|
| THREE.Clock's deprecation warning per canvas; OrbitControls' inertia after "Reset view"; `ViewBoundary` mapping any scene error to the no-WebGL2 sentence; `FlatView` not memoized; `gamutSlice`'s L 0 and 1 special case and C-SLICE-03; C-SOLID-04's mirrored threshold | Not scheduled (the explorer works and its flows pass; the warning is upstream's) |
| `springAt` with a NaN sample; `mergeParams` and `parseParams` checking only that `motionTokens` is a record and storing normalized tokens; `fieldText`'s shape check; `readField` taking `0x10`; RF5's binary-string property; C-MOT5-04's computed id | Not scheduled (inputs come from checked specs and the lab's bounded fields) |
| `brand-intro.tsx`'s `fit-content`; the receipt fade's one-frame floor; the specimen card's entrance; no P3 case for `brandProps`; the `as` casts in `brand.ts`; C-FEX-19's order; F-FEX-02's nine paths | Not scheduled (each change would re-run the goldens) |
| `record.ts`'s abort edges; `useVideoJob`'s late start; `reduced` read at mount; no "Loading" cue for the Flavor dialog and an empty status region's first announcement; three status regions repeating a class string; F-FLAVOR-08's fixed 6 s wait | Not scheduled (no flow fails, and Lighthouse and axe pass) |
| `Story.tsx` pairing heading and paragraph by index; the story-css parser not mutation-checked; F-VT-03 without a poll and F-VT-07's fixed wait; C-GUARD5-08's CSP probe; `watchReducedMotion` calling during subscribe; `Scales.tsx`'s `slice(0, -2)` | Not scheduled |
| No flow for a 360 px drawer staying open when Escape closes a row; thin light and dark coverage; thin Tab-order coverage beyond the two "Pause"s; the lenient hit-area check; F-A11Y5-04's title; no flow for no-WebGL with reduced motion; the hero's focus-to-"Next palette" branch; F-HERO-RF1; "Pause" at 28 px beside "Next palette" at 32 px | Not scheduled (Lighthouse's target-size audit and F-A11Y6 cover the new pages) |
| The inline Playwright `Page` type and `flavorSwitch` in two files; policy violations read from the last document; a third copy of the violation fixture; the watch fixture's evaluate on a closed page; C-GUARD5-03's bare side-effect import; the prefetch removal's red test | Not scheduled (test hygiene; no flow depends on them) |
| Spec 05's 10.2 sentence on `[data-ratio]`; the R5-08 sentence's wrap; `GAMUT_NAMES` and `assertJobDeps` exported unlisted; the biome-ignore count; commits citing later amendments; the bisect gap at 6039c28; the minors not enumerated in two M5 review files | Nothing to do in code; the M5 spec's text stands as approved |

The seams M6 leaves: `galleryData` builds any list of rows, so a later gallery adds rows to `defs.ts` and runs the update
switch; `readEntry` takes more forms the same way; `runLighthouse` and `scripts/audit-site.mjs` audit any route list.

## 19. Risks

- **Lighthouse in CI.** Sixteen runs add roughly five to ten minutes to the end-to-end job (probe 1 records one run's
  time), and Lighthouse's own Chromium is the Playwright one, which may differ from a visitor's. The gate is accessibility
  only, whose audits are pass or fail per element, so it does not wobble the way performance does. Lighthouse turns on
  axe's `target-size` rule, which the house's `AXE_TAGS` (with `wcag22aa`) already run.
- **Lighthouse 13.5.0 is not the newest.** 13.6.0 is eleven days old on 2026-11-07; the house's two-week rule picks
  13.5.0, whose bundled axe-core range is `^4.13.0`. A later upgrade may move a score; the gate's margin is the floor of
  95, not 100.
- **The committed gallery can go stale.** When the engine's output changes, `gallery.json`, `cards.json` and
  `receipt-excerpt.json` change with the goldens; C-GAL6-02, C-CARD6-02 and C-REC6-02 fail until
  `DYELOT_UPDATE_GALLERY=1` rewrites them.
- **A link can spell a forbidden word.** A gallery link is about 7,000 base64url characters, and C-CONTRAST-12 of M1
  scans every `.json` under `src/` for the perceptual formula's trade name; row 18's first name hit it (R6-12). C-GAL6-08
  names the entry first, and a seed suffix fixes it.
- **The word list can change.** A new or reweighted term can move a brief's preset or hues; C-GAL6-03 pins each brief's
  terms and preset, so such a change is seen in the same run.
- **Font names on the cards.** The catalog's families include Google Sans Flex, Zalando Sans, Hubot Sans and Mona Sans,
  named after companies or their mascots, and the `m3-expressive` preset's label is "M3 Expressive"; the cards show them
  as the studio does (owner approval item 10). No entry's own words do.
- **A share card may render per request.** If probe 2 finds the per-slug image dynamic, each scraper fetch is one
  function call on Vercel Hobby; 24 entries and occasional scrapers stay far inside the plan's million calls.
- **Entry hashes replace a draft.** A visitor with a draft who opens `/studio#color=…` loses that draft 300 ms later, as
  a first commit would replace it (owner approval item 8); Undo cannot bring it back.
- **Lazy templates on a slow network.** The first switch to a template whose chunk has not arrived keeps the old one on
  screen until it does, which reads as a slow switch; the idle preload makes it rare, and a failed chunk says so.
- **`/about` states facts that can drift.** C-ABOUT6-04 ties its numbers to the code and C-ABOUT6-03 ties each paragraph
  to its ruling; a change of an AI provider, the cap or the tracing must change the copy table in the same task.
- **Langfuse's list-traces endpoint sunsets on 2026-11-16.** Ingestion is a different endpoint, so `/about`'s tracing
  sentence holds; the close checks after that date that traces still arrive, or tells the owner.
- **The deployed audit runs from a shared desktop.** Runs are interleaved and the load average is recorded, as the
  lessons require; a performance miss is recorded with its cause, never rerun until it passes.
- **The Wada answer is not legal advice.** It rests on the URAA arithmetic and the US Copyright Office's Compendium; the
  owner's rule turns "not clean" into "drop", whatever a lawyer might later say.

## 20. Done when

- Every case in section 14 has a test that carries its id (C-GUARD6-01), and every `failure` case fails the way its row
  says.
- `pnpm gate:full` passes with section 15's floors, and `pnpm gate` passes; both times are recorded.
- Every M1 to M5 case passes except section 16's changes, and every golden holds (I-M6-07).
- Task 6.0's six probe results are recorded in R6-57, and section 18's conditional rows are struck or kept to match.
- Lighthouse's accessibility score is at least 95 on every route of `AUDIT_ROUTES` at both form factors, in the
  end-to-end suite (F-LH6-01 to 16) and on the deployed site.
- The pull request merges once CI is green (the owner's ruling of 2026-11-04), which deploys it.
- After the merge, the hand check of R6-58 and `scripts/audit-site.mjs`'s medians, first-byte times and chunk sizes are
  recorded in this spec's close note and the README.
- `docs/specs/00-design.md` carries an "M6 sync" line and a note starting "Refined in M6" at each row of section 1's
  first table.
- The README states M6 with measured claims only (R6-50).
- The knowledge graph holds `product-dyelot.md`, the indexes count nine products across 16 repositories, and
  `validate_graph.py` passes (R6-51).

## 21. Owner approval items

Each item ends with a recommendation: the controller's for items 1 to 6, the drafter's for items 7 to 12.

1. **The Sanzo Wada combinations are dropped.** The rights check came back unclear and leaning not clean: the 1933 and
   1934 volumes are likely under US copyright until the end of 2028 and 2029, the selection and ordering of the 348
   combinations is the protectable part, and no MIT-labeled dataset documents its provenance (R6-02). The owner's own
   rule applies. *Recommendation: accept.*
2. **The gallery is 24 original systems**: the six hero designs and 18 made from the briefs of section 6 by the M4 word
   list, with zero model calls; AI02's 100 to 200 model-made briefs are not done (R6-05, R6-06). The names, briefs and
   tags are section 6's. *Recommendation: accept.*
3. **Share cards only for gallery entries**; a studio link keeps the site's card (R6-18 to R6-20). *Recommendation:
   accept.*
4. **Lighthouse**: accessibility of at least 95 gated in the end-to-end suite on every public route at desktop and
   mobile; performance measured on the deployed site against 12.3's goals and never gated; `lighthouse` 13.5.0 as a dev
   dependency (R6-43 to R6-48). *Recommendation: accept.*
5. **The studio's entry hashes** `#color=`, `#brief=` and `#start=image` become public URL forms (R6-23). *Recommendation:
   accept.*
6. **Not scheduled for v1**: each family's italic files, larger chrome text than 11 px, the model-made gallery and launch
   copy (section 18). *Recommendation: accept.*
7. **A loaded link opens with its preset and that preset's view** (R6-26): a gallery card for a dark preset opens dark,
   and the select names its preset instead of "Custom". It changes C-HASH-16, C-DRAFT-13 and one M2 store test (section
   16). *Recommendation: accept.*
8. **An entry hash counts as the first commit** (R6-24): 300 ms after `/studio#color=…`, `#brief=…` or `#start=image`
   loads, the hash is the normal link and the draft holds the new design, replacing the visitor's earlier draft.
   *Recommendation: accept; the visitor chose to start a new design.*
9. **The close updates the meta-repo's counts**: the README's repository table gains a dyelot row, and the knowledge
   indexes say nine products across 16 repositories (R6-51). The workspace `CLAUDE.md` also says "15 independent repos"
   and "8 products"; an agent does not edit `CLAUDE.md` without the owner. *Recommendation: approve the README and index
   edits, and either edit `CLAUDE.md` yourself or approve that edit in the close.*
10. **The cards name font families as the catalog does**, including Google Sans Flex, Zalando Sans, Hubot Sans and Mona
    Sans, and the preset label "M3 Expressive"; no entry's own name, slug, brief or tag holds a brand (R6-12, section 19).
    *Recommendation: accept.*
11. **Lighthouse lengthens CI** by sixteen runs, about five to ten minutes of the end-to-end job (R6-44).
    *Recommendation: accept.*
12. **The heroes stay "Custom"**: M5 made them without the automatic pairing, so no preset matches them (6.3);
    regenerating them would change the landing's cards and every hero link. *Recommendation: accept; keep them.*
