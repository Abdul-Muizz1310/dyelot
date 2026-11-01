# 02 · The studio: entry points, fonts, presets, taste rules, theme bridge, state and UI (M2)

> Source note: this milestone spec refines `docs/specs/00-design.md`, the umbrella, and builds on
> `docs/specs/01-color-engine.md` (M1). Paths to `docs/research/`, `docs/plans/` and `knowledge/` point into the
> private `repos` meta-repo.

Status: written 2026-11-01 as Task 2.1 of the M2 plan (`docs/plans/2026-11-01-dyelot-m2-studio.md` in the meta-repo).
Section 2 copies the plan's decisions word for word. Section 3 lists rulings that close gaps in the decisions
(R2-01 to R2-30); the owner can overturn any of them by editing this file before the task that uses it starts. Tasks
2.2 to 2.10 implement against the cases in sections 6 and 7. Revised the same day after the spec review (fix round 1): rulings
R2-25 to R2-30 are new, and R2-03, R2-05, R2-06, R2-08 to R2-10, R2-12, R2-13, R2-15, R2-17 and R2-23 changed.

## 1. Purpose and scope

M1 built a pure engine that turns parameters into a measured design system. M2 builds the studio on top of it: a
visitor edits a design system with real controls, sees it live on six realistic preview templates, inspects every
measured value, and shares it by URL. M2 adds five things to the pure core and one client application.

```text
DirectionParams + seed --generateSystem--> DesignSpec --themeVars--> CSS custom properties on [data-canvas]
DesignSpec --lintSpec (M1 rules + T1..T4)--> Finding[]
Preset --applyPreset--> DirectionParams        seed --choosePairing--> PairingId --> type.families
Studio store --worker--> generateSystem        store --#s=encodeSpec--> URL hash       store --> localStorage draft
```

| Task | Delivers |
|---|---|
| 2.2 | The two public entry points, `normalizeSpec`, and the M1 final-review cleanups |
| 2.3 | The font catalog, the 20 pairings, the genericness score, the copy script and the font loader |
| 2.4 | Presets, pairing choice, taste rules T1 to T4, color names |
| 2.5 | The theme bridge, the studio store, the worker, URL state and drafts |
| 2.6 | The studio shell: layout, inputs panel, lot tag, keyboard |
| 2.7 | The canvas, the frame switcher and the preview kit with the kitchen sink |
| 2.8 | The landing and editorial templates |
| 2.9 | The dashboard and settings templates |
| 2.10 | The mobile template and the inspector |
| 2.11 | Close M2 |

M2 does not deliver the brief box, the image drop, import, any export file, the receipt, AI of any kind, the other
pages (`/explore`, `/motion`, `/gallery`, `/connect`, `/about`) or the showcase home page. Section 9 assigns each
deferred item to a milestone.

### Where this spec refines the umbrella

| Umbrella | This spec | Why |
|---|---|---|
| §6 Presets: about 20 styles | 14 presets: the 13 styles of the plan plus a neutral default (section 5.3) | The plan fixes the list |
| §6 Presets: each carries accessibility guards | Each preset carries `guards` (checked by tests) and `unexpressed` (what `dyelot.spec/1` cannot yet hold) | Hard offset shadows, blur and grain have no field in the spec |
| §6 Taste rules: seven flags with fixes | Four rules T1 to T4 (section 5.4; the mixed-radius rule T5 is dropped, R2-26); the type-size count, the measure and decorative glass wait | The plan fixes the list |
| §6 Motion: durations 50 to 500 ms | The bridge scales durations by the motion feel and caps them at 500 ms (R2-08) | M1 stores one token set whatever the feel says (M1 R-18) |
| §8 Right: the color-blindness view in the inspector | The color-vision view is a canvas toggle that recomputes every color through `simulate` | The plan puts it on the canvas |
| §8 Left: brief, image drop, import | Not shown in M2 | Later milestones |
| §8 Canvas: increased contrast toggle | Not in M2 | The plan lists six canvas toggles and increased contrast is not one |
| §8 Keyboard: `Mod+E` opens export | Not bound in M2 | Export is M3 |
| §8 Transitions: `<ViewTransition>` | Not in M2 | M5 (showcase and motion) |
| §8 Right: one-click fixes | Fix actions for C1, C5, N1 and F1 (R2-10) | K3 is not a rule in the M1 linter |
| §8 Right: the receipt | Not in M2 | M3 |

## 2. Decisions M2 implements

These are the plan's decisions, copied word for word. Where a ruling in section 3 changes one (the T5 rule, the
fix for K3, the font files, the lock behavior), the ruling wins and names the decision it changes.

- **Public entry points.** `src/engine/index.ts` exports `generateSystem`, `DirectionParams`,
  `lintSpec`, `LintedSpec`, `Finding`, `parseColor`, `formatOklch`, `oklchToRgb`, `gamutMap`, `wcagRatio`,
  `meets`, `perceptualLc`, `simulate`, `deltaEOK`, `STEPS`, `PALETTE_NAMES`, `ROLE_NAMES`, the type, space,
  radius, shadow and motion generators, the presets and the font catalog. `src/spec/index.ts` exports
  `DesignSpecSchema`, `DesignSpec`, `encodeSpec`, `decodeSpec`, `SpecDecodeError`, `canonicalize`,
  `specId`, `normalizeSpec`. Internals (`multiply`, `runRules`, `tryOklchToRgb`, `gamutExcess`) stay
  unexported from the entry points. Exported lookup tables are `Object.freeze`d.
- **`normalizeSpec(spec)`** = `DesignSpecSchema.parse(JSON.parse(canonicalize(spec)))`; the store keeps
  only normalized specs, so `decodeSpec(encodeSpec(s))` deep-equals `s` and `specId` names what is held.
- **Font catalog** (`src/engine/fonts/catalog.ts`): the families of the 20 vetted pairings in research
  D2 plus Geist and Geist Mono, each `{ id, family, category, variable, axes, weights, license: "OFL-1.1",
  popularity, fallback }`. `popularity` is the Google Fonts value (lower = more common); the genericness
  score is `1 − clamp((popularity − 1) / 199, 0, 1)` and families on the research's high-genericness list
  score 1. A build script (`scripts/copy-fonts.mjs`) copies each family's Latin variable woff2 from its
  `@fontsource-variable/*` package into `public/fonts/<id>/` with the OFL text; a test asserts every
  catalog entry has its files. Pairings (`PAIRINGS`) reference catalog ids; M1's default pairing stays
  `host-grotesk` / `host-grotesk` / `fragment-mono`.
- **Presets** (`src/engine/presets.ts`): one typed parameter set per research D3 style — minimal-swiss,
  editorial, neo-brutalism, glass, dark-dev-tool, bento, aurora, retro-futurism, tactile, maximalism,
  organic, dithering-pixel, m3-expressive, and the neutral default. Each fixes radius set, depth, motion
  feel, density, type context, a pairing id, chroma, harmony and neutral tint, plus its accessibility
  guard notes. Applying a preset sets those `DirectionParams`; locked colors stay.
- **Pairing choice** without a preset: sample from `PAIRINGS` with the seeded random, weighted by
  `1 − 0.7 × genericness` of the display face (overuse penalty, not a whitelist).
- **Taste lint rules** (added to the linter, ids T1–T5, severity warn unless noted): T1 display family
  genericness ≥ 0.8; T2 primary hue in [265, 300] with a white page and no locked seed (the purple-on-white
  default); T3 a scale step equal to a Tailwind v4 default hex; T4 body size < 16 px outside the dense
  context; T5 mixed radius languages (a `sharp` set with `round` pills) (info).
- **Color names** (`src/engine/color/names.ts`): nearest name by ΔEOK from `color-name-list/bestof`,
  loaded lazily by the UI (the list, 197,611 bytes as ESM and 52,870 bytes gzipped, stays out of the first load; measured for `color-name-list` 14.85.1, whose `bestof` set has 5,000 entries; the UI loads the ESM through `import()`, and the `min.json` build is 117,583 bytes, 50,344 gzipped).
- **Theme bridge** (`src/theme/vars.ts`, pure): `themeVars(spec, mode)` returns the CSS custom properties
  for the canvas: every role (`--background`, `--primary`, … the 46 roles), each scale step
  (`--primary-600` …), type steps (`--text-<step>`, `--leading-<step>`, `--tracking-<step>`), families
  (`--font-display`, `--font-body`, `--font-mono`), space, radius (`--radius-sm` … `--radius-full`),
  shadows (`--shadow-1` … `--shadow-5`, two layers each) and motion (`--duration-*`, `--ease-*`). Values use
  the stored hex for colors. M3's `theme.css` export reuses this function.
- **State** (`src/features/studio/store.ts`): zustand store `{ params, seed, spec, history, future,
  status }`; undo and redo keep 100 steps; every change re-runs generation in a Web Worker
  (`src/features/studio/generate.worker.ts`) with a request id; stale replies are dropped. The URL hash
  `#s=<encodeSpec>` updates after each committed change (replaceState, debounced 300 ms); on load a hash
  decodes through `decodeSpec`; failures show the banner (Review Focus 1). Drafts persist to
  `localStorage` key `dyelot:draft` inside try/catch.
- **Studio layout** (`/studio`): three columns at ≥ 1280 px (inputs 320 px, canvas fluid, inspector 360
  px); below 1024 px inputs and inspector become drawers opened from a toolbar. A header shows the dye-lot
  tag: `LOT` and the spec id as `xxxx·xxxx` in Geist Mono, beside an 11-swatch strip of the primary scale.
- **Inputs panel**: locked seed colors (primary, secondary, accent) with a hex field, a native color
  input and a lock toggle; harmony; chroma; neutral tint; contrast level; gamut; scale mode; preset;
  pairing and type context; radius; depth; density; motion feel; regenerate. Controls that need later
  milestones (brief, image, import) are not shown.
- **Canvas**: a framed specimen on the house dot grid. A frame switcher sets 360, 768 or 1280 px (templates
  use container queries, not media queries). Toggles: light or dark, density, reduced motion, real or
  edge-case copy, color-vision view (none, protan, deutan, tritan: roles recomputed through `simulate`).
- **Inspector**: the 8 scales with each step's contrast; the role table with WCAG ratio, pass level and the
  advisory perceptual score with its sign, both modes; color names; the lint findings grouped by severity,
  each with a "show me" that highlights the role on the canvas; fix actions where a parameter fixes it
  (C1, C5, N1, F1 → raise the contrast level; K3 → even scale mode).
- **Keyboard**: Space regenerates unlocked colors; L toggles the lock on the focused seed; ← and → undo and
  redo; Alt+T flips the mode; Mod+S copies the share link; Escape closes drawers. Shortcuts never fire
  while a text field has focus.
- **Templates** (`src/features/preview/templates/`), each a fictional, on-theme subject:
  landing page ("Saltmarsh", a tide-reading app: asymmetric hero, features as a list beside a product
  moment, a quote, pricing teaser, FAQ, footer); SaaS dashboard (Saltmarsh's console: sidebar, header with
  a command button, KPI values with tabular numerals, an SVG chart in chart-1…5, a dense table, filters, a
  toast, an empty panel); settings and forms (every input type, validation states, a danger zone, a sticky
  save bar); mobile (three 360 px frames: feed, detail with a bottom sheet, tab bar); editorial article
  ("The long thread", an essay on natural dyes: H1–H4, measure, quote, code, figure and caption, footnotes,
  a table of contents); kitchen sink (every component in every state, every type step, radius, shadow and
  motion token, light and dark side by side, with measured contrast). Shared preview components live in
  `src/features/preview/kit/`. Icons come from lucide-react with the spec's stroke width.
- **Anti-slop rules for templates** (research D4): no three-equal-icon-card grids, no gradient text, no
  emoji icons, no hero-metric template, no fake logos or "trusted by" rows, no identical fade-up on every
  section; one orchestrated entrance per template; varied radius and spacing by hierarchy.
- **Home page**: one more link, "open the studio", beside the GitHub link; the rest waits for M5.

## 3. Rulings that close gaps in the decisions

The decisions leave some values open and two of their statements need a correction to hold together. Each ruling picks
the smallest answer that makes the cases testable. The module sections cite them as R2-nn.

**R2-01 · `normalizeSpec` errors.** The decision writes `DesignSpecSchema.parse(...)`, which throws a `ZodError`. R-05
asks for typed errors, so `normalizeSpec` catches the failure and throws what `encodeSpec` throws:
`RangeError("normalizeSpec: spec does not match dyelot.spec/1 at <paths>")`, paths dotted and without repeats. A spec that
is not an object, or that holds a value JSON cannot carry, throws `TypeError`; a number that is not finite throws
`RangeError`. Every message starts `normalizeSpec:`, never `canonicalize:` (the plan's cleanup of inner-function names).

**R2-02 · Entry-point exports.** The decisions name a floor. The UI also needs the option lists behind its controls, two
error classes and the hex conversions, so the entries export these too and nothing else. The runtime key sets are the
lists in section 6.1; types are checked by the compiler. `DirectionParams` gains one optional field (R2-05).

**R2-03 · The font catalog's facts.**
1. The catalog holds 40 families: the 38 families of the 20 pairings in research D2 (D2's Recursive is replaced by a true
   monospace, R2-04) and `geist` and `geist-mono` (section 5.2 lists them). The two Geist faces are not in any pairing.
2. A family id is its Google Fonts name lowercased with spaces turned into `-` (`Source Serif 4` is `source-serif-4`).
3. `variable` and `weights` are fixed by Task 2.3 from the installed Fontsource metadata. The table in 5.2 gives the
   planned values. `variable` means "has an `@fontsource-variable/<id>` package"; a family without one is `variable: false`.
   Checked against the npm registry on 2026-11-01 with `npm view <package> version`: all 34 variable entries have their
   `@fontsource-variable/<id>` package (versions 5.3.0 to 5.3.2), the six static entries have `@fontsource/<id>` (5.3.0) and
   no `@fontsource-variable/<id>` (the registry answers E404), and `@fontsource-variable/tiny5` does not exist, so Tiny5 is
   static with the single weight 400. A mismatch changes that table, not the shape. `axes` lists only `wght` for a variable family and
   nothing for a static one, because the copied file holds that one axis (item 5). For a variable family `weights` is
   `[min, max]`; for a static family it is the ascending list of the weights copied: 400 and, when the family has it, 700.
4. The copy script reads `@fontsource-variable/<id>` for a variable family and `@fontsource/<id>` for a static one. The
   plan names only the first; static families (Gloock, Young Serif, Courier Prime, Fragment Mono, Redaction, Tiny5) have no
   variable package.
5. Files land in `<out>/<id>/` (`public/fonts/<id>/` by default; `--out <dir>` changes it): the Latin file
   `<id>-latin-wght-normal.woff2` for a variable family, `<id>-latin-400-normal.woff2` and, when the family has a bold,
   `<id>-latin-700-normal.woff2` for a static one, and `OFL.txt` for both. `public/fonts/` is generated by `predev` and
   `prebuild` and is git-ignored. Tests run the script with `--out <tmp>`, because CI runs Vitest before any build.
6. `popularity` is the value from `fonts.google.com/metadata/fonts` on the day Task 2.3 runs, written into `catalog.ts` as a
   literal integer. The metadata of 2026-11-01 holds every catalog family, Redaction included. A family the
   metadata lacks takes 200, which scores 0. The catalog never fetches at runtime or in a test. The values drift between
   fetches: an earlier fetch the same day gave Archivo 27, Redaction 1036 and Geist 31. The catalog freezes the fetch
   Task 2.3 made (2026-11-01): Archivo is 14 (genericness 0.935) and Bodoni Moda is 40 (genericness 0.804), so a design
   that uses either as its display face raises T1; every other display face of the 20 pairings is at 41 or above
   (genericness below 0.8), Redaction is 997 and `geist` is 82.
7. The high-genericness list is the research's list, as names. A family is on it when its name equals an entry, or, for
   the four prefix entries `IBM Plex`, `Cormorant`, `Crimson` and `DM Serif`, when it starts with that entry and a space.
   `Inter Tight` is not on it. Of the catalog only `geist` and `geist-mono` are.
8. `fallback` is a CSS font stack by category: `sans` and `display` use
   `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`; `serif` uses
   `ui-serif, Georgia, "Times New Roman", serif`; `mono` uses
   `ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace`.

**R2-04 · Pairing ids and monos.** A pairing id is the short slug in the table in 5.2. A pairing whose D2 row has no mono
(rows 2, 3, 4, 5, 8, 9, 10, 12, 16, 20) takes `fragment-mono`, M1's mono, so every pairing fills all three families. Row 19
lists Recursive as its mono, which needs the `MONO` axis set to 1 to render monospaced and the copied `wght` file does
not carry that axis, so pairing 19 takes `spline-sans-mono`, a true monospace of the catalog. Recursive leaves the catalog.

**R2-05 · `pairing` is a direction parameter.** `DirectionParams` gains `readonly pairing?: PairingId`. Absent, the
generator writes M1's default pairing, so every M1 golden stays valid. The studio keeps `pairing` absent to mean
"auto": the store resolves it with `choosePairing(seed)` before it calls the generator. A pairing picked from the list or
set by a preset is explicit and survives regeneration. `choosePairing` draws from `seededRandom(seed + ":pairing")`, a
stream apart from the one `buildPalettes` uses, so choosing a pairing never moves a color. The spec records the three families and not whether the choice was automatic,
so `paramsOfSpec` decides: when the families equal the pairing `choosePairing(meta.seed)` picks, `pairing` stays absent
(auto); when they equal another pairing, that pairing is explicit; otherwise the fonts are custom (R2-14 item 4). A link
load infers params through `paramsOfSpec`, so it keeps auto as auto, except that an explicit choice equal to the auto
pick reads back as auto: nothing changes on screen until the next `regenerate`, which may then pick another pairing. A draft
stores the params as they were, so there an explicit choice stays explicit.

**R2-06 · Preset shape.** `Preset = { id, label, summary, params, view, guards, unexpressed }`. `params` is the
`PresetParams` patch: `harmony`, `chroma`, `neutralTint`, `contrastLevel`, `scaleMode`, `type.context`, `radius`,
`depth`, `motion` and `pairing` (absent for `default`, meaning auto). `view` is `{ mode, density }`: the studio's view
settings, which a preset sets once when applied. A preset never sets `primary`, `secondary`, `accent`, `name` or
`type.ratio`. `applyPreset` leaves locked colors and `name` alone, removes `type.ratio` because the preset's context
fixes the ratio, and never lowers the contrast level: the result's `contrastLevel` is the higher of the user's level and
the preset's (`AA` < `AA+` < `AAA`). `guards` are the accessibility notes the preset's values answer; `unexpressed` lists what the
style needs that `dyelot.spec/1` cannot hold (hard offset shadows, blur, grain). The studio shows both.

**R2-07 · Density is a view setting.** `DesignSpec` has no density field and the link holds only the spec, so density
is not shared. `Density = "comfortable" | "compact" | "dense"`. `densityVars(density)` returns `--density-offset`
(`0px`, `-4px`, `-8px`) and `--control-height` (`40px`, `36px`, `32px`), after research D1 rule 30 and the 24 px target
floor. The preset's `view.density` sets the view when the preset applies.

**R2-08 · Depth style and motion feel reach the canvas through the bridge.** M1 stores one set of shadows and one set
of motion tokens whatever `depth.style` and `motion.feel` say (M1 R-18, and the M1 test C-GEN-07 locks that). M2 keeps
the generator as it is, so no golden changes, and applies the choice in `themeVars`:
- `depth.style` `flat`: `--shadow-1` to `--shadow-5` are `none`. `soft`: the stored layers. `layered`: each stored
  layer with `offsetY` and `blur` times 1.5 and `alpha` times 1.5 (capped at 1), all through `round6`.
- `motion.feel` scales the stored durations: `calm` times 1.25, `brisk` times 1, `playful` times 1, each then rounded to
  the nearest millisecond (a tie rounds up) and capped at 500 ms, the umbrella's range (calm gives 63, 125, 188, 250,
  375, 500, 500). The feel picks the spring: `calm` is `smooth`, `brisk` is `snappy`, `playful` is `bouncy`,
  written as `--spring-duration` (seconds) and `--spring-bounce`. The preview kit reads the same spring through the pure
  `feelSpring(motion)` that `src/theme/vars.ts` exports.
- M3's `theme.css` export reuses `themeVars`, so a download matches the canvas.

**R2-09 · Taste rules read more of the spec.** The M1 `LintedSpec` holds the color section. T1 and T4 need the type
section, so `LintedSpec` gains the optional `type: { families: { display }, context, steps }` (each step
`{ name, sizePx }`); every `DesignSpec` is still one. A rule whose input is absent does not run, so every M1 caller keeps
working. `lintSpec(spec, options?)` takes `LintOptions = { catalog?: readonly FontEntry[] }`; `catalog` replaces
`FONT_CATALOG` for tests. The rules:
- A rule that has no mode reports `mode: "light"`.
- T1 skips a display family that is not in the catalog (it cannot be measured).
- T2 reports `threshold` as the nearer bound of [265, 300].
- T3 fires on an exact hex match at the steps 300, 400, 500, 600, 700 and 800 of every palette in both modes. `measured`
  and `threshold` are both 0 (ΔEOK to the matching default). The reason for the step range: the near-white and
  near-black ends (light 50 and 100, dark 950) collide with a Tailwind default by chance. Over 300 default designs
  (`s0` to `s299`) 20 specs (6.7%) had a hit, every one at light 50, light 100 or dark 950, and none had a hit at steps 300
  to 800.
- T4 reads the `body` step.
- `RULE_IDS` grows from 20 to 24 entries, T1 to T4 last.

The Tailwind table is derived, not typed: `src/engine/lint/tailwind.ts` holds the hexes that come from every
`--color-<palette>-<step>: oklch(...)` line of `node_modules/tailwindcss/theme.css` (version 4.3.3: 26 palettes, 286
entries; the four newest are `mauve`, `olive`, `mist` and `taupe`), each mapped with `toHex(gamutMap(color, "srgb"))`.
95 of the 286 are outside sRGB, so `toHex(oklchToRgb(...))` would throw. Four entries (`amber-400`, `amber-500`,
`yellow-400`, `yellow-500`) differ by one code between gamut mapping and plain clipping; the table uses gamut mapping,
like the engine. The 286 entries give 283 distinct hexes (for example `zinc-50` equals `neutral-50`). `black` and `white`
are not in the table because `onFill` picks them. The test regenerates the table from the file, derives the palette
names from it, and asserts the module's set equals the derived set; the preview guard (section 6.10) takes its
palette-name list from the same derivation.

**R2-10 · The fix table.** The decisions map K3 to the even scale mode, but K3 is not a rule of the M1 linter (M1 spec
section 9 defers it). M2 ships the four fixes that exist: C1 raises the contrast level to `AA+` (it moves only
`muted-foreground` against `muted` and `background`), and C5, N1 and F1 raise it to `AAA`. A scan of the engine found no
generated design that raises any of the four at `AA`: 576 designs (3 chroma levels × 4 neutral tints × 2 gamuts × 2 scale
modes × seeds `s0` to `s11`, `DEFAULT_PARAMS` otherwise) gave 0 findings of C1, C5, N1 or F1. These findings reach the
studio only through an opened link whose roles were made elsewhere. The fix therefore means "regenerate the design from its
parameters at a higher contrast level", which replaces every role, and the button says so (section 7.8).
`fixFor(finding, params)` is pure and does not regenerate: it reads the finding's id and the current `contrastLevel` and returns a
patch or `null`. The button applies the patch through the normal store path (`setParams`), so the worker does the
regeneration and nothing heavy runs on the main thread. When the finding is still present after that regeneration, the
inspector says so in a labeled message ("Raising the contrast did not clear this finding."). A fix whose target is not above the
current level returns `null`, and the inspector shows the finding with the note "Contrast is already <level>." and no button.
When K3 arrives a later milestone adds its row. The owner can instead map K4 to the even mode by editing this ruling.

