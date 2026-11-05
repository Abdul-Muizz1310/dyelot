> Source: `docs/specs/dyelot-design.md` in the private `repos` meta-repo, copied here on 2026-11-01 (M0). The paths to `docs/research/`, `knowledge/` and the DR records point into that repo.
>
> M1 sync (2026-11-01): where the M1 spec, `docs/specs/01-color-engine.md`, refines this document, the sentence carries a note in italics that starts "Refined in M1". Its refinement table (section 1) lists each change with the reason. The rest of the text is unchanged.
>
> M2 sync (2026-11-03): where the M2 spec, `docs/specs/02-studio.md`, refines this document, the sentence carries a note in italics that starts "Refined in M2". Its refinement table (section 1, "Where this spec refines the umbrella") lists each change with the reason. The rest of the text is unchanged.
>
> M3 sync (2026-11-05): where the M3 spec, `docs/specs/03-export.md`, refines this document, the sentence carries a note in italics that starts "Refined in M3". Its refinement table (section 1, "Where this spec refines the umbrella") lists each change with the reason. The rest of the text is unchanged.
>
> M4 sync (2026-11-06): where the M4 spec, `docs/specs/04-ai.md`, refines this document, the sentence carries a note in italics that starts "Refined in M4". Its refinement table (section 1, "Where this spec refines the umbrella") lists each change with the reason. The rest of the text is unchanged.

# dyelot — a palette becomes a design system your coding agent can build

Status: approved by the owner on 2026-11-01, as written. The owner settled the name, the AI layers, the
scope and the contrast readout in one question round, then approved this spec and a public GitHub repo. Research: `docs/research/2026-11-design-studio/`
(RR-0025 to RR-0030). Decision records: DR-0038 to DR-0040. When the repo exists (M0), this file moves to
`dyelot/docs/specs/00-design.md`.

## 1. Goal

dyelot is the portfolio's ninth product and its frontend showcase. A visitor, with no sign-in, can:

1. **Start from anything**: a color, a few words about the brand, an image, a curated system, or an
   existing DESIGN.md or shadcn theme.
2. **Get a complete design system**: color roles and scales for light and dark mode, type, space, shape,
   depth and motion, all computed, all accessible by construction.
3. **See it live** on six realistic pages that share one state, at phone, tablet and desktop widths.
4. **Hand it to a coding agent**: one download holds a DESIGN.md brief, an always-on AGENTS.md block,
   `theme.css`, DTCG tokens, a shadcn install file, a TOON view and a ready prompt. *Refined in M3: the download holds 18 to 21 files in a fixed order, those plus Figma token files, three motion files, an agent skill, the checker and the receipt, and `flavor/` waits for M5 (R3-12).*
5. **Take the flavor home**: a palette-driven animated background, a brand video rendered in the browser,
   and motion tokens for CSS, Motion and GSAP.

A dye lot is a batch dyed together so every piece matches. dyelot makes every screen of a product match.

**The receipt.** Every export carries `receipt.json` (`dyelot.check/1`): the measured contrast of every
role pair in both modes *(refined in M3: the 40 checks of `CONTRAST_CHECKS` in each mode, 80 in all, of which 78 are required, and `summary.pass` means the linter found no error, R3-08 and R3-23)*, color-blind distinguishability of the status and chart colors, gamut membership
of every emitted value, and the linter's findings. It also carries `dyelot-check.mjs`, a zero-dependency
script the agent runs before it finishes: it re-measures `theme.css` and fails on raw color literals or
off-token classes in the codebase. *Refined in M3: a line may carry `dyelot-check-ignore: <reason>`, and the checker also compares every role with the receipt and reports shadowed definitions (D3, R3-24, R3-25).* The brand spine holds: tools that hand you a receipt.

## 2. Look: the house style, one new idea

**From the portfolio** (inkthread's spec is the reference): dark chrome on the shared neutrals (page
`#0a0a0a`, panel `#12121a`), Geist and Geist Mono, terminal windows on a dot grid, lowercase copy with
`$ > //` prompt lines, a sticky blurred nav and a status-bar footer.

**dyelot's accent is madder**, the historic red dye: `oklch(0.70 0.17 22)` = `#f66c6d`, 6.87:1 on the page
and 6.46:1 on the panel. No sibling uses a red (bastion violet, inkprint gold, inkthread fuchsia, magpie
emerald, paper-trail cyan, slowquery orange, feathers blue, inkgrid lime).

**The new idea: the chrome stays achromatic so color can be judged.** Albers showed that a color reads
differently on every surround. Every serious color tool works on neutral gray for that reason. dyelot's
chrome is neutral plus madder; the visitor's system appears only inside the preview canvas, framed like a
specimen. Every number (ratios, OKLCH values, Lc, ΔE) is set in Geist Mono with tabular numerals.

