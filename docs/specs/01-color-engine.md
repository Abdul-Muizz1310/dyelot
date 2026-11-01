# 01 · The color engine, spec model and linter (M1)

> Source note: this milestone spec refines `docs/specs/00-design.md`, the umbrella. Paths to `docs/research/`,
> `docs/plans/` and `knowledge/` point into the private `repos` meta-repo.

Status: written 2026-11-01 as Task 1.1 of the M0–M1 plan, and revised twice the same day: after the owner ruled on four
conflicts, and after a spec review. Section 2 copies the plan's decisions word for word, and they include those rulings.
Section 3 keeps the evidence behind the four rulings. Section 4 lists rulings that close gaps in the decisions; the
owner can overturn any of them by editing this file before the task that uses it starts. Tasks 1.2 to 1.9 implement
against the cases in section 6.

## 1. Purpose and scope

M1 builds the pure core of dyelot. A TypeScript engine in `src/engine/` turns a few parameters into a complete,
measured design system. A spec model in `src/spec/` holds that system, gives it a stable identity and packs it into
a share link. A linter checks the result against measured rules. Nothing in M1 touches the DOM, React, the network
or storage. Later milestones only compose and render what M1 computes.

```text
DirectionParams + seed --generateSystem--> DesignSpec --lintSpec--> Finding[]
DesignSpec --canonicalize--> canonical string --specId--> 16 hex characters
DesignSpec --encodeSpec--> share link --decodeSpec--> DesignSpec (or SpecDecodeError)
```

M1 delivers, in the order of the plan's tasks:

| Task | Delivers |
|---|---|
| 1.2 | Color types, `parseColor`, OKLCH and sRGB and Display P3 conversion, CSS Color 4 gamut mapping |
| 1.3 | WCAG contrast, the advisory perceptual score, ΔEOK, color-vision simulation |
| 1.4 | `seededRandom` and the OKLCH harmonies |
| 1.5 | The contrast-solved 11-step scale, the nearest-hex picker, the even-chroma variant, `UnsatisfiableTargetError` |
| 1.6 | Palettes, seed preservation, the role table, `onFill`, chart colors |
| 1.7 | Type, space, shape, depth and motion tokens |
| 1.8 | The `dyelot.spec/1` schema, canonical form, spec id, share-link codec, `generateSystem` |
| 1.9 | The color linter with 20 rules |

M1 does not deliver the studio, any export file, any AI path, the image-to-palette pipeline, color names, presets,
fonts or the taste rules. Section 8 assigns each deferred item to a milestone.

### Where this spec refines the umbrella

The umbrella says a milestone spec may refine it but must say where. These are the places.

| Umbrella | This spec | Why |
|---|---|---|
| §5 Scales: yellow and amber drift 30–50° | `drift(h) = 40 × clamp(1 − abs(h − 90) / 35, 0, 1)` degrees over the 11 steps | The plan fixes one formula |
| §5 Scales: dark targets solve against L 0.18 | The dark page is the neutral hue at `oklch(0.18, min(0.012, Cneutral), h)`; dark chroma uses a factor of 0.85 | The plan fixes the page and the factor |
| §5 Color blindness: Machado for anomalous severities | Viénot (protan, deutan) and Brettel (tritan) at severity 1 only | Anomalous severities are out of M1 |
| §5 Generators: cosine, Poline, Sanzo Wada | OKLCH harmonies only | Deferred (section 8) |
| §5 Linter: 20 rules, each finding with a fix | 20 listed rules (section 6.8); `Finding` has no `fix` | Research rules C3, K3, U1, S3 and G2 are not in the plan's list; fixes arrive with the studio inspector |
| §6 Type: dense 1.125–1.2, product 1.2–1.25 | Dense 1.2, product 1.25 | The plan fixes one ratio per context |
| §3 State: the hash carries the canonical spec | The link also carries an 8-byte integrity trailer and size guards (R-22) | Raw deflate cannot detect tampering |
| §4 Spec: every listed field | The schema leaves out fields with no M1 source (R-19) | M2 and M3 add them |
| §13 Engine: every solved step within 0.01 of its target | A non-threshold step within `max(0.05, 0.01 × target)`; a threshold step meets 3.0, 4.5 or 7.0 and overshoots by at most 0.12; the hex is the nearest of the surrounding 8-bit hexes (X-1) | One 8-bit code step moves a high-step ratio by up to about 0.1, and a threshold forces one side of it |
| §4 Spec: values stored once in OKLCH, hex derived on export | A solved step also stores the hex that the solver picked and measured; exporters emit that stored hex and never re-derive it (R-01) | A re-derived hex can differ by one code per channel and drop a threshold step under its ratio |
| §5 Roles: text on a fill takes whichever of white or black wins on WCAG | When both reach WCAG 4.5, `onFill` takes the larger `abs(perceptualLc)`; one passing candidate decides alone (R-15) | On the fill `#4775ca` white scores WCAG 4.501 and black 4.665, but `abs(Lc)` is 76.5 for white and 33.1 for black, so white wins. Every solved light primary-600 sits in this zone |
| §5 Scales: `even` mode equalizes chroma across hues | Even mode works in groups: the four status palettes always form their own group; primary and accent share one when their peak chroma is equal; secondary and neutral stand alone (R-11) | Status chroma stays independent of the `chroma` parameter, and the 0.6× secondary and the neutral cannot drag the other hues down |
| §5 Generators: neutrals take the brand hue at chroma 0.005–0.02 | A tint table: none 0, warm 0.012 at hue 60, cool 0.012 at hue 250, brand 0.010 at the primary hue | The plan fixes four tints |
| §6 Type: all caps +0.05 to +0.12 em | Not generated in M1 (section 8) | Deferred to M2 |

## 2. Decisions M1 implements

This section copies the plan's decisions word for word. Every number is exact. Sections 3 and 4 add to it and
never change it.

- **Steps** `50 100 200 300 400 500 600 700 800 900 950`. **Targets** (contrast against the mode's
  page): `1.06 1.15 1.32 1.65 2.2 3.0 4.5 7.0 9.5 12.5 15.5`. Threshold steps 500, 600, 700 are solved
  for `target + 0.02` and must meet `3.0 / 4.5 / 7.0` on the emitted hex, overshooting by at most 0.12
  (the 8-bit grid can force that much at step 700: worst seen 0.087); other steps land within
  `max(0.05, 0.01 × target)` of their target. The solver picks, among the 8-bit hexes around its
  solution, the one nearest the target (a threshold step: the nearest one that meets its threshold).
- **Pages:** light `#ffffff`; dark = the neutral palette's hue at `oklch(0.18, min(0.012, Cneutral), h)`.
  Light scales darken away from the page, dark scales lighten away from it; step numbers keep their
  jobs in both modes.
- **Chroma envelope** `0.12 0.22 0.40 0.62 0.85 1 1 0.90 0.75 0.60 0.45`, times the palette's peak
  chroma, capped at `0.97 × maxChroma(L, h, gamut)`; dark mode multiplies the peak by `0.85`.
- **Hue drift:** `drift(h) = 40 × clamp(1 − |h − 90| / 35, 0, 1)` degrees; step index `i` (0..10) uses
  `h − drift(h) × i / 10`. Only yellows and ambers move.
- **Peak chroma by `chroma` param:** muted `0.08`, balanced `0.14`, vivid `0.22`. Neutral palette
  chroma by `neutralTint`: none `0`, warm `0.012` at h 60, cool `0.012` at h 250, brand `0.010` at the
  primary hue.
- **Harmony** (OKLCH hue of primary `h₀`): monochrome `[h₀]`; analogous secondary `h₀−30`, accent
  `h₀+30`; complementary accent `h₀+180`; split accent `h₀+150`, secondary `h₀+210`; triadic `h₀±120`;
  tetradic `h₀+60`, `h₀+180`, `h₀+240`. Secondary uses `0.6 ×` peak chroma.
- **Status hues:** success 150, warning 70, danger 25, info 250, at a fixed peak chroma of 0.14 whatever
  the `chroma` param. **Status steps** (so lightness separates them for color-blind readers): warning
  **500**, danger **600**, info **700**, success **800** (measured min ΔEOK 0.086 light, 0.094 dark).
- **Role table** (identical step numbers in both modes; `onFill(x)` defined below):

  | Role | Source | Role | Source |
  |---|---|---|---|
  | background | page | foreground | neutral-950 |
  | card, popover, sidebar | neutral-50 | card/popover/sidebar-foreground | neutral-950 |
  | primary, sidebar-primary | primary-600 | primary-foreground, sidebar-primary-foreground | onFill(primary-600) |
  | secondary | secondary-100 | secondary-foreground | secondary-900 |
  | muted, sidebar-accent | neutral-100 | muted-foreground | neutral-700 |
  | accent | accent-100 | accent-foreground | accent-900 |
  | sidebar-accent-foreground | neutral-900 | destructive | danger-600 |
  | destructive-foreground | onFill(danger-600) | success · warning · info | status steps above |
  | `<status>-foreground` | onFill(that fill) | `<status>-subtle` / `-subtle-foreground` | x-100 / x-900 |
  | `destructive-subtle` / `-subtle-foreground` | danger-100 / danger-900 | | |
  | border, sidebar-border | neutral-200 | input | neutral-600 |
  | ring, sidebar-ring | primary-600 | chart-1…5 | `pickChartColors` |

  Contrast level **AA+** moves muted-foreground to 800; **AAA** also moves primary to 700 and ring and
  input to 700. Destructive stays on danger-600 at every level so the status set keeps its lightness
  ladder (at AAA, danger-700 collides with info-700: ΔEOK 0.030); where 7:1 text is required, the
  subtle destructive pair carries it. (Ring and input sit at 600 so they keep 3:1 against card and
  muted surfaces, not only the page: measured 4.24 and 3.91 in light mode.)
- **`onFill(fill)`:** candidates `#ffffff` and `#000000`; keep those with WCAG ≥ 4.5 against the fill;
  if both pass, pick the larger `|perceptualLc(candidate, fill)|`; if one passes, pick it; if none,
  pick the higher WCAG and let lint rule C5 report it.