**R2-11 · Color names API.** `names.ts` is pure and never imports the list. `indexNames(list)` takes
`readonly { name: string; hex: string }[]`, validates it and returns a frozen index with each color's OKLab
precomputed. `nearestName(color, index)` returns `{ name, hex, deltaEOK }` for the entry with the smallest ΔEOK; a tie
keeps the earlier entry in list order. The UI loads `color-name-list/bestof` with a dynamic `import()` the first time the
inspector opens, in `src/features/studio/names.ts`. The inspector names the 8 palettes (light step 500) and
`chart-1` to `chart-5`.

**R2-12 · Theme bridge details.** The exact property names are in section 5.6. `themeVars` returns a frozen record of
204 properties. It validates before it emits: a color value must be a lowercase `#rrggbb`, a family id must match
`^[a-z0-9-]{1,64}$`, and a value that holds `;`, `{`, `}` or `<` throws, so a bad spec never reaches a style
attribute. `themeVars(spec, mode, options?)` takes `options.vision?: Deficiency` and `options.units?: "vw" | "cqi"`. When `vision`
is set, every color-valued property becomes `toHex(simulate(hexToRgb(hex), vision))`; without it every color is a stored
hex. `units` defaults to `vw`, the spec's own fluid unit, which exports keep. The canvas passes `"cqi"`: `--text-display`
then has every `vw` of the `clamp` string written as `cqi`, so the fluid size follows the canvas frame (a container with
`container-type: inline-size`) and not the browser window.

**R2-13 · Store protocol.**
1. `createStudioStore(deps)` takes `{ client, storage, clock, newSeed, location, history }`; nothing is a module
   singleton, so tests build as many stores as they need. A zustand hook (`useStudio`) wraps the store for React, and
   `bindStudioWindow(store, window)` connects `hashchange` (item 5 of R2-14), `pagehide` and a hidden page (`flush()`,
   C-HASH-13); it returns the function that disconnects them.
2. The worker protocol lives in `src/features/studio/protocol.ts`: the types and the pure `runGenerate(request)`, which
   never throws. `generate.worker.ts` only wires `onmessage` to it. An inline client runs `runGenerate` on a microtask
   when `Worker` is missing or throws on construction, so tests and locked-down browsers behave the same. Both clients
   come from `createGenerateClient(post)`, which keeps one request in flight and at most one pending (R2-29). The
   store's `deps.client` is a `StudioClient` (section 5.7) built over that flow. Its `generateNow(params, seed)` runs
   the generator on the calling thread once, for the first load's fresh design: the store needs a spec before any
   reply (C-STORE-01 is `idle`), and the first posted request is id 1 (C-STORE-03). Every change goes through `request`.
   A worker message is read by `parseReply`, which checks the envelope only (the id, `ok`, the error's shape, a spec
   that is a record); item 4's `normalizeSpec` stays the one schema check of every reply. A worker that fails at run
   time (`error`, `messageerror`, an unreadable reply) is ended with one `console.error`, and the client reruns the
   request in flight inline and stays inline, so no reply is waited for forever.
3. The stale rule is monotonic. The store numbers requests 1, 2, 3 and keeps `lastApplied`. A reply applies when
   `reply.id > lastApplied`, and it then sets `lastApplied`. Any other reply is dropped. The decision says "stale replies are
   dropped"; this form also lets a long drag show progress, and when every reply has arrived the canvas always holds the
   newest request's spec. `undo`, `redo`, `loadFromHash`, `startFresh` and `revert` set `lastApplied` to the newest issued
   id, so replies already in flight cannot overwrite them, and they call the client's `drop()`, so a pending request
   that is now stale is never posted. (`revert` is added because it restores the committed snapshot just as `undo`
   does.) An error reply for a request older than the newest issued one is ignored: the newer request's reply decides
   what the canvas shows. An error reply for the newest request sets a failed status.
4. Every applied reply passes through `normalizeSpec` before the store keeps it. A reply that fails is dropped; it sets
   a failed status only when it answers the newest request, and is ignored otherwise (as error replies are, item 3).
5. `newSeed` defaults to two 32-bit draws from `crypto.getRandomValues`, written `a.toString(36) + b.toString(36)`, so an
   e2e init script can replace `getRandomValues` with a counter and know every seed (F-KEY-02).
6. A change is committed when its reply is applied. Committing pushes the previous snapshot `{ params, seed, spec }`
   onto `history` and clears `future`. A change made with a `coalesce` key merges into the previous commit, instead of
   pushing, when that commit had the same key and happened at most 1,000 ms earlier by `clock`. The times compared are the
   times the changes were issued (the user's gesture), not the times their replies arrived, so worker speed never splits
   or joins a gesture; and the window is chained: each merged change becomes the commit the next one is compared with,
   so a held key of any length is one undo step. Holding Space and
   a drag in the native color input each use a key (`regenerate`, `seed:<slot>`), so one gesture is one undo step.
   `history` holds at most 100 snapshots; the oldest falls off.
7. `mode` and the other view settings are not in a snapshot and not in the link.
8. `startFresh` sets `lastApplied` to the newest issued id before it issues its own request, so the replies of the
   requests it replaces cannot apply after it.

**R2-14 · The link, the hash and the first load.**
1. The hash grammar is `#s=` followed by the link and nothing else. An empty hash, `#`, or any hash that does not start
   with `#s=` means "no link" and shows no banner. `#s=` with an empty or invalid rest is a `corrupt` link.
2. The first load takes the hash if it decodes, else the draft, else a fresh design. When a draft exists and its
   `specId` equals the decoded hash's, the first load takes the draft's `params`, `seed` and `preset` with the spec, so an
   explicit pairing stays explicit and the preset survives a reload. A draft whose `specId` differs from the hash's is not used
   for that load; the hash wins and `preset` is `null`. A draft's `params` are used only when they pass
   `generateSystem`'s parameter checks (every enum in its set, every number and string in its domain, a known pairing id)
   and agree with `paramsOfSpec(spec)` on every field except `pairing`; otherwise they are dropped and `paramsOfSpec`
   supplies them, so the store never holds a `spec` that its `params` and `seed` do not regenerate. When a hash fails, the studio opens
   the draft or a fresh design and shows the banner, so the page is never blank.
3. The banner (`role="alert"`) has two sentences and two buttons. Its first sentence per reason is in section 6.8, C-HASH-10.
   The second sentence is "The studio opened your last draft instead." or "The studio opened a fresh design instead."
   The buttons are "Start fresh" (the one primary chrome action) and "Dismiss".
4. A link whose type families match no pairing, and are not the automatic pick for its seed (R2-05), opens normally and shows a polite notice that editing resets the fonts to
   the automatic pairing.
5. `hashchange` to another link loads it like a first load, except that the previous design goes onto `history`.

**R2-15 · Keyboard details.** The decisions say shortcuts never fire while a text field has focus. These details close
the gaps:
1. A text field is an `input` whose type takes text (everything except `color`, `checkbox`, `radio`, `range` and
   `button`), a `textarea`, a `select`, or any element with `contenteditable`. The `color` input is not one.
2. Space, ← and → also do nothing when focus sits on a control that uses the key itself: a `button`, a `summary`, a link, an
   element with role `button`, `switch`, `checkbox`, `radio`, `tab`, `slider`, `menuitem` or `option` (a native checkbox,
   radio or range input has the role implicitly), a native color input (Space opens its picker; Task 2.6), or inside an open
   drawer's focus trap. Space on the page body or the header regenerates; on the canvas region or inside it (item 5) Space and the arrow keys scroll the canvas natively.
3. A chord with Ctrl or Meta fires only for Mod+S, and Alt only for Alt+T, matched on `event.code` (`KeyT`), because Alt changes the character on some layouts. A held key repeats: Space regenerates on every
   repeat, and the worker's stale rule (R2-13) keeps the canvas current.
4. `L` fires only when focus is on a seed row's swatch button, native color input or lock toggle. It never fires from the
   hex field, which is a text field.
5. A global shortcut is also ignored when the event target is the canvas region (`<main aria-label="Canvas">`) or inside
   it, `[data-canvas]` included, so the scrollable region keeps Space and the arrow keys and a preview control that uses a
   key keeps it.
6. Escape is exempt from the text-field rule. A modal drawer must close from every control inside it.
7. Mod+S always calls `preventDefault` when it fires, so the browser's save dialog does not open. In a text field it does
   not fire, and the browser's own behavior stands.

**R2-16 · Layout details.**
1. Between 1024 and 1279 px the inputs panel stays a 320 px column beside the canvas and the inspector is a drawer.
2. A drawer is modal: it traps focus, makes the rest of the page `inert`, closes on Escape or a backdrop click, and returns
   focus to the button that opened it. A closed drawer is `inert`, so no control inside it is in the tab order.
3. A frame wider than the canvas area keeps its layout width, so its container queries answer for the named frame, and
   scales down with `transform: scale(<available / frame>)`. The switcher shows the scale ("fit 91%"). At 360 px the
   page never scrolls sideways.

**R2-17 · Locking a color.** Locking keeps the spec a pure function of its params and seed, so it regenerates the design with
the seed in `params`. It picks the seed so that the locked slot's own color stays where it was. For `primary` the seed is
`normalizeSeed({ l, c, h })` with `l` and `c` from `rgbToOklch(hexToRgb(roles.light.primary))` and `h` from
`palettes.primary.hue`. For `secondary` and `accent` it is the palette's light step 500: `l` and `c` from that step's stored
`oklch`, `h` from the palette's `hue`. The step-100 tint that a role such as `secondary` shows is never the source, and the
drifted hue of a step is never the seed's hue (a seed hue off the palette's hue moves the harmony hues). Unlocking removes the
key from `params`. Both regenerate and commit.

What the promise is, measured on 2026-11-01 with `DEFAULT_PARAMS` and `AA` or `AAA`:
- Locking `secondary` or `accent` left all 46 roles of both modes identical in every seed: 20 of 20 for `seed-1` to
  `seed-20` and 40 of 40 for `s0` to `s39`, at `AA` and at `AAA`.
- Locking `primary` keeps the primary role itself within ΔEOK 0.0017 (`seed-1` to `seed-20`) and 0.0074 (`s0` to `s39`,
  the larger of the two levels); other non-chart roles move by at most 10 codes in one channel. All 46 roles are identical in
  15 of 20 seeds at `AA` and 13 of 20 at `AAA` for `seed-1` to `seed-20`, and in 27 of 40 at `AA` and 14 of 40 at `AAA` for `s0`
  to `s39`.
- The chart roles are the exception: in the seeds that change at all, `chart-1` to `chart-5` can move, by up to 3 codes in
  `seed-1` to `seed-20` at `AA` and by up to 166 codes (`AA`) and 187 codes (`AAA`) in `s0` to `s39`. Chart colors come from a
  picker that crosses a threshold when a palette changes slightly, so a small shift of the primary scale (the locked seed
  sits on its step exactly) can choose a different chart color. This is the cause; it is not 8-bit rounding of the seed hex.
- The promise that matters is that later regenerations keep the locked color. For a locked primary over `s0` to `s39`, three
  regenerations each (120 runs per level), the locked hex sits in a scale of the new spec with no `seedDeviation` in 99 runs
  at `AA` and 105 at `AAA`; in the other 21 and 15 the spec records a `seedDeviation` (largest ΔEOK 0.0192 at `AA`, 0.0095 at
  `AAA`), as M1 R-10 says; no run drops the seed. `params.primary` is never changed by a regeneration.
The lock toggle shows no warning text; C-STORE-34 and C-STORE-41 assert these bounds. Each ΔEOK bound above is the measured
maximum rounded up to four decimals, and the tests assert it at full precision: the primary role 0.0017 (measured 0.001635,
`seed-1` to `seed-20` at `AAA`) and 0.0074 (0.007360, `s0` to `s39` at `AAA`), the largest `seedDeviation` 0.0192 (0.019136 at
`AA`) and 0.0095 (0.009452 at `AAA`). Re-measured through the store's `toggleLock` and `regenerate` in Task 2.5.

**R2-18 · Where the Review Focus 1 e2e lives.** The plan names Task 2.5 for the bad-link e2e, but the page that shows the
banner arrives in Task 2.6. The pure parts of Review Focus 1 (reasons, copy, state) are tested in Task 2.5; the e2e that
loads `/studio` with a bad hash lands with Task 2.6, which also renders a placeholder canvas that applies `themeVars` to
`[data-canvas]`, so its input-to-variable tests can run before Task 2.7 fills the canvas.

**R2-19 · Inspector tables.** The role table has 32 rows, each a pair (section 6.9). The inspector shows a "show me"
on every finding; section 6.9 maps each rule id to the roles or scale cells it highlights.

**R2-20 · Preview conventions.** A preview is a demonstration, not an application: controls change their own local state
(a checkbox checks, a tab selects, an accordion opens) and do nothing else; the command button and links navigate nowhere.
Kit parts carry `data-roles="<role> <role>"` naming the spec roles they paint with, and `data-token` for type, radius and
shadow, so the highlight and the kitchen sink can find them. A forced state is `data-state="hover|focus|pressed|..."`.
The highlight outline is a studio-chrome overlay in madder (an active state), defined in
`src/features/studio/highlight.css`, never in the preview folder.

**R2-21 · Canvas toggles.** `reducedMotion` is canvas-local: it sets `data-reduced-motion` on the canvas, and the kit passes
`reducedMotion="always"` to Motion (otherwise `"user"`). `copy` is `real` or `edge`. The edge copy has a 40-character
unbroken word, a 90-character title, a name with diacritics, the number `1,234,567,890.12`, an empty list and a
single-character label. `vision` is `none`, `protan`, `deutan` or `tritan`.

**R2-22 · New pure folders.** `src/theme/**` joins the pure-core test project (`tests/unit/theme/**` runs in `node`) and the
coverage floors of 95 for lines, statements and functions and 90 for branches. The same floors cover `src/engine/fonts/**`
and the pure helper files of the studio: `src/features/studio/{protocol,url,drafts,params,lot,inspect,fixes,client,guards,view,shortcuts,inputs}.ts` (`fixes.ts` holds `fixFor`, section 5.8; `guards.ts` holds the R-05 checks the helpers share, because the engine entry does not export its own; `view.ts` holds the view settings and `mergeView`; `shortcuts.ts` holds the key rules of R2-15 and `inputs.ts` the seed and pairing labels of the inputs panel, both added by Task 2.6, section 6.11) and
`src/features/fonts/load.ts`, which the coverage include lists by name. The rest of `src/features/**` runs in jsdom or
Playwright and is covered by the flows.

**R2-23 · The chrome keeps `next/font`.** Geist and Geist Mono for the chrome stay on `next/font`, which downloads and
self-hosts them at build time, so the browser makes no request to Google. The catalog entries `geist` and `geist-mono` are for
the canvas, where a spec may name them. `src/app/layout.tsx` is unchanged by M2 in this respect.

**R2-24 · Home link.** The home page gets a third link element, `open the studio`, with `href="/studio"`, in the same style and
list as the GitHub link. It carries no other change.

**R2-25 · The M1 cases that change.** The taste rules add findings to the M1 base spec (`seed-1` has primary hue 289, a white
page and no locked seed, so T2 fires), the generator-importing guard has to admit new importers, `RULE_IDS` grows, and the
Task 2.2 cleanup turns two errors into `TypeError`. Six M1 cases change, and every other M1 case passes unmodified:
- **C-LINT-43** (the id-set assertion at `tests/unit/engine/lint/lint-spec.test.ts:95`) compares against M1's 20 ids: the first
  20 entries of `RULE_IDS` equal them, and the findings it checks (`source`, `measured`, `threshold`) are those with an M1
  id. Adding T2 to the expected set is the other way to keep it green; the spec picks the filter.
- **C-LINT-47** filters the findings of the base spec to M1's 20 ids before it asserts silence and the N3 info findings.
- **C-REPO-02** allows an `import type` from `src/spec` anywhere under `src/engine`, and a value import from `src/spec` in
  `generate.ts`, `presets.ts` and `index.ts`; the linter files still import nothing from `src/spec` (C-ENTRY-18).
- **C-REPO-05** scans for `<Hex>` casts and `is Hex` predicates as well (Task 2.2).
- **C-CHART-07** and **C-ROLE-07** expect `TypeError`, not `RangeError`, for a missing palette or a wrong step count
  (the Task 2.2 cleanup, C-ENTRY-14).
I-M2-08 and C-TASTE-22 say this: every M1 case passes unmodified except these six, and every M1 golden holds.

**R2-26 · T5 is dropped; T3 reads steps 300 to 800.** T5 (mixed radius languages) fired on every `sharp` design, since the
spec cannot say whether a pill is drawn, and it had no fix. The decision's T5 is removed, T1 to T4 stay, and the `pills` option
of `lintSpec` goes with it. The T3 range and the Tailwind table are in R2-09.

**R2-27 · The font loader's result.** The plan's test names `loadFamily` and a result `{ loaded: false }`. The spec renames
them: `createFontLoader(deps).load(id)` resolves `{ id, status: "loaded" }` or `{ id, status: "failed", reason }`, because the
inspector needs the reason and the loader needs a status per family. The plan's Task 2.3 text should say `load` and
`status`.

**R2-28 · The selected preset is state.** The store holds `preset: PresetId | null`. `applyPreset` sets it. Any change of a
parameter the preset owns (`harmony`, `chroma`, `neutralTint`, `contrastLevel`, `scaleMode`, `type.context`, `radius`, `depth`,
`motion`, `pairing`) to a different value, and any change of `view.density`, sets it to `null`; changing a seed color, the mode,
the frame or another view setting does not. The preset select shows "Custom" when it is `null`, and the preset notes show
only for a non-null preset. The draft stores the preset id. `DesignSpec` has no preset or `direction` field, so the share
link does not carry it: a design opened from a link has `preset: null`, unless a draft with the same `specId` supplies it
(R2-14 item 2).

**R2-29 · One request in flight.** Generation takes about 0.2 s, and a worker queues messages in order, so holding Space would
line stale work behind the newest request. `createGenerateClient(post)` posts a request only when none is in flight. While one
is in flight, a new request replaces the one pending, so a superseded request is never posted. When a reply arrives, the
client posts the pending request, if any. Request ids stay monotonic and the store's rule (R2-13 item 3) is unchanged.

**R2-30 · The canvas is isolated from the chrome.** Inside `[data-canvas]`: `color-scheme` is set per mode (`light` or `dark`)
so native controls follow the spec's mode and not the chrome's dark scheme; the focus ring is `outline: 2px solid var(--ring)`, and the rule `[data-canvas] * { outline-color: var(--ring) }` sets the outline color explicitly so the chrome's madder outline cannot reach a canvas element;
`::selection` uses `--primary` with `--primary-foreground`, the caret uses `--primary`, and the scrollbar uses `--border` and
`--muted`; the fluid display size follows the canvas (R2-12). The only madder inside the canvas is the highlight overlay of
"Show me" (R2-20). The chrome-only accessibility cases (the madder focus ring, the achromatic chrome) apply outside
`[data-canvas]`.

## 4. Conventions and invariants

### Reading the cases

- **Kind.** `pass` is a valid input with an expected output. `failure` is an invalid input or a broken invariant with an
  expected typed error, finding or labeled message.
- **Origin.** `plan` is a test that the plan's Step 1 lists. `RF1` to `RF5` is a Review Focus item. `decision` is a rule
  stated in section 2. `ruling` is a rule in section 3. `added` is a boundary or failure case that this spec adds.
- **Tolerances.** As in M1: hex channels ±1, OKLCH L and C ±0.001, H ±0.1°, a contrast ratio on its full float. "≈" means
  these tolerances unless the case names another.
- **Layers.** Pure cases (prefix `C-`) run in Vitest: `node` for `src/engine`, `src/spec` and `src/theme`, `jsdom` for
  `src/features`. Flow cases (prefix `F-`) run in Playwright against the production build with axe. A property case uses
  fast-check with the run count it states; a property that calls `generateSystem` sets its own timeout.
- **Fixtures.** `DEFAULT_PARAMS` and `HUES` are M1's. `SPEC` is `generateSystem(DEFAULT_PARAMS, "seed-1")`. `FRESH` is the
  studio's first-load state with `newSeed` stubbed to return `"seed-1"`. A fake `clock` and fake timers drive every
  debounce and every coalesce window. A `StubClient` posts requests and replies in any order the test chooses.
- **Case ids.** `C-ENTRY`, `C-NORM`, `C-FONT`, `C-LOAD`, `C-PAIR`, `C-PRESET`, `C-TASTE`, `C-NAME`, `C-THEME`, `C-DENSITY`,
  `C-STORE`, `C-WORK`, `C-HASH`, `C-DRAFT`, `C-INSPECT`, `C-GUARD`, `C-REPO`; flows `F-STUDIO`, `F-INPUT`,
  `F-KEY`, `F-CANVAS`, `F-TPL`, `F-INSP`, `F-A11Y`, `F-HOME`.

### Invariants

- **I-M2-01 · The store holds normalized specs.** Every `spec` in the store, in `history` and in `future` equals
  `normalizeSpec(spec)`, so `decodeSpec(encodeSpec(spec))` deep-equals it.
- **I-M2-02 · The canvas never shows a stale spec.** Once every reply has arrived, `spec` is the spec of the newest
  request that was not superseded by `undo`, `redo` or a load.
- **I-M2-03 · The chrome never shows a raw error.** Every failure is a labeled message with a next step: a banner, a field
  message, an inspector note or a toast.
- **I-M2-04 · The canvas holds only the spec's colors.** Every color the preview source writes is a custom property that
  `themeVars` wrote; the guard (section 6.10) enforces it in source. In the DOM, no computed color inside `[data-canvas]`
  equals a chrome color (madder, the page, the panel or a house neutral); F-CANVAS-01 checks that. The one overlay is the
  "Show me" outline (R2-20).
- **I-M2-05 · Storage and clipboard are optional.** The studio works with `localStorage`, `history.replaceState` and
  `navigator.clipboard` each missing or throwing.
- **I-M2-06 · No request goes to Google at runtime.** No source file names `fonts.googleapis.com` or `fonts.gstatic.com`; the e2e
  records no request to either. The chrome's `next/font` self-hosts at build time (R2-23).
- **I-M2-07 · The pure core stays pure.** `src/engine`, `src/spec` and `src/theme` read no DOM, storage or network and import
  nothing from `src/features`, `src/app` or `src/components`.
- **I-M2-08 · M1 is unchanged except six cases.** Every M1 case passes unmodified except the six that R2-25 lists (C-LINT-43,
  C-LINT-47, C-REPO-02, C-REPO-05, C-CHART-07, C-ROLE-07), and every M1 golden (spec ids, share links) holds, because the generator's output is the same when
  `pairing` is absent.

## 5. Public API of the new pure modules

### 5.1 Entry points and `normalizeSpec` (Task 2.2)

Files: `src/engine/index.ts`, `src/spec/index.ts`; `normalizeSpec` in `src/spec/canonical.ts`; `biome.json`.