## 3. Architecture

One Next.js 16.4 app on Vercel Hobby. All generation runs in the browser. The server does three things
only: the shared-quota AI route, share-card images, and site metadata. There is no database: a design lives
in the URL hash and, as a draft, in the visitor's own browser storage.

| Layer | Path | Job | Rules |
|---|---|---|---|
| Engine | `src/engine/` | Color math, scale solver, roles, harmony and generators, image extraction, type/space/shape/depth/motion token generation, linter | Pure TypeScript. No DOM, no React, no I/O. Seeded PRNG only. Property-tested. |
| Spec | `src/spec/` | The `dyelot.spec/1` model (zod), parse, canonical serialize, hash, URL codec | Parse, don't validate. Version mismatch fails loudly. |
| Export | `src/export/` | Pure generators for every bundle file, the receipt, the zip | Same spec in, byte-identical files out. *Refined in M3: pure except the checker's `nodeIo` adapter, and a new pure layer, `src/import/`, reads DESIGN.md and shadcn CSS (R3-39).* |
| AI | `src/ai/` | Schemas, prompt files, the lexicon, the router, three providers | The model never emits a final color value. *Refined in M4: `src/ai/` is a pure core, and the providers and the router live in shells, `src/server/ai/` and `src/features/ai/`; image extraction's pure part is `src/engine/image/` (R4-03, R4-05, R4-06, R4-07).* |
| Features | `src/features/` | Studio, previews, export panel, gallery, explorer, motion lab, video | UI only; calls engine and export, never reimplements them. |
| Shell | `src/app/`, `src/lib/site/` | Routes, route handlers, site metadata (copied per `knowledge/conventions/convention-site-metadata.md`) | Side effects live here. |

**Data flow.** input → `DirectionParams` (from controls, the lexicon or a model) → `engine.generate(params,
seed)` → `DesignSpec` → `engine.lint(spec)` → receipt → previews (CSS variables on the canvas) → exporters.
*Refined in M1: the two engine calls are `generateSystem(params, seed)` and `lintSpec(spec)`.*

**Determinism.** Generation uses a seeded PRNG; the seed lives in the spec. The same spec gives
byte-identical exports, and a golden-file test enforces it.

**State.** A zustand store holds the spec and an undo history. The URL hash carries the canonical spec,
deflated with `fflate` and base64url-encoded (`/studio#s=…`). The hash never reaches the server. Drafts
persist in `localStorage` inside try/catch; a design never depends on it. *Refined in M1: the link also carries an
8-byte integrity trailer, the FNV-1a 64 of the deflate bytes, and size guards. Raw deflate cannot detect tampering.
A valid payload that is not in canonical form opens normalized, with an unchanged spec id.* *Refined in M3: a snapshot also records whether the studio generated it or loaded it, so the export block knows which designs it can rebuild (R3-42).*

## 4. The spec: `dyelot.spec/1`

A zod schema, versioned, exported as JSON Schema for the docs. Top-level fields:

| Field | Holds |
|---|---|
| `version`, `meta` | `"dyelot.spec/1"`; name, one-liner, seed, engine version, created-with (`controls` · `lexicon` · `model:<slug>` · `on-device` · `visitor-key` · `import`) *Refined in M4: every AI or lexicon action stamps it through a new optional argument of `generateSystem` (R4-36, R4-37).* |
| `direction` | Thesis, 3–5 adjectives, style preset id, like/unlike references, density. *Refined in M3: `meta.oneLiner` and `direction` (thesis, adjectives, like, unlike) are optional plain text; the preset is derived by `presetOf` and density stays a view setting (R3-01, R3-02, R3-04, R3-07).* |
| `color` | Seeds (OKLCH, with lock flags), hue anchors per palette (primary, secondary, accent, neutral, success, warning, danger, info, chart 1–5), contrast level (`AA` · `AA+` · `AAA`), gamut (`srgb` · `p3`), scale mode (`standard` · `even`), solved scales (11 steps × light and dark), role map (shadcn roles plus surfaces, light and dark) |
| `type` | Display, body and mono families (catalog ids with license), scale context, ratio, steps with size, line height, tracking and weight; fluid display steps. *Refined in M3: weights are derived by `typeWeights` and never stored (R3-04, R3-05).* |
| `space`, `shape`, `depth` | Base unit and scale; radius scale and nesting rule; shadow layers per elevation and dark-mode surface ladder |
| `motion` | Durations, cubic-bezier easings, springs (visual duration, bounce), budget, reduced-motion policy |
| `components` | Policies: card use, button emphasis, input style, icon library and stroke |
| `rules` | Do and don't lists (generated from the preset and the anti-slop rules, editable) |