- **Seed preservation** (each mode's scale separately): gamut-map the seed to the spec's gamut, then try
  steps in order of `|L − Lseed|`; the seed replaces the first step where L stays strictly monotonic and
  that step's threshold (if any) holds on the seed's hex, and the palette records `seedStep`. If the seed
  had to be gamut-mapped, or no step accepts it, the palette also records
  `seedDeviation: { step, deltaEOK }` (ΔEOK from the original seed; `step` is where the nearest color sits).
- **P3 mode:** chroma may reach the P3 maximum, but contrast is solved and guaranteed on the sRGB hex;
  P3-rendered contrast checks arrive with the M3 exports.
- **Chart colors:** greedy pick of 5 from candidates (hues every 15°, steps 600–900, in gamut, so every
  mark keeps 3:1 against page and card; measured 0.106 for primary hue 262), first
  pick primary-600, each next pick maximizing the minimum ΔEOK to the chosen set under none, protan,
  deutan and tritan simulation; ties break by lower hue then lower step. Must reach ≥ 0.08.
- **CVD:** severity 1 only, in linear RGB, clamped: Viénot (protan, deutan) and Brettel (tritan) with
  the matrices in `cvd.py` (`VIENOT`, `BRETTEL`). Anomalous severities are out of M1.
- **Non-color tokens:** type scales by context (dense 14 px / 1.2; product 16 / 1.25; marketing and
  editorial fluid 18→20 px at 1.2→1.25 between 360 and 1240 px viewports, display steps only;
  poster 18 / 1.5), step exponents of the ratio from body: caption −2, label −1, body-sm −1, body 0,
  lead 1, h4 1, h3 2, h2 3, h1 4, display 5; line-height multipliers caption 1.4, label 1.4, body-sm
  1.45, body 1.5, lead 1.5, h4 1.4, h3 1.33, h2 1.25, h1 1.2, display 1.1, then snapped to 4 px; tracking
  `−0.0223 + 0.185 × e^(−0.1745 × px)` em clamped to [−0.04, 0.05]; space base 4 px, scale
  `0 1 2 3 4 6 8 12 16 20 24 32` × base; radius sets sharp `0 2 4 6 8`, soft `4 8 12 16 24`, round
  `8 12 16 24 32` px plus `full`; nested radius `max(0, outer − padding)`; shadows: per elevation L
  (1–5) a key layer `offsetY 2L, blur 4L, alpha 0.10` and an ambient layer `offsetY L, blur 2L, alpha
  0.06`, both colored by the neutral-950 hue; motion: durations
  `50 100 150 200 300 400 500` ms, easings standard `[0.2,0,0,1]`, decelerate `[0,0,0,1]`, accelerate
  `[0.3,0,1,1]`, emphasized `[0.05,0.7,0.1,1]`, springs snappy `{0.25 s, 0.1}`, smooth `{0.4 s, 0}`,
  bouncy `{0.5 s, 0.35}` (visual duration, bounce).
- **Deferred from the umbrella's §5–§6** (record each in the M1 spec): cosine and Poline-style
  generators → M5 (shader backgrounds); Sanzo Wada combinations → M6 (gallery); image extraction → M4;
  color names, presets, the font catalog and the taste lint rules → M2.

## 3. Conflicts found and ruled

Writing the cases meant checking each plan expectation against the decisions and the reference code in
`docs/research/2026-11-design-studio/artifacts/color-check/`. Four expectations could not hold as first written. The
owner ruled on each, and section 2 now carries the rulings, so no case waits on them. This section keeps the evidence.

The measurements come from a Python port of `t10_proto.py` that follows section 2, and from `core.py` and `cvd.py`
unchanged. Unless a row says otherwise, light mode solves on `#ffffff` and dark mode on `#0f1216`, the emitted hex of
`oklch(0.18 0.01 262)`.

### X-1 · The contrast band at the high steps (ruled)

The plan asked every step to land within 0.05 of its target on the emitted hex. A solver that rounds its solution to one
hex misses that band at the high steps. Eight hues at peak chroma 0.20, bisection on L, rounding to the nearest hex and
taking the side of the step that meets the target, give these worst errors:

| Step | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|
| Light, worst error | 0.043 | 0.055 | 0.078 | 0.089 | 0.125 | 0.107 |
| Dark, worst error | 0.040 | 0.053 | 0.042 | 0.068 | 0.075 | 0.090 |

A gray scale (peak chroma 0) has only 256 levels. On white its nearest gray misses the target by 0.062 at step 800 and
0.050 at step 900. On the dark page its nearest gray that meets 4.5 misses by 0.061 at step 600.

**Ruling (now in section 2).** A non-threshold step lands within `max(0.05, 0.01 × target)` of its target. A threshold
step (500, 600, 700) meets 3.0, 4.5 or 7.0 and overshoots its nominal target by at most 0.12. The solver picks, among
the 8-bit hexes around its solution, the one nearest the target; a threshold step picks the nearest hex that still meets
its threshold. Neutral (zero-chroma) scales pass the same checks. The band does not apply to a threshold step, because
the threshold forces a choice between two hexes and the nearer one may sit below it.

**Result.** With the picker of R-06 (the floor and the ceiling of each channel, up to eight hexes), a sweep of 656 scales
covers 164 hues (every 6°, plus every 0.5° across 134–150, 158–170, 186–198 and 210–222, where the green channel is most
sensitive), peak chroma 0.14 and 0.35, and both modes:
- Every threshold step has a hex that meets its threshold. The worst overshoot is 0.0372 at step 500, 0.0510 at step 600
  and 0.0867 at step 700 (light, hue 144). That worst case is a grid effect: the solution sits at green code 103.74,
  the hexes with green 104 give 6.992 to 6.997 and fail 7.0, and the hexes with green 103 give 7.087 to 7.092 (the cap
  fixes the chroma at 0.1414 for every peak from 0.22 up). Applying the band to this step would fail it, which is why the
  ruling exempts the threshold steps.
- Every non-threshold step uses at most 0.615 of its band (step 800, light, hue 145.5, peak 0.35).
- Zero-chroma scales on `#ffffff`, `#0f1216` and `#121212` use at most 0.204 of the band and overshoot by at most 0.024.
  Near-gray peaks (0.005 to 0.05) use at most 0.367 and overshoot by at most 0.040. The eight test hues at peak 0.20 use
  at most 0.245 and overshoot by at most 0.049.
- P3 scales (peaks 0.20 to 0.35) use at most 0.538 of the band and overshoot by at most 0.052. Even scales for
  `[27, 150, 262]`, the four status hues and all eight test hues use at most 0.511 and overshoot by at most 0.065.

The off-gray hexes matter: gray hexes alone cannot reach the dark step-600 band, and hexes one code away from gray can.

### X-2 · `input` and `ring` against the card and the muted fill (ruled)

N1 asks `input` for 3:1 against the background and the card. F1 asks `ring` for 3:1 against the background, the card and
the muted fill. At step 500, solved for 3.02, the ratio to the card (neutral-50, target 1.06) is 3.02 / 1.06 = 2.85, and
to the muted fill (neutral-100, target 1.15) is 3.02 / 1.15 = 2.63. Both fall below 3. Measured on hue 262 at balanced
chroma, `input` against the card was 2.86 (light) and 2.83 (dark), and `ring` against the muted fill was 2.64 in both modes.

**Ruling (now in section 2).** `input` moves from neutral-500 to neutral-600, and `ring` and `sidebar-ring` move from
primary-500 to primary-600. At AAA, `ring` and `input` move to step 700 (they moved to 600 before).

**Result.** Measured on hue 262 at balanced chroma:

| Pair | Light, 600 | Dark, 600 | Light, 700 | Dark, 700 |
|---|---|---|---|---|
| `input` against card | 4.245 | 4.252 | 6.601 | 6.619 |
| `input` against muted | 3.914 | 3.914 | 6.085 | 6.092 |
| `ring` against card | 4.244 | 4.273 | 6.607 | 6.641 |
| `ring` against muted | 3.912 | 3.933 | 6.091 | 6.113 |

In dark mode the card sits above the page (step 50 solves on the lighter side, R-06), which keeps the dark values close
to the light ones. A dark card that sat below the page would inflate them (a ratio near 5.07 against the card).

### X-3 · The status indicators in light mode (ruled)

The plan expected success-700, warning-500, danger-600 and info-600 to differ by at least 0.08 under none, protan,
deutan and tritan. At the `chroma` parameter's value the smallest pairwise ΔEOK over the four views was:

| Status palette peak chroma | Light | Dark |
|---|---|---|
| 0.08 | 0.0672 | 0.0855 |
| 0.14 | 0.0476 | 0.0826 |
| 0.22 | 0.0254 | 0.0658 |

Light mode never reached 0.08 at any peak chroma from 0 to 0.26. At balanced chroma the light value sat below the S1
error floor of 0.05.

**Ruling (now in section 2).** The status palettes use a fixed peak chroma of 0.14 whatever the `chroma` parameter says.
The status steps become warning 500, danger 600, info 700 and success 800. The `-foreground` roles follow their fills
through `onFill`, and the `-subtle` and `-subtle-foreground` roles stay on steps 100 and 900 of each status palette.

**Result.** The smallest pairwise ΔEOK over the four views is 0.0855 in light mode and 0.0914 to 0.0940 in dark mode, across
dark pages of brand, gray, warm and cool tints. The weakest pair is success-800 against info-700 under tritan. `abs(ΔL)`
between danger-600 and success-800 is 0.202 (light) and 0.172 (dark), so S2 stays silent. Solving the four palettes with
`solveEvenScales` lowers the light minimum to 0.0815, so the guarantee covers standard scale mode only.

### X-4 · The chart candidates against the card (ruled)

N2 now asks each chart color for 3:1 against the page and the card. Candidates at steps 500 to 800 start at 3.02 against
the page, so step 500 reaches only 2.85 against the card.

**Ruling (now in section 2).** Candidates are hues every 15° at steps 600 to 900.

**Result.** Every pick keeps at least 4.50:1 against the page and 4.24:1 against the card. The greedy pick reaches a
smallest ΔEOK of 0.1059 (light) and 0.1132 (dark) for primary hue 270 at balanced chroma, and 0.0888 or more over 12 primary
hues, three `chroma` settings and both modes (R-13 fixes the candidate chroma at 0.14).

## 4. Rulings that close gaps in the decisions

The plan leaves some behavior open, and two of its statements needed a correction to hold together. Each ruling below
picks the smallest answer that makes the cases testable. The module sections cite them as R-nn.

**R-01 · `ScaleStep` fields.** `oklch` is the solver's continuous solution in the spec's gamut, before mapping to sRGB,
rounded as R-02 says. It keeps the exact hue and chroma of the formulas in section 2. `hex` is the hex that the picker
chose (R-06), one of the hexes around the sRGB mapping of the solution. `contrast` is `wcagRatio(hexToRgb(hex), page)`.
The `page` argument is the page's emitted color (`hexToRgb` of the page hex). Hue and chroma checks read `oklch`, never
the hue of the hex, because 8-bit quantization moves a hex's hue (1.7° at step 50 of hue 95, and more at lower chroma).
Each channel of a solved step's `hex` differs from `toHex(gamutMap(oklch, "srgb"))` by at most one code. So anything that
emits an sRGB value (exports, the receipt, the linter) uses the stored `hex` and never re-derives it from `oklch`: a
re-derived hex can move a channel by one code and drop a threshold step under its ratio. A seed step is the exception: its
`hex` is exactly `toHex(gamutMap(oklch, "srgb"))` of its stored `oklch`.

**R-02 · Canonical numbers.** `round6(x)` is `Number(x.toPrecision(6))`, with `-0` written as `0`. The solver, seed
placement and `generateSystem` apply it to every number they store. A stored hue goes through `roundHue(h)`, which is
`round6(h)` with a result of 360 written as 0: `round6(359.99999999999994)` is 360, and the schema takes hues in
`[0, 360)`. Two results follow. `canonicalize` changes nothing in a generated spec, and a share link restores the exact
spec, so `decodeSpec(encodeSpec(s))` deep-equals `s`. Without this the plan's round-trip property fails, because
`canonicalize` rounds to 6 significant digits and a generated spec holds full doubles. `round6` and `roundHue` live in
`src/engine/round.ts`.

**R-03 · Achromatic colors.** A color is achromatic when `c ≤ 4e-6`. Achromatic colors carry `h: null` and chromatic
colors carry a finite `h` in `[0, 360)`. For stored values the test runs after rounding: the engine rounds `c` with
`round6` first and then compares, so the engine stores a chroma of 4.0000004e-6 as `4e-6` with `h: null`. `parseColor` applies the
rule to what it parses: `oklch(0.6 0 120)` gives `h: null` and `oklch(0.6 0.1 none)` gives `h: 0`, because CSS reads a
missing hue as 0 in a conversion. `buildPalettes` applies the rule to a locked seed before it uses or stores it, after
rounding, so a seed passed as `{ l: 0.6, c: 0, h: 120 }` becomes `{ l: 0.6, c: 0, h: null }`.

**R-04 · Parse grammar.** `parseColor` accepts these forms and nothing else. `ws` means one or more of space, tab,
carriage return and line feed, and `ws?` means zero or more:
- hex `#rgb`, `#rgba`, `#rrggbb` and `#rrggbbaa` in any case. The parser reads the alpha pair and drops it, because
  `Oklch` has no alpha;
- `rgb(` `ws?` r sep g sep b `ws?` `)`, where `sep` is `ws` (the space form) or `ws?` `,` `ws?` (the comma form), one
  form per string. Each channel is a number from 0 to 255; the parser allows decimals and rejects percentages;
- `oklch(` `ws?` L `ws` C `ws` H `ws?` `)`, with L a number from 0 to 1 or a percentage from 0% to 100%, C a number from 0
  to 0.5, and H a finite number (any value, normalized into `[0, 360)`) or `none`.

The parser ignores `ws` around the whole input. Function names are case-insensitive. Numbers use CSS number syntax.
Everything else throws `ColorParseError`: `/ alpha` parts, commas inside `oklch()`, percentages in `rgb()` or in chroma,
named colors, `hsl()` and `color()`. The error message quotes at most the first 80 characters of the input; `.input`
keeps the whole string.

**R-05 · Errors.** `parse.ts` exports `ColorParseError`, `scale.ts` exports `UnsatisfiableTargetError` and
`url-codec.ts` exports `SpecDecodeError`. Every other domain failure is a `RangeError` (a value outside its domain) or a
`TypeError` (a value of the wrong type), and the message names the argument. `Hex` values come from `toHex` and from
the schema only; tests may cast a literal with `as Hex`.

**R-06 · Solver bracket, hex picker and unsatisfiable steps.** The search on L runs on the reachable side of the page:
`[0, Lpage]` in light mode and `[Lpage, 1]` in dark mode. Contrast is not monotonic across the page's own lightness, so an
unbounded search can land on the wrong side. It bisects the contrast of the unquantized, gamut-mapped color, because a
quantized contrast is a step function with no solution between its jumps. After 50 iterations the picker takes the hexes
around the solution: for each channel of its sRGB mapping, the floor and the ceiling of 255 times the channel, clamped to
0–255, which gives up to eight hexes. It keeps the hex whose contrast is nearest the nominal target. On a threshold step
it keeps the nearest hex among those that meet the threshold (3.0, 4.5 or 7.0). A tie goes to the lexicographically
smaller hex. Hexes one code off gray fill the gaps between gray levels, which is how a zero-chroma scale passes the contrast checks:
a neutral step's `hex` can differ from gray by one code per channel while its `oklch` stays achromatic. A step is
unsatisfiable when the extreme color (black on a light page, white on a dark page) falls short of the step's nominal
target. `UnsatisfiableTargetError` reports the first such step in `STEPS` order, the input hue and the nominal target
(`7.0`, not `7.02`). When the extreme meets the nominal target but not the solved value, the step takes the extreme.

**R-07 · Hue drift arithmetic.** The formula in section 2 binds. `drift(95) = 40 × (1 − 5 / 35) = 34.286` (the plan's 34.29), so step
950 of hue 95 has hue 60.714 (the plan's 60.71). The first draft of Task 1.5 said "≈ 59 (95 − 36)". That was wrong arithmetic, and the plan now agrees with the formula.

**R-08 · Peak chroma per palette.** Primary and accent use the `chroma` parameter's value. The four status palettes use
0.14 whatever the parameter says (section 2). Secondary uses 0.6 times the parameter's value. Neutral follows the tint
table; with tint `none` the neutral takes the primary's hue, which never shows because its chroma is 0.

**R-09 · Achromatic seeds.** A locked seed with `c ≤ 4e-6` has no hue to anchor. Its palette takes hue 0 and peak chroma
0, so the scale is gray. With `neutralTint: "brand"`, an achromatic primary gives the neutral palette chroma 0.

**R-10 · Seed records.** The seed is gamut-mapped to the spec's gamut, then placed in each mode's scale by the rule in
section 2. The seed "had to be gamut-mapped" when its stored form, the rounded seed that `color.params` keeps, lies
outside the spec's gamut by more than 2e-4 in some channel: the tolerance of lint rule G1, not the 1e-6 of `inGamut`.
(This replaces the earlier wording, which tested the seed as passed with `inGamut`.) Only then does the engine map the
rounded seed and place the result; any other seed is placed as rounded. Rounding alone never counts: `round6` leaves a
locked `#0000ff` about 1.8e-6 outside `[0, 1]`, `#ff00ff` 4.9e-6, `#00ff00` 4.3e-5, and `#00fd1b`, the worst 8-bit color,
1.347e-4 (C-LINT-48, C-LINT-50), all inside 2e-4, so they record no `seedDeviation` and keep their hex (C-PAL-20).
Because the test reads the stored seed, a seed passed back in from a spec's `color.params` gets the same decision, and
regenerating from what a spec records gives the identical spec (C-GEN-13). `seedStep` is present when both modes place the seed. When a mode rejects it, that mode's scale stays as
solved, `seedStep` is absent and `seedDeviation` is present, even when the other mode placed the seed verbatim (C-PAL-09):
the type of `seedStep` needs both modes, and a consumer finds an accepted placement by looking for the seed's hex in that
mode's scale. `seedDeviation` describes the light mode, unless only the dark mode rejects the seed. Its `deltaEOK` is the ΔEOK between the original seed (before gamut mapping) and the color that
stands in for it. Its `step` is the step that holds that color, or, when no step accepted the seed, the step whose
color is nearest to the seed by ΔEOK. Locked secondary and accent seeds follow the same rule.

**R-11 · Even mode.** `buildPalettes` solves these groups with `solveEvenScales`: the four status palettes together,
always, so that status chroma never depends on the `chroma` parameter and C-STATUS-02 holds in even mode too; primary
and accent together when their `peakChroma` is equal, and each alone otherwise; secondary alone; neutral alone.

**R-12 · Harmony slots.** Complementary: secondary `h₀`, accent `h₀+180`. Triadic: secondary `h₀+120`, accent `h₀+240`
(the decisions' `h₀±120` in listed order). Tetradic: secondary `h₀+60`, accent `h₀+180`; the third hue, `h₀+240`, has
no slot in M1. Every other row follows section 2.

**R-13 · Chart candidates.** The picker solves the candidates with peak chroma 0.14 whatever the `chroma` parameter says,
at steps 600, 700, 800 and 900 (section 2). The first pick, primary-600, keeps the brand's own chroma. Steps from 600 up
keep every mark at 4.5:1 against the page and 4.24:1 against the card. At the brand's own chroma a `muted` palette with
a green primary separated the pick less (0.066 to 0.077, measured on steps 500 to 800). At 0.14 and steps 600 to 900 the
pick reaches 0.0888 or more for 12 primary hues, three chroma settings and both modes.

**R-14 · Roles.** The role table in section 2 yields 46 role names. Section 6.5 lists them. The `<status>` placeholder
means `success`, `warning` and `info`. The danger family is `destructive`, and it has its own subtle pair,
`destructive-subtle` (danger-100) and `destructive-subtle-foreground` (danger-900). That pair carries 7:1 text, because
`destructive` stays on danger-600 at every contrast level.

**R-15 · `onFill` selection.** `onFill` tries the candidates in the order `#ffffff`, `#000000`, and a tie on `abs(Lc)` keeps
white. With these two candidates the "none passes" branch cannot run: white passes for a fill luminance Y up to
0.18333 and black from 0.175, so the ranges overlap. The branch stays for a changed candidate list, and tests reach it
through `selectOnFill`, which takes the candidates as an argument.

**R-16 · Line heights.** Section 2 gives the multipliers: caption 1.4, label 1.4, body-sm 1.45, body 1.5, lead 1.5, h4
1.4, h3 1.33, h2 1.25, h1 1.2 and display 1.1. `lineHeightPx` is `4 × floor(size × multiplier / 4 + 0.5)`: the product,
snapped to the nearest multiple of 4 and rounded up on a tie. `size` is `sizePx`, or `maxSizePx` for a fluid step, so a
line height never falls below the font size at any viewport. Section 6.6 lists the results.

**R-17 · Type steps.** Only `display` is fluid, in the marketing and editorial contexts. Every other step of those two
contexts stays at the 360 px size (18 px base, ratio 1.2). The two contexts have the same sizes. `sizePx` is not
rounded. A `ratio` argument replaces the context's ratio at both viewport ends and must lie in `(1, 2]`. The clamp
string writes each number with `toFixed(4)`, trailing zeros kept.

**R-18 · Depth and motion tokens.** `shadows` returns six entries: index 0 is empty and indexes 1 to 5 are the
elevations. Each elevation holds `[key, ambient]` in that order. Every layer's `color` is the `neutral950` argument,
unchanged. `generateSystem` stores the full token sets whatever `depth` and `motion` say; it records the choice in
`depth.style` and `motion.feel`, and M2 and M3 decide what to emit.

**R-19 · Spec shape.** Section 6.7 gives the M1 shape. The schema leaves out the fields from umbrella §4 that have no M1 source:
`direction`, `meta.oneLiner`, type weights, the shape nesting rule, the dark surface ladder, and the motion
budget and reduced-motion policy. M2 and M3 add them as optional fields when they define the content. Schema objects
are strict, so a decoder rejects an unknown key. Optional fields are absent, never `undefined`.

**R-20 · Fixtures, defaults and bounds.** The plan says "default params" without defining them. M1 tests use
`DEFAULT_PARAMS` from section 5. These are test fixtures, not studio defaults; M2 owns those. `generateSystem` checks
its parameters at run time and throws `RangeError` naming the field. Bounds: `meta.name` 1 to 80 characters,
`meta.seed` 1 to 128, policy strings 1 to 64, each `rules` list at most 20 entries of at most 200 characters.

**R-21 · Canonical form and spec id.** `canonicalize` writes JSON with keys sorted at every level (by UTF-16 code
units), array order kept, `undefined` properties omitted, numbers passed through `round6`, no whitespace, and `null`
kept. A number under the key `h` or `hue` is a hue and goes through `roundHue` instead, so an imported hue in
`[359.9995, 360)` writes as 0 and the spec still passes the schema, where `round6` would write 360. It throws
`RangeError` on a non-finite number; `JSON.stringify` would write `null` there. A value JSON cannot carry (a function, a
symbol, a bigint, an `undefined` array item, an object that is not plain) or a cycle throws `TypeError`. `specId` is
FNV-1a 64 over the UTF-8 bytes of the canonical string, written as 16 lowercase hex digits. The UTF-8 bytes come from
fflate's `strToU8`, so the core needs no `TextEncoder`.

**R-22 · Share link format and guards.** The link is base64url without padding of `deflateRaw(utf8(canonical), level 9)`
followed by an 8-byte trailer: the FNV-1a 64 of the deflate-raw bytes themselves, big-endian. `decodeSpec` checks the
trailer before it inflates anything. Raw deflate has no integrity check, and a measurement shows the cost: with Node's
`deflateRawSync` at level 9 on a 22.7 KB prototype spec, 1,509 of 16,548 single-character substitutions (9.1%) still
inflated to valid JSON that differed from the original. A trailer over the inflated text would leave a second hole:
inflate ignores the padding bits of the stream's final byte, so a character change that flips only those bits decodes to
the identical spec. Of 300 test links, 270 had such a character, and 4,438 of the changes they allowed decoded
unchanged. Hashing the transmitted bytes closes both holes.

Every one-character change to a link throws `SpecDecodeError("corrupt")`. The decoder's order makes it so:
- **The last character's unused bits.** `decodeSpec` re-encodes the decoded bytes and compares them with the input, so a
  change that touches only those bits fails.
- **Any other change inside the payload.** A character carries six bits, so such a change alters one byte or two adjacent
  bytes of the decoded stream. FNV-1a 64 then differs from the stored trailer. One changed byte always changes the hash,
  because each step maps the state one-to-one. Two adjacent changed bytes cannot cancel: after the first the states differ
  by `δ × p` for the prime `p = 2^40 + 0x1b3` and a nonzero `δ` below 256, a gap far above the 2^8 that the next byte's
  XOR can close.
- **A change in the trailer, or across the join.** The trailer alone changes, so the recomputed hash no longer matches
  it. When the character spans the last payload byte and the first trailer byte, the recomputed hash differs from the
  original in its low 40 bits (the difference is `δ × p`, whose low 40 bits are `δ × 0x1b3`, nonzero), and the changed
  trailer byte is the top one, so the low bits of the stored trailer do not move.

Measurements agree. With the trailer over the deflate bytes: 0 of 300 links accept a change to the characters that
overlap the final deflate byte; over 6 links, every position and every other alphabet character (1,428,588 changes) gives
0 accepted; over 60 more links, every seventh position and the last 12 characters (2,087,064 changes) give 0 accepted;
and none of 18,904 truncated prefixes decodes. `decodeSpec` rejects a link longer than 65,536 characters before it
decodes, and stops inflating at 1 MiB, both as `corrupt`.

**R-23 · Finding semantics.** Section 6.8 fixes each rule's subjects, measured value, threshold and trigger. Findings sort
by severity (`error`, `warn`, `info`), then rule id, then mode (`light` first), then subject, each ascending. `source`
strings name the standard or the research note; none may contain the string "APCA".

**R-24 · Test environment and guards.** `tests/unit/engine/**` and `tests/unit/spec/**` run with `environment: "node"`.
Vitest 4 removed `environmentMatchGlobs`, so Task 1.2 configures this with `test.projects` (two projects sharing the
plugins and the alias) or with a `// @vitest-environment node` docblock at the top of each file. Task 1.2 also adds the
folder coverage floors. DOM use in the pure core then fails at run time, because `window` is undefined, and C-REPO-03
asserts it.

**R-25 · Shared helpers.** The plan's interfaces do not name ten small functions that the tasks share, so this spec
names them: `round6` and `roundHue` (`src/engine/round.ts`), `pickHex(solution, page, target, threshold?)` (`scale.ts`, the
picker of R-06), `pageFor(neutral, mode)` and `normalizeSeed(seed)` (`palette.ts`; the second checks a seed's domain and
applies R-02 and R-03, for `buildPalettes` and for `color.params` in Task 1.8), `minPairwiseDeltaE(colors)` (`deltae.ts`,
used by rule S1), `viewsOf(rgb)` and `minViewDeltaE(a, b)` (`deltae.ts`: a color's OKLab under each of the four views, and
the smallest ΔEOK of two colors over those views; `minPairwiseDeltaE` and chart picking both build on them, so the picker
and S1 measure alike), `selectOnFill(fill, candidates)` (`roles.ts`) and `fnv1a64(input)` (`hash.ts`, used by `specId` and
the link trailer; it hashes a string as UTF-8 and a `Uint8Array` as given).

## 5. Conventions and invariants

### Layout

| Task | Source | Tests |
|---|---|---|
| 1.2 | `src/engine/color/{types,parse,convert,gamut}.ts` | `tests/unit/engine/color/{parse,convert,gamut}.test.ts` |
| 1.3 | `src/engine/color/{contrast,deltae,cvd}.ts` | `tests/unit/engine/color/{contrast,deltae,cvd}.test.ts` |
| 1.4 | `src/engine/random.ts`, `src/engine/color/harmony.ts` | `tests/unit/engine/random.test.ts`, `tests/unit/engine/color/harmony.test.ts` |
| 1.5 | `src/engine/color/scale.ts`, `src/engine/round.ts` | `tests/unit/engine/color/scale.test.ts`, `tests/unit/engine/round.test.ts` |
| 1.6 | `src/engine/color/{palette,roles,chart}.ts` | `tests/unit/engine/color/{palette,roles,chart}.test.ts` |
| 1.7 | `src/engine/tokens/{type,space,shape,depth,motion}.ts` | `tests/unit/engine/tokens/*.test.ts` |
| 1.8 | `src/spec/{schema,canonical,hash,url-codec}.ts`, `src/engine/generate.ts` | `tests/unit/spec/*.test.ts`, `tests/unit/engine/generate.test.ts` |
| 1.9 | `src/engine/lint/{types,rules,index}.ts` | `tests/unit/engine/lint/*.test.ts` |

`src/engine/` never imports from `src/spec/` except `generate.ts`, which builds a `DesignSpec`. `src/spec/` may import
from `src/engine/`.

### Reading the cases

- **Kind.** `pass` is a valid input with an expected output. `failure` is an invalid input or a broken invariant with an
  expected typed error or finding.
- **Origin.** `plan` is a test that the plan's Step 1 lists. `RF1` to `RF5` is a Review Focus item. `decision` is a rule
  stated in section 2. `ruling` is a rule in section 4. `I-01` to `I-10` is an invariant from this section. `added` is a
  boundary or failure case that this spec adds.
- **Tolerances.** Hex channels ±1, OKLCH L and C ±0.001, H ±0.1° (compared only when C is above 4e-6). A contrast ratio
  compares on its full float, with no rounding. "≈" means these tolerances unless the case names another.
- **Property tests.** They use fast-check with the run counts stated in each case. A counterexample that fails once joins
  the file as a fixed example. A property that calls `generateSystem` sets its own timeout, because the Vitest default is
  30 s.
- **Environment.** Every engine and spec test runs in `node` (R-24).

### Test fixtures

M1 tests share these fixtures (R-20). They are not studio defaults.

```ts
const DEFAULT_PARAMS: DirectionParams = {
  harmony: "analogous", chroma: "balanced", neutralTint: "brand", gamut: "srgb",
  scaleMode: "standard", contrastLevel: "AA",
  type: { context: "product" }, radius: "soft", depth: "soft", motion: "brisk",
};
```

- `HUES` is `27 55 95 150 210 262 295 350`. `PEAK` is `0.20`.
- The light page is `#ffffff`. The dark scale page is the emitted hex of `oklch(0.18 0.01 262)`, written `DARK_PAGE`.
- `EXTREME_SEEDS` is `#fefefe`, `#010101`, `#808080`, `oklch(0.6 0 none)` and `oklch(0.98 0.35 110)`.

### Invariants

These hold for every function in M1. Individual cases test them; section 7 maps them to the Review Focus.

- **I-01 Purity.** `src/engine/**` and `src/spec/**` use no DOM or Node API, no `Math.random`, no `Date`, no `any` and no
  I/O. Equal inputs give deeply equal outputs on every platform. Randomness enters only through `seededRandom`.
- **I-02 Typed failure.** Every public function checks its input and throws a typed error: `ColorParseError`,
  `UnsatisfiableTargetError`, `SpecDecodeError`, or a `RangeError` or `TypeError` that names the argument. No function
  builds a value from bad input.
- **I-03 Finite numbers.** No function returns, stores or serializes NaN or ±Infinity. A non-finite input throws
  `RangeError`. `canonicalize` throws instead of writing `null`.
- **I-04 Achromatic hue.** For every `Oklch` that the engine returns or stores, `c ≤ 4e-6` if and only if `h === null`.
  Otherwise `h` is finite and in `[0, 360)`. For stored values the test runs after `round6`, and the engine stores a hue
  that rounds to 360 as 0 (R-02, R-03).
- **I-05 Emitted color.** Every contrast measurement uses the emitted color: the gamut-mapped value quantized to 8-bit
  hex, against the mode's page hex. A ratio of 4.499 fails 4.5. No comparison rounds.
- **I-06 Canonical numbers.** Every number stored in a spec has at most 6 significant digits (R-02). A solved step's `hex`
  is within one code per channel of `toHex(gamutMap(oklch, "srgb"))`, and consumers use the stored `hex` (R-01).
- **I-07 Mode symmetry.** Step numbers keep their jobs in both modes. Light scales darken away from the page and dark
  scales lighten away from it.
- **I-08 Hex form.** A `Hex` is `#` followed by six lowercase hex digits.
- **I-09 Absent, not undefined.** An optional field that has no value is absent from the object.
- **I-10 No perceptual-score brand.** The string "APCA" appears nowhere in `src/`, in any case. Code comments follow the
  same rule.

### Notes for implementers

- `tsconfig.json` targets ES2017, so BigInt literals (`123n`) do not compile. Use `BigInt("…")` calls or 32-bit
  arithmetic for FNV-1a 64.
- `round6(359.99999999999994)` is 360. Store hues through `roundHue`, or the schema rejects them (and fast-check reaches
  the ends of a range quickly).
- `toHex` rounds half up (`Math.round`). The Python reference rounds half to even; the two agree except on exact halves.
- Avoid `TextEncoder` and `TextDecoder` in the core. fflate's `strToU8` and `strFromU8` cover UTF-8.
- A property of 200 `generateSystem` calls costs about 64 scale solves per call (16 palette scales and 48 chart
  candidate scales). Budget for it: the solver may use 24 bisection iterations on its internal `maxChroma` call, as
  `t10_proto.py` does (the public `maxChroma` keeps 40), and it may memoize pure solves by their inputs. Task 1.8 reports
  the measured cost per call. Measured: the first call in a process takes about 330 ms, because it solves and caches the
  chart candidates of both pages; later calls take a median of 62 ms with `DEFAULT_PARAMS` (the 16 palette scales take
  58 ms), plus about 90 ms when they meet a dark page not yet cached. C-GEN-04's 200 runs over random parameters take
  about 24 s.
- Size headroom for the 12,000-character bound: a prototype with 16 real scales and placeholder roles (22.7 KB of
  canonical JSON) deflated to 4,137 bytes, which is 5,516 characters in base64url. The real spec adds roles, tokens and
  the trailer, so expect well under the bound; Task 1.8 reports the true number. Measured: the default spec's canonical
  JSON is 21,722 characters, its deflate stream 5,339 bytes and its link 7,130 characters; seeds 2 to 21 give 7,011 to
  7,342.
- `colorjs.io` is a test oracle only. It never appears under `src/`.

## 6. Modules, interfaces and cases

### 6.1 Color primitives (Task 1.2)

Files: `src/engine/color/{types,parse,convert,gamut}.ts`.

```ts
// types.ts
type Oklch = { readonly l: number; readonly c: number; readonly h: number | null }; // h: null is CSS `none`
type Rgb = readonly [number, number, number]; // gamma-encoded, 0..1 when in gamut
type Gamut = "srgb" | "p3";
type Mode = "light" | "dark";
type Hex = string & { readonly __hex: true };

// parse.ts
function parseColor(input: string): Oklch; // throws ColorParseError
class ColorParseError extends Error { readonly input: string }

// convert.ts
function rgbToOklch(rgb: Rgb, gamut: Gamut): Oklch;
function oklchToRgb(c: Oklch, gamut: Gamut): Rgb; // unclamped
function toHex(rgb: Rgb): Hex; // RangeError unless every channel is in [−1e-6, 1 + 1e-6]
function hexToRgb(hex: Hex): Rgb;
function formatOklch(c: Oklch): string; // oklch(0.7003 0.1701 22.06)

// gamut.ts
function inGamut(c: Oklch, gamut: Gamut): boolean;
function gamutMap(c: Oklch, gamut: Gamut): Rgb;
function maxChroma(l: number, h: number, gamut: Gamut): number;
```

Contract:
- **Spaces.** For `"srgb"` an `Rgb` is sRGB-encoded. For `"p3"` it is Display P3-encoded. `hexToRgb` and `toHex` are
  always sRGB, so a caller maps a P3-encoded triple to sRGB (`gamutMap(c, "srgb")`) before it makes a hex.
- **Constants.** The matrices (`SRGB_TO_XYZ`, `XYZ_TO_SRGB`, `P3_TO_XYZ`, `XYZ_TO_P3`, `XYZ_TO_LMS`, `LMS_TO_OKLAB`,
  `LMS_TO_XYZ`, `OKLAB_TO_LMS`) come from `core.py`. The sRGB transfer function decodes above 0.04045 and encodes
  above 0.0031308, and it preserves the sign of its input.
- **`rgbToOklch`.** `h` is `atan2(b, a)` in degrees, normalized to `[0, 360)`, and `null` when `c ≤ 4e-6` (R-03).
- **`oklchToRgb`.** A `null` hue reads as 0. The result is not clamped; channels outside `[0, 1]` mark an
  out-of-gamut color. Finite input gives finite output.
- **`toHex`.** It clamps channels within the tolerance to `[0, 1]`, multiplies by 255, rounds half up and writes
  lowercase `#rrggbb`.
- **`hexToRgb`.** It accepts `#rrggbb` in either case and returns `[r/255, g/255, b/255]`. Anything else throws
  `ColorParseError`.
- **`formatOklch`.** L and C use `toFixed(4)`, H uses `toFixed(2)`, no trimming. A `null` hue writes `none`.
- **`inGamut`.** True when every channel of `oklchToRgb` lies within `[−1e-6, 1 + 1e-6]`, the same tolerance as `toHex`.
- **`gamutMap`.** CSS Color 4 §14.2.2 as `css_gamut_map` in `core.py`. Lightness at or above 1 gives white and at or
  below 0 gives black. A color already in gamut (tolerance 0) comes back as `oklchToRgb` returns it. Otherwise a binary
  search on chroma over `[0, C]` uses local MINDE with JND 0.02 and ε 1e-4, and returns the clipped candidate. Every
  channel of the result lies in `[0, 1]`.
- **`maxChroma`.** Bisection on `[0, 0.5]` with 40 iterations, returning the lower bound. It returns 0 when the gray at
  `l` is out of gamut.
- **Failure.** A non-finite `l`, `c`, `h` or channel throws `RangeError` (I-03).

| ID | Kind | Case | Origin |
|---|---|---|---|
| C-PARSE-01 | pass | `#f66c6d` gives l 0.7003, c 0.1701, h 22.06 | plan, RF1 |
| C-PARSE-02 | pass | `#F66C6D` gives the same color as C-PARSE-01 | plan, RF1 |
| C-PARSE-03 | pass | ` #f66c6d ` (spaces, and tabs or newlines) gives the same color | plan, RF1 |
| C-PARSE-04 | pass | `rgb(246 108 109)` gives the same color | plan, RF1 |
| C-PARSE-05 | pass | `rgb(246, 108, 109)` gives the same color | plan, RF1 |
| C-PARSE-06 | pass | `#fff` gives white (l 1, c below 4e-6, h null); `#abc` equals `#aabbcc` | plan, RF1 |
| C-PARSE-07 | pass | `#ffffffff` gives white; `#ffff` gives white | plan, RF1 |
| C-PARSE-08 | pass | `#aabbccdd` equals `#aabbcc`, because the parser drops the alpha pair | RF1, ruling |
| C-PARSE-09 | pass | `oklch(70% 0.17 22)` gives l 0.70, c 0.17, h 22 | plan, RF1 |
| C-PARSE-10 | pass | `oklch(0.6 0 none)` gives `h === null` | plan, RF1 |
| C-PARSE-11 | pass | `oklch(0.7 0.17 22)` parses; `OKLCH(0.7 0.17 22)` and `RGB(246 108 109)` parse (names are case-insensitive) | RF1, ruling |
| C-PARSE-12 | pass | Hue normalizes: `oklch(0.7 0.17 -338)` and `oklch(0.7 0.17 382)` both give h 22 | ruling |
| C-PARSE-13 | pass | Achromatic reading: `oklch(0.6 0 120)`, `oklch(0.6 0.000003 120)` and `rgb(0 0 0)` give `h: null`; `oklch(0.6 0.00001 120)` gives h 120 | ruling |
| C-PARSE-14 | pass | `oklch(0.6 0.1 none)` gives h 0, not null | ruling |
| C-PARSE-15 | pass | CSS number syntax: `rgb(246.5 108 109)` and `oklch(0.5 .1 20)` parse | ruling |
| C-PARSE-16 | pass | Property (500 runs): for any string, `parseColor` returns an `Oklch` with finite `l`, finite `c` and an `h` that is finite or null, or it throws `ColorParseError`. No other error type, never NaN | RF1, RF3 |
| C-PARSE-17 | pass | Property (500 runs): strings built from the grammar in R-04 with in-range numbers never throw | added |
| C-PARSE-18 | failure | `""` throws `ColorParseError` with `.input === ""` | plan, RF1 |
| C-PARSE-19 | failure | `#ggg` throws `ColorParseError` with `.input` equal to the input | plan, RF1 |
| C-PARSE-20 | failure | `#12345` throws `ColorParseError` with `.input` equal to the input | plan, RF1 |
| C-PARSE-21 | failure | `rgb(1,2)` throws `ColorParseError` with `.input` equal to the input | plan, RF1 |
| C-PARSE-22 | failure | `oklch(1 2 3 4)` throws `ColorParseError` with `.input` equal to the input | plan, RF1 |
| C-PARSE-23 | failure | Each of these throws `ColorParseError` with `.input` equal to the input: whitespace only (`"   "`); wrong hex lengths (`#12`, `#1234567`, `#123456789`); a missing `#` (`fff`, `0xfff`) | RF1, added |
| C-PARSE-24 | failure | Each of these throws `ColorParseError` with `.input` equal to the input: `rgb(1,2,3,4)`, `rgb(1 2,3)` (mixed separators), `rgb(256 0 0)`, `rgb(-1 0 0)`, `rgb(a b c)`, `rgb(1 2 3`, `rgba(1 2 3)`, `rgb(100% 0% 0%)`, `rgb(1 2 3 / 50%)` | RF1, added |
| C-PARSE-25 | failure | Each of these throws `ColorParseError` with `.input` equal to the input: `oklch(1.5 0 0)`, `oklch(101% 0 0)`, `oklch(-0.1 0 0)`, `oklch(0.5 -0.1 20)`, `oklch(0.5 0.6 20)`, `oklch(0.5 50% 20)` | RF1, added |
| C-PARSE-26 | failure | Each of these throws `ColorParseError` with `.input` equal to the input: `oklch(0.5 0.1 abc)`, `oklch(NaN 0 0)`, `oklch(0.5 0.1 Infinity)`, `oklch(1e999 0 0)`, `oklch(0.5, 0.1, 20)`, `oklch(0.5 0.1 22 / 50%)` | RF1, RF3, added |
| C-PARSE-27 | failure | Each of these throws `ColorParseError` with `.input` equal to the input: `red`, `transparent`, `hsl(0 100% 50%)`, `color(display-p3 1 0 0)` | added |
| C-PARSE-28 | failure | `ColorParseError` is an `Error` with `name === "ColorParseError"`. `.input` is the untrimmed argument. A 10,000-character input gives a message under 200 characters | RF1, ruling |
| C-PARSE-29 | pass | The parser allows whitespace inside the parentheses (R-04): `rgb( 246 108 109 )`, `rgb(246 , 108 , 109)` and `oklch(  0.7   0.17   22  )` parse to the colors of C-PARSE-01 and C-PARSE-09 | RF1, ruling |
| C-CONV-01 | pass | `#808080` gives l ≈ 0.599871, c below 4e-6, `h === null` | plan |
| C-CONV-02 | pass | Property (500 runs): any 8-bit sRGB triple goes hex → OKLCH → hex and returns the same hex | plan |
| C-CONV-03 | pass | Property (500 runs): `rgbToOklch` matches colorjs.io `new Color(hex).to("oklch")` (L, C within 0.001; H within 0.1° when c is above 4e-6; where colorjs.io 0.7.1 reports a `null` hue, which it does for every achromatic color, ours is null) | plan |
| C-CONV-04 | pass | `formatOklch` of `#f66c6d` is `oklch(0.7003 0.1701 22.06)` | plan |
| C-CONV-05 | pass | `formatOklch({ l: 0.6, c: 0, h: null })` is `oklch(0.6000 0.0000 none)` | added |
| C-CONV-06 | pass | `toHex([1, 0.5, 0])` is `#ff8000`; `toHex([-1e-7, 1 + 1e-7, 0.5])` is `#00ff80` | added |
| C-CONV-07 | failure | `toHex([1.1, 0, 0])`, `toHex([-0.1, 0, 0])`, `toHex([NaN, 0, 0])` and `toHex([Infinity, 0, 0])` throw `RangeError` | plan, added |
| C-CONV-08 | pass | `hexToRgb("#f66c6d")` is `[246/255, 108/255, 109/255]`; the upper-case form gives the same triple | added |
| C-CONV-09 | failure | `hexToRgb` of `#f66c6`, `f66c6d`, `#gggggg` and `""` throws `ColorParseError` | added |
| C-CONV-10 | pass | Property (200 runs; l 0.1–0.95, c 0–0.1, any h): `rgbToOklch(oklchToRgb(c, "p3"), "p3")` ≈ c. For `oklch(0.7 0.1 145)` the P3 triple differs from the sRGB triple by more than 0.01 in some channel | added |
| C-CONV-11 | pass | `oklchToRgb` reads `h: null` as 0. Property (200 runs; l 0–1, c 0–0.5, any finite h): every output channel is finite | ruling, RF3 |
| C-CONV-12 | pass | An out-of-gamut input returns unclamped channels: `oklchToRgb(oklch(0.7 0.4 145), "srgb")` has a channel below 0 and every channel finite | plan, added |
| C-CONV-13 | pass | Property over 8-bit colors: `rgbToOklch` gives `h === null` exactly when `c ≤ 4e-6`, and otherwise a finite h in `[0, 360)`. All 256 grays give `h: null`, and the smallest chroma of a non-gray 8-bit color is 0.00106 (`#feffff`), far above 4e-6 | RF3, ruling |
| C-CONV-14 | failure | Non-finite arguments (`rgbToOklch([NaN, 0, 0])`, `oklchToRgb` with `l: NaN`, `formatOklch` with `c: Infinity`, any `h: NaN`) throw `RangeError` | RF3, added |
| C-GAMUT-01 | pass | `toHex(gamutMap(oklch(0.95 0.2 200), "srgb"))` is `#8cffff` | plan |
| C-GAMUT-02 | pass | `gamutMap(oklch(0.7 0.4 145), "p3")` ≈ `[0, 0.7804, 0]` (each channel within 0.001) | plan |
| C-GAMUT-03 | pass | Property (200 runs; l 0–1, c 0–0.5, any h, both gamuts): every output channel is in `[0, 1]`, and `gamutMap(rgbToOklch(out, g), g)` ≈ `out` within 1/255 per channel | plan |
| C-GAMUT-04 | pass | `maxChroma(0.7, 22, "srgb")` ≈ 0.1911 | plan |
| C-GAMUT-05 | pass | `gamutMap` gives `[1, 1, 1]` for l ≥ 1 and `[0, 0, 0]` for l ≤ 0, at any chroma and hue (`oklch(1.2 0.3 40)`, `oklch(-0.1 0.3 40)`, `oklch(1 0.2 100)`, `oklch(0 0.2 100)`) | plan |
| C-GAMUT-06 | pass | A color in gamut comes back unchanged: `gamutMap(oklch(0.7 0.05 145), g)` equals `oklchToRgb(...)` channel for channel | added |
| C-GAMUT-07 | pass | `inGamut`: `oklch(0.7 0.05 145)` is in both gamuts, `oklch(0.7 0.4 145)` in neither, `oklch(0.7 0.25 145)` in P3 only. For `"srgb"`, `inGamut(c)` equals "`toHex(oklchToRgb(c, "srgb"))` does not throw" (property, 500 runs) | added |
| C-GAMUT-08 | pass | `maxChroma`: for l 0.2–0.9, `oklch(l, maxChroma, h)` is in gamut and `maxChroma + 0.001` is not (property, 200 runs). P3 is at least sRGB at every (l, h). `maxChroma(0.7, 22, "p3")` ≈ 0.2435. `maxChroma(1, 90, g)` and `maxChroma(0, 90, g)` are below 1e-3. `maxChroma(1.2, 90, g) === 0` | added |
| C-GAMUT-09 | failure | A non-finite `l`, `c` or `h` throws `RangeError` in `gamutMap`, `inGamut` and `maxChroma` | RF3, added |
| C-GAMUT-10 | pass | The same input gives the same output, and the input object is not mutated | I-01, added |

### 6.2 Contrast, ΔE and color-vision simulation (Task 1.3)

Files: `src/engine/color/{contrast,deltae,cvd}.ts`.

```ts
// contrast.ts
function relativeLuminance(rgb: Rgb): number;
function wcagRatio(a: Rgb, b: Rgb): number;
function meets(ratio: number, threshold: 3 | 4.5 | 7): boolean;
function perceptualLc(text: Rgb, background: Rgb): number; // signed

// deltae.ts
function deltaEOK(a: Oklch, b: Oklch): number;
function minPairwiseDeltaE(colors: readonly Rgb[]): Record<"none" | Deficiency, number>; // R-25
type Views = Readonly<Record<"none" | Deficiency, Oklab>>; // a color's OKLab under each view
function viewsOf(rgb: Rgb): Views; // R-25
function minViewDeltaE(a: Views, b: Views): number; // R-25: the smallest ΔEOK of the two over the views

// cvd.ts
type Deficiency = "protan" | "deutan" | "tritan";
function simulate(rgb: Rgb, d: Deficiency): Rgb;
```

Contract:
- **`relativeLuminance`.** WCAG 2.2: decode each channel (threshold 0.04045), then weight by 0.2126, 0.7152 and 0.0722.
  Every channel must be finite and within `[−1e-6, 1 + 1e-6]`; otherwise `RangeError`. After that check the function
  clamps each channel to `[0, 1]`, so a ratio never exceeds 21 and a negative channel never reaches a fractional power
  (`Math.pow(-1e-7, 2.4)` is NaN). `wcagRatio` and `perceptualLc` apply the same check and clamp.
- **`wcagRatio`.** `(max(Ya, Yb) + 0.05) / (min(Ya, Yb) + 0.05)`. It is symmetric, lies in `[1, 21]` and is never rounded.
- **`meets`.** `ratio >= threshold` on the full float. A non-finite ratio, or a threshold other than 3, 4.5 or 7, throws
  `RangeError`.
- **`perceptualLc`.** The "perceptual contrast (advisory)" score. It implements the published formula known as APCA
  0.0.98G-4g, with the constants of the `A` table in `core.py`: exponent 2.4, coefficients 0.2126729, 0.7151522 and
  0.0721750 (its own luminance, not the WCAG one), and the clamp and offset values that table lists. Dark text on a
  lighter background is positive and light text on a darker background is negative. The result is `+0` when the two
  luminances differ by less than 0.0005 or the score falls under the low clip. The name stays out of code, UI and
  exports (DR-0038, I-10).
- **`deltaEOK`.** The Euclidean distance in OKLab (CSS Color 4 §20.3, not ΔEOK2). A `null` hue contributes `a = b = 0`.
- **`minPairwiseDeltaE`.** For each view (`none`, `protan`, `deutan`, `tritan`) it simulates every color, converts to
  OKLab, and returns the smallest ΔEOK over all unordered pairs. It needs at least two colors.
- **`simulate`.** Severity 1 only, in linear RGB: decode, multiply, clamp to `[0, 1]`, encode. Protan and deutan use the
  Viénot matrices (`VIENOT` in `cvd.py`). Tritan uses the Brettel pair (`BRETTEL`): matrix 1 when the dot product of the
  linear color with the plane normal is at least 0, matrix 2 otherwise. `#0000ff` and `#ffff00` fall on opposite
  sides of the tritan plane, so C-CVD-04 and C-CVD-05 use both matrices.

In the cases, `white` and `black` are the `Rgb` values of `#ffffff` and `#000000`.

| ID | Kind | Case | Origin |
|---|---|---|---|
| C-CONTRAST-01 | pass | `wcagRatio(#f5deb3, #006400)` ≈ 5.6616 (within 0.0001) | plan |
| C-CONTRAST-02 | pass | `wcagRatio(#777777, #ffffff)` ≈ 4.4781 and `meets(that ratio, 4.5)` is false | plan |
| C-CONTRAST-03 | pass | `#767676` on white ≈ 4.5422 and `meets(that ratio, 4.5)` is true | plan |
| C-CONTRAST-04 | pass | Property (500 runs): `wcagRatio(a, b) === wcagRatio(b, a)`, exact equality | plan |
| C-CONTRAST-05 | pass | Property (500 runs): `wcagRatio(x, x) === 1` for any color; no 0/0 | plan, RF3 |
| C-CONTRAST-06 | pass | `meets` never rounds: `meets(4.4999999, 4.5)`, `meets(2.9999999, 3)` and `meets(6.999999, 7)` are false; `meets(4.5, 4.5)`, `meets(3, 3)` and `meets(7, 7)` are true | decision, added |
| C-CONTRAST-07 | pass | `perceptualLc(#888888, #ffffff)` ≈ 63.056 (within 0.001) | plan |
| C-CONTRAST-08 | pass | `perceptualLc(#ffffff, #888888)` ≈ −68.541 (within 0.001) | plan |
| C-CONTRAST-09 | pass | `perceptualLc(#112233, #ddeeff)` ≈ 91.668 (within 0.001) | plan |
| C-CONTRAST-10 | pass | Property (500 runs): `perceptualLc(x, x)` is `+0` for any color | plan, RF3 |
| C-CONTRAST-11 | pass | Property (500 runs): dark text on a lighter background gives Lc ≥ 0; light text on a darker background gives Lc ≤ 0 | added |
| C-CONTRAST-12 | pass | Repo-wide grep: no file under `src/` contains "APCA", compared case-insensitively | plan, decision |
| C-CONTRAST-13 | pass | `relativeLuminance`: white ≈ 1, black = 0, `#808080` ≈ 0.2159 (within 0.0001); continuous at the transfer threshold (the luminances of a gray at 0.04045 and at 0.04046 differ by under 1e-5); `wcagRatio(black, white)` ≈ 21 (within 1e-9) | added |
| C-CONTRAST-14 | failure | A channel outside `[−1e-6, 1 + 1e-6]`, or NaN or Infinity, throws `RangeError` in `relativeLuminance`, `wcagRatio` and `perceptualLc` | RF3, added |
| C-CONTRAST-15 | failure | `meets(NaN, 4.5)` and `meets(Infinity, 4.5)` throw `RangeError`; so does a threshold other than 3, 4.5 or 7, cast through `as` | RF3, added |
| C-CONTRAST-16 | pass | Property (500 runs; channels drawn from `[−1e-6, 1 + 1e-6]`): `wcagRatio` always lies in `[1, 21]`, because the function clamps after the range check | added |
| C-CONTRAST-17 | pass | Channels inside the tolerance never give NaN: `perceptualLc([-1e-7, 0.5, 0.5], white)` and `wcagRatio([-1e-7, 0.5, 1 + 1e-7], white)` are finite, and `wcagRatio(white with every channel 1 + 1e-6, black)` is at most 21 | RF3, added |
| C-DELTAE-01 | pass | Property (500 runs): `deltaEOK(c, c) === 0` | plan, RF3 |
| C-DELTAE-02 | pass | Property (500 runs): `deltaEOK(a, b) === deltaEOK(b, a)` | plan |
| C-DELTAE-03 | pass | Black against white is 1.0 (within 1e-3) | plan |
| C-DELTAE-04 | pass | Property (500 runs): the triangle inequality holds within 1e-12 | added |
| C-DELTAE-05 | pass | A `null` hue adds nothing: `{ l: 0.5, c: 0.1, h: 90 }` against `{ l: 0.5, c: 0, h: null }` is 0.1 (within 1e-9); two `null`-hue colors with equal `l` give 0 | decision, added |
| C-DELTAE-06 | failure | A non-finite `l`, `c` or `h` throws `RangeError` | RF3, added |
| C-DELTAE-07 | pass | `minPairwiseDeltaE([#000000, #ffffff])` is 1.0 (within 1e-3) in all four views | added |
| C-DELTAE-08 | pass | For `[#ff0000, #fe0000, #0000ff]` the `none` value equals `deltaEOK` of the first two colors, the closest pair, within 1e-12 | added |
| C-DELTAE-09 | pass | Identical colors give 0 in every view. Property (200 runs): adding a color never raises any view's minimum | RF3, added |
| C-DELTAE-10 | failure | Fewer than two colors throws `RangeError` | added |
| C-CVD-01 | pass | Deutan `#ff0000` gives `#939300` (within 1 per channel) | plan |
| C-CVD-02 | pass | Deutan `#00ff00` gives `#dbdb29` (within 1 per channel) | plan |
| C-CVD-03 | pass | Protan `#ff0000` gives `#5e5e0d` (within 1 per channel) | plan |
| C-CVD-04 | pass | Tritan `#0000ff` gives `#006288` (within 1 per channel) | plan |
| C-CVD-05 | pass | Tritan `#ffff00` gives `#ffeef1` (within 1 per channel) | plan |
| C-CVD-06 | pass | Property (500 runs): any gray stays the same gray (within 1/255 per channel) under all three deficiencies | plan |
| C-CVD-07 | pass | Property (500 runs): every output channel is finite and within `[0, 1]` | plan, RF3 |
| C-CVD-08 | pass | White stays white and black stays black under all three deficiencies (within 1/255) | added |
| C-CVD-09 | pass | `simulate` returns a new tuple, leaves its input unchanged, and gives the same output for the same input | I-01, added |
| C-CVD-10 | failure | A channel outside `[−1e-6, 1 + 1e-6]` or NaN throws `RangeError`; so does an unknown deficiency, cast through `as` | RF3, added |

### 6.3 Seeded randomness and harmony (Task 1.4)

Files: `src/engine/random.ts`, `src/engine/color/harmony.ts`.

```ts
// random.ts
function seededRandom(seed: string): () => number; // values in [0, 1)

// harmony.ts
type Harmony = "monochrome" | "analogous" | "complementary" | "split" | "triadic" | "tetradic";
function harmonyHues(h0: number, harmony: Harmony): { secondary: number; accent: number }; // degrees in [0, 360)
```

The derivation below makes every platform draw the same stream. `seed32 = cyrb53(seed) >>> 0`, and the generator is
mulberry32 on that 32-bit seed:

```ts
const cyrb53 = (str: string, seed = 0): number => {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};
const mulberry32 = (a: number) => (): number => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
```

Contract:
- **`seededRandom`.** Any string is a seed, including `""`. The hash reads UTF-16 code units and applies no Unicode
  normalization. A seed that is not a string throws `TypeError`. Each call returns an independent generator.
- **`harmonyHues`.** The hue table is in section 2 and R-12. The function normalizes its output with `((x % 360) + 360) % 360`.
  Monochrome returns `h0` for both slots. A non-finite `h0`, or a harmony name outside the union, throws `RangeError`.

| ID | Kind | Case | Origin |
|---|---|---|---|
| C-RAND-01 | pass | The same seed gives the same first 1,000 values | plan |
| C-RAND-02 | pass | `"a"` and `"b"` differ at the first value | plan |
| C-RAND-03 | pass | Every value is in `[0, 1)`: 10,000 draws for each of several seeds, including `""` and a long Unicode seed | plan |
| C-RAND-04 | pass | Two generators from one seed share no state: advancing one leaves the other's stream unchanged | added |
| C-RAND-05 | pass | Golden vectors, exact equality. `seededRandom("dyelot")` gives 0.3585973768495023, 0.046500695403665304 and 0.9080566924531013. `seededRandom("")` starts with 0.32635160884819925. `seededRandom("seed-1")` starts with 0.8052122399676591 and `seededRandom("seed-2")` with 0.19437866914086044 | added |
| C-RAND-06 | pass | For seed `"dyelot"`, the mean of 10,000 values is within 0.02 of 0.5, and every decile holds between 800 and 1,200 values | added |
| C-RAND-07 | failure | A seed that is not a string (`undefined`, `null`, `42`, cast through `as`) throws `TypeError` | added |
| C-RAND-08 | pass | No normalization: `"é"` (U+00E9) and `"é"` written as `e` plus U+0301 give different first values | added |
| C-HARM-01 | pass | `harmonyHues(350, "complementary").accent === 170` | plan |
| C-HARM-02 | pass | `harmonyHues(10, "analogous").secondary === 340` | plan |
| C-HARM-03 | pass | Property (500 runs): every output is in `[0, 360)` for all six harmonies, for `h0` in `[0, 360)` and for `h0` outside it (−30, 720, 1e6) | plan, added |
| C-HARM-04 | pass | For `h0 = 100`, as (secondary, accent): monochrome (100, 100), analogous (70, 130), complementary (100, 280), split (310, 250), triadic (220, 340), tetradic (160, 280) | decision, ruling |
| C-HARM-05 | pass | `harmonyHues(370, "monochrome")` gives 10 for both slots | added |
| C-HARM-06 | failure | A NaN or infinite `h0`, or a harmony name outside the union cast through `as`, throws `RangeError` | RF3, added |

### 6.4 The contrast-solved scale (Task 1.5)

Files: `src/engine/color/scale.ts`, `src/engine/round.ts`.

```ts
// scale.ts
const STEPS: readonly [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
type Step = (typeof STEPS)[number];
const TARGETS: Record<Step, number>; // section 2
type ScaleStep = { step: Step; oklch: Oklch; hex: Hex; contrast: number };
function solveScale(input: {
  hue: number; peakChroma: number; mode: Mode; page: Rgb; gamut: Gamut;
}): readonly ScaleStep[];
function solveEvenScales(
  hues: readonly number[],
  rest: Omit<Parameters<typeof solveScale>[0], "hue">,
): readonly (readonly ScaleStep[])[];
class UnsatisfiableTargetError extends Error { step: Step; hue: number; target: number }
function pickHex(solution: Rgb, page: Rgb, target: number, threshold?: 3 | 4.5 | 7): Hex; // R-06, R-25

// round.ts
function round6(x: number): number; // R-02
function roundHue(h: number): number; // R-02: round6, and a result of 360 becomes 0
```

Contract, for step index `i` from 0 to 10 in `STEPS` order:
- **Target and band.** The nominal target is `TARGETS[step]`. Steps 500, 600 and 700 solve for `target + 0.02`. Their
  emitted hex must meet 3.0, 4.5 and 7.0, and it may overshoot the nominal target by at most 0.12; the 8-bit grid can
  force 0.087 at step 700. Every other step lands within `max(0.05, 0.01 × target)` of its target: 0.05 at steps 50 to
  400, then 0.095, 0.125 and 0.155 at steps 800, 900 and 950. The band does not apply to a threshold step.
- **Hue.** The step's drifted hue is `hue − drift(hue) × i / 10`, normalized into `[0, 360)`. The stored `oklch.h` is
  that hue passed through `roundHue` (R-02).
- **Chroma.** `min(peakChroma × envelope[i] × k, 0.97 × maxChroma(L, drifted hue, gamut))`, where the envelope is
  `0.12 0.22 0.40 0.62 0.85 1 1 0.90 0.75 0.60 0.45` and `k` is 0.85 in dark mode and 1 in light mode. The achromatic
  rule of R-03 runs on the rounded chroma.
- **Search and pick.** Bisection on L with 50 iterations inside the bracket of R-06, on the contrast of the unquantized,
  gamut-mapped color. `pickHex` then chooses the hex (R-06). Rounding the solution to one hex misses the band at
  the high steps (section 3, X-1); the nearest of the surrounding hexes does not.
- **`pickHex`.** It forms the floor and the ceiling of 255 times each channel of `solution`, clamped to 0–255, which gives
  up to eight hexes. It returns the one whose `wcagRatio` against `page` is nearest `target`. With `threshold` it
  considers only hexes that meet the threshold, and it throws `RangeError` when none does. A tie goes to the
  lexicographically smaller hex. A non-finite `target` or channel, or a channel outside `[−1e-6, 1 + 1e-6]`, throws
  `RangeError`.
- **Output.** `oklch`, `hex` and `contrast` follow R-01 and R-02. For `gamut: "p3"` the chroma cap uses the P3 gamut and
  the hex comes from the sRGB mapping, so the solver solves and measures contrast on the sRGB hex.
- **Even scales.** For each step, every hue uses the same chroma: the smallest chroma that any of the hues reaches at that
  step, after its own cap. Lightness is then solved again with that chroma. The scales come back in the order of
  `hues`. One hue gives the same scale as `solveScale`.
- **Errors.** `UnsatisfiableTargetError` follows R-06; its message names the step, the hue and the target. Invalid
  input throws `RangeError`: a non-finite `hue`; a `peakChroma` outside `[0, 0.5]`; a `page` channel outside
  `[−1e-6, 1 + 1e-6]`; an unknown `mode` or `gamut`; an empty `hues` list.

`DARK_PAGE`, `HUES` and `PEAK` come from section 5. In the C-PICK cases, `white` is the `Rgb` of `#ffffff`.

| ID | Kind | Case | Origin |
|---|---|---|---|
| C-SCALE-01 | pass | Shape: 11 steps in `STEPS` order; `TARGETS` equals section 2; every `hex` is lowercase `#rrggbb`; every `contrast` equals the ratio re-measured from `hex` against the page, within 1e-4 (the stored value keeps 6 significant digits) | plan, decision |
| C-SCALE-02 | pass | For each hue in `HUES` at `PEAK`, light on white and dark on `DARK_PAGE`, each contrast re-measured from `hex` obeys the band of section 6.4: every non-threshold step is within `max(0.05, 0.01 × target)` of its target, and steps 500, 600 and 700 meet 3.0, 4.5 and 7.0 on the full float and overshoot their nominal target by at most 0.12 | plan, decision, RF2 |
| C-SCALE-03 | pass | L is strictly decreasing across the steps in light mode and strictly increasing in dark mode, and every adjacent `abs(ΔL)` is at least 0.008 | plan |
| C-SCALE-04 | pass | Every `hex` decodes to channels in `[0, 1]`, and every `oklch` is in the requested gamut (`inGamut`) | plan, decision |
| C-SCALE-05 | pass | Drift, read from `oklch.h` within 0.1°. Hue 95: step 50 is 95 and step 950 is 60.714 (the plan's 60.71), with step `i` at `95 − 34.286 × i / 10` (R-07). Hue 262: every step is 262. Hues 27, 55 and 150: no drift. Hue 90: step 950 is 50 | plan, decision, ruling |
| C-SCALE-06 | pass | In `solveScale`, at every step the stored chroma equals `min(peak × envelope × k, 0.97 × maxChroma(L, drifted hue, gamut))` within 0.001 | decision |
| C-SCALE-07 | pass | `solveEvenScales([27, 150, 262], { peakChroma: 0.20, mode, page, gamut: "srgb" })`, light on `#ffffff` and dark on `DARK_PAGE`, returns three scales in input order. At every step the chroma spread across the three is at most 0.005. In each scale every non-threshold step is within `max(0.05, 0.01 × target)` of its target, and every threshold step meets its threshold and overshoots by at most 0.12 | plan |
| C-SCALE-08 | pass | Property (200 runs; hue 0–360, peak 0–0.35, both modes): no throw; C-SCALE-01, 03, 04 and 06 hold; contrast obeys C-SCALE-02, including the 0.12 overshoot limit on the threshold steps; no field is NaN or Infinity | plan, RF2, RF3 |
| C-SCALE-09 | failure | A light page of `#808080` (black reaches only 5.32:1 on it) throws `UnsatisfiableTargetError` with `step === 700` and `target === 7.0`. `hue` equals the input hue, and the message names step, hue and target | plan, RF2 |
| C-SCALE-10 | pass | Extreme inputs each give a scale that satisfies C-SCALE-03 and 04 with finite fields, or throw `UnsatisfiableTargetError` naming step and hue: (a) light page `#fefefe`; (b) dark page `#050505`; (c) peak chroma 0, where every `oklch` has `c` 0 and `h: null` and the channels of every hex differ by at most one code; (d) hue 110 at peak 0.35, above the gamut, in both modes | RF2, RF3 |
| C-SCALE-11 | failure | A light-mode scale on a `#000000` page and a dark-mode scale on a `#ffffff` page throw `UnsatisfiableTargetError` with `step === 50` | RF2, added |
| C-SCALE-12 | failure | Invalid input throws `RangeError`: a non-finite `hue`; `peakChroma` of NaN, −0.01 or 0.51; a `page` channel outside the range; an unknown `mode` or `gamut` cast through `as`; `solveEvenScales([], …)` | RF3, added |
| C-SCALE-13 | pass | With `gamut: "p3"`, every `oklch` is in the P3 gamut and every `hex` is an sRGB hex. The contrast checks of C-SCALE-02 hold on the hex. At hue 145 and peak 0.30, at least one step's chroma exceeds `maxChroma(L, hue, "srgb")` | decision |
| C-SCALE-14 | pass | Property (200 runs): every channel of `hex` differs from the same channel of `toHex(gamutMap(oklch, "srgb"))` by at most one code, and `round6` leaves every stored number unchanged | ruling |
| C-SCALE-15 | pass | The same input gives a deep-equal output, and the `page` tuple is not mutated | I-01 |
| C-SCALE-16 | pass | `solveEvenScales` with one hue equals `solveScale` for that hue, within the tolerances | added |
| C-SCALE-17 | pass | A non-white light page (`#f0f0f0`) and dark pages of other hues: the solver measures contrast against the page it receives | added |
| C-SCALE-18 | pass | Peak chroma 0 gives `h: null` at every step; any chromatic scale gives finite hues | RF3, ruling |
| C-SCALE-19 | pass | Neutral scales pass the same checks. With peak chroma 0, light on `#ffffff`, dark on `DARK_PAGE` and dark on `#121212`: every step passes the contrast checks of C-SCALE-02 (non-threshold steps within the band; threshold steps meeting their thresholds with an overshoot of at most 0.12), every `oklch` has `c` 0, and the channels of every hex differ by at most one code | plan, decision |
| C-SCALE-20 | pass | A hue that rounds to 360. `solveScale` with hue `359.99999999999994` at peak 0.20 stores `oklch.h === 0` at every step, because `round6` would give 360 (R-02) | ruling |
| C-PICK-01 | pass | `pickHex([0.3, 0.45, 0.8], white, 4.5)` is `#4d73cc` (ratio 4.5261), the nearest of the four hexes around the solution | decision, added |
| C-PICK-02 | pass | For the solution `[0.338, 0.426, 0.879]` on white with target 4.5, `pickHex` returns `#576de0` (4.4977). With threshold 4.5 it returns `#566de0` (4.5069), the nearest hex that meets 4.5 | decision, added |
| C-PICK-03 | pass | Property (200 runs over random solutions, the pages `#ffffff` and `#0f1216`, and targets): the result equals the best of the up to eight hexes found by brute force, and no channel leaves 0–255. When the hex made by rounding each channel qualifies (it meets the threshold, or the call has no threshold), the result's error `abs(ratio − target)` is at most that hex's | decision, added |
| C-PICK-04 | pass | A solution whose channels are whole codes gives that hex: `pickHex([0.4, 0.4, 0.4], white, 4.5)` is `#666666` | added |
| C-PICK-05 | pass | Channels at the edges, and within the 1e-6 tolerance (`[-1e-7, 0.5, 1 + 1e-7]`), give codes inside 0–255 | added |
| C-PICK-06 | failure | `pickHex([0.2, 0.5, 0.7], white, 4.5, 4.5)` throws `RangeError`: no hex around a solution of 4.33:1 meets 4.5 | decision, added |
| C-PICK-07 | failure | A non-finite channel or target, and a channel outside `[−1e-6, 1 + 1e-6]`, throw `RangeError` | RF3, added |
| C-ROUND-01 | pass | `round6(0.7002508346689501) === 0.700251`, `round6(22.0638415289496) === 22.0638`, `round6(1234567) === 1234570`, `round6(4e-7) === 4e-7` | ruling |
| C-ROUND-02 | pass | `round6(0) === 0` and `Object.is(round6(-0), 0)` | ruling |
| C-ROUND-03 | pass | Property (500 runs): `round6(round6(x)) === round6(x)` | ruling |
| C-ROUND-04 | failure | `round6(NaN)` and `round6(Infinity)` throw `RangeError` | RF3, added |
| C-ROUND-05 | pass | `round6(359.99999999999994) === 360`, so a stored hue needs `roundHue`: `roundHue(359.99999999999994) === 0` and `roundHue(359.9995) === 0`, `roundHue(359.9994999) === 359.999` and `roundHue(262.3456789) === 262.346` | ruling |
| C-ROUND-06 | failure | `roundHue(NaN)` and `roundHue(Infinity)` throw `RangeError` | RF3, added |

### 6.5 Palettes, roles, seeds and chart colors (Task 1.6)

Files: `src/engine/color/{palette,roles,chart}.ts`.

```ts
// palette.ts
type PaletteName = "neutral" | "primary" | "secondary" | "accent" | "success" | "warning" | "danger" | "info";
type Palette = {
  name: PaletteName; hue: number; peakChroma: number;
  light: readonly ScaleStep[]; dark: readonly ScaleStep[];
  seedStep?: { light: Step; dark: Step };
  seedDeviation?: { step: Step; deltaEOK: number };
};
type ColorParams = {
  primary?: Oklch; secondary?: Oklch; accent?: Oklch; // passing a color locks it
  harmony: Harmony; chroma: "muted" | "balanced" | "vivid";
  neutralTint: "none" | "warm" | "cool" | "brand"; gamut: Gamut;
  scaleMode: "standard" | "even"; contrastLevel: "AA" | "AA+" | "AAA";
};
function buildPalettes(input: ColorParams, random: () => number): Record<PaletteName, Palette>;
function pageFor(neutral: Palette, mode: Mode): Hex; // R-25
function normalizeSeed(seed: Oklch, name?: string): Oklch; // R-25: checks the domain, then R-02 and R-03; `name` starts its error messages

// roles.ts (RoleName is the union of the 46 names in the table below)
function resolveRoles(
  p: Record<PaletteName, Palette>, mode: Mode, level: "AA" | "AA+" | "AAA", chart: readonly Hex[],
): Record<RoleName, Hex>;
function onFill(fill: Rgb): Hex;
function selectOnFill(fill: Rgb, candidates: readonly Hex[]): Hex; // R-15, R-25

// chart.ts
function pickChartColors(p: Record<PaletteName, Palette>, mode: Mode, gamut: Gamut): readonly Hex[]; // length 5
```

`RoleName` is a union of exactly these 46 names (R-14):

| Group | Names |
|---|---|
| Surfaces and text | `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground`, `muted`, `muted-foreground`, `secondary`, `secondary-foreground`, `accent`, `accent-foreground` |
| Actions | `primary`, `primary-foreground`, `destructive`, `destructive-foreground`, `destructive-subtle`, `destructive-subtle-foreground` |
| Status | `success`, `success-foreground`, `success-subtle`, `success-subtle-foreground`, `warning`, `warning-foreground`, `warning-subtle`, `warning-subtle-foreground`, `info`, `info-foreground`, `info-subtle`, `info-subtle-foreground` |
| Lines | `border`, `input`, `ring` |
| Sidebar | `sidebar`, `sidebar-foreground`, `sidebar-primary`, `sidebar-primary-foreground`, `sidebar-accent`, `sidebar-accent-foreground`, `sidebar-border`, `sidebar-ring` |
| Charts | `chart-1`, `chart-2`, `chart-3`, `chart-4`, `chart-5` |

The text pairs below drive C1, C4 and C5 in the linter and the property in C-ROLE-04. Each pair reads foreground over fill.

| Rule | Pairs |
|---|---|
| C1 (13) | `foreground` / `background`; `card-foreground` / `card`; `popover-foreground` / `popover`; `sidebar-foreground` / `sidebar`; `muted-foreground` / `muted`; `muted-foreground` / `background`; `secondary-foreground` / `secondary`; `accent-foreground` / `accent`; `sidebar-accent-foreground` / `sidebar-accent`; `success-subtle-foreground` / `success-subtle`; `warning-subtle-foreground` / `warning-subtle`; `info-subtle-foreground` / `info-subtle`; `destructive-subtle-foreground` / `destructive-subtle` |
| C5 (6) | `primary-foreground` / `primary`; `sidebar-primary-foreground` / `sidebar-primary`; `destructive-foreground` / `destructive`; `success-foreground` / `success`; `warning-foreground` / `warning`; `info-foreground` / `info` |
| C4 (4, the body subset of C1) | `foreground` / `background`; `card-foreground` / `card`; `popover-foreground` / `popover`; `sidebar-foreground` / `sidebar` |

Contract:
- **Hues.** A locked color anchors its palette's hue (an achromatic one follows R-09). A missing primary takes
  `floor(random() × 360)`. A missing secondary or accent comes from `harmonyHues(h₀, harmony)` with R-12, where `h₀` is
  the primary's hue. The status palettes use success 150, warning 70, danger 25 and info 250. `buildPalettes` calls `random` once when `primary` is
  missing and never otherwise, and `random` must return a finite number in `[0, 1)`.
- **Checks.** `buildPalettes` checks every parameter itself, before it draws or solves anything, so each failure names
  its field (C-PAL-17), even when all three colors are locked and no harmony is needed. It does not rely on
  `harmonyHues`, whose errors would name another function. Each check follows R-05: a value of the wrong type, such as
  `42` or `null` for an enum field, throws `TypeError`, and a string outside the field's list throws `RangeError`.
  `resolveRoles` and `pickChartColors` check `mode`, `level`, `gamut` and the chart list the same way: a `chart` that is
  not an array, or an entry that is not a string, throws `TypeError`, and a list of the wrong length, or a string that
  is not a `Hex`, throws `RangeError` (C-ROLE-07, C-CHART-07).
- **Chroma and pages.** R-08 gives each palette's `peakChroma`. `pageFor` returns `#ffffff` in light mode. In dark mode it
  returns `toHex(gamutMap({ l: 0.18, c: min(0.012, neutral.peakChroma), h: neutral.hue }, "srgb"))`, with `h: null` when
  the chroma is at most 4e-6. Each mode's scales solve against that page with `solveScale`, or with `solveEvenScales`
  in even mode (R-11).
- **Seeds.** R-10 and the seed rule in section 2. A locked seed's own chroma never changes `peakChroma`. The engine rounds
  and normalizes a seed before use: `round6`, `roundHue`, then the achromatic rule of R-03 (R-02). The gamut test of R-10
  then reads that rounded seed with a tolerance of 2e-4, so the seed as passed and the seed as stored give the same
  palettes.
- **`resolveRoles`.** The sources in section 2, with the level moves: AA+ puts `muted-foreground` on neutral-800; AAA also
  puts `primary`, `sidebar-primary`, `ring`, `sidebar-ring` and `input` on step 700. `destructive` stays on danger-600 at
  every level, and `destructive-subtle` (danger-100) and `destructive-subtle-foreground` (danger-900) carry 7:1 text.
  Every `*-foreground` on a solid fill is `onFill` of that fill. `chart` must hold exactly five `Hex` values.
- **`onFill`.** Section 2 and R-15. The result is always `#ffffff` or `#000000`.
- **`pickChartColors`.** Section 2 and R-13. The candidates are 24 hues (every 15°) times steps 600, 700, 800 and 900,
  solved on the mode's page, so every mark keeps 3:1 against the page and the card. The first pick is `primary` step 600. Each later pick maximizes the smallest ΔEOK to the
  chosen set over the four views. A tie goes to the lower hue, then to the lower step. The returned set reaches 0.08.

| ID | Kind | Case | Origin |
|---|---|---|---|
| C-PAL-01 | pass | A missing primary takes `floor(random() × 360)`: `() => 0.5` gives 180, `() => 0` gives 0, `() => 0.999999` gives 359. `buildPalettes` calls `random` once when `primary` is missing and never when the caller passes it | plan, decision |
| C-PAL-02 | pass | Secondary and accent hues equal `harmonyHues(h₀, harmony)` for every harmony. A locked secondary or accent keeps its own hue, and the harmony does not move it | plan, decision |
| C-PAL-03 | pass | `peakChroma`: muted 0.08, balanced 0.14, vivid 0.22 on primary and accent; 0.14 on the four status palettes whatever the parameter says; secondary is 0.6 times the parameter's value; neutral is 0 for `none`, 0.012 at hue 60 for `warm`, 0.012 at hue 250 for `cool`, 0.010 at the primary hue for `brand` | decision, ruling |
| C-PAL-04 | pass | Status hues: success 150, warning 70, danger 25, info 250 | decision |
| C-PAL-05 | pass | `pageFor(neutral, "light")` is `#ffffff`. The dark page is the emitted hex of `oklch(0.18, min(0.012, Cneutral), hneutral)`: `#121212` for tint `none`, and `toHex(gamutMap(oklch(0.18 0.01 hprimary), "srgb"))` for tint `brand` | decision |
| C-PAL-06 | pass | Property (100 random parameter sets): all eight palettes exist with 11 light and 11 dark steps. Every non-seed step passes the contrast checks of C-SCALE-02 (non-threshold steps within the band; threshold steps meeting their thresholds with an overshoot of at most 0.12), keeps strict lightness order and stays in gamut | added |
| C-PAL-07 | pass | Seed `#f66c6d` (2.88:1 on white) locked as primary appears verbatim at light step 400, because its nearest step, 500, would break the 3.0 threshold. `palettes.primary.light[4].hex` is `#f66c6d` and its `oklch` equals the parsed seed with `round6` applied to each number (R-02). `seedStep.light` is 400 and there is no `seedDeviation`. The dark scale holds the seed verbatim at `seedStep.dark` | plan, RF5 |
| C-PAL-08 | pass | A seed outside sRGB, `oklch(0.7 0.3 145)`, in sRGB mode is gamut-mapped, placed in both modes and recorded: `seedDeviation.deltaEOK` is above 0.02 (about 0.06) and `seedDeviation.step` equals `seedStep.light` | plan, RF5 |
| C-PAL-09 | pass | No light step accepts the seed. Primary `oklch(0.68 0.05 0)` in light mode has a lightness (0.68) slightly below step 500's (0.686) and a contrast (2.95) below step 500's threshold (3.0), so steps 500 and 600 both reject it. The light scale equals the scale solved without a seed. The dark scale accepts the seed: it holds it verbatim at step 600 (a 6.4:1 contrast). `seedStep` is nevertheless absent, because it records both modes or neither (R-10); a consumer finds the dark placement by looking for the seed's hex in `dark`. `seedDeviation` describes the light mode: its `step` is the step nearest the seed by ΔEOK (500 on the reference scale), and its `deltaEOK` equals `deltaEOK(seed, light[step].oklch)` | decision, ruling, RF5 |
| C-PAL-10 | pass | Each of `EXTREME_SEEDS` locked as primary, in sRGB and P3: `buildPalettes` does not throw; every non-seed step meets C-SCALE-03 and 04; L stays strictly ordered across all 11 steps including the seed step; no field is NaN or Infinity; the seed is either verbatim at `seedStep` or recorded in `seedDeviation`, never dropped silently | RF2, RF3, RF5 |
| C-PAL-11 | pass | An achromatic seed (`#808080`, `oklch(0.6 0 none)`) gives the primary palette `peakChroma` 0, `hue` 0, `h: null` on every `oklch`, and hexes whose channels differ by at most one code | ruling |
| C-PAL-12 | pass | A locked secondary or accent seed follows the same rule as C-PAL-07: with `secondary: #f66c6d`, `palettes.secondary.light[seedStep.light]` is verbatim and `peakChroma` stays 0.6 times the parameter | decision, ruling |
| C-PAL-13 | pass | A locked seed's chroma does not set `peakChroma`: primary `#f66c6d` with `chroma: "muted"` has `peakChroma` 0.08 | decision |
| C-PAL-14 | pass | Even mode (R-11): primary and accent, when their `peakChroma` is equal, have a per-step chroma spread of at most 0.005 (seed steps excepted); the four status palettes have a spread of at most 0.005 among themselves; secondary and neutral equal their standard-mode scales | ruling |
| C-PAL-15 | pass | P3: with `gamut: "p3"` every non-seed `oklch` is in the P3 gamut, every `hex` is an sRGB hex, and the contrast checks of C-SCALE-02 hold on the hex | decision |
| C-PAL-16 | pass | The same parameters and the same `random` stream give deep-equal palettes, and the input is not mutated | I-01 |
| C-PAL-17 | failure | Invalid input throws `RangeError` naming the field: an unknown `harmony`, `chroma`, `neutralTint`, `gamut`, `scaleMode` or `contrastLevel`; a seed with a non-finite field, `l` outside `[0, 1]`, `c` outside `[0, 0.5]` or `h` outside `[0, 360)`; a `random` that returns NaN or a value outside `[0, 1)`. A value of the wrong type (a number or `null` for an enum field, a seed that is not an object) throws `TypeError` naming the field (R-05) | RF3, added |
| C-PAL-18 | pass | A hue that rounds to 360. A locked primary with hue `359.99999999999994` gives `palettes.primary.hue === 0`, and every step's `oklch.h`, and the seed step's, is below 360 (R-02) | ruling |
| C-PAL-19 | pass | The achromatic test runs after rounding. A locked primary `{ l: 0.6, c: 0.0000040000004, h: 120 }` becomes `c: 4e-6` and `h: null` in `color.params`, and gives an achromatic primary: `peakChroma` 0, `hue` 0 (R-03, R-09) | ruling |
| C-PAL-20 | pass | Rounding alone does not count as gamut mapping (R-10). A locked `#0000ff` primary in sRGB, whose stored seed `round6` leaves about 1.8e-6 outside `[0, 1]`, records no `seedDeviation`, and both modes hold it verbatim: `light[seedStep.light].hex` and `dark[seedStep.dark].hex` are `#0000ff` (steps 700 and 400 with `DEFAULT_PARAMS`). `#00ff00` (4.3e-5 outside after rounding) and `#ff00ff` (4.9e-6) also record no `seedDeviation`, because each stays within the 2e-4 of R-10, and passing the stored seed (`normalizeSeed` of the color) back in gives deep-equal palettes. A seed whose stored form lies 1e-4 outside is placed as rounded, and one 3e-4 outside is mapped and records a `seedDeviation` | ruling, RF5 |
| C-ROLE-01 | pass | `resolveRoles` returns exactly the 46 role names, each a `Hex` | decision, ruling |
| C-ROLE-02 | pass | For every mode and level, each role equals the hex of its source in section 2 (`background` is the page hex; every `*-foreground` on a solid fill is `onFill` of that fill; `chart-n` is the n-th chart color) | decision |
| C-ROLE-03 | pass | AA and AA+ differ only in `muted-foreground`. Between AA+ and AAA, only `primary`, `sidebar-primary`, `ring`, `sidebar-ring`, `input` and the foregrounds on `primary` and `sidebar-primary` may change, and the five fills do change. `destructive`, its foreground and its subtle pair never change with the level | decision |
| C-ROLE-04 | pass | Property (200 seeds, both modes, AA, AA+ and AAA; palettes and charts built once per seed and mode): every pair in the C1 and C5 lists has WCAG ≥ 4.5; `muted-foreground` on `background` is ≥ 7 at AA+ and AAA; `input` and `ring` against `background`, `card` and `muted` are ≥ 3 | plan |
| C-ROLE-05 | pass | `muted-foreground` on `muted` is ≥ 7 at AA+ and AAA (step 800 against step 100 gives about 8.3) | added |
| C-ROLE-06 | pass | Status sources: `warning` is warning-500, `destructive` danger-600, `info` info-700 and `success` success-800, with `onFill` foregrounds; the `-subtle` and `-subtle-foreground` roles stay on steps 100 and 900 | decision |
| C-ROLE-07 | failure | A `chart` list with fewer or more than five entries, or an entry that is a string but not a `Hex`, throws `RangeError`; so does an unknown mode or level. A `chart` that is not an array, or an entry, mode or level that is not a string, throws `TypeError` (R-05) | added |
| C-ROLE-08 | pass | The same input gives a deep-equal output, and the palettes are not mutated | I-01 |
| C-ROLE-09 | pass | `input` and `ring` keep 3:1 beyond the page. With `buildPalettes` given `random` stubbed to `() => 262.5 / 360` (a missing primary takes hue 262), balanced chroma and tint `brand`, at AA and AA+, `input` is neutral-600 and `ring` and `sidebar-ring` are primary-600. In light mode they measure about 4.24 against the card and 3.91 against the muted fill (within 0.05); in dark mode about 4.25 and 3.91 to 3.93. At AAA all three sit on step 700 and measure at least 6.5 against the card and 6.0 against the muted fill | decision |
| C-ROLE-10 | pass | `destructive-subtle` is danger-100 and `destructive-subtle-foreground` is danger-900 in both modes and at every level, and the pair reaches WCAG 7 (about 10.9, from 12.5 / 1.15). `destructive` is danger-600 at AA, AA+ and AAA | decision |
| C-ONFILL-01 | pass | `onFill` of the light primary-600 for hue 262 (`buildPalettes` with `random` stubbed to `() => 262.5 / 360`, balanced chroma) is `#ffffff`: both candidates reach 4.5, and white wins on `abs(Lc)` (about 76 against 33) | plan |
| C-ONFILL-02 | pass | `onFill(#ffeb3b)` is `#000000`, because only black reaches 4.5 | plan |
| C-ONFILL-03 | pass | When only white reaches 4.5, white wins: `onFill(#006400)` is `#ffffff` | decision |
| C-ONFILL-04 | pass | Property (200 runs over fills with luminance from 0.175 to 0.18333, where both candidates reach 4.5): the result is the candidate with the larger `abs(perceptualLc(candidate, fill))` | decision |
| C-ONFILL-05 | pass | `selectOnFill(#ffffff, [#777777, #767676])` is `#767676`: 4.4781 fails and 4.5422 passes, with no rounding | decision, added |
| C-ONFILL-06 | pass | When no candidate reaches 4.5, `selectOnFill` returns the one with the higher WCAG ratio: `selectOnFill(#808080, [#777777, #888888])` returns `#777777` (WCAG 1.1339 against 1.1141 for `#888888`) | decision |
| C-ONFILL-07 | pass | Property (500 runs): `onFill` always returns `#ffffff` or `#000000`, and at least one of the two reaches 4.5 on the fill (R-15) | decision, ruling |
| C-ONFILL-08 | failure | A channel outside `[−1e-6, 1 + 1e-6]` or NaN throws `RangeError`; so does `selectOnFill` with an empty candidate list | RF3, added |
| C-STATUS-01 | pass | The status indicators warning-500, danger-600, info-700 and success-800 have pairwise ΔEOK ≥ 0.08 under none, protan, deutan and tritan in both modes, for every `chroma` parameter and every `neutralTint` (property, 100 runs; standard scale mode). The reference minimum is 0.0855 in light mode and 0.0914 to 0.0940 in dark mode | plan, decision |
| C-STATUS-02 | pass | The status palettes do not depend on the `chroma` parameter, in standard mode and in even mode (R-11): for one primary and one `neutralTint`, `palettes.success`, `warning`, `danger` and `info` are deep-equal across `muted`, `balanced` and `vivid`, and each has `peakChroma` 0.14 | decision, ruling |
| C-CHART-01 | pass | `pickChartColors` returns five distinct `Hex` values; the first is `primary` step 600 of that mode | decision |
| C-CHART-02 | pass | Each chart color is at least 3:1 against the mode's page hex and against its `card` hex (neutral-50), measured on the hexes. The smallest ratios on the reference scales are 4.50 and 4.24 | plan, decision |
| C-CHART-03 | pass | Property (100 runs over primary hue 0–360, `chroma` of muted, balanced and vivid, both modes): `minPairwiseDeltaE` of the five is at least 0.08 in all four views | plan, decision |
| C-CHART-04 | pass | The same palettes give the same array, and the order of keys in the palette record does not matter | plan |
| C-CHART-05 | pass | Every chosen color after the first equals the `hex` of a candidate step (hue a multiple of 15, step 600 to 900) of a scale solved at peak chroma 0.14 on that page | decision, ruling |
| C-CHART-06 | pass | P3: candidates solve in the P3 gamut and the hexes are sRGB; C-CHART-02 and 03 hold on the hexes | decision |
| C-CHART-07 | failure | An unknown mode or gamut throws `RangeError`; so does a palette record that lacks `primary` or `neutral`. A mode or gamut that is not a string throws `TypeError` (R-05) | added |

### 6.6 Type, space, shape, depth and motion tokens (Task 1.7)

Files: `src/engine/tokens/{type,space,shape,depth,motion}.ts`.

```ts
// type.ts
type TypeStep = {
  name: "caption" | "label" | "body-sm" | "body" | "lead" | "h4" | "h3" | "h2" | "h1" | "display";
  sizePx: number; maxSizePx?: number; clamp?: string; lineHeightPx: number; trackingEm: number;
};
function typeScale(input: {
  context: "dense" | "product" | "marketing" | "editorial" | "poster"; ratio?: number;
}): readonly TypeStep[];

// space.ts
function spaceScale(basePx: 4): readonly number[];

// shape.ts
function radiusScale(set: "sharp" | "soft" | "round"): {
  sm: number; md: number; lg: number; xl: number; "2xl": number; full: 9999;
};
function nestedRadius(outerPx: number, paddingPx: number): number;

// depth.ts
type ShadowLayer = { offsetY: number; blur: number; spread: 0; color: Oklch; alpha: number };
function shadows(neutral950: Oklch): readonly ShadowLayer[][]; // index = elevation (R-18)

// motion.ts
function motionTokens(): {
  durations: Record<"instant" | "fast" | "quick" | "base" | "slow" | "slower" | "slowest", number>;
  easings: Record<"standard" | "decelerate" | "accelerate" | "emphasized", readonly [number, number, number, number]>;
  springs: Record<"snappy" | "smooth" | "bouncy", { visualDuration: number; bounce: number }>;
};
```

Contract:
- **Type contexts.** Dense is 14 px at ratio 1.2. Product is 16 px at 1.25. Poster is 18 px at 1.5. Marketing and editorial
  are fluid from 18 px at ratio 1.2 (viewport 360 px) to 20 px at ratio 1.25 (viewport 1240 px), on the `display` step
  only (R-17). A step's size is `base × ratio^e`, with exponents caption −2, label −1, body-sm −1, body 0, lead 1, h4 1,
  h3 2, h2 3, h1 4 and display 5.
- **Fluid `display`.** `sizePx` is the 360 px size and `maxSizePx` is the 1240 px size. With `min = sizePx / 16`,
  `max = maxSizePx / 16` (rem), `slope = (maxSizePx − sizePx) / (1240 − 360)` and `intercept = (sizePx − slope × 360) / 16`,
  the string is `clamp(<min>rem, <intercept>rem + <slope × 100>vw, <max>rem)` with each number in `toFixed(4)`.
- **Tracking.** `−0.0223 + 0.185 × e^(−0.1745 × px)` em for the step's `sizePx`, clamped to `[−0.04, 0.05]`. The curve
  never falls below −0.0223, so only the upper clamp engages, below about 5.4 px.
- **Line heights.** R-16: the multiplier of section 2 times the size (`maxSizePx` for a fluid step), snapped to the nearest
  multiple of 4 px with ties rounded up. The table after this list gives the results.
- **Space.** `spaceScale(4)` returns `0 1 2 3 4 6 8 12 16 20 24 32` times 4.
- **Shape.** Radius sets are sharp `0 2 4 6 8`, soft `4 8 12 16 24` and round `8 12 16 24 32` px for `sm`, `md`, `lg`, `xl` and
  `2xl`, plus `full: 9999`. `nestedRadius(outer, padding)` is `max(0, outer − padding)`.
- **Depth.** For elevation `L` from 1 to 5 the key layer is `offsetY 2L, blur 4L, alpha 0.10` and the ambient layer is
  `offsetY L, blur 2L, alpha 0.06`; both have `spread: 0`.
- **Motion.** Durations 50, 100, 150, 200, 300, 400 and 500 ms, in the order of the seven names. Easings, as cubic-bezier
  control points `[x1, y1, x2, y2]`: standard `[0.2, 0, 0, 1]`, decelerate `[0, 0, 0, 1]`, accelerate `[0.3, 0, 1, 1]`,
  emphasized `[0.05, 0.7, 0.1, 1]`. Springs, as seconds of visual duration and bounce: snappy `0.25 s, 0.1`,
  smooth `0.4 s, 0`, bouncy `0.5 s, 0.35`.
- **Failure.** An unknown context, set or base, a `ratio` that is not finite or lies outside `(1, 2]`, and a negative or
  non-finite pixel argument throw `RangeError`.

Line heights in px (R-16). Sizes come from the type scale; the marketing and editorial `display` line height comes from
`maxSizePx` (61.0352 × 1.1 = 67.14, snapped to 68).

| Step | Multiplier | Dense | Product | Poster | Marketing and editorial |
|---|---|---|---|---|---|
| caption | 1.4 | 12 | 16 | 12 | 16 |
| label | 1.4 | 16 | 16 | 16 | 20 |
| body-sm | 1.45 | 16 | 20 | 16 | 20 |
| body | 1.5 | 20 | 24 | 28 | 28 |
| lead | 1.5 | 24 | 32 | 40 | 32 |
| h4 | 1.4 | 24 | 28 | 36 | 32 |
| h3 | 1.33 | 28 | 32 | 52 | 36 |
| h2 | 1.25 | 32 | 40 | 76 | 40 |
| h1 | 1.2 | 36 | 48 | 108 | 44 |
| display | 1.1 | 40 | 52 | 152 | 68 |

| ID | Kind | Case | Origin |
|---|---|---|---|
| C-TYPE-01 | pass | Product: `body` is 16 px; `h1` is 16 × 1.25⁴ ≈ 39.0625 (the plan's 39.06; within 0.01); caption 10.24; label and body-sm 12.8; lead and h4 20; h3 25; h2 31.25; display 48.828125 | plan, decision |
| C-TYPE-02 | pass | Dense: body 14, `h1` 29.0304, display 34.8365 (within 0.001). Poster: body 18, `h1` 91.125, display 136.6875 | decision |
| C-TYPE-03 | pass | Every `lineHeightPx` is a positive multiple of 4, for every context and for ratios 1.067, 1.2, 1.5 and 2 | plan, ruling |
| C-TYPE-04 | pass | Tracking at 16 px (product `body`) ≈ −0.01096 (within 0.0001; the plan writes −0.0109). At 48.83 px (product `display`) it is ≈ −0.02226: the curve nears −0.0223 and the clamp does not engage | plan |
| C-TYPE-05 | pass | `typeScale({ context: "dense", ratio: 2 })` gives the 3.5 px caption `trackingEm === 0.05`. Property: every `trackingEm`, over all contexts and ratios, lies in `[−0.04, 0.05]` | decision, added |
| C-TYPE-06 | pass | Marketing `display.clamp` is `clamp(2.7994rem, 2.3840rem + 1.8461vw, 3.8147rem)`; `sizePx` ≈ 44.78976 and `maxSizePx` ≈ 61.03516. Evaluating the clamp at a 360 px viewport gives `sizePx` and at 1240 px gives `maxSizePx`, each within 0.01 px | plan |
| C-TYPE-07 | pass | In marketing and editorial only `display` has `clamp` and `maxSizePx`; the other steps stay at 18 × 1.2^e (`body` 18, `h1` 37.3248). Editorial has the same sizes as marketing. No other context has `clamp` | ruling |
| C-TYPE-08 | pass | A `ratio` argument replaces the context's ratio: product with 1.2 gives `h1` 33.1776; marketing with 1.2 gives `display` from 44.78976 to 49.7664 (within 0.01) | ruling |
| C-TYPE-09 | pass | The steps come in the order caption, label, body-sm, body, lead, h4, h3, h2, h1, display; label equals body-sm in size and lead equals h4 | decision |
| C-TYPE-10 | pass | `lineHeightPx` equals the line-height table for every step of the dense, product, poster, marketing and editorial contexts. For example product `h1`: 39.0625 × 1.2 = 46.875 snaps to 48, and product `lead`: 20 × 1.5 = 30 snaps up to 32 | decision, ruling |
| C-TYPE-11 | failure | `ratio` of 1, 0.9, 2.01, NaN or Infinity throws `RangeError`; so does an unknown context cast through `as` | RF3, added |
| C-TYPE-12 | pass | In every context, and for ratio overrides 1.067, 1.2, 1.5 and 2, each `lineHeightPx` is at least the step's largest size (`maxSizePx` for a fluid step), so a line never undercuts its font. The `body` line height is 1.43 times the size in dense (20 / 14), 1.5 in product, and 1.56 in poster, marketing and editorial (28 / 18) | ruling |
| C-SPACE-01 | pass | `spaceScale(4)` is `[0, 4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 128]` | decision |
| C-SPACE-02 | pass | Each call returns a new array; mutating one result leaves the next call unchanged | I-01, added |
| C-SPACE-03 | failure | `spaceScale(8)` and `spaceScale(NaN)`, cast through `as`, throw `RangeError` | RF3, added |
| C-SHAPE-01 | pass | Sharp is 0, 2, 4, 6, 8; soft is 4, 8, 12, 16, 24; round is 8, 12, 16, 24, 32 for `sm` to `2xl`; `full` is 9999 in all three | decision |
| C-SHAPE-02 | pass | `nestedRadius(16, 20) === 0` and `nestedRadius(24, 8) === 16` | plan |
| C-SHAPE-03 | pass | `nestedRadius(8, 0) === 8`. Property (500 runs): the result equals `max(0, outer − padding)` and lies in `[0, outer]` | added |
| C-SHAPE-04 | pass | For every set, `sm ≤ md ≤ lg ≤ xl ≤ 2xl < full` | added |
| C-SHAPE-05 | failure | An unknown set cast through `as`, or a negative or non-finite `outerPx` or `paddingPx`, throws `RangeError` | RF3, added |
| C-DEPTH-01 | pass | Elevation 3: the key layer is `offsetY 6, blur 12, spread 0, alpha 0.10` and the ambient layer is `offsetY 3, blur 6, spread 0, alpha 0.06` | plan, decision |
| C-DEPTH-02 | pass | For each elevation `L` from 1 to 5: key `offsetY 2L, blur 4L, alpha 0.10`; ambient `offsetY L, blur 2L, alpha 0.06`; `spread` 0 | decision |
| C-DEPTH-03 | pass | The result has six entries: index 0 is empty and indexes 1 to 5 hold `[key, ambient]` | ruling |
| C-DEPTH-04 | pass | Every layer's `color` equals the `neutral950` argument | ruling |
| C-DEPTH-05 | pass | `offsetY` and `blur` of both layers rise strictly with elevation | added |
| C-DEPTH-06 | failure | A non-finite field in `neutral950` throws `RangeError` | RF3, added |
| C-MOTION-01 | pass | Durations: instant 50, fast 100, quick 150, base 200, slow 300, slower 400, slowest 500 | decision |
| C-MOTION-02 | pass | Easings: standard `[0.2, 0, 0, 1]`, decelerate `[0, 0, 0, 1]`, accelerate `[0.3, 0, 1, 1]`, emphasized `[0.05, 0.7, 0.1, 1]` | decision |
| C-MOTION-03 | pass | Every easing's x values (indexes 0 and 2) lie in `[0, 1]` | plan |
| C-MOTION-04 | pass | Springs: snappy `{ visualDuration: 0.25, bounce: 0.1 }`, smooth `{ 0.4, 0 }`, bouncy `{ 0.5, 0.35 }` | decision |
| C-MOTION-05 | pass | Each call returns a fresh object; mutating one result leaves the next call unchanged | I-01, added |

### 6.7 The spec model and `generateSystem` (Task 1.8)

Files: `src/spec/{schema,canonical,hash,url-codec}.ts`, `src/engine/generate.ts`. New dependencies: `zod@^4` and `fflate`.

```ts
// schema.ts
const DesignSpecSchema; // a strict zod 4 object whose `version` is z.literal("dyelot.spec/1")
type DesignSpec = z.infer<typeof DesignSpecSchema>;
type DirectionParams = ColorParams & {
  type: { context: "dense" | "product" | "marketing" | "editorial" | "poster"; ratio?: number };
  radius: "sharp" | "soft" | "round";
  depth: "flat" | "soft" | "layered";
  motion: "calm" | "brisk" | "playful";
  name?: string;
};

// canonical.ts and hash.ts
function canonicalize(spec: DesignSpec): string;
function canonicalJson(value: unknown, name?: string): string; // canonical.ts; R-21 for any JSON-like value, used by generateSystem
function specId(spec: DesignSpec): string; // FNV-1a 64 of the canonical string, 16 hex characters
function fnv1a64(input: string | Uint8Array): string; // hash.ts; 16 lowercase hex characters; it hashes a string as UTF-8 (R-25)

// url-codec.ts
function encodeSpec(spec: DesignSpec): string;
function decodeSpec(s: string): DesignSpec; // throws SpecDecodeError
class SpecDecodeError extends Error { readonly reason: "corrupt" | "version" | "schema"; readonly issues?: readonly string[] }

// generate.ts
const ENGINE_VERSION = "dyelot.engine/1";
function generateSystem(params: DirectionParams, seed: string): DesignSpec;
```

The shape that `DesignSpec` takes in M1 (R-19). Every object is strict.

```ts
type DesignSpec = {
  version: "dyelot.spec/1";
  meta: {
    name: string; seed: string; engineVersion: string;
    createdWith: "controls" | "lexicon" | "on-device" | "visitor-key" | "import" | `model:${string}`;
  };
  color: {
    params: ColorParams;                        // the inputs; locking a seed adds it
    palettes: Record<PaletteName, Palette>;     // hue anchors, peak chroma, solved scales, seed records
    roles: Record<Mode, Record<RoleName, Hex>>; // the role map, light and dark
  };
  type: {
    families: { display: string; body: string; mono: string };
    context: "dense" | "product" | "marketing" | "editorial" | "poster";
    ratio?: number;                             // present only when the parameters set it
    steps: readonly TypeStep[];
  };
  space: { basePx: 4; scale: readonly number[] };
  shape: { radiusSet: "sharp" | "soft" | "round"; radii: ReturnType<typeof radiusScale> };
  depth: { style: "flat" | "soft" | "layered"; shadows: readonly (readonly ShadowLayer[])[] };
  motion: { feel: "calm" | "brisk" | "playful" } & ReturnType<typeof motionTokens>;
  components: { cards: string; emphasis: string; inputs: string; icons: { library: string; strokePx: number } };
  rules: { do: readonly string[]; dont: readonly string[] };
};
```

Contract:
- **Schema.** All numbers are finite. A `Hex` matches `^#[0-9a-f]{6}$`, and the schema is where a parsed string becomes a
  `Hex`. An `Oklch` has `l` in `[0, 1]`, `c` in `[0, 0.5]` and `h` in `[0, 360)` or `null`. `Palette.hue` lies in
  `[0, 360)` and `peakChroma` in `[0, 0.5]`. Each palette holds 11 steps per mode in `STEPS` order, with `contrast` in
  `[1, 21]`. Each mode's role map holds exactly the 46 names. Font family ids match `^[a-z0-9-]{1,64}$`. Bounds are in R-20.
  Achromatic hue (I-04) is a lint rule, not a schema rule. The schema also stores each palette under its own name
  (`palettes.primary.name` is `"primary"`); holds the ten type steps in `typeScale` order, the six shadow entries of R-18
  and the twelve space steps; takes a `clamp` only in the form `typeScale` writes (R-17); keeps lengths, durations and
  radii at 0 or above, font sizes and line heights above 0, tracking in `[−0.04, 0.05]`, alpha and bounce in `[0, 1]`
  and each easing's x values in `[0, 1]`; and keeps `meta.engineVersion` to 1 to 64 characters. A `model:` source takes
  a slug of 1 to 120 characters from `A–Z`, `a–z`, `0–9` and `_ . : / @ + -`. An optional field written as `undefined`
  fails (R-19, I-09).
- **M1 defaults.** `generateSystem` writes `type.families` as `{ display: "host-grotesk", body: "host-grotesk", mono:
  "fragment-mono" }`; `components` as `{ cards: "interactive-only", emphasis: "one-filled-per-region", inputs:
  "outlined", icons: { library: "lucide", strokePx: 2 } }`; and `rules` as `{ do: [], dont: [] }`. M2 owns the real values.
- **`canonicalize` and `specId`.** R-21.
- **`encodeSpec` and `decodeSpec`.** R-22. `decodeSpec` works in this order: it guards the length; checks the base64url
  alphabet; decodes and checks that re-encoding returns the input; splits off the 8-byte trailer; compares the trailer
  with FNV-1a 64 of the bytes before it, the deflate-raw stream, before inflating anything; inflates with a 1 MiB cap;
  decodes UTF-8; parses JSON; reads `version`; and parses with the schema. Any failure up to JSON is `corrupt`. A `version` that is a string other than `dyelot.spec/1` is
  `version`. A missing or non-string `version`, or a schema failure, is `schema`, and `issues` lists the failing paths.
  UTF-8 decoding is strict: the text must encode back to the same bytes, so a lenient decoder's U+FFFD never stands in
  for a bad byte. `issues` lists each failing path once, dotted (`color.roles.light.ring`), in schema order, with
  `(root)` for the payload itself; the message gives only their count. A `decodeSpec` argument that is not a string
  throws `TypeError` (R-05). `encodeSpec` checks the canonical form of its argument against the schema and throws
  `RangeError` naming the failing paths, so every link it returns opens: a `type.ratio` of 1.0000001 is valid as given,
  but rounds to 1, and is refused.
- **`generateSystem`.** It checks `params` and `seed` (R-20). It draws `random = seededRandom(seed)`, builds the palettes,
  and for each mode picks the chart colors and resolves the roles at `params.contrastLevel`. It builds the tokens: type
  from `params.type`, space from `spaceScale(4)`, radii from `params.radius`, shadows from the light-mode neutral-950
  color, and motion from `motionTokens()`. It sets `meta.name` to `params.name ?? "untitled"`, `meta.seed` to `seed`,
  `meta.engineVersion` to `ENGINE_VERSION` and `meta.createdWith` to `"controls"`. Last, it applies `round6` to every number
  (R-02). The result always passes `DesignSpecSchema`. It rounds `type.ratio` with `round6` before use, so the stored
  ratio and the stored steps agree; a ratio outside `(1, 2]`, or one that rounds to 1 (any ratio below 1.000005), throws
  `RangeError`. `color.params` holds the seeds after the normalization of section 6.5's Seeds bullet (`normalizeSeed`),
  and `buildPalettes` builds from those same seeds; R-10 tests the stored seed, so this changes nothing. Generating again
  from what a spec records gives the identical spec (C-GEN-13).

| ID | Kind | Case | Origin |
|---|---|---|---|
| C-SCHEMA-01 | pass | `DesignSpecSchema.parse(generateSystem(DEFAULT_PARAMS, "seed-1"))` deep-equals its input | added |
| C-SCHEMA-02 | failure | The schema rejects a missing role: delete `color.roles.light.ring`; the issue path names it | plan |
| C-SCHEMA-03 | failure | The schema rejects a hue of 400: `color.palettes.primary.hue = 400`; also 360 and −1 | plan |
| C-SCHEMA-04 | failure | The schema rejects an unknown version: `"dyelot.spec/2"`, `""`, `1` and a missing `version` | plan |
| C-SCHEMA-05 | failure | The schema rejects NaN or Infinity in any stored number | RF3, added |
| C-SCHEMA-06 | failure | The schema rejects a role value of `#FFF`, `#ffffff80`, `red` or `#ABCDEF` | added |
| C-SCHEMA-07 | failure | The schema rejects a scale with 10 steps, a repeated or out-of-order step id, or a step 75 | added |
| C-SCHEMA-08 | failure | The schema rejects a role map with an extra name (`tertiary`), 45 names, or four chart roles | added |
| C-SCHEMA-09 | failure | The schema rejects an unknown key (`color.extra`, `meta.extra`) | ruling |
| C-SCHEMA-10 | failure | The schema rejects a family id outside `^[a-z0-9-]+$` (`Host Grotesk`, `host_grotesk`, `""`, or 65 characters) | plan, added |
| C-SCHEMA-11 | pass | A generated spec carries the M1 defaults for `type.families`, `components` and `rules` exactly as listed above | plan |
| C-SCHEMA-12 | failure | The schema rejects `l: 1.2`, `c: -0.1`, `c: 0.6`, `h: 360` and `h: NaN` in an `Oklch` | added |
| C-SCHEMA-13 | failure | The schema rejects a `seedStep` with an unknown step, and a `seedDeviation.deltaEOK` that is negative or NaN | added |
| C-SCHEMA-14 | failure | Bounds: `meta.name` empty or 81 characters; `meta.seed` empty or 129; a `rules.do` list of 21 entries or an entry of 201 characters; a policy string empty or 65 characters | ruling |
| C-SCHEMA-15 | failure | The schema rejects `null`, `[]`, `"spec"`, `{}` and a number | added |
| C-SCHEMA-16 | pass | `meta.createdWith` accepts `controls`, `lexicon`, `on-device`, `visitor-key`, `import` and `model:openrouter/some-model:free`, and rejects `model:` and `robot` | added |
| C-CANON-01 | pass | Property (200 runs): two random key orders at every level of a generated spec give the identical canonical string | plan |
| C-CANON-02 | pass | Numbers keep 6 significant digits: 0.7002508346689501 gives 0.700251, 22.0638415289496 gives 22.0638, `-0` gives 0, 1234567 gives 1234570 | plan |
| C-CANON-03 | pass | The output has no whitespace, keeps array order, omits `undefined` properties, keeps `null` and JSON-escapes strings | plan |
| C-CANON-04 | pass | Property (50 runs): `canonicalize(JSON.parse(canonicalize(s))) === canonicalize(s)` for generated specs | added |
| C-CANON-05 | failure | A spec with NaN, Infinity or −Infinity in a number makes `canonicalize` throw `RangeError`; it never writes `null` | RF3, ruling |
| C-CANON-06 | pass | A one-field change alters the output; a change below the sixth significant digit (1e-9 on a 0.7 value) does not | added |
| C-CANON-07 | pass | `JSON.parse(canonicalize(s))` deep-equals `s` for generated specs, so canonicalization changes nothing | ruling |
| C-HASH-01 | pass | `specId(s)` matches `^[0-9a-f]{16}$` and equals `fnv1a64(canonicalize(s))` | plan |
| C-HASH-02 | pass | FNV-1a 64 vectors: `fnv1a64("")` is `cbf29ce484222325`, `"a"` is `af63dc4c8601ec8c`, `"foobar"` is `85944171f73967e8`, `"dyelot"` is `10593ce3d8ac9214` | added |
| C-HASH-03 | pass | UTF-8: `fnv1a64("é")` is `0ac21707b7181e01`, the hash of the bytes `c3 a9` | ruling |
| C-HASH-04 | pass | Property (200 runs): `specId` ignores key order and changes when one stored number or string changes to a different value at 6 significant digits | added |
| C-HASH-05 | pass | Golden: `specId(generateSystem(DEFAULT_PARAMS, "seed-1"))` equals a constant that Task 1.8 records when the suite first passes. A later change must be deliberate | added |
| C-HASH-06 | pass | `fnv1a64` hashes a `Uint8Array` as given: `fnv1a64(new Uint8Array([0x61]))` is `af63dc4c8601ec8c` and `fnv1a64(new Uint8Array([0xc3, 0xa9]))` is `0ac21707b7181e01` | ruling |
| C-URL-01 | pass | Property (50 runs over generated specs): `decodeSpec(encodeSpec(s))` deep-equals `s`, and the two canonical strings agree | plan, RF4 |
| C-URL-02 | failure | A one-character change throws `SpecDecodeError` with reason `corrupt`, and R-22 shows that every position fails. The test changes every 7th position of a default spec's link, and its last 12 characters, to each of the 63 other alphabet characters | plan, RF4 |
| C-URL-03 | failure | A truncated link throws `corrupt`: prefixes of length 1, `floor(n / 2)` and n − 1. The empty string throws `corrupt` | plan, RF4 |
| C-URL-04 | failure | A link whose payload is a valid spec with `version: "dyelot.spec/2"` throws reason `version`. The test builds it with a helper that encodes arbitrary JSON in the link format | plan, RF4 |
| C-URL-05 | failure | A link that carries JSON without a `version` string, or JSON that fails the schema (hue 400, a missing role), throws reason `schema`, and `issues` lists the failing paths | RF4, added |
| C-URL-06 | failure | A `+`, `/`, `=`, space or `%` anywhere in the link throws `corrupt` | added |
| C-URL-07 | failure | A link of 65,537 characters throws `corrupt` before any decoding. A payload that inflates past 1 MiB throws `corrupt` | ruling |
| C-URL-08 | pass | `encodeSpec(generateSystem(DEFAULT_PARAMS, "seed-1")).length` is under 12,000, and so is the length for 20 other seeds. The Task 1.8 report states the measured length | plan |
| C-URL-09 | pass | The link matches `^[A-Za-z0-9_-]+$` with no padding, and the same spec gives the same string | ruling |
| C-URL-10 | pass | The last 8 bytes of the decoded link equal `fnv1a64` of the bytes before them (the deflate-raw stream), and `specId(decodeSpec(link))` equals `specId(s)`, because `specId` comes from the decoded spec | ruling |
| C-URL-11 | pass | `SpecDecodeError` is an `Error` with `name === "SpecDecodeError"` and a `reason` from the three; its message names the reason and never echoes the payload | RF4 |
| C-URL-12 | pass | Property (500 runs): for any string, and for any single-character mutation of a valid link, `decodeSpec` returns a `DesignSpec` or throws `SpecDecodeError`; no other error type | RF3, RF4 |
| C-URL-13 | pass | The decoded value passes `DesignSpecSchema.parse` | added |
| C-URL-14 | failure | A change that flips only padding bits of the final deflate byte throws `corrupt`. The test takes the payload length `d` (decoded bytes minus 8) and changes each character from index `floor(8 × (d − 1) / 6)` to index `floor((8 × d − 1) / 6)` to each of the 63 other alphabet characters. A trailer over the inflated text would accept some of these changes (R-22) | RF4, ruling |
| C-GEN-01 | pass | `generateSystem(DEFAULT_PARAMS, "seed-1")` called twice gives the same `canonicalize` output | plan |
| C-GEN-02 | pass | `"seed-1"` and `"seed-2"` give different specs when the caller passes no color (primary hue 289 against 69) | plan |
| C-GEN-03 | pass | When the caller passes `primary`, `"seed-1"` and `"seed-2"` give the same `color.palettes.primary`, and the same `color` section; only `meta.seed` and the spec id differ | plan |
| C-GEN-04 | pass | Property (200 runs): no field of a generated spec is NaN or Infinity. Parameters range over every enum, optional locked seeds drawn from `EXTREME_SEEDS` and from random in-range colors (including hues within 1e-9 of 360 and chroma within 1e-9 of 4e-6), and random seed strings | plan, RF3 |
| C-GEN-05 | pass | Property (50 runs): a generated spec parses under `DesignSpecSchema` | added |
| C-GEN-06 | pass | `meta.seed` equals the argument, `meta.name` is `params.name ?? "untitled"`, `meta.engineVersion` is `dyelot.engine/1` and `meta.createdWith` is `controls` | ruling |
| C-GEN-07 | pass | Wiring of tokens, after `round6`: `type.steps` equals `typeScale(params.type)` with the ratio rounded by `round6`, `shape.radii` equals `radiusScale(params.radius)`, `space.scale` equals `spaceScale(4)`, `depth.shadows` equals `shadows(light neutral-950 oklch)`, and `motion` equals `motionTokens()`. `shape.radiusSet`, `depth.style` and `motion.feel` record the parameters | ruling |
| C-GEN-08 | pass | Wiring of color: `color.params` equals the color part of `params` after the seed normalization of 6.5's Seeds bullet (`normalizeSeed`), and `color.roles[mode]` equals `resolveRoles` with the colors from `pickChartColors`, for both modes | added |
| C-GEN-09 | pass | `neutralTint: "none"` with a gray primary gives achromatic steps with `h: null` and no NaN | RF3 |
| C-GEN-10 | failure | Invalid parameters throw `RangeError` naming the field: an unknown enum value; `type.ratio` outside `(1, 2]` or rounding to 1; `name` empty or over 80 characters; `seed` empty or over 128; a seed color out of range | RF3, ruling |
| C-GEN-11 | pass | `generateSystem` accepts a deep-frozen `params` object and does not mutate it | I-01 |
| C-GEN-12 | pass | A hue that rounds to 360. A locked primary `oklch(0.7 0.17 359.99999999999994)` gives a spec that passes `DesignSpecSchema`, with every stored hue below 360: the palette hues, the step hues and `color.params.primary.h` (R-02) | ruling |
| C-GEN-13 | pass | Regenerating is idempotent. `generateSystem` of the parameters a spec records (`color.params`, `type.context` and `type.ratio`, `shape.radiusSet`, `depth.style`, `motion.feel` and `meta.name`), with `meta.seed`, deep-equals the spec. Fixed cases: `#0000ff`, `#00ff00` and `#ff00ff` locked as primary and as accent with `DEFAULT_PARAMS` (none records a `seedDeviation`). Property (50 runs): every enum, locked seeds drawn from `#0000ff`, `#00ff00`, `#ff00ff`, `#ffffff`, `#000000`, `EXTREME_SEEDS` and random in-range colors, and random seed strings | ruling |

### 6.8 The color linter (Task 1.9)

Files: `src/engine/lint/{types,rules,index}.ts`. Tests: `tests/unit/engine/lint/*.test.ts`, one file per rule group, with
fixtures built from `generateSystem(DEFAULT_PARAMS, "seed-1")` plus targeted overrides.

```ts
type RuleId =
  | "C1" | "C2" | "C4" | "C5" | "N1" | "N2" | "N3" | "F1" | "S1" | "S2"
  | "K1" | "K2" | "K4" | "G1" | "G3" | "D1" | "D2" | "D3" | "D4" | "P1";
type Finding = {
  id: RuleId; severity: "error" | "warn" | "info"; mode: Mode;
  subject: string; measured: number; threshold: number; source: string;
};
function lintSpec(spec: DesignSpec): readonly Finding[]; // sorted: severity, id, mode, subject
```

Section 6.5 lists the text pairs. Ids, checks and thresholds come from `04-color-science.md` §3.6; the table below fixes
what each rule measures. A rule runs in both modes, except D1 to D4, which run in dark mode only. All comparisons use full floats.

| Id | Measures (one finding per failing subject and mode) | Fires when | Severity | `measured` / `threshold` | `source` |
|---|---|---|---|---|---|
| C1 | The 13 C1 text pairs, as WCAG ratio of the role hexes | ratio < 4.5 | error | ratio / 4.5 | `WCAG 2.2 SC 1.4.3, 1.4.6` |
| C2 | `primary`, `destructive`, `success`, `warning` and `info` against `background` (the large-text roles) | ratio < 3 | error | ratio / 3 | `WCAG 2.2 SC 1.4.3 (large text)` |
| C4 | The 4 body pairs: `abs(perceptualLc(foreground, fill))` | abs(Lc) < 75 | warn | abs(Lc) / 75 | `perceptual contrast guidance (advisory)` |
| C5 | The 6 C5 on-fill pairs, as WCAG ratio | ratio < 4.5 | error | ratio / 4.5 | `WCAG 2.2 SC 1.4.3` |
| N1 | `input` against `background`, and against `card` | ratio < 3 | error | ratio / 3 | `WCAG 2.2 SC 1.4.11` |
| N2 | `chart-1` to `chart-5` against `background`, and against `card` | ratio < 3 | error | ratio / 3 | `WCAG 2.2 SC 1.4.11` |
| N3 | `border` against `background` | ratio < 3 | info | ratio / 3 | `WCAG 2.2 SC 1.4.11 (decorative dividers are exempt)` |
| F1 | `ring` against `background`, against `card` and against `muted` | ratio < 3 | error | ratio / 3 | `WCAG 2.2 SC 1.4.11, 2.4.13` |
| S1 | The `status` set (`success`, `warning`, `destructive`, `info`) and the `chart` set (`chart-1` to `chart-5`): the smallest pairwise ΔEOK under each view from `minPairwiseDeltaE` | min < 0.08 | warn; error when min < 0.05 | min / 0.08 | `calibrated against Okabe-Ito (RR-0028)` |
| S2 | `abs(ΔL)` between `destructive` and `success` (OKLCH L of the hexes) | abs(ΔL) < 0.10 | warn | abs(ΔL) / 0.10 | `red and green collapse under protan and deutan (RR-0028)` |
| K1 | Each adjacent step pair of each palette: the movement of L toward the far end (`L(a) − L(b)` in light mode, `L(b) − L(a)` in dark) | movement ≤ 0 | error | movement / 0 | `invariant` |
| K2 | Each adjacent step pair: `abs(ΔL)` | abs(ΔL) < 0.008 | warn | abs(ΔL) / 0.008 | `CSS JND; Radix measured` |
| K4 | Each step: `abs(c − expected)`, where `expected` is the step's expected chroma. In standard mode it is `min(peak × envelope × k, 0.97 × maxChroma(L, drifted hue, gamut))` as in section 6.4. In even mode it is the group cap: the smallest value of that formula over the palettes of the step's even group (R-11), each taken at its own stored L and drifted hue | difference > 0.01 | warn | difference / 0.01 | `computed (RR-0028)` |
| G1 | Each step's `oklch` in the spec's gamut: the largest channel excess outside `[0, 1]`, so each emitted value must lie in `[−2e-4, 1 + 2e-4]` | excess > 2e-4 | error | excess / 2e-4 | `CSS Color 4` |
| G3 | Each step's `oklch` with `c ≤ 4e-6` | `h` is not `null` | error | c / 4e-6 | `CSS Color 4 (powerless hue)` |
| D1 | Dark `background`: OKLCH L of the hex | L < 0.15 | warn | L / 0.15 | `Material dark theme guidance` |
| D2 | Dark `foreground`: OKLCH L of the hex | L < 0.92 or L > 0.96 | warn | L / the violated bound | `off-white body text (Radix, Material)` |
| D3 | Dark chroma against light chroma at steps 500, 600 and 700 of primary, secondary, accent, success, warning, danger and info | dark c > light c | warn | dark c / light c | `Material guidance on dark-mode accents` |
| D4 | Dark `card` L against dark `background` L | card L ≤ background L | warn | card L / background L | `Material 3 tonal elevation` |
| P1 | Each step of primary, secondary and accent in both modes: `h` in `[90, 111]`, `c > 0.04` and `l < 0.65` | all three hold | info | l / 0.65 | `Palmer and Schloss, via Material Color Utilities` |

Subjects (R-23): pair rules use `<foreground>/<fill>`, for example `muted-foreground/background`; K1 and K2 use
`<palette>-<stepA>/<palette>-<stepB>`; K4, G1, G3, D3 and P1 use `<palette>-<step>`; S1 uses `<set>/<view>` with set
`status` or `chart` and view `none`, `protan`, `deutan` or `tritan`; S2 uses `destructive/success`; D1 uses `background`;
D2 uses `foreground`; D4 uses `card/background`; N3 uses `border/background`. D1 to D4 report `mode: "dark"`.

Contract:
- **Order.** Findings sort by severity (`error`, `warn`, `info`), then `id`, then `mode` (`light` first), then `subject`,
  each ascending.
- **Purity.** `lintSpec` reads the spec and nothing else. It does not mutate it and does not re-validate it; callers parse
  at the boundary. A spec whose numbers include NaN or Infinity makes it throw `RangeError`, so no finding carries a
  non-finite value.
- **Known default noise.** On a default spec (contrast level AA) the linter stays silent for C1, C2, C4, C5, N1, N2, F1,
  S1, S2, K1, K2, K4, G1, G3, D1, D2 and D4. N3 reports info in both modes. D3 may warn. A locked seed can raise K2 and K4
  at its own step, because the seed keeps its own lightness and chroma; M1 reports those warnings. The palette's
  `seedStep` names that step when both modes place the seed. When only one mode places it, `seedStep` is absent (R-10),
  and the seed's hex in that mode's scale marks the step. A locked seed raises no G1, because R-10 maps every seed
  whose stored form lies more than 2e-4 outside, the bound G1 checks. Rounding can leave a stored seed
  outside the gamut by up to 1.347e-4 (a locked `#0000ff` by 1.8e-6, `#00ff00` by 4.3e-5, and `#00fd1b`, the worst of
  all 16,777,216 8-bit colors, by 1.347e-4), and G1 allows 2e-4. Only the 390,152 colors with a 00 or ff channel can
  leave the gamut at all; the other 16,387,064 stay inside. Gamut-mapped seeds behave alike: 20,000 random out-of-gamut
  seeds reach 1.14e-4 at most.
- **Contrast level.** `destructive` stays on danger-600 at every level, so the status set, S1 and S2 do not depend on the
  level. For text that needs 7:1, `destructive-subtle-foreground` on `destructive-subtle` (about 10.9:1) carries it.
- **Overrides.** Pass fixtures override what their rule measures so that it holds, and assert that no finding has the id.
  Fail fixtures assert that the findings contain the expected element. They compute the expected `measured` with the
  engine's own contrast, lightness and ΔEOK functions and compare at 1e-9; the literal values in the rows below are
  rounded for reading.

| ID | Kind | Case | Origin |
|---|---|---|---|
| C-LINT-01 | pass | **C1.** With `foreground` (light) set to `#767676` on `#ffffff` (ratio 4.5422), no C1 finding names `foreground/background` | plan |
| C-LINT-02 | failure | **C1.** With `foreground` (light) set to `#777777` (ratio 4.4781): `{ id: "C1", severity: "error", mode: "light", subject: "foreground/background", measured: 4.4781, threshold: 4.5 }` | plan |
| C-LINT-03 | pass | **C2.** On the base spec, no C2 finding in either mode | plan |
| C-LINT-04 | failure | **C2.** With `warning` (light) set to `#ffd166` (ratio 1.442 on white): `{ id: "C2", severity: "error", mode: "light", subject: "warning/background", measured: 1.442, threshold: 3 }` | plan |
| C-LINT-05 | pass | **C4.** On the base spec, no C4 finding (abs(Lc) is about 102.5 in light mode and 93.5 in dark) | plan |
| C-LINT-06 | failure | **C4.** With `foreground` (light) set to `#767676` (abs(Lc) 71.57): `{ id: "C4", severity: "warn", mode: "light", subject: "foreground/background", measured: 71.57, threshold: 75 }` | plan |
| C-LINT-07 | pass | **C5.** On the base spec, no C5 finding | plan |
| C-LINT-08 | failure | **C5.** With `primary-foreground` (light) set to the `primary` hex (ratio 1): `{ id: "C5", severity: "error", mode: "light", subject: "primary-foreground/primary", measured: 1, threshold: 4.5 }` | plan |
| C-LINT-09 | pass | **N1.** On the base spec, whose `input` is neutral-600 (about 4.2 against the card in light mode), no N1 finding | plan |
| C-LINT-10 | failure | **N1.** With `input` (light) set to the neutral-400 hex: two error findings, `input/background` and `input/card`, each with `measured` below 3 and `threshold` 3 | plan |
| C-LINT-11 | pass | **N2.** On the base spec, no N2 finding | plan |
| C-LINT-12 | failure | **N2.** With `chart-3` (dark) set to `#222222`: error findings `{ id: "N2", severity: "error", mode: "dark", subject: "chart-3/background", measured: <ratio below 3>, threshold: 3 }` and the same for `chart-3/card` | plan |
| C-LINT-13 | pass | **N3.** With `border` set to the neutral-500 hex (ratio 3.0 or more), no N3 finding | plan |
| C-LINT-14 | failure | **N3.** On the base spec: `{ id: "N3", severity: "info", mode: "light", subject: "border/background", measured: about 1.32, threshold: 3 }`, and the same in dark mode | plan |
| C-LINT-15 | pass | **F1.** On the base spec, whose `ring` is primary-600 (about 3.9 against muted in light mode), no F1 finding | plan |
| C-LINT-16 | failure | **F1.** With `ring` (light) set to the primary-300 hex: error findings for `ring/background`, `ring/card` and `ring/muted`, each below 3 | plan |
| C-LINT-17 | pass | **S1.** On the base spec the status and chart sets raise no S1 finding in either mode. The status minimum is about 0.086 in light mode and 0.091 to 0.094 in dark mode | plan |
| C-LINT-18 | failure | **S1.** With `chart-2` set equal to `chart-1`: four error findings `chart/none`, `chart/protan`, `chart/deutan` and `chart/tritan`, each with `measured` 0 and `threshold` 0.08 | plan |
| C-LINT-19 | failure | **S1.** With `chart-1` to `chart-5` (light) set to `#202020`, `#808080`, `#949494`, `#d0d0d0` and `#f0f0f0`: four warn findings in light mode, one per view, each with `measured` 0.0667 (the ΔEOK of `#808080` and `#949494`) and `threshold` 0.08 | plan |
| C-LINT-20 | pass | **S2.** On the base spec, no S2 finding in either mode (`abs(ΔL)` between danger-600 and success-800 is about 0.20 in light mode and 0.17 in dark) | plan |
| C-LINT-21 | failure | **S2.** With `success` (light) set to the `destructive` hex: `{ id: "S2", severity: "warn", mode: "light", subject: "destructive/success", measured: 0, threshold: 0.10 }` | plan |
| C-LINT-22 | pass | **K1.** On the base spec, no K1 finding | plan |
| C-LINT-23 | failure | **K1.** After swapping the L of `primary` light steps 300 and 400: `{ id: "K1", severity: "error", mode: "light", subject: "primary-300/primary-400", measured: <the original L(400) minus the original L(300), negative>, threshold: 0 }` | plan |
| C-LINT-24 | pass | **K2.** On the base spec, no K2 finding (the smallest adjacent gap is above 0.026) | plan |
| C-LINT-25 | failure | **K2.** After setting `primary` light step 100's L to step 50's L minus 0.005: `{ id: "K2", severity: "warn", mode: "light", subject: "primary-50/primary-100", measured: 0.005, threshold: 0.008 }` | plan |
| C-LINT-26 | pass | **K4.** On the base spec, no K4 finding | plan |
| C-LINT-27 | failure | **K4.** After subtracting 0.02 from `primary` light step 500's chroma: `{ id: "K4", severity: "warn", mode: "light", subject: "primary-500", measured: 0.02, threshold: 0.01 }` | plan |
| C-LINT-28 | pass | **G1.** On the base spec, no G1 finding | plan |
| C-LINT-29 | failure | **G1.** After setting `primary` light step 500's `oklch` to `{ l: 0.7, c: 0.4, h: 145 }` in an sRGB spec: `{ id: "G1", severity: "error", mode: "light", subject: "primary-500", measured: <excess above 2e-4>, threshold: 2e-4 }` | plan |
| C-LINT-30 | pass | **G3.** On a spec built with `neutralTint: "none"`, every neutral step has `c` 0 and `h: null`, and no G3 finding appears | plan |
| C-LINT-31 | failure | **G3.** After setting a neutral step of that spec to `h: 120` with `c` 0: `{ id: "G3", severity: "error", mode: "light", subject: "neutral-500", measured: 0, threshold: 4e-6 }` | plan |
| C-LINT-32 | pass | **D1.** On the base spec the dark background has L about 0.181, and no D1 finding appears | plan |
| C-LINT-33 | failure | **D1.** With dark `background` set to `#000000`: `{ id: "D1", severity: "warn", mode: "dark", subject: "background", measured: 0, threshold: 0.15 }` | plan |
| C-LINT-34 | pass | **D2.** On the base spec the dark foreground has L about 0.936, and no D2 finding appears | plan |
| C-LINT-35 | failure | **D2.** Dark `foreground` set to `#ffffff` gives `measured: 1`, `threshold: 0.96`; set to `#cccccc` it gives `measured` about 0.8452 and `threshold` 0.92; both are warn findings with subject `foreground` | plan |
| C-LINT-36 | pass | **D3.** With every dark chroma halved, no D3 finding appears | plan |
| C-LINT-37 | failure | **D3.** With `primary` dark step 600's chroma set to the light chroma plus 0.05: `{ id: "D3", severity: "warn", mode: "dark", subject: "primary-600", measured: <dark c>, threshold: <light c> }` | plan |
| C-LINT-38 | pass | **D4.** On the base spec the dark card is lighter than the page (L 0.212 against 0.181), and no D4 finding appears | plan |
| C-LINT-39 | failure | **D4.** With dark `card` set to the `background` hex: `{ id: "D4", severity: "warn", mode: "dark", subject: "card/background", measured: L, threshold: L }` with equal values | plan |
| C-LINT-40 | pass | **P1.** On the base spec (primary hue 289), no P1 finding | plan |
| C-LINT-41 | failure | **P1.** With primary locked to `oklch(0.6 0.12 111)`: info findings in light mode that include `primary-600` and `primary-700`, each with `measured` below 0.65 and `threshold` 0.65 | plan |
| C-LINT-42 | pass | Property (100 runs over mutated base specs): `lintSpec` sorts findings by severity, then id, then mode, then subject | added |
| C-LINT-43 | pass | The rule ids are exactly the 20 in `RuleId`. Every finding has a non-empty `source` without "APCA" in any case, and a finite `measured` and `threshold` | RF3, ruling |
| C-LINT-44 | pass | Property (200 seeds, default params): `generateSystem` output has zero `error` findings | plan |
| C-LINT-45 | pass | The same spec gives deep-equal findings, and `lintSpec` accepts a deep-frozen spec | I-01 |
| C-LINT-46 | failure | A spec whose stored numbers include NaN, built by casting, makes `lintSpec` throw `RangeError` | RF3, added |
| C-LINT-47 | pass | On the base spec, C1, C2, C4, C5, N1, N2, F1, S1, S2, K1, K2, K4, G1, G3, D1, D2 and D4 stay silent, and N3 reports info in both modes | added |
| C-LINT-48 | pass | **G1 on locked seeds.** A locked `#0000ff` raises no G1 finding in sRGB mode: after `round6` its stored `oklch` leaves the gamut by 1.8e-6. The same holds for `#00ff00` (4.3e-5), `#ff00ff` (4.9e-6) and the gamut-mapped seed `oklch(0.7 0.3 145)` (2.1e-5) | plan, RF2, RF5 |
| C-LINT-49 | failure | **C1 on the destructive subtle pair.** With `destructive-subtle-foreground` (light) set to the `destructive-subtle` hex (ratio 1): `{ id: "C1", severity: "error", mode: "light", subject: "destructive-subtle-foreground/destructive-subtle", measured: 1, threshold: 4.5 }`. The base spec raises none for it (about 10.9) | decision, added |
| C-LINT-50 | pass | **G1 on every 8-bit seed.** Every 8-bit color locked as a seed raises no G1 finding in sRGB mode: for each hex, the stored seed's `oklch` (after `round6`, `roundHue` and the achromatic rule) converted back to sRGB leaves `[0, 1]` by at most 2e-4. The exhaustive run over all 16,777,216 hexes takes about 20 s in plain JavaScript and finds a largest excess of 1.347e-4 (`#00fd1b`). A faster run may check only the 390,152 hexes with a 00 or ff channel, because the exhaustive run found no other color outside the gamut | plan, added |

### 6.9 Repository guards

| ID | Kind | Case | Origin |
|---|---|---|---|
| C-REPO-01 | pass | Grep: no file under `src/engine/` or `src/spec/` matches any of these patterns: `Math\.random`, `\bnew Date\b`, `\bDate\.(now\|parse\|UTC)\b`, `\bwindow\.`, `\bdocument\.`, `\bnavigator\.`, `\b(localStorage\|sessionStorage\|indexedDB)\b`, `\bprocess\.(env\|argv\|cwd\|exit\|platform)\b`, `\bBuffer\.(from\|alloc)\b`, `\brequire\(`, or an import from `node:…`, `react` or `next`. The word boundaries and member accesses keep a comment that merely names a word from tripping the grep | I-01, added |
| C-REPO-02 | pass | Grep: no file under `src/engine/` other than `generate.ts` imports from `src/spec/` | added |
| C-REPO-03 | pass | An engine test and a spec test each assert `typeof window === "undefined"` and `typeof document === "undefined"`, which proves the node environment (R-24) | ruling |
| C-REPO-04 | pass | `vitest.config.ts` sets coverage floors for `src/engine/**` and `src/spec/**`: lines, statements and functions 95, branches 90 | added |

## 7. Review Focus coverage

Each row lists the cases that carry the item. Every case that has the item's tag in its Origin column covers it too.

| # | Review Focus item | Cases |
|---|---|---|
| RF1 | Pasted colors in every common form parse, or fail with `ColorParseError` naming the input, and never give NaN | C-PARSE-01 to C-PARSE-28, with the fuzz property C-PARSE-16 |
| RF2 | Extreme seeds still give a valid scale, or an `UnsatisfiableTargetError` naming step and hue | C-SCALE-08, C-SCALE-09, C-SCALE-10, C-SCALE-11, C-SCALE-12, C-PAL-10, C-PAL-11 |
| RF3 | NaN or Infinity never reaches a spec, including achromatic hues and equal-color contrast | C-GEN-04 (the property), C-GEN-09, C-CONTRAST-05, C-CONTRAST-10, C-DELTAE-01, C-CONV-13, C-SCALE-18, C-CANON-05, C-SCHEMA-05, C-LINT-43, C-LINT-46, and every `RangeError` failure case |
| RF4 | Truncated, tampered or future-version share links decode to a typed `SpecDecodeError` with a reason, never a blank studio | C-URL-02 (tampered), C-URL-03 (truncated), C-URL-04 (future version), C-URL-05, C-URL-06, C-URL-07, C-URL-11, C-URL-12 |
| RF5 | A locked seed survives verbatim when contrast allows; otherwise the spec records how far the nearest step moved it | C-PAL-07, C-PAL-08, C-PAL-09, C-PAL-10, C-PAL-20 |

The plan names Task 1.5 for RF2, but a seed enters at `buildPalettes` (Task 1.6), and `solveScale` takes a hue, a peak
chroma and a page. The spec therefore tests extreme inputs at both levels: C-SCALE-10 and C-SCALE-11 for the scale, and
C-PAL-10 and C-PAL-11 for locked seeds.

## 8. Deferred

| Item | Comes from | Milestone |
|---|---|---|
| Cosine and Poline-style generators | umbrella §5, section 2 | M5 (shader backgrounds) |
| Sanzo Wada combinations | umbrella §5, section 2 | M6 (gallery) |
| Image extraction (colorthief in a worker, Material-style scoring, heuristic roles) | umbrella §5, section 2 | M4 |
| Color names from `color-name-list/bestof` | umbrella §5, section 2 | M2 |
| Presets (the roughly 20 styles) | umbrella §6, section 2 | M2 |
| The font catalog, pairings and the genericness score | umbrella §6, section 2 | M2 |
| All-caps tracking (+0.05 to +0.12 em) | umbrella §6 | M2 |
| The taste lint rules (generic display face, purple-to-blue on white, verbatim Tailwind hexes, type-size count, body under 16 px, measure, mixed radius languages, decorative glass) | umbrella §6, section 2 | M2 |
| P3-rendered contrast checks (M1 guarantees contrast on the sRGB hex only) | section 2, P3 mode | M3 exports |
| A short share-link form, if the full link proves too long | plan Task 1.8 | M2 decides |
| The spec fields without an M1 source (`direction`, type weights, nesting rule, dark surface ladder, motion budget and reduced-motion policy) | R-19 | M2 and M3 |
| Machado matrices and anomalous severities | umbrella §5, section 2 | Not scheduled |
| Research lint rules C3, K3, U1, S3 and G2 | research §3.6 | Not scheduled. C3 overlaps C1 on `muted-foreground`, and K3 overlaps the target check in C-SCALE-02. G2 needs the P3 checks of M3. U1 needs a link role and S3 needs status markup, and M1 has neither |
| A `fix` on each finding | umbrella §5 and §8 | Not scheduled; the studio inspector (M2) is the natural home |
| JSON Schema export of the spec for the docs | umbrella §4 | Not scheduled |

## 9. Done when

- Every case in section 6 has a test, and every `failure` case fails in the way its row says.
- `pnpm lint && pnpm typecheck && pnpm vitest run --coverage && pnpm build && pnpm test:e2e` passes, with the folder floors
  met: lines, statements and functions 95, branches 90, on `src/engine/**` and `src/spec/**`.
- The Task 1.8 report states the measured encoded length of the default spec, as C-URL-08 asks.
- Task 1.10 updates the README status, and `docs/specs/00-design.md` only where M1 refined it.
