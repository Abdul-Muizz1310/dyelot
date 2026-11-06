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
into rulings R6-01 to R6-60, and section 14 holds the cases. A ruling ends with **(decision X#)** when it states a
controller decision, or **(drafter)** when this spec supplies a rule the decisions leave open; a ruling that does both
says which part is which. The owner can overturn any ruling by editing this file before the task that uses it starts.
Task 6.0 (R6-57) probes every external fact this spec could not verify before any other task, in six probes, and says
what happens when a probe fails.

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
provenance or a rights check (`digest-external.md`, section 1; owner approval item 1). Also out: a gallery of 100 to 200
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
(`tests/unit/ai/lexicon-deny.ts`, R4-42), and each passes the copy rules. The cards also show the font families' names and
the preset's label as the catalog and the preset table hold them (section 19). **(decision B1; the bounds drafter)**

### Gallery pages (Task 6.2)

**R6-13 · `/gallery`.** A server page in `PageFrame active="gallery"`, with `pageMetadata` (7.1). It reads
`await searchParams`, filters with `readTag` and `entriesTagged`, and renders the intro, the filter (a `nav` of seven plain
links, "all" and the six tags, `aria-current="page"` on the active one), the count line and the cards in `defs.ts` order. An unknown tag shows every
entry and a sentence that does not repeat the query (7.1). **(decision B2, B3; the copy drafter)**

**R6-14 · The card.** Each card is an `article` named by its `h2` (the entry's name) holding, in order: the line; the
tags; the specimen (7.3), framed, the only color on the page; the type pairing's display and body family names; the preset
label; the receipt line `summaryLines(summary)[0]` ("78 of 78 required contrast checks pass"); the lot; and two links,
"Open in the studio" (`/studio#s=<link>`) and "Details" (`/gallery/<slug>`), each with the name in its accessible name
(7.2). The chrome stays achromatic; every number is Geist Mono with tabular numerals. **(decision B3; the order and the
names drafter)**

**R6-15 · `/gallery/[slug]`.** A server page that awaits `params`, looks the slug up with `entryOf` and calls `notFound()`
for an unknown one, so the 404 page answers (R6-17). It shows the name, how it was made, the tags, the preset, the lot,
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
/>, { ...size, fonts })` with `shareCardAssets()`'s Geist Mono and icon. The card (8.1) has the M0 card's look: the dot grid, the brand
row, a `//` comment line, the name as the headline, the line, the strip of five colors, the receipt count and the footer.
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
| `#brief=<value>` | `decodeURIComponent(value)` succeeds and `toPlainText(decoded, 500)` is not null | `{ kind: "brief", text }`, the cleaned text |
| `#start=<value>` | `value` is `image` | `{ kind: "image" }` |

A hash with one of the three prefixes that is not valid is `{ kind: "malformed" }`; any other hash, `#s=` included, is
`{ kind: "none" }`. A `+` in a brief stays a `+` (the hash is not a query). The forms are read on the first load only: a
later `hashchange` to an entry form changes nothing, as `loadFromHash` ignores a hash that is not `#s=`. **(decision C1; the
grammar drafter; owner approval item 5)**

**R6-24 · What the store does with an entry.** On the first load an entry outranks the draft, as a link does:

- `color`: a fresh design with the primary locked at the color: `{ ...freshParams(), primary: seed }`, a seed from
  `newSeed()`, preset `"default"`, provenance `"generated"`, `createdWith` `"controls"`.
- `brief` and `image`: a fresh design, as "Start fresh" makes one, and `entry` holds `{ kind: "brief", text }` or `{ kind:
  "image" }` until the studio takes it with `takeEntry()`. The shell then opens the inputs drawer when the inputs panel is
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

**R6-32 · `start.log`.** It gains "open the gallery" and "open about this site" after "open the motion lab", so the window
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
`https://dyelot.vercel.app` for every route and form factor, three runs each, interleaved (route by route and form factor by
form factor in each round, R2 after R1), and the README records each median with the date and the machine's load
average. Section 12.3 states goals; a miss is recorded with its cause, never hidden. **(decision F2; the goals drafter;
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
id of section 14 of this file has a test (C-GUARD5-01's method with this file's path). `tests/unit/features/{gallery,
about}/**` run in `web` (jsdom), `tests/unit/engine/repo-guards-m6.test.ts` in `core`, and `tests/unit/scripts/audit-core.
test.ts` in `core`; each unit file runs in one project (C-REPO-M2-06). New pure helpers join vitest's helper lists at the
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
   refuses the route or the image does not render: the fallback is a route handler `src/app/gallery/[slug]/card.png/
   route.ts` with the same tree and `metadata.openGraph.images` set by `generateMetadata` (R6-17 then repeats the title,
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

**(decision J1; probes 1's fallback, 3's marker and 6 drafter)**

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
`galleryEntry` checks `def.slug` and the spec's sections as `paramsOfSpec` does; `galleryCards` checks every entry's
`specimen` holds the five palettes in order. `GalleryShareCard` and `MosaicShareCard` take checked data and never throw
for a card of `GALLERY_CARDS`.

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

// src/features/landing/receipt.ts (R6-11): pure, imports nothing
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
`#`. `briefHref` is a `TypeError` for a non-string and a `RangeError` for a text that `briefReady` refuses. `receiptExcerpt`
is a `TypeError` for a non-string and a `RangeError` for text that is not JSON, whose `format` is not `dyelot.check/1`, or
that lacks `design.name`, `summary`, a non-empty `contrast` or a `findings` array.

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
`name`, `lot` and `fonts` strings, `checks` two whole numbers, `palettes` an array of five; else a `TypeError` or
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
`transferred`. `runLighthouse` is a `RangeError` for a form factor outside `FORM_FACTORS` and closes its browser on every
path.