```ts
// src/spec/canonical.ts
function normalizeSpec(spec: DesignSpec): DesignSpec; // DesignSpecSchema.parse(JSON.parse(canonicalize(spec))), R2-01
```

The entries are the only way for code outside `src/engine`, `src/spec` and `src/theme` to reach them. Biome's
`noRestrictedImports` rejects `@/engine/<anything>` and `@/spec/<anything>` and any relative path into them from
`src/features`, `src/app`, `src/components` and `src/lib`. The M1 final-review cleanups ride along:
- `simulate` checks its deficiency with `assertOneOf`.
- A missing palette, or a palette whose scale has not 11 steps, is a `TypeError` in the functions that read palettes.
- Inner-function names in public errors become the public entry's name.
- The name and seed bounds are exported from the schema and used once each. The 0.5 chroma ceiling is defined once, as `CHROMA_CEILING` in `src/engine/color/guards.ts` (the schema imports it from there, because R2-25 lets only `generate.ts`, `presets.ts` and `index.ts` import values from `src/spec`), and every other use imports it.
- The repository guard C-REPO-05 also catches `<Hex>` casts and new `is Hex` predicates.
- The wording "the engine never imports `src/spec`" becomes "the linter never imports `src/spec`".

### 5.2 Fonts, pairings and the loader (Task 2.3)

Files: `src/engine/fonts/{catalog,pairings}.ts`, `scripts/copy-fonts.mjs`, `src/features/fonts/load.ts`.

```ts
type FontCategory = "sans" | "serif" | "mono" | "display";
type FontEntry = {
  readonly id: string;                 // ^[a-z0-9-]+$, unique
  readonly family: string;             // the Google Fonts name
  readonly category: FontCategory;
  readonly variable: boolean;
  readonly axes: readonly string[];    // ["wght"] for a variable family, [] for a static one (R2-03 item 3)
  readonly weights: readonly number[]; // variable: [min, max]; static: ascending subset of [400, 700]
  readonly license: "OFL-1.1";
  readonly popularity: number;         // integer >= 1, lower = more common
  readonly fallback: string;           // R2-03 item 8
};
const FONT_CATALOG: readonly FontEntry[];             // frozen, 40 entries, in the table's order
function genericnessOf(popularity: number): number;   // 1 - clamp((popularity - 1) / 199, 0, 1)
function genericness(id: string, catalog?: readonly FontEntry[]): number; // 1 on the high list, else genericnessOf(popularity); a non-array catalog is a TypeError
function isHighGenericnessFamily(family: string): boolean; // by name, with the four prefix entries (R2-03 item 7); internal, not on the entry
const HIGH_GENERICNESS_FAMILIES: readonly string[];   // the research list, frozen
function fontStack(id: string): string;               // `"Host Grotesk", <fallback>`
function fontFiles(id: string): readonly string[];    // R2-03 item 5, relative to /fonts/<id>/
function validateCatalog(entries: readonly FontEntry[]): readonly string[]; // problems, empty when valid

type PairingId = string; // one of PAIRING_IDS
type Pairing = {
  readonly id: PairingId; readonly label: string;
  readonly display: string; readonly body: string; readonly mono: string; // catalog ids
  readonly fit: readonly string[]; readonly risk: "low" | "low-med" | "med";
};
const PAIRINGS: readonly Pairing[];       // frozen, 20 entries, in D2's order
const PAIRING_IDS: readonly PairingId[];
function choosePairing(seed: string, pairings?: readonly Pairing[], catalog?: readonly FontEntry[]): PairingId;
```

`choosePairing` weights each pairing by `w = 1 − 0.7 × genericness(display)`, draws one `u` from
`seededRandom(seed + ":pairing")` and walks the cumulative weights to `u × total` (R2-05). `genericness` throws
`RangeError` for an unknown id and `TypeError` for a non-string.

The 40 families and the 20 pairings (research D2). `var` is the `variable` flag (R2-03 item 3); the flags were checked
against the npm registry on 2026-11-01. A variable family's `axes` is `wght` alone, because the copied file
holds that axis only; the research's other axes (`wdth`, `opsz`, `ROND`) are out of reach in M2.

| id | Family | Category | var | Axes (planned) | In pairing |
|---|---|---|---|---|---|
| `host-grotesk` | Host Grotesk | sans | yes | wght | 1 (display, body) |
| `fragment-mono` | Fragment Mono | mono | no | none | 1 (mono); the default mono of R2-04 |
| `schibsted-grotesk` | Schibsted Grotesk | sans | yes | wght | 2 (display) |
| `source-serif-4` | Source Serif 4 | serif | yes | wght | 2 (body) |
| `gloock` | Gloock | serif | no | none | 3 (display) |
| `albert-sans` | Albert Sans | sans | yes | wght | 3, 19 (body) |
| `young-serif` | Young Serif | serif | no | none | 4 (display) |
| `onest` | Onest | sans | yes | wght | 4 (body) |
| `bodoni-moda` | Bodoni Moda | serif | yes | wght | 5 (display) |
| `familjen-grotesk` | Familjen Grotesk | sans | yes | wght | 5 (body) |
| `literata` | Literata | serif | yes | wght | 6 (display) |
| `spline-sans` | Spline Sans | sans | yes | wght | 6, 13 (body) |
| `spline-sans-mono` | Spline Sans Mono | mono | yes | wght | 6, 13, 19 (mono) |
| `hubot-sans` | Hubot Sans | sans | yes | wght | 7 (display) |
| `mona-sans` | Mona Sans | sans | yes | wght | 7 (body) |
| `martian-mono` | Martian Mono | mono | yes | wght | 7 (mono) |
| `funnel-display` | Funnel Display | display | yes | wght | 8 (display) |
| `funnel-sans` | Funnel Sans | sans | yes | wght | 8 (body) |
| `zalando-sans-expanded` | Zalando Sans Expanded | sans | yes | wght | 9 (display) |
| `zalando-sans` | Zalando Sans | sans | yes | wght | 9 (body) |
| `unbounded` | Unbounded | display | yes | wght | 10 (display) |
| `golos-text` | Golos Text | sans | yes | wght | 10 (body) |
| `archivo` | Archivo | sans | yes | wght | 11 (display, body) |
| `courier-prime` | Courier Prime | mono | no | none | 11 (mono) |
| `big-shoulders` | Big Shoulders | display | yes | wght | 12 (display) |
| `red-hat-text` | Red Hat Text | sans | yes | wght | 12, 14, 15 (body) |
| `tiny5` | Tiny5 | display | no | none | 13 (display) |
| `doto` | Doto | display | yes | wght | 14 (display) |
| `red-hat-mono` | Red Hat Mono | mono | yes | wght | 14, 15 (mono) |
| `redaction` | Redaction | serif | no | none | 15 (display) |
| `commissioner` | Commissioner | sans | yes | wght | 16 (display, body) |
| `atkinson-hyperlegible-next` | Atkinson Hyperlegible Next | sans | yes | wght | 17 (display, body) |
| `atkinson-hyperlegible-mono` | Atkinson Hyperlegible Mono | mono | yes | wght | 17 (mono) |
| `google-sans-flex` | Google Sans Flex | sans | yes | wght | 18 (display, body) |
| `google-sans-code` | Google Sans Code | mono | yes | wght | 18 (mono) |
| `anybody` | Anybody | display | yes | wght | 19 (display) |
| `science-gothic` | Science Gothic | display | yes | wght | 20 (display) |
| `hanken-grotesk` | Hanken Grotesk | sans | yes | wght | 20 (body) |
| `geist` | Geist | sans | yes | wght | none (the chrome) |
| `geist-mono` | Geist Mono | mono | yes | wght | none (the chrome) |

| # | Pairing id | Display | Body | Mono | Fit | Risk |
|---|---|---|---|---|---|---|
| 1 | `host-grotesk` | host-grotesk | host-grotesk | fragment-mono | Swiss, dev-tool | low |
| 2 | `schibsted-serif` | schibsted-grotesk | source-serif-4 | fragment-mono | editorial | low-med |
| 3 | `gloock-albert` | gloock | albert-sans | fragment-mono | luxury, editorial minimal | low |
| 4 | `young-onest` | young-serif | onest | fragment-mono | organic, food, consumer | low |
| 5 | `bodoni-familjen` | bodoni-moda | familjen-grotesk | fragment-mono | fashion, luxury (Bodoni Moda has genericness 0.804, so T1 flags it and `choosePairing` weights it down) | med |
| 6 | `literata-spline` | literata | spline-sans | spline-sans-mono | docs, reading apps | low |
| 7 | `hubot-mona` | hubot-sans | mona-sans | martian-mono | tech brand, dev-tool | low |
| 8 | `funnel` | funnel-display | funnel-sans | fragment-mono | startup marketing | low |
| 9 | `zalando` | zalando-sans-expanded | zalando-sans | fragment-mono | e-commerce | low |
| 10 | `unbounded-golos` | unbounded | golos-text | fragment-mono | Y2K, retro-futurism | low |
| 11 | `archivo-courier` | archivo | archivo | courier-prime | neo-brutalism, zine (Archivo has genericness 0.935, so T1 flags it and `choosePairing` weights it down) | med |
| 12 | `shoulders-redhat` | big-shoulders | red-hat-text | fragment-mono | sports, industrial, events | low |
| 13 | `tiny5-spline` | tiny5 | spline-sans | spline-sans-mono | dithering, pixel | low |
| 14 | `doto-redhat` | doto | red-hat-text | red-hat-mono | retro-tech, dashboards | low |
| 15 | `redaction-redhat` | redaction | red-hat-text | red-hat-mono | grain, anti-design, editorial | low |
| 16 | `commissioner` | commissioner | commissioner | fragment-mono | organic, calm | low |
| 17 | `atkinson` | atkinson-hyperlegible-next | atkinson-hyperlegible-next | atkinson-hyperlegible-mono | accessible, public sector, health | low |
| 18 | `google-flex` | google-sans-flex | google-sans-flex | google-sans-code | M3-Expressive-like | med |
| 19 | `anybody-albert` | anybody | albert-sans | spline-sans-mono | kinetic typography | low |
| 20 | `science-hanken` | science-gothic | hanken-grotesk | fragment-mono | sci-fi, HUD | low |

The loader (`src/features/fonts/load.ts`) is a factory so tests inject the browser API:

```ts
type FontStatus = "idle" | "loading" | "loaded" | "failed";
type FontResult =
  | { readonly id: string; readonly status: "loaded" }
  | { readonly id: string; readonly status: "failed"; readonly reason: "load" | "timeout" | "unsupported" };
type FontLoader = {
  load(id: string): Promise<FontResult>;   // never rejects for a known id
  status(id: string): FontStatus;
  subscribe(listener: () => void): () => void;
};
function createFontLoader(deps: { FontFace?: typeof FontFace; fonts?: FontFaceSet; timeoutMs?: number }): FontLoader;
const fontLoader: FontLoader; // the browser instance: timeoutMs 8000
```

A variable family loads one `FontFace(family, "url(/fonts/<id>/<id>-latin-wght-normal.woff2) format('woff2')", { weight:
"<min> <max>", display: "swap" })`; a static family loads one face per copied weight, from
`<id>-latin-<weight>-normal.woff2`. A loaded face joins `document.fonts`.

### 5.3 Presets (Task 2.4)

File: `src/engine/presets.ts`.

```ts
type Density = "comfortable" | "compact" | "dense";
type PresetParams = {
  readonly harmony: Harmony; readonly chroma: ChromaLevel; readonly neutralTint: NeutralTint;
  readonly contrastLevel: ContrastLevel; readonly scaleMode: ScaleMode;
  readonly type: { readonly context: TypeContext };
  readonly radius: RadiusSet; readonly depth: DepthStyle; readonly motion: MotionFeel;
  readonly pairing?: PairingId;                 // absent: auto (R2-05)
};
type Preset = {
  readonly id: PresetId; readonly label: string; readonly summary: string;
  readonly params: PresetParams;
  readonly view: { readonly mode: Mode; readonly density: Density };
  readonly guards: readonly string[]; readonly unexpressed: readonly string[];
};
const PRESET_IDS: readonly PresetId[];          // frozen, 14, in the table's order
const PRESETS: Readonly<Record<PresetId, Preset>>; // deeply frozen
function applyPreset(params: DirectionParams, id: PresetId): DirectionParams; // R2-06
```

The parameters of each preset. Every value comes from research D3's row for the style, and R2-06 to R2-08 explain the
cells where D3 gives a range. Contrast levels answer each style's guard: styles whose pitfall is low contrast take `AA+`
or `AAA`. `neo-brutalism` takes `anybody-albert` (width and weight extremes, display genericness 0 at popularity 567)
and not `archivo-courier`, whose Archivo scores 0.935 and would raise T1 on every design. `maximalism` takes
`gloock-albert` (a high-contrast display serif in the role Bodoni Moda had, genericness 0 at popularity 421) and not
`bodoni-familjen`, whose Bodoni Moda scores 0.804. `applyPreset` keeps the higher of
the user's contrast level and the preset's (R2-06).

| Id | Harmony | Chroma | Tint | Contrast | Scale | Type context | Radius | Depth | Motion | Pairing | Mode | Density |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `default` | analogous | balanced | brand | AA | standard | product | soft | soft | brisk | auto | light | comfortable |
| `minimal-swiss` | monochrome | muted | none | AA+ | standard | product | sharp | flat | brisk | `host-grotesk` | light | comfortable |
| `editorial` | analogous | muted | warm | AA+ | standard | editorial | sharp | flat | calm | `schibsted-serif` | light | comfortable |
| `neo-brutalism` | triadic | vivid | none | AA+ | even | product | sharp | flat | brisk | `anybody-albert` | light | comfortable |
| `glass` | analogous | balanced | cool | AAA | standard | marketing | round | layered | calm | `funnel` | light | comfortable |
| `dark-dev-tool` | analogous | balanced | brand | AA+ | standard | dense | soft | flat | brisk | `hubot-mona` | dark | dense |
| `bento` | analogous | balanced | brand | AA | standard | product | round | soft | brisk | `commissioner` | light | comfortable |
| `aurora` | analogous | vivid | cool | AA+ | standard | marketing | round | soft | calm | `zalando` | light | comfortable |
| `retro-futurism` | split | vivid | cool | AA+ | even | marketing | round | layered | playful | `unbounded-golos` | dark | comfortable |
| `tactile` | analogous | balanced | warm | AA | standard | product | soft | layered | brisk | `shoulders-redhat` | light | comfortable |
| `maximalism` | tetradic | vivid | none | AA+ | even | poster | soft | layered | playful | `gloock-albert` | light | comfortable |
| `organic` | analogous | muted | warm | AA+ | standard | editorial | round | soft | calm | `young-onest` | light | comfortable |
| `dithering-pixel` | monochrome | balanced | none | AAA | standard | product | sharp | flat | brisk | `tiny5-spline` | dark | compact |
| `m3-expressive` | analogous | balanced | brand | AA | standard | product | round | soft | playful | `google-flex` | light | comfortable |

The `guards` and `unexpressed` notes of each preset (a test asserts both lists are non-empty for every preset except
`default`, whose lists are empty):

| Id | Guards (answered by the values above or checked by lint) | Unexpressed in `dyelot.spec/1` |
|---|---|---|
| `minimal-swiss` | Grey text stays at 4.5:1 or more; hairlines stay at 3:1 or more; one accent | 1 px rules between regions |
| `editorial` | Small serif text stays at 16 px or more; underline-only inputs keep 3:1 | Uppercase tracked labels, underlined inputs |
| `neo-brutalism` | Yellow and cyan text keep 4.5:1 (`AA+`); hard shadows exist only here | A 4 px hard offset shadow with no blur; 2 to 4 px borders; the press that translates onto the shadow |
| `glass` | Contrast holds without the backdrop (`AAA`); glass only on floating chrome | Backdrop blur of 12 to 24 px; a 10 to 25% white fill; a reduced-transparency fallback |
| `dark-dev-tool` | Surfaces step by lightness; grey-on-grey keeps 4.5:1; the page is not `#000` | Borders at 6 to 12% white; the command palette |
| `bento` | Reflow keeps reading and focus order; tiles differ in size | Grid spans |
| `aurora` | Text over the gradient keeps 4.5:1 (`AA+`); motion stops under reduced motion; avoid purple-blue by the T2 rule | Blurred gradient blobs; grain against banding |
| `retro-futurism` | Neon text keeps 4.5:1 (`AA+`); no vibration | Chrome gradients; glossy highlights |
| `tactile` | One light source; shadows tinted toward the page | Inner highlights; noise |
| `maximalism` | Hierarchy survives five or more colors (`even` mode); reading order stays | Collage, rotation, overlap |
| `organic` | Earth tones keep 4.5:1 (`AA+`); not wellness beige | Paper grain; superellipse corners |
| `dithering-pixel` | Pixel faces for display only; body stays legible (`AAA`) | Ordered dither shader; `image-rendering: pixelated` |
| `m3-expressive` | Familiar patterns stay; springs use no overshoot on color and opacity | Shape morphing; emphasized weight |

### 5.4 Taste rules (Task 2.4)

Files: `src/engine/lint/{types,rules,index}.ts`, `src/engine/lint/tailwind.ts` (the derived Tailwind hexes of R2-09, not exported from the entry).

```ts
type RuleId = /* M1's 20 */ | "T1" | "T2" | "T3" | "T4";
type LintOptions = { readonly catalog?: readonly FontEntry[] };
function lintSpec(spec: LintedSpec, options?: LintOptions): readonly Finding[]; // R2-09
```

| Id | Measures | Fires when | Severity | Mode | Subject | `measured` / `threshold` | `source` |
|---|---|---|---|---|---|---|---|
| T1 | Genericness of `type.families.display` | genericness ≥ 0.8 | warn | light | `display` | genericness / 0.8 | `research D2, D4: overused display face` |
| T2 | `palettes.primary.hue`, with the light `background` and `color.params.primary` | hue in [265, 300], light `background` is `#ffffff`, and `params.primary` is absent | warn | light | `primary` | hue / nearer bound (265 or 300) | `research D4: purple on white` |
| T3 | Steps 300 to 800 of the 8 palettes, light and dark, against the derived Tailwind v4 hexes (R2-09) | the step's `hex` equals a default hex | warn | the scale's mode | `<palette>-<step>` | 0 / 0 | `research D4: Tailwind defaults used verbatim` |
| T4 | `type.steps` entry `body`, `sizePx` | `sizePx` < 16 and `type.context` is not `dense` | warn | light | `body` | sizePx / 16 | `research D1 rule 20: body size floor` |

Findings sort as in M1 (severity, id, mode, subject). The fix for T1 to T4 is a studio action, not a field of `Finding`.

### 5.5 Color names (Task 2.4)

File: `src/engine/color/names.ts`.

```ts
type NameEntry = { readonly name: string; readonly hex: string };
type NameIndex = /* frozen; entries with precomputed OKLab */;
function indexNames(list: readonly NameEntry[]): NameIndex;
function nearestName(color: Oklch, index: NameIndex): { name: string; hex: string; deltaEOK: number };
```

### 5.6 The theme bridge (Task 2.5)

File: `src/theme/vars.ts`. Every function is pure and imports the engine and spec only through their entries.

```ts
type ThemeVars = Readonly<Record<string, string>>;
function themeVars(spec: DesignSpec, mode: Mode, options?: { vision?: Deficiency; units?: "vw" | "cqi" }): ThemeVars;
function densityVars(density: Density): ThemeVars;
function feelSpring(motion: DesignSpec["motion"]): { visualDuration: number; bounce: number };
```

`themeVars` writes 204 properties, in this order. The names are exact.

| Group | Names | Count | Value |
|---|---|---|---|
| Roles | `--background`, `--foreground`, `--card`, `--card-foreground`, … every name in `ROLE_NAMES` as `--<role>` (`--primary-foreground`, `--destructive-subtle`, `--sidebar-ring`, `--chart-1` to `--chart-5`) | 46 | `spec.color.roles[mode][role]` |
| Scales | `--<palette>-<step>` for the 8 palettes of `PALETTE_NAMES` and the 11 steps of `STEPS` (`--neutral-50` … `--info-950`, `--primary-600`, `--danger-500`) | 88 | the `hex` of that mode's scale step |
| Type | `--text-<step>`, `--leading-<step>`, `--tracking-<step>` for the 10 steps `caption`, `label`, `body-sm`, `body`, `lead`, `h4`, `h3`, `h2`, `h1`, `display` | 30 | `<sizePx>px` (the `clamp` string for a fluid `display`, with `vw` written as `cqi` under `units: "cqi"`), `<lineHeightPx>px`, `<trackingEm>em` |
| Families | `--font-display`, `--font-body`, `--font-mono` | 3 | `fontStack(id)`; an id outside the catalog gets the category fallback (sans for display and body, mono for mono) |
| Space | `--space-<unit>` for units 0, 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32 | 12 | `<px>px`, with `--space-0` as `0px` |
| Radius | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, `--radius-2xl`, `--radius-full` | 6 | `<px>px`, `--radius-full` as `9999px` |
| Shadows | `--shadow-1` … `--shadow-5` | 5 | by `depth.style` (R2-08): `none`, or `<key>, <ambient>` |
| Durations | `--duration-instant`, `-fast`, `-quick`, `-base`, `-slow`, `-slower`, `-slowest` | 7 | `<ms>ms`, scaled by the feel and capped at 500 (R2-08) |
| Easings | `--ease-standard`, `--ease-decelerate`, `--ease-accelerate`, `--ease-emphasized` | 4 | `cubic-bezier(<a>, <b>, <c>, <d>)` |
| Springs | `--spring-duration`, `--spring-bounce` | 2 | the feel's spring: seconds, and the bounce |
| Icons | `--icon-stroke` | 1 | `String(components.icons.strokePx)` |

A shadow layer is `0 <offsetY>px <blur>px 0 <color>` with `<color>` as `formatOklch(layer.color)` with ` / <alpha>`
before the closing parenthesis (`oklch(0.2000 0.0100 262.00 / 0.1)`). A fluid `display` keeps the spec's `clamp`
string, except that `units: "cqi"` rewrites its `vw` as `cqi`. Numbers are written with `String`, so `0.1` stays `0.1`.

### 5.7 Studio state (Task 2.5)

Files: `src/features/studio/{store,protocol,client,generate.worker,url,drafts,params,lot,fixes,guards,view}.ts`.
`guards.ts` holds the R-05 checks the helpers share (`describeType`, `assertRecord`, `assertOneOf` and the rest),
because the engine entry does not export its own; `view.ts` holds the view settings, kept apart from the store so their
checks sit under the pure floors (R2-22).