Values are stored once, in OKLCH. Hex and P3 values are derived on export. *Refined in M1: a solved step also stores
the hex that the solver picked and measured. Exporters emit that hex and never re-derive it, because a re-derived
hex can differ by one code per channel and drop a threshold step under its ratio. The M1 schema leaves out the
fields that have no M1 source: `direction`, the one-liner, type weights, the nesting rule, the dark surface ladder,
and the motion budget and reduced-motion policy. M2 and M3 add them.*

## 5. The color engine (RR-0028)

- **Spaces.** CSS Color 4 matrices: sRGB, Display P3, linear RGB, XYZ, OKLab, OKLCH. A hue is `none` when
  chroma ≤ 4e-6. Gamut mapping uses the CSS MINDE algorithm; every check runs on the final emitted values.
- **Scales.** For each of the 11 steps, bisect lightness so the gamut-mapped color hits its target WCAG
  contrast against the mode's background. Light targets against white for steps 50–950: 1.06, 1.15, 1.32,
  1.65, 2.2, 3.0, 4.5, 7.0, 9.5, 12.5, 15.5. Dark mode solves the same targets against a background at
  L 0.18. Chroma follows an envelope peaking at steps 500–600, capped at 0.97 of the gamut maximum. Yellow
  and amber drift 30–50° toward orange as they darken. `even` mode caps each step's chroma at the weakest
  hue, giving equal contrast and equal chroma across hues. An unsatisfiable target fails loudly with the
  step and hue named; it is never silently clamped. *Refined in M1: a non-threshold step lands within
  `max(0.05, 0.01 × target)` of its target. Threshold steps 500, 600 and 700 are solved for target + 0.02. They must
  meet 3.0, 4.5 and 7.0 on the emitted hex, and they overshoot by at most 0.12. The solver picks the nearest of the
  8-bit hexes around its solution. The dark page is the neutral hue at `oklch(0.18, min(0.012, Cneutral), h)`, and
  dark chroma takes a factor of 0.85. Drift is `40 × clamp(1 − |h − 90| / 35, 0, 1)` degrees over the 11 steps. Even
  mode works in groups. The four status palettes always form their own group. Primary and accent share one when
  their peak chroma is equal. Secondary and neutral stand alone.*
- **Roles.** Steps map to jobs (Radix-style: backgrounds, states, borders, solids, text) and then to the
  shadcn role set. Text on a fill takes whichever of white or black wins on WCAG; when the perceptual score
  disagrees, the inspector says so. *Refined in M1: when both white and black reach WCAG 4.5 on a fill, `onFill`
  takes the one with the larger absolute perceptual score. One passing candidate decides alone. On `#4775ca` white
  scores 4.501 and black 4.665, but the perceptual scores are 76.5 and 33.1, so white wins. Ring and input sit on
  step 600 (700 at AAA) to keep 3:1 against card and muted surfaces. The status fills are warning-500, danger-600,
  info-700 and success-800 at a fixed peak chroma of 0.14, so lightness separates them for color-blind readers.
  Destructive stays on danger-600 at every contrast level. A `destructive-subtle` pair (danger-100 and danger-900)
  carries 7:1 text. That makes 46 roles.*
- **Contrast.** WCAG 2.2 is the only pass/fail gate, computed without rounding (4.499 fails). Next to it,
  an advisory perceptual score from our own MIT implementation of the published formula, labeled
  "perceptual contrast (advisory)" with its polarity sign, never the APCA name or logo (DR-0038).
- **Color blindness.** Viénot and Brettel for protan and deutan, Brettel for tritan, Machado for anomalous
  severities, all in linear RGB. *Refined in M1: severity 1 only, with Viénot for protan and deutan and Brettel for
  tritan. Machado and the anomalous severities are not scheduled.* Status and chart sets need pairwise ΔEOK ≥ 0.08
  under every simulation (warn below 0.08, error below 0.05) and a lightness gap between danger and success.
- **Generators.** OKLCH harmony rotations (analogous, complementary, split, triadic, tetradic, monochrome),
  cosine palettes, Poline-style anchor interpolation, and the Sanzo Wada combinations. Neutrals take the
  brand hue at chroma 0.005–0.02. Status hues start at success 150°, warning 70°, danger 25°, info 250°.
*Refined in M1: M1 ships the OKLCH harmonies only. Cosine and Poline-style generators move to M5, and the Sanzo Wada
  combinations to M6. Neutrals follow a tint table: none 0, warm 0.012 at hue 60, cool 0.012 at hue 250, brand 0.010
  at the primary hue.*