```ts
type Notice =
  | { kind: "link"; reason: "corrupt" | "version" | "schema"; issues?: readonly string[];
      fallback: "draft" | "fresh" | "current" }
  | { kind: "generation"; message: string }
  | { kind: "custom-fonts" }
  | { kind: "draft-restored" }
  | { kind: "copy-blocked" };
type Status = { phase: "idle" | "generating" | "failed"; notice: Notice | null; draft: "on" | "off" };
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
type ParamsPatch = DeepPartial<DirectionParams>;      // `type` merges by key; an optional key set to undefined is removed (`pairing: undefined` means auto)
type TemplateId = "landing" | "dashboard" | "settings" | "mobile" | "editorial" | "kitchen-sink";
type Highlight = { roles: readonly string[]; cells: readonly { palette: PaletteName; step: Step }[] };
type Snapshot = { params: DirectionParams; seed: string; spec: DesignSpec; preset: PresetId | null };
type View = { mode: Mode; density: Density; frame: 360 | 768 | 1280; template: TemplateId;
              reducedMotion: boolean; copy: "real" | "edge"; vision: "none" | Deficiency;
              highlight: Highlight | null };
type StudioState = Snapshot & { history: readonly Snapshot[]; future: readonly Snapshot[]; status: Status; view: View };
// `preset` follows R2-28; a pairing absent from `params` is auto (R2-05)

type StudioActions = {
  setParams(patch: ParamsPatch, options?: { coalesce?: string }): void;
  applyPreset(id: PresetId): void;
  regenerate(): void;                                   // new seed from deps.newSeed; coalesce "regenerate"
  toggleLock(slot: Lockable): void;                     // R2-17
  setSeedColor(slot: Lockable, text: string, options?: { coalesce?: string }): { ok: true } | { ok: false; message: string };
  undo(): void; redo(): void;
  toggleMode(): void;                                   // view.mode, no history, no request
  setView(patch: Partial<View>): void;
  loadFromHash(hash: string): void;
  startFresh(): void; revert(): void; dismissNotice(): void;
  flush(): void;                                        // writes a pending hash and draft now (C-HASH-13)
  dispose(): void;                                      // saves a pending draft, never the hash
};
type StudioClient = {
  generateNow(params: DirectionParams, seed: string): DesignSpec; // the first load's fresh design only (R2-13 item 2)
  request(request: GenerateRequest): void;
  subscribe(listener: (reply: GenerateReply) => void): () => void;
  drop(): void;                                         // forgets the pending request (R2-13 item 3)
  dispose(): void;
};
type StudioDeps = { client: StudioClient; storage: StorageLike | null; clock: () => number; newSeed: () => string;
                    location: Pick<Location, "hash" | "pathname" | "search">; history: Pick<History, "replaceState"> };
function createStudioStore(deps: StudioDeps): StoreApi<StudioState & StudioActions>;
function useStudio<T>(store: StoreApi<StudioState & StudioActions>, selector: (studio: StudioState & StudioActions) => T): T;
function bindStudioWindow(store: StoreApi<StudioState & StudioActions>, win: Window): () => void; // hashchange, pagehide, visibilitychange
function randomSeed(source?: Pick<Crypto, "getRandomValues">): string; // the default newSeed (R2-13 item 5)
```

Why the notice and the actions grew past the decisions:
- `draft-restored` is the notice F-STUDIO-18 shows ("Restored your last draft.") when a draft opens with no hash.
- The link fallback `current` is for a bad link that arrives by `hashchange` mid-session: the studio keeps the design it
  holds, and the banner's second sentence says "The studio kept the current design." (C-STORE-22, C-HASH-14).
- `flush()` and `bindStudioWindow` let `pagehide` and a hidden page write the pending hash and draft at once (C-HASH-13),
  with the listeners tested in Task 2.5 and only wired by the page in Task 2.6.
- On a first load the notices rank: a link that failed (`link`, Review Focus 1), then `custom-fonts` (R2-14 item 4, a
  warning about what editing does), then `draft-restored`.
- `status.draft` starts `off` when there is no storage or its read throws (`loadDraft`), and follows each write after.

The pure helpers:

```ts
// protocol.ts
type GenerateRequest = { id: number; params: DirectionParams; seed: string };
type GenerateReply =
  | { id: number; ok: true; spec: DesignSpec }
  | { id: number; ok: false; error: { name: string; message: string } };
function runGenerate(request: GenerateRequest): GenerateReply; // never throws; a request with no readable id gets id 0
function parseReply(data: unknown): GenerateReply | null;    // the envelope only; null when the id cannot be read (R2-13 item 2)
// client.ts (R2-29)
function createGenerateClient(post: (request: GenerateRequest) => void): {
  request(request: GenerateRequest): void;   // posts now, or replaces the one pending request
  reply(reply: GenerateReply): void;          // call when a reply arrives: posts the pending request, if any
  drop(): void;                               // forgets the pending request
};
function clientOver(open: (deliver: (reply: GenerateReply) => void) => { send(request: GenerateRequest): void; close(): void }): StudioClient;
function createInlineClient(): StudioClient;
function createStudioClient(spawn?: () => WorkerLike): StudioClient; // a Web Worker, or inline when it cannot start
// url.ts
type HashResult = { kind: "none" } | { kind: "spec"; spec: DesignSpec }
                | { kind: "error"; reason: "corrupt" | "version" | "schema"; issues?: readonly string[] };
function readHash(hash: string): HashResult;
function writeHash(spec: DesignSpec): string;           // `#s=<encodeSpec(spec)>`
function linkUrl(origin: string, spec: DesignSpec): string; // `<origin>/studio#s=...`
function bannerFor(notice: Notice): { message: string; detail: string };
function encodeLink(spec: DesignSpec, caller: string): string; // `encodeSpec`, its errors named for `caller`
// drafts.ts: the value under `dyelot:draft` is `{ v: 1, link, params, preset }`; `params` keep an absent pairing absent (auto)
function safeStorage(win: { localStorage?: unknown } | undefined): StorageLike | null; // null when the accessor throws
type Draft = { spec: DesignSpec; params: DirectionParams | null; seed: string; preset: PresetId | null };
function readDraft(storage: StorageLike | null): Draft | null; // params null when they fail the domain check or do not regenerate the spec
function loadDraft(storage: StorageLike | null): { draft: Draft | null; readable: boolean }; // readDraft, and whether the read worked
function writeDraft(storage: StorageLike | null, snapshot: Snapshot): { ok: boolean };
function clearDraft(storage: StorageLike | null): void;
// params.ts
const DIRECTION_PARAM_KEYS: readonly (keyof DirectionParams)[]; // the one key list of parseParams and setParams
function freshParams(): DirectionParams;                // the default preset's params, sRGB, pairing absent
function paramsOfSpec(spec: DesignSpec): { params: DirectionParams; customFonts: boolean };
function resolveParams(params: DirectionParams, seed: string): DirectionParams; // fills an absent pairing with choosePairing(seed)
function parseParams(value: unknown): DirectionParams | null; // R2-14 item 2's domain check
function paramsMatchSpec(params: DirectionParams, spec: DesignSpec): boolean; // R2-14 item 2's agreement
function mergeParams(params: DirectionParams, patch: ParamsPatch, caller?: string): DirectionParams; // setParams's merge
function withSeed(params: DirectionParams, slot: Lockable, seed: Oklch | undefined): DirectionParams;
function lockSeed(spec: DesignSpec, slot: Lockable): Oklch; // R2-17
function touchesPreset(before: DirectionParams, after: DirectionParams): boolean; // R2-28
// view.ts
const DEFAULT_VIEW: View;
function mergeView(view: View, patch: Partial<View>, caller?: string): View; // setView's checked merge
// lot.ts
function lotTag(id: string): string;                    // "0123456789abcdef" -> "0123·4567"
// shortcuts.ts (Task 2.6): the key rules of R2-15, read from the event and its target
type KeyPress = { key: string; code: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean;
                  shiftKey: boolean; isComposing: boolean; repeat: boolean };
type Shortcut = { kind: "close-drawer" | "copy-link" | "toggle-mode" | "regenerate" | "undo" | "redo" }
              | { kind: "toggle-lock"; slot: Lockable };