- **Image to palette.** In a Web Worker: downscale, quantize with `colorthief` 3.5 in OKLCH, score with the
  Material-style rule (share and chroma, hue diversity), assign heuristic roles. The exact extracted colors
  become locked seeds.
- **Names.** Nearest name by ΔEOK from `color-name-list/bestof` (MIT), loaded on demand.
- **Linter.** The 20 color rules from RR-0028 (contrast, non-text, focus, links, distinguishability,
  monotonic scales, step gaps, chroma consistency, gamut, achromatic hue, dark-mode surfaces and text,
  elevation) plus the taste rules in §6. Each finding has an id, a severity, the measured value, the
  threshold, its source, and a fix the engine can apply. *Refined in M1: the 20 rules are C1, C2, C4, C5, N1 to N3,
  F1, S1, S2, K1, K2, K4, G1, G3, D1 to D4 and P1. Research rules C3, K3, U1, S3 and G2 are not scheduled. A finding
  has no fix yet. The studio inspector is the natural home for one. G1 allows 2e-4 outside the gamut. A locked seed
  counts as gamut-mapped only beyond that 2e-4, because rounding to six digits leaves valid 8-bit seeds up to
  1.347e-4 outside. The taste rules move to M2.*

## 6. Type, space, shape, depth, motion and taste (RR-0029)

- **Fonts.** A curated catalog of about 40 Google Fonts families (OFL, Apache-2.0 or UFL), covering the 20
  vetted pairings and the presets. A build script copies the Latin woff2 files from `@fontsource-variable/*`
  packages into `public/fonts/<family>/` with each family's license text; the studio loads them on demand
  with the FontFace API from our own origin, so no request goes to Google. Each family carries a
  genericness score from a Google Fonts popularity snapshot plus known agent-default lists; the generator
  samples with an overuse penalty instead of a fixed whitelist. No Fontshare fonts: their license bans
  selectable use in design tools.
- **Type scale by context.** Dense app 14 px at 1.125–1.2; product UI 16 px at 1.2–1.25; marketing and
  editorial fluid 18 → 20 px with Utopia's clamp formula on display steps only; line heights snap to 4 px;
  tracking from the Inter curve clamped to [−0.04, +0.05] em; all caps +0.05 to +0.12 em. *Refined in M1: dense uses
  1.2 and product 1.25. A snapped line height never falls below the next multiple of 4 at or above the font size.
  All-caps tracking moves to M2.*
- **Space, shape, depth.** A 4 px base with an 8 px rhythm; radius scales with the nested rule (inner =
  outer − padding); layered shadows tinted toward the background hue; dark mode shows elevation by
  surface lightness, not shadow.
- **Motion.** Durations from 50 to 500 ms; standard, decelerate, accelerate and emphasized easings; springs
  by visual duration and bounce; a budget per page; reduced motion swaps movement for fades. *Refined in M2:
  the spec stores one set of durations whatever the motion feel says. The canvas bridge, `themeVars`, scales them by
  the feel (calm 1.25, brisk and playful 1) and caps each at 500 ms (R2-08).*
- **Presets.** The ~20 styles from RR-0029 (minimal/Swiss, editorial, neo-brutalism, glass, dark dev-tool,
  bento, aurora, retro-futurism, tactile, maximalism, organic, dithering/pixel and the rest) as typed
  parameter sets with their accessibility guards. *Refined in M2: 14 presets, the 13 styles of the M2 plan plus a
  neutral default.* *Refined in M2: each preset carries `guards`, its accessibility notes, which tests check, and
  `unexpressed`, the traits `dyelot.spec/1` cannot hold yet, such as hard offset shadows, blur and grain.*
- **Taste rules in the linter.** Flags with fixes: a generic display face; purple-to-blue on white unless
  asked for; verbatim Tailwind default hexes; more than three type sizes in a preview region; body under
  16 px; measure outside 45–75ch; mixed radius languages; decorative glass on content. *Refined in M2: four
  warnings, T1 to T4: a generic display face, the purple-on-white default, a Tailwind default hex at steps 300 to 800,
  and body text under 16 px outside the dense context. They have no fix yet. The mixed-radius rule is dropped (R2-26).
  The type-size count, the measure and decorative glass are not scheduled.*

## 7. Pages

| Route | Purpose |
|---|---|
| `/` | The showcase. A hero whose shader is driven by a live palette, a scroll-driven story where a system assembles itself (CSS scroll timelines), the receipt explained in one screen, entry points: start from a color, a brief, an image, or the gallery. |
| `/studio` | The editor (§8). |
| `/explore` | 3D OKLCH explorer: the sRGB, P3 and Rec2020 gamut solids, the current palette as points, scales as tubes, lightness slices. |
| `/motion` | Motion lab: presets, spring and easing curves, live previews, export. |
| `/gallery` | Curated original systems and the Sanzo Wada combinations; any card opens in the studio. No brand clones. |
| `/connect`, `/connect/callback` | The visitor-key sign-in with OpenRouter (§10). *Refined in M4: both pages are `noindex`; the callback is disallowed in robots and sends no referrer (R4-22, R4-33).* |
| `/about` | How it works: the math, the receipt, the licenses, the privacy note for in-browser video. |

## 8. The studio

- **Left: inputs.** Seed colors with locks; brief box (AI); image drop; import (DESIGN.md, shadcn CSS);
  harmony, contrast level, gamut, scale mode; preset; type pairing and context; space, radius, depth,
  density; motion feel. *Refined in M2: the M2 studio shows no brief box, image drop or import. They wait for M4 and
  later milestones.* *Refined in M3: the inputs panel gains About and Import (R3-33).* *Refined in M4: the inputs panel gains Brief, Image and Steer sections, in the order of R4-53.*
- **Center: the canvas.** Six P0 templates on one shared spec: landing page, SaaS dashboard, settings and
  forms, three mobile screens, editorial article, and a kitchen sink with specimens. Templates use
  shadcn-style components themed only by the spec's role variables, scoped to the canvas, so what you see
  is what your agent will build. Container queries drive the 360, 768 and 1280 px frames. Toggles: light or
  dark, density, reduced motion, increased contrast, real or edge-case copy. *Refined in M2: the M2 canvas has no
  increased-contrast toggle, and none is scheduled.*
- **Right: inspector.** Scales with step contrast, the role table with WCAG and advisory scores, color
  names, the color-blindness view, the linter with one-click fixes, the receipt. *Refined in M3: the inspector gains a Receipt section (R3-36).* *Refined in M2: the color-vision
  view is a canvas toggle (none, protan, deutan or tritan) that recomputes every canvas color through `simulate`.*
  *Refined in M2: fixes exist for C1, C5, N1 and F1. Each regenerates the design at a higher contrast level: `AA+` for
  C1, `AAA` for the others. The M1 linter has no K3, so K3 has no fix (R2-10).* *Refined in M2: the receipt comes with
  the export bundle in M3.*
- **Keyboard.** Space regenerates unlocked colors; `L` locks the focused swatch; ← and → undo and redo;
  `Alt+T` flips the mode; `Mod+S` copies a share link; `Mod+E` opens export *(refined in M3: it opens the export dialog, R3-35)*. Every control has a visible
  label, a focus ring and a 24 px minimum target. *Refined in M2: `Mod+E` is not bound, because export comes in M3.*
- **Transitions.** React `<ViewTransition>` morphs a swatch into its token row and between templates;
  every transition has a reduced-motion variant. *Refined in M2: the M2 studio has no view transitions. They come in
  M5.*

## 9. The export bundle (RR-0027)

One zip, assembled in the browser with `fflate`, plus copy buttons for each file:

| File | Format and purpose |
|---|---|
| `DESIGN.md` | Google's DESIGN.md (alpha): YAML tokens for light mode plus the standard prose sections, extended with Dark mode, Motion, Accessibility and Self-check sections, with `theme.css` embedded verbatim. Lints with 0 errors under the pinned `@google/design.md`. |
| `AGENTS.md.snippet` | About ten always-on lines to paste into AGENTS.md, outside Next.js's managed markers. |
| `app/theme.css` | Tailwind v4: `@custom-variant dark`, `@theme` (scales, fonts, type steps with companions, radius, shadows, easings, animations), `:root` and `.dark` shadcn roles, `@theme inline` mapping, the default palette removed. |
| `registry/<name>.json` | shadcn `registry:theme` with `cssVars` and fonts as `registry:font` items; installs with `npx shadcn add ./registry/<name>.json`. |
| `tokens/*.tokens.json`, `tokens/design.resolver.json` | DTCG 2025.10 (OKLCH objects with hex fallbacks), light and dark joined by a resolver; validates against the official schemas. |
| `tokens/figma/{light,dark}.tokens.json` | DTCG subset Figma imports: sRGB, px, one file per mode. |
| `design.toon` | TOON 4.4 compact view of scales and roles, marked non-canonical. |
| `prompt.md` | Paste-ready prompt for v0, Lovable, Bolt or a first agent message, with the brief inline. |
| `skills/<name>-design/SKILL.md` | Optional Agent Skill for restyle and audit workflows. |
| `receipt.json`, `scripts/dyelot-check.mjs` | The receipt and the zero-dependency checker (§1). |
| `motion/` | Motion tokens as CSS (including `linear()` springs), Motion objects and GSAP-compatible strings (text only). |
| `flavor/` (on request) | The background shader as a React component, a vanilla module and a CSS fallback; the brand video; the Remotion composition source with a "Built with Remotion" header and the license link. |