const CANVAS_REGION = "[data-canvas-region]";           // on <main aria-label="Canvas">
const SEED_SLOT = "data-seed-slot";                     // on each seed row's color input and lock toggle
function isTextField(element: Element): boolean;        // R2-15 item 1
function usesKey(element: Element): boolean;            // R2-15 item 2
function shortcutFor(press: KeyPress, target: Element | null, context: { drawerOpen: boolean }): Shortcut | null;
function isSaveChord(press: Pick<KeyPress, "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): boolean; // Mod+S
// inputs.ts (Task 2.6)
const SEED_FIELD_MESSAGE = "Enter a color like #3a6ea5 or oklch(0.6 0.15 250).";
const GAMUT_LABELS: Readonly<Record<Gamut, string>>;    // "sRGB", "Display P3"
function seedHex(spec: DesignSpec, params: DirectionParams, slot: Lockable): Hex; // the color a seed row shows
function autoPairingLabel(seed: string): string;        // "Auto (<label of choosePairing(seed)>)"
```

`seedHex` gives a locked slot's seed and an unlocked slot's `lockSeed(spec, slot)`, the color a lock would hold (R2-17),
each mapped into sRGB with `gamutMap`, because the hex field and the native color input hold sRGB hex only.

`paramsOfSpec` reads `color.params`, `type.context`, `type.ratio`, `shape.radiusSet`, `depth.style`, `motion.feel` and
`meta.name`, and finds the pairing whose three families equal `type.families`. When that pairing is the one
`choosePairing(meta.seed)` picks, `pairing` stays absent (auto, R2-05); when it is another pairing, `pairing` is that id;
with no match `pairing` is absent and `customFonts` is true. It leaves `name` out when it is the generator's default
`"untitled"`, so a design made without a name reads back without one and its draft agrees with its spec.
`safeStorage(window)` reads `window.localStorage` inside try/catch, because in some browsers the accessor itself throws.
`mergeParams` checks keys and shapes, never values: an unknown key is a `RangeError`, a removed required key or a seed
that is not a whole color a `TypeError`, and a value outside its set reaches the generator and ends in a `generation`
notice (C-STORE-20). A patch that changes nothing posts no request.

### 5.8 Inspector helpers (Task 2.10)

File: `src/features/studio/inspect.ts`, pure, except `fixFor`, which lives in `src/features/studio/fixes.ts` (R2-22)
and is tested with the store in Task 2.5 (section 6.8).

```ts
type PassLevel = "AAA" | "AA" | "AA large" | "fail";   // text pairs
type UiLevel = "pass 3:1" | "fail";                    // non-text pairs
type RoleRow = { pair: string; kind: "text" | "ui"; foreground: RoleName; fill: RoleName;
                 light: ModeCell; dark: ModeCell };
type ModeCell = { foreground: Hex; fill: Hex; ratio: number; level: PassLevel | UiLevel; lc: number; lcText: string };
function roleRows(spec: DesignSpec): readonly RoleRow[];     // 32 rows
function passLevel(ratio: number, kind: "text" | "ui"): PassLevel | UiLevel;
function formatLc(lc: number): string;                       // "+76", "−33", "0"
function groupFindings(findings: readonly Finding[]): { error: Finding[]; warn: Finding[]; info: Finding[] };
function showMe(finding: Finding): { roles: readonly string[]; cells: readonly { palette: PaletteName; step: Step }[] };
function fixFor(finding: Finding, params: DirectionParams): ParamsPatch | null;
// C1 targets "AA+"; C5, N1 and F1 target "AAA"; null for any other id and when params.contrastLevel is already at or above the target (R2-10)
function findingTitle(id: RuleId): string;
```

## 6. Modules, interfaces and cases (pure and unit-tested)

### 6.1 Entry points and `normalizeSpec` (Task 2.2)

Tests: `tests/unit/engine/entry.test.ts`, `tests/unit/spec/normalize.test.ts`, `tests/unit/engine/repo-guards.test.ts`.

The runtime keys of `src/engine/index.ts` (a set; the tests compare as a set, so order does not matter): `ColorParseError`, `DEFICIENCIES`, `DEPTH_STYLES`, `ENGINE_VERSION`,
`FONT_CATALOG`, `GAMUTS`, `HARMONIES`, `HIGH_GENERICNESS_FAMILIES`, `LOCKABLE`, `MOTION_FEELS`, `NEUTRAL_TINTS`,
`PAIRINGS`, `PAIRING_IDS`, `PALETTE_NAMES`, `PRESETS`, `PRESET_IDS`, `RADIUS_SET_NAMES`, `ROLE_NAMES`, `RULE_IDS`,
`SCALE_MODES`, `STEPS`, `TYPE_CONTEXTS`, `UnsatisfiableTargetError`, `CHROMA_LEVELS`, `CONTRAST_LEVELS`, `applyPreset`,
`choosePairing`, `deltaEOK`, `fontFiles`, `fontStack`, `formatOklch`, `gamutMap`, `generateSystem`, `genericness`,
`hexToRgb`, `indexNames`, `lintSpec`, `meets`, `motionTokens`, `nearestName`, `nestedRadius`, `normalizeSeed`,
`oklchToRgb`, `parseColor`, `perceptualLc`, `radiusScale`, `rgbToOklch`, `shadows`, `simulate`, `spaceScale`, `toHex`,
`typeScale`, `wcagRatio`. The type exports are `DirectionParams`, `LintedSpec`, `Finding`, `LintOptions` and the types
the signatures in section 5 name. The runtime keys of `src/spec/index.ts`: `DesignSpecSchema`, `SpecDecodeError`,
`canonicalize`, `decodeSpec`, `encodeSpec`, `normalizeSpec`, `specId`; the type export is `DesignSpec`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-ENTRY-01 | pass | The key set of the engine entry equals the set above exactly, and every named function and table is the same object its home module exports | plan, ruling |
| C-ENTRY-02 | failure | The engine entry does not export `multiply`, `runRules`, `tryOklchToRgb` or `gamutExcess`; importing any of them from the entry is `undefined` | plan |
| C-ENTRY-03 | pass | The key set of the spec entry equals the set above exactly | plan, ruling |
| C-ENTRY-04 | failure | The spec entry does not export `SPEC_VERSION`, `fnv1a64` or `canonicalJson` | added |
| C-ENTRY-05 | pass | `Object.isFrozen` holds for `STEPS`, `PALETTE_NAMES`, `ROLE_NAMES`, `RULE_IDS`, `HARMONIES`, `GAMUTS`, `CHROMA_LEVELS`, `NEUTRAL_TINTS`, `SCALE_MODES`, `CONTRAST_LEVELS`, `TYPE_CONTEXTS`, `RADIUS_SET_NAMES`, `DEPTH_STYLES`, `MOTION_FEELS`, `DEFICIENCIES`, `LOCKABLE`, `PRESET_IDS`, `PAIRING_IDS` | plan, decision |
| C-ENTRY-06 | pass | `PRESETS`, `PAIRINGS`, `FONT_CATALOG`, `HIGH_GENERICNESS_FAMILIES` are frozen, and so is every entry and every array inside an entry (deep) | decision |
| C-ENTRY-07 | failure | Writing to a frozen table throws `TypeError` in strict mode: `STEPS.push(1)`, `PRESETS.default.params.radius = "sharp"`, `FONT_CATALOG[0].family = "x"` | decision |
| C-ENTRY-08 | pass | The exported values have the same contents as before the cleanup: `STEPS` is the 11 steps, `ROLE_NAMES` has 46 names, `PALETTE_NAMES` has 8 | added |
| C-ENTRY-09 | pass | A type test compiles: `DirectionParams`, `LintedSpec`, `Finding`, `DesignSpec` import as types from the entries, and a `DesignSpec` is assignable to `LintedSpec` | decision |
| C-ENTRY-10 | failure | A Biome check on a file under `src/features` that imports `@/engine/color/palette` fails with `noRestrictedImports`; so do `@/spec/schema` and `../../engine/generate` | plan |
| C-ENTRY-11 | pass | A Biome check on a file under `src/features` that imports `@/engine` and `@/spec` passes | plan |
| C-ENTRY-12 | pass | `src/engine` and `src/spec` files may import their own siblings and each other as R2-25 says: an `import type` from `src/spec` anywhere under `src/engine`, a value import from `src/spec` in `generate.ts`, `presets.ts` and `index.ts` only | ruling |
| C-ENTRY-13 | pass | `simulate(rgb, "protan")` still works, and `simulate(rgb, "x")` throws `RangeError` naming `simulate` through `assertOneOf` | plan |
| C-ENTRY-14 | failure | A palette missing from a role or chart input, or a scale of 10 steps, throws `TypeError` naming the public entry function | plan |
| C-ENTRY-15 | pass | A public error message names the public entry (`generateSystem`, `lintSpec`, `encodeSpec`), never an inner function | plan |
| C-ENTRY-16 | pass | The name and seed bounds are defined once in the schema module and the 0.5 chroma ceiling once, as `CHROMA_CEILING`, in `src/engine/color/guards.ts`; every other module imports them (source scan finds no second definition and no second literal of the ceiling) | plan |
| C-ENTRY-17 | pass | C-REPO-05 now fails on a source line that casts `as Hex`, `<Hex>x` or declares `x is Hex` outside `convert.ts`, the schema and the two predicates of `guards.ts` (`isHex`, `assertHex`); a `<Hex>` in a generic type argument (`Set<Hex>`) is not a cast | plan |
| C-ENTRY-18 | pass | The linter's source does not import `src/spec` (the reworded guard) | plan |
| C-NORM-01 | pass | A spec with `color.palettes.primary.light[0].oklch.l = 0.97123456789` normalizes to `0.971235` | plan |
| C-NORM-02 | pass | `decodeSpec(encodeSpec(normalizeSpec(s)))` deep-equals `normalizeSpec(s)`, for that spec and for `SPEC` | plan |
| C-NORM-03 | pass | `normalizeSpec(SPEC)` deep-equals `SPEC` (a generated spec is already normal) | decision |
| C-NORM-04 | pass | Idempotent: `normalizeSpec(normalizeSpec(s))` deep-equals `normalizeSpec(s)`. Property, 50 runs, over `generateSystem` with every enum and random seeds | decision |
| C-NORM-05 | pass | `specId(normalizeSpec(s))` equals `specId(decodeSpec(encodeSpec(normalizeSpec(s))))`: the id names what the store holds | decision |
| C-NORM-06 | pass | The result is a new object, and the input is not mutated | added |
| C-NORM-07 | pass | A hue of 359.9996 normalizes to 0 (through `roundHue`) and the result passes the schema | added |
| C-NORM-08 | failure | A non-object (`null`, `[]`, `"x"`, `1`) throws `TypeError` whose message starts `normalizeSpec:` | ruling |
| C-NORM-09 | failure | A spec holding `NaN` or `Infinity` throws `RangeError` starting `normalizeSpec:` and naming the path | ruling |
| C-NORM-10 | failure | A spec with an extra key, a missing role or a 10-step scale throws `RangeError` starting `normalizeSpec: spec does not match dyelot.spec/1 at` and listing the paths; it is not a `ZodError` | ruling |
| C-NORM-11 | failure | A spec with a cycle, a function or a `bigint` throws `TypeError` starting `normalizeSpec:` | added |

### 6.2 Font catalog, pairings and loader (Task 2.3)

Tests: `tests/unit/engine/fonts/{catalog,pairings,choose-pairing}.test.ts`, `tests/unit/engine/generate-pairing.test.ts`, `tests/unit/features/fonts/load.test.ts`,
`tests/unit/scripts/copy-fonts.test.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-FONT-01 | pass | The catalog has 40 entries; every id matches `^[a-z0-9-]+$`; ids are unique | plan |
| C-FONT-02 | pass | The catalog's ids are exactly the 40 ids of the table in 5.2, in that order | decision |
| C-FONT-03 | pass | Every entry has `id`, `family`, `category`, `variable`, `axes`, `weights`, `license: "OFL-1.1"`, `popularity` and `fallback`, each of the right type; `popularity` is an integer ≥ 1 | decision |
| C-FONT-04 | pass | Every family of every pairing in `PAIRINGS` exists in the catalog, and the catalog holds no family that no pairing uses, apart from `geist` and `geist-mono` | plan |
| C-FONT-05 | pass | `host-grotesk`, `fragment-mono`, `geist` and `geist-mono` exist | plan |
| C-FONT-06 | pass | A variable entry has `axes` exactly `["wght"]` and two weights with `weights[0] < weights[1]`. A static entry has empty `axes` and ascending weights that are a subset of 400 and 700 containing 400 | ruling |
| C-FONT-07 | pass | `fallback` is the stack of R2-03 item 8 for the entry's category | ruling |
| C-FONT-08 | failure | `validateCatalog` reports a duplicate id, an id with an uppercase letter or a space, a license other than `OFL-1.1`, a popularity of 0 or 1.5, an empty `fallback`, and a variable entry with one weight; an entry that is not an object, a missing or non-array `axes` or `weights`, and a family that is empty or holds a quote or a backslash are problems too, never a crash; a valid catalog reports nothing | plan |
| C-FONT-09 | pass | `genericnessOf(1)` is 1, `genericnessOf(200)` is 0, `genericnessOf(100)` ≈ 0.50251, `genericnessOf(41)` ≈ 0.79899, `genericnessOf(40)` ≈ 0.80402, `genericnessOf(500)` is 0 (clamped) | plan, decision |
| C-FONT-10 | pass | `genericness("geist")` and `genericness("geist-mono")` are 1 whatever their `popularity` is (a catalog fixture sets 999) | plan, decision |
| C-FONT-11 | pass | The high list matches by name: `Inter`, `Roboto`, `Open Sans`, `Space Grotesk`, `Instrument Serif`, `IBM Plex Sans` (prefix), `Cormorant Garamond` (prefix), `DM Serif Display` (prefix) are on it; `Inter Tight`, `Host Grotesk`, `Albert Sans` are not | ruling |
| C-FONT-12 | pass | `HIGH_GENERICNESS_FAMILIES` holds the research list: Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Nunito, DM Sans, Plus Jakarta Sans, Outfit, Manrope, Figtree, Geist, Geist Mono, Space Grotesk, Space Mono, Fraunces, Playfair Display, Cormorant, Lora, Crimson, Newsreader, Syne, IBM Plex, DM Serif, Instrument Sans, Instrument Serif | decision |
| C-FONT-13 | failure | `genericness("nope")` throws `RangeError` naming `genericness`; `genericness(3)` throws `TypeError`; `genericnessOf(0)` and `genericnessOf(NaN)` throw `RangeError`; a `catalog` argument that is not an array throws `TypeError` naming `genericness` | added |
| C-FONT-14 | pass | `fontStack("host-grotesk")` is `"Host Grotesk", ` plus the sans fallback; a family name with a quote or a backslash cannot occur because ids come from the catalog | added |
| C-FONT-15 | failure | `fontStack("nope")` throws `RangeError`; a non-string throws `TypeError` | added |
| C-FONT-16 | pass | `fontFiles("host-grotesk")` is `["host-grotesk-latin-wght-normal.woff2", "OFL.txt"]`; for a static family with weights 400 and 700 it is `["<id>-latin-400-normal.woff2", "<id>-latin-700-normal.woff2", "OFL.txt"]`, and with 400 alone it has one woff2 | ruling |
| C-FONT-17 | pass | Running `scripts/copy-fonts.mjs --out <tmp dir>` (no build, no `public/`) gives every catalog entry every file of `fontFiles`, non-empty | plan, ruling |
| C-FONT-18 | pass | Every `.woff2` starts with the bytes `wOF2`, and every `OFL.txt` contains `SIL OPEN FONT LICENSE` | added |
| C-FONT-19 | pass | The output directory holds exactly the 40 catalog directories and nothing else (a fresh output directory: the script adds and overwrites, and removes nothing) | added |
| C-FONT-20 | failure | With `--out <tmp>`, the script exits non-zero and names the id when its Fontsource package is missing (a fixture `node_modules` without one package) | added |
| C-FONT-21 | pass | Running the script twice leaves every file byte-identical | added |
| C-FONT-22 | pass | `package.json` runs the script in `predev` and `prebuild`, and lists `@fontsource-variable/<id>` (variable, 34 entries) or `@fontsource/<id>` (static, 6 entries including `tiny5`) in `devDependencies` for every catalog id; every listed package resolves in `node_modules` after install; `.gitignore` lists `public/fonts/` | plan, ruling |
| C-FONT-23 | pass | From the Google Fonts metadata of 2026-11-01 (a fixture holding each family's `popularity`), the display face of every pairing except `archivo-courier` and `bodoni-familjen` has genericness below 0.8, `archivo` has genericness ≈ 0.935 (popularity 14) and `bodoni-moda` ≈ 0.804 (popularity 40) | ruling |
| C-FONT-24 | failure | The script exits non-zero with `copy-fonts: unknown argument` for `--out=dir`, `--bogus`, a stray word or a repeated `--out`, and with `--out needs a directory` for a bare `--out` | review |
| C-PAIR-01 | pass | `PAIRINGS` has 20 entries with unique ids, in the order of the table in 5.2; every display, body and mono is a catalog id | plan |
| C-PAIR-02 | pass | The ten pairings without a D2 mono (2, 3, 4, 5, 8, 9, 10, 12, 16, 20) take `fragment-mono` | ruling |
| C-PAIR-03 | pass | The pairing `host-grotesk` is `host-grotesk` / `host-grotesk` / `fragment-mono`, M1's default | decision |
| C-PAIR-04 | pass | (Task 2.4) `generateSystem` without `pairing` writes the M1 families, and every M1 golden spec id is unchanged | decision |
| C-PAIR-05 | pass | (Task 2.4) `generateSystem({ ...DEFAULT_PARAMS, pairing: "gloock-albert" }, "seed-1")` writes `gloock`, `albert-sans`, `fragment-mono`, and equals the default spec in every other field | ruling |
| C-PAIR-06 | pass | (Task 2.4) Colors do not depend on the pairing: `color` of the specs for every pairing is identical | ruling |
| C-PAIR-07 | failure | (Task 2.4) `pairing: "nope"` throws `RangeError` naming `generateSystem: params.pairing`; `pairing: 3` throws `TypeError` | ruling |
| C-PAIR-08 | pass | (Task 2.4) `choosePairing` is deterministic: the same seed gives the same id on every call; the seed `""` is valid | plan |
| C-PAIR-09 | pass | (Task 2.4) Over 500 distinct seeds `choosePairing` picks at least 10 distinct pairings | added |
| C-PAIR-10 | pass | (Task 2.4) Over 1,000 seeds the real catalog's picks have a display face with genericness ≥ 0.8 at most 10% of the time | plan |
| C-PAIR-11 | pass | (Task 2.4) With a fixture list of 20 pairings of which 5 have a display face of genericness 1 and a fixture catalog to match, 20,000 seeds pick a generic face between 7.6% and 10.6% of the time (analytic 9.09%, against 25% without the penalty) | decision |
| C-PAIR-12 | pass | (Task 2.4) With a fixture list where every genericness is 0, each of the 20 pairings is picked between 2% and 8% of 20,000 seeds | decision |
| C-PAIR-13 | pass | (Task 2.4) `choosePairing` draws from a stream apart from the palette stream: `generateSystem` colors for one seed are the same whatever it returns | ruling |
| C-PAIR-14 | failure | (Task 2.4) A non-string seed throws `TypeError`; an empty list throws `RangeError` naming `choosePairing` | added |
| C-PAIR-15 | pass | Pairing 19 (`anybody-albert`) has `spline-sans-mono` as its mono, and `recursive` is not in the catalog | ruling |
| C-LOAD-01 | pass | `load("host-grotesk")` with a stub `FontFace` whose `load` resolves returns `{ id, status: "loaded" }`, builds the face with `url(/fonts/host-grotesk/host-grotesk-latin-wght-normal.woff2) format('woff2')`, weight `"<min> <max>"` and `display: "swap"`, and adds it to the stub `fonts` set | plan |
| C-LOAD-02 | pass | A static family builds one face per copied weight, each from `<id>-latin-<weight>-normal.woff2` with its own weight | added |
| C-LOAD-03 | pass | `status(id)` is `idle`, then `loading` while pending, then `loaded`; `subscribe` calls the listener on each change and the returned function unsubscribes | added |
| C-LOAD-04 | pass | A second `load` of a loaded family builds no new face and returns the same result | added |
| C-LOAD-05 | failure | A face whose `load` rejects makes `load` resolve `{ id, status: "failed", reason: "load" }`, never throw; no face joins `fonts`; `status(id)` is `failed` | RF3 |
| C-LOAD-06 | failure | A `load` that never settles resolves `{ status: "failed", reason: "timeout" }` after `timeoutMs` (fake timers) | RF3, added |
| C-LOAD-07 | failure | A `FontFace` constructor that throws, or a missing `FontFace`, resolves `{ status: "failed", reason: "unsupported" }` | RF3, added |
| C-LOAD-08 | pass | A failed family retries on the next `load` call and can then reach `loaded` | added |
| C-LOAD-09 | failure | `load("nope")` throws `RangeError`; `load(3)` and `load(null)` throw `TypeError`; these are the only throws | added |
| C-LOAD-10 | pass | Two loaders built from different stubs do not share state | added |
| C-LOAD-11 | failure | With no `document` and no injected `fonts`, `load` resolves `{ status: "failed", reason: "unsupported" }` | review |
| C-LOAD-12 | failure | A `fonts.add` that throws makes `load` resolve `{ status: "failed", reason: "load" }`; the faces already added are removed (`fonts.delete`) and none stay | review |
| C-LOAD-13 | pass | A listener that throws neither rejects `load` nor leaves the family at `loading`, and the error is logged with `console.error`; the other listeners still hear every change | review |
| C-LOAD-14 | pass | A `load(id)` called from a listener while `id` is loading shares the in-flight promise and builds no second face | review |
| C-LOAD-15 | pass | The default timeout is the single constant `FONT_TIMEOUT_MS` (8000 ms); the browser instance uses it | review |

### 6.3 Presets and pairing choice (Task 2.4)

Tests: `tests/unit/engine/presets.test.ts`, and `presets-lint-{1..5}.test.ts` for the 50-seed cases C-PRESET-03, C-PRESET-04 and C-PRESET-12 (split so they run in parallel).

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-PRESET-01 | pass | `PRESET_IDS` is `default`, `minimal-swiss`, `editorial`, `neo-brutalism`, `glass`, `dark-dev-tool`, `bento`, `aurora`, `retro-futurism`, `tactile`, `maximalism`, `organic`, `dithering-pixel`, `m3-expressive`; `PRESETS` has exactly those keys | decision |
| C-PRESET-02 | pass | Each preset's `params` and `view` equal its row in the table of 5.3 (parametrized over the 14 rows) | ruling |
| C-PRESET-03 | pass | Each preset is a valid patch: every field is in its domain, `pairing` is in `PAIRING_IDS` when present, and `applyPreset(DEFAULT_PARAMS, id)` is a valid `DirectionParams` that `generateSystem` accepts | plan |
| C-PRESET-04 | pass | For every preset, `generateSystem(applyPreset(DEFAULT_PARAMS, id), seed)` over 50 seeds raises zero findings of severity `error` from `lintSpec`. Measured on the M1 engine with seeds `s0` to `s49`: 0 errors for each of the 13 styles and for `default` | plan, measured |
| C-PRESET-05 | pass | `applyPreset` keeps locked `primary`, `secondary` and `accent`; an absent one stays absent | plan, decision |
| C-PRESET-06 | pass | `applyPreset` keeps `name` and removes `type.ratio` | ruling |
| C-PRESET-07 | pass | `applyPreset(p, "default")` leaves `pairing` absent; every other preset sets an explicit `pairing`; `neo-brutalism` sets `anybody-albert` and `aurora` sets `zalando` | ruling |
| C-PRESET-08 | pass | `applyPreset` does not mutate its input, returns a new object, and applying the same preset twice gives a deep-equal result | added |
| C-PRESET-09 | pass | A preset has no `primary`, `secondary`, `accent`, `name`, `type.ratio` or `density` key in `params`; `view.density` is in `Density` | ruling |
| C-PRESET-10 | pass | Every preset except `default` has non-empty `guards` and `unexpressed`, `label` and `summary`; `default` has empty lists | ruling |
| C-PRESET-11 | pass | The guard values hold: `glass` and `dithering-pixel` are `AAA`; `minimal-swiss`, `editorial`, `neo-brutalism`, `dark-dev-tool`, `aurora`, `retro-futurism`, `maximalism` and `organic` are `AA+` or higher | decision |
| C-PRESET-12 | pass | For every preset and 50 seeds (`s0` to `s49`), `lintSpec(spec)` raises no T1, no T3 and no T4; a T2 warning is allowed (the hue comes from the seed). Measured: 0 T3 hits at steps 300 to 800 for the 13 styles | decision, measured |
| C-PRESET-13 | pass | A preset's display face has genericness below 0.8 (no preset invites T1); for `neo-brutalism` that is `anybody` | decision, ruling |
| C-PRESET-14 | failure | `applyPreset(p, "nope")` throws `RangeError` naming `applyPreset`; a non-string id or a non-object `params` throws `TypeError` | added |
| C-PRESET-15 | pass | `PRESETS` is deeply frozen (C-ENTRY-06 covers writes) | decision |
| C-PRESET-16 | pass | `applyPreset` never lowers the contrast level: user `AAA` with a preset at `AA` stays `AAA`; user `AA` with a preset at `AAA` becomes `AAA`; user `AA+` with a preset at `AA` stays `AA+`; every other preset field is the preset's | ruling |

### 6.4 Taste rules (Task 2.4)

Tests: `tests/unit/engine/lint/taste.test.ts`, `input.test.ts` (the R-05 checks) and `t3-defaults-{1..3}.test.ts` (C-TASTE-13, 100 seeds each). Fixtures start from `SPEC` and override single fields. Every finding
case asserts the exact `id`, `severity`, `mode`, `subject`, `measured`, `threshold` and `source`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-TASTE-01 | pass | `RULE_IDS` is M1's 20 ids followed by `T1`, `T2`, `T3`, `T4` (24) | ruling |
| C-TASTE-02 | pass | T1 passes: display `host-grotesk` (genericness below 0.8) raises no T1 | plan |
| C-TASTE-03 | failure | T1 fails: display `geist` raises one `T1`, `warn`, `light`, subject `display`, measured 1, threshold 0.8 | plan |
| C-TASTE-04 | pass | T1 boundary with a fixture catalog: popularity 40 (genericness 0.80402) fires, popularity 41 (0.79899) does not | plan |
| C-TASTE-05 | pass | T1 skips a display id outside the catalog and raises nothing | ruling |
| C-TASTE-06 | failure | T2 fails: no `params.primary`, `palettes.primary.hue` 280, light `background` `#ffffff` raises one `T2`, `warn`, `light`, subject `primary`, measured 280, threshold 265; hue 290 gives threshold 300 | plan |
| C-TASTE-07 | pass | T2 boundaries: hue 265 and 300 fire; 264.99 and 300.01 do not | plan |
| C-TASTE-08 | pass | T2 is silent when `params.primary` is locked, and when the light `background` is not `#ffffff` | plan, decision |
| C-TASTE-09 | pass | T2 never reports `mode: "dark"` | added |
| C-TASTE-10 | failure | T3 fails: setting `palettes.primary.light[6].hex` (step 600) to the Tailwind v4 `indigo-500` hex (read by the test from `theme.css` and mapped as R2-09 says) raises one `T3`, `warn`, `light`, subject `primary-600`, measured 0, threshold 0 | plan |
| C-TASTE-11 | pass | T3 reads dark steps too, reports the scale's mode, and covers all 8 palettes (one fixture per palette) | added |
| C-TASTE-12 | pass | The derived Tailwind table has 26 palettes and 286 entries in `node_modules/tailwindcss/theme.css` and 283 distinct hexes after `toHex(gamutMap(color, "srgb"))`; none is `#000000` or `#ffffff`; the module's set equals the set the test derives from the file; `toHex(oklchToRgb(...))` is not used (it throws for 95 entries) | decision, ruling |
| C-TASTE-13 | pass | T3 raises nothing for `generateSystem(DEFAULT_PARAMS, "s" + i)`, i from 0 to 299. Measured: 0 hits at steps 300 to 800 (with all steps, 20 of 300 specs hit, all at light 50, light 100 or dark 950) | added, measured |
| C-TASTE-14 | failure | T4 fails: `type.context: "product"` with `body.sizePx` 15 raises one `T4`, `warn`, `light`, subject `body`, measured 15, threshold 16 | plan |
| C-TASTE-15 | pass | T4 boundaries: 16 does not fire, 15.999 does; `type.context: "dense"` with 14 does not | plan |
| C-TASTE-16 | pass | T3 reads steps 300 to 800 only: a default hex written to step 300 or 800 raises a finding; written to step 50, 100, 200, 900 or 950 it raises none | ruling |
| C-TASTE-17 | pass | On `SPEC` (`seed-1`, primary hue 289, white page, no lock) T2 fires and the base spec carries that finding; this is why C-LINT-47 filters to M1 ids (R2-25) | ruling, measured |
| C-TASTE-18 | pass | Without `type` in the spec, T1 and T4 do not run: for `generateSystem({ ...DEFAULT_PARAMS, primary: <the color #1f6f5b> }, "seed-1")`, which locks the primary so T2 stays silent, `lintSpec` of the color section alone raises no finding whose id starts with `T`, and its M1 findings equal those of the full spec | ruling |
| C-TASTE-19 | pass | Findings sort by severity, id, mode, subject: a fixture raising `C4`, `K2` and `T1` (all `warn`) and `N3` (`info`) returns them in that order | decision |
| C-TASTE-20 | failure | A `type` whose `families.display` is not a string, or whose `steps` lacks `body`, throws `TypeError` naming `lintSpec`; a non-finite `sizePx` throws `RangeError` | added |
| C-TASTE-21 | pass | `lintSpec` does not mutate its input and gives the same result twice | added |
| C-TASTE-22 | pass | Every M1 lint case passes unmodified except C-LINT-43 and C-LINT-47, and the other M1 cases pass unmodified except the six of R2-25 | I-M2-08 |
| C-TASTE-23 | pass | `lintSpec(generateSystem(DEFAULT_PARAMS, "seed-1"))` accepts a full `DesignSpec` and reads its `type` and `shape` | decision |

### 6.5 Color names (Task 2.4)

Tests: `tests/unit/engine/color/names.test.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-NAME-01 | pass | For a color equal to a fixture entry, `nearestName` returns that entry's `name` and `hex` with `deltaEOK` 0 | plan |
| C-NAME-02 | pass | A color one hex code away from an entry returns the same name with `deltaEOK` below 0.005 | plan |
| C-NAME-03 | pass | A tie between two entries keeps the earlier one in list order | ruling |
| C-NAME-04 | pass | An achromatic color (`h: null`) finds a name | added |
| C-NAME-05 | pass | `indexNames` returns a frozen index, and the input list is not mutated | added |
| C-NAME-06 | pass | The real `color-name-list/bestof` list has more than 1,000 entries, each with a non-empty name and a valid hex, and `indexNames` accepts it | decision |
| C-NAME-07 | pass | `names.ts` has no import of `color-name-list`, and no file under `src` except `src/features/studio/names.ts` names it, and that one only inside a dynamic `import()` | decision |
| C-NAME-08 | failure | An empty list throws `RangeError`; an entry with a bad hex throws `RangeError` naming its index; a non-array throws `TypeError` | added |
| C-NAME-09 | failure | A color that is not an `Oklch` (a string, a missing `l`) throws `TypeError`; a non-finite `l` throws `RangeError` | added |

### 6.6 The theme bridge (Task 2.5)

Tests: `tests/unit/theme/vars.test.ts`, in the `node` project (R2-22).

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-THEME-01 | pass | `themeVars(SPEC, "light")` and `themeVars(SPEC, "dark")` each have 204 properties, and the key list equals the names of the table in 5.6 in that order | plan, ruling |
| C-THEME-02 | pass | All 46 roles are present as `--<role>` and equal `spec.color.roles[mode][role]` | plan |
| C-THEME-03 | pass | All 88 scale steps are present as `--<palette>-<step>` and equal the stored `hex` of that mode's step | plan |
| C-THEME-04 | pass | Every color-valued property is a stored hex: it matches `^#[0-9a-f]{6}$` and belongs to the set of hexes in the spec's roles and scales for that mode | plan |
| C-THEME-05 | pass | For each of the 10 type steps, `--text-<step>`, `--leading-<step>` and `--tracking-<step>` equal `<sizePx>px`, `<lineHeightPx>px` and `<trackingEm>em` | plan |
| C-THEME-06 | pass | In `marketing` and `editorial`, `--text-display` equals the step's `clamp` string; in other contexts it is `<sizePx>px` | added |
| C-THEME-07 | pass | `--font-display`, `--font-body`, `--font-mono` equal `fontStack` of the spec's three families | decision |
| C-THEME-08 | pass | A family id that is valid but not in the catalog falls back to the sans stack (display, body) or the mono stack (mono) and does not throw | ruling |
| C-THEME-09 | pass | The 12 `--space-<unit>` properties equal `<unit × 4>px`; `--space-0` is `0px` | decision |
| C-THEME-10 | pass | `--radius-sm` to `--radius-2xl` equal the spec's radii in px; `--radius-full` is `9999px` | decision |
| C-THEME-11 | pass | With `depth.style: "soft"`, `--shadow-2` is two layers `0 4px 8px 0 oklch(... / 0.1), 0 2px 4px 0 oklch(... / 0.06)` (key, ambient) and matches the shadow pattern of 5.6 | decision |
| C-THEME-12 | pass | With `flat`, `--shadow-1` to `--shadow-5` are `none`; with `layered`, `--shadow-2` has `offsetY` 6 and `blur` 12 for the key layer and alpha 0.15 (1.5 times the stored values) | ruling |
| C-THEME-13 | pass | The shadow color is `formatOklch` of the layer's color with the alpha written inside the parentheses | decision |
| C-THEME-14 | pass | `--duration-*` equal the stored durations for `brisk` and `playful`; for `calm` they are 1.25 times, rounded to the nearest ms (a tie rounds up) and capped at 500: 63, 125, 188, 250, 375, 500, 500 | ruling |
| C-THEME-15 | pass | `--ease-*` equal `cubic-bezier(0.2, 0, 0, 1)`, `(0, 0, 0, 1)`, `(0.3, 0, 1, 1)` and `(0.05, 0.7, 0.1, 1)` | decision |
| C-THEME-16 | pass | `--spring-duration` and `--spring-bounce` follow the feel: `calm` 0.4 and 0, `brisk` 0.25 and 0.1, `playful` 0.5 and 0.35; `feelSpring` returns the same spring | ruling |
| C-THEME-17 | pass | `--icon-stroke` is `String(components.icons.strokePx)` | decision |
| C-THEME-18 | pass | Light and dark differ in roles and scales only; the type, family, space, radius, shadow, duration, ease, spring and icon properties are equal | added |
| C-THEME-19 | pass | With `options.vision` of `protan`, `deutan` or `tritan`, each color-valued property equals `toHex(simulate(hexToRgb(hex), vision))`; the other properties are unchanged | decision, ruling |
| C-THEME-20 | pass | With no `vision`, or `vision` absent, the result equals the result without options | added |
| C-THEME-21 | pass | The result is frozen, the input is not mutated, and two calls give deep-equal results | added |
| C-THEME-22 | pass | No property name is both a role and a scale: the 204 names are distinct | added |
| C-THEME-23 | pass | Property, 25 runs over presets and seeds: every value is non-empty and holds none of `;`, `{`, `}`, `<` | ruling |
| C-THEME-24 | failure | A mode other than `light` and `dark` throws `RangeError` naming `themeVars`; a non-string mode throws `TypeError`; `vision: "x"` throws `RangeError` | added |
| C-THEME-25 | failure | A spec that is not an object, or lacks `color.roles`, throws `TypeError` naming `themeVars` | added |
| C-THEME-26 | failure | A role value that is not a lowercase `#rrggbb` (`"red"`, `"#FFF"`, `"#fff;x"`) throws `RangeError` naming the role; a family id with `;` or a space throws `RangeError` | ruling |
| C-THEME-27 | pass | `src/theme/vars.ts` imports only `@/engine` and `@/spec`, reads no DOM and no React, and runs in the `node` project | I-M2-07 |
| C-THEME-28 | pass | With `units: "cqi"`, `--text-display` of a `marketing` or `editorial` spec holds the `clamp` string with every `vw` written as `cqi` and no `vw`; without it, or with `"vw"`, the string equals the spec's `clamp`; a context with no fluid `display` is unchanged | ruling |
| C-THEME-29 | failure | `units: "px"` throws `RangeError` naming `themeVars`; a non-string `units` throws `TypeError` | added |
| C-DENSITY-01 | pass | `densityVars("comfortable")` is `--density-offset: 0px`, `--control-height: 40px`; `compact` is `-4px`, `36px`; `dense` is `-8px`, `32px` | ruling |
| C-DENSITY-02 | pass | Every control height is at least 24 px (WCAG 2.5.8) | decision |
| C-DENSITY-03 | failure | An unknown density throws `RangeError` naming `densityVars`; a non-string throws `TypeError` | added |

### 6.7 Studio state: the store, the worker, links and drafts (Task 2.5)

Tests: `tests/unit/features/studio/{store,store-replies,store-persist,store-property,protocol,client,url,drafts,params,view,lot}.test.ts`,
and `store-lock-{seeds,pair-aa,pair-aaa,primary-aa,primary-aaa}.test.ts` for C-STORE-34 and C-STORE-41 (about 800
generations through the store, split so they run in parallel). Section 6.8's C-INSPECT-01 to 04 are in `fixes.test.ts`
and `store-fix.test.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-STORE-01 | pass | `FRESH`: `params` are the `default` preset's with `pairing` absent (auto, R2-05), `preset` is `"default"`, `seed` is `"seed-1"`, `spec` equals `generateSystem(resolveParams(params, "seed-1"), "seed-1")` (its families are the pairing `choosePairing("seed-1")` picks), `history` and `future` are empty, `status` is `{ phase: "idle", notice: null, draft: "on" }`, `view.mode` is `light` | decision, ruling |
| C-STORE-02 | pass | I-M2-01: after any sequence of actions, every `spec` in the state, `history` and `future` satisfies `decodeSpec(encodeSpec(spec))` deep-equals `spec`. Property, 25 runs | decision |
| C-STORE-03 | pass | `setParams({ chroma: "vivid" })` changes `params` at once, posts one request with id 1 and the resolved params, and after the reply `spec` changes and `status.phase` returns to `idle` | plan |
| C-STORE-04 | pass | `setParams` merges `type` by key: `{ type: { context: "dense" } }` keeps `type.ratio` | added |
| C-STORE-05 | pass | `applyPreset("dark-dev-tool")` sets the preset's params and `preset: "dark-dev-tool"`, sets `view.mode` to `dark` and `view.density` to `dense`, keeps locked colors, keeps a higher user contrast level, and adds one history entry | decision, ruling |
| C-STORE-06 | pass | `regenerate` takes a new seed from `deps.newSeed`, keeps locked colors, changes the unlocked palettes, re-chooses an automatic pairing from the new seed, and keeps an explicit one | decision, ruling |
| C-STORE-07 | pass | `toggleMode` flips `view.mode`, posts no request and adds no history entry | plan |
| C-STORE-08 | pass | Undo and redo round-trip: after n commits, n undos restore each earlier `params`, `seed` and `spec` exactly, and n redos return | plan |
| C-STORE-09 | pass | A new commit after an undo clears `future` | added |
| C-STORE-10 | pass | `history` keeps 100 steps: after 150 commits `history.length` is 100, the oldest 50 are gone, 100 undos succeed, and the 101st is a no-op that changes nothing and throws nothing | plan |
| C-STORE-11 | pass | `undo` with an empty `history` and `redo` with an empty `future` are no-ops | added |
| C-STORE-12 | pass | Five `setParams` calls with the same `coalesce` key within 1,000 ms commit as one history entry; undo returns to the state before the first | ruling |
| C-STORE-13 | pass | Calls with different keys, no key, or a gap above 1,000 ms (by the fake `clock`) commit separately | ruling |
| C-STORE-14 | pass | `undo` and `redo` mark in-flight replies stale: a reply for a request issued before the undo is dropped | ruling |
| C-STORE-15 | pass | `toggleLock("primary")` on an unlocked primary sets `params.primary` to `normalizeSeed({ l, c, h })` with `l` and `c` from `rgbToOklch(hexToRgb(roles.light.primary))` and `h` from `palettes.primary.hue`; `toggleLock("secondary")` and `toggleLock("accent")` use the palette's light step 500 `l` and `c` and the palette's `hue` (R2-17); on a locked seed the key is removed | ruling |
| C-STORE-16 | pass | `setSeedColor("primary", "#1f6f5b")` sets `params.primary` from `parseColor` and returns `{ ok: true }`; `oklch(0.6 0.15 250)` also works | decision |
| C-STORE-17 | failure | `setSeedColor("primary", "banana")` returns `{ ok: false, message }` with a message that names the accepted forms, and changes nothing | I-M2-03 |
| C-STORE-18 | failure | A worker error reply for the newest request (an `UnsatisfiableTargetError`) sets `status.phase: "failed"` and a `generation` notice, keeps the previous `spec` on the canvas and adds no history entry | plan, I-M2-03 |
| C-STORE-19 | pass | `revert` after a failed change restores `params` to those of the last committed snapshot and clears the notice | added |
| C-STORE-20 | failure | `setParams({ chroma: "loud" })` ends in a `generation` notice whose message names `params.chroma`; the store holds its last good `spec` | added |
| C-STORE-21 | pass | `loadFromHash` with a valid link sets `params` from `paramsOfSpec`, `seed` from `meta.seed` and `spec` from the link; the previous snapshot goes onto `history`, so undo returns | decision |
| C-STORE-22 | failure | `loadFromHash` with a bad link keeps the current snapshot and sets a `link` notice with the reason and `issues` | RF1, plan |
| C-STORE-23 | pass | `startFresh` takes a new seed, restores the `default` preset's params, clears the notice, the hash and the draft, and adds one history entry | decision, ruling |
| C-STORE-24 | pass | `status.phase` is `generating` while the newest request is pending and `idle` once its reply applies | added |
| C-STORE-25 | pass | Two stores built by `createStudioStore` share no state | ruling |
| C-STORE-26 | pass | The store calls the generator only through `deps.client`; the inline client calls `runGenerate` | ruling |
| C-STORE-27 | pass | `dispose` stops the client; replies that arrive afterwards change nothing | added |
| C-STORE-28 | pass | A loaded spec whose families match no pairing gives `paramsOfSpec` `customFonts: true` and the store a `custom-fonts` notice; the next `setParams` regenerates with the automatic pairing | ruling |
| C-STORE-29 | pass | `setView({ frame: 768 })` and the other view settings change `view` only: no request, no history entry | added |
| C-STORE-30 | pass | `paramsOfSpec` inverts generation: for 25 specs from `generateSystem(resolveParams(applyPreset(DEFAULT_PARAMS, id), seed), seed)` over all presets, `generateSystem(resolveParams(paramsOfSpec(spec).params, spec.meta.seed), spec.meta.seed)` deep-equals the spec | added |
| C-STORE-31 | pass | `paramsOfSpec` returns `pairing` absent when the families are the automatic pick for `meta.seed`, the explicit pairing id when they equal another pairing, and absent with `customFonts: true` when they match none; a spec generated with an explicit `host-grotesk` whose seed does not pick it back gives `pairing: "host-grotesk"` | ruling |
| C-STORE-32 | pass | `lotTag("0123456789abcdef")` is `0123·4567`; the middle dot is U+00B7 | decision |
| C-STORE-33 | failure | `lotTag` of a string that is not 16 lowercase hex digits throws `RangeError`; a non-string throws `TypeError` | added |
| C-STORE-34 | pass | Locking keeps the locked color (R2-17). After `toggleLock` of `secondary` or `accent`, all 46 roles of both modes are identical in 20 of 20 seeds (`seed-1` to `seed-20`) and 40 of 40 (`s0` to `s39`), at `AA` and `AAA`. After `toggleLock("primary")`: the primary role of each mode stays within ΔEOK 0.0017 for `seed-1` to `seed-20` and 0.0074 for `s0` to `s39`; every non-chart role stays within 10 codes per channel; at least 15 of 20 (`AA`) and 13 of 20 (`AAA`) seeds of `seed-1` to `seed-20` have all roles identical, and at least 27 of 40 (`AA`) and 14 of 40 (`AAA`) of `s0` to `s39`; any chart role may differ (measured up to 187 codes) | ruling, measured |
| C-STORE-35 | pass | `preset` becomes `null` when `setParams` changes a preset-owned field to a different value, or `view.density` changes; it stays when a seed color, the mode, the frame or another view setting changes, or when `setParams` writes the value a field already has | ruling |
| C-STORE-36 | pass | `undo` and `redo` restore `preset` with the rest of the snapshot | ruling |
| C-STORE-37 | pass | Five `setSeedColor` calls with the same `coalesce` key (a drag in the native color input) within 1,000 ms commit as one history entry; a call without a key commits alone | ruling |
| C-STORE-38 | pass | An auto pairing stays auto through a reload: after a committed change the link `loadFromHash(writeHash(spec))` gives `params.pairing` absent, and a following `regenerate` picks a new automatic pairing for the new seed; an explicit pairing stays explicit and `regenerate` keeps it | ruling |
| C-STORE-39 | pass | A draft restore with no hash gives the draft's `params`, `seed` and `preset`; a link load gives `params` from `paramsOfSpec` and `preset: null` (the spec has no preset field) unless the draft matches (C-HASH-16) | ruling |
| C-STORE-40 | pass | `startFresh` sets `lastApplied` before it issues its own request: a reply for a request issued before `startFresh` and arriving after it is dropped, and the reply for the `startFresh` request applies | ruling |
| C-STORE-41 | pass | Later regenerations keep the locked color: after `toggleLock("primary")`, each of three `regenerate` calls over `s0` to `s39`, with `newSeed` stubbed to return `${seed}-r1`, `${seed}-r2` and `${seed}-r3` in turn, leaves `params.primary` unchanged, and the new spec holds the seed's hex in a scale with no `seedDeviation` in at least 99 of 120 runs at `AA` and 105 of 120 at `AAA`; in every other run the spec records a `seedDeviation` (largest ΔEOK 0.0192), and in none is the seed dropped | ruling, measured |
| C-WORK-01 | pass | `runGenerate({ id: 7, params, seed })` returns `{ id: 7, ok: true, spec }`, `spec` deep-equals `generateSystem(params, seed)`, and `structuredClone(spec)` deep-equals it | plan |
| C-WORK-02 | failure | `runGenerate` with bad params returns `{ id, ok: false, error: { name, message } }` and never throws | I-M2-03 |
| C-WORK-03 | pass | RF4: requests 1, 2 and 3 are posted; replies arrive 2, 3, 1; the final `spec` is request 3's, reply 1 changes nothing, and two replies applied | RF4, plan |
| C-WORK-04 | pass | RF4: replies arrive 3, 2, 1; only reply 3 applies | RF4, plan |
| C-WORK-05 | pass | Replies in order 1, 2, 3 each apply (R2-13 item 3); with one `coalesce` key they commit as one history entry | ruling |
| C-WORK-06 | pass | A duplicate reply and a reply with an id above the newest issued are dropped | added |
| C-WORK-07 | pass | An error reply for an id that is not newer than `lastApplied` is dropped and shows no notice | added |
| C-WORK-08 | failure | A reply whose `spec` fails `normalizeSpec` (a missing role) is dropped and sets a failed status | ruling |
| C-WORK-09 | pass | Every applied `spec` has passed `normalizeSpec` | ruling |
| C-WORK-10 | pass | The inline client gives the same results and the same id handling, asynchronously, when `Worker` is undefined or its constructor throws | ruling |
| C-WORK-11 | pass | `generate.worker.ts` imports only `@/engine` and `./protocol`: no DOM, React or zustand | ruling |
| C-WORK-12 | pass | The worker's replies echo the request ids | plan |
| C-WORK-13 | pass | `createGenerateClient`: five `request` calls while the first is in flight post request 1 at once and, after its reply, only request 5; requests 2 to 4 are never posted | ruling |
| C-WORK-14 | pass | A reply with no pending request posts nothing; a reply with a pending request posts it exactly once | ruling |
| C-WORK-15 | pass | Ids stay increasing across superseded requests: after ids 1 to 5 the next request is 6, and the store's reply rule (C-WORK-03 to C-WORK-05) holds with this client in front of a stub post | ruling |
| C-WORK-16 | pass | With the client in front of a slow stub (a reply takes 200 ms of fake time), 30 `request` calls in 1 second post at most 6 requests, and the last reply applied is request 30's | RF4, ruling |
| C-HASH-01 | pass | `readHash(writeHash(SPEC))` is `{ kind: "spec", spec }` with `spec` deep-equal to `SPEC`; `writeHash` starts `#s=` | plan |
| C-HASH-02 | pass | `""`, `"#"`, `"#foo"` and `"#S=abc"` give `{ kind: "none" }` | ruling |
| C-HASH-03 | failure | A link with one changed character in the middle gives `reason: "corrupt"` | RF1, plan |
| C-HASH-04 | failure | A truncated link (its last 40 characters removed) gives `corrupt` | RF1, plan |
| C-HASH-05 | failure | A link whose payload carries `version: "dyelot.spec/2"` (built by the test with a valid trailer) gives `version` | RF1, plan |
| C-HASH-06 | failure | A valid link for an object that fails the schema gives `schema` with the failing paths in `issues` | RF1 |
| C-HASH-07 | failure | `#s=` with nothing after it, and `#s=abc&x=1`, give `corrupt` | ruling |
| C-HASH-08 | failure | A non-string argument throws `TypeError` | added |
| C-HASH-09 | pass | `linkUrl("https://dyelot.vercel.app", SPEC)` is `https://dyelot.vercel.app/studio` plus `writeHash(SPEC)` | decision |
| C-HASH-10 | pass | `bannerFor` gives, for `corrupt`, "This link is damaged or cut short, so the studio cannot open it."; for `version`, "This link comes from another version of the design format, so the studio cannot open it."; for `schema` with 3 issues, "This link holds a design the studio cannot read: 3 fields fail the format check." (1 issue: "1 field fails the format check"); the detail is "The studio opened a fresh design instead." or "The studio opened your last draft instead." by `fallback`; no message holds the link or a payload | RF1, ruling |
| C-HASH-11 | pass | After 10 commits within 300 ms (fake timers), `history.replaceState` has been called once, after the debounce, with the hash of the newest spec, and that hash decodes to the current spec | decision, plan |
| C-HASH-12 | pass | The studio uses `replaceState`, never `pushState`: `history.length` does not grow | decision |
| C-HASH-13 | pass | A pending hash write flushes at once on `pagehide` and on `visibilitychange` to hidden | added |
| C-HASH-14 | pass | A `hashchange` to a valid link loads it and pushes the previous design onto `history`; to an invalid one it sets the notice and keeps the spec | R2-14 |
| C-HASH-15 | failure | A `replaceState` that throws (a sandboxed frame) is swallowed; the store goes on | I-M2-05 |
| C-HASH-16 | pass | First load priority: a valid hash beats a draft; a draft beats a fresh design; a bad hash with a draft opens the draft and the banner says so; a bad hash without one opens a fresh design. A hash load has `preset: null`, except when a draft's `specId` equals the hash's: then the draft's `params`, `seed` and `preset` apply (an explicit pairing stays explicit); a draft with another `specId` is ignored for that load | R2-14 |
| C-HASH-17 | pass | A first load with a valid hash writes nothing to the draft until the first commit | added |
| C-DRAFT-01 | pass | `writeDraft` stores JSON `{ "v": 1, "link": "<encodeSpec>", "params": <DirectionParams>, "preset": <id or null> }` under `dyelot:draft`; `readDraft` returns `{ spec, params, seed, preset }` with a spec deep-equal to the one written and `params` equal to the written ones (an absent pairing stays absent) | decision, ruling |
| C-DRAFT-02 | pass | An empty storage gives `readDraft` `null` | added |
| C-DRAFT-03 | failure | RF2: `safeStorage(win)` returns `null` when reading `win.localStorage` throws `SecurityError` (the accessor itself throws before `readDraft` gets a storage); `readDraft(null)` gives `null` and `writeDraft(null, snapshot)` gives `{ ok: false }`, never a throw | RF2, plan |
| C-DRAFT-04 | failure | RF2: `setItem` that throws `QuotaExceededError` gives `{ ok: false }` and the store sets `status.draft` to `off`; a later successful write sets it to `on` | RF2, plan |
| C-DRAFT-05 | failure | A stored value that is not JSON gives `null` and removes the key (inside try/catch) | added |
| C-DRAFT-06 | failure | A stored `v: 2`, a tampered link, or a link that fails the schema gives `null`, removes the key and shows no banner | added |
| C-DRAFT-07 | failure | A stored value of the wrong shape (a number, an array, `{}`) gives `null` | added |
| C-DRAFT-08 | failure | A `null` storage (no `window`, or a blocked API) gives `null` and `{ ok: false }` | RF2 |
| C-DRAFT-09 | pass | `clearDraft` removes the key and swallows a throwing storage | added |
| C-DRAFT-10 | pass | RF2: a store built with a storage whose every method throws still commits, undoes, redoes, regenerates and updates the hash; `status.draft` is `off` | RF2, plan |
| C-DRAFT-11 | pass | A draft is written after the same debounce as the hash, once per burst | decision |
| C-DRAFT-12 | failure | A stored `params` with a value outside its set (`chroma: "loud"`) reads back as `params: null`, and the first load falls back to `paramsOfSpec` | ruling |
| C-DRAFT-13 | failure | On a first load whose draft `specId` matches the hash, draft `params` with valid enums but an out-of-domain value (`type.ratio: 9`, an unknown pairing id) or a field that disagrees with `paramsOfSpec(spec)` (other than `pairing`) are not used: the store takes `paramsOfSpec(spec)`, keeps the draft's `preset` only when the params were used, and `generateSystem(resolveParams(params, seed), seed)` deep-equals the held `spec` | R2-14 |

### 6.8 Fix mapping (Task 2.10 helpers, tested with the store in Task 2.5)

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-INSPECT-01 | pass | `fixFor` for a `C1` finding with `params.contrastLevel` `AA` returns `{ contrastLevel: "AA+" }`; for a `C5`, `N1` or `F1` finding at `AA` or `AA+` it returns `{ contrastLevel: "AAA" }`; it does not call the generator (a spy on `generateSystem` sees no call) | decision, ruling |
| C-INSPECT-02 | pass | When the target is not above the current level `fixFor` returns `null`: C1 at `AA+` or `AAA`, and C5, N1 and F1 at `AAA` | ruling |
| C-INSPECT-03 | pass | `fixFor` returns `null` for every other rule id, including `K4` and the T rules; it does not mutate its arguments | ruling |
| C-INSPECT-04 | pass | A link built by the test holds a spec with `color.params.contrastLevel: "AA"` and `roles.light.ring` set to `#f4f4f4` on the `#ffffff` page. The inspector shows the F1 finding for `ring/background` in light mode and the button "Raise contrast to AAA". Pressing it calls `setParams({ contrastLevel: "AAA" })`, the worker regenerates the design at `AAA`, which replaces every role: the new spec's `color.params.contrastLevel` is `AAA`, the F1 finding is gone, and the ratio of `ring` to `background` is at least 3 in both modes. The case states that regeneration, not an edit of the ring, clears the finding (R2-10) | plan, ruling |
| C-INSPECT-16 | pass | The scan behind R2-10 holds as a recorded measurement: for 3 chroma levels × 4 neutral tints × 2 gamuts × 2 scale modes × seeds `s0` to `s11` at `AA`, the engine raises no C1, C5, N1 or F1 finding (0 of 576 designs) | measured |
| C-INSPECT-17 | failure | When the finding is still present after the regeneration (a stub client returns a spec that keeps it), the inspector shows "Raising the contrast did not clear this finding." with `role="status"` and keeps the finding | ruling |

### 6.9 Inspector helpers (Task 2.10)

Tests: `tests/unit/features/studio/inspect.test.ts`.

The 32 rows of `roleRows`, in this order: the 13 C1 text pairs and the 6 C5 on-fill pairs of M1's linter (`kind:
"text"`), then the 13 non-text pairs against `background` (`kind: "ui"`): `input`, `border`, `ring`, `primary`,
`destructive`, `success`, `warning`, `info`, `chart-1`, `chart-2`, `chart-3`, `chart-4`, `chart-5`. A text row's
foreground is the role and its fill is the paired role; a UI row's foreground is the role and its fill is `background`.
A row's `pair` is `<foreground>/<fill>`. The ratio is `wcagRatio` of the two hexes, `lc` is `perceptualLc(foreground,
fill)`, and `lcText` is `formatLc(lc)`.

`showMe` maps a finding's subject to what the "show me" highlights:

| Rule | Roles highlighted on the canvas | Cells highlighted in the scales |
|---|---|---|
| C1, C4, C5, N1, N2, N3, F1, C2 | the roles in the `a/b` subject (`input/background` gives `input` and `background`) | none |
| S1 | the roles of the set: `success`, `warning`, `destructive`, `info` for `status`; `chart-1` to `chart-5` for `chart` | none |
| S2 | `destructive`, `success` | none |
| D1, D2, D4 | `background`, `foreground`, `card` as the subject names them | none |
| K1, K2 | none | both steps of `<palette>-<a>/<palette>-<b>` |
| K4, G1, G3, D3, P1, T3 | none | the one step of `<palette>-<step>` |
| T1 | `font-display` (the kit marks display headings with this token) | none |
| T2 | `primary` | the primary scale's 600 step |
| T4 | `font-body` | none |

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-INSPECT-05 | pass | `roleRows(SPEC)` has 32 rows in the order above; the first 19 are `text` and the last 13 are `ui` | decision |
| C-INSPECT-06 | pass | Each cell's `ratio` equals `wcagRatio` of its hexes on its full float, for both modes | plan |
| C-INSPECT-07 | pass | `passLevel` for text: 7 gives `AAA`, 6.99 gives `AA`, 4.5 gives `AA`, 4.49 gives `AA large`, 3 gives `AA large`, 2.99 gives `fail` | plan |
| C-INSPECT-08 | pass | `passLevel` for UI: 3 gives `pass 3:1`, 2.99 gives `fail` | plan |
| C-INSPECT-09 | pass | `formatLc(76.4)` is `+76`; `formatLc(-33.1)` is `−33` with U+2212; `formatLc(0)` and `formatLc(-0.4)` are `0` | plan |
| C-INSPECT-10 | pass | The sign of a cell's `lc` follows `perceptualLc`: dark text on a light fill is positive in the light mode | decision |
| C-INSPECT-11 | pass | `groupFindings` splits by severity, keeps the linter's order inside a group, and drops nothing | plan |
| C-INSPECT-12 | pass | `showMe` maps each rule id as the table says; a pair subject gives two roles; a step pair gives two cells | plan |
| C-INSPECT-13 | failure | `showMe` of a finding with an unknown subject shape gives empty `roles` and `cells` and does not throw | added |
| C-INSPECT-14 | pass | `findingTitle` gives a non-empty plain-language title for each of the 24 rule ids (C1 "Text under 4.5:1", C2 "Large text under 3:1", C4 "Body text under the advisory score", C5 "Text on a fill under 4.5:1", N1 "Input border under 3:1", N2 "Chart color under 3:1", N3 "Border under 3:1", F1 "Focus ring under 3:1", S1 "Colors too close under color-blind views", S2 "Danger and success too close in lightness", K1 "Scale steps out of order", K2 "Adjacent steps too close", K4 "Chroma off its curve", G1 "Color outside the gamut", G3 "Gray color with a hue", D1 "Dark page too light", D2 "Dark text off-white", D3 "Dark accent too saturated", D4 "Dark card not lighter than the page", P1 "Color in the disliked yellow-green zone", T1 "Overused display font", T2 "Purple on white default", T3 "Tailwind default color", T4 "Body text under 16 px") | added |
| C-INSPECT-15 | pass | No title uses "simply", "just", "easy", "obviously" or "basically" and none ends with an exclamation mark | added |

### 6.10 Source guards

Tests: `tests/unit/features/preview/guard.test.ts`, `tests/unit/engine/repo-guards.test.ts`.

The preview guard is a function `findViolations(source: string): readonly string[]` that the test runs over every file
under `src/features/preview/` and over fixtures. It flags: a Tailwind palette class (`bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|shadow|accent|caret|placeholder`
followed by one of the Tailwind palette names and a step; the names come from the same derivation as T3's table, the 26
`--color-<palette>-<step>` palettes of `node_modules/tailwindcss/theme.css`, and not from a typed list), `bg-white`,
`bg-black`, `text-white`, `text-black`, the `dark:` variant, an arbitrary value holding a color (`[#abc]`, `[rgb(...)]`), a hex
literal, any of `rgb(`, `rgba(`, `hsl(`, `hsla(`, `hwb(`, `lab(`, `lch(`, `oklab(`, `oklch(`, `color(`, and a CSS named color used
as a value. `transparent`, `currentColor` and `inherit` pass. `var(--x)` passes only when `x` is a name that `themeVars` or
`densityVars` writes (the guard derives the list from their output) or a `--kit-*` local of the preview kit; a chrome token such
as `var(--panel)`, `VAR(--panel)` (CSS function names ignore case), `bg-(--panel)` or the typed shorthand `text-(color:--panel)`
is a violation. A name built in a template passes only when its fixed prefix ends in `-` and starts a bridge name
(`` `var(--text-${step})` ``); `` `var(--${role})` `` and `` `var(--p${x})` `` could name anything and are violations. A role's
variable comes from `roleVar(role)` in `src/features/preview/vars.ts`, which throws `RangeError` for a name outside
`ROLE_NAMES`; the guard allows that function's body by name. The value of a custom property (`--kit-scrim: white`, the quoted key
`"--kit-value": "red"`) and of a vendor-prefixed property (`-webkit-text-fill-color`) is checked like any color value, the
fallback of `var(--x, red)` is checked, and the CSS Color 4 system colors (`Canvas`, `CanvasText`, `ButtonBorder`,
`AccentColor` and the rest) count as named colors. `color-mix(...)` passes only when every color argument is `var(--x)` or
`transparent` (`color-mix(in oklab, var(--primary) 20%, transparent)`); a literal color inside it is a violation. Each hit
names the rule that fired.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-GUARD-01 | failure | `findViolations` flags `bg-indigo-500`, `bg-mauve-500` (a palette Tailwind added after 4.0), `text-slate-700`, `border-red-200`, `ring-blue-500/50`, `dark:bg-black`, `bg-white`, `bg-[#fff]`, `color: #fff`, `fill: rgb(0 0 0 / 0.1)`, `stroke: oklch(0.6 0.1 20)`, `color: rebeccapurple`, `color-mix(in oklab, #fff 20%, transparent)`, and `style={{ color: "red" }}`; also `[data-canvas] { --kit-scrim: white; }`, `style={{ "--kit-value": "red" }}`, `color: var(--primary, red)`, `background-color: Canvas`, `color: CanvasText`, `border: 1px solid ButtonBorder`, `color: AccentColor`, `-webkit-text-fill-color: white`, `-webkit-tap-highlight-color: red`, `color: var(--panel)`, `background: var(--page)`, `bg-(--panel)` and `text-[var(--fg-muted)]`, and the templates `` `var(--${role})` `` and `` `var(--p${x})` ``, `text-(color:--panel)` and `color: VAR(--panel)`; the test names the rule each sample fires | plan, review |
| C-GUARD-02 | pass | `findViolations` passes `bg-(--primary)`, `text-[var(--foreground)]`, `fill="currentColor"`, `background: transparent`, `color-mix(in oklab, var(--primary) 20%, transparent)`, and `border-border` only when the Tailwind theme maps `border` to a variable (the guard lists the utility names it allows: the role names of `ROLE_NAMES`) | plan |
| C-GUARD-03 | pass | No file under `src/features/preview/` has a violation | plan |
| C-GUARD-04 | pass | Every `.css`, `.ts` and `.tsx` file under `src/features/preview/` is scanned, including `kit/` and `templates/`; the test fails when the folder is empty or unreadable | added |
| C-GUARD-05 | pass | The only chrome files that name madder `#f66c6d` or its token are the focus ring, the active state and the primary action styles (a scan lists them) | decision |
| C-REPO-M2-01 | pass | No file under `src`, `scripts` or `public` (outside `public/fonts` binaries) contains `fonts.googleapis.com`, `fonts.gstatic.com` or `fontshare`; `next/font` is allowed for the chrome (R2-23) | I-M2-06 |
| C-REPO-M2-02 | pass | `src/engine`, `src/spec` and `src/theme` import nothing from `src/features`, `src/app`, `src/components` or `src/lib` | I-M2-07 |
| C-REPO-M2-03 | pass | `vitest.config.ts` runs `tests/unit/theme/**` in the `node` project, and its coverage include and floors cover `src/theme/**`, `src/engine/fonts/**` and the named pure helper files of R2-22 at 95 and 90 | R2-22 |
| C-REPO-M2-04 | pass | The M1 repository guards C-REPO-01 to C-REPO-05 pass unmodified, apart from C-REPO-02 and C-REPO-05, which R2-25 amends | plan |
| C-REPO-M2-05 | pass | git tracks no font binary (woff, woff2, ttf, otf) outside `src/lib/site/fonts/`, the M0 share-card fonts | review |

### 6.11 Shortcut and input helpers (Task 2.6)

Tests: `tests/unit/features/studio/{shortcuts,inputs}.test.ts`, in jsdom. A "press" is a `KeyPress`; the target is an element
built by the test. The flows F-KEY-01 to F-KEY-14 run the same rules in the browser.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-KEYS-01 | pass | With the body as target (or `null`) and no drawer open, Space gives `regenerate`, ← `undo` and → `redo`, and each gives the same with `repeat` set: a held key repeats (R2-15 item 3) | R2-15 |
| C-KEYS-02 | failure | Each text field ignores Space, L, ←, →, Alt+T and Mod+S: an `input` of type text, email, number, search, url, tel, password and date, a `textarea`, a `select`, an element with `contenteditable` and a child of one | R2-15 item 1 |
| C-KEYS-03 | pass | `isTextField` is false for `input` of type color, checkbox, radio, range and button, and for `contenteditable="false"` | R2-15 item 1 |
| C-KEYS-04 | failure | Space, ← and → give `null` on a `button`, a `summary`, a link with `href`, a native checkbox, radio, range or color input, and an element with each role of R2-15 item 2 | R2-15 item 2 |
| C-KEYS-05 | pass | L (or Shift+L) on an element with `data-seed-slot="primary"` (the color input, the lock toggle) gives `toggle-lock` for that slot; L on the body, on a button without the attribute, on a hex field or with Ctrl, Meta or Alt gives `null`; a slot outside `LOCKABLE` gives `null` | R2-15 item 4 |
| C-KEYS-06 | pass | Alt with `code` `KeyT` gives `toggle-mode` whatever `key` says (`t`, `†`); Alt with another code, Alt+Shift+T and Ctrl+Alt+T give `null` | R2-15 item 3 |
| C-KEYS-07 | pass | Ctrl+S and Meta+S give `copy-link` outside a text field and `null` inside one, matched on the key `s` or the code `KeyS` (a Cyrillic layout types `ы`), also on a repeat so a held chord never opens the save dialog; with Alt or Shift held they give `null`; any other Ctrl or Meta chord gives `null` | R2-15 items 3 and 7 |
| C-KEYS-08 | pass | Escape gives `close-drawer` when a drawer is open, from any target, a text field included; with no drawer open it gives `null` | R2-15 item 6 |
| C-KEYS-09 | failure | With the canvas region or any element inside it as target, Space, ←, →, L, Alt+T and Mod+S give `null` | R2-15 item 5 |
| C-KEYS-10 | failure | With a drawer open, Space, ← and → give `null`, while L, Alt+T and Mod+S still fire | R2-15 item 2 |
| C-KEYS-11 | failure | A press during IME composition, and any other key, gives `null` | added |
| C-KEYS-12 | failure | R-05: a press that is not an object, or whose `key` or `code` is not a string, throws `TypeError` naming `shortcutFor`; a target that is neither an `Element` nor `null` throws `TypeError` | added |
| C-KEYS-13 | failure | A repeated L or Alt+T gives `null`: holding a toggle would flip it on every repeat | added |
| C-INPUTS-01 | pass | `seedHex` of an unlocked slot is `toHex(gamutMap(lockSeed(spec, slot), "srgb"))` for each of the three slots | R2-17 |
| C-INPUTS-02 | pass | `seedHex` of a locked slot is its seed mapped into sRGB; a seed set from `#1f6f5b` reads back `#1f6f5b` | decision |
| C-INPUTS-03 | failure | `seedHex` with a slot outside `LOCKABLE` throws `RangeError`, with a spec or params that are not objects `TypeError`, each naming `seedHex` | added |
| C-INPUTS-04 | pass | `autoPairingLabel(seed)` is `Auto (<label>)` with the label of `choosePairing(seed)`; a non-string seed throws `TypeError` | ruling |
| C-INPUTS-05 | pass | `GAMUT_LABELS` names `srgb` "sRGB" and `p3` "Display P3", and `SEED_FIELD_MESSAGE` is the message of F-INPUT-09 | decision |

## 7. Flows (UI, covered by Playwright)

Tests: `tests/e2e/studio.spec.ts`, `tests/e2e/canvas.spec.ts` (section 7.4), `tests/e2e/templates.spec.ts`,
`tests/e2e/inspector.spec.ts`, `tests/e2e/home.spec.ts`.
Every flow runs against the production build. A flow that names no viewport runs at 1280 × 800. "Canvas variables" means
the computed custom properties on `[data-canvas]`.

### 7.1 Layout and the shell (Task 2.6)

The studio is a client page at `/studio`. Its regions are landmarks: the inputs panel (`<aside aria-label="Inputs">`), the
canvas (`<main aria-label="Canvas">`) and the inspector (`<aside aria-label="Inspector">`). The page has one `h1`,
visually hidden, "dyelot studio". The toolbar above the canvas has one order, in the DOM and for Tab: below 1024 px the drawer buttons "Inputs" and
"Inspector" first, then the frame switcher, the template switcher, the mode toggle, the density group, "Reduce motion", the
copy group, the vision group, "Undo", "Redo" and "Copy link". Below 640 px the five view controls (the mode toggle, the
density group, "Reduce motion", the copy group and the vision group) sit in a disclosure: a button "View" with
`aria-expanded` and `aria-controls`, closed by default, takes the mode toggle's place, and the disclosed group follows it
directly in the DOM, so the order stays Inputs, Inspector, frame, template, "View" (mode, density, motion, copy, vision),
Undo, Redo, Copy link. The keyboard shortcuts work whether it is open or closed. The DOM order of the page is: skip link,
header, inputs panel, canvas toolbar, canvas, inspector.
The header holds the wordmark, the lot tag and the swatch strip. The lot tag reads `LOT` and `lotTag(specId(spec))` in
Geist Mono. The strip is a group labeled "Primary scale, 11 steps" with 11 swatches, each titled with its step and hex.

| Id | Kind | Case | Origin |
|---|---|---|---|
| F-STUDIO-01 | pass | `/studio` answers 200, has one `h1`, a title and a description of its own, a canonical link, and an entry in `sitemap.xml`; the home page keeps its own | plan |
| F-STUDIO-02 | pass | At 1280 px the three regions are visible side by side: inputs 320 px, inspector 360 px, canvas fluid in between (each ±1 px) | decision, plan |
| F-STUDIO-03 | pass | At 1100 px the inputs panel is a 320 px column, the inspector is a drawer, and the toolbar shows "Inspector"; the open Inspector drawer makes the inputs column `inert`, and closing it returns focus to "Inspector" | ruling, review |
| F-STUDIO-04 | pass | At 360 px both panels are drawers, the toolbar shows "Inputs" and "Inspector", and `document.documentElement.scrollWidth` is at most 360 | RF5, plan |
| F-STUDIO-05 | pass | Opening a drawer moves focus into it (its heading, `tabindex="-1"`), traps focus, sets the rest of the page `inert`, and Escape closes it and returns focus to the button that opened it | RF5, ruling |
| F-STUDIO-06 | pass | A backdrop click closes a drawer; a closed drawer is `inert`, so no control inside it takes focus | ruling |
| F-STUDIO-07 | pass | The lot tag shows `LOT` and eight hex characters as `xxxx·xxxx` equal to the first eight of `specId`; after a change it shows the new id | plan |
| F-STUDIO-08 | pass | The strip has 11 swatches whose colors equal the primary scale's hexes for the current mode, and they follow the mode toggle; each swatch is an image (`role="img"`) named "<step> <hex>" | decision, review |
| F-STUDIO-09 | pass | RF1: loading `/studio#s=<tampered link>` shows the banner with the corrupt sentence, the second sentence, and the buttons "Start fresh" and "Dismiss"; the canvas shows a design (never blank) | RF1, R2-18 |
| F-STUDIO-10 | pass | RF1: a truncated link shows the corrupt banner; a link with a future version shows the version banner; a link that fails the schema shows the schema banner with the count | RF1, R2-18 |
| F-STUDIO-11 | pass | RF1: "Start fresh" opens a new design, clears the banner and the hash, and the lot tag changes; "Dismiss" hides the banner and keeps the design | RF1, ruling |
| F-STUDIO-12 | pass | RF1: with a saved draft, a bad link opens the draft and the banner's second sentence says so | RF1, R2-14 |
| F-STUDIO-13 | pass | A valid `#s=` link opens that design: the canvas variables equal `themeVars` of the decoded spec and the lot tag equals its id | decision |
| F-STUDIO-14 | pass | After a change the URL hash becomes `#s=<link>` within 400 ms of the canvas variables changing (the 300 ms debounce plus 100 ms), and reloading the page restores the same design | decision |
| F-STUDIO-15 | pass | "Copy link" and Mod+S copy `<origin>/studio#s=<link>` to the clipboard and show a toast "Link copied" (`role="status"`) | decision |
| F-STUDIO-16 | failure | With clipboard writing denied, the same actions show "Copy blocked. Select the link below." and a read-only field holding the link, already selected; a held Mod+S never opens the browser's save dialog, also once focus has moved into the share field (the field takes Mod+S itself) | I-M2-05 |
| F-STUDIO-17 | pass | RF2: with `localStorage` replaced by an object that throws on every access (an init script), the studio loads, edits, undoes and updates the hash, and the toolbar shows "Drafts off" | RF2, I-M2-05 |
| F-STUDIO-18 | pass | With a draft saved, reloading `/studio` with no hash restores it and shows the dismissible notice "Restored your last draft." | decision |
| F-STUDIO-19 | pass | Fault injection: an init script replaces `window.Worker` with a stub class that answers every request with `{ id, ok: false, error: { name: "RangeError", message: "forced" } }` once the test sets `window.__dyelotFault`. Changing a control then shows a labeled message with a "Revert" button, keeps the old canvas, and "Revert" restores the control. Pages are fixed, so no input can trigger this from the UI | I-M2-03 |
| F-STUDIO-20 | pass | No network request goes to a host other than the page's origin; none to `fonts.googleapis.com` or `fonts.gstatic.com` | I-M2-06 |
| F-STUDIO-21 | pass | The page loads with `worker-src 'self' blob:` allowed by the CSP and generation runs in a worker (the test sees a `Worker` created) | R2-13 |
| F-STUDIO-22 | pass | A link whose families match no pairing shows the polite notice that editing resets the fonts | R2-14 |
| F-STUDIO-23 | pass | Focus never falls to the page body when the studio removes the focused control: after "Start fresh", "Dismiss" or "Revert" focus moves to the canvas region; closing the copy-blocked toast returns focus to the element that had it when the toast opened, or to "Copy link" when that was the body; with a drawer open, a copy-blocked toast announces itself (`role="status"`) and focus stays in the drawer; a toast opened while focus was inside it (Mod+S on its Close button) gives focus to "Copy link" on close, never to its own button | I-M2-03, review |
| F-STUDIO-24 | pass | "Drafts off" is a disclosure any user can open (keyboard, touch, screen reader) to read why: "This browser does not let the studio save a draft. The link in the address bar still holds the design."; when drafts turn off mid-session (a `setItem` that starts throwing) a polite live region says "Drafts off"; the region sits outside every part of the page a drawer makes inert, so it speaks while a drawer is open | RF2, review |
| F-STUDIO-25 | pass | A panel that turns into a drawer, or back into a column, when the window crosses 1024 or 1280 px does not slide: it takes its place at once (no running transition); the slide runs only while a drawer opens or closes, and under reduced motion it lasts 0.01 ms | R2-16, review |

### 7.2 The inputs panel (Task 2.6)

Each control has a visible label and an accessible name. A small enum of at most four options is a radio group; larger
sets are a native `select`. The one primary chrome action of the panel, "Regenerate", is the only madder fill; a selected
option, a pressed lock toggle and the mode switch show a neutral selected state (foreground text and a lighter neutral fill; a
selected option adds a `--border-bright` inner ring), so madder means focus or the primary action. Every form-control edge (text
and hex fields, color inputs, selects, segmented groups, toggles) is the achromatic `--control-edge` (`#666666`, 3.24:1 on the
panel, 3.45:1 on the page, F-A11Y-09); decorative dividers and panel edges keep `--border` and `--border-bright`. "Regenerate" and the shortcut hint stay in view at 1280 × 800
as the panel's footer; the hint names Space, ← and →, L, Alt+T and Ctrl+S (⌘S on a Mac).

| Control | Label | Kind | Options | Changes |
|---|---|---|---|---|
| Seed rows (3) | "Primary", "Secondary", "Accent" | hex field, native color input, lock toggle ("Lock primary", `aria-pressed`) | any color `parseColor` accepts | `params.<slot>` |
| Harmony | "Harmony" | select | the 6 harmonies | `params.harmony` |
| Chroma | "Chroma" | radio group | muted, balanced, vivid | `params.chroma` |
| Neutral tint | "Neutral tint" | radio group | none, warm, cool, brand | `params.neutralTint` |
| Contrast level | "Contrast level" | radio group | AA, AA+, AAA | `params.contrastLevel` |
| Gamut | "Gamut" | radio group | sRGB, Display P3 | `params.gamut` |
| Scale mode | "Scale mode" | radio group | standard, even | `params.scaleMode` |
| Preset | "Preset" | select | the 14 presets by label | all preset fields and `view` |
| Pairing | "Pairing" | select | "Auto (<name>)" and the 20 pairings | `params.pairing` |
| Type context | "Type context" | select | the 5 contexts | `params.type.context` |
| Radius | "Radius" | radio group | sharp, soft, round | `params.radius` |
| Depth | "Depth" | radio group | flat, soft, layered | `params.depth` |
| Density | "Density" | radio group | comfortable, compact, dense | `view.density` |
| Motion feel | "Motion feel" | radio group | calm, brisk, playful | `params.motion` |
| Regenerate | "Regenerate" | button | none | new seed |

| Id | Kind | Case | Origin |
|---|---|---|---|
| F-INPUT-01 | pass | The panel holds exactly the controls of the table, in that order, and no brief, image or import control | decision |
| F-INPUT-02 | pass | Each control has an accessible name equal to its label (the lock toggle "Lock primary", "Lock secondary", "Lock accent") | plan |
| F-INPUT-03 | pass | Changing harmony changes `--secondary-600` on the canvas; chroma changes `--primary-600`; neutral tint changes `--neutral-500`; contrast level changes at least one role (the test picks a seed where it does, by scanning); gamut changes at least one scale step; scale mode changes a step; type context changes `--text-body`; radius changes `--radius-md`; depth changes `--shadow-2`; density changes `--control-height`; motion feel changes `--duration-base` (calm) and `--spring-bounce` (playful) | plan |
| F-INPUT-04 | pass | Pairing changes `--font-display`; "Auto" shows the chosen pairing's name | plan, ruling |
| F-INPUT-05 | pass | Choosing a preset sets the controls it fixes, keeps the locked seeds, keeps a higher contrast level, sets the mode and density, and shows its guard notes and `unexpressed` list under the select; the select shows the preset's label | decision, ruling |
| F-INPUT-06 | pass | Typing `#1f6f5b` into the primary hex field and blurring locks primary: the lock toggle is pressed, `--primary-600` follows the color, and the native color input shows the same color | decision |
| F-INPUT-07 | pass | Choosing a color in the native color input updates the hex field and locks the seed; dragging in the picker (many `input` events) is one undo step | decision, ruling |
| F-INPUT-08 | pass | The lock toggle on an unlocked seed locks it at the color the palette holds. For `secondary` and `accent` the role variables do not change (a scale step may move onto the locked seed); for `primary` the primary role keeps its color within the bound of C-STORE-34 and the chart colors may change. Toggling again unlocks and restores every canvas variable. After a lock, Space keeps the locked color (C-STORE-41) | ruling |
| F-INPUT-09 | failure | An invalid hex ("banana") shows a field message "Enter a color like #3a6ea5 or oklch(0.6 0.15 250)." linked with `aria-describedby`, sets `aria-invalid`, and leaves the canvas unchanged | I-M2-03 |
| F-INPUT-10 | pass | An unlocked seed's field shows the generated color as a placeholder-styled value and "Auto" next to it | added |
| F-INPUT-11 | pass | "Regenerate" changes the unlocked colors, keeps the locked ones, and changes the lot tag | decision |
| F-INPUT-12 | pass | Numbers in the lot tag, hex fields and the ratios use Geist Mono with `font-variant-numeric: tabular-nums` | decision |
| F-INPUT-13 | pass | There is no slider in M2; the two rapid inputs are holding Space and dragging in the native color input (F-INPUT-15) | added |
| F-INPUT-14 | pass | After a preset is chosen, changing any control it owns (for example Radius) makes the Preset select show "Custom" and hides the preset notes; changing a seed color or the mode does not | ruling |
| F-INPUT-15 | pass | Holding Space is rapid input, as is a drag in the native color input; both coalesce into one undo step each | RF4, ruling |
| F-INPUT-16 | pass | At 1280 × 800 "Regenerate" is in view without scrolling the panel; it carries `aria-keyshortcuts="Space"`, the mode switch `Alt+T` and "Copy link" `Control+S Meta+S`, and the hint text names Alt+T and Ctrl+S | review |

### 7.3 Keyboard (Task 2.6)

| Id | Kind | Case | Origin |
|---|---|---|---|
| F-KEY-01 | pass | Space on the page body regenerates the unlocked colors; the lot tag changes | plan |
| F-KEY-02 | pass | RF4: an init script wraps `crypto.getRandomValues`; for a call on a `Uint32Array` of length 2 (the seed draw of R2-13 item 5, and only that) call n fills `[n, 0]` (seed `n.toString(36) + "0"`) and increments `window.__seedCalls`; other calls pass through. Holding Space for 1 second leaves the canvas on the newest request's design: within 2 s of the last key event the lot tag equals the id that the test computes in Node for the seed of call `window.__seedCalls` (`specId(generateSystem(resolveParams(params, seed), seed))`) | RF4, ruling |
| F-KEY-03 | pass | ← undoes and → redoes; the lot tag follows | plan |
| F-KEY-04 | pass | Alt+T flips light and dark; the canvas variables change and no history entry is added | decision |
| F-KEY-05 | pass | Mod+S copies the share link and prevents the browser's save dialog | decision |
| F-KEY-06 | pass | L with focus on the primary row's swatch button toggles the lock; with focus on the secondary row's lock toggle it toggles secondary; Alt+T is matched on `event.code` `KeyT` | decision, ruling |
| F-KEY-07 | failure | With focus in the hex field, the harmony select or any text field, the studio's shortcuts do not fire: Space, L, ←, → and Alt+T neither regenerate, lock, undo, redo nor flip the mode. A closed select's own arrow keys stay native (Chromium moves its value on ← and →) | plan, ruling |
| F-KEY-08 | failure | L with focus in the primary hex field does not lock it | ruling |
| F-KEY-09 | failure | Space with focus on a button activates the button and does not regenerate; ← and → on a radio group move the radio and do not undo | ruling |
| F-KEY-10 | pass | Escape closes an open drawer, also from a text field inside it | decision, ruling |
| F-KEY-11 | pass | Keyboard-only: from a fresh load, Tab follows the DOM order of 7.1 and reaches the skip link, the header, every control of the inputs panel in the order of 7.2, the canvas toolbar in its order, the canvas region, and every inspector control and finding action, with a visible 2 px madder focus ring on each chrome control (inside the canvas the ring is `--ring`, R2-30) | RF5, plan |
| F-KEY-12 | pass | At 360 px, keyboard-only: the same controls are reachable by opening the drawers with Enter and Space on their buttons, and Escape closes them | RF5, plan |
| F-KEY-13 | failure | With focus inside `[data-canvas]` (a preview checkbox, the kit's tab list), Space, ←, →, L and Alt+T do not reach the studio shortcuts, and the preview control keeps the key | ruling |
| F-KEY-14 | failure | A `keydown` that is a plain `Event` (no key or code, as some autofill and extensions send) reaches no shortcut and raises no page error | review |

### 7.4 The canvas (Task 2.7)

The canvas is a framed specimen on the house dot grid. The frame is an element `[data-canvas]` that carries
`themeVars(spec, view.mode, { vision })` and `densityVars(view.density)` as inline custom properties, `data-mode`,
`data-density`, `data-reduced-motion` and `data-copy`, and has `container-type: inline-size`. Templates size themselves
with container queries. The toolbar is the one of section 7.1, in that order: a frame switcher (radio group "Frame": 360, 768, 1280), a template switcher
(`landing`, `dashboard`, `settings`, `mobile`, `editorial`, `kitchen sink`), a mode toggle, a density group, a "Reduce
motion" switch, a copy group ("Real copy", "Edge-case copy") and a vision group ("Vision": none, protan, deutan, tritan),
then Undo, Redo and Copy link; below 640 px the five view controls sit in the "View" disclosure of section 7.1. The toolbar
stays compact: at 1280 × 800 it takes at most 3 rows and 150 px, at 360 × 740 with the disclosure closed at most 170 px, and
every toolbar target is at least 28 px tall and 24 px wide. The canvas passes `{ vision, units: "cqi" }` to `themeVars`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| F-CANVAS-01 | pass | The canvas frame carries exactly the 204 properties of `themeVars(spec, mode, { units: "cqi" })` plus the two density properties. A computed-style walk of every element inside it finds no `color`, `background-color`, `border-*-color`, `outline-color`, `fill`, `stroke` or `box-shadow` color equal to a chrome color (the values declared in the `:root` block of `src/app/globals.css`, madder `#f66c6d`, `#0a0a0a`, `#12121a` and the house neutrals), except on the "Show me" overlay; a spec color that equals a chrome value by chance is skipped by value | I-M2-04, plan |
| F-CANVAS-02 | pass | The frame switcher sets the frame width to 360, 768 or 1280 px; the template's layout changes through container queries and no media query inside the preview changes it (resizing the viewport at fixed frame leaves the layout alone) | decision, plan |
| F-CANVAS-03 | pass | A frame wider than the canvas area scales down with `transform: scale` and the switcher shows the fit ("fit 91%"); the page never scrolls sideways | ruling |
| F-CANVAS-04 | pass | The mode toggle switches the canvas variables between the light and dark `themeVars`, and Alt+T does the same | decision |
| F-CANVAS-05 | pass | The density group changes `--control-height` and the kit's control heights (40, 36 and 32 px) | decision |
| F-CANVAS-06 | pass | The vision group recomputes the canvas colors: with `protan`, `--destructive` equals `toHex(simulate(hexToRgb(<stored hex>), "protan"))`; `none` restores the stored hexes | decision, plan |
| F-CANVAS-07 | pass | With "Reduce motion" on, kit animations and transitions stop (computed `animation-name` is `none` and transition durations are at most 0.01 ms) and Motion springs do not run; the switch keeps the preview's own state and never replays the entrance, and once it is off the springs run again, also in parts that mounted while it was on | plan, review |
| F-CANVAS-08 | pass | With the operating-system preference `prefers-reduced-motion: reduce`, the same holds without the switch | decision |
| F-CANVAS-09 | pass | "Edge-case copy" swaps in the long word, the long title, the diacritics, the large number, the empty list and the one-character label, and no template overflows its frame; in the 360, 768 and 1280 frames each reading on screen keeps its number on one line, and the place and observer text of the readings breaks only at spaces and hyphens (every word of 20 characters or fewer has one client rect; only the 40-character word may break anywhere) | ruling, review |
| F-CANVAS-10 | pass | The template switcher shows each of the six templates; the choice is kept across edits and view changes | decision |
| F-CANVAS-11 | pass | "Show me" (section 7.8) outlines the elements whose `data-roles` hold the role, in madder, 2 px dashed with a 2 px offset, and clears when another is chosen or the finding is dismissed | decision |
| F-CANVAS-12 | pass | Inside the canvas `color-scheme` is `light` or `dark` by the mode (so native controls follow the spec), the focus ring is `--ring`, `::selection` uses `--primary` and `--primary-foreground`, the caret uses `--primary`, the scrollbar uses `--border` and `--muted`, and `text-underline-offset` and tabular numerals are set | research D1 rule 25, R2-30 |
| F-CANVAS-13 | pass | The canvas region is keyboard-scrollable (`tabindex="0"` when it scrolls), axe finds no scrollable-region violation, and with focus on it Space and the arrow keys scroll it natively without regenerating, undoing or redoing (R2-15 item 5) | I-M2-03, ruling |
| F-CANVAS-14 | pass | The fluid display size follows the frame, not the window: with the `marketing` context, the computed `font-size` of a display heading differs between the 360 and 1280 frames at the same viewport width, and equals the `clamp` evaluated at the frame's width | ruling |
| F-CANVAS-15 | pass | A canvas element that takes focus (a preview checkbox, a tab) has a computed `outline-color` equal to the canvas's `--ring`, never madder `#f66c6d`; the chrome's own outline rule does not apply inside `[data-canvas]` | ruling |
| F-CANVAS-16 | pass | The canvas loads the spec's display, body and mono families from `/fonts/<id>/` with `fontLoader.load` (the FontFace API), and loads the new families when the pairing changes; a family outside the catalog loads nothing, keeps its fallback stack and raises no error | decision, R2-27 |
| F-CANVAS-17 | pass | At 1280 × 800 the canvas toolbar takes at most 3 rows (distinct top edges of its items) and its height is at most 150 px; the frame switcher's group has an accessible description that holds the fit ("fit 43%") | ruling, review |
| F-CANVAS-18 | pass | Every target of the canvas toolbar (buttons, radios' labels, selects, switches) is at least 28 px tall and 24 px wide, at 1280 × 800 and at 360 × 740 with the "View" disclosure open | ruling, review |
| F-CANVAS-19 | pass | Below 640 px the "View" button sits where the mode toggle was, with `aria-expanded="false"` and `aria-controls` naming the group, and the five view controls are hidden; at 360 × 740 the closed toolbar is at most 170 px tall; Enter and Space on the button open and close the group and focus stays on the button; the Tab order is Inputs, Inspector, frame, template, "View", then the mode toggle, density, "Reduce motion", copy and vision when open, then Undo, Redo, Copy link; Alt+T flips the mode with the group closed or open | ruling, review |

### 7.5 The kitchen sink (Task 2.7)

The kitchen sink shows the light and dark canvases side by side (two `[data-canvas]` elements, one per mode) and, per
canvas: all 46 roles as swatches with name, hex and, for text pairs, the measured ratio; all 10 type steps; all 6 radii; all
5 shadows; the 7 durations and 4 easings as live demos; and every kit component in every state.

The kit components: button (primary, secondary, ghost, destructive, link), input, textarea, select, checkbox, radio,
switch, tab, menu item, table row, interactive card, badge, alert, tooltip, dialog, sheet, toast, avatar, chip, skeleton,
progress. The states: default, hover, focus-visible, pressed, selected, indeterminate, disabled, read-only, loading,
invalid, success, placeholder, empty, as the component supports them. A forced state uses `data-state`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| F-TPL-01 | pass | The kitchen sink renders every role, every type step, every radius, every shadow and every motion token, in both modes | plan |
| F-TPL-02 | pass | Every swatch's printed hex equals the spec's stored hex; every printed ratio equals `wcagRatio` of its pair to two decimals | plan |
| F-TPL-03 | pass | Every kit component renders in every state it supports, each marked with its `data-state` and a visible label, and each forced state paints differently from the component's `default`; under 480 px of frame the readings table renders as stacked records (the place, then Observer, Reading and State as labeled pairs) and leaves the accessibility tree, and every row's state label stays on screen; the two readings tables share their columns (each header within 1 px of the other's), and a stacked empty record shows its label and its sentence on two lines with no separator | plan, review |
| F-TPL-04 | pass | The five button variants use `primary`, `secondary`, ghost (transparent fill, `foreground` text, `muted` on hover), `destructive` and link (`primary` text with an underline); each carries `data-roles` | R2-20 |
| F-TPL-05 | pass | Motion demos run at the printed duration and easing, and stop under reduced motion | plan |
| F-TPL-06 | pass | The kitchen sink fits the 360, 768 and 1280 px frames without horizontal overflow | plan |
| F-TPL-07 | pass | The kit uses icons from `lucide-react` only, each with `stroke-width` equal to `--icon-stroke` | decision |
| F-TPL-08 | pass | Concentric radii hold: an image inside a card with padding `p` has radius `max(0, card radius − p)` (computed), and a segmented control's outer radius equals its inner radius plus its padding | research D5 |
| F-TPL-38 | pass | Type triples: in both panes at the 1280 and 360 frames, every element on screen with its own text (outside an inert specimen) has the computed `font-size`, `line-height` and `letter-spacing` of one type step, resolved from a probe set from that step's three variables in the same pane; each `.kit-t-<step>` class sets exactly that triple, and no preview stylesheet or style object sets a step's size anywhere else (the `[data-canvas]` root keeps the body triple). Numbered after F-TPL-37 because F-TPL-09 is the landing page's | review |

### 7.6 The landing and editorial templates (Task 2.8)

Landing page "Saltmarsh", a tide-reading app, in sections: navigation; an asymmetric hero (the headline set large on the left,
one product moment on the right, two actions, one filled); features as a list beside a product moment; a quote with a named
fictional person; a pricing teaser; an FAQ (accordion); a footer. Copy is labeled "sample".

Editorial article "The long thread", an essay on natural dyes: H1 to H4, body at a 60 to 75 character measure, a blockquote, an
inline code span and a code block, a figure with a caption, footnotes, links (`primary` text, underlined), and a table of contents.

| Id | Kind | Case | Origin |
|---|---|---|---|
| F-TPL-09 | pass | The landing page renders in the 360, 768 and 1280 px frames without overflow (`scrollWidth` at most `clientWidth`) | plan |
| F-TPL-10 | pass | The editorial article renders in all three frames without overflow | plan |
| F-TPL-11 | pass | The editorial body paragraph measure is 60 to 75 characters: its computed `max-width` divided by the width of `1ch` in its font falls in [60, 75] | plan, research D1 rule 19 |
| F-TPL-12 | pass | Both templates pass axe with zero violations in light and in dark, at 360 and at 1280 px | plan |
| F-TPL-13 | pass | The landing features block (`data-block="features"`) is a list beside a product moment and does not hold three or more siblings of equal size that each hold an icon; the same check passes on the dashboard's KPI row, which does not hold three or more equal icon cards | plan, decision |
| F-TPL-14 | pass | No element in either template has `background-clip: text` with a transparent text fill (no gradient text) | plan, decision |
| F-TPL-15 | pass | No text node in any template holds an emoji or other pictograph (`\p{Extended_Pictographic}`), and icons are `lucide-react` SVGs | decision |
| F-TPL-16 | pass | The landing page has no logo row, no "trusted by" text and no hero-metric block; sample content carries the label "sample" | decision |
| F-TPL-17 | pass | Each template has exactly one orchestrated entrance (`data-entrance` appears once) and it does not run under reduced motion | decision |
| F-TPL-18 | pass | The landing page has one `h1`; headings descend without gaps; the article's H1 to H4 exist in order | plan |
| F-TPL-19 | pass | Radius and spacing vary by hierarchy: the landing page uses at least three distinct radius tokens and three distinct spacing tokens in its computed styles | decision |
| F-TPL-20 | pass | The editorial template shows links as `primary` text with an underline (there is no link role and no visited style), and its selection uses the spec's `--primary` and `--primary-foreground` | research D5, ruling |
| F-TPL-21 | pass | The FAQ accordion opens and closes by keyboard, with `aria-expanded` | I-M2-03 |

### 7.7 The dashboard, settings and mobile templates (Tasks 2.9 and 2.10)

Dashboard, "Saltmarsh's console": a sidebar (the sidebar roles); a header with a command button labeled "Search or run a
command" and the shortcut hint; KPI values in Geist-like tabular numerals; an SVG chart in `chart-1` to `chart-5`; a dense table
with numeric columns; filters; a toast; an empty panel. Settings: every input type (text, email, password, number, textarea,
select, checkbox, radio, switch, slider, date, color) in the states default, focus, invalid, valid, disabled, read-only;
a danger zone with a destructive button that opens a confirm dialog; a sticky save bar. Mobile: three 360 px frames, a feed, a
detail with a bottom sheet, and a tab bar.

| Id | Kind | Case | Origin |
|---|---|---|---|
| F-TPL-22 | pass | The dashboard chart paints only with `--chart-1` to `--chart-5`: every `fill` and `stroke` in the SVG computes to one of the five role hexes or to a neutral role used for axes | plan |
| F-TPL-23 | pass | KPI values and numeric table cells have `font-variant-numeric: tabular-nums` | plan, decision |
| F-TPL-24 | pass | The dashboard's table is dense: row height follows `--control-height` and the density toggle changes it | decision |
| F-TPL-25 | pass | The dashboard renders in all three frames without overflow, and the sidebar collapses by container query below 768 px | plan |
| F-TPL-26 | pass | The dashboard shows a toast (`role="status"`) and an empty panel with a title, a sentence and one action | decision |
| F-TPL-27 | pass | The dashboard and settings pass axe in light and dark at 1280 px | plan |
| F-TPL-28 | pass | The settings page renders every input type listed, each with a visible label | plan |
| F-TPL-29 | pass | Every validation state renders for the text input: default, focus, invalid (message below, `aria-invalid`, `aria-describedby`), valid, disabled, read-only | plan |
| F-TPL-30 | pass | The danger zone's destructive button opens a confirm dialog (`role="alertdialog"`) with "Cancel" and a destructive action; Escape closes it | research D1 (Nielsen) |
| F-TPL-31 | pass | The sticky save bar stays visible after the settings scroll area scrolls to its end (its bounding box is inside the frame's viewport) | plan |
| F-TPL-32 | pass | The mobile template shows three 360 px frames whatever the frame switcher says; the switcher is disabled with the label "Three 360 px screens" | decision |
| F-TPL-33 | pass | In the mobile frames every button, link, tab and input has a hit area of at least 44 × 44 px | plan |
| F-TPL-34 | pass | The detail frame's bottom sheet opens and closes by button and Escape; it uses `--shadow-4` and `--radius-2xl` on its top corners | decision |
| F-TPL-35 | pass | The mobile tab bar is a `tablist` with roles and selection state, reachable by keyboard | I-M2-03 |
| F-TPL-36 | pass | The mobile template passes axe in light and dark | plan |
| F-TPL-37 | pass | Every template stays free of the anti-slop list's other items: no card or alert whose left border differs in color from its other sides at 2 px or more, no `background-clip: text`, at most one section group animates on mount (at most one element carries `data-entrance`), one icon library and one `stroke-width` | decision |

### 7.8 The inspector (Task 2.10)

The inspector has five sections, each a labeled region with a heading: "Scales", "Roles", "Names", "Findings", and
"Preset notes" (shown when a preset's `guards` or `unexpressed` lists are non-empty). A message `role="status"` sits at the
top for font failures.

| Section | Contents |
|---|---|
| Scales | The 8 palettes, each as an 11-step strip for the current mode. A step shows its number, hex and WCAG ratio against the page (`contrast`), in Geist Mono. A palette with `seedDeviation` shows "Seed moved ΔE <n> at step <step>". A locked seed's `seedStep` is marked |
| Roles | The 32-row table of 6.9 with, for both modes, the two hexes, the ratio to two decimals, the pass level, and the signed advisory score with the word "advisory" in the column header |
| Names | The color names of the 8 palettes' light step 500 and of `chart-1` to `chart-5`, loaded lazily |
| Findings | Counts per severity, then groups "Errors", "Warnings" and "Info"; each finding shows its title, subject, mode, measured against threshold and source, a "Show me" button and, where `fixFor` returns one, a fix button |
| Preset notes | The preset's guard notes and its `unexpressed` list |

| Id | Kind | Case | Origin |
|---|---|---|---|
| F-INSP-01 | pass | The inspector shows all 8 scales with 11 steps each, and each step's contrast equals the spec's `contrast` to two decimals | plan |
| F-INSP-02 | pass | The role table shows 32 rows; for each row and each mode the WCAG ratio, the pass level and the signed advisory score equal `roleRows(spec)` | plan |
| F-INSP-03 | pass | The advisory score shows its sign: `+` for positive, `−` (U+2212) for negative, and the column header says "advisory" | plan, decision |
| F-INSP-04 | pass | Color names appear for the 8 palettes and the 5 chart colors once the lazy list loads. The list's chunk is absent from the page's initial requests; the request starts after first paint, when the Names section is shown, and the section reads "Loading names" until it arrives | plan, decision |
| F-INSP-05 | failure | When the name list fails to load, the Names section says "Names unavailable. The rest of the inspector works." and nothing else breaks | I-M2-03 |
| F-INSP-06 | pass | Findings group by severity with a count each, in the linter's order; with no findings the section says "No findings." | plan |
| F-INSP-07 | pass | "Show me" on a pair finding outlines the elements with those roles on the canvas; on a step finding it outlines the scale cells in the inspector and scrolls them into view | plan, decision |
| F-INSP-08 | pass | A taste finding appears: a spec opened through a link with display family `geist` shows a T1 warning titled "Overused display font", and a locked-seed-free purple primary shows T2 | decision |
| F-INSP-09 | pass | A fix action regenerates the design at the fix's contrast level and clears the finding it fixes (the tampered-link F1 fixture of C-INSPECT-04: "Raise contrast to AAA"); the button label names the level and the inspector note says the colors are regenerated | plan, ruling |
| F-INSP-10 | pass | At contrast level AAA a C5, N1 or F1 finding (from a tampered link) shows the note "Contrast is already AAA." and no fix button, because `fixFor` returns `null` (R2-10) | ruling |
| F-INSP-11 | pass | RF3: when a family fails to load (the font request is aborted by the test), the inspector shows "<Family> did not load. The canvas uses <first fallback font> instead." with `role="status"`; the canvas keeps rendering with the fallback stack and does not overflow its frame | RF3, plan |
| F-INSP-12 | pass | RF3: the same font failure leaves `document.documentElement.scrollWidth` at most the viewport width and the canvas's layout shift (CLS measured through the Layout Instability API) at most 0.1 | RF3 |
| F-INSP-13 | pass | The preset notes list the selected preset's guards and unexpressed items, and the section is absent for `default` | ruling |
| F-INSP-14 | pass | The inspector scrolls inside its column (or drawer) and every control in it is reachable by keyboard | RF5 |

### 7.9 Accessibility and the home page

| Id | Kind | Case | Origin |
|---|---|---|---|
| F-A11Y-01 | pass | axe finds 0 violations on `/` and on `/studio`, in the default state and with each drawer open at 360 px | decision |
| F-A11Y-02 | pass | Every interactive element in the chrome has a hit area of at least 24 × 24 px and an accessible name | decision |
| F-A11Y-03 | pass | Every focusable element outside `[data-canvas]` shows a 2 px madder focus ring (`outline`) with at least a 3:1 change against its neighbor; inside the canvas the ring is the spec's `--ring` | decision, ruling |
| F-A11Y-04 | pass | The chrome stays achromatic: no computed color outside `[data-canvas]` has a chroma above 0.02 except the house neutral `:root` tokens (`--fg-muted`, `--border`, `--border-bright`, `--panel`, tinted greys of chroma 0.016 to 0.037), madder on focus rings and the primary action (`data-primary`), and the data swatches (elements with `data-swatch`: the lot strip, seed swatches, scale cells), which show spec colors by design; a selected or pressed control is neutral | decision, ruling, review |
| F-A11Y-05 | pass | At 360 px no route scrolls horizontally | RF5, plan |
| F-A11Y-06 | pass | With `prefers-reduced-motion: reduce`, the chrome's own transitions (drawers, toasts) run at 0.01 ms or less | decision |
| F-A11Y-07 | pass | Chrome text meets 4.5:1 and chrome non-text parts meet 3:1 against `#0a0a0a` and `#12121a` (a measured pass over the chrome's own tokens) | decision |
| F-A11Y-08 | pass | On `/studio` the surround behind the shell is achromatic: every color stop of `body::before`'s background image (the house dot grid) has a chroma of 0.005 or less, so the M0 madder crown does not tint the toolbar or the canvas surround; the home page keeps its crown | decision, review |
| F-A11Y-09 | pass | WCAG 1.4.11: at 1280 px and at 360 px (with the inputs drawer open), every form control of the chrome (text and hex fields, color inputs, selects, segmented groups, lock toggles, the mode switch's track) has a border, and its border color has a contrast of at least 3:1 against the background it sits on (the nearest ancestor with an opaque background) | decision, review |
| F-HOME-01 | pass | The home page keeps its single `h1` and gains a link "open the studio" with `href="/studio"`, in the list beside the GitHub link | decision, ruling |
| F-HOME-02 | pass | Following the link opens `/studio` | decision |

## 8. Review Focus coverage

Each row lists the cases that carry the item. Every case with the item's tag in its Origin column covers it too.

| # | Review Focus item | Cases |
|---|---|---|
| RF1 | A tampered, truncated or future-version link opens the studio with a labeled banner and a "start fresh" action, never a blank page | Pure: C-HASH-03 to C-HASH-07, C-HASH-10, C-HASH-14, C-HASH-16, C-STORE-22. e2e (Task 2.6, R2-18): F-STUDIO-09, F-STUDIO-10, F-STUDIO-11, F-STUDIO-12 |
| RF2 | Storage unavailable skips drafts and the studio works | C-DRAFT-03, C-DRAFT-04, C-DRAFT-08, C-DRAFT-10 (the throwing storage stub), F-STUDIO-17 |
| RF3 | A font that fails to load falls back to its stack with no layout break, and the inspector says so | C-LOAD-05, C-LOAD-06, C-LOAD-07 (the failing `FontFace.load`), F-INSP-11, F-INSP-12 |
| RF4 | Rapid edits never leave the canvas on a stale spec | C-WORK-03, C-WORK-04, C-WORK-05 (out-of-order replies), C-STORE-14, F-KEY-02 |
| RF5 | Keyboard-only and 360 px use: every control reachable, panels become drawers, no horizontal scroll | F-STUDIO-04, F-STUDIO-05, F-KEY-11, F-KEY-12, F-INSP-14, F-A11Y-05 |

## 9. Deferred

| Item | Comes from | Milestone |
|---|---|---|
| Brief box, image drop, import | umbrella §8 | M4 (image) and later (AI, import) |
| Export bundle, `theme.css`, `Mod+E`, the receipt | umbrella §8, §9 | M3 |
| Increased-contrast canvas toggle | umbrella §8, research D5 | Not scheduled |
| `<ViewTransition>` morphs | umbrella §8 | M5 |
| Taste rules for type-size count, measure and decorative glass | umbrella §6 | Not scheduled |
| A fix for K3, and a fix for K4 | decision, R2-10 | When K3 exists in the linter |
| Density, canvas view and copy toggles in the share link | R2-07 | Not scheduled; the link holds the spec only |
| Hard offset shadows, blur, grain and the other `unexpressed` style traits in the spec | R2-06 | M3 (spec fields) |
| P1 and P2 templates (auth, pricing, product page, docs, states, charts page, email) | research D5 | Not scheduled |
| Anomalous color-vision severities | M1 spec §8 | Not scheduled |
| The `MONO` axis, `wdth`, `opsz` and `ROND` axes of the catalog's families (M2 copies the `wght` file only) | R2-03 | Not scheduled |
| A fix for the taste rules T1 to T4 | R2-26 | Not scheduled |
| Fonts beyond the 40 families | umbrella §6 ("about 40") | Not scheduled |
| Drafts do not restore the preset's view settings (mode, density); after a reload a dark preset shows a light canvas until toggled | R2-06, R2-13 item 7, Task 2.6 | Revisit with M6 polish |

## 10. Done when

- Every case in sections 6 and 7 has a test, and every `failure` case fails in the way its row says.
- `pnpm lint && pnpm typecheck && pnpm vitest run --coverage && pnpm build && pnpm test:e2e` passes with the folder floors
  met: lines, statements and functions 95, branches 90, on `src/engine/**`, `src/spec/**` and `src/theme/**`.
- Every M1 case and golden still passes (I-M2-08).
- `docs/specs/00-design.md` carries an in-place note, starting "Refined in M2", at each row of the table in section 1.
- The README states M2 as done with measured claims only: counts of cases, the measured coverage and the measured findings.
- The home page links to `/studio`, and `sitemap.xml` lists it.