*Refined in M3: each file's format is fixed in section 6 of the M3 spec; `registry/` holds one theme item and one font item per family next/font can load, and `skills/` is always included (R3-16).*

**Import** reads DESIGN.md (tokens and prose) and shadcn CSS variables into a spec, then lints them. *Refined in M3: import never throws for a string, reads at most 262,144 bytes, and lays the imported colors over a generated base (R3-29 to R3-32).*

## 10. AI (RR-0026, DR-0039, DR-0040)

The studio works fully with zero model calls. AI turns words and images into engine parameters, writes
prose, and narrates the linter. It never emits a final color value: schemas are closed and enum-heavy,
and the engine validates every field.

| Feature | Model's job | Fallback without a model |
|---|---|---|
| Brief → direction | Fill `DirectionParams`: hue ranges, chroma, contrast, harmony, pairing id, preset, shape, motion; name it | Lexicon matcher (about 400 mood and brand terms) *Refined in M4: at least 400 terms in six categories and no brand or company name (R4-42).* |
| Read the vibe (image) | Pick roles among the extracted cluster ids; mood and type vibe | Heuristic roles |
| Refine in words | Typed ops (shift hue, set contrast, swap pairing, set radius) | Steer chips: warmer, cooler, bolder, quieter, softer, sharper, airier *Refined in M4: ten closed op kinds, and an unknown op fails the tier (R4-45).* |
| Rationale | DESIGN.md prose | Templates from the preset *Refined in M4: the model writes `oneLiner`, `direction.thesis` and `rules` into the spec on an explicit click; without a model nothing is written and the export keeps the preset's text (R4-49).* |
| Critique | Rank and explain lint findings | The sorted lint list |

**Providers, tried in this order** for each action, with the path shown on the result:

1. **On-device (DR-0039).** Chrome's Prompt API when `LanguageModel.availability()` is not
   `unavailable` and the visitor has turned it on. The same zod schema becomes the `responseConstraint`.
   The first use needs a click to start the model download. *Refined in M4: an explicit "Download the model" button, and on-device runs the four text features only (R4-31).*
2. **Visitor key (DR-0040).** After the OpenRouter sign-in (PKCE in the browser), calls go from the browser
   straight to OpenRouter with the visitor's key, `:free` models only. The key stays in `sessionStorage`
   unless the visitor chooses "remember on this device".
3. **Shared quota.** `POST /api/ai/<feature>` calls OpenRouter's free models with the server key through
   AI SDK v7 and `@openrouter/ai-sdk-provider`, non-streaming, with Response Healing. *Refined in M4: one pure request builder and one pure reply reader, sent by two thin `fetch` transports; neither AI SDK nor the OpenRouter provider package enters the repo (R4-08, R4-60).* Text cascade:
   PRIMARY → FAST → FALLBACK; image cascade: dots-3-note → gemma-4-26b → nemotron-3.5-super-vl (after a
   live JSON smoke test). *Refined in M4: the slugs come from `OPENROUTER_MODEL_*` and `OPENROUTER_VISION_MODEL_1` to `_3`, each ending in `:free`, and tier 3 stays unset until its live smoke passes (R4-13, R4-61).* Three HTTP attempts per action at most, one per tier; a schema failure goes to
   the fallback, never a retry. *Refined in M4: any failure of a tier, a 429 and a 5xx included, moves to the next tier, with no retry and no backoff, 20 s per tier and `maxDuration` 70 (R4-12).*
4. **No model.** The labeled rule-based fallback; the error is shown, never hidden.

**Guarding the shared quota without a database.** Before a shared call, the route reads OpenRouter's
`GET /api/v1/key` (`free_model_daily_requests.remaining`) and refuses when fewer than
`DYELOT_AI_RESERVE + 3` requests remain (default reserve 35), so dyelot can never starve the other seven
products. Each visitor gets a soft daily cap (3 actions) in an HMAC-signed cookie. *Refined in M4: the guard also requires an `Origin`, runs one cascade per server instance and re-reads `/key` before tiers 2 and 3 near the reserve; the cookie's format, key and lifetime are fixed (R4-17, R4-18).* Results are cached by
the normalized input with `"use cache"`. *Refined in M4: a per-instance LRU of 256 entries for 24 hours, not `"use cache"` (R4-19).* Prompts live in `prompts/<name>.md` with frontmatter
(`knowledge/conventions/convention-llm-usage.md`). *Refined in M4: `src/ai/prompts/<name>.md` with exactly `name`, `version`, `temperature` and `max_tokens`, bundled as text by a Turbopack raw rule (R4-51).* Server-side calls are traced as one Langfuse trace per
action with one generation per HTTP attempt; on-device and visitor-key calls never reach our server and
are not traced.

**Security.** A nonce-based CSP with no third-party scripts; `connect-src 'self' https://openrouter.ai
https://www.remotion.pro`; `Permissions-Policy: language-model=(self)`; model output rendered as text only;
a Disconnect button that clears the key. *Refined in M4: `connect-src 'self' https://openrouter.ai`, with Remotion's host added in M5, and the policy also denies camera, microphone and geolocation (R4-25, R4-27).*

## 11. Motion and 3D (RR-0030)

| Piece | Built with | Notes |
|---|---|---|
| Hero and canvas backgrounds | Our own WebGL2 fullscreen-triangle shader: cosine palette fitted to the spec or an OKLCH lookup texture, simplex noise, grain | MIT, a few KB; the same code is the `flavor/` export; static frame under reduced motion; pauses off-screen |
| 3D explorer | three 0.186.x, React Three Fiber 9.8, drei 10.7 (one canvas with `View`) | Gamut mesh adapted from oklch-picker with its MIT notice; `frameloop="demand"`; lazy-loaded route chunk; static SVG fallback and context-loss handling |
| Brand video | Remotion 4.0.539: `<Player>` preview and `@remotion/web-renderer` export to MP4 or WebM in the browser | `licenseKey: "free-license"`; gated by `canRenderMediaOnWeb()`; a privacy note before the first render (it sends the visitor's IP and our origin to remotion.pro); compositions use the renderer's CSS subset |
| Shader loop video | Mediabunny `CanvasSource` | No Remotion duties for anyone |
| Transitions and scroll story | React `<ViewTransition>`, CSS scroll-driven animations, Motion 14.9 (`reducedMotion="user"`) | No GSAP in the product |

Version pins: three stays on 0.186.x while `postprocessing` declares `three < 0.187`; React Three Fiber
9.8 needs React below 19.4; WebGL2 is the baseline and WebGPU is out of scope.

## 12. Stack

next 16.4, react 19.3, typescript 5 strict, tailwind 4.3, zod 4, zustand 5, motion 14.9, three 0.186,
@react-three/fiber 9.8, @react-three/drei 10.7, remotion and @remotion/player and @remotion/web-renderer
4.0.539, mediabunny, colorthief 3.5, color-name-list 14 (`bestof`), @csstools/css-color-parser, fflate,
@toon-format/toon 4.4, ai 7 with @openrouter/ai-sdk-provider 3.1, @fontsource-variable/* (build-time copy).
Dev: Biome 2.5, Vitest 4, fast-check, Playwright 1.62 with @axe-core/playwright, msw, ajv (DTCG and shadcn
schemas), @google/design.md (pinned, CI lint), colorjs.io (test oracle only). pnpm 10, Node 22 (*refined in M1:
Node `^22.22.2 || ^24.15.0 || >=26`, the range jsdom 30 needs. CI runs Node 24*). License:
MIT; the README states Remotion's own license for anyone reusing the video code. *Refined in M3: exact pins `yaml` 2.9.1, `@csstools/css-color-parser` 4.2.7, `fflate` 0.8.3 and `@toon-format/toon` 4.4.0; dev `@google/design.md` 0.4.0, `ajv` 8.20.0 and `ajv-formats` 3.0.1; `motion` stays 14.3.0; no GSAP, shadcn CLI, Style Dictionary or Terrazzo enters the repo (R3-37).* *Refined in M4: neither `ai` nor `@openrouter/ai-sdk-provider` enters the repo, and there is no `msw`; the mock OpenRouter is a plain Node server; `colorthief` 3.5.0 is pinned (R4-08, R4-60).*

## 13. Testing

Spec-TDD per `.claude/rules/spec-tdd.md`: each milestone starts with its `docs/specs/NN-*.md`, its
enumerated cases, then failing tests. Coverage ≥ 80% on `src/` with floors: engine and spec ≥ 95%,
export ≥ 90%.

| Area | Cases (pass and failure) |
|---|---|
| Engine | sRGB ↔ OKLCH round trip within 1/510; gamut mapping idempotent and in gamut; WCAG matches the spec's worked examples and never rounds; the perceptual score matches the published test vectors; every solved step hits its target within 0.01 with monotonic lightness (*refined in M1: within `max(0.05, 0.01 × target)`. Threshold steps meet 3.0, 4.5 or 7.0 and overshoot by at most 0.12, because one 8-bit code moves a high step's ratio by up to about 0.1*); an impossible target throws with step and hue; CVD outputs match the DaltonLens reference values; every text role pair ≥ 4.5 in both modes for every preset (property test over random seeds); achromatic hues are `none`; each linter rule has a passing and a failing fixture |
| Spec | Rejects unknown versions, out-of-range values and missing roles; canonical serialization is stable; URL codec round-trips; a tampered or truncated hash fails with a message, never a blank studio |
| Export | Golden files per preset; byte-identical output for the same spec; DTCG validates against the 2025.10 schemas; DESIGN.md lints with 0 errors; TOON round-trips; the registry item validates against shadcn's schema; `dyelot-check.mjs` passes on a clean fixture app and fails on raw hex, `bg-blue-500` and a tampered `theme.css`. *Refined in M3: goldens for the 14 presets and one import, and the validators run on vendored schemas with no network (R3-27, R3-28).* |
| AI | Out-of-range model output is rejected; provider order; labeled fallback on every failure; the guard refuses below the reserve; a schema failure never retries; PKCE state mismatch is rejected; the visitor key never appears in a request to our origin; on-device unavailable falls through *Refined in M4: section 14 of the M4 spec holds the cases, with a local mock of OpenRouter and Playwright interception, and no network in any test (R4-58).* |
| UI and flows (Playwright) | Color → system → export zip; brief (model mocked at the route) → system; image → palette; import DESIGN.md → preview → export; share link restores the exact spec; undo and redo; locks survive regenerate; reduced motion stops every animation; axe finds no violations on every route |
| Motion and 3D | WebGL missing shows the fallback; context loss swaps in the poster; video export is hidden where `canRenderMediaOnWeb()` fails |

## 14. Milestones

Each milestone is its own cycle: a `docs/specs/NN-*.md` with enumerated cases, a plan, failing tests, then
code. This document stays the umbrella; a milestone spec may refine it but must say where it does.

| # | Delivers | Done when |
|---|---|---|
| M0 | The `dyelot` repo in the house skeleton: Next 16.4, Biome, Vitest, Playwright, CI, `AGENTS.md` pointer, site metadata modules, MIT license, README skeleton, this spec as `docs/specs/00-design.md` | CI green locally; GitHub repo and Vercel project created only with the owner's OK |
| M1 | Engine, spec model, linter | All engine cases pass; property tests run in CI |
| M2 | Studio, six P0 templates, presets, fonts, URL state, keyboard UX | Flows pass in Playwright; axe clean |
| M3 | Export bundle, receipt, checker, import | Every validator passes in CI |
| M4 | AI: lexicon and chips, shared-quota route with guard and cache, on-device, visitor key, image extraction | Mocked flows pass; one live smoke call per slug within budget *Refined in M4: section 20 of the M4 spec adds the on-device eval record and a hand smoke on the deployed site.* |
| M5 | Hero shader, explorer, motion lab, view transitions, scroll story, Remotion preview and export, Mediabunny loop, flavor exports | Fallback and reduced-motion cases pass |
| M6 | Gallery, landing polish, share cards, performance and accessibility audits (Lighthouse accessibility ≥ 95), README, knowledge-graph product node | Deployed with the owner's OK; live flows checked |

## 15. Out of scope for v1

Accounts and server-side storage of designs; a Figma plugin; paid tiers; brand-clone presets; arbitrary
Google Fonts loaded from Google at runtime; WebGPU; GSAP; Fontshare; server-side video rendering; GIF
export; a custom MCP server; publishing `dyelot` to npm (possible later, with the owner's OK).

## 16. Risks

- **DESIGN.md is alpha.** Pin the CLI; keep extension sections at the end; re-check on upgrades. *Refined in M3: the pinned linter runs in a unit test on every golden (R3-21).*
- **Free models churn.** The product never depends on them; the guard and fallbacks keep it usable.
- **The on-device model reaches few visitors.** It is opt-in, and every path falls through.
- **The perceptual-score license is ambiguous.** It is advisory, generically labeled and removable in one
  flag.
- **Bundle weight.** 3D, video and AI code load only on the routes that need them.
- **Open questions to settle in the milestone specs:** whether `/api/v1/key` calls count against the free
  quota; `"use cache"` inside route handlers under Cache Components; the Turbopack way to export component
  source as a string; Player hydration with Cache Components; which Langfuse TypeScript SDK fits AI SDK v7
  (DR-0037 settled tracing for the Python services only). *Refined in M4: `"use cache"` is not used (R4-19); `/key`'s cost and the Langfuse packages were Task 4.0 probes (R4-62).*
