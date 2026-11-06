# 05 · Motion and 3D: the hero shader, the explorer, the motion lab, transitions and flavor (M5)

> Source note: this milestone spec refines `docs/specs/00-design.md`, the umbrella (sections 7, 8, 9, 11, 13 and 14 above
> all), and builds on `docs/specs/01-color-engine.md` (M1), `docs/specs/02-studio.md` (M2), `docs/specs/03-export.md` (M3)
> and `docs/specs/04-ai.md` (M4). Paths to `docs/research/`, `docs/plans/` and `knowledge/` point into the private `repos`
> meta-repo. Next.js facts cite the docs shipped with next 16.4.3 under `node_modules/next/dist/docs/` (written `NDOCS/`
> below), as `AGENTS.md` requires. Package facts were read from the npm registry and from the published tarballs on
> 2026-11-06; Playwright's Chromium facts come from a local probe of the same day.

Status: approved by the owner on 2026-11-06, as written, after one independent review (44 findings and 5 uncertain
items) and a re-check (1 minor, fixed). The owner accepted the recommendation of every item in section 21.

Section 2 lists the owner's standing rulings and the controller's decisions of 2026-11-06. Section 3 turns each decision
into rulings R5-01 to R5-66, and section 14 holds 255 cases (163 `C-` and 92 `F-`). A ruling ends with **(decision X#)**
when it states a controller decision, or **(drafter)** when this spec supplies a rule the decisions leave open; a ruling
that does both says which part is which. The owner can overturn any ruling by editing this file before the task that uses
it starts. Task 5.0 (R5-64) probes every external fact this spec could not verify before any other task, in seven
probes, and says what happens when a probe fails. This draft took one independent review (5 critical, 17 important, 22
minor and 5 uncertain findings) and one fix pass.

## 1. Purpose and scope

M4 let a visitor start from words or a picture. M5 lets a visitor see the design move and take that movement home: a
shader on the home page painted from a design's own scales, a scroll story in which one design assembles itself, a 3D
explorer that places every step inside the sRGB, Display P3 and Rec. 2020 gamut solids, a motion lab that edits the
design's motion tokens and exports them, two view transitions in the studio, and a Flavor dialog that previews the shader
and a brand video, renders that video in the browser and records a seamless loop of the shader. Every moving piece has a
still form that reduced motion gets, and every piece that needs WebGL2 or WebCodecs has a fallback with a sentence
(umbrella section 14: M5 is done when the fallback and reduced-motion cases pass).

```text
spec --flavorStops(spec, mode)--> 5 hexes --+--> mountFlavor: WebGL2, OKLab mix of the stops, noise on circles, grain
     specId --flavorSeed--> [x, y] ---------+       \--(no WebGL2 | context lost | compile or link failure)--> flavorBackground (CSS) + a sentence
hero-cards.json (committed; a test checks it against generateSystem x 6) --> { seed, fade, cards } --> "/" hero (no engine on the client)
server: heroSpec(0), generated once per instance --storySteps--> 5 framed specimens --CSS animation-timeline: view()--> "/" story
/explore#s=<link> --decodeSpec--> spec --solidPosition--> 88 points, 8 tubes; gamutSolid(gamut, 32) --> mesh;
                                        gamutSlice(gamut, L) for 3 gamuts --> the flat SVG view (always shown)
/motion#s=<link> --decodeSpec--> spec --withMotion(spec, tokens)--> spec' --> hash, previews, motionFiles(spec', ...)
studio "Flavor" --import()--> dialog: <Flavor> preview | <Player BrandIntro inputProps=brandProps(spec, mode), no controls, no audio tags>
       "Render the brand video" --import("@remotion/web-renderer")--> canRenderMediaOnWeb --> renderMediaOnWeb --> .mp4 | .webm
       "Record the shader loop"  --import("mediabunny")--> canEncodeVideo --> mountFlavor(1280 x 720).drawAt(i / 300) x 300 --> .mp4 | .webm
export dialog "Include flavor files" --> buildBundle({ spec, origin, flavor: true }) --> 18 to 21 files + flavor/ (9) + receipt.json
```

| Task | Delivers |
|---|---|
| 5.0 | The probes of R5-64, before anything else |
| 5.1 | Engine color: Rec. 2020 as a solid-only space, `gamutSolid`, `gamutSlice`, `solidPosition` |
| 5.2 | Engine motion: the `motionTokens` parameter, `normalizeMotionTokens`, `withMotion`, the five motion presets, `bezierPoints`; the studio's params guard and worker protocol |
| 5.3 | Flavor core: `flavorStops` and `flavorSeed`; `src/flavor/` (`flavor.mjs`, `flavor-react.tsx`, the Remotion composition, its root and `brand.json`); the raw rule for `*.tsx` |
| 5.4 | Export: `brandProps`, `mediaName`, the nine flavor files, `BundleInput.flavor`, the entry's three new names, `downloadBlob`'s type, the export dialog's switch, the new golden |
| 5.5 | Landing: the hero designs, the hero, the scroll story, the nav and the sitemap |
| 5.6 | The explorer at `/explore` |
| 5.7 | The motion lab at `/motion`, and the studio's motion line and page links |
| 5.8 | View transitions in the studio, the token row, the reduced-motion rules, the mobile sheet fix |
| 5.9 | The Flavor dialog: the shader preview, the Player, the brand video render, the privacy note, the CSP |
| 5.10 | The shader loop recording |
| 5.11 | Composed flows: the fallback and reduced-motion suite, axe on every new page and on the dialog, the laziness and security pins |
| 5.12 | Close M5: the hand check after the merge, the umbrella notes, the README, the knowledge graph |

Task 5.4 builds on the sources of Task 5.3, Task 5.9 on 5.3 and 5.4, and Task 5.10 on 5.3 and 5.9; the plan sets the
lanes.

M5 does not deliver WebGL in the canvas templates, an `/about` page, the gallery, share cards, a GIF, glTF or dotLottie
export, a palette nebula, WebGPU, GSAP code, audio in any video, a `<video>` element, cosine or Poline-style generators,
tokens for the unexpressed style traits, or animations in `theme.css`. Section 18 assigns each.

### Where this spec refines the umbrella

| Umbrella | This spec | Why |
|---|---|---|
| §3 Layer table: `src/features/` holds the explorer, the motion lab and the video | Plus `src/flavor/`, the shipped sources: self-contained files the app runs and the export ships byte for byte (R5-04, R5-05) | The exported code is the code the flows exercise |
| §4 `motion`: "budget, reduced-motion policy" | No budget and no stored policy; the policy stays the fixed block of `motion/motion.css` (R5-15) | M2 and M3 never added either; a stored policy would change every spec id |
| §5 Generators: cosine palettes and Poline-style anchor interpolation (M1 moved them to "M5, shader backgrounds") | Not scheduled; the shader interpolates five solved steps in OKLab (R5-03) | Every color the shader shows stays a step of the design |
| §6 Motion: "a budget per page" | Not scheduled (R5-15) | No source of a number exists |
| §7 `/`: a hero shader, a scroll story, "the receipt explained in one screen", entry points from a color, a brief, an image or the gallery | The hero, a five-step story whose last step is the receipt's count, and links to the studio, the explorer and the lab; the other entry points wait for M6's landing polish (R5-31 to R5-34) | M6 owns landing polish and the gallery |
| §7 `/explore`: the sRGB, P3 and Rec2020 solids, points, tubes, slices | One lightness slice; Rec. 2020 joins the engine as a solid-only space; a flat SVG view is always shown (R5-06 to R5-08, R5-35 to R5-40) | The spec's `Gamut` stays `srgb` or `p3`; the flat view is the accessible form |
| §8 Transitions: a swatch morphs into its token row and between templates | The template switch cross-fades; a step of the inspector's Scales expands in place into a token row, the swatch morphing (R5-46, R5-47) | `<ViewTransition>` pairs need one name on both sides in one commit |
| §9 `flavor/` (on request): the shader as a React component, a vanilla module and a CSS fallback; the brand video; the Remotion source | Nine text files, off by default; the brand video and the shader loop are separate downloads from the Flavor dialog (R5-24, R5-25) | The bundle is text; a video is not byte-reproducible across browsers, and a render sends telemetry |
| §10 Security: `connect-src 'self' https://openrouter.ai https://www.remotion.pro` (M4 deferred Remotion's host) | As the umbrella says; no `media-src`, no `'wasm-unsafe-eval'` (R5-58) | M5 sends one usage event per render; no `<video>` exists; renders are muted |
| §11 Hero and canvas backgrounds: a cosine palette fitted to the spec or an OKLCH lookup texture | Five OKLab stops as `vec3` uniforms, mixed in GLSL; the canvas backgrounds become the Flavor dialog's preview (R5-02, R5-17) | Text over a moving shader cannot be held to the receipt's contrast |
| §11 3D explorer: one canvas with drei's `View`; a gamut mesh adapted from oklch-picker with its MIT notice | One canvas and one viewport, no `View`; drei limited to `OrbitControls` or dropped; dyelot's own mesh (R5-07, R5-35) | One viewport needs no `View`; drei's other parts fetch remote assets |
| §11 Transitions row: Motion 14.9 | `motion` stays 14.3.0 (R5-60) | Nothing in 14.4 to 14.9 is needed (R3-37 kept 14.3.0) |
| §11 Version pins: three stays on 0.186.x while `postprocessing` declares `three < 0.187` | Exactly three 0.186.1; no `postprocessing` (R5-60) | `postprocessing` is not used; 0.187.0 is younger than two weeks |
| §12 Stack: `mediabunny` with no pin | Exactly `mediabunny` 1.62.0, the version `@remotion/web-renderer` 4.0.539 depends on (R5-50) | One copy ships |
| §13 Motion and 3D cases | Section 14; every flow asserts state, never frame counts or timing (R5-62) | Software WebGL in CI is slow and uneven |
| §14 M5 done when: fallback and reduced-motion cases pass | Section 20 adds the hand check with one real render (R5-65) | One telemetry event from the controller's browser proves the real path |
| §16 Open questions: the Turbopack way to export component source as a string; Player hydration with Cache Components | Probe 3 (a raw rule for `*.tsx`) and probe 4 (`dynamic(..., { ssr: false })`); Cache Components stay off (R4-26, R5-64) | The nonce CSP rules out Partial Prerendering |

### Where this spec departs from the controller's decisions

| Decision | This spec | Why |
|---|---|---|
| B7: the exported `flavor/flavor.css` uses the theme's variables `var(--color-<palette>-<step>)` | `var(--<palette>-<step>)`, which `:root` and `.dark` of `app/theme.css` define (R5-20) | `--color-<palette>-<step>` exists only in `@theme inline`, which Tailwind may inline instead of emitting; `--<palette>-<step>` always exists at run time and follows `.dark` |
| G4: "Render the brand video" is shown only when `canRenderMediaOnWeb` can render, and `@remotion/web-renderer` loads on the click only | The button shows when the browser has WebCodecs (`VideoEncoder`); the click loads the renderer and runs `canRenderMediaOnWeb`, whose "no" replaces the button with its sentence (R5-53) | `canRenderMediaOnWeb` ships in the renderer's package, so calling it before the click would load the renderer (K3) |
| H1: AVC when `canEncodeVideo` holds, else VP9, else VP8, else the button is replaced by a sentence | The same split as G4: WebCodecs shows the button, the click loads Mediabunny and picks the codec (R5-56) | `canEncodeVideo` ships in Mediabunny, which loads on the click only (K3) |
| E3: per-token number fields "with the schema's bounds" | Text fields with `inputmode="decimal"`, read by `readField`, with the schema's bounds plus the lab's caps where the schema has none: durations whole milliseconds 0 to 500, an easing's y −1 to 2, a spring's duration 0.05 to 2 s, each value rounded to its field's step (R5-42) | The schema bounds no duration, y or spring duration from above; the theme bridge caps a duration at 500 ms (R2-08), so a larger value would export as 500 |
| D6: the 3D code loads "with the flat view as the loading state" | The 3D panel shows "Loading the 3D view…" while its chunk loads; the flat view beside it is always shown (R5-39) | D4 makes the flat view always present, so a loading copy would show the same figure twice |
| D2: no oklch-picker code, and "the README credits it as inspiration only" | Kept: the README's "Credits" names oklch-picker (MIT, Evil Martians) as the explorer's inspiration, with no code taken (11.4, section 20); listed here because the first draft left it out | The mesh is dyelot's own (R5-07), so the credit is the only notice owed |
| G3: the Player has "controls, a poster frame, and an error fallback" | No Player controls and no `renderPoster`: dyelot's own "Pause" button (`aria-pressed`) drives the Player through its ref, and under reduced motion the Player opens on frame 179, the finished picture, which serves as the still (R5-52) | The Player's seek bar is a pointer-only `div` and its full-screen icon is 16 px (`@remotion/player` 4.0.539, `dist/esm/index.mjs`), below the 24 px target; a poster over an autoplaying preview would only flash |
| C1: six hero designs "generated on the server with `generateSystem` …, memoized at module scope" | The six `HeroCard`s are committed data, `src/features/landing/hero-cards.json`, which a unit test rebuilds with `generateSystem` and compares; the server generates only the first design, memoized per design, for the story and the default of `/explore` and `/motion` (R5-31) | Six designs took 986 ms warm plus 298 ms for the engine's first call (measured 2026-11-06), which every new server instance would add to its first page |
| F1: the token row shows "the CSS variable name `--color-<palette>-<step>`" with Copy | The row shows the Tailwind token `--color-<palette>-<step>` with its class `bg-<palette>-<step>`, and the variable `var(--<palette>-<step>)`, which Copy writes (R5-47) | `--color-<palette>-<step>` exists only in `@theme inline` (as for B7), so pasted CSS needs the `:root` variable |
| A1 and A2 leave out three items earlier specs deferred to M5 | M2's mobile-sheet reduced-motion item is fixed (R5-49); tokens for the unexpressed style traits and animations in `theme.css` are not scheduled (R5-03) | The sheet item is a reduced-motion bug, and M5 is done when every reduced-motion case passes; the other two would change every golden (K5) |

## 2. Decisions M5 implements

**The owner's standing rulings (2026-11-04 and 2026-11-05).**

- **Spec before code.** This spec is approved before any plan or code.
- **Merge when green.** Once `pnpm gate:full` and CI pass, the pull request merges without a further stop, and the owner
  is told.
- **Parallel lanes.** The owner chose parallel lanes and lighter per-task test runs for M3, and that style carries into
  M5. Each lane runs its end-to-end suite on a port of its own with `reuseExistingServer: false` (the lesson of a shared
  workstation's port 3100).
- **No secret.** M5 sets no Vercel variable and holds no key: Remotion's Free License is declared with the literal
  `licenseKey: "free-license"`.

**The controller's decisions (2026-11-06)**, A to L, are stated by the rulings that cite them, and section 1's second
table lists where this spec departs from them.

**Constraints for every task.** Spec-TDD: each case's test first, red, then code, then green, each test named with its
case id. R-05 in every pure module, every helper this spec names and every function of `src/flavor/`: a wrong type is a
`TypeError`, an out-of-domain value a `RangeError`, each message starting with the function's name, and every argument's
type is checked before any value's domain. Pure core and imperative shell: `src/engine`, `src/spec`, `src/theme` and
`src/export` read no DOM, storage, network, clock, randomness, environment, locale or Web Crypto; everything that touches
WebGL, WebCodecs, the DOM or a timer is a shell. The UI never shows a raw error (I-M2-03). Every zod schema imports `z`
from `src/spec/zod.ts` (jitless, so no schema needs `'unsafe-eval'`). Copy is American English with no emoji, no
exclamation mark and none of the words simply, just, easy, obviously or basically. A flow asserts state (data attributes,
which fallback shows, which chunks loaded, the files downloaded), never frame counts or timing, except the render and
record budgets Task 5.0 records. No test touches the network (R4-58). Property cases use fast-check with the seed 5000
plus the task number. Nothing calls `flushSync` inside a transition. No `<video>` element exists anywhere.

## 3. Rulings

### Scope and layers (every task)

**R5-01 · What M5 delivers.**

| Piece | Where | Without WebGL2 or WebCodecs | Under reduced motion |
|---|---|---|---|
| Hero shader | `/`, one of six server-made designs | The CSS gradient and a sentence | One still frame at phase 0; no Pause button |
| Scroll story | `/`, five server-rendered steps | Needs neither | Every step in its final state |
| 3D explorer | `/explore` | The flat SVG view and a sentence | No damping; nothing moves by itself anyway |
| Motion lab | `/motion` | Needs neither | The previews' "Reduced motion" switch starts on |
| View transitions | `/studio`: the template switch and the token row | Needs neither (no animation without browser support) | Every view-transition animation takes 0 s; the canvas's "Reduce motion" also stops the template cross-fade |
| Flavor dialog | `/studio`, the toolbar's "Flavor" | The shader preview's CSS gradient; render and record replaced by sentences without WebCodecs | The shader preview is still; the Player does not autoplay; render and record still work |
| `flavor/` files | The export dialog's "Include flavor files" | Text files; need neither | The shipped runtime honors the setting itself |

Done when every fallback and reduced-motion case of section 14 passes, with the rest of section 14 (umbrella section 14).
**(decision A1)**

**R5-02 · Out of M5.** No WebGL in the studio's canvas templates: umbrella §11's "canvas backgrounds" become the Flavor
dialog's preview, because text over a moving shader cannot be held to the contrast the receipt promises and the canvas
tests resolve painted colors. No `/about` page, gallery, share cards or landing polish beyond the hero and the story (M6).
No GIF, glTF, dotLottie, palette nebula, WebGPU, GSAP code, Lenis, Paper Shaders, detect-gpu, `postprocessing`,
`@remotion/cli`, `@remotion/three` or audio in any video. No `<video>` element: the outputs are downloads, so the CSP needs
no `media-src`. **(decision A2)**

**R5-03 · Not scheduled.** The cosine and Poline-style generators M1 deferred to "M5 (shader backgrounds)"
(`01-color-engine.md`, section 18) are not scheduled: the shader's palette is an OKLab interpolation of five solved steps
(R5-16), which keeps every displayed color tied to the scales. Two more items earlier specs deferred to M5 are not
scheduled either, because each would change every golden (R5-63): tokens for the unexpressed style traits (hard offset
shadows, blur, grain; `02-studio.md` and `03-export.md`, section 18, decision D2 of M3), which M3 writes as prose in
`DESIGN.md`, and animations and keyframes in `theme.css` (`03-export.md`, section 18). Owner approval items 3 and 8.
**(decision A3; the two inherited items drafter)**

**R5-04 · Layers.**

- Pure, in `src/engine/` (floors 95, 95, 95, 90): Rec. 2020 conversion, `gamutSolid`, `gamutSlice`, `solidPosition`,
  `flavorStops`, `flavorSeed`, the motion presets, `normalizeMotionTokens`, the `motionTokens` parameter, `withMotion` and
  `bezierPoints` (5.1).
- Pure, in `src/export/` (90, 90, 90, 85): `brandProps`, `mediaName` and the flavor file generators (5.3).
- Shipped sources, in `src/flavor/` (R5-05): `flavor.mjs` (the vanilla WebGL2 runtime), `flavor-react.tsx` (the React
  wrapper), `remotion/brand-intro.tsx` (the composition), `remotion/root.tsx` (its Remotion root) and
  `remotion/brand.json` (the root's default props).
- Browser shells: `src/features/landing/`, `src/features/explore/`, `src/features/motion/`, `src/features/flavor/`, and
  edits to `src/features/studio/`, `src/features/preview/` and `src/features/export/`. Their pure helpers are named in
  `vitest.config.ts`'s helper lists (section 15).
- Routes: `src/app/explore/page.tsx`, `src/app/motion/page.tsx`, and `src/app/page.tsx` rebuilt.

**(decision A4)**

**R5-05 · `src/flavor/` is self-contained.** A file under `src/flavor/` imports only `react`, `remotion`, and files of
`src/flavor/` by relative path (`./flavor.mjs`, `./brand-intro`, `./brand.json`); it imports nothing from `@/`, from
another folder of the repository or from any other package. The app imports `flavor.mjs`, `flavor-react.tsx` and
`remotion/brand-intro.tsx` as code, and the export ships `flavor.mjs`, `flavor-react.tsx`, `remotion/brand-intro.tsx` and
`remotion/root.tsx` byte for byte through `?raw` (as M3 ships the checker and M4 reads its prompts), so the exported code
is the code the flows exercise. `remotion/root.tsx` is never imported as code: it calls `registerRoot`, which only a
Remotion project should run. No code file of `src/flavor/` (an extension of the checker's `SCAN_EXTENSIONS`) holds a
color literal: every line of `flavor.mjs`, `flavor-react.tsx`, `brand-intro.tsx` and `root.tsx` scans clean with the
checker's `scanLine` (R5-26). `remotion/brand.json` is data, full of the design's hexes, and the checker never scans
`.json`. **(decision A4; the folder list, the JSON and the scan drafter)**

### Engine color (Task 5.1)

**R5-06 · Rec. 2020 joins the engine as a solid-only space.** `src/engine/color/rec2020.ts` converts encoded Rec. 2020
channels to OKLab and back, for the explorer's solid and slice only; the spec's `Gamut` stays `"srgb" | "p3"`, and
`SOLID_GAMUTS` is `["srgb", "p3", "rec2020"]`. The transfer function is CSS Color 4's `rec2020`, the reference EOTF of
ITU-R BT.1886 with gamma 2.4: linear = sign(v) × |v|^2.4, and its inverse |v|^(1/2.4) with the sign kept. It is not
BT.2020's camera OETF (α 1.0993, β 0.0181), which colorjs.io 0.7.1 names `--rec2020-oetf`. The matrices are those of
colorjs.io 0.7.1's `rec2020-linear` (the CSS Color 4 values):

```text
linear Rec. 2020 to XYZ (D65)                                        XYZ (D65) to linear Rec. 2020
[ 0.6369580483012914, 0.14461690358620832,  0.1688809751641721  ]    [  1.716651187971268, -0.355670783776392, -0.253366281373660  ]
[ 0.2627002120112671, 0.6779980715188708,   0.05930171646986196 ]    [ -0.666684351832489,  1.616481236634939,  0.0157685458139111 ]
[ 0.0,                0.028072693049087428, 1.060985057710791   ]    [  0.017639857445311, -0.042770613257809,  0.942103121235474  ]
```

XYZ to OKLab uses M1's `XYZ_TO_LMS` and `LMS_TO_OKLAB` (`src/engine/color/convert.ts`). The gamut's boundary is the
same for either transfer function, because each maps 0 to 0 and 1 to 1. colorjs.io's `rec2020` space is the test oracle
(within 1e-7 per OKLab coordinate). **(decision D2; the transfer function and the matrices drafter)**

**R5-07 · `gamutSolid(gamut, steps)`.** Meshes each of the six faces of the gamut's RGB cube as a grid of `steps × steps`
cells, in the gamut's own encoded RGB, so a face has `(steps + 1)²` vertices; vertices on shared edges repeat, one copy
per face. The faces come in this order, each with its two free channels as `(u, v)`: r = 0 `(g, b)`, r = 1 `(g, b)`,
g = 0 `(r, b)`, g = 1 `(r, b)`, b = 0 `(r, g)`, b = 1 `(r, g)`. Vertex `(i, j)` of face `f` (`u = i / steps`,
`v = j / steps`) has the index `f × (steps + 1)² + j × (steps + 1) + i`; each cell gives the triangles `(a, b, c)` and
`(b, d, c)` with `a = (i, j)`, `b = (i + 1, j)`, `c = (i, j + 1)`, `d = (i + 1, j + 1)`. Each vertex's position is
`solidPosition` of its OKLab color (R5-08). Its color is the sRGB display color: the vertex's own channels for `srgb`, and
`gamutMap(<its OKLCH>, "srgb")` for `p3` and `rec2020`. `steps` is a whole number from 1 to 64 (so every index fits a
`Uint16Array`); the explorer uses 32. **(decision D2; the face order, the index layout and the bound drafter)**

**R5-08 · `gamutSlice(gamut, l)` and `solidPosition(color)`.** `gamutSlice` gives 360 points, `h` = 0, 1, …, 359, each
with `c` the largest chroma that stays in the gamut at lightness `l` and that hue: M1's `maxChroma` bisection on [0,
0.5] with 24 iterations (M1 documents that 24 land within 0.5 / 2^24 of the edge) for `srgb` and `p3`, and for `rec2020`
a sibling bisection over `oklchToRec2020` with `maxChroma`'s constants (`maxChroma` and `Gamut` stay as they are, so
M1's `RangeError` for an unknown gamut stands), and `c` rounded with `round6`. `l` lies in [0, 1]; a gray outside the
gamut gives `c` 0, as `maxChroma` does. `solidPosition` maps an OKLCH color to the explorer's space: OKLab `(L, a, b)`
becomes `x = 2a`, `y = L − 0.5`, `z = 2b`, so the solids are centered on the origin, one unit high, and the sRGB solid's
widest point lies about 0.65 from the axis. **(decision D2, D4; the iterations and the scale drafter)**

### Engine motion (Task 5.2)

**R5-09 · Motion tokens become a parameter.** `DirectionParams` gains an optional `motionTokens`, the exact
`MotionTokens` shape of `src/engine/tokens/motion.ts`. `normalizeMotionTokens(tokens, name)` reads it: a plain object
with exactly the keys `durations`, `easings` and `springs`; `durations` with exactly the seven names of
`MOTION_DURATION_NAMES`, each a finite number at least 0; `easings` with exactly the four names of
`MOTION_EASING_NAMES`, each an array of four finite numbers whose first and third lie in [0, 1]; `springs` with exactly
the three names of `MOTION_SPRING_NAMES`, each a plain object with exactly `visualDuration` (finite, above 0) and
`bounce` (finite, in [0, 1]). These are the schema's motion bounds (`src/spec/schema.ts`, `LengthSchema`,
`BezierSchema`, `SpringSchema`). A value of the wrong type (a non-object, an array where an object belongs, a non-number,
a missing key, which reads as `undefined`) is a `TypeError`; an unknown key, an array of another length, or a number out
of its domain is a `RangeError`; each message starts with `name` (default `"normalizeMotionTokens: tokens"`) and the
path, as `generateSystem: params.motionTokens.easings.standard[0]`. It returns a new, deeply frozen object with every
number passed through `round6` and the keys in the order of the name lists, which is the form the spec stores.
**(decision E1; the messages and the stored form drafter)**

**R5-10 · `generateSystem` and `paramsOfSpec`.** `generateSystem` reads `params.motionTokens` with
`normalizeMotionTokens(value, "generateSystem: params.motionTokens")` before it draws or solves anything, and writes
`motion: { feel, ...tokens }` with those tokens in place of `motionTokens()`; without the key it writes `motionTokens()`
as before, so every existing design, golden and spec id is unchanged. `paramsOfSpec(spec)` returns `motionTokens` (the
spec's `durations`, `easings` and `springs`, copied) only when `sameMotionTokens(spec.motion, motionTokens())` is false.
`sameMotionTokens` compares the three groups by name and number with `===`. So generating from what a spec records still
gives the same spec (C-GEN-13), and a design with the default tokens records no `motionTokens`. **(decision E1)**

**R5-11 · `withMotion(spec, tokens)`.** Returns the spec `generateSystem` would return for the spec's own parameters
with `motionTokens: tokens`, without running the solver: the spec with `motion` replaced by `{ feel: spec.motion.feel,
...normalizeMotionTokens(tokens, "withMotion: tokens") }`, passed through the same canonical round trip and
`DesignSpecSchema.parse` that end `generateSystem`. It checks `spec` with `normalizeSpec`'s rules first (a non-object is a
`TypeError`, a spec that fails the schema the `RangeError` of `normalizeSpec`, renamed to start with `withMotion`). A
property case proves the equality for any parameters, seed and tokens (C-MOT5-08), so the lab never runs the solver.
It lives in `src/engine/generate.ts`, beside `generateSystem`, the one engine file that may import the spec's canonical
form and schema as values (C-REPO-02). **(decision E1; the file drafter)**

**R5-12 · Five motion presets.** `MOTION_PRESETS` holds five token sets with descriptive ids and no design-system or
brand name in an id, a label or a note. Every value lies inside the schema's bounds and the lab's caps (R5-42); the
durations stay at or below 500 ms, the cap the theme bridge applies (R2-08).

| Id | Label | Durations, ms: instant, fast, quick, base, slow, slower, slowest | Easings: standard, decelerate, accelerate, emphasized | Springs (visual duration s, bounce): snappy, smooth, bouncy | Note |
|---|---|---|---|---|---|
| `dyelot` | dyelot | 50, 100, 150, 200, 300, 400, 500 | [0.2, 0, 0, 1], [0, 0, 0, 1], [0.3, 0, 1, 1], [0.05, 0.7, 0.1, 1] | (0.25, 0.1), (0.4, 0), (0.5, 0.35) | dyelot's default: 50 to 500 ms, standard curves and three springs. |
| `productive` | Productive | 40, 70, 110, 150, 240, 320, 400 | [0.2, 0, 0.38, 0.9], [0, 0, 0.38, 0.9], [0.2, 0, 1, 0.9], [0.4, 0.14, 0.3, 1] | (0.2, 0), (0.3, 0), (0.4, 0.15) | Short and efficient, for tools people use all day. |
| `expressive` | Expressive | 70, 110, 150, 240, 400, 450, 500 | [0.4, 0.14, 0.3, 1], [0, 0, 0.3, 1], [0.4, 0.14, 1, 1], [0.05, 0.7, 0.1, 1] | (0.3, 0.2), (0.5, 0.1), (0.6, 0.45) | Longer and livelier, for moments worth noticing. |
| `gentle` | Gentle | 80, 150, 200, 300, 400, 450, 500 | [0.33, 0, 0.67, 1], [0, 0, 0.2, 1], [0.4, 0, 1, 1], [0.05, 0.7, 0.1, 1] | (0.35, 0), (0.6, 0), (0.7, 0.2) | Soft starts and ends, for calm reading. |
| `snappy` | Snappy | 30, 60, 90, 120, 180, 240, 300 | [0.2, 0, 0, 1], [0, 0, 0, 1], [0.3, 0, 1, 1], [0.2, 0, 0, 1] | (0.15, 0.05), (0.25, 0), (0.35, 0.3) | Quick and direct, for dense interfaces. |

`dyelot` deep-equals `motionTokens()`. The others follow the published numbers RR-0029 and `05-design-principles.md`
collect: the productive and expressive curve pairs and the 70 to 700 ms ladder (cut at 500), the ease-in-out curve
(0.33, 0, 0.67, 1), the ease-out curve (0, 0, 0.2, 1), and the emphasized decelerate curve; the springs keep the house's
visual-duration and bounce model. The source file's comment names RR-0029's rows; nothing shown to a visitor does.
`motionPresetOf(tokens)` is the first id in `MOTION_PRESET_IDS` whose tokens `sameMotionTokens` with the normalized
input, else `null` ("custom"). **(decision E2; the values drafter)**

**R5-13 · `bezierPoints(easing, segments)`.** Samples the cubic Bézier with control points `(0, 0)`, `(x1, y1)`,
`(x2, y2)` and `(1, 1)` at `t = i / segments` for `i` = 0 to `segments`, giving `segments + 1` points `[x, y]`, each
coordinate rounded to 4 decimals (−0 written as 0); the first point is `[0, 0]` and the last `[1, 1]`. `easing` follows
`BezierSchema` (x1 and x2 in [0, 1], y1 and y2 finite) and `segments` is a whole number from 2 to 256. The lab draws its
four easing curves with 64 segments. **(decision A4, E3; the sampling drafter)**

**R5-14 · The studio accepts the field.** `DIRECTION_PARAM_KEYS` gains `"motionTokens"` as its last entry, so a draft or
a patch may hold it. `parseParams` accepts a `motionTokens` that `normalizeMotionTokens` accepts and gives `null` for any
other. In `mergeParams` a patch's `motionTokens` replaces the whole set, and `motionTokens: undefined` removes it, as
`name` does. `touchesPreset` ignores it and `applyPreset` keeps it: the presets own the motion feel, never the tokens.
The worker protocol is unchanged: `runGenerate` hands the parameters to `generateSystem`, which checks them (R5-10).
`presetOf` is unchanged. **(decision E1; `mergeParams`, `touchesPreset` and `applyPreset` drafter)**

**R5-15 · No budget and no stored policy.** M1 left the motion budget and the reduced-motion policy out of the schema
(R-19) for M2 and M3 to add; neither did (`02-studio.md` and `03-export.md` hold no budget, and the schema's `motion` is
`feel`, `durations`, `easings` and `springs`). M5 adds neither. The reduced-motion policy stays the fixed block of
`motion/motion.css` (R3-20, C-MOT-02): each spring becomes `linear(0, 1)` and each settle time `var(--duration-fast)`.
**(decision E5)**

### Flavor core (Task 5.3)

**R5-16 · `flavorStops(spec, mode)` and `flavorSeed(id)`.** `flavorStops` gives five hexes read from
`spec.color.palettes.<palette>.<mode>`, never re-derived, at the steps of `FLAVOR_STEPS`: neutral 100 (the quiet ground),
primary 200, secondary 400, accent 400 and primary 500. The same steps serve both modes, because a step's number means
the same distance from the page in each (the dark scales solve the same targets against the dark page), so in light mode
the ground is near white and in dark mode near the page. `flavorSeed(id)` reads a spec id, 16 lowercase hex digits
(`specId`), and gives `[x, y]` with `x = parseInt(id[0..8], 16) / 2^32 × 100` and `y = parseInt(id[8..16], 16) / 2^32 ×
100`, each rounded to 4 decimals: the same design always looks the same. A wrong type is a `TypeError`; a mode other than
`light` or `dark`, or an id that is not 16 lowercase hex digits, a `RangeError`. **(decision B2, B3; the steps and the
seed formula drafter)**

**R5-17 · The shader.** dyelot's own WebGL2 code in `flavor.mjs`: `#version 300 es`, one fullscreen triangle drawn from
`gl_VertexID` with no vertex buffer; no Shadertoy, whatamesh, Vanta or Paper Shaders code. The fragment shader takes
`u_resolution` (vec2), `u_phase` (float, radians), `u_seed` (vec2), `u_from[5]` and `u_to[5]` (vec3 arrays, sRGB 0 to 1),
`u_mix` (float, 0 to 1) and `u_grain` (float). With `p = gl_FragCoord.xy / u_resolution.y × 1.6 + u_seed` and θ =
`u_phase`, the field is

```text
n = 0.5 + 0.5 × ( 0.55 × snoise(1 × p + 0.60 × (cos 1θ, sin 1θ))
                + 0.30 × snoise(2 × p + 0.40 × (cos 2θ, sin 2θ))
                + 0.15 × snoise(4 × p + 0.25 × (cos 3θ, sin 3θ)) ),  clamped to [0, 1]
```

where `snoise` is 2D simplex noise adapted from stegu/webgl-noise (MIT): the header of its 2D file (Ian McEwan, Ashima
Arts) and its LICENSE's copyright lines (Ashima Arts, Stefan Gustavson) and permission notice, copied verbatim from the
upstream files at Task 5.3, stay in a comment above it and so in the export. `n` picks a place on the five stops:
segment `k = min(3, floor(n × 4))` and `f = n × 4 − k`; the color is the OKLab mix of stops `k` and `k + 1` by `f`, for
the `u_from` set and for the `u_to` set, then the OKLab mix of those two by `u_mix`, converted back to sRGB. sRGB to
OKLab inside GLSL is the sRGB decode, the matrix to LMS, the cube root and the matrix to OKLab, and back the reverse,
with M1's matrices, so no lookup texture exists. A grain of `(hash(floor(gl_FragCoord.xy)) − 0.5) × u_grain` is added to
each channel, then clamped to [0, 1]; `u_grain` is `GRAIN`, 0.035 (3.5%, inside the research's 2 to 5%), and does not
depend on time. Time enters only through θ = 2π × (t mod 10) / 10 (`LOOP_SECONDS` 10): every noise sample moves on a
circle with a whole number of turns per loop (1, 2 and 3), so a draw at phase 0 and one at phase 2π are the same image,
and the 300 frames of one loop at 30 frames a second join without a seam. **(decision B1, B2, B3, B4; the field's
constants drafter)**

**R5-18 · The runtime's behavior.** The drawing buffer follows the canvas's CSS size times the device pixel ratio,
capped at `MAX_DPR` 1.5, then scaled down as a whole to fit within 1920 × 1080 (`bufferSize`); a `ResizeObserver` keeps
it current. The loop is one `requestAnimationFrame` chain that advances the phase only while it runs, so a pause freezes
the image and a resume continues from the frozen phase. It pauses while the canvas is off-screen (an
`IntersectionObserver` with threshold 0) and while the page is hidden (`visibilitychange`). Under reduced motion (the OS
setting `prefers-reduced-motion: reduce`, followed live through `matchMedia`'s `change` event, or `reducedMotion: true`)
it draws one still frame at phase 0 and runs no loop. `setStops` cross-fades from the shown stops to the new ones over
`fade.durationMs` with `fade.easing` (by default the `dyelot` preset's `base` 200 ms and `standard` [0.2, 0, 0, 1]), by
moving `u_mix` from 0 to 1; a new `setStops` during a fade starts from the colors shown at that moment; under reduced
motion the swap is at once, and entering `still` during a fade ends it at its target (`u_mix` 1). The runtime writes its
state on the canvas: `data-flavor` is one of `running`, `paused`, `offscreen`, `hidden`, `still` or `fallback` (the
first that holds, in the order `fallback`, `still`, `paused`, `hidden`, `offscreen`, `running`), `data-flavor-reason`
the fallback's reason while `fallback`, and `data-flavor-stops` the target stops joined by commas. Wherever it loops,
the host shows a Pause button with `aria-pressed` (WCAG 2.2.2, moving content over 5 s); where it does not loop (still,
fallback), the host shows no Pause button. **(decision B5; the attributes, the precedence and the fade's defaults
drafter)**

**R5-19 · Fallbacks.** No WebGL2 context, or a shader that fails to compile or link, is the `no-webgl2` fallback: the
runtime never shows a raw error, logs nothing, sets the CSS fallback (R5-20) as the canvas's own background and calls
`onFallback("no-webgl2")`. A `webglcontextlost` event stops the loop, calls `preventDefault()`, sets the CSS fallback and
calls `onFallback("context-lost")`; the host shows its sentence and "Restart the animation", which mounts a new canvas.
A `webglcontextrestored` event alone restarts nothing. **(decision B6)**

**R5-20 · The CSS fallback.** `flavorBackground(stops)` in `flavor.mjs` gives `{ backgroundColor: stops[0],
backgroundImage: GRAIN_URL + ", linear-gradient(in oklch 135deg, " + stops[0] + " 0%, " + stops[1] + " 25%, " + stops[2]
+ " 50%, " + stops[3] + " 75%, " + stops[4] + " 100%)" }`, where each stop is a `#rrggbb` hex or a `var(--name)`
reference, and `GRAIN_URL` is `url("data:image/svg+xml,<encodeURIComponent(GRAIN_SVG)>")` with `GRAIN_SVG` exactly:

```text
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0.07 0 0 0 0"/></filter><rect width="160" height="160" filter="url(#g)"/></svg>
```

a mid-gray noise whose alpha averages about 0.035 and which names no color, so it passes the checker (`img-src data:` is
allowed). The exported `flavor/flavor.css` writes the same declarations for the class `.dyelot-flavor`, with the stops
`var(--neutral-100)`, `var(--primary-200)`, `var(--secondary-400)`, `var(--accent-400)` and `var(--primary-500)`: the
variables `app/theme.css` defines in `:root` and again in `.dark`, so the file holds no color literal and follows the
mode. **(decision B7; the variable names depart, section 1; the gradient's angle, offsets and grain drafter)**

**R5-21 · The runtime's API.** `flavor.mjs` exports `mountFlavor(canvas, options)`, which returns a `FlavorHandle`
`{ setStops(stops), setPaused(paused), drawAt(fraction), destroy() }`, and `supportsFlavor()`, plus the pure
`flavorBackground`, `bufferSize`, `easeAt` and the constants of 5.2. `options` holds `stops`, `seed`, and optionally
`reducedMotion`, `fade`, `size` (a fixed drawing buffer, for the recording), `autoplay` (default true; false draws phase
0 and waits for `drawAt`; it also asks for `preserveDrawingBuffer: true`) and `onFallback(reason)`. `drawAt(fraction)`
draws one frame at phase 2π × fraction with no fade, `fraction` in [0, 1], in every state but `fallback` (`still`
included), and stops the loop. `destroy()` stops everything, removes every listener and observer and
releases the context with `WEBGL_lose_context` when the extension exists; a call on a destroyed handle is a no-op.
`flavor-react.tsx` exports `<Flavor stops seed paused reducedMotion fade onFallback className />`, one `<canvas
aria-hidden="true">` whose inline style is `flavorBackground(stops)` from the first render, so the still gradient shows
on the server, before the runtime mounts and with JavaScript off. It mounts in an effect, calls `setStops` and `setPaused`
when those props change, and destroys on unmount. `seed`, `fade` and `reducedMotion` are read at mount: the canvas is
keyed on their values, so a change of any of them mounts a new canvas (a context cannot be reused after `destroy`), while
a change of `stops` cross-fades on the same one. A host restarts it by changing its `key`. Every function checks its
arguments by R-05 and names itself.
**(decision B8; `fade`, `size`, `autoplay` and `drawAt` drafter)**

**R5-22 · The composition source.** `src/flavor/remotion/brand-intro.tsx` opens with the comment block

```text
// Built with Remotion (https://www.remotion.dev).
// Remotion is not open source: read its license at https://remotion.pro/license before you use this file.
// Companies of four or more people need a Remotion Company License.
// This composition was exported by dyelot (MIT); the Remotion package it imports is under Remotion's license.
```

and exports `BrandIntro` (1280 × 720, 30 frames a second, 180 frames, 6 s), `BRAND_INTRO`, `BRAND_TIMELINE`,
`springAt` and the type `BrandProps` (5.2). It takes plain props from `brandProps` (R5-30) and shows, in this order: the
name entering on the `smooth` spring (frames 0 to 30, the one-liner 6 frames later); the five palettes' scales building
row by row on the `snappy` spring (row `r` from frame 30 + 12r, step `i` of a row 2i frames later); a role specimen on
the `bouncy` spring from frame 96 (a card in the card colors with a border, the name in the display face, the one-liner
or "Made with dyelot." in the body face, and a primary button "Get started"); and from frame 132 the receipt line and the
lot tag, faded in over the design's `base` duration with its `standard` easing. It uses only the web renderer's CSS
subset: flex layout, `transform`, `opacity`, `background-color`, borders, `border-radius`, text properties and
`linear-gradient` at most; no `z-index` (the DOM order draws back to front), no radial or conic gradient, no
`backdrop-filter`, `perspective`, `transform-style`, inset or spread shadow, filter, `mix-blend-mode`, `object-position`
or `clip-path` with a URL, and no color but the hexes of its props (no `oklch()`, `rgb()` or named color). A guard scans
the source (C-GUARD5-07). `root.tsx` exports `RemotionRoot`, which registers the compositions `brand-intro-light` and
`brand-intro-dark` with `brand.light` and `brand.dark` of `./brand.json` as their default props, and calls
`registerRoot(RemotionRoot)`. The repository's `src/flavor/remotion/brand.json` is the `flavor/remotion/brand.json` of
the `default-flavor` golden, byte for byte (C-FEX-12), so `root.tsx` type-checks in the repository. **(decision G2; the
timeline, the specimen and the JSON drafter)**

**R5-23 · A raw rule for `*.tsx`.** `next.config.ts`'s Turbopack rules gain `"*.tsx": { condition: { query:
/[?&]raw(?=&|$)/ }, type: "raw" }` beside the `*.mjs` and `*.md` rules (`NDOCS/01-app/03-api-reference/05-config/
01-next-config-js/turbopack.md`, "Advanced webpack loader conditions" and the `raw` module type), and `src/types/raw.d.ts`
declares `"*.tsx?raw"`. The condition makes the rule fire only with the query, so every other `.tsx` import compiles as
before (probe 3). `tsconfig.json`'s `include` gains `src/flavor/*.mjs`, and `flavor.mjs` starts with `// @ts-check` and
types itself with JSDoc, as the checker does. **(decision K1; the JSDoc typing drafter)**

### Export (Task 5.4)

**R5-24 · Flavor files, on request.** `BundleInput` gains `flavor?: boolean`, absent meaning false; a value that is not a
boolean is a `TypeError` naming `buildBundle: input.flavor`. With it false the bundle is byte-identical to M4's. With it
true, nine files join right after `motion/gsap.ts`, in this order, and `receipt.json` lists them like any file:

| # | Path | Text |
|---|---|---|
| 1 | `flavor/README.md` | Generated (12.1) |
| 2 | `flavor/flavor.mjs` | `src/flavor/flavor.mjs`, raw |
| 3 | `flavor/flavor-react.tsx` | `src/flavor/flavor-react.tsx`, raw |
| 4 | `flavor/flavor.css` | Generated: the `.dyelot-flavor` rule of R5-20 under the three header comments of M3's CSS files |
| 5 | `flavor/palette.json` | Generated: `{ name, loopSeconds: 10, seed, fade, light, dark }` (12.1) |
| 6 | `flavor/remotion/README.md` | Generated (12.1) |
| 7 | `flavor/remotion/brand-intro.tsx` | `src/flavor/remotion/brand-intro.tsx`, raw |
| 8 | `flavor/remotion/root.tsx` | `src/flavor/remotion/root.tsx`, raw |
| 9 | `flavor/remotion/brand.json` | Generated: `{ light: brandProps(spec, "light"), dark: brandProps(spec, "dark") }` |

The bundle then holds 27 to 30 files. Every path keeps R3-09's rules, with `README.md` added to the three capitalized
names `zipBundle` allows (`DESIGN.md`, `AGENTS.md.snippet`, `SKILL.md`). Every text keeps R3-09's text rules and R3-11's
JSON layout. **(decision I1; the order inside `flavor/` and `README.md` as a fixed name drafter)**

**R5-25 · Videos are not in the zip.** The brand video and the shader loop are separate downloads from the Flavor dialog:
`BundleFile` stays text, a video is not byte-reproducible across browsers, and a render sends telemetry. The
`flavor/README.md` says where to get them. **(decision I2)**

**R5-26 · The receipt and the checker.** The receipt's `files` list holds the flavor files with their byte lengths and
hashes. Run on a fixture app that holds the flavor files at their bundle paths, plus copies of `flavor.mjs`,
`flavor-react.tsx`, `flavor.css` and `brand-intro.tsx` moved to `src/components/` (outside the checker's own set, so it
scans them), the bundled checker passes: none of them holds a raw color, a color function or a palette class.
**(decision I3; the moved copies drafter)**

**R5-27 · Goldens.** Every existing golden holds byte for byte. One new golden, `default-flavor`, is the `default`
preset's design built with `flavor: true`; `tests/golden/export/manifest.json` records its files and zip as it records the
others, and its files equal the `default` golden's files except `receipt.json`, with the nine flavor files inserted after
`motion/gsap.ts`. **(decision I4; the golden's design drafter)**

**R5-28 · The export entry gains three names.** `src/export/index.ts` exports exactly M3's names plus `motionFiles`,
`brandProps` and `mediaName`, and the type `BrandProps`. App code still reaches it only through `import("@/export")`.
`mediaName(spec, kind, container)` is `<slug of meta.name>-<the first 8 hex digits of the spec id>-<kind>.<container>`,
`kind` `"brand"` or `"loop"` and `container` `"mp4"` or `"webm"`. `downloadBlob(name, bytes, type)` gains its third
argument, a non-empty MIME type, default `"application/zip"`: the videos download as `video/mp4` or `video/webm`.
**(decision E3, G4, H1; `mediaName` and the MIME type drafter)**

**R5-29 · The export dialog's switch.** The export dialog gains the switch "Include flavor files", off by default and
held while the page stays open (not stored), described by "Adds the animated background, its CSS fallback and the
Remotion source of the brand video: nine text files." Turning it on or off rebuilds the bundle; the file list, the
receipt and the download follow. **(decision I1; the description and the lifetime drafter)**

**R5-30 · `brandProps(spec, mode)`.** Pure, in `src/export/brand.ts`: the plain props of `BrandIntro` (5.2), every field
a string, a number or an array or object of those, so `brand.json` imports with no cast: the name; the one-liner or `""`;
the lot tag; `checks` as `{ passed, required }` from `summarize(measureSpec(spec), lintSpec(spec), gamut).contrast`
(`requiredPass` and `required`); the five palettes primary, secondary, accent, neutral and danger, each its name and its
11 hexes in the mode; the role hexes `background`, `foreground`, `card`, `cardForeground`, `primary`,
`primaryForeground`, `mutedForeground` and `border` in the mode; the display and body font stacks `themeVars(spec,
mode)` writes for `--font-display` and `--font-body`; and `motion`: `baseMs` (the stored `base`), `standard` (the stored
easing) and, for each spring, `springCurve`'s `settleMs` and `samples`. **(decision G2; the field list drafter)**

### Landing (Task 5.5)

**R5-31 · Six hero designs.** `src/features/landing/heroes.ts` holds `HERO_PARAMS`, `heroSpec(index)`, which runs
`generateSystem({ ...freshParams(), primary, name }, seed)` for one design and memoizes it per design and per server
instance, and `heroCards()`, which builds `HeroCards` from all six: `seed` `flavorSeed(specId(<the first spec>))`, `fade`
`{ durationMs: motion.durations.base, easing: motion.easings.standard }` of the first spec, and per design a `HeroCard`
with the name, `href` `/studio#s=<encodeSpec(spec)>` and `stops` `flavorStops(spec, "dark")` (the page is dark). The
landing does not run `heroCards()`: its value is committed as `src/features/landing/hero-cards.json`, which C-LAND5-02
rebuilds and compares, and writes with `DYELOT_UPDATE_HEROES=1` (refused when `CI` is set), as M3's goldens do. Six
generations took 986 ms warm plus 298 ms for the engine's first call (2026-11-06), so a server instance's first `/` now
generates only `heroSpec(0)` for the story.

| # | Name | Seed | Primary seed (OKLCH) | Its hex |
|---|---|---|---|---|
| 1 | Madder | `hero-madder` | 0.70 0.17 22 | `#f66c6d` |
| 2 | Weld | `hero-weld` | 0.82 0.15 95 | `#e3c23b` |
| 3 | Verdigris | `hero-verdigris` | 0.68 0.11 165 | `#4bae87` |
| 4 | Woad | `hero-woad` | 0.58 0.12 235 | `#0e84b7` |
| 5 | Logwood | `hero-logwood` | 0.52 0.14 300 | `#7652ac` |
| 6 | Cochineal | `hero-cochineal` | 0.60 0.20 345 | `#cd3f9b` |

Each is a historical dye, like madder, and each seed is inside sRGB. `src/features/landing/cards.ts` holds the types
`HeroCard` and `HeroCards` and `HERO_CARDS` (the JSON) and imports no engine code. Only `src/app/page.tsx`,
`src/app/explore/page.tsx` and `src/app/motion/page.tsx` import `heroes.ts` as a value; the landing's client bundle gets
`HERO_CARDS` and no engine code (C-GUARD5-05, F-LAZY5-01). The explorer's and the lab's "server default" is
`defaultDesign()`, `heroSpec(0)`. **(decision C1; the committed cards depart, section 1; the five hues, names and seeds
drafter)**

**R5-32 · The hero.** `/` keeps the house terminal look and its one `h1`. Below the heading, a `TerminalWindow` titled
`<name, lowercase>.flavor` whose body is `<Flavor>` at a 16:9 ratio, with `HERO_CARDS`' shared `seed` and `fade` and the
current card's `stops`, and no text on the shader.
Under the window, in this order: the line "Palette <i> of 6: <name>."; "Next palette", which moves to the next card (6
wraps to 1) and cross-fades the stops by R5-18; "Pause" with `aria-pressed`, shown only while the shader loops; and the
link "Open this palette in the studio" to the card's `href`. The fallback sentences and "Restart the animation" of 6.4
sit under the controls. **(decision C1; the window title, the line and the order drafter)**

**R5-33 · The scroll story.** Below the hero, a server-rendered story of five steps in which the first hero design
assembles itself: a seed swatch; its eleven-step primary scale; the roles; type and space; the receipt's check count
(7.2 fixes every string). Each step animates with CSS `animation-timeline: view()` only inside `@supports
(animation-timeline: view())` nested in `@media (prefers-reduced-motion: no-preference)`, over `animation-range: entry
0% entry 100%`, so a step reaches its final state as soon as it is wholly in view, the last one included; outside both,
every step shows its final state, so no content waits on an animation. Movement is `opacity` and `translate` only, at
most 24 px, with no parallax. Colors appear only inside framed specimens (`[data-specimen]`). **(decision C2)**

**R5-34 · Nav, sitemap and status line.** `AppNav` shows, in this order, "home", "studio", "explore", "motion" and
"github"; its `active` union becomes `"home" | "explore" | "motion"` (the studio draws no nav). `SITE.routes.sitemap`
becomes `["/", "/studio", "/explore", "/motion"]`. The stale line "in progress: the export bundle" goes. **(decision C3;
the order drafter)**

### Explorer (Task 5.6)

**R5-35 · The stack.** Exactly three 0.186.1, `@react-three/fiber` 9.8.2 and `@react-three/drei` 10.7.9, with
`@types/three` 0.186.0 (dev). One `<Canvas>`, one viewport, no drei `View`. From drei, only `OrbitControls`, and only if
probe 1 finds the `/explore` chunk free of troika, detect-gpu, Draco, MediaPipe and every remote asset URL; otherwise
`OrbitControls` from `three/examples/jsm/controls/OrbitControls.js` and drei leaves the repository. No `postprocessing`.
The code may import only these names: from `three`, `BufferAttribute`, `BufferGeometry`, `CatmullRomCurve3`, `Color`,
`DoubleSide`, `InstancedMesh`, `Matrix4`, `MeshBasicMaterial`, `Plane`, `SphereGeometry`, `TubeGeometry` and `Vector3`;
from `@react-three/fiber`, `Canvas` and `useThree`; from `@react-three/drei`, `OrbitControls`; and, when probe 1 drops
drei, `OrbitControls` from `three/examples/jsm/controls/OrbitControls.js` and `useFrame` from `@react-three/fiber`, which
calls its `update()` each frame for damping (C-GUARD5-03). **(decision D1; the allow-list
drafter)**

**R5-36 · What the 3D view shows.** The current design's 88 steps (8 palettes × 11, in the shown mode) as instanced
spheres at `solidPosition` of their OKLCH, radius 0.02, and 0.035 for a palette's seed step in that mode; each palette's
scale as a `TubeGeometry` (radius 0.006, 64 segments) along a `CatmullRomCurve3` through its 11 points, in its step 500
color; the chosen gamut's solid (`gamutSolid(gamut, 32)`) with vertex colors, `opacity` 0.35, `depthWrite` false and both
sides drawn; and a lightness slice: `material.clippingPlanes = [new Plane(new Vector3(0, -1, 0), L − 0.5)]` on the solid
only (with the renderer's `localClippingEnabled`), no `onBeforeCompile`. The gamut radios read "sRGB", "Display P3" and
"Rec. 2020" and start at the design's own gamut; the slider "Lightness slice" runs 0 to 1 in steps of 0.01 and starts at
0.6; the mode radios "Light" and "Dark" start at light. **(decision D3; the sizes, the opacity and the starting values
drafter)**

**R5-37 · The flat view, always shown.** An SVG figure rendered on the server and in the client: for the slice's L, the
three gamuts' outlines from `gamutSlice` in polar form (angle the hue, from 0° at the right, counterclockwise; radius the
chroma, 0.5 at the edge of the plot, beyond Rec. 2020's largest chroma of about 0.47), and the steps within ±0.04 of L as
dots at their hue and chroma. It is the
accessible form of the 3D view: its caption and the list beside it name what it shows (8.3). The 3D canvas is
`aria-hidden="true"`, and a one-line summary under it says what it draws. **(decision D4)**

**R5-38 · Controls.** Pointer orbit and zoom on the canvas; for the keyboard and screen readers, the labeled sliders
"Turn" (−180° to 180°, step 1, start 35), "Tilt" (0° to 90°, step 1, start 25) and "Zoom" (0.5× to 2×, step 0.05, start
1), and the button "Reset view", which sets 35, 25 and 1. The camera looks at the origin from the distance 3.2 / zoom,
with "Turn" the angle around the vertical axis and "Tilt" the angle above the horizontal plane; a pointer gesture writes
the sliders back (rounded to whole degrees and to 0.05), so the two always agree; at tilt 90° the camera sits on the
axis, where a position names no turn, so the turn the sliders held is kept. `frameloop="demand"`, with `invalidate()` on
every control change. No auto-rotate. Damping (factor 0.1) is on unless the OS asks for reduced motion. **(decision D5;
the ranges, steps, starts and the camera model drafter)**

**R5-39 · Fallbacks and loading.** `ExploreClient` (a client component) loads `Explorer3D` with `next/dynamic(() =>
import("./Explorer3D"), { ssr: false, loading })`, whose loading state is a box of the panel's size reading "Loading the
3D view…". Before it mounts the 3D view, it checks `supportsWebgl2()`; false shows no canvas, the flat view and the
sentence "This browser cannot draw the 3D view, so the flat view below shows the same slice." A
`webglcontextlost` on the canvas unmounts the 3D view and shows "The 3D view stopped, so the flat view shows the same
slice." and "Restart the 3D view", which mounts a new canvas. An error boundary around `Explorer3D` turns an error while
creating the renderer into the no-WebGL2 state, and a chunk that fails to load into the flat view with "The 3D view could
not load. Reload the page to try again."; React reports the caught error with one `console.error`, which those two flows
allow.
**(decision D6; the loading text departs, section 1; the sentences drafter)**

**R5-40 · The data.** `/explore#s=<link>` reads the hash with `readHash`; with no hash the explorer shows the server
default (R5-31). A bad hash on load shows the default with the studio's decode sentence (`bannerFor`'s message) followed
by "The explorer shows the default design instead." A `hashchange` loads the new design; a bad one keeps the current
design, with the decode sentence followed by "The explorer keeps the current design." The studio's inspector links to
`/explore#s=<current link>` ("See these scales in the explorer"), and the explorer links back with "Open in the studio".
**(decision D7; `hashchange` and the link texts drafter)**

### Motion lab and motion tokens (Task 5.7)

**R5-41 · The lab.** `/motion#s=<link>` (or the server default) shows the design's motion tokens: the seven durations as
a ladder, the four easings as SVG curves (`bezierPoints`, 64 segments), and the three springs as SVG curves
(`springCurve`); the five preset buttons; a field per token; live previews; Copy and Download for the three motion
files; and "Open in the studio" with the edited link. Every edit makes the new spec with `withMotion` (no solver) and,
300 ms after the last change, writes `#s=<encodeSpec(spec)>` with `history.replaceState`, as the studio does. A bad hash
reads as in R5-40, with "The lab shows the default design instead." on load and "The lab keeps the current design." after
a `hashchange`. **(decision E3; the debounce drafter)**

**R5-42 · Fields and bounds.** Each token has a text field, `<input type="text" inputmode="decimal">`, so any text can be
typed and judged (a number input refuses letters and U+2212): the seven durations ("instant" to "slowest", whole ms from
0 to 500), the four easings' `x1`, `y1`, `x2` and `y2` (x from 0 to 1, y from −1 to 2, step 0.01), and the three springs'
"Duration" (0.05 to 2 s, step 0.01) and "Bounce" (0 to 1, step 0.01). A valid entry is rounded to its step and applied.
An invalid one (empty, not a number, out of range) marks the field `aria-invalid="true"`, shows its sentence (9.3) and
keeps the last valid value in the design; leaving the field restores the shown text to that value. A token loaded from a
link outside the lab's caps but inside the schema's bounds is shown as it is and stays until edited. **(decision E3; the
caps depart, section 1; the steps and the restore drafter)**

**R5-43 · Previews.** Five previews with the existing `motion` 14.3.0 kit (`m`, `LazyMotion` with `domAnimation`,
`MotionConfig`), each in a framed specimen painted with the design's light roles (`canvasStyle(spec, "light", { vision:
"none", density: "comfortable" })`), each with a Replay button: a dialog
(opacity and scale 0.96 to 1 over `slow` with `decelerate`, out over `base` with `accelerate`), a toast (rises 24 px on
the `smooth` spring), a switch (the thumb on the `snappy` spring), a tab indicator (slides on the `bouncy` spring), and a
hover (lifts 2 px over `fast` with `standard`; Replay runs it once). The "Reduced motion" switch shows what the exported
reduced-motion rules do: `MotionConfig reducedMotion="always"`, and every spring replaced by `linear(0, 1)` over the
`fast` duration. It starts on when the OS asks for reduced motion, and the visitor can turn it either way. **(decision E3;
the token for each preview drafter)**

**R5-44 · Files and links.** The lab loads `@/export` through `import()` after its first paint and builds
`motionFiles(spec, spec.meta.name, lotTag(specId(spec)), SITE.url)` whenever the spec changes, so Copy writes text the
moment it is pressed. Each of `motion/motion.css`, `motion/motion.ts` and `motion/gsap.ts` has "Copy" and "Download" and
a disclosure that shows its text; a blocked copy selects the text and shows M3's sentence. Downloads use `downloadBlob`
with `text/css` or `text/plain` and the file's base name. **(decision E3; the load timing and the disclosures drafter)**

**R5-45 · The studio's side.** Under "Motion feel" the inputs panel shows "Motion tokens: <label> preset." or "Motion
tokens: custom." and the link "Edit in the motion lab" to `/motion#s=<current link>`. **(decision E4; the strings
drafter)**

### View transitions (Task 5.8)

**R5-46 · The template switch cross-fades.** `Canvas` renders `useDeferredValue(view.template)` and wraps `<Template>`
directly in `<ViewTransition key={template} name="dyelot-template" default="none">` with `share`, `enter` and `exit`
from `templateTransition(reduced)`: `"auto"` each, or `"none"` each while the canvas's "Reduce motion" is on. Each
template renders one root element, its own `[data-template-root]`, so no wrapper element is added. Only that group
animates: the root snapshot never cross-fades (R5-48). The props change and the element never does, so turning the
switch keeps the templates' state (F-CANVAS-07). If probe 2 finds no transition for a deferred value of the store,
`Canvas` instead holds the shown template in local state set inside `startTransition` from an effect on `view.template`.
`data-template` reads the shown template. **(decision F1, F2; the name and the reduced props drafter)**

**R5-47 · A swatch becomes its token row.** In the inspector's Scales each step's row holds a button named "<palette>
<step>, <hex>" with `aria-expanded="false"`, at least 24 px tall, and each palette's buttons are one Tab stop (10.2).
Choosing it, inside `startTransition`, opens that step's token row in place (local React state; one open row at a time;
opening another closes the first). The compact row unmounts as the token row
mounts, and the two swatches share `<ViewTransition name="dyelot-swatch-<palette>-<step>" share="dyelot-morph"
default="none">`, so the swatch morphs. The token row shows its button (`aria-expanded="true"`, which closes it), the
Tailwind token `--color-<palette>-<step>` with its class `bg-<palette>-<step>`, the run-time variable
`var(--<palette>-<step>)` (the one `:root` and `.dark` of `app/theme.css` define), the hex, `formatOklch` of the step, the
contrast `<ratio to 2 decimals>:1`, "Roles: <names>" (each role whose hex in the shown mode equals the step's, in
`ROLE_NAMES` order) or "Roles: none in <mode> mode.", and "Copy" (`aria-label` "Copy var(--<palette>-<step>)"), which
writes `var(--<palette>-<step>)`. Escape inside the
row closes it; focus goes to the opened row's button on open and back to the compact row's button on close.
**(decision F1, F2; the copied variable departs, section 1; the row's fields and the focus drafter)**

**R5-48 · Reduced motion.** `src/app/globals.css` sets, under `@media (prefers-reduced-motion: reduce)`,
`animation-duration: 0s !important` and `animation-delay: 0s !important` on `::view-transition-group(*)`,
`::view-transition-old(*)` and `::view-transition-new(*)` (`NDOCS/01-app/02-guides/view-transitions.md`, "Respecting
reduced motion"), and always `::view-transition { pointer-events: none; }` ("Keeping the page interactive"),
`::view-transition-old(root) { display: none; }` and `::view-transition-new(root) { animation: none; }`, so the page
outside a named element swaps at once and never cross-fades as a whole (probe 2 records it). The morph class sets
`::view-transition-group(.dyelot-morph) { animation-duration: 250ms; animation-timing-function: cubic-bezier(0.2, 0, 0,
1); }`. The template switch also skips its cross-fade under the canvas's own toggle (R5-46). Nothing calls `flushSync`
inside a transition. **(decision F3; the morph timing drafter)**

**R5-49 · The mobile sheet under a mid-animation OS change.** M2 deferred to M5 that switching the OS setting to reduce
while the mobile template's sheet rises leaves the sheet unsettled (`02-studio.md`, section 18). `MotionScope` follows the
OS setting live through `useOsReducedMotion()`, a `useSyncExternalStore` over `matchMedia("(prefers-reduced-motion:
reduce)")` and its `change` event (the server snapshot false, the client snapshot the query's `matches`: a hydrated
page reads false during hydration and the real value right after it, and a client-only mount reads the real value from
its first render), and passes `reducedMotion="always"` when the canvas's switch or the OS
asks, else `"user"` as today, so Motion still reads the OS setting itself on a first render and an OS change takes the
path the canvas's switch already settles (F-CANVAS-07, F-CANVAS-08). **(drafter; owner approval item 9)**

### Remotion: the Flavor dialog and the brand video (Task 5.9)

**R5-50 · Pins.** Exactly `remotion`, `@remotion/player` and `@remotion/web-renderer` 4.0.539, in lockstep (the
renderer depends on `remotion` and `@remotion/licensing` at exactly 4.0.539), and exactly `mediabunny` 1.62.0, the
version the renderer depends on, so one copy ships. **(decision G1)**

**R5-51 · The Flavor dialog.** The toolbar gains "Flavor" (`aria-haspopup="dialog"`) right after "Export". It opens a
modal dialog named "Flavor" on R3-34's rules (an inert page, focus to the heading, Escape and "Close" shut it, focus
returns to "Flavor"). The dialog component loads on the first press with a plain `import()` held in the studio's state,
as M4's `useAiAction` loads `@/ai`: a failed load shows "This tool could not load. Reload the page to try again." and is
forgotten, so the next press tries again. On open the dialog loads `@/export` for `brandProps` and `mediaName`. Its three sections, "Background", "Brand video" and "Shader loop", follow the canvas's
mode, and its state ends when it closes (the privacy answer of R5-54 aside): closing aborts a render or a recording.
**(decision A1, G3; the loader, the placement, the sections and the close rule drafter)**

**R5-52 · The preview.** In "Brand video", `<Player>` (from `src/features/flavor/BrandPlayer.tsx`, loaded with
`next/dynamic(..., { ssr: false })` inside the client dialog, within an error boundary that shows the same line as
`errorFallback`) shows `BrandIntro` with `inputProps` memoized on the spec and the mode, `acknowledgeRemotionLicense`,
`numberOfSharedAudioTags={0}`, `initiallyMuted`, `controls={false}`, `clickToPlay={false}`, `loop`, `style={{ width:
"100%" }}`, `renderLoading` reading "Loading the preview…", and `errorFallback` reading "The preview could not play
here.". With no audio (R5-02) it needs no audio tag: `@remotion/player` 4.0.539 otherwise mounts five `<audio>` elements
whose `data:` source the CSP's `default-src 'self'` blocks (`numberOfSharedAudioTags` defaults to 5 while Remotion's
`ENABLE_V5_BREAKING_CHANGES` is false). Under reduced motion (the OS or the canvas's switch) it does not autoplay and opens
on frame 179, the finished picture; otherwise it autoplays. Its own controls are off (the seek bar is a pointer-only
`div` and the full-screen icon 16 px), so dyelot's "Pause" button (`aria-pressed`) under it calls the Player ref's
`pause()` and `play()`; pressing it on frame 179 plays from frame 0. The Player makes no network call (its published code
holds none). **(decision G3; no controls and no poster depart, section 1; the strings and the initial frame drafter)**

**R5-53 · The render.** "Render the brand video" shows when the browser has WebCodecs (`typeof VideoEncoder ===
"function"`); else the sentence "This browser cannot make videos. Try a recent Chrome, Edge or Firefox." stands in its
place. A click loads `@remotion/web-renderer` with `import()` and asks `canRenderMediaOnWeb({ width: 1280, height: 720,
container: "mp4", videoCodec: "h264", muted: true, outputTarget: "arraybuffer" })`, then `{ ..., container: "webm",
videoCodec: "vp8" }`; when neither can render, "This browser cannot render the brand video." replaces the button.
`canRenderMediaOnWeb` also needs WebGL on an `OffscreenCanvas` (an error-level `webgl-unsupported` issue otherwise), so a
browser without WebGL reaches that sentence too. Before the first render of a page load the
privacy note shows (R5-54). The render is `renderMediaOnWeb({ composition: { id: "brand-intro", component: BrandIntro,
...BRAND_INTRO, defaultProps: props }, inputProps: props, container, videoCodec, muted: true, licenseKey: "free-license",
outputTarget: "arraybuffer", signal, onProgress })`, `props` being `brandProps(spec, mode)`: 4.0.539's types require
`defaultProps` for a component with props (`dist/props-if-has-props.d.ts`). The renderer mounts the composition in a
scaffold appended to `<body>` with `visibility: hidden`, `filter: opacity(0)` and `z-index: -9999`, so the page shows
nothing of it; its `getBlob()` downloads as `mediaName(spec, "brand", container)` through
`downloadBlob` with `video/mp4` or `video/webm`. Progress shows in a `<progress>` and, at most once per 10%, in a polite
live region. "Cancel" aborts it. One video job runs at a time: while a render or a recording runs, the other button is
`aria-disabled` and described by "Wait for the current video to finish." **(decision G4; the pre-check departs, section
1; the job rule across both buttons drafter)**

**R5-54 · The privacy note.** Before the first render of each page load, an inline note (13.4) replaces the render
button: the render runs in this browser; Remotion sends one usage event to remotion.pro per render with the visitor's IP
address and this site's address, never the video or the design; dyelot cannot turn it off. "Render" starts the render,
and "Cancel" closes the note with nothing sent. After a "Render", later renders on the same page load start at once. The
studio holds the answer for the page load, not the dialog, so closing and reopening the dialog keeps it. **(decision G5;
the copy and the holder drafter)**

**R5-55 · The license.** dyelot uses Remotion under its Free License as an individual's project, declared with
`licenseKey: "free-license"` and the Player's `acknowledgeRemotionLicense`. The README states Remotion's license for
anyone who reuses the video code: companies of four or more people need a Company License. The exported composition
carries the header of R5-22 and its README the same rule (12.1). **(decision G6; owner approval item 1)**

### Mediabunny: the shader loop (Task 5.10)

**R5-56 · Recording.** "Record the shader loop" shows when the browser has WebCodecs and `supportsFlavor()`; else "This
browser cannot record the shader loop." stands in its place. A click loads `mediabunny` with `import()` and picks the
first codec of `avc` (MP4), `vp9` and `vp8` (WebM) for which `canEncodeVideo(codec, { width: 1280, height: 720 })` holds;
with none, "This browser cannot record the shader loop." replaces the button. It mounts the flavor of the current design
and mode on a detached 1280 × 720 canvas with `size: { width: 1280, height: 720 }` and `autoplay: false` (with which the
runtime asks for `preserveDrawingBuffer`), and for `i` = 0 to 299 calls `drawAt(i / 300)` and `await source.add(i / 30, 1
/ 30)` on `new CanvasSource(canvas, { codec, quality: new Quality({ bitrate: 4_000_000 }) })` (1.62.0's form; its
`bitrate` key is deprecated, `dist/mediabunny.d.ts`, `VideoEncodingConfig`), into an `Output` with `Mp4OutputFormat` or
`WebMOutputFormat` and a `BufferTarget`, then `finalize()`. Cancel calls `output.cancel()` and discards everything. If the
detached canvas falls back (`onFallback` fires: no WebGL2, a failed compile, a lost context), the recording cancels its
output and ends as `failed`, so no blank file downloads. The
file downloads as `mediaName(spec, "loop", container)`. No Remotion code runs and no network call is made. **(decision H1;
the pre-check departs, section 1; the detached canvas drafter)**

**R5-57 · Reduced motion and recording.** Reduced motion does not block recording: it is an explicit action that makes a
file. The dialog's shader preview stays still under it. **(decision H2)**

### Security headers (Task 5.9)

**R5-58 · `connect-src` gains Remotion's host.** `cspHeader` writes `connect-src 'self' https://openrouter.ai
https://www.remotion.pro` (and, in development, ` ws: http://localhost:*` after it); nothing else in the policy changes.
`worker-src 'self' blob:` already covers the web renderer's keepalive worker and `img-src 'self' data: blob:` its SVG
images and the grain; there is no `media-src` (R5-02) and no `'wasm-unsafe-eval'` (renders are muted, so the AAC
encoder's WebAssembly never loads). `src/lib/site/csp.ts`, its unit tests, `tests/e2e/security.spec.ts`'s `PAGE_POLICY`
and page lists, and M0's header test change together (section 16). **(decision J1)**

**R5-59 · Zero violations, no network.** Every new page and flow runs with zero `securitypolicyviolation` events and zero
console errors, a render included. Every flow that renders installs `TELEMETRY(page)` first (section 4): it answers the
CORS preflight `OPTIONS` of `https://www.remotion.pro/api/track/register-usage-point` with 204 and M4's CORS headers, and
the `POST` with 200 `{"success": true}` and the same headers, as M4's `answerCrossOrigin` answers OpenRouter. The renderer
posts JSON across origins, so it needs the preflight, and it throws on any body without `success` true; it sends the event
without awaiting it, so a throw would be an unhandled rejection in the page. The route counts `POST`s only, so no test
reaches remotion.pro. No test touches the network (R4-58). **(decision J2, J3; the reply drafter)**

### Repository rules (every task)

**R5-60 · Pins, exclusions and import boundaries.** Exactly: three 0.186.1, `@react-three/fiber` 9.8.2,
`@react-three/drei` 10.7.9 (unless probe 1 drops it), `remotion`, `@remotion/player` and `@remotion/web-renderer`
4.0.539, `mediabunny` 1.62.0, and dev `@types/three` 0.186.0. `motion` stays 14.3.0. Never: `postprocessing`,
`@react-three/postprocessing`, `gsap`, `@remotion/cli`, `@remotion/three`, `lenis`, `@paper-design/shaders` or
`detect-gpu`. Imports: `three`, `three/*` and `@react-three/*` only under `src/features/explore/`; `remotion` and
`@remotion/player` only under `src/flavor/remotion/` and `src/features/flavor/`; `@remotion/web-renderer` and
`mediabunny` only through `import()` in `src/features/flavor/`. Two Dependabot groups keep the Remotion packages with
`mediabunny`, and three with `@types/three` and the two `@react-three` packages (12.3). **(decision K2; the
Dependabot groups drafter)**

**R5-61 · Laziness.** The first load of `/studio` fetches no chunk that holds three, R3F, Remotion or Mediabunny code;
`/` fetches none of three, R3F, Remotion or the engine; `/explore` none of Remotion or Mediabunny; opening the Flavor
dialog loads the Player but not the web renderer or Mediabunny. The render click loads the web renderer, which imports
Mediabunny statically (it depends on exactly 1.62.0, R5-50), so Mediabunny's code arrives with it; on a page load where no
render ran, the record click loads Mediabunny alone. The flows tell
chunks apart by a marker string per library that probe 1, 4 and 5 record (R5-64). **(decision K3; the engine on `/`
from C1; the markers drafter)**

**R5-62 · Tests.** Each case's test comes first, red, then green, titled with its id. A new guard, C-GUARD5-01, checks
that every case id of section 14 of this file has a test (C-GUARD4-11's method with this file's path). New unit folders
join a vitest project: `tests/unit/engine/**` and `tests/unit/export/**` stay in `core`, and `tests/unit/flavor/**` and
`tests/unit/features/{landing,explore,motion,flavor}/**` run in `web` (jsdom), so every file runs in one project
(C-REPO-M2-06). New pure files join the coverage lists with their floors (section 15). Flows that need WebGL use
Playwright's bundled Chromium (WebGL2 through SwiftShader, `WEBGL_lose_context` and WebCodecs present, checked on
2026-11-06); "no WebGL" is an init script that makes `getContext` return null for any `webgl` type, "no WebCodecs" one
that deletes `VideoEncoder`, and "cannot encode" one that makes `VideoEncoder.isConfigSupported` answer `{ supported:
false }`. Flows assert state, never frame counts or timings, except the budgets of R5-64. **(decision K4; the project
placement and the third init script drafter)**

**R5-63 · Earlier milestones hold.** Every M1 to M4 case passes except the changes of section 16; every golden holds;
a design without `motionTokens` keeps its spec id. **(decision K5)**

**R5-64 · Task 5.0, the probes.** Before any other task, each probe runs on a production build under the nonce CSP and
its result is recorded here:

1. **R3F and drei under the CSP.** A `/explore` draft with one `<Canvas>`, a mesh and drei's `OrbitControls`: zero
   `securitypolicyviolation` events and no console error; the route's JavaScript holds none of "troika", "detect-gpu",
   "draco", "mediapipe", "cdn.jsdelivr.net", "raw.githack.com", "unpkg.com" or "storage.googleapis.com". It also records
   one marker string each for three and R3F that survives minification (candidates: `THREE.WebGLRenderer` and `R3F:
   Hooks can only be used within the Canvas component`). If drei fails the scan: `OrbitControls` comes from
   `three/examples/jsm/controls/OrbitControls.js`, drei is not installed, and C-GUARD5-03's allow-list drops it. If R3F
   itself raises a violation, M5 stops for the owner.

   Result (date):
2. **A view transition from the store.** In the studio, a `<ViewTransition key>` around the template, keyed by
   `useDeferredValue(view.template)`, with R5-48's CSS; an init script wraps `document.startViewTransition`, counts its
   calls and records the animations at `ready`. Passes when one template switch from the toolbar makes one call, the
   record holds an animation on `::view-transition-group(dyelot-template)` and none of duration above 0 on `root`, and
   with the canvas's "Reduce motion" on no animation of duration above 0 at all. If the root cross-fades anyway, the CSS
   of R5-48 is amended until it does not. If it makes no call: R5-46's local state set in
   `startTransition` replaces the deferred value, and the probe runs again on that form; if that fails too, the template
   switch ships without a transition and the owner decides.

   Result (date):
3. **A raw rule for `*.tsx`.** With R5-23's rule and declaration, a client component and `src/export` each import a
   `.tsx` file with `?raw`; `next build` serves its text byte for byte (same SHA-256), Vitest in `core` and in `web`
   reads the same text, and every other `.tsx` import still compiles and renders. If it fails: a `prebuild` script writes
   `src/export/flavor-sources.generated.ts` holding the four sources as strings, a unit test checks it equals the files,
   and `?raw` is used for `.mjs` only.

   Result (date):
4. **The Player and the web renderer.** `<Player>` with R5-52's props mounts through `dynamic(..., { ssr: false })` in
   a client component with no hydration warning, and while it plays for 6 s there is no `securitypolicyviolation`, no
   console error and no `<audio>` element in the page; it autoplays muted, or the probe records that the browser held it
   paused (then the flows assert `data-autoplay` only). `renderMediaOnWeb` renders a draft of `BrandIntro` (muted MP4,
   H.264, 1280 × 720, 180 frames, with `defaultProps`) in Playwright's headless Chromium under the CSP with
   `https://www.remotion.pro` in `connect-src` and the usage event answered by `TELEMETRY`: zero violations, no
   unhandled rejection, one `POST`, a downloadable MP4. It records the render's time `T`
   (F-RENDER's timeout is 3 × `T`) and the marker strings of `remotion` or `@remotion/player` and of
   `@remotion/web-renderer` (candidate: `register-usage-point`). If a violation names a directive, nothing is added to
   the CSP without the owner. If the render fails headless for a reason of the browser, the render flows stop at the
   privacy note and the call's start, and the hand check (R5-65) proves the rest.

   Result (date):
5. **Mediabunny.** `mediabunny` 1.62.0's `CanvasSource` with `quality: new Quality({ bitrate: 4_000_000 })` records 300
   frames of a WebGL2 canvas drawn with `drawAt` to an MP4 under the CSP, with no violation; the probe records the time
   (F-LOOP's timeout is 3 × that) and a marker string found in Mediabunny's chunk and in no chunk of the web renderer's
   own code. If `preserveDrawingBuffer` is not needed for a correct frame, R5-56 keeps it anyway.

   Result (date):
6. **Scroll-driven animations.** In Playwright's Chromium, `CSS.supports("animation-timeline: view()")` is true, a
   story step has a computed `animation-timeline` of `view()`, and `page.emulateMedia({ reducedMotion: "reduce" })` leaves
   every step with `animation-name: none`, opacity 1 and no translate. If `supports` is false, F-STORY-01 is skipped with
   that reason and the final-state cases stand.

   Result (date):
7. **The toolbar with "Flavor".** At 360 × 740, with "Flavor" after "Export", the closed toolbar is at most 170 px tall
   (F-CANVAS-19's bound). If it is taller: the bound in F-CANVAS-19 and F-STUD5-03 becomes the measured height, rounded up
   to the next 8 px, and section 16 records the change for the owner.

   Result (date):

Unverified and left to the close or the owner: the real chunk sizes (M6's audit); Remotion 5.0's terms, which are not in
force (R6, section 3.1). **(decision K1; the fallbacks and the markers drafter)**

**R5-65 · The hand check after the merge.** On `https://dyelot.vercel.app`: the hero runs and "Next palette" cycles; the
story animates on scroll and shows its final state with the OS set to reduce; `/explore` turns and slices; `/motion`
edits a duration and opens the studio with it; the studio's template switch cross-fades; the Flavor dialog plays the
preview, records the shader loop, and renders one brand video, which sends one usage event from the controller's browser
to remotion.pro; the response carries the policy of 12.2. The results go into this spec's close note. **(decision L7;
owner approval item 7)**

**R5-66 · Copy.** Every string of sections 7 to 13 follows the copy rules: American English, no emoji, no exclamation
mark, none of the banned words. A unit case checks every exported copy table (C-GUARD5-10). **(drafter)**

## 4. Conventions, invariants and fixtures

### Reading the cases

- **Kind and origin** read as in M4: `pass` or `failure`; `decision` (section 2), `ruling R5-nn`, `RF1` to `RF5`
  (section 17), `added` (a boundary or failure case this spec adds).
- **Layers.** `C-` cases run in Vitest: the `core` project (Node) for `src/engine` and `src/export`
  (`tests/unit/engine/**`, `tests/unit/export/**`); the `web` project (jsdom) for `src/flavor` and `src/features`
  (`tests/unit/flavor/**`, `tests/unit/features/**`) and for `src/lib/site` (`tests/unit/site/**`). `F-` cases run in
  Playwright against the production build, at 1280 × 800 unless a row names another size. A property case uses fast-check
  with the run count it states and the seed 5000 plus its task number (`seed: 5001` for Task 5.1).
- **Case ids.** `C-COL5`, `C-SOLID`, `C-SLICE`, `C-MOT5`, `C-PRE5`, `C-STUD5`, `C-STOPS`, `C-FLAV`, `C-BRAND`, `C-FEX`,
  `C-LAND5`, `C-EXPL5`, `C-LAB`, `C-VT`, `C-DLG`, `C-SITE5`, `C-ENTRY5`, `C-GUARD5`; flows `F-HERO`, `F-STORY`, `F-HOME5`,
  `F-EXP5`, `F-LAB`, `F-VT`, `F-STUD5`, `F-FLAVOR`, `F-RENDER`, `F-LOOP`, `F-FEX`, `F-SEC5`, `F-A11Y5`, `F-LAZY5`. A
  Review Focus test carries `RF` in its id.
- **Tolerances.** Hex channels ±1; OKLCH L and C ±0.001 and H ±0.1°; an OKLab coordinate against colorjs.io ±1e-7; a
  `Float32Array` position ±1e-5; pixels read back from WebGL ±1 per channel.

### Invariants

- **I-M5-01 · Colors come from the scales.** Every color the story, the brand video and the explorer's points and tubes
  show is a step or role hex of the design; the shader and its CSS fallback draw only from five steps of the design, or
  OKLab mixes between them plus a gray grain; only the gamut solids show other colors, the sRGB images of their surfaces.
- **I-M5-02 · Reduced motion is honored.** Under the OS setting or the page's own switch nothing loops or moves by
  itself: the shader draws one still frame, the story shows final states, view transitions take 0 s, the Player does not
  autoplay, the explorer has no damping. Recording a file stays possible.
- **I-M5-03 · Every fallback is a sentence.** No raw error, stack or library message reaches the page.
- **I-M5-04 · Heavy code stays lazy** (R5-61).
- **I-M5-05 · The new cores are pure.** `src/engine/**` and `src/export/**` read no DOM, storage, network, clock,
  randomness, environment, locale or Web Crypto.
- **I-M5-06 · The shipped sources are the run sources.** The four raw files of `flavor/` equal `src/flavor/`'s byte for
  byte, and `src/flavor/` imports nothing outside itself but `react` and `remotion`.
- **I-M5-07 · The loop is seamless and deterministic.** The field depends on time only through the cosine and sine of
  whole multiples of the phase, so a draw at fraction 0 and one at fraction 1 are the same image, and the same stops and
  seed give the same image on any mount.
- **I-M5-08 · M1 to M4 hold.** Every earlier case passes except the changes of section 16, every golden holds, and a
  design without `motionTokens` keeps its spec id.
- **I-M5-09 · No test touches the network**, and every render's usage POST is answered by `page.route`.
- **I-M5-10 · No text on a moving surface.** No text node sits over the shader or inside the 3D canvas.

### Fixtures

- `DEFAULT_PARAMS` and `SPEC` are M1's; `ORIGIN`, `LINK(spec)` and `GOLDENS` are M3's.
- `HERO_PARAMS` is R5-31's table; `HERO` is `generateSystem({ ...freshParams(), primary: { l: 0.7, c: 0.17, h: 22 },
  name: "Madder" }, "hero-madder")`.
- `CUSTOM_TOKENS` is `{ durations: { instant: 40, fast: 80, quick: 120, base: 160, slow: 240, slower: 320, slowest: 480
  }, easings: { standard: [0.3, 0, 0.2, 1], decelerate: [0, 0, 0.2, 1], accelerate: [0.4, 0, 1, 1], emphasized: [0.1,
  0.8, 0.1, 1] }, springs: { snappy: { visualDuration: 0.2, bounce: 0.05 }, smooth: { visualDuration: 0.45, bounce: 0 },
  bouncy: { visualDuration: 0.55, bounce: 0.4 } } }`; `CUSTOM` is `withMotion(SPEC, CUSTOM_TOKENS)`.
- `tokensArb` is the fast-check arbitrary of valid tokens: durations integers 0 to 2000, easing x in [0, 1] and y in
  [−2, 3] as doubles with no NaN, springs `visualDuration` in [0.01, 5] and `bounce` in [0, 1].
- `STOPS` is `flavorStops(SPEC, "light")`; `SEED` is `flavorSeed(specId(SPEC))`.
- `RICH_P3` is `generateSystem({ ...DEFAULT_PARAMS, gamut: "p3", chroma: "vivid" }, "seed-1")`; `P3_L` is the light L, to
  2 decimals, of its first step (in `PALETTE_NAMES` then `STEPS` order) whose chroma exceeds `gamutSlice("srgb", L)` at its
  hue, which the flow computes in Node and requires to exist.
- `FLAVOR_BUNDLE` is `buildBundle({ spec: SPEC, origin: ORIGIN, flavor: true })`; `FLAVOR_APP` is M3's `APP()` fixture
  with `FLAVOR_BUNDLE`'s files at their paths and the four moved copies of R5-26.
- Init scripts (`tests/e2e/flavor-support.ts`): `NO_WEBGL` (`getContext` gives null for `/webgl/`), `NO_WEBCODECS`
  (`delete window.VideoEncoder`), `NO_ENCODE` (`VideoEncoder.isConfigSupported` resolves `{ supported: false }`),
  `VT_RECORD` (wraps `document.startViewTransition`, counts calls, and on each `ready` records the duration of every
  animation whose `pseudoElement` starts with `::view-transition`, with its `pseudoElement`), `NO_COMPILE`
  (`WebGL2RenderingContext.prototype.getShaderParameter` answers false for `COMPILE_STATUS`), `NO_RENDERER`
  (`WebGL2RenderingContext.prototype.getShaderPrecisionFormat` throws, which three's renderer calls as it starts), and
  `STATUS_RECORD(selector)` (a `MutationObserver` that keeps every text the region at `selector` takes, in order).
  `NO_WEBGL` patches `HTMLCanvasElement` only, so the web renderer's `OffscreenCanvas` check still passes.
- `TELEMETRY(page)` answers `https://www.remotion.pro/api/track/register-usage-point` as R5-59 says: `OPTIONS` with 204 and
  the CORS headers `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: POST, OPTIONS` and
  `Access-Control-Allow-Headers: *`; `POST` with 200 `{"success": true}` and the same headers; it keeps each `POST`'s JSON
  body, and a flow polls the count, because the event is sent after the download starts.
- `ABORT_CHUNK(page, marker)`, installed before `goto`, answers each `/_next/static/chunks/*.js` request with
  `route.fetch()` and aborts the response whose text holds `marker`, until `release()` is called: the markers are
  `dyelot.check/1` for `@/export`, "Before the first render" for the Flavor dialog, and probe 4's for the web renderer.
- `loseContext(page, selector)` calls `WEBGL_lose_context.loseContext()` on the context of the canvas at `selector`.

## 5. Public API of the new modules

### 5.1 The engine (Tasks 5.1 to 5.3)

```ts
// src/spec/schema.ts (R5-09): a type change only; the schema does not change
type DirectionParams = ColorParams & { /* M1 to M4's fields */ readonly motionTokens?: MotionTokens };

// src/engine/color/rec2020.ts (R5-06): internal
function rec2020ToOklab(rgb: Rgb): Oklab;                 // encoded channels, read as they are, never clamped
function oklchToRec2020(color: Oklch): Rgb | null;        // null where the conversion overflows, as tryOklchToRgb

// src/engine/color/solid.ts (R5-06 to R5-08)
const SOLID_GAMUTS: readonly ["srgb", "p3", "rec2020"];   // frozen
type SolidGamut = (typeof SOLID_GAMUTS)[number];
type GamutSolid = {
  readonly gamut: SolidGamut;
  readonly steps: number;
  readonly positions: Float32Array;   // 6 × (steps + 1)² × 3
  readonly colors: Float32Array;      // the same length; sRGB 0 to 1
  readonly indices: Uint16Array;      // 6 × steps² × 6
};
function gamutSolid(gamut: SolidGamut, steps: number): GamutSolid;           // steps: whole, 1 to 64
type SlicePoint = { readonly h: number; readonly c: number };
function gamutSlice(gamut: SolidGamut, l: number): readonly SlicePoint[];   // 360 points, h 0 to 359, frozen
function solidPosition(color: Oklch): readonly [x: number, y: number, z: number];   // [2a, L − 0.5, 2b]

// src/engine/tokens/motion.ts (R5-09, R5-10)
const MOTION_DURATION_NAMES: readonly ["instant", "fast", "quick", "base", "slow", "slower", "slowest"];
const MOTION_EASING_NAMES: readonly ["standard", "decelerate", "accelerate", "emphasized"];
const MOTION_SPRING_NAMES: readonly ["snappy", "smooth", "bouncy"];
function normalizeMotionTokens(tokens: MotionTokens, name?: string): MotionTokens;   // deep-frozen, round6
function sameMotionTokens(a: MotionTokens, b: MotionTokens): boolean;   // reads the three groups of each; extra keys ignored

// src/engine/tokens/motion-presets.ts (R5-12)
const MOTION_PRESET_IDS: readonly ["dyelot", "productive", "expressive", "gentle", "snappy"];
type MotionPresetId = (typeof MOTION_PRESET_IDS)[number];
type MotionPreset = { readonly id: MotionPresetId; readonly label: string; readonly note: string; readonly tokens: MotionTokens };
const MOTION_PRESETS: Readonly<Record<MotionPresetId, MotionPreset>>;   // deep-frozen
function motionPresetOf(tokens: MotionTokens): MotionPresetId | null;

// src/engine/tokens/bezier.ts (R5-13)
type Bezier = readonly [x1: number, y1: number, x2: number, y2: number];
function bezierPoints(easing: Bezier, segments: number): readonly (readonly [x: number, y: number])[];

// src/engine/generate.ts (R5-11)
function withMotion(spec: DesignSpec, tokens: MotionTokens): DesignSpec;

// src/engine/flavor.ts (R5-16)
type FlavorStops = readonly [Hex, Hex, Hex, Hex, Hex];
const FLAVOR_STEPS: readonly (readonly [PaletteName, Step])[];   // [neutral 100, primary 200, secondary 400, accent 400, primary 500]
function flavorStops(spec: DesignSpec, mode: Mode): FlavorStops;
function flavorSeed(id: string): readonly [x: number, y: number];
```

The engine entry gains exactly `SOLID_GAMUTS`, `gamutSolid`, `gamutSlice`, `solidPosition`, `MOTION_DURATION_NAMES`,
`MOTION_EASING_NAMES`, `MOTION_SPRING_NAMES`, `normalizeMotionTokens`, `sameMotionTokens`, `MOTION_PRESET_IDS`,
`MOTION_PRESETS`, `motionPresetOf`, `bezierPoints`, `withMotion`, `FLAVOR_STEPS`, `flavorStops` and `flavorSeed` (17
runtime names), and the types `SolidGamut`, `GamutSolid`, `SlicePoint`, `MotionPresetId`, `MotionPreset`, `Bezier`,
`FlavorStops` and `SpringCurve`. Errors: `gamutSolid`'s gamut and `gamutSlice`'s gamut are a `TypeError` when not a
string and a `RangeError` when not in `SOLID_GAMUTS`; `steps` and `segments` are a `TypeError` when not a number and a
`RangeError` when not a whole number in range; `l` is a `TypeError` when not a number and a `RangeError` when not finite
or outside [0, 1]; `solidPosition` follows `assertOklch`; `flavorStops` checks the spec's palettes as `paramsOfSpec`
checks its sections; `withMotion` checks its spec before its tokens.

### 5.2 The shipped sources (Task 5.3)

```ts
// src/flavor/flavor.mjs (// @ts-check, JSDoc types; R5-17 to R5-21)
export const LOOP_SECONDS = 10;
export const LOOP_FRAMES = 300;                     // one loop at 30 frames a second
export const GRAIN = 0.035;
export const MAX_DPR = 1.5;
export const MAX_BUFFER = Object.freeze({ width: 1920, height: 1080 });
export const DEFAULT_FADE = Object.freeze({ durationMs: 200, easing: Object.freeze([0.2, 0, 0, 1]) });
export const GRAIN_SVG: string;                     // R5-20's text
export const GRAIN_URL: string;                     // `url("data:image/svg+xml,${encodeURIComponent(GRAIN_SVG)}")`
/** @typedef {readonly string[]} FlavorStops  five "#rrggbb", the count checked at run time */
/** @typedef {"no-webgl2" | "context-lost"} FallbackReason */
/** @typedef {{ durationMs: number, easing: readonly number[] }} Fade  easing: four numbers, checked at run time */
/** @typedef {{ stops: FlavorStops, seed: readonly number[], reducedMotion?: boolean, fade?: Fade,
 *   size?: { width: number, height: number }, autoplay?: boolean, onFallback?: (reason: FallbackReason) => void }} FlavorOptions */
/** @typedef {{ setStops(stops: FlavorStops): void, setPaused(paused: boolean): void, drawAt(fraction: number): void,
 *   destroy(): void }} FlavorHandle */
export const VERTEX_SHADER: string;                 // 6.1's texts, exported so the unit cases can read them
export const FRAGMENT_SHADER: string;
export function supportsFlavor(): boolean;          // a scratch canvas gives a WebGL2 context
export function mountFlavor(canvas: HTMLCanvasElement, options: FlavorOptions): FlavorHandle;
export function flavorBackground(stops: readonly string[]):
  { backgroundColor: string; backgroundImage: string };   // five stops, each "#rrggbb" or "var(--name)"
export function bufferSize(cssWidth: number, cssHeight: number, dpr: number): { width: number; height: number };
export function easeAt(easing: readonly number[], x: number): number;   // cubic-bezier y at x, x in [0, 1]
```

The runtime's types are plain arrays, so `palette.json` imports into them with no cast; the counts (five stops, two seed
numbers, four easing numbers) are checked at run time, a wrong count being a `RangeError`.

`mountFlavor` checks, types first: `canvas` an `HTMLCanvasElement`; `options` a plain object; `stops` an array of five
strings each `#rrggbb` (lowercase or uppercase); `seed` two finite numbers; `reducedMotion` and `autoplay` booleans when
present; `fade` `{ durationMs, easing }` with `durationMs` finite and at least 0 and `easing` four finite numbers whose
first and third lie in [0, 1]; `size` two whole numbers from 2 to 4096 when present; `onFallback` a function when
present; an unknown option key is a `RangeError`. The handle's `setStops` checks its stops the same way, `setPaused` a
boolean, `drawAt` a number in [0, 1]. `bufferSize` rounds each side and gives at least 1 × 1. `easeAt` solves x by
bisection to 1e-6.

```tsx
// src/flavor/flavor-react.tsx ("use client"; R5-21)
import { type FallbackReason, type Fade, type FlavorStops } from "./flavor.mjs";
export type FlavorProps = {
  readonly stops: FlavorStops;
  readonly seed: readonly number[];
  readonly paused?: boolean;
  readonly reducedMotion?: boolean;
  readonly fade?: Fade;
  readonly onFallback?: (reason: FallbackReason) => void;
  readonly className?: string;
};
export function Flavor(props: FlavorProps): React.JSX.Element;
// one <canvas aria-hidden="true" className style={flavorBackground(stops)}>, keyed on seed, fade and reducedMotion

// src/flavor/remotion/brand-intro.tsx (R5-22)
export type BrandProps = {
  name: string; oneLiner: string; lot: string;
  checks: { passed: number; required: number };
  palettes: { name: string; steps: string[] }[];   // 5 × 11 hexes
  colors: { background: string; foreground: string; card: string; cardForeground: string; primary: string;
            primaryForeground: string; mutedForeground: string; border: string };
  fonts: { display: string; body: string };
  motion: { baseMs: number; standard: number[];
            springs: { snappy: SpringSamples; smooth: SpringSamples; bouncy: SpringSamples } };
};
export type SpringSamples = { settleMs: number; samples: number[] };
export const BRAND_INTRO: { readonly width: 1280; readonly height: 720; readonly fps: 30; readonly durationInFrames: 180 };
export const BRAND_TIMELINE: { readonly name: 0; readonly oneLiner: 6; readonly palettes: 30; readonly rowGap: 12;
  readonly stepGap: 2; readonly specimen: 96; readonly receipt: 132 };
export function springAt(curve: SpringSamples, frame: number, fps: number): number;   // 0 before frame 0, 1 after settle
export function BrandIntro(props: BrandProps): React.JSX.Element;

// src/flavor/remotion/root.tsx (R5-22): never imported as code
export function RemotionRoot(): React.JSX.Element;   // then registerRoot(RemotionRoot)
```

`springAt` reads the samples as evenly spaced over `settleMs` and interpolates linearly at the time `frame / fps`; a
frame that is not a finite number is a `RangeError`, and a curve that does not hold at least two samples a `TypeError`.

### 5.3 The export (Task 5.4)

```ts
// src/export/types.ts (R5-24)
type BundleInput = { readonly spec: DesignSpec; readonly origin: string; readonly flavor?: boolean };

// src/export/flavor-sources.ts (R5-05): the raw texts
const FLAVOR_SOURCES: Readonly<{
  "flavor/flavor.mjs": string; "flavor/flavor-react.tsx": string;
  "flavor/remotion/brand-intro.tsx": string; "flavor/remotion/root.tsx": string;
}>;

// src/export/flavor.ts (R5-24, 12.1)
function flavorFiles(spec: DesignSpec, origin: string): readonly BundleFile[];   // the nine, in R5-24's order

// src/export/brand.ts (R5-30)
function brandProps(spec: DesignSpec, mode: Mode): BrandProps;   // BrandProps: a type import of src/flavor

// src/export/media.ts (R5-28)
function mediaName(spec: DesignSpec, kind: "brand" | "loop", container: "mp4" | "webm"): string;
```

The export entry's runtime keys are exactly `buildBundle`, `RECEIPT_FORMAT`, `sha256`, `zipBundle`, `zipName`,
`motionFiles`, `brandProps` and `mediaName`. `flavorFiles`, `brandProps` and `mediaName` check, types first, that the spec
is an object, the origin an https origin (as `buildBundle`), the mode, kind and container one of their values.

```ts
// src/features/export/download.ts (R5-28)
function downloadBlob(name: string, bytes: Uint8Array, type?: string): void;   // type: non-empty, default "application/zip"
// src/features/export/useBundle.ts (R5-29)
function useBundle(spec: DesignSpec, waiting?: boolean, flavor?: boolean): BundleState;
```

### 5.4 The studio and the preview (Tasks 5.2, 5.7 and 5.8)

```ts
// src/features/studio/params.ts (R5-14)
const DIRECTION_PARAM_KEYS: readonly (keyof DirectionParams)[];   // M4's list, then "motionTokens"
type ParamsPatch = DeepPartial<Omit<DirectionParams, "direction" | "rules" | "motionTokens">> & {
  readonly direction?: DirectionParams["direction"] | undefined;
  readonly rules?: DirectionParams["rules"] | undefined;
  readonly motionTokens?: MotionTokens | undefined;   // replaces the whole set; undefined removes it
};

// src/features/studio/pages.ts (R5-40, R5-45)
function pageHref(page: "studio" | "explore" | "motion", spec: DesignSpec): string;   // `/<page>#s=<encodeSpec(spec)>`
function motionLine(spec: DesignSpec): string;   // "Motion tokens: <label> preset." or "Motion tokens: custom."

// src/features/studio/token-row.ts (R5-47)
type TokenRow = {
  readonly token: string;               // "--color-primary-500", the Tailwind token
  readonly utility: string;             // "bg-primary-500"
  readonly cssVar: string;              // "var(--primary-500)", what Copy writes
  readonly hex: Hex;
  readonly oklch: string;               // formatOklch(step.oklch)
  readonly contrast: string;            // "4.50:1"
  readonly roles: readonly RoleName[];  // ROLE_NAMES order
};
function tokenRow(spec: DesignSpec, mode: Mode, palette: PaletteName, step: Step): TokenRow;
function swatchName(palette: PaletteName, step: Step): string;   // "dyelot-swatch-<palette>-<step>"

// src/features/preview/transition.ts (R5-46)
type TemplateTransition = { readonly share: "auto" | "none"; readonly enter: "auto" | "none";
  readonly exit: "auto" | "none"; readonly default: "none" };
function templateTransition(reduced: boolean): TemplateTransition;

// src/features/preview/kit/reduced.ts (R5-49)
type MediaLike = { readonly matches: boolean;
  addEventListener(type: "change", listener: () => void): void; removeEventListener(type: "change", listener: () => void): void };
function watchReducedMotion(media: MediaLike, onChange: (reduced: boolean) => void): () => void;   // returns the unsubscribe
function useOsReducedMotion(): boolean;   // useSyncExternalStore: server snapshot false, client snapshot matchMedia(...).matches
```

### 5.5 The landing (Task 5.5)

```ts
// src/features/landing/cards.ts (R5-31): no engine import; Hero.tsx imports its types and the page its value
type HeroCard = { readonly name: string; readonly href: string; readonly stops: readonly string[] };   // five hexes
type HeroCards = { readonly seed: readonly number[];
  readonly fade: { readonly durationMs: number; readonly easing: readonly number[] };
  readonly cards: readonly HeroCard[] };   // six
const HERO_CARDS: HeroCards;   // ./hero-cards.json, written as R3-11 writes JSON

// src/features/landing/heroes.ts (R5-31): value imports only from the three page files and tests
type HeroParams = { readonly name: string; readonly seed: string; readonly primary: Oklch };
const HERO_PARAMS: readonly HeroParams[];   // R5-31's six, frozen
function heroSpec(index: number): DesignSpec;   // index 0 to 5; generated once per design per instance
function heroCards(): HeroCards;                // all six generated; what hero-cards.json must equal
function defaultDesign(): DesignSpec;           // heroSpec(0)

// src/features/landing/story.ts (R5-33, 7.2): pure
type StoryStep =
  | { readonly kind: "seed"; readonly hex: Hex; readonly oklch: string }
  | { readonly kind: "scale"; readonly steps: readonly { readonly step: Step; readonly hex: Hex; readonly contrast: string }[] }
  | { readonly kind: "roles"; readonly roles: readonly { readonly name: RoleName; readonly hex: Hex }[] }
  | { readonly kind: "type"; readonly display: string; readonly body: string; readonly space: readonly number[] }
  | { readonly kind: "receipt"; readonly passed: number; readonly required: number };
function storySteps(spec: DesignSpec): readonly StoryStep[];   // the five, in order

// src/features/landing/cycle.ts: pure
function nextIndex(index: number, count: number): number;      // (index + 1) mod count
function paletteLine(index: number, count: number, name: string): string;   // "Palette 2 of 6: Weld."
```

`Hero.tsx` is a client component taking `hero: HeroCards`; `Story.tsx` is a server component taking the spec;
`story.css` holds the story's rules. `heroSpec` checks `index` (a `TypeError` for a non-number, a `RangeError` outside 0 to
5 or not whole).

### 5.6 The explorer (Task 5.6)

```ts
// src/features/explore/scene.ts (R5-36 to R5-38): pure
type ScenePoint = { readonly palette: PaletteName; readonly step: Step; readonly hex: Hex; readonly oklch: Oklch;
  readonly position: readonly [number, number, number]; readonly seed: boolean };
function scenePoints(spec: DesignSpec, mode: Mode): readonly ScenePoint[];               // 88, palette then step order
function sliceSteps(points: readonly ScenePoint[], l: number): readonly ScenePoint[];   // |L − l| ≤ 0.04
type Camera = { readonly turn: number; readonly tilt: number; readonly zoom: number };
const DEFAULT_CAMERA: Camera;   // { turn: 35, tilt: 25, zoom: 1 }
function cameraPosition(camera: Camera): readonly [number, number, number];   // distance 3.2 / zoom from the origin
function cameraOf(position: readonly [number, number, number], heldTurn: number): Camera;
// the inverse, rounded, clamped; at the pole (horizontal distance below 1e-9 × d) the turn is heldTurn
function slicePath(points: readonly SlicePoint[], size: number): string;      // the SVG path of one outline
function dotAt(oklch: Oklch, size: number): readonly [x: number, y: number];   // a step's place in the flat view
function sceneSummary(name: string, mode: Mode, gamut: SolidGamut, l: number): string;   // 8.3
const EXPLORE_LINES: Readonly<Record<"loading" | "no-webgl2" | "context-lost" | "restart" | "load-failed" | "bad-link"
  | "bad-link-kept", string>>;   // 8.4, frozen

// src/features/explore/webgl.ts
function supportsWebgl2(create?: () => HTMLCanvasElement): boolean;
```

`ExploreClient.tsx` (client) holds the state; `Explorer3D.tsx` (client, loaded by `dynamic` inside an error boundary,
R5-39) holds every three and R3F import; `FlatView.tsx` renders on the server and the client.

### 5.7 The motion lab (Task 5.7)

```ts
// src/features/motion/lab.ts (R5-41 to R5-43): pure
type TokenPath =
  | { readonly kind: "duration"; readonly name: (typeof MOTION_DURATION_NAMES)[number] }
  | { readonly kind: "easing"; readonly name: (typeof MOTION_EASING_NAMES)[number]; readonly index: 0 | 1 | 2 | 3 }
  | { readonly kind: "spring"; readonly name: (typeof MOTION_SPRING_NAMES)[number];
      readonly field: "visualDuration" | "bounce" };
const LAB_BOUNDS: Readonly<Record<"duration" | "x" | "y" | "visualDuration" | "bounce",
  { readonly min: number; readonly max: number; readonly step: number }>>;   // 9.3
function readField(path: TokenPath, text: string): { readonly ok: true; readonly value: number } | { readonly ok: false; readonly message: string };
function editTokens(tokens: MotionTokens, path: TokenPath, value: number): MotionTokens;   // a new, normalized set
function fieldText(tokens: MotionTokens, path: TokenPath): string;
function curvePath(points: readonly (readonly [number, number])[], box: { readonly width: number;
  readonly height: number; readonly pad: number; readonly yMin: number; readonly yMax: number }): string;
function durationBars(spec: DesignSpec): readonly { readonly name: string; readonly stored: number; readonly exported: number }[];
function presetLine(tokens: MotionTokens): string;   // 9.2
function reducedTransition(spec: DesignSpec): { readonly duration: number; readonly ease: "linear" };   // fast, in seconds
```

`LabClient.tsx` (client) holds the spec, the fields and the previews; `Previews.tsx` holds the five previews.

### 5.8 The Flavor dialog (Tasks 5.9 and 5.10)

```ts
// src/features/flavor/video.ts (R5-53, R5-56): pure
type VideoJob = "render" | "record";
type Container = "mp4" | "webm";
function canMakeVideo(scope: { readonly VideoEncoder?: unknown }): boolean;   // typeof VideoEncoder === "function"
function nextAnnounced(last: number, progress: number): number | null;       // the next 10% step reached, or null
function progressLine(job: VideoJob, percent: number): string;               // "Rendering: 30%." / "Recording: 30%."
function doneLine(fileName: string): string;                                  // "Downloaded <file name>."
const VIDEO_LINES: Readonly<Record<string, string>>;                          // 13.3's sentences, frozen
const FLAVOR_LINES: Readonly<Record<"no-webgl2" | "context-lost" | "restart" | "still" | "pause", string>>;   // 6.4, frozen

// src/features/flavor/load.ts (R5-51): the dialog's loader, as M4's loadAi
function loadFlavorDialog(): Promise<typeof import("./FlavorDialog")>;   // memoized; a failure resets it

// src/features/flavor/render.ts (R5-53): the renderer's shell, dependencies injected
type RenderDeps = { load(): Promise<typeof import("@remotion/web-renderer")>; signal: AbortSignal;
  onProgress(progress: number): void };
type RenderOutcome =
  | { readonly kind: "done"; readonly bytes: Uint8Array; readonly container: Container }
  | { readonly kind: "unsupported" } | { readonly kind: "canceled" } | { readonly kind: "failed" }
  | { readonly kind: "load-failed" };
function pickRenderTarget(renderer: Pick<typeof import("@remotion/web-renderer"), "canRenderMediaOnWeb">):
  Promise<{ readonly container: Container; readonly videoCodec: "h264" | "vp8" } | null>;
function renderBrandVideo(props: BrandProps, target: { container: Container; videoCodec: "h264" | "vp8" },
  deps: RenderDeps): Promise<RenderOutcome>;

// src/features/flavor/record.ts (R5-56)
type RecordDeps = { load(): Promise<typeof import("mediabunny")>; signal: AbortSignal; onProgress(progress: number): void;
  canvas(): HTMLCanvasElement };
type RecordOutcome = RenderOutcome;
function pickCodec(media: Pick<typeof import("mediabunny"), "canEncodeVideo">):
  Promise<{ readonly codec: "avc" | "vp9" | "vp8"; readonly container: Container } | null>;
function recordLoop(flavor: { stops: FlavorStops; seed: readonly [number, number] }, deps: RecordDeps): Promise<RecordOutcome>;
```

`FlavorDialog.tsx`, `BrandPlayer.tsx`, `PrivacyNote.tsx` and `useVideoJob.ts` are shells covered by the flows. A failed
`load()` gives `load-failed`; an `AbortError` gives `canceled`; any other throw gives `failed` and is never shown;
`recordLoop` also gives `failed` when the flavor's `onFallback` fires during the recording. `pickRenderTarget`,
`pickCodec`, `renderBrandVideo` and `recordLoop` check their arguments' types (a `TypeError` naming the function) and the
target's and the flavor's values (a `RangeError`) before any load; the module arguments have no domain beyond their type.

## 6. The shader and the flavor runtime (Task 5.3)

### 6.1 The shader texts

`VERTEX_SHADER` draws one triangle that covers the view, from `gl_VertexID` alone:

```glsl
#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
```

`FRAGMENT_SHADER` is `#version 300 es` with `precision highp float;`, the uniforms of R5-17, one output `out vec4 color;`
with alpha 1, and these parts in this order: the webgl-noise notice and `snoise` (2D simplex noise, adapted to GLSL ES
3.00 and otherwise as published); `hash(vec2 p) = fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453)`; the sRGB
decode and encode (M1's piecewise functions); the linear-sRGB-to-LMS matrix, the product of M1's `XYZ_TO_LMS` and
`SRGB_TO_XYZ`, and `LMS_TO_OKLAB`, with their inverses (the products of `XYZ_TO_SRGB` and `LMS_TO_XYZ`, and
`OKLAB_TO_LMS`), each number written to 10 significant digits; `toOklab(vec3 srgb)` and `toSrgb(vec3 lab)`; the field of
R5-17; the two OKLab mixes; the grain; the clamp. The draw is `drawArrays(TRIANGLES, 0, 3)` with an empty vertex array
object bound. The runtime uploads each stop as its three channels divided by 255, and `u_seed` as the two seed numbers.

### 6.2 The loop

The runtime keeps the run time `t` in seconds. Each animation frame adds the time since the last one, capped at 0.1 s, so
a stalled tab never jumps, and only while the state is `running`; the phase is 2π × (`t` mod 10) / 10. `drawAt(f)` sets
the phase to 2π × `f` and draws, in every state but `fallback` (`still` included, so a recording under reduced motion
holds 300 different frames). A pause, an off-screen canvas or a hidden page cancels the frame request; returning to `running`
starts a new chain from the kept `t`. While nothing runs (paused, off-screen, hidden, still), `setStops` draws one frame at
once at the kept phase with the new stops, and no fade. A fade's `u_mix` is `easeAt(fade.easing, elapsed /
fade.durationMs)`, clamped to 1; a fade of 0 ms swaps at once; entering `still` during a fade sets `u_mix` 1 and draws
the target.

### 6.3 States

| `data-flavor` | Holds when |
|---|---|
| `fallback` | `onFallback` has been called; `data-flavor-reason` is `no-webgl2` or `context-lost` |
| `still` | Reduced motion (the option or the OS setting): one frame at phase 0, no loop |
| `paused` | `setPaused(true)`, or after `drawAt`, or `autoplay: false` before any `drawAt` |
| `hidden` | `document.visibilityState` is `hidden` |
| `offscreen` | The `IntersectionObserver` reports the canvas outside the view |
| `running` | None of the above: the loop draws |

The first that holds wins, in the table's order. `data-flavor-stops` holds the target stops joined by commas, lowercase.
`destroy()` removes all three attributes.

### 6.4 The hosts' sentences

`FLAVOR_LINES` (frozen, in `src/features/flavor/video.ts`, used by the hero and the Flavor dialog):

| Key | Text |
|---|---|
| `no-webgl2` | This browser cannot draw the animated background, so a still gradient shows instead. |
| `context-lost` | The animated background stopped, so a still gradient shows instead. |
| `restart` | Restart the animation |
| `still` | The background is still because this device asks for reduced motion. |
| `pause` | Pause |

A host shows the sentence of its state in one `role="status"` region under its controls; "Restart the animation" follows
the `context-lost` sentence and remounts the canvas with a new `key`.

### 6.5 The composition's layout

`BrandIntro` is one `AbsoluteFill` with `backgroundColor` `colors.background`, padding 64 px, a flex column with a gap of
32 px, and three parts in DOM order (which is also the drawing order):

1. **Header.** The name (the display font, 64 px, weight 600, `colors.foreground`) and, 6 frames later, the one-liner
   (the body font, 26 px, `colors.mutedForeground`), each entering on the `smooth` spring `s`: `opacity` `min(1, s)`,
   `transform: translateY(<(1 − s) × 24>px)`. An empty one-liner draws nothing.
2. **Body.** A row with a gap of 48 px. On the left, five palette rows (primary, secondary, accent, neutral, danger), each
   a label (the body font, 16 px, `colors.mutedForeground`, 120 px wide) and 11 squares of 40 px with a radius of 6 px and
   a gap of 6 px; square `i` of row `r` enters on the `snappy` spring from frame 30 + 12r + 2i with `opacity` `min(1, s)`
   and `transform: scale(<0.6 + 0.4 × s>)`. On the right, from frame 96 on the `bouncy` spring, a card 360 px wide
   (`colors.card`, `1px solid` `colors.border`, radius 16 px, padding 28 px) holding the name (the display font, 32 px,
   `colors.cardForeground`), the one-liner or "Made with dyelot." (the body font, 18 px, `colors.mutedForeground`) and a
   button "Get started" (`colors.primary`, text `colors.primaryForeground`, padding 12 px 20 px, radius 10 px).
3. **Footer.** From frame 132, faded in over `motion.baseMs` with `Easing.bezier(...motion.standard)`: "<passed> of
   <required> required checks pass" (the body font, 20 px, `colors.foreground`) and "LOT <lot>" (the body font, 16 px,
   `colors.mutedForeground`, letter spacing 0.08em).

`springAt(curve, frame, fps)` is 0 for a frame below 0 and 1 at or after `settleMs`; between, it interpolates the samples
linearly, read as evenly spaced over `settleMs`. Every frame from 0 to 179 draws the same picture each time it is drawn.

## 7. The landing page (Task 5.5)

### 7.1 The hero

`src/app/page.tsx` keeps `PageFrame active="home" statusLeft="dyelot ~/" statusRight="muizz-lab · MIT"`, the structured
data, `<Prompt>dyelot</Prompt>` and the `h1` "dyelot — a palette becomes a design system your coding agent can build".
Then, in this order:

1. The hero (`Hero.tsx`, a client component given `HERO_CARDS`): a `TerminalWindow` titled `madder.flavor` (the
   current card's name in lowercase, then `.flavor`), whose body is a 16:9 box holding `<Flavor>` with the current
   card's `stops`, `HERO_CARDS`' `seed` and `fade` (constant, so "Next palette" never remounts the canvas) and `paused`
   from the Pause button; the runtime follows the OS setting itself, and `useOsReducedMotion()` decides only whether the
   Pause button shows. The canvas's inline style is `flavorBackground(<the first card's stops>)` in the server's HTML, so
   with JavaScript off the hero shows the still gradient. The wrapper is `[data-hero]` with `data-hero-index` (1 to 6).
2. The controls (`[data-hero-controls]`): the line "Palette 1 of 6: Madder." (`paletteLine`); the button "Next palette";
   the button "Pause" with `aria-pressed`, rendered only while the shader can loop (no reduced motion and no fallback);
   the link "Open this palette in the studio" (`href` the card's). Under them,
   the `role="status"` region of 6.4.
3. A `TerminalWindow` titled `start.log` holding, as direct children of one `div`: the links "open the studio"
   (`/studio`), "open the explorer" (`/explore`) and "open the motion lab" (`/motion`), the repository link of M0, and the
   cursor prompt; each link reads `$ open <target>` as M2's link does.
4. The story (7.2).

"Next palette" moves to `nextIndex(i, 6)`, updates the window's title, the line and the link, and calls `setStops` (a
cross-fade, or a swap under reduced motion). Pause keeps its state across "Next palette".

### 7.2 The story

`Story.tsx` (a server component) renders `<section aria-labelledby="story-heading" data-story>` with the `h2` "One color,
five steps" and an `ol` of five `li[data-story-step]` items, each an `h3`, one paragraph and one `figure[data-specimen]`
holding its colors. With `S` = `storySteps(HERO)`:

| `data-story-step` | `h3` | Paragraph | Specimen |
|---|---|---|---|
| `seed` | One seed | It starts with one color: `<hex>`, `<oklch>`. | One 96 px swatch of the seed |
| `scale` | Eleven steps | dyelot solves eleven steps of that hue, each at a set contrast against the page. | The light primary scale: 11 swatches, each with its step number and its contrast to 2 decimals |
| `roles` | Roles | The steps become the roles an interface uses: the page, its text, a primary action, a border and a focus ring. | A small card in the light roles `background`, `foreground`, `primary`, `primary-foreground`, `border` and `ring`, each named under its swatch |
| `type` | Type and space | A type scale and a 4 px spacing scale come with the colors. | The display and body family names in Geist Mono, and the first 8 steps of `space.scale` as bars with their px values |
| `receipt` | A receipt | Every export carries a receipt. This design passes `<passed>` of `<required>` required contrast checks. | The numbers `<passed> / <required>` with the label "required checks pass" |

`<hex>` is `toHex(oklchToRgb(spec.color.params.primary, "srgb"))` and `<oklch>` `formatOklch` of the same seed; for
`HERO` they read `#f66c6d` and `oklch(0.7000 0.1700 22.00)`. `storySteps` needs a locked primary seed, which every hero
design has; a spec without one is a `RangeError`. A family name is the catalog's `family`, or the id for a family
outside the catalog. `<passed>` and `<required>` are `summarize(measureSpec(spec), lintSpec(spec),
spec.color.params.gamut).contrast.requiredPass` and `.required`.

`src/features/landing/story.css` holds exactly these animation rules; nothing else in it sets `opacity`, `translate`,
`transform` or an animation:

```css
@keyframes story-rise {
  from { opacity: 0; translate: 0 24px; }
  to { opacity: 1; translate: 0 0; }
}
@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    [data-story-step] {
      animation: story-rise linear both;
      animation-timeline: view();
      animation-range: entry 0% entry 100%;
    }
  }
}
```

### 7.3 The nav and the sitemap

`AppNav`'s links, in this order: "home" (`/`), "studio" (`/studio`), "explore" (`/explore`), "motion" (`/motion`) and
"github" (the repository, a new tab as before). The link of the active page has `aria-current="page"` and the madder mark.
Below 640 px the brand shows its tile alone (the word "dyelot" stays in the link's accessible name), and the gaps
between the brand and the links and between links narrow from 24 and 20 px to 12 px, so at 360 px the five links fit one
row with no horizontal scroll.
`/sitemap.xml` lists `https://dyelot.vercel.app/`, `/studio`, `/explore` and `/motion`, in that order; `robots.txt` does
not change.

## 8. The explorer (Task 5.6)

### 8.1 The page

`src/app/explore/page.tsx`: `pageMetadata(SITE, "/explore", { title: "Explorer", description: "See a palette in OKLab:
the sRGB, Display P3 and Rec. 2020 gamut solids, every step as a point, each scale as a tube, and a lightness slice." })`
(140 characters); `PageFrame active="explore" statusLeft="dyelot ~/explore" statusRight="muizz-lab · MIT"`;
`<Prompt>dyelot explore</Prompt>`; the `h1` "The palette in OKLab"; the paragraph "Every step of the design sits at its
place in OKLab, lightness up and the two color axes across. A solid holds every color its gamut can show."; then
`ExploreClient` given `defaultDesign()`. Its parts, in DOM and Tab order: the `role="status"` line (empty, or the bad-hash
sentence); the controls; the 3D panel; the flat view; the link "Open in the studio". At 1024 px and wider the 3D panel and
the flat view sit side by side; below, the flat view follows the 3D panel.

### 8.2 The controls

| Control | Kind | Values | Start | Shown value (`aria-valuetext` too) |
|---|---|---|---|---|
| Gamut solid | Radio group | sRGB, Display P3, Rec. 2020 | the design's gamut | |
| Mode | Radio group | Light, Dark | Light | |
| Lightness slice | Slider | 0 to 1, step 0.01 | 0.6 | `L 0.60` |
| Turn | Slider | −180 to 180, step 1 | 35 | `35°` |
| Tilt | Slider | 0 to 90, step 1 | 25 | `25°` |
| Zoom | Slider | 0.5 to 2, step 0.05 | 1 | `1.00×` |
| Reset view | Button | | | |

Each control has a visible label and a hit area of at least 24 × 24 px. The camera sits at `cameraPosition(camera)`:
distance `d = 3.2 / zoom`, position `d × (cos tilt × sin turn, sin tilt, cos tilt × cos turn)`, looking at the origin;
`cameraOf(position, heldTurn)` inverts it, rounding turn and tilt to whole degrees (turn wrapped into −180 to 180, tilt
clamped to 0 to 90) and zoom to 0.05 (clamped to 0.5 to 2); at the pole, where the horizontal distance is below 1e-9 × d,
the turn is `heldTurn`. `OrbitControls` takes the target (0, 0, 0), `minPolarAngle` 0, `maxPolarAngle`
π / 2, `minDistance` 1.6, `maxDistance` 6.4, `enablePan` false, `enableDamping` unless the OS asks for reduced motion,
`dampingFactor` 0.1; its `change` event writes `cameraOf(camera.position, <the slider's turn>)` into the sliders and calls `invalidate()`. When
probe 1 drops drei, three's `OrbitControls` gets the same settings and a `useFrame` callback calls its `update()`.

### 8.3 The 3D panel and the flat view

The 3D panel is `[data-explorer]`, a 4:3 box with the attributes `data-explorer-state` (`loading`, `3d` or `flat`),
`data-explorer-reason` (`no-webgl2` or `context-lost`, while `flat`), `data-gamut`, `data-mode`, `data-slice` (2
decimals), `data-turn`, `data-tilt`, `data-zoom` (2 decimals), `data-damping` (`true` or `false`), `data-points` (88),
`data-tubes` (8) and `data-solid-vertices` (6534 for 32 steps). `<Canvas frameloop="demand" dpr={[1, 1.5]} gl={{
antialias: true, alpha: true }} camera={{ fov: 40, near: 0.1, far: 20, position }}>` sits in an `aria-hidden="true"` wrapper; `onCreated` sets
`gl.localClippingEnabled = true` and listens for `webglcontextlost`. Under the panel, the summary
`sceneSummary(name, mode, gamut, l)`: "Madder: 88 steps of the light scales in OKLab, inside the sRGB gamut solid, cut at
L 0.60." (the gamut named "sRGB", "Display P3" or "Rec. 2020").

The flat view is `figure[data-flat-view]`: an `svg` of 320 × 320 (`role="img"`, `aria-labelledby` its caption) on the
panel color, with the three outlines of `slicePath(gamutSlice(gamut, l), 320)` (sRGB a solid line in the foreground
color, Display P3 dashed in the muted foreground, Rec. 2020 dotted in the border color: chrome stays achromatic) and one
dot of radius 4 per step of `sliceSteps`, filled with its hex. The plot's center is (160, 160); chroma 0.5 sits at radius
150 (Rec. 2020 reaches about 0.47, so every outline fits); a hue `h` lies at the angle `h` from the right, counterclockwise: `x = 160 + r cos h`, `y = 160 − r sin h`, each to 2
decimals; an achromatic step sits at the center. The caption reads "At L 0.60: how far each gamut reaches at every hue,
and the <n> steps within 0.04 of that lightness." Below it, the legend list "sRGB: solid line", "Display P3: dashed
line", "Rec. 2020: dotted line", and the list "Steps near this lightness" with one item per step, "<palette> <step> ·
<hex> · L <l to 2 decimals> · C <c to 3 decimals> · H <h to whole degrees, or none>", or the one item "No step lies within
0.04 of L 0.60.".

### 8.4 The sentences

`EXPLORE_LINES` (frozen, in `src/features/explore/scene.ts`):

| Key | Text |
|---|---|
| `loading` | Loading the 3D view… |
| `no-webgl2` | This browser cannot draw the 3D view, so the flat view below shows the same slice. |
| `context-lost` | The 3D view stopped, so the flat view shows the same slice. |
| `restart` | Restart the 3D view |
| `load-failed` | The 3D view could not load. Reload the page to try again. |
| `bad-link` | The explorer shows the default design instead. |
| `bad-link-kept` | The explorer keeps the current design. |

The bad-link line is `bannerFor({ kind: "link", reason, issues, fallback: "current" }).message` + " " +
`EXPLORE_LINES["bad-link"]` on load, and the same with `EXPLORE_LINES["bad-link-kept"]` after a `hashchange`.

## 9. The motion lab and motion tokens (Task 5.7)

### 9.1 The page

`src/app/motion/page.tsx`: `pageMetadata(SITE, "/motion", { title: "Motion lab", description: "Edit a design's motion:
durations, easing curves and springs, with live previews and files for CSS, Motion and GSAP." })` (116 characters);
`PageFrame active="motion" statusLeft="dyelot ~/motion" statusRight="muizz-lab · MIT"`; `<Prompt>dyelot motion</Prompt>`;
the `h1` "The motion lab"; the paragraph "Change a design's durations, curves and springs, watch them on five small previews,
then take the files or open the design in the studio."; then `LabClient` given `defaultDesign()`. Its parts, in DOM and
Tab order: the `role="status"` line (empty, or the bad-hash sentence with "The lab shows the default design instead." on
load and "The lab keeps the current design." after a `hashchange`);
Presets (9.2); Durations, Easings and Springs (9.3); Previews (9.4); Files (9.5); the link "Open in the studio"
(`pageHref("studio", spec)`). The lab's state is `[data-lab]` with `data-preset` (an id or `custom`) and `data-lab-reduced`.

### 9.2 Presets

A group labeled "Presets" with the buttons "dyelot", "Productive", "Expressive", "Gentle" and "Snappy", each with
`aria-pressed` (true for `motionPresetOf(tokens)`). Pressing one replaces all the tokens with the preset's in one edit.
`presetLine(tokens)` gives "These tokens match the <label> preset. <note>" or "Custom tokens: no preset matches."

### 9.3 Durations, easings and springs

**Durations.** An `svg` ladder (`role="img"`, labeled "Durations: <name> <stored> ms, …" in name order) with one bar per
duration, its width the exported value over 500 ms; then seven fields labeled "instant (ms)" to "slowest (ms)". When
`durationBars` gives an exported value that differs from the stored one (the calm feel stretches each duration by 1.25
and every value is capped at 500 ms, R2-08), the bar's label reads "<name> <stored> ms, exported as <exported> ms", and
the note "The calm feel stretches each duration by a quarter, up to 500 ms, in the exported files." shows under the
ladder.

**Easings.** Four `figure`s, each a 200 × 200 `svg` (`role="img"`) of `curvePath(bezierPoints(easing, 64), { width: 200,
height: 200, pad: 20, yMin: −1, yMax: 2 })` with the diagonal from (0, 0) to (1, 1) as a faint guide, captioned
"<name>: cubic-bezier(<x1>, <y1>, <x2>, <y2>)", then the fields "<name> x1", "<name> y1", "<name> x2" and "<name> y2".

**Springs.** Three `figure`s of `curvePath` over `springCurve(spring).samples` (x the sample's index over the last index,
y the position; `yMin` −0.2, `yMax` 1.6), captioned "<name>: <visualDuration> s, bounce <bounce>, settles in <settleMs>
ms", then the fields "<name> duration (s)" and "<name> bounce".

Every field is `<input type="text" inputmode="decimal">` with a visible label and a hit area of at least 24 × 24 px, so
any text can be typed and `readField` judges it. `LAB_BOUNDS` and `readField`'s sentences:

| Bound | Min | Max | Step | Sentence |
|---|---|---|---|---|
| `duration` | 0 | 500 | 1 | Enter a number of milliseconds from 0 to 500. |
| `x` | 0 | 1 | 0.01 | Enter a number from 0 to 1. |
| `y` | −1 | 2 | 0.01 | Enter a number from −1 to 2. |
| `visualDuration` | 0.05 | 2 | 0.01 | Enter a number of seconds from 0.05 to 2. |
| `bounce` | 0 | 1 | 0.01 | Enter a number from 0 to 1. |

`readField` trims the text, reads U+2212 as a minus sign, and rejects an empty text, a text `Number` does not read as a
finite number, and a value outside the bounds, each with its sentence; it rounds a valid value to its step
(`Math.round(value / step) × step`, then to the step's decimals). `fieldText` writes a duration as a whole number and the
rest with at most 2 decimals and no trailing zero (`0.2`, `0`, `0.05`).

### 9.4 Previews

A group labeled "Previews" inside `[data-specimen][data-lab-previews]`, painted with `canvasStyle(spec, "light", { vision: "none", density: "comfortable" })`. The
switch "Reduced motion" (`role="switch"`) comes first, described by "Shows what the exported reduced-motion rules do.";
it starts on when the OS asks for reduced motion. Then five `figure`s:

| Preview | Caption | Tokens | Replay |
|---|---|---|---|
| Dialog | Dialog: slow and decelerate in, base and accelerate out | opacity and scale 0.96 to 1 | Replay the dialog |
| Toast | Toast: the smooth spring | rises 24 px | Replay the toast |
| Switch | Switch: the snappy spring | the thumb slides | Replay the switch |
| Tab indicator | Tab indicator: the bouncy spring | the bar slides under the tabs "One", "Two" and "Three" | Replay the tab indicator |
| Hover | Hover: fast and standard | lifts 2 px | Replay the hover |

"Replay" remounts its preview with a new key (the switch and the tab indicator move to their next state). Each
preview's `figure` carries `data-preview` (`dialog`, `toast`, `switch`, `tabs` or `hover`) and `data-transition`, what it
runs: `tween:<ms>:<easing>` for a duration and an easing (the dialog's entrance, the hover), `spring:<name>` for a spring,
and, with "Reduced motion" on, `linear:<fast ms>` in place of every spring. The switch
inside the preview is labeled "Example switch" and the tabs form a tab list labeled "Example tabs". With "Reduced motion"
on, the previews' `MotionConfig` is `reducedMotion="always"` and each spring transition becomes
`reducedTransition(spec)`: `{ duration: fast / 1000, ease: "linear" }`.

### 9.5 Files

A list labeled "Files" with three items, `motion/motion.css`, `motion/motion.ts` and `motion/gsap.ts`, each with the
buttons "Copy" (`aria-label` "Copy <path>"; it reads "Copied" for 2 s after a copy) and "Download" (`aria-label`
"Download <path>"; the file's base name, `text/css` for the CSS and `text/plain` for the two `.ts` files), and a
disclosure "Show <path>" holding the text in a `pre`. While `@/export` loads, both buttons are `aria-disabled` and
described by "Preparing the files…"; if it fails to load, the list's `role="status"` line reads "This tool could not load.
Reload the page to try again." A blocked copy opens the disclosure, selects the text and shows M3's sentence "Copy is
blocked here. The text is selected: press Ctrl+C or ⌘C."

### 9.6 The hash

On load the lab reads `location.hash` (R5-40's rules). Each applied edit replaces the spec with `withMotion(spec,
tokens)` at once (previews and files follow) and, 300 ms after the last edit, calls `history.replaceState(null, "",
"#s=" + encodeSpec(spec))`; a `hashchange` loads the new design, and a bad one keeps the current design with its line.
Reloading the page shows the edited tokens.

## 10. View transitions (Task 5.8)

### 10.1 The template switch

In `Canvas`:

```tsx
const template = useDeferredValue(view.template);
const transition = templateTransition(view.reducedMotion);
// … inside MotionScope, which renders no element:
<ViewTransition key={template} name="dyelot-template" share={transition.share} enter={transition.enter}
  exit={transition.exit} default="none">
  <Template spec={spec} view={{ ...view, template }} />
</ViewTransition>
```

No wrapper element is added: each template renders one root, its own `[data-template-root="<id>"]` (`Landing.tsx`,
`Dashboard.tsx`, `Settings.tsx`, `Editorial.tsx`, `Mobile.tsx`, `KitchenSink.tsx`), which the `ViewTransition` names, so
M2's `[data-template-root]` locators and the templates' height chain stand. `[data-canvas]`'s `data-template` reads
`template`. `templateTransition(false)` is `{ share: "auto", enter: "auto",
exit: "auto", default: "none" }` and `templateTransition(true)` the same with `"none"` for the first three; a non-boolean
is a `TypeError` naming `templateTransition`.

### 10.2 The token row

`Scales` keeps one piece of local state, the open step `{ palette, step } | null`, set inside `startTransition`. A
compact row is `<li data-step>` (keeping M2's `data-seed` and `data-show-me-cell`) holding one `<button type="button"
aria-expanded="false" aria-label="<palette> <step>, <hex>">`, at least 24 px tall (the rows grow from M2's 20 px), whose
content is M2's grid: `[data-step-number]`, the `[data-swatch]` (inside `<ViewTransition name={swatchName(palette, step)}
share="dyelot-morph" default="none">`), `[data-hex]` and `[data-ratio]`, as M2 draws them, so the inspector's existing
locators and its crowding checks (F-INSP-01, F-INSP-02, F-INSP-07, F-INSP-14) read the same cells. The open row replaces it in the same
`li`, which gains `data-token-row`:

- the button `aria-expanded="true"` with the same name, which closes the row;
- the swatch, at 24 px, inside the `ViewTransition` of the same name;
- a description list: "Tailwind" with `<code>--color-<palette>-<step></code>` and `<code>bg-<palette>-<step></code>`;
  "CSS" with `<code>var(--<palette>-<step>)</code>`; "Hex"; "OKLCH" (`formatOklch` of the step); "Contrast" ("<ratio to 2
  decimals>:1");
- "Roles: <names joined by ", ">" or "Roles: none in <mode> mode.";
- "Copy" (`aria-label` "Copy var(--<palette>-<step>)"), which writes `var(--<palette>-<step>)` and reads "Copied" for 2 s;
  a blocked copy selects that `code` text and shows "Copy is blocked here. The text is selected: press Ctrl+C or ⌘C."

Escape with focus inside the row closes it. After it opens, focus is on its button; after it closes (button, Escape, or
another row opening), focus is on the compact button of the step it showed. A design change that keeps the step keeps the
row open with the new values; a mode toggle keeps it open in the new mode. Each palette's 11 step buttons are one Tab
stop (a roving `tabIndex`): ↑ and ↓ move to the step above or below in that palette, Home and End to its first and last,
and Enter or Space opens (buttons take Space and the arrows themselves, R2-15).

### 10.3 The CSS

`src/app/globals.css` gains, after its reduced-motion block:

```css
::view-transition {
  pointer-events: none;
}
::view-transition-old(root) {
  display: none;
}
::view-transition-new(root) {
  animation: none;
}
::view-transition-group(.dyelot-morph) {
  animation-duration: 250ms;
  animation-timing-function: cubic-bezier(0.2, 0, 0, 1);
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
  }
}
```

### 10.4 The motion scope

`MotionScope` reads `useOsReducedMotion()` (`useSyncExternalStore` with `watchReducedMotion` over
`matchMedia("(prefers-reduced-motion: reduce)")` as its subscription, the query's `matches` as its snapshot and false as
its server snapshot) and passes `reducedMotion={reduced || osReduced ? "always" : "user"}`, so on a first render Motion
still reads the OS setting itself, as today;
`useKitMotion` and `Entrance` read `useReducedMotionConfig()` as before, so the leaf remount and the sheet's settling rules
of F-CANVAS-07 now run for an OS change too.

## 11. Remotion and Mediabunny (Tasks 5.9 and 5.10)

### 11.1 The Player

`BrandPlayer.tsx` (`"use client"`) renders:

```tsx
<Player ref={player} component={BrandIntro} inputProps={props} durationInFrames={180} fps={30}
  compositionWidth={1280} compositionHeight={720} controls={false} clickToPlay={false} loop
  numberOfSharedAudioTags={0} initiallyMuted acknowledgeRemotionLicense autoPlay={!reduced}
  initialFrame={reduced ? 179 : 0} style={{ width: "100%" }} renderLoading={() => <p>Loading the preview…</p>}
  errorFallback={() => <p>The preview could not play here.</p>} />
```

`props` is `useMemo(() => brand.brandProps(spec, mode), [spec, mode])`, `brand` the loaded `@/export`; `reduced` is the OS
setting or the canvas's "Reduce motion". The Player's wrapper is `[data-brand-player]` with `data-autoplay` (`true` or
`false`), `data-playing` (`true` or `false`, from the ref's `play` and `pause` events) and `data-mode`. Under it, the
button "Pause" (`aria-pressed` true while paused) calls `player.current.pause()` or, when paused, `seekTo(0)` if on frame
179 and then `play()`. `numberOfSharedAudioTags={0}` keeps the Player from mounting the five `<audio>` elements with a
`data:` source that it mounts by default and the CSP blocks. The dialog loads `BrandPlayer` with `dynamic(() =>
import("./BrandPlayer"), { ssr: false, loading: () => <p>Loading the preview…</p> })` inside an error boundary whose
fallback is "The preview could not play here."

### 11.2 The render

The "Brand video" section's job runs these states, each shown by 13.3's lines:

| State | Shows | Next |
|---|---|---|
| `idle` | "Render the brand video" (or the no-WebCodecs sentence in its place) | a click: `checking` |
| `checking` | "Checking this browser…"; the button `aria-busy` | the renderer loads, `pickRenderTarget`: none gives `unsupported`, a target gives `confirm` on the page load's first render, else `rendering`; a failed load gives `load-failed` |
| `unsupported` | "This browser cannot render the brand video." in the button's place | (final for the page load) |
| `confirm` | The privacy note (13.4) in the button's place | "Render": `rendering`; "Cancel": `idle`, nothing sent |
| `rendering` | "Rendering…", "Cancel", the progress bar and the live line | done: `done`; Cancel or the dialog closing: `canceled`; a throw: `failed` |
| `done`, `canceled`, `failed`, `load-failed` | The button again, with the outcome's line under it | a click: `checking` (an earlier load is reused) |

`pickRenderTarget` asks `canRenderMediaOnWeb` for `{ width: 1280, height: 720, container: "mp4", videoCodec: "h264",
muted: true, outputTarget: "arraybuffer" }` (the render's own options) and then `{ …, container: "webm", videoCodec: "vp8"
}`, and gives the first with `canRender` true, else
null; a throw counts as false. `renderBrandVideo` passes R5-53's options (`defaultProps` and `inputProps` both the props), reads `progress` from
`onProgress` (0 to 1), awaits `getBlob()`, and gives the bytes. The live line announces 10%, 20%, … 100% at most once each (`nextAnnounced`).

### 11.3 The shader loop

The "Shader loop" section runs the same states without `confirm`: `idle` ("Record the shader loop", or "This browser
cannot record the shader loop." in its place without WebCodecs or WebGL2), `checking` (Mediabunny loads and `pickCodec`
runs), `unsupported`, `recording` ("Recording…", "Cancel", the bar and the live line, progress `(i + 1) / 300`), and the
outcomes. `recordLoop` creates the detached canvas, mounts the flavor with `{ stops, seed, size: { width: 1280, height:
720 }, autoplay: false }` (the runtime asks for `preserveDrawingBuffer: true` when `autoplay` is false), runs R5-56's
300 steps, destroys the handle in every outcome, gives `failed` (after `output.cancel()`) when `onFallback` fires, and
otherwise gives the bytes of `output.target.buffer`. A video job holds the
other section's button `aria-disabled`, described by "Wait for the current video to finish."

### 11.4 The license texts

The README of the repository gains a section "Remotion" saying: dyelot renders its brand video with Remotion under
Remotion's Free License, as an individual's project; Remotion is source-available, not open source; each in-browser render
sends one usage event to remotion.pro; anyone who reuses the video code needs Remotion's license, and companies of four
or more people need a Company License (`https://remotion.pro/license`). `flavor/remotion/README.md` (12.1) and the
composition's header (R5-22) say the same to the export's reader. The README's "Credits" section also names oklch-picker
(MIT, Evil Martians, `https://github.com/evilmartians/oklch-picker`) as the inspiration for the explorer, and says that
no code of it is used (decision D2).

## 12. The flavor files and the security headers (Tasks 5.4 and 5.9)

### 12.1 The flavor files

With `<name>` the design's `meta.name`, `<lot>` its lot tag and `<link>` `editLink(spec, origin)`:

**`flavor/README.md`**

````md
# Flavor: <name>

The animated background of the dyelot design "<name>" (LOT <lot>), with its still CSS fallback and the Remotion source of
its brand video. Edit this design: <link>

## Files

- `flavor.mjs`: the background as a WebGL2 module with no dependency.
- `flavor-react.tsx`: a React component around it.
- `flavor.css`: the still background, read from the color variables of `app/theme.css`.
- `palette.json`: the five colors of each mode, the loop's length, the seed and the cross-fade.
- `remotion/`: the brand video's composition, built with Remotion. Read `remotion/README.md` first.

## Use it

In React:

```tsx
import palette from "./flavor/palette.json";
import { Flavor } from "./flavor/flavor-react";

<Flavor stops={palette.light} seed={palette.seed} fade={palette.fade} className="h-80 w-full" />
```

Without React:

```js
import { mountFlavor } from "./flavor/flavor.mjs";

const flavor = mountFlavor(canvas, { stops, seed }); // canvas: any <canvas> element
```

Where WebGL2 is missing, the module paints the still gradient itself. To use the still background alone, give an element
the class `dyelot-flavor` from `flavor.css`.

## Motion

The background loops every 10 seconds. It pauses off-screen and in a hidden tab, and it draws one still frame when the
visitor's system asks for reduced motion. Show a Pause button wherever it moves.

## Videos

The brand video and a 10-second loop of this background are downloads from the Flavor dialog of dyelot's studio, not
files of this folder: <link>

## License

The files outside `remotion/` are MIT, like the rest of this export. `flavor.mjs` holds simplex noise from webgl-noise
(MIT), with its notice. The files of `remotion/` need Remotion, which is not open source: read `remotion/README.md`.
````

**`flavor/flavor.css`**: M3's three header comments (`cssComment`), then the comment `/* The still background: use it
where WebGL2 is missing, or alone. It reads the color variables of app/theme.css. */`, then the rule:

```css
.dyelot-flavor {
  background-color: var(--neutral-100);
  background-image: <GRAIN_URL>, linear-gradient(in oklch 135deg, var(--neutral-100) 0%, var(--primary-200) 25%, var(--secondary-400) 50%, var(--accent-400) 75%, var(--primary-500) 100%);
}
```

**`flavor/palette.json`**: `{ "name": <name>, "loopSeconds": 10, "seed": flavorSeed(specId), "fade": { "durationMs":
motion.durations.base, "easing": motion.easings.standard }, "light": flavorStops(spec, "light"), "dark":
flavorStops(spec, "dark") }`, in that key order, as R3-11 writes JSON.

**`flavor/remotion/README.md`**

````md
# Brand video: <name>

Built with Remotion (https://www.remotion.dev). Remotion is not open source. Read its license before you use these
files: https://remotion.pro/license

Under its Free License, individuals, non-profit organizations and for-profit organizations with up to 3 employees may use
Remotion at no cost. Companies of four or more people need a Remotion Company License.

## Files

- `brand-intro.tsx`: the composition, 1280 × 720 at 30 frames a second, 6 seconds.
- `root.tsx`: registers `brand-intro-light` and `brand-intro-dark`.
- `brand.json`: the props of each, made from the design "<name>" (LOT <lot>).

## Render it

```sh
npm install remotion@4.0.539 @remotion/cli@4.0.539 react react-dom
npx remotion studio flavor/remotion/root.tsx
npx remotion render flavor/remotion/root.tsx brand-intro-light out/brand-intro-light.mp4
```

dyelot renders the same composition in the browser from the Flavor dialog of its studio: <link>
````

**`flavor/remotion/brand.json`**: `{ "light": brandProps(spec, "light"), "dark": brandProps(spec, "dark") }`, as R3-11
writes JSON.

### 12.2 The CSP

`cspHeader(nonce, { dev })` returns, for `dev: false`, exactly:

```text
default-src 'self'; base-uri 'self'; font-src 'self' data:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-<nonce>' 'strict-dynamic'; worker-src 'self' blob:; connect-src 'self' https://openrouter.ai https://www.remotion.pro; frame-ancestors 'none'; object-src 'none'; form-action 'self';
```

For `dev: true`, `script-src` ends `'strict-dynamic' 'unsafe-eval'` and `connect-src` ends `https://www.remotion.pro ws:
http://localhost:*`. The nonce and `dev` rules of M4's 12.1 stand. The matcher, the other headers and robots do not
change.

### 12.3 The build configuration

`next.config.ts`'s `turbopack.rules` hold `*.mjs`, `*.md` and `*.tsx`, each `{ condition: { query: /[?&]raw(?=&|$)/ },
type: "raw" }`; no `experimental` key, `cacheComponents` stays off. `src/types/raw.d.ts` declares `"*.mjs?raw"`,
`"*.md?raw"` and `"*.tsx?raw"`, each a default `string`. `tsconfig.json`'s `include` adds `src/flavor/*.mjs`, and
`biome.json`'s `files.includes` adds `src/flavor/*.mjs` beside `src/export/checker/*.mjs`, so the runtime is linted and
formatted (`src/**/*.{ts,tsx}` covers the other three sources; `brand.json` stays data).
`.github/dependabot.yml`'s npm entry gains two groups beside `react` and `playwright`, by exact names: `remotion`
(`remotion`, `@remotion/player`, `@remotion/web-renderer`, `mediabunny`) and `three` (`three`, `@types/three`,
`@react-three/fiber`, `@react-three/drei`).

## 13. The studio's new UI (Tasks 5.4 and 5.7 to 5.10)

The new controls use the studio's chrome classes, a visible label, a focus ring and a hit area of at least 24 × 24 px.
Every result line and failure sentence sits in one `role="status"` region per section.

### 13.1 The toolbar and the dialog

"Flavor" (`aria-haspopup="dialog"`) follows "Export" in the toolbar and in Tab order. The dialog (`role="dialog"`,
`aria-modal="true"`, named by its heading "Flavor") holds, in order: the paragraph "This design's moving parts: an
animated background, a brand video and a loop of the background, all made in this browser."; the sections "Background",
"Brand video" and "Shader loop" (13.2, 13.3), each an `h3`; and "Close". While the dialog component loads, "Flavor" is
`aria-busy`; if it fails to load, the toolbar's status line reads "This tool could not load. Reload the page to try
again." and the next press tries again.

### 13.2 Background

`<Flavor>` in a 16:9 box (`[data-flavor-preview]`) with `flavorStops(spec, view.mode)`, `flavorSeed(specId(spec))`, the
`base` and `standard` fade, `paused` from its Pause button and `reducedMotion` true when the canvas's "Reduce motion" is
on (the runtime adds the OS setting). Under it: "Pause" (`aria-pressed`, only while it loops); the region of 6.4; and the
line "To take this background as code, turn on Include flavor files in Export."

### 13.3 Brand video and shader loop

**Brand video.** The Player (11.1) and its "Pause" button (`aria-pressed`, 6.4's `pause`), then "Render the brand video", described by "Makes a 6-second video at 1280 × 720 in
this browser." The lines (`VIDEO_LINES`):

| Key | Text |
|---|---|
| `no-webcodecs` | This browser cannot make videos. Try a recent Chrome, Edge or Firefox. |
| `checking` | Checking this browser… |
| `render-unsupported` | This browser cannot render the brand video. |
| `rendering` | Rendering… |
| `render-failed` | The brand video could not be rendered in this browser. |
| `canceled` | Canceled. Nothing was downloaded. |
| `load-failed` | This tool could not load. Reload the page to try again. |
| `wait` | Wait for the current video to finish. |
| `record` | Record the shader loop |
| `record-description` | Records one 10-second loop at 1280 × 720 in this browser. Nothing is sent anywhere. |
| `record-unsupported` | This browser cannot record the shader loop. |
| `recording` | Recording… |
| `record-failed` | The shader loop could not be recorded in this browser. |
| `cancel` | Cancel |

`progressLine("render", 30)` is "Rendering: 30%." and `progressLine("record", 30)` "Recording: 30%."; `doneLine(name)` is
"Downloaded <name>." The progress bars are `<progress max="100">` labeled "Brand video progress" and "Shader loop
progress".

**Shader loop.** "Record the shader loop", described by `record-description`, and the same pattern of lines.

### 13.4 The privacy note

In the render button's place: a group labeled by its heading "Before the first render" (an `h4` with `tabIndex={-1}`,
which takes focus when the note opens), the paragraph "The video is made in this browser. Remotion, the video library
dyelot uses, sends one usage event to remotion.pro for each render, with your IP address and this site's address. It
never sends the video or the design. dyelot cannot turn this off.", and the buttons "Render" and "Cancel". "Cancel"
returns focus to "Render the brand video"; "Render" starts the render and focus moves to its "Cancel".

### 13.5 The export dialog

After the summary list, the switch "Include flavor files" (`role="switch"`, off), described by "Adds the animated
background, its CSS fallback and the Remotion source of the brand video: nine text files." Toggling it rebuilds the
bundle (the dialog's loading state shows meanwhile); the file list, the lot line and the download follow, and focus stays
on the switch.

### 13.6 The inputs panel

Under "Motion feel": `motionLine(spec)` ("Motion tokens: dyelot preset." or "Motion tokens: custom.") and the link "Edit
in the motion lab" (`pageHref("motion", spec)`), which leaves the studio in the same tab; the draft keeps the design.

### 13.7 The inspector

The Scales section's step rows are the buttons of 10.2. After the palettes, the link "See these scales in the explorer"
(`pageHref("explore", spec)`).

### 13.8 Keyboard and focus order

The toolbar's Tab order ends "Undo", "Redo", "Copy link", "Export", "Flavor". In the inputs panel, "Edit in the motion
lab" follows "Motion feel" and precedes the Steer section. In the inspector, each palette of Scales is one stop
(its focused step's button), in palette order, then "See these scales in the explorer"; an open token row adds "Copy"
after its button. The Flavor
dialog's order is the Background section's Pause (when shown) and "Restart the animation" (when shown), the Player's
"Pause", the render button or the note's buttons, "Cancel" while busy, the record button, "Cancel" while busy, and
"Close". Space, ← and → in the lab's and the explorer's fields type or move the slider as the control does; the studio's
shortcuts do not run outside the studio.

## 14. Cases

Each case below becomes a test whose title starts with its id. A case that names a task belongs to that task, and every
other case to the task of its subsection. A property case that generates designs runs with `PROPERTY_TIMEOUT`
(`tests/unit/spec/support.ts`), and its file joins `SLOW_CORE_TESTS` or `SLOW_WEB_TESTS` when its measured solo time
reaches 10 s (R2-31). The flows compute what a page must show by importing `@/engine`, `@/spec` and `@/export` in Node
(with `tests/e2e/raw-hooks.mjs` for `?raw`). "The render budget" and "the record budget" are 3 × the times probe 4 and
probe 5 record.

### 14.1 Engine color (Task 5.1)

Tests: `tests/unit/engine/color/rec2020.test.ts`, `tests/unit/engine/color/solid.test.ts`,
`tests/unit/engine/color/slice.test.ts`, with colorjs.io 0.7.1 as the oracle.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-COL5-01 | pass | `rec2020ToOklab` of `[1, 0, 0]` equals colorjs.io's `new Color("rec2020", [1, 0, 0]).to("oklab")`, (0.6870890420, 0.3327304291, 0.1494382314), within 1e-7 per coordinate; so do `[0, 1, 0]`, `[0, 0, 1]`, `[0.5, 0.5, 0.5]`, `[1, 1, 1]` (L 1, a and b within 1e-7 of 0) and `[0, 0, 0]` | ruling R5-06 |
| C-COL5-02 | pass | Property, 1,000 runs, `seed: 5001`: for encoded triples in [−0.2, 1.2]³, `rec2020ToOklab` matches colorjs.io's `rec2020` within 1e-7, and `oklchToRec2020` of the result's OKLCH gives the triple back within 1e-6 per encoded channel (the 2.4 power, with no linear segment, turns float noise near 0 into about 1e-7) | ruling R5-06 |
| C-COL5-03 | pass | The transfer is the 2.4 power with the sign kept: the linear value of the channel 0.5 is 0.5^2.4 (0.1894645708) and of −0.5 its negative, as colorjs.io's `rec2020-linear` reads them, and not the inverse of BT.2020's OETF, which colorjs.io's `--rec2020-oetf` gives as 0.2597194 | ruling R5-06 |
| C-COL5-04 | pass | `oklchToRec2020({ l: 1e103, c: 0, h: null })` gives null and never throws; a color in range gives three finite channels | ruling R5-06 |
| C-COL5-05 | failure | `rec2020ToOklab("x")` and `rec2020ToOklab([1, 2])` throw `TypeError` and `[NaN, 0, 0]` `RangeError`, each naming `rec2020ToOklab`; `oklchToRec2020(null)` throws `TypeError` naming `oklchToRec2020` | ruling R5-06, R-05 |
| C-SOLID-01 | pass | `gamutSolid("srgb", 2)` holds `gamut` `"srgb"`, `steps` 2, a `Float32Array` of 162 positions, a `Float32Array` of 162 colors and a `Uint16Array` of 144 indices | ruling R5-07 |
| C-SOLID-02 | pass | Layout, with `steps` 2: vertex 7 is face 0 at `(i, j) = (1, 2)`, sRGB (0, 0.5, 1), so `colors[21..24]` is `[0, 0.5, 1]`; the first cell's six indices are `[0, 1, 3, 1, 4, 3]`; face 1 starts at vertex 9 with sRGB (1, 0, 0) | ruling R5-07 |
| C-SOLID-03 | pass | In `gamutSolid("srgb", 32)` the vertex of (1, 1, 1) sits at `[0, 0.5, 0]`, (0, 0, 0) at `[0, −0.5, 0]`, and (1, 0, 0) at `[0.449726, 0.127955, 0.251693]`, each within 1e-5 | ruling R5-07, R5-08 |
| C-SOLID-04 | pass | The sRGB solid's colors are its vertices' own channels; every color of the P3 and Rec. 2020 solids equals `gamutMap(<its OKLCH>, "srgb")` within 1e-6 and lies in [0, 1]; the Rec. 2020 solid's red vertex has the OKLab of C-COL5-01 (its position read back as `(x / 2, y + 0.5, z / 2)`) within 1e-5 | ruling R5-07 |
| C-SOLID-05 | pass | Property, 200 runs, `seed: 5001`: for `steps` 1 to 8 and each gamut, the lengths follow R5-07's formulas, every index is below the vertex count, every color channel lies in [0, 1], and every `y` lies in [−0.5, 0.5] within 1e-5 | ruling R5-07 |
| C-SOLID-06 | pass | White and black sit at the same place in all three solids (within 1e-5); the red vertex of the Rec. 2020 solid is farther from the axis than P3's, and P3's than sRGB's | ruling R5-07 |
| C-SOLID-07 | failure | `gamutSolid(5, 32)` and `gamutSolid("srgb", "32")` throw `TypeError`; `gamutSolid("cmyk", 32)` and `steps` 0, 65, 2.5 and `NaN` throw `RangeError`; types first, so `gamutSolid(5, 0)` throws `TypeError`; each names `gamutSolid` | ruling R5-07, R-05 |
| C-SOLID-08 | pass | `solidPosition({ l: 0.6, c: 0.1, h: 90 })` is `[0, 0.1, 0.2]` and `solidPosition({ l: 0.5, c: 0, h: null })` is `[0, 0, 0]`, within 1e-12 | ruling R5-08 |
| C-SOLID-09 | failure | `solidPosition(null)` throws `TypeError` and `{ l: NaN, c: 0, h: 0 }` `RangeError`, each naming `solidPosition` | ruling R5-08, R-05 |
| C-SLICE-01 | pass | `gamutSlice("srgb", 0.6)` holds 360 points, `h` 0 to 359 in order, frozen, each `c` equal to `round6(maxChroma(0.6, h, "srgb", 24))`; `gamutSlice("p3", 0.6)` likewise with `"p3"`; `maxChroma(0.6, 0, "rec2020")` still throws M1's `RangeError` | ruling R5-08 |
| C-SLICE-02 | pass | At L 0.3, 0.5, 0.7 and 0.9, for every hue, sRGB's `c` ≤ P3's ≤ Rec. 2020's, within 1e-6 | ruling R5-08 |
| C-SLICE-03 | pass | At L 0 and L 1 every `c` is at most 1e-6, for each gamut | ruling R5-08 |
| C-SLICE-04 | pass | For Rec. 2020 at L 0.6 and the hues 0, 90, 180 and 270, colorjs.io reads `oklch(0.6 c h)` as inside `rec2020` (ε 1e-6) and `oklch(0.6 c+0.001 h)` as outside | ruling R5-06, R5-08 |
| C-SLICE-05 | failure | `gamutSlice("srgb", l)` throws `RangeError` for `l` −0.01, 1.01, `NaN` and `Infinity`, and `TypeError` for `"1"`; a gamut of `3` throws `TypeError` and `"rec709"` `RangeError`; each names `gamutSlice` | ruling R5-08, R-05 |

### 14.2 Engine motion and the studio's params (Task 5.2)

Tests: `tests/unit/engine/tokens/motion-tokens.test.ts`, `tests/unit/engine/tokens/motion-presets.test.ts`,
`tests/unit/engine/tokens/bezier.test.ts`, `tests/unit/engine/generate-m5.test.ts`,
`tests/unit/engine/generate-motion-property.test.ts`, `tests/unit/features/studio/params-m5.test.ts`,
`tests/unit/features/studio/protocol-m5.test.ts`, `tests/unit/features/studio/store-motion.test.ts` (M2's `StubClient`),
and the amended `tests/unit/engine/entry.test.ts` and `tests/unit/export/entry.test.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-MOT5-01 | pass | `normalizeMotionTokens(motionTokens())` deep-equals `motionTokens()` and is deeply frozen; an input built with its keys in another order comes back in the name lists' order; a duration of 0.1234567 comes back 0.123457 | ruling R5-09 |
| C-MOT5-02 | failure | `TypeError`, each message starting with `normalizeMotionTokens: tokens` and the path: `null`, `[]` and `"x"`; no `durations`; `durations.base` `"200"`; `easings.standard` an object; `springs.snappy.bounce` missing; with `name` given, the message starts with it | ruling R5-09, R-05 |
| C-MOT5-03 | failure | `RangeError`, naming the path: a top-level key `budget`; a duration `long`; `durations.base` −1, `NaN` and `Infinity`; an easing of 3 or 5 numbers; `x1` −0.01 or 1.01; `visualDuration` 0; `bounce` −0.01 or 1.01. A `y1` of 1000 passes. Types first: tokens holding both a key `budget` and a string duration throw the `TypeError` | ruling R5-09, R-05 |
| C-MOT5-04 | pass | `generateSystem(DEFAULT_PARAMS, "seed-1")` deep-equals `SPEC`; with `motionTokens: motionTokens()` it deep-equals `SPEC` and has `SPEC`'s spec id; with `CUSTOM_TOKENS` its `motion` is `{ feel, ...CUSTOM_TOKENS }` and every other section deep-equals `SPEC`'s | ruling R5-10, I-M5-08 |
| C-MOT5-05 | failure | `generateSystem` with `motionTokens: 5` throws `TypeError` naming `generateSystem: params.motionTokens`, and with `durations.base` −1 `RangeError` naming `generateSystem: params.motionTokens.durations.base` | ruling R5-10, R-05 |
| C-MOT5-06 | pass | `paramsOfSpec(SPEC).params` has no `motionTokens` key; `paramsOfSpec(CUSTOM).params.motionTokens` deep-equals `normalizeMotionTokens(CUSTOM_TOKENS)`; `generateSystem` of those params and `CUSTOM`'s seed deep-equals `CUSTOM` | ruling R5-10 |
| C-MOT5-07 | pass | `sameMotionTokens(motionTokens(), SPEC.motion)` is true (the `feel` key is not read); one number 1e-6 away makes it false; keys in another order keep it true | ruling R5-10 |
| C-MOT5-08 | pass | Property, 100 runs, `seed: 5002`: for a preset's parameters, a seed from `fc.string({ minLength: 1, maxLength: 20 })` and tokens from `tokensArb`, `withMotion(generateSystem(P, s), T)` deep-equals `generateSystem({ ...P, motionTokens: T }, s)`, and their spec ids are equal | ruling R5-11 |
| C-MOT5-09 | pass | `withMotion(SPEC, motionTokens())` deep-equals `SPEC`; `withMotion(SPEC, CUSTOM_TOKENS)` passes `DesignSpecSchema`, and every section but `motion` equals `SPEC`'s, `meta.createdWith` included | ruling R5-11 |
| C-MOT5-10 | failure | `withMotion(null, CUSTOM_TOKENS)` throws `TypeError` naming `withMotion: spec`; a spec with `version: "x"` throws `RangeError` naming `withMotion`; `withMotion(SPEC, {})` throws `TypeError` naming `withMotion: tokens.durations`; the spec first, so `withMotion(null, null)` names `withMotion: spec` | ruling R5-11, R-05 |
| C-MOT5-11 | pass | `bezierPoints([0.2, 0, 0, 1], 2)` is `[[0, 0], [0.2, 0.5], [1, 1]]`; `bezierPoints([0, 0, 1, 1], 4)` has 5 points with `x === y`; a `y` that rounds to −0 is written 0 (`Object.is`) | ruling R5-13 |
| C-MOT5-12 | failure | `bezierPoints("x", 4)` and `bezierPoints([0.2, 0, 0, 1], "4")` throw `TypeError`; three numbers, `x1` 1.2, a `NaN`, and `segments` 1, 257 and 2.5 throw `RangeError`; each names `bezierPoints` | ruling R5-13, R-05 |
| C-MOT5-13 | failure | `sameMotionTokens(null, motionTokens())` and `sameMotionTokens(motionTokens(), { durations: {} })` (a group without its names) throw `TypeError` naming `sameMotionTokens`; it has no domain beyond its types | ruling R5-10, R-05 |
| C-MOT5-RF5 | pass | Property, 300 runs, `seed: 5002`, over tokens at their edges (durations 0 and 2,000; `y` −2 and 3; `visualDuration` 0.01 and 5; `bounce` 0 and 1) and the lab's caps: `generateSystem`, `themeVars`, `motionFiles` and `springCurve` of every spring succeed, and `motion.css`'s `:root` block holds one `--spring-<name>: linear(` per spring and its reduced-motion block one `linear(0, 1)` per spring | RF5, ruling R5-09 |
| C-PRE5-01 | pass | `MOTION_PRESET_IDS` is `["dyelot", "productive", "expressive", "gentle", "snappy"]`, frozen; `MOTION_PRESETS` is deeply frozen and each entry's `id`, `label`, `note` and `tokens` equal R5-12's table | ruling R5-12 |
| C-PRE5-02 | pass | `MOTION_PRESETS.dyelot.tokens` deep-equals `motionTokens()`; each preset's tokens come back unchanged from `normalizeMotionTokens` and fit `LAB_BOUNDS` | ruling R5-12 |
| C-PRE5-03 | pass | `motionPresetOf` gives each preset's id for its tokens, `"dyelot"` for `motionTokens()`, and `null` for `CUSTOM_TOKENS` and for `productive` with one duration plus 1; no id, label or note holds "material", "carbon", "fluent", "tailwind", "apple", "ibm", "google" or "microsoft" in any case | ruling R5-12 |
| C-PRE5-04 | failure | `motionPresetOf(null)` throws `TypeError` and tokens with `bounce` 2 `RangeError`, each naming `motionPresetOf` | ruling R5-12, R-05 |
| C-STUD5-01 | pass | `DIRECTION_PARAM_KEYS` ends with `"motionTokens"`; `parseParams({ ...freshParams(), motionTokens: CUSTOM_TOKENS })` keeps the tokens; `motionTokens` of `{}` or with `bounce` 2 gives `null` | ruling R5-14 |
| C-STUD5-02 | pass | `mergeParams(P, { motionTokens: CUSTOM_TOKENS })` sets the whole set; `{ motionTokens: undefined }` removes the key; `{ motionTokens: 5 }` throws `TypeError` naming `mergeParams` (its default `caller`) | ruling R5-14 |
| C-STUD5-03 | pass | `touchesPreset(P, { ...P, motionTokens: CUSTOM_TOKENS })` is false; `applyPreset({ ...P, motionTokens: CUSTOM_TOKENS }, "editorial").motionTokens` is `CUSTOM_TOKENS` | ruling R5-14 |
| C-STUD5-04 | pass | `runGenerate({ id: 4, params: { ...DEFAULT_PARAMS, motionTokens: CUSTOM_TOKENS }, seed: "seed-1" })` replies `{ id: 4, ok: true, spec }` with `CUSTOM_TOKENS` in `spec.motion`; with `bounce` 2 it replies `{ id: 4, ok: false, error: { name: "RangeError", message } }`, the message starting `generateSystem: params.motionTokens`, and never throws | ruling R5-10, R5-14, I-M2-03 |
| C-STUD5-05 | pass | `paramsMatchSpec(paramsOfSpec(CUSTOM).params, CUSTOM)` is true, and `paramsMatchSpec(paramsOfSpec(SPEC).params, CUSTOM)` false | ruling R5-14 |
| C-STUD5-06 | pass | The store loads `#s=<encodeSpec(CUSTOM)>`; `regenerate()` sends params whose `motionTokens` deep-equal `CUSTOM_TOKENS`, and the committed spec keeps them; `setParams({ motion: "calm" })` keeps them too | ruling R5-10, R5-14 |
| C-ENTRY5-01 | pass | The engine entry's key set is M4's plus exactly the 17 names of 5.1, each the same object its home module exports; the spec entry's key set is unchanged | ruling R5-04 |
| C-ENTRY5-02 | pass | The export entry's key set is exactly `buildBundle`, `RECEIPT_FORMAT`, `sha256`, `zipBundle`, `zipName`, `motionFiles`, `brandProps` and `mediaName`, each the same object its home module exports | ruling R5-28 |

### 14.3 Flavor core (Task 5.3)

Tests: `tests/unit/engine/flavor.test.ts` (core); `tests/unit/flavor/flavor.test.ts`,
`tests/unit/flavor/flavor-mount.test.ts` (a fake WebGL2 context that records its calls, fake `requestAnimationFrame`,
`IntersectionObserver`, `ResizeObserver` and `matchMedia`, fake timers), `tests/unit/flavor/flavor-react.test.tsx`,
`tests/unit/flavor/brand-intro.test.ts` and `tests/unit/flavor/raw.test.ts` (web).

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-STOPS-01 | pass | `flavorStops(SPEC, "light")` is the light hexes of neutral 100, primary 200, secondary 400, accent 400 and primary 500, in that order, and `"dark"` the dark hexes of the same steps; `FLAVOR_STEPS` is that list, frozen | ruling R5-16 |
| C-STOPS-02 | pass | Property, 100 runs, `seed: 5003`, over generated designs and both modes: every stop is a step hex of that mode (I-M5-01) | ruling R5-16, I-M5-01 |
| C-STOPS-03 | failure | `flavorStops(null, "light")` and `flavorStops(SPEC, 1)` throw `TypeError`; `flavorStops(SPEC, "dim")` throws `RangeError`; a spec whose primary light scale lacks step 200 throws `TypeError` naming `flavorStops: spec.color.palettes.primary.light`; each names `flavorStops` | ruling R5-16, R-05 |
| C-STOPS-04 | pass | `flavorSeed("0000000000000000")` is `[0, 0]`, `flavorSeed("8000000040000000")` `[50, 25]`, and `flavorSeed("ffffffffffffffff")` `[100, 100]` (4 decimals); two calls on `specId(SPEC)` agree | ruling R5-16 |
| C-STOPS-05 | failure | `flavorSeed(5)` throws `TypeError`; `"abc"`, `"4177A34C3648BB5A"` and a 17-digit id throw `RangeError`; each names `flavorSeed` | ruling R5-16, R-05 |
| C-FLAV-01 | pass | `LOOP_SECONDS` 10, `LOOP_FRAMES` 300, `GRAIN` 0.035, `MAX_DPR` 1.5, `MAX_BUFFER` `{ width: 1920, height: 1080 }` and `DEFAULT_FADE` `{ durationMs: 200, easing: [0.2, 0, 0, 1] }`, the objects frozen; `GRAIN_SVG` equals R5-20's text and `GRAIN_URL` `url("data:image/svg+xml,${encodeURIComponent(GRAIN_SVG)}")` | ruling R5-17, R5-20 |
| C-FLAV-02 | pass | `flavorBackground(STOPS)` equals R5-20's two values with `STOPS`; with the five `var()` stops it equals the declarations of `flavor/flavor.css` (C-FEX-03), and `scanLine` finds nothing in those values | ruling R5-20 |
| C-FLAV-03 | failure | `flavorBackground` with 4 stops, or a stop `"red"`, `"#fff"` or `"rgb(0 0 0)"`, throws `RangeError`; `null` and a stop `5` throw `TypeError`; each names `flavorBackground` | ruling R5-20, R-05 |
| C-FLAV-04 | pass | `bufferSize(800, 450, 1)` is 800 × 450; `(800, 450, 2)` is 1200 × 675 (the ratio capped at 1.5); `(2000, 1200, 1.5)` is 1800 × 1080; `(0.2, 0.2, 1)` is 1 × 1 | ruling R5-18 |
| C-FLAV-05 | failure | `bufferSize("1", 1, 1)` throws `TypeError`; −1, a ratio of 0 and `NaN` throw `RangeError`; each names `bufferSize` | ruling R5-18, R-05 |
| C-FLAV-06 | pass | `easeAt([0, 0, 1, 1], x)` is `x` within 1e-6 at 0, 0.25, 0.5 and 1; `easeAt([0.2, 0, 0, 1], 0.2)` is 0.5 within 1e-5; every easing gives 0 at 0 and 1 at 1 | ruling R5-18 |
| C-FLAV-07 | failure | `easeAt` with `x` −0.1, 1.1 or `NaN`, three numbers, or `x1` 1.5 throws `RangeError`; `"x"` throws `TypeError`; each names `easeAt` | ruling R5-18, R-05 |
| C-FLAV-08 | pass | The shader texts: both start `#version 300 es`; the vertex text reads no attribute; the fragment declares the seven uniforms of R5-17 and no other; time enters only as `u_phase`, inside `cos` and `sin` of `1.0`, `2.0` and `3.0` times it, on circles of 0.60, 0.40 and 0.25; it holds the webgl-noise notice ("Permission is hereby granted, free of charge" and "Ashima Arts" and "Stefan Gustavson"); its four matrices, read from the text and applied in the test, take 200 random sRGB colors to `rgbToOklab(rgb, "srgb")` and back within 1e-6 | ruling R5-17, I-M5-07 |
| C-FLAV-09 | pass | `supportsFlavor()` is false in jsdom, true when a canvas's `getContext("webgl2")` gives a context, and false, with no throw, when `getContext` throws | ruling R5-21 |
| C-FLAV-10 | pass | `mountFlavor` on a canvas whose `getContext` gives null: `data-flavor` `fallback`, `data-flavor-reason` `no-webgl2`, `onFallback` called once with `"no-webgl2"`, the canvas's inline `background-image` set to `flavorBackground(stops).backgroundImage`, and no console output | ruling R5-19, R5-20, I-M5-03 |
| C-FLAV-11 | pass | A fake context whose compile status is false, and one whose link status is false, each give the `no-webgl2` fallback with no throw and no console output | ruling R5-19 |
| C-FLAV-12 | pass | With the fake context and the observer reporting the canvas visible: `data-flavor` `running`, a frame calls `drawArrays(TRIANGLES, 0, 3)` and uploads `u_from` and `u_to` as the stops over 255; `setPaused(true)` gives `paused` and no further frame request; `setPaused(false)` gives `running`; a hidden page gives `hidden`, the observer reporting it outside `offscreen`; paused and hidden together read `paused` | ruling R5-18 |
| C-FLAV-13 | pass | `reducedMotion: true` gives `still`, one draw with `u_phase` 0 and no frame request; with `matchMedia` matching `reduce` the same; its `change` to no preference gives `running`; `setStops` while `still` draws once with `u_mix` 1; the OS setting turning to `reduce` 50 ms into a 100 ms fade gives `still` with `u_mix` 1 and the target stops | ruling R5-18, I-M5-02 |
| C-FLAV-14 | pass | `setStops(S2)` with `fade { durationMs: 100, easing: [0, 0, 1, 1] }` and the fake clock: `data-flavor-stops` reads `S2` at once; `u_mix` is 0.5 at 50 ms and 1 at 100 ms; a third `setStops` at 50 ms uploads as `u_from` the OKLab mix of the first two sets at 0.5, within 1e-4 per channel | ruling R5-18 |
| C-FLAV-15 | pass | `drawAt(0.25)` draws with `u_phase` π / 2 and leaves `paused`; `drawAt(1)` uses 2π; `autoplay: false` mounts `paused` with one draw at phase 0; `size { width: 1280, height: 720 }` sets the canvas to 1280 × 720 and a resize changes nothing; under `reducedMotion: true` (`still`) `drawAt(0.25)` draws with `u_phase` π / 2 and the state stays `still`; after a fallback `drawAt` draws nothing and does not throw | ruling R5-18, R5-21 |
| C-FLAV-16 | pass | A `webglcontextlost` event is `preventDefault`ed, gives `fallback` with reason `context-lost`, calls `onFallback("context-lost")` once and stops the frames; a later `webglcontextrestored` changes nothing | ruling R5-19 |
| C-FLAV-17 | pass | `destroy()` cancels the frame request, disconnects both observers, removes the `visibilitychange` and `change` listeners, calls `loseContext()` of `WEBGL_lose_context` and removes the three attributes; a second `destroy()` and a `setStops` after it do nothing and do not throw | ruling R5-21 |
| C-FLAV-18 | failure | `mountFlavor(null, options)` and `mountFlavor(canvas, null)` throw `TypeError`; 4 stops, a stop `"#ggg000"`, a seed of one number, `fade.durationMs` −1, a size 1 × 720 or 4097 wide, and an option `loop` throw `RangeError`; `seed: ["1", 2]`, `reducedMotion: "yes"` and `onFallback: 5` throw `TypeError`; types first, so `{ stops: ["#000000"], seed: "x" }` throws `TypeError`; the handle's `setStops(["#000000"])` and `drawAt(1.5)` throw `RangeError` and `setPaused("no")` `TypeError`; each names its function | ruling R5-21, R-05 |
| C-FLAV-19 | pass | `<Flavor>` renders one `canvas` with `aria-hidden="true"`, its `className` and the inline style `flavorBackground(stops)` in its first render (so `renderToString` holds the gradient); calls `mountFlavor` once in an effect with its props; calls `setStops` once per `stops` change on the same canvas and `setPaused` per `paused` change; a change of `seed`, `fade` or `reducedMotion` destroys the handle and mounts a new canvas; it destroys on unmount, and mounts a new canvas for a new `key` | ruling R5-21 |
| C-FLAV-20 | pass | Read through `?raw` in the `web` project, `flavor.mjs`, `flavor-react.tsx`, `remotion/brand-intro.tsx` and `remotion/root.tsx` equal their files byte for byte (probe 3) | ruling R5-05, R5-23, I-M5-06 |
| C-BRAND-01 | pass | `BRAND_INTRO` is `{ width: 1280, height: 720, fps: 30, durationInFrames: 180 }` and `BRAND_TIMELINE` `{ name: 0, oneLiner: 6, palettes: 30, rowGap: 12, stepGap: 2, specimen: 96, receipt: 132 }` | ruling R5-22 |
| C-BRAND-02 | pass | `springAt({ settleMs: 400, samples: [0, 0.5, 1] }, f, 30)` is 0 at frame −1, 0.25 at 3, 0.5 at 6, 1 at 12 and at 100 | ruling R5-22 |
| C-BRAND-03 | failure | `springAt` with a frame of `NaN` throws `RangeError`; one sample or a `null` curve throws `TypeError`; each names `springAt` | ruling R5-22, R-05 |
| C-BRAND-04 | pass | `brand-intro.tsx` opens with R5-22's four comment lines, and the text holds `https://remotion.pro/license` | ruling R5-22, R5-55 |
| C-BRAND-05 | pass | `root.tsx` imports exactly `remotion`, `./brand-intro` and `./brand.json`; registers `brand-intro-light` and `brand-intro-dark` with `{...BRAND_INTRO}` and `brand.light` and `brand.dark`; and calls `registerRoot(RemotionRoot)` once | ruling R5-22 |

### 14.4 Export (Task 5.4)

Tests: `tests/unit/export/flavor.test.ts`, `tests/unit/export/brand.test.ts`, `tests/unit/export/media.test.ts`,
`tests/unit/export/bundle-flavor.test.ts`, `tests/unit/export/checker-flavor.test.ts`, the amended
`tests/unit/export/{golden,zip}.test.ts`, and `tests/unit/features/export/download.test.ts` (web).

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-FEX-01 | pass | `FLAVOR_SOURCES` holds exactly its four keys, each text equal to its file under `src/flavor/` byte for byte (read with `node:fs` in the test) | ruling R5-05, I-M5-06 |
| C-FEX-02 | pass | `flavorFiles(SPEC, ORIGIN)` gives R5-24's nine paths in order; each text has no `\r`, no byte-order mark and no line ending in a space or a tab, and ends with one newline; the four raw files equal `FLAVOR_SOURCES` | ruling R5-24, R3-09 |
| C-FEX-03 | pass | `flavor/flavor.css` is M3's three header comments for `SPEC`, the fourth comment of 12.1 and R5-20's rule with the five `var()` stops; `scanLine` finds nothing on any of its lines | ruling R5-20, R5-24 |
| C-FEX-04 | pass | `flavor/palette.json` reads `{ name: "untitled", loopSeconds: 10, seed: flavorSeed(specId(SPEC)), fade: { durationMs: 200, easing: [0.2, 0, 0, 1] }, light: flavorStops(SPEC, "light"), dark: flavorStops(SPEC, "dark") }` with its keys in that order, written `JSON.stringify(value, null, 2)` plus a newline | ruling R5-24, R3-11 |
| C-FEX-05 | pass | The two READMEs equal 12.1's texts with `SPEC`'s name, lot and link; `flavor/remotion/README.md` holds `https://remotion.pro/license`, "Companies of four or more people need a Remotion Company License." and `npm install remotion@4.0.539 @remotion/cli@4.0.539 react react-dom` | ruling R5-24, R5-55 |
| C-FEX-06 | pass | `flavor/remotion/brand.json` is `{ light: brandProps(SPEC, "light"), dark: brandProps(SPEC, "dark") }` in R3-11's layout | ruling R5-24, R5-30 |
| C-FEX-07 | pass | `brandProps(SPEC, "light")`: `name` `"untitled"`, `oneLiner` `""`, `lot` `lotTag(specId(SPEC))`, `checks` the `requiredPass` and `required` of `summarize(measureSpec(SPEC), lintSpec(SPEC), "srgb").contrast`, the palettes primary, secondary, accent, neutral and danger with their 11 light hexes, `colors` the eight light roles, `fonts` the light `--font-display` and `--font-body` of `themeVars`, and `motion` `{ baseMs: 200, standard: [0.2, 0, 0, 1], springs }` with `settleMs` 411, 706 and 1056; `JSON.parse(JSON.stringify(props))` deep-equals it | ruling R5-30 |
| C-FEX-08 | failure | `brandProps(null, "light")` throws `TypeError` and `brandProps(SPEC, "dim")` `RangeError`, each naming `brandProps` | ruling R5-30, R-05 |
| C-FEX-09 | pass | `mediaName(SPEC, "brand", "mp4")` is `untitled-<8 hex>-brand.mp4` and `(SPEC, "loop", "webm")` `untitled-<8 hex>-loop.webm`; a design named "Café Crème" gives `cafe-creme-<8 hex>-brand.mp4` | ruling R5-28 |
| C-FEX-10 | failure | `mediaName(SPEC, "poster", "mp4")` and `(SPEC, "brand", "mov")` throw `RangeError`; `(SPEC, 1, "mp4")` and `(null, "brand", "mp4")` throw `TypeError`; each names `mediaName` | ruling R5-28, R-05 |
| C-FEX-11 | pass | `buildBundle({ spec: SPEC, origin: ORIGIN })` and `flavor: false` equal M4's `BUNDLE` byte for byte; `flavor: true` gives 29 files: `BUNDLE`'s 20 with the nine inserted right after `motion/gsap.ts`; every file but `receipt.json` equals `BUNDLE`'s or `flavorFiles`'; `receipt.files` lists the 28 others with their byte lengths and SHA-256 | ruling R5-24, R5-26 |
| C-FEX-12 | pass | `src/flavor/remotion/brand.json` equals the `default-flavor` golden's `flavor/remotion/brand.json` byte for byte | ruling R5-22, R5-27 |
| C-FEX-13 | failure | `buildBundle({ spec: SPEC, origin: ORIGIN, flavor: "yes" })`, `flavor: 1` and `flavor: null` throw `TypeError` naming `buildBundle: input.flavor` | ruling R5-24, R-05 |
| C-FEX-14 | pass | The `default-flavor` golden's files, byte lengths and SHA-256 and its zip's SHA-256 equal `manifest.json`; its files equal the `default` golden's except `receipt.json`, with the nine inserted after `motion/gsap.ts`; every other golden is unchanged | ruling R5-27, I-M5-08 |
| C-FEX-15 | pass | `zipBundle(FLAVOR_BUNDLE)` accepts `flavor/README.md` and `flavor/remotion/README.md` and its entries are the bundle's files in order; a path `README.MD`, `Readme.md` or `docs/A.md` still throws `RangeError` | ruling R5-24 |
| C-FEX-16 | pass | The bundled checker on `FLAVOR_APP` exits 0 with `PASS`, and its `checked.files` counts the four moved copies | ruling R5-26 |
| C-FEX-17 | failure | `FLAVOR_APP` with `color: #ff0000;` added to the moved `src/components/flavor.css` exits 1 with a `raw-color` finding at that path and line | ruling R5-26 |
| C-FEX-18 | pass | `downloadBlob("a.mp4", bytes, "video/mp4")` clicks a link to a `Blob` of type `video/mp4`; with no type the `Blob` is `application/zip`; a type of `5` throws `TypeError` and `""` `RangeError`, each naming `downloadBlob` | ruling R5-28 |
| C-FEX-19 | failure | `flavorFiles(null, ORIGIN)` throws `TypeError` and `flavorFiles(SPEC, "http://dyelot.vercel.app")` `RangeError`, each naming `flavorFiles` | ruling R5-24, R-05 |

### 14.5 Landing and site (Task 5.5)

Tests: `tests/unit/features/landing/heroes.test.ts`, `tests/unit/features/landing/story.test.ts`,
`tests/unit/features/landing/story-css.test.ts`, `tests/unit/features/landing/cycle.test.ts`,
`tests/unit/site/csp.test.ts`, `tests/unit/site/nav.test.tsx`, `tests/unit/site/config-m5.test.ts`, and the amended
`tests/unit/site/{define,routes,next-config}.test.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-LAND5-01 | pass | `HERO_PARAMS` equals R5-31's table (names, seeds, primary OKLCH), frozen; each primary is inside sRGB and its hex is the table's | ruling R5-31 |
| C-LAND5-02 | pass | `heroSpec(i)` deep-equals `generateSystem({ ...freshParams(), primary, name }, seed)` of row `i + 1` and is the same object on a second call; `defaultDesign()` is `heroSpec(0)`; `heroCards()` gives `seed` `flavorSeed(specId(heroSpec(0)))`, `fade` the first design's `base` duration and `standard` easing, and six cards with the name, `href` `/studio#s=` plus `encodeSpec(spec)` and `stops` `flavorStops(spec, "dark")`; `HERO_CARDS` (the committed JSON) deep-equals `heroCards()`; with `DYELOT_UPDATE_HEROES=1` the test writes the file, and with `CI` also set it fails before writing | ruling R5-31 |
| C-LAND5-08 | failure | `heroSpec("0")` throws `TypeError`, and `heroSpec(6)`, `heroSpec(-1)` and `heroSpec(0.5)` throw `RangeError`, each naming `heroSpec` | ruling R5-31, R-05 |
| C-LAND5-03 | pass | `storySteps(HERO)` gives the kinds `seed`, `scale`, `roles`, `type` and `receipt` in order: `#f66c6d` and `oklch(0.7000 0.1700 22.00)`; the 11 light primary steps with their contrasts to 2 decimals; the six roles of 7.2 with their light hexes; the two family names; the first 8 space steps; and the receipt's `requiredPass` and `required` | ruling R5-33 |
| C-LAND5-04 | failure | `storySteps(null)` throws `TypeError` and `storySteps(SPEC)` (no locked primary seed) `RangeError`, each naming `storySteps` | ruling R5-33, R-05 |
| C-LAND5-05 | pass | `story.css`, read as text with its blocks matched: every `animation`, `animation-timeline` and `animation-range` declaration sits inside `@supports (animation-timeline: view())` inside `@media (prefers-reduced-motion: no-preference)`; `animation-range` is `entry 0% entry 100%`; the one `@keyframes` changes only `opacity` and `translate`, by at most 24 px; no rule outside the guards sets `opacity`, `translate` or `transform` | ruling R5-33 |
| C-LAND5-06 | pass | `nextIndex(0, 6)` is 1 and `nextIndex(5, 6)` 0; `paletteLine(0, 6, "Madder")` is "Palette 1 of 6: Madder." | ruling R5-32 |
| C-LAND5-07 | failure | `nextIndex(6, 6)`, `nextIndex(-1, 6)` and `nextIndex(0, 0)` throw `RangeError` and `nextIndex("0", 6)` `TypeError`; `paletteLine(0, 6, "")` throws `RangeError`; each names its function | ruling R5-32, R-05 |
| C-SITE5-01 | pass | `cspHeader("bm9uY2Utbm9uY2Utbm9uY2U=", { dev: false })` equals 12.2's string with that nonce; `dev: true` adds `'unsafe-eval'` and `ws: http://localhost:*` after `https://www.remotion.pro` | ruling R5-58 |
| C-SITE5-02 | pass | `SITE.routes.sitemap` is `["/", "/studio", "/explore", "/motion"]`, and `sitemap()` lists the four absolute URLs in that order; `robots()` is C-SITE4-01's value | ruling R5-34 |
| C-SITE5-03 | pass | The metadata of `/explore` and `/motion`: titles "Explorer" and "Motion lab", the descriptions of 8.1 and 9.1 (140 and 116 characters), canonical `/explore` and `/motion` | ruling R5-34 |
| C-SITE5-04 | pass | `AppNav` renders "home", "studio", "explore", "motion" and "github" in order with their hrefs; `active="explore"` marks only "explore" with `aria-current="page"`; no `active` marks none; `AppNavProps["active"]` is `"home" \| "explore" \| "motion" \| undefined` (`expectTypeOf`) | ruling R5-34 |
| C-SITE5-05 | pass | `next.config.ts`'s `turbopack.rules` deep-equal the three rules of 12.3 and hold no `experimental` key; `raw.d.ts` declares the three modules; `tsconfig.json`'s `include` and `biome.json`'s `files.includes` hold `src/flavor/*.mjs`; `.github/dependabot.yml`'s npm entry holds the groups `remotion` and `three` with 12.3's names | ruling R5-23, R5-60 |

### 14.6 Explorer (Task 5.6)

Tests: `tests/unit/features/explore/scene.test.ts`, `tests/unit/features/explore/webgl.test.ts`,
`tests/unit/features/explore/flat-view.test.tsx`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-EXPL5-01 | pass | `scenePoints(SPEC, "light")` gives 88 points in `PALETTE_NAMES` then `STEPS` order, each with the step's hex and OKLCH, `position` `solidPosition(oklch)`, and `seed` true exactly where the palette's `seedStep.light` is that step | ruling R5-36 |
| C-EXPL5-02 | pass | `sliceSteps(points, 0.6)` keeps exactly the points with \|L − 0.6\| ≤ 0.04, in order: L 0.64 stays and 0.6401 goes | ruling R5-37 |
| C-EXPL5-03 | pass | `cameraPosition(DEFAULT_CAMERA)` is 3.2 × (cos 25° sin 35°, sin 25°, cos 25° cos 35°) within 1e-9; `cameraOf(cameraPosition(c), 0)` gives `c` back for turn −180 to 180 by 15, tilt 0 to 75 by 15 and zoom 0.5 to 2 by 0.25; at tilt 90 `cameraOf(cameraPosition(c), t)` gives tilt 90 and turn `t` for any held `t`; `cameraOf` rounds (35.4° to 35), clamps (tilt −5° to 0, zoom 3 to 2) and wraps (turn 190° to −170) | ruling R5-38 |
| C-EXPL5-04 | failure | `cameraPosition` with turn 181, tilt 91 or zoom 0.4 throws `RangeError` and with turn `"1"` `TypeError`; `cameraOf([0, 0, 0], 0)` throws `RangeError` and `cameraOf([0, 1, 3], "0")` `TypeError`; each names its function | ruling R5-38, R-05 |
| C-EXPL5-05 | pass | `slicePath(points, 320)` starts `M`, has 360 vertices and ends `Z`; hue 0 at chroma 0.5 is `310.00 160.00` and hue 90 at 0.25 `160.00 85.00`; Rec. 2020's outline at L 0.85 stays inside the 320 box; `dotAt({ l: 0.5, c: 0, h: null }, 320)` is `[160, 160]` | ruling R5-37 |
| C-EXPL5-06 | pass | `sceneSummary("Madder", "light", "srgb", 0.6)` is "Madder: 88 steps of the light scales in OKLab, inside the sRGB gamut solid, cut at L 0.60."; `p3` reads "Display P3" and `rec2020` "Rec. 2020"; `EXPLORE_LINES` equals 8.4's table, frozen | ruling R5-37, R5-39 |
| C-EXPL5-07 | failure | `sceneSummary` with gamut `"x"` or L 2 throws `RangeError` and with name `5` `TypeError`; `scenePoints(SPEC, "dim")` throws `RangeError`; each names its function | ruling R5-37, R-05 |
| C-EXPL5-08 | pass | `supportsWebgl2(create)` is true when the canvas gives a context, false when it gives null, and false, with no throw, when `getContext` throws | ruling R5-39 |
| C-EXPL5-09 | pass | `FlatView` for `SPEC` at L 0.6 renders three `path`s with 8.3's line styles, one `circle` per slice step filled with its hex, the caption with the step count, the legend list, and the step items in 8.3's format; at an L no step is near, the one item "No step lies within 0.04 of L <l>." | ruling R5-37 |
| C-EXPL5-10 | failure | `scenePoints(null, "light")`, `sliceSteps(null, 0.5)`, `cameraOf("x", 0)`, `slicePath(null, 320)` and `dotAt(null, 320)` throw `TypeError`; `sliceSteps(points, 2)`, `slicePath(points, 0)` and `dotAt({ l: 0.5, c: 0, h: null }, -1)` throw `RangeError`; each names its function | ruling R5-37, R5-38, R-05 |

### 14.7 Motion lab (Task 5.7)

Tests: `tests/unit/features/motion/lab.test.ts`, `tests/unit/features/studio/pages.test.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-LAB-01 | pass | `LAB_BOUNDS` equals 9.3's table, frozen | ruling R5-42 |
| C-LAB-02 | pass | `readField` reads `"200"` as 200 and `" 12.4 "` as 12 for a duration, `"0.333"` as 0.33 for an `x`, `"−0.5"` (U+2212) as −0.5 for a `y`, `"2"` and `"0.05"` for a spring's duration, and `"1"` for a bounce | ruling R5-42 |
| C-LAB-03 | failure | `readField` gives `{ ok: false, message }` with its kind's sentence for `""`, `"abc"`, `"1e400"`, `"501"` and `"-1"` (duration), `"1.01"` (`x`), `"2.01"` (`y`), `"0.04"` and `"2.01"` (spring duration) and `"1.01"` (bounce); property, 500 runs, `seed: 5007`: it never throws for any string; a path of an unknown kind throws `RangeError` and a text of `5` `TypeError`, each naming `readField` | ruling R5-42, R-05 |
| C-LAB-04 | pass | `editTokens(motionTokens(), { kind: "duration", name: "base" }, 160)` sets `base` 160 and keeps every other value, normalized and frozen; an easing path with `index` 1 sets `y1`; a spring path sets its field; the input is unchanged | ruling R5-41 |
| C-LAB-05 | failure | `editTokens` with `x1` 1.5 throws `RangeError`, an `index` of 4 `RangeError`, and `null` tokens `TypeError`, each naming `editTokens` | ruling R5-41, R-05 |
| C-LAB-06 | pass | `fieldText` writes 200 as `"200"`, 0.2 as `"0.2"`, 0 as `"0"`, 0.05 as `"0.05"` and 1 as `"1"` | ruling R5-42 |
| C-LAB-07 | pass | `curvePath(bezierPoints([0, 0, 1, 1], 2), { width: 200, height: 200, pad: 20, yMin: −1, yMax: 2 })` is `M 20.00 126.67 L 100.00 100.00 L 180.00 73.33` | ruling R5-41 |
| C-LAB-08 | pass | `durationBars` of a brisk design gives exported equal to stored (50 to 500); of a calm design exported 63, 125, 188, 250, 375, 500 and 500 | ruling R5-41, R2-08 |
| C-LAB-09 | pass | `presetLine(motionTokens())` is "These tokens match the dyelot preset. dyelot's default: 50 to 500 ms, standard curves and three springs." and `presetLine(CUSTOM_TOKENS)` "Custom tokens: no preset matches." | ruling R5-41 |
| C-LAB-10 | pass | `reducedTransition(SPEC)` is `{ duration: 0.1, ease: "linear" }` | ruling R5-43 |
| C-LAB-11 | failure | `curvePath` with `yMin` not below `yMax` or a point holding `NaN` throws `RangeError` and with `null` points `TypeError`; `fieldText(null, path)`, `durationBars(null)`, `presetLine(null)` and `reducedTransition(null)` throw `TypeError`; `fieldText` with a path of kind `"x"` and `presetLine` of tokens with `bounce` 2 throw `RangeError`; `pageHref("explore", null)` and `motionLine(null)` throw `TypeError`; each names its function | ruling R5-41 to R5-45, R-05 |
| C-STUD5-07 | pass | `pageHref("explore", SPEC)` is `/explore#s=` plus `encodeSpec(SPEC)`, and likewise for `motion` and `studio`; `pageHref("about", SPEC)` throws `RangeError` naming `pageHref` | ruling R5-40, R5-45 |
| C-STUD5-08 | pass | `motionLine(SPEC)` is "Motion tokens: dyelot preset.", `motionLine(CUSTOM)` "Motion tokens: custom." and `motionLine(withMotion(SPEC, MOTION_PRESETS.gentle.tokens))` "Motion tokens: Gentle preset." | ruling R5-45 |

### 14.8 View transitions (Task 5.8)

Tests: `tests/unit/features/preview/transition.test.ts`, `tests/unit/features/preview/reduced.test.ts`,
`tests/unit/features/studio/token-row.test.ts`, `tests/unit/features/studio/scales-row.test.tsx`,
`tests/unit/site/globals-css.test.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-VT-01 | pass | `templateTransition(false)` is `{ share: "auto", enter: "auto", exit: "auto", default: "none" }` and `templateTransition(true)` `{ share: "none", enter: "none", exit: "none", default: "none" }`, each frozen | ruling R5-46 |
| C-VT-02 | failure | `templateTransition("yes")` throws `TypeError` naming `templateTransition` | ruling R5-46, R-05 |
| C-VT-03 | pass | `tokenRow(SPEC, "light", "primary", 500)` gives `token` `--color-primary-500`, `utility` `bg-primary-500`, `cssVar` `var(--primary-500)`, the step's hex, `formatOklch` of its OKLCH, its contrast as `<2 decimals>:1`, and the roles whose light hex equals the step's in `ROLE_NAMES` order; a step no role uses gives `[]`; `--primary-500` is a name `themeCss(SPEC, ORIGIN)` declares in `:root` and `.dark` | ruling R5-47 |
| C-VT-04 | failure | `tokenRow` with mode `"dim"`, palette `"teal"` or step 450 throws `RangeError` and with a `null` spec `TypeError`, each naming `tokenRow` | ruling R5-47, R-05 |
| C-VT-05 | pass | `swatchName("primary", 500)` is `dyelot-swatch-primary-500`, and the 88 names are distinct | ruling R5-47 |
| C-VT-06 | pass | `watchReducedMotion(media, onChange)` calls `onChange` with `media.matches` at once and on each `change`; the function it returns removes the listener; `useOsReducedMotion()` rendered with `renderToString` gives false, and rendered client-only with `render` gives `matchMedia("(prefers-reduced-motion: reduce)").matches` from its first render | ruling R5-49 |
| C-VT-07 | pass | `Scales` rendered: a step button opens its token row (`aria-expanded="true"`, `data-token-row`, 10.2's fields); opening another step closes the first; Escape closes it and focus returns to the compact button; ↓ and ↑ move focus within a palette and Home and End to its ends, with one `tabIndex` 0 per palette | ruling R5-47 |
| C-VT-08 | pass | `src/app/globals.css` holds 10.3's five rules as written | ruling R5-48 |
| C-VT-10 | pass | `MotionScope` rendered with `reduced` false passes `reducedMotion="user"` while the OS query does not match and `"always"` once its `change` reports a match; with `reduced` true it passes `"always"` either way | ruling R5-49 |
| C-VT-09 | failure | `swatchName(5, 500)` and `watchReducedMotion(null, f)` and `watchReducedMotion(media, 5)` throw `TypeError`; `swatchName("teal", 500)` throws `RangeError`; each names its function; `templateTransition` has no domain beyond its type | ruling R5-47, R5-49, R-05 |

### 14.9 The Flavor dialog's helpers (Tasks 5.9 and 5.10)

Tests: `tests/unit/features/flavor/video.test.ts`, `tests/unit/features/flavor/render.test.ts`,
`tests/unit/features/flavor/record.test.ts` (fake renderer, fake Mediabunny, the fake WebGL2 context of 14.3),
`tests/unit/features/flavor/video-job.test.tsx` (the hook, with a fake job).

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-DLG-01 | pass | `canMakeVideo` is true for `{ VideoEncoder: function () {} }` and false for `{}` and `{ VideoEncoder: 5 }` | ruling R5-53 |
| C-DLG-02 | pass | `nextAnnounced(0, 0.05)` is null, `(0, 0.1)` 10, `(10, 0.27)` 20, `(20, 0.27)` null, `(90, 1)` 100 and `(100, 1)` null; `progressLine("render", 30)` is "Rendering: 30%.", `progressLine("record", 30)` "Recording: 30%." and `doneLine("a.mp4")` "Downloaded a.mp4." | ruling R5-53 |
| C-DLG-03 | failure | `nextAnnounced(0, 1.1)` throws `RangeError` and `("0", 0.5)` `TypeError`; `progressLine("encode", 10)` throws `RangeError`; each names its function | ruling R5-53, R-05 |
| C-DLG-04 | pass | `VIDEO_LINES` equals 13.3's table and `FLAVOR_LINES` 6.4's, each frozen | ruling R5-53, R5-19 |
| C-DLG-05 | pass | `pickRenderTarget` asks first for `{ width: 1280, height: 720, container: "mp4", videoCodec: "h264", muted: true, outputTarget: "arraybuffer" }`: yes gives `{ container: "mp4", videoCodec: "h264" }`; no, then yes for WebM, gives `{ container: "webm", videoCodec: "vp8" }`; no for both gives null; a throw counts as no | ruling R5-53 |
| C-DLG-06 | pass | `renderBrandVideo` passes `composition` `{ id: "brand-intro", component: BrandIntro, width: 1280, height: 720, fps: 30, durationInFrames: 180, defaultProps: props }`, `inputProps: props`, the target, `muted: true`, `licenseKey: "free-license"`, `outputTarget: "arraybuffer"`, the signal and an `onProgress` that forwards `progress`; it gives `done` with the bytes of `getBlob()`; a rejected `load()` gives `load-failed`, an `AbortError` `canceled`, any other throw `failed`, and no outcome holds the error | ruling R5-53, I-M5-03 |
| C-DLG-07 | pass | `pickCodec` asks `canEncodeVideo` with `{ width: 1280, height: 720 }` for `avc`, `vp9` and `vp8` in turn, and gives `{ avc, mp4 }`, `{ vp9, webm }` or `{ vp8, webm }` for the first yes, or null | ruling R5-56 |
| C-DLG-08 | pass | `recordLoop` with the fakes: 300 `add` calls with the timestamps `i / 30` and the duration `1 / 30` in order, each after `drawAt(i / 300)`; one `finalize()`; the bytes of `target.buffer`; progress `(i + 1) / 300`; an abort midway calls `output.cancel()` and gives `canceled`; a throwing `add` gives `failed`; a fallback reported by the flavor midway (the fake context's compile status false, or a `webglcontextlost` event) calls `output.cancel()` and gives `failed`; the flavor handle is destroyed in every outcome | ruling R5-56 |
| C-DLG-09 | failure | `canMakeVideo(null)`, `doneLine(5)`, `renderBrandVideo(null, target, deps)` and `recordLoop(flavor, null)` throw `TypeError`; `doneLine("")`, a target `container` of `"mov"` and `recordLoop` with 4 stops throw `RangeError`; each names its function, and none starts a load | ruling R5-53, R5-56, R-05 |
| C-DLG-10 | failure | `pickRenderTarget(null)` and `pickCodec(null)` throw `TypeError`, each naming its function; they have no domain beyond their types | ruling R5-53, R5-56, R-05 |
| C-DLG-RF4 | pass | Two `renderBrandVideo` calls through one `useVideoJob` (a hook test) start one job: the second press while a job runs does nothing; closing (the hook's `abort`) gives `canceled` and leaves the job idle | RF4, ruling R5-51, R5-53 |

### 14.10 Repository guards (every task)

Tests: `tests/unit/engine/repo-guards-m5.test.ts`, `tests/unit/scripts/gate.test.ts`.

| Id | Kind | Case | Origin |
|---|---|---|---|
| C-GUARD5-01 | pass | The ids are read from the rows of `docs/specs/05-motion-3d.md` between `\n## 14. ` and `\n## 15. ` (`^\| [CF]-[A-Z0-9]+-[A-Z0-9]+ \|`, one per row, each once); every `C-` id appears whole in a `describe` or `it` title under `tests/unit` and every `F-` id in a `test` title under `tests/e2e`, read from each file's syntax tree; a probe id with no title is reported | ruling R5-62 |
| C-GUARD5-02 | pass | `package.json` pins exactly R5-60's versions and holds none of `postprocessing`, `@react-three/postprocessing`, `gsap`, `@remotion/cli`, `@remotion/three`, `lenis`, `@paper-design/shaders` or `detect-gpu`; `motion` is `14.3.0` | ruling R5-50, R5-60 |
| C-GUARD5-03 | pass | `three`, `three/*` and `@react-three/*` are imported only under `src/features/explore/`, and only R5-35's names; a probe importing `Text` from `@react-three/drei` or `EffectComposer` is reported | ruling R5-35, R5-60 |
| C-GUARD5-04 | pass | `remotion` and `@remotion/player` are imported only under `src/flavor/remotion/` and `src/features/flavor/`; `@remotion/web-renderer` and `mediabunny` only through `import()` in `src/features/flavor/`, never statically (`import type` allowed); probes of each are reported | ruling R5-60, R5-61 |
| C-GUARD5-05 | pass | `src/features/landing/heroes.ts` is imported as a value only by `src/app/page.tsx`, `src/app/explore/page.tsx` and `src/app/motion/page.tsx` (an `import type` is exempt, as in C-GUARD3-01); the static value-import graph of `src/features/landing/Hero.tsx` reaches no file under `src/engine`, `src/spec` or `src/export`; `src/features/landing/cards.ts` imports nothing but `./hero-cards.json` | ruling R5-31, R5-61 |
| C-GUARD5-06 | pass | Every import under `src/flavor/` is `react`, `remotion` or a relative path inside `src/flavor/`; `src/flavor/remotion/root.tsx` is imported nowhere but with `?raw` in `src/export/flavor-sources.ts`; `scanLine` finds nothing on any line of any file under `src/flavor/` whose extension is in the checker's `SCAN_EXTENSIONS` (`brand.json` is data, and the checker never scans `.json`) | ruling R5-05, I-M5-06 |
| C-GUARD5-07 | pass | `brand-intro.tsx`, comments removed, holds none of `zIndex`, `z-index`, `radial-gradient`, `conic-gradient`, `backdropFilter`, `perspective`, `transformStyle`, `mixBlendMode`, `objectPosition`, `filter:`, `inset`, `clipPath`, `oklch(`, `rgb(`, `rgba(`, `hsl(` or `url(`; a probe of each is reported | ruling R5-22 |
| C-GUARD5-08 | pass | No file under `src` creates a `video` element (JSX `<video` or `createElement("video")`) or calls `flushSync`; `src/lib/site/csp.ts` names no `media-src` and no `'wasm-unsafe-eval'` | ruling R5-02, R5-48, R5-58 |
| C-GUARD5-09 | pass | `vitest.config.ts` runs `tests/unit/flavor/**` and `tests/unit/features/{landing,explore,motion,flavor}/**` in `web`, keeps `tests/unit/engine/**` and `tests/unit/export/**` in `core`, and holds section 15's include and floors; each named file exists | ruling R5-62 |
| C-GUARD5-10 | pass | `FLAVOR_LINES`, `VIDEO_LINES`, `EXPLORE_LINES`, `LAB_BOUNDS`' sentences, `MOTION_PRESETS`' labels and notes, `presetLine` and `motionLine` of every preset and of `CUSTOM_TOKENS`, and the string literals of `Story.tsx`, `Hero.tsx`, `LabClient.tsx`, `Previews.tsx`, `ExploreClient.tsx`, `FlavorDialog.tsx` and `PrivacyNote.tsx` hold no banned word, no `!`, no emoji, and none of "colour", "behaviour", "cancelled", "grey" or "centre" | ruling R5-66 |
| C-GUARD5-11 | pass | The purity guards C-REPO-01 and C-GUARD3-02 list `src/engine/color/rec2020.ts`, `src/engine/color/solid.ts`, `src/engine/flavor.ts`, `src/engine/tokens/{motion-presets,bezier}.ts` and `src/export/{flavor,brand,media,flavor-sources}.ts` among the files they scan, and find nothing in them | ruling R5-04, I-M5-05 |
| C-GUARD5-12 | pass | Every file under `tests/e2e` that holds the text "Render the brand video" also calls `TELEMETRY(`; a probe file that clicks it without the call is reported | ruling R5-59, I-M5-09 |

### 14.11 Flows (Tasks 5.5 to 5.11)

Tests: `tests/e2e/landing.spec.ts`, `tests/e2e/explore.spec.ts`, `tests/e2e/motion-lab.spec.ts`,
`tests/e2e/transitions.spec.ts`, `tests/e2e/flavor.spec.ts`, `tests/e2e/export-flavor.spec.ts`,
`tests/e2e/security.spec.ts`, `tests/e2e/a11y-m5.spec.ts`, `tests/e2e/lazy-m5.spec.ts`, the amended
`tests/e2e/{home,studio,canvas}.spec.ts`, with `tests/e2e/flavor-support.ts`. Every flow fails on a
`securitypolicyviolation` event or a console error unless its row says otherwise.

| Id | Kind | Case | Origin |
|---|---|---|---|
| F-HERO-01 | pass | `/`: the hero canvas reads `data-flavor="running"` and `data-flavor-stops` the first card's stops; the window title is `madder.flavor`; the line "Palette 1 of 6: Madder."; "Pause" with `aria-pressed="false"`; "Open this palette in the studio" has the first card's `href`; the 16:9 box holds the canvas and no text node | ruling R5-32, I-M5-10 |
| F-HERO-02 | pass | "Next palette" six times: the lines read "Palette 2 of 6: Weld." to "Palette 6 of 6: Cochineal." and then "Palette 1 of 6: Madder."; each press sets `data-flavor-stops` to that card's stops, the title to `<name>.flavor` and the link to its `href`, and `data-flavor` stays `running` | ruling R5-32, R5-18 |
| F-HERO-03 | pass | "Pause" sets `aria-pressed="true"` and `data-flavor="paused"`; "Next palette" while paused keeps `paused` and changes the stops; "Pause" again gives `running` | ruling R5-18, R5-32 |
| F-HERO-04 | pass | After one "Next palette", "Open this palette in the studio" opens `/studio` with Weld's link: the studio shows the name "Weld" and the lot `lotTag(specId(<Weld's spec>))` | ruling R5-31 |
| F-HERO-05 | failure | With `NO_WEBGL`: `data-flavor="fallback"` and `data-flavor-reason="no-webgl2"`; the sentence "This browser cannot draw the animated background, so a still gradient shows instead."; no "Pause"; the canvas's computed `background-image` holds `linear-gradient` and `data:image/svg+xml`; "Next palette" still changes `data-flavor-stops` and the gradient | ruling R5-19, R5-20, I-M5-03 |
| F-HERO-06 | failure | `loseContext` on the hero canvas: `fallback` with reason `context-lost`, the sentence "The animated background stopped, so a still gradient shows instead." and "Restart the animation"; `restoreContext` alone leaves `fallback`; "Restart the animation" mounts a new canvas reading `running` | ruling R5-19 |
| F-HERO-07 | pass | With `page.emulateMedia({ reducedMotion: "reduce" })` before the load: `data-flavor="still"`, the line "The background is still because this device asks for reduced motion.", no "Pause"; "Next palette" changes the stops and `data-flavor` stays `still`; emulating no preference then gives `running` and "Pause" appears | ruling R5-18, R5-32, I-M5-02 |
| F-HERO-08 | pass | Scrolling the hero out of view gives `data-flavor="offscreen"` and back `running`; a page made hidden (`visibilityState` redefined and `visibilitychange` sent) gives `hidden`, and visible again `running` | ruling R5-18 |
| F-HERO-09 | pass | Two loads of `/` under reduced motion give byte-equal screenshots of the hero canvas; after "Next palette" the screenshot differs | ruling R5-17, I-M5-07 |
| F-HERO-10 | failure | With `NO_COMPILE`, the hero reads `fallback` with reason `no-webgl2` and shows its sentence, with no console error | ruling R5-19, I-M5-03 |
| F-HERO-11 | pass | In a context with JavaScript off, the hero canvas's inline style holds the first card's `flavorBackground` (`linear-gradient` and `data:image/svg+xml`), and the line reads "Palette 1 of 6: Madder." | ruling R5-21, R5-32 |
| F-HERO-RF1 | pass | Reduced motion switched on during a cross-fade ("Next palette", then `emulateMedia` reduce at once): `data-flavor` reads `still` and `data-flavor-stops` the new card's; switched off, `running` with the same stops | RF1, ruling R5-18 |
| F-STORY-01 | pass | `CSS.supports("animation-timeline: view()")` is true; each `[data-story-step]` has the computed `animation-name` `story-rise` and `animation-timeline` `view()`; each step scrolled to the center of the view (`scrollIntoView({ block: "center" })`) reads a computed opacity of 1, the last step included | ruling R5-33 |
| F-STORY-02 | pass | Under `emulateMedia` reduce, before any scroll, every step's `animation-name` is `none`, its opacity 1 and its `translate` `none` | ruling R5-33, I-M5-02 |
| F-STORY-03 | pass | The story's text equals 7.2's table for `HERO`: the hex and OKLCH, 11 swatches with their contrasts, the six role names, the two family names, the 8 space values and "<passed> / <required>" | ruling R5-33 |
| F-STORY-04 | pass | Every element under `[data-story]` whose inline style sets a color sits inside a `[data-specimen]` figure | ruling R5-33, I-M5-01 |
| F-STORY-05 | pass | In a context with JavaScript off, `/` shows the five steps with their text, and each step scrolled to the center of the view reads a computed opacity of 1: the story needs no script | ruling R5-33 |
| F-HOME5-01 | pass | The nav lists "home", "studio", "explore", "motion" and "github" in order; the current page's link has `aria-current="page"` on `/`, `/explore` and `/motion`, and none has it on the 404 page | ruling R5-34 |
| F-HOME5-02 | pass | `/` has one `h1`; `start.log` holds "open the studio", "open the explorer", "open the motion lab" and the repository link as children of one `div`; the text "in progress: the export bundle" is gone | ruling R5-34 |
| F-HOME5-03 | pass | `/sitemap.xml` lists `https://dyelot.vercel.app/`, `/studio`, `/explore` and `/motion` in that order | ruling R5-34 |
| F-HOME5-04 | pass | At 360 × 740 the nav's five links are visible on one row, and `/`, `/explore` and `/motion` scroll no wider than the viewport | ruling R5-34 |
| F-EXP5-01 | pass | `/explore`: `data-explorer-state` becomes `3d`; `data-points` 88, `data-tubes` 8, `data-solid-vertices` 6534, `data-gamut` `srgb`, `data-slice` `0.60`, `data-mode` `light`; the summary equals `sceneSummary("Madder", "light", "srgb", 0.6)`; the flat view shows three outlines | ruling R5-36, R5-37 |
| F-EXP5-02 | pass | "Display P3" and "Rec. 2020" set `data-gamut` and the summary; the slice slider moved by the keyboard to 0.45 sets `data-slice` `0.45`, the caption "At L 0.45: …" and the step list `sliceSteps` gives in Node; "Dark" sets `data-mode` `dark` and the dots take the dark hexes | ruling R5-36, R5-37 |
| F-EXP5-03 | pass | "Turn" with ArrowRight 10 times reads `data-turn` 45; "Tilt" with End `90`; "Zoom" with Home `0.50`; "Reset view" gives 35, 25 and `1.00`; a pointer drag on the canvas changes `data-turn`, and the "Turn" slider's value equals it | ruling R5-38 |
| F-EXP5-04 | pass | `/explore#s=<LINK(SPEC)>` shows `SPEC`: the summary starts "untitled:"; "Open in the studio" has the `href` `/studio#s=` plus `encodeSpec(SPEC)` | ruling R5-40 |
| F-EXP5-05 | failure | `/explore#s=garbage` shows the default and the line "This link is damaged or cut short, so the studio cannot open it. The explorer shows the default design instead."; a `hashchange` to `LINK(SPEC)` loads `SPEC` and clears the line; a `hashchange` to `#s=garbage` then keeps `SPEC` with the line ending "The explorer keeps the current design." | ruling R5-40, I-M5-03 |
| F-EXP5-06 | failure | With `NO_WEBGL`: `data-explorer-state` `flat`, reason `no-webgl2`, no `canvas` in the panel, the sentence of 8.4, and the slice slider still redraws the flat view | ruling R5-39 |
| F-EXP5-07 | failure | `loseContext` on the explorer's canvas: `flat` with reason `context-lost`, the sentence and "Restart the 3D view", which gives `3d` with a new canvas | ruling R5-39 |
| F-EXP5-08 | pass | `data-damping` is `true`, and under `emulateMedia` reduce `false` | ruling R5-38, I-M5-02 |
| F-EXP5-09 | pass | In the studio on `LINK(SPEC)`, "See these scales in the explorer" opens `/explore` showing `SPEC`, and its "Open in the studio" returns to a studio with `SPEC`'s lot | ruling R5-40 |
| F-EXP5-RF2 | pass | `/explore#s=<encodeSpec(RICH_P3)>` starts with "Display P3" checked; with the slice moved to `P3_L`, the flat view draws that step's dot farther from the center than the sRGB outline at its hue (both read from the SVG), and the dot's list item names it | RF2, ruling R5-36, R5-37 |
| F-EXP5-10 | failure | With `NO_RENDERER`, the panel reads `flat` with reason `no-webgl2` and its sentence, and no `canvas` stays in it; the flow allows the one `console.error` React writes for the caught error; with the 3D chunk aborted by `ABORT_CHUNK` instead, the panel reads `flat` with "The 3D view could not load. Reload the page to try again." | ruling R5-39, I-M5-03 |
| F-LAB-01 | pass | `/motion` shows the first hero design's tokens in the fields (50 to 500, the easings and springs), "dyelot" with `aria-pressed="true"`, `data-preset` `dyelot`, the preset line of C-LAB-09, the three files, and "Copy" and "Download" enabled once loaded | ruling R5-41, R5-44 |
| F-LAB-02 | pass | "Gentle" sets every field to the preset's values and `data-preset` `gentle`; the hash then decodes (polled) to `withMotion(<the hero's spec>, gentle)`; "Open in the studio" opens a studio whose motion line reads "Motion tokens: Gentle preset." | ruling R5-41, R5-45 |
| F-LAB-03 | pass | Typing 160 into "base (ms)" and leaving it sets `data-preset` `custom`, the line "Custom tokens: no preset matches.", the ladder's base label, and `--duration-base: 160ms;` in the shown `motion.css` | ruling R5-41, R5-42 |
| F-LAB-04 | failure | "abc" in "base (ms)" sets `aria-invalid="true"`, shows "Enter a number of milliseconds from 0 to 500." and leaves the hash and `motion.css` unchanged; leaving the field restores "200"; "600" does the same; "1.5" in "standard x1" shows "Enter a number from 0 to 1." | ruling R5-42, I-M5-03 |
| F-LAB-05 | pass | With clipboard permission, "Copy motion/motion.css" writes `motionFiles(...)[0].text` exactly and the button reads "Copied"; "Download motion/gsap.ts" downloads `gsap.ts` with the generated text | ruling R5-44 |
| F-LAB-06 | failure | With `navigator.clipboard.writeText` rejecting: the disclosure opens with its text selected and the sentence "Copy is blocked here. The text is selected: press Ctrl+C or ⌘C." | ruling R5-44 |
| F-LAB-07 | pass | "Reduced motion" starts off; on, `data-lab-reduced` is `true` and the toast, switch and tab previews read `data-transition` `linear:100` while the dialog reads `tween:300:decelerate`; off, they read `spring:smooth`, `spring:snappy` and `spring:bouncy` | ruling R5-43 |
| F-LAB-08 | pass | Under `emulateMedia` reduce, "Reduced motion" starts on (`aria-checked="true"`) | ruling R5-43, I-M5-02 |
| F-LAB-09 | failure | `/motion#s=garbage` shows the default with "This link is damaged or cut short, so the studio cannot open it. The lab shows the default design instead."; after a `hashchange` to a good link and then to `#s=garbage`, the good design stays with the line ending "The lab keeps the current design." | ruling R5-41 |
| F-LAB-10 | failure | With `ABORT_CHUNK(page, "dyelot.check/1")` installed before the load, "Copy" and "Download" stay `aria-disabled` and the line "This tool could not load. Reload the page to try again." shows; the editing still works | ruling R5-44, I-M5-03 |
| F-LAB-RF2 | pass | `/motion#s=<withMotion(SPEC, slowest 900)>` shows "900" in "slowest (ms)", the ladder's label "slowest 900 ms, exported as 500 ms", and editing "base (ms)" keeps 900 in the hash's spec | RF2, ruling R5-42 |
| F-STUD5-01 | pass | On `LINK(SPEC)` the inputs panel shows "Motion tokens: dyelot preset." and "Edit in the motion lab" with the `href` `/motion#s=` plus `encodeSpec(SPEC)`; Tab goes from the Motion feel group to that link to the Steer section | ruling R5-45 |
| F-STUD5-02 | pass | The studio on `LINK(CUSTOM)` shows "Motion tokens: custom."; "Regenerate" keeps `CUSTOM_TOKENS` in the hash's spec; after a reload the draft keeps them | ruling R5-10, R5-14 |
| F-STUD5-03 | pass | The toolbar's Tab order ends "Undo", "Redo", "Copy link", "Export", "Flavor"; at 360 × 740 the closed toolbar is at most 170 px tall (or the bound probe 7 sets) | ruling R5-51 |
| F-VT-01 | pass | With `VT_RECORD`, choosing the template "dashboard" makes one `startViewTransition` call whose record holds an animation on `::view-transition-group(dyelot-template)` with a duration above 0; the record holds no animation of a duration above 0 on `root`; `data-template` then reads `dashboard`, and `[data-template-root]` matches one element in the frame | ruling R5-46, R5-48 |
| F-VT-02 | pass | Under `emulateMedia` reduce the same switch records only animations of duration 0, and `data-template` reads `dashboard` | ruling R5-48, I-M5-02 |
| F-VT-03 | pass | With the canvas's "Reduce motion" on (no OS setting), a template switch records no animation on `dyelot-template` with a duration above 0; turning the switch on and off keeps the landing's open FAQ item | ruling R5-46, R5-48 |
| F-VT-04 | pass | In Scales, "primary 500, <hex>" opens the token row with `--color-primary-500`, `bg-primary-500`, `var(--primary-500)`, the hex, OKLCH, contrast and roles `tokenRow` gives in Node; the record holds an animation on `::view-transition-group(dyelot-swatch-primary-500)` of 250 ms; opening "primary 600" closes the first; Escape closes it and focus returns to "primary 600, <hex>" | ruling R5-47 |
| F-VT-05 | pass | The token row's "Copy var(--primary-500)" writes `var(--primary-500)` and reads "Copied"; the compact step buttons are at least 24 px tall | ruling R5-47 |
| F-VT-06 | pass | Under `emulateMedia` reduce, opening a token row records the swatch's animation with duration 0 | ruling R5-48 |
| F-VT-07 | pass | The mobile template's sheet rising, `emulateMedia` reduce 60 ms into the rise, then no preference: the sheet's layer is settled (`data-settled`), the sheet stays open, and no animation starts in its layer afterward | ruling R5-49 |
| F-FLAVOR-01 | pass | "Flavor" opens a modal dialog named "Flavor" with focus on its heading and the sections "Background", "Brand video" and "Shader loop"; the preview canvas reads `running` with `flavorStops(spec, "light")` and "Pause"; Escape closes it and focus returns to "Flavor" | ruling R5-51 |
| F-FLAVOR-02 | pass | With the canvas's "Reduce motion" on, `[data-brand-player]` reads `data-autoplay="false"` and `data-playing="false"`, the Player shows the finished picture (the design's name, "Get started" and the checks line), and its "Pause" reads `aria-pressed="true"`; pressing it gives `data-playing="true"`; the Player shows no control of its own | ruling R5-52 |
| F-FLAVOR-03 | pass | With no reduced motion, `data-autoplay` is `true` and "Pause" reads `aria-pressed="false"` (pressing it gives `data-playing="false"`); with the canvas in dark mode, the preview's stops are `flavorStops(spec, "dark")` and the Player's `data-mode` is `dark` | ruling R5-51, R5-52 |
| F-FLAVOR-04 | failure | With `NO_WEBGL` in the studio: the preview reads `fallback` with its sentence; "Record the shader loop" is replaced by "This browser cannot record the shader loop."; "Render the brand video" still shows; the canvas templates render as before | ruling R5-02, R5-19, R5-56 |
| F-FLAVOR-05 | failure | `loseContext` on the preview: its sentence and "Restart the animation", which gives `running` | ruling R5-19 |
| F-FLAVOR-06 | pass | Under `emulateMedia` reduce: the preview reads `still` with no "Pause", `data-autoplay` is `false`, and "Record the shader loop" is enabled | ruling R5-52, R5-57, I-M5-02 |
| F-FLAVOR-07 | failure | With `ABORT_CHUNK(page, "Before the first render")` installed before the load, "Flavor" shows "This tool could not load. Reload the page to try again." and opens no dialog; after `release()` the next press opens the dialog | ruling R5-51, I-M5-03 |
| F-FLAVOR-08 | pass | With the dialog open and the Player playing for 6 s, the page holds no `<audio>` element and records no `securitypolicyviolation` and no console error | ruling R5-52, R5-58 |
| F-RENDER-01 | pass | With `TELEMETRY` and `STATUS_RECORD` on the section's status region: "Render the brand video" leads to the note "Before the first render" with 13.4's paragraph and focus on its heading, and the region's record holds "Checking this browser…" before it; no request went to remotion.pro yet; "Render" shows "Rendering…", the bar and "Cancel"; within the render budget a download named `mediaName(spec, "brand", "mp4")` arrives whose bytes 4 to 7 read `ftyp`, and "Downloaded <name>." shows; polling, exactly one `POST` reaches `https://www.remotion.pro/api/track/register-usage-point`, its JSON `event` `"web-render"`, `apiKey` null, `host` the page's origin and `succeeded` true, holding neither the design's name nor any of its hexes; no `pageerror` and no unhandled rejection | ruling R5-53, R5-54, R5-59 |
| F-RENDER-02 | pass | A second render on the same page load, after closing and reopening the dialog, starts with no note; after a reload the note shows again | ruling R5-54 |
| F-RENDER-03 | pass | "Cancel" in the note returns the render button with focus on it; no request went to remotion.pro and nothing downloaded | ruling R5-54 |
| F-RENDER-04 | pass | "Cancel" while rendering shows "Canceled. Nothing was downloaded." and the button again; no download event fires | ruling R5-53 |
| F-RENDER-05 | failure | With `NO_WEBCODECS`: "This browser cannot make videos. Try a recent Chrome, Edge or Firefox." in the render button's place and "This browser cannot record the shader loop." in the record button's; no renderer or Mediabunny chunk loads | ruling R5-53, R5-56 |
| F-RENDER-06 | failure | With `NO_ENCODE` and `STATUS_RECORD`: after a click the region's record holds "Checking this browser…", and "This browser cannot render the brand video." in the button's place; no request to remotion.pro | ruling R5-53 |
| F-RENDER-07 | failure | With `ABORT_CHUNK(page, <probe 4's renderer marker>)` installed before the load, a click shows "This tool could not load. Reload the page to try again."; after `release()`, the next click reaches the note | ruling R5-53, I-M5-03 |
| F-RENDER-08 | pass | While a render runs, "Record the shader loop" is `aria-disabled="true"` and described by "Wait for the current video to finish."; closing the dialog then aborts the render (no download), and on reopening the render button is idle | ruling R5-51, R5-53 |
| F-RENDER-09 | pass | Every text the live region took during a render (recorded by a `MutationObserver`) is "Rendering: <n>%." with `n` one of 10, 20, … 100, and no `n` repeats | ruling R5-53 |
| F-RENDER-RF4 | pass | A double click on "Render" in the note starts one render: one `POST` and one download | RF4, ruling R5-53 |
| F-LOOP-01 | pass | "Record the shader loop" shows "Recording…", the bar and "Cancel"; within the record budget a download named `mediaName(spec, "loop", "mp4")` arrives whose bytes 4 to 7 read `ftyp`, and "Downloaded <name>." shows; no request left the page's origin | ruling R5-56, I-M5-09 |
| F-LOOP-02 | pass | "Cancel" while recording shows "Canceled. Nothing was downloaded." and no download event fires | ruling R5-56 |
| F-LOOP-03 | pass | With `VideoEncoder.isConfigSupported` answering no for every `avc1` codec, the recording downloads `mediaName(spec, "loop", "webm")` whose first four bytes are `1A 45 DF A3` | ruling R5-56 |
| F-LOOP-04 | pass | Under `emulateMedia` reduce the recording downloads its file while the preview stays `still` | ruling R5-57 |
| F-LOOP-05 | failure | With `NO_ENCODE`, a click on "Record the shader loop" ends with "This browser cannot record the shader loop." in the button's place, and nothing downloads | ruling R5-56 |
| F-LOOP-RF3 | pass | `loseContext` on the preview while a recording runs: the preview shows its fallback and the recording still downloads its file | RF3, ruling R5-56 |
| F-FEX-01 | pass | The export dialog on `LINK(SPEC)` lists 20 files with "Include flavor files" off (described by 13.5's sentence); on, 29, the nine right after `motion/gsap.ts`; focus stays on the switch | ruling R5-24, R5-29 |
| F-FEX-02 | pass | With the switch on, the downloaded zip's entries are `FLAVOR_BUNDLE`'s paths in order, its `receipt.json` lists the flavor files, and its name is `zipName` as before | ruling R5-24, R5-26 |
| F-FEX-03 | pass | The preview of `flavor/flavor.css` shows R5-20's rule; "Copy flavor/palette.json" writes its text | ruling R5-24 |
| F-FEX-04 | pass | The switch stays on after closing and reopening the dialog, and is off after a reload | ruling R5-29 |
| F-SEC5-01 | pass | `/`, `/studio`, `/explore`, `/motion`, `/connect`, `/connect/callback` and `/no-such-page` carry 12.2's policy with a nonce that differs between two loads; `connect-src` is exactly `'self' https://openrouter.ai https://www.remotion.pro`; no `media-src` and no `'wasm-unsafe-eval'` appear | ruling R5-58 |
| F-SEC5-02 | pass | `/`, `/explore` and `/motion`, and `/studio` with the Flavor dialog open, load with no console error and no violation; `/studio` starts exactly one worker before the dialog opens | ruling R5-59 |
| F-SEC5-03 | pass | Loading `/`, `/explore` (3D running), `/motion` and the open Flavor dialog requests no URL outside the page's origin | ruling R5-59, I-M5-09 |
| F-A11Y5-01 | pass | axe finds no violation on `/` (hero and story) and `/` with `NO_WEBGL`, each under `emulateMedia` reduce so every story step is in its final state; on `/explore` in 3D and with `NO_WEBGL`; on `/motion` with an invalid field shown; in the studio with a token row open; in the Flavor dialog with the canvas's "Reduce motion" on (the Player holding frame 179), with the note shown and during a render (the renderer's scaffold is `visibility: hidden`); and in the export dialog with flavor on; at 1280 × 800 and 360 × 740 | ruling R5-01, R5-66 |
| F-A11Y5-02 | pass | Keyboard only, Tab reaches every new control in the orders of 8.1, 9.1 and 13.8, each with a visible focus ring of at least 2 px and a hit area of at least 24 × 24 px; "Next palette", both "Pause" buttons, the sliders, the radios and the lab's text fields work from the keyboard | ruling R5-38, R5-51 |
| F-A11Y5-03 | pass | The hero canvas and the 3D wrapper are `aria-hidden="true"`; the flat view's `svg` has `role="img"` named by its caption; the explorer's summary and the hero's palette line are text | ruling R5-37, I-M5-10 |
| F-A11Y5-04 | pass | At 360 × 740, `/`, `/explore`, `/motion` and the open Flavor dialog scroll no wider than the viewport | ruling R5-32, R5-51 |
| F-LAZY5-01 | pass | The first load of `/` fetches no JavaScript holding the markers of three, R3F or Remotion, or `dyelot.engine/1`, while the hero runs | ruling R5-31, R5-61 |
| F-LAZY5-02 | pass | The first load of `/studio` fetches no JavaScript holding the markers of three, R3F, Remotion, the web renderer or Mediabunny | ruling R5-61, I-M5-04 |
| F-LAZY5-03 | pass | `/explore` in 3D has loaded the three and R3F markers and none of Remotion's or Mediabunny's, and its JavaScript holds none of the eight strings of probe 1 | ruling R5-35, R5-61 |
| F-LAZY5-04 | pass | Opening the Flavor dialog loads the Player's marker and neither the web renderer's nor Mediabunny's; the render click loads the renderer's (Mediabunny's code comes with it, R5-61); on a fresh page load where no render ran, the record click loads Mediabunny's marker and not the renderer's | ruling R5-61 |

## 15. Coverage

`pnpm vitest run --coverage` keeps M4's scope and floors and adds:

| Scope | Lines, statements, functions | Branches |
|---|---|---|
| The whole coverage scope | 80, 80, 75 | 70 |
| `src/engine/**` (now with `color/rec2020.ts`, `color/solid.ts`, `flavor.ts`, `tokens/motion-presets.ts`, `tokens/bezier.ts`), `src/spec/**`, `src/theme/**`, `src/ai/**`, each pure helper of M2 to M4 | 95 | 90 |
| `src/export/**` (now with `flavor.ts`, `brand.ts`, `media.ts`, `flavor-sources.ts`), `src/import/**` | 90 | 85 |
| `STUDIO_HELPERS` gains `src/features/studio/{pages,token-row}.ts`; `PREVIEW_HELPERS` gains `src/features/preview/{transition,kit/reduced}.ts`, each by name | 95 | 90 |
| `LANDING_HELPERS`: `src/features/landing/{heroes,story,cycle}.ts`, each by name | 95 | 90 |
| `EXPLORE_HELPERS`: `src/features/explore/{scene,webgl}.ts`, each by name | 95 | 90 |
| `MOTION_HELPERS`: `src/features/motion/lab.ts` | 95 | 90 |
| `FLAVOR_HELPERS`: `src/features/flavor/{video,render,record}.ts`, each by name | 95 | 90 |

`useOsReducedMotion` in `kit/reduced.ts` is reached by `MotionScope`'s unit render. `src/flavor/**` has no floor: its
pure parts and its argument checks are C-FLAV and C-BRAND cases, and its WebGL and Remotion paths run only in a real
browser, in the flows of 14.11. The routes, `Hero.tsx`, `Story.tsx`, `ExploreClient.tsx`, `Explorer3D.tsx`,
`FlatView.tsx`, `LabClient.tsx`, `Previews.tsx`, `FlavorDialog.tsx`, `BrandPlayer.tsx`, `PrivacyNote.tsx` and
`useVideoJob.ts` are covered by the flows, not by floors. Each case is written from its row, never from an
uncovered-line report.

## 16. Changes to M1 to M4 cases

| Case | Was | Now | Why |
|---|---|---|---|
| C-ENTRY-01 (M2), C-ENTRY3-01 (M3), C-ENTRY4-01 (M4) | The engine entry's key set is M4's set exactly | M4's set plus exactly the 17 names of 5.1 (C-ENTRY5-01) | R5-04 |
| C-ENTRY3-02 (M3) | The export entry's key set is exactly `buildBundle`, `zipBundle`, `zipName`, `sha256` and `RECEIPT_FORMAT` | Those plus `motionFiles`, `brandProps` and `mediaName` (C-ENTRY5-02) | R5-28 |
| C-PAR3-03 (M3), the `DIRECTION_PARAM_KEYS` test (M2, amended in M3) | The list holds 18 keys, ending `"rules"` | 19 keys, ending `"rules"`, `"motionTokens"` | R5-14 |
| C-CSP-01 (M4) | `cspHeader` equals M4's 12.1 string, `connect-src 'self' https://openrouter.ai` | 12.2's string, with `https://www.remotion.pro` (C-SITE5-01) | R5-58 |
| F-SEC4-01 (M4) | `connect-src` is `'self' https://openrouter.ai`; pages `/`, `/studio`, `/connect`, `/connect/callback`, `/no-such-page`, and the HTML 404 at `/robots.txtx` | `connect-src` ends with `https://www.remotion.pro`; the pages also `/explore` and `/motion`; `PAGE_POLICY` is 12.2's text | R5-58 |
| F-SEC4-02 (M4) | `/`, `/studio` and `/connect` load under the policy | Also `/explore` and `/motion` | R5-59 |
| F-SEC4-03 (M4) | `/sitemap.xml` lists `/` and `/studio` | It lists the four routes of R5-34 | R5-34 |
| C-SITE4-01 (M4) | The sitemap still lists `/` and `/studio` only | The sitemap lists the four routes; `robots()` is unchanged | R5-34 |
| T-FE-20 (M0, amended in M4) | `SITE.routes.sitemap` is `["/", "/studio"]` | `["/", "/studio", "/explore", "/motion"]`; `disallow` unchanged | R5-34 |
| F-HOME-03 (M2) | The sitemap lists `/` and `/studio` | The four routes, in R5-34's order | R5-34 |
| M0's sitemap test (`tests/unit/site/routes.test.ts`, "lists the sitemap routes, as absolute URLs, once each") | `sitemap()` gives the URLs of `/` and `/studio` | The URLs of the four routes, in R5-34's order, once each | R5-34 |
| M0's axe test (`tests/e2e/home.spec.ts`, "the home page has no accessibility violations") | axe runs on `/` as loaded | axe runs on `/` under `emulateMedia({ reducedMotion: "reduce" })`, so no story step is caught mid-fade; F-A11Y5-01 adds `/` at both widths | R5-33 |
| M0's header test (`tests/e2e/home.spec.ts`, "every page is served with the security headers and a same-origin policy", amended in M4) | `connect-src` is `["'self'", "https://openrouter.ai"]` | `["'self'", "https://openrouter.ai", "https://www.remotion.pro"]`; the paths also `/explore` and `/motion` | R5-58 |
| M0's text test (`tests/e2e/home.spec.ts`, "the home page shows the prompt, the one-liner and the work in progress") | `main` holds "in progress: the export bundle" | `main` holds the prompt, the one-liner and "Palette 1 of 6: Madder.", and not "in progress" | R5-34 |
| F-HOME-01 (M2) | One `div` holds the studio link and the repository link | The same `div` (in `start.log`) also holds the explorer and motion lab links | R5-32 |
| F-CANVAS-19 (M2, amended in M3) | The Tab order ends Undo, Redo, Copy link, Export | It ends Undo, Redo, Copy link, Export, Flavor; the closed toolbar at 360 × 740 is still at most 170 px tall | R5-51 |
| F-KEY-11 (M2, amended in M3 and M4) | The inspector's stops run from its scroll area to each finding's actions, as 13.7 of M4 orders them | The Scales section adds one stop per palette and then "See these scales in the explorer" before the role table; the inputs panel adds "Edit in the motion lab" after "Motion feel" | R5-45, R5-47 |
| F-INSP-14 (M2, amended in M3 and M4) | Every inspector control is reachable by keyboard | Also each Scales step (one stop per palette, the arrows within) and the token row's "Copy" | R5-47 |
| C-ZIP-06 (M3) | Only `DESIGN.md`, `AGENTS.md.snippet` and `SKILL.md` may hold capitals; `A.txt` is a `RangeError` | `README.md` joins them; `A.txt`, `README.MD` and `Readme.md` stay `RangeError` | R5-24 |
| C-BND-02 (M3) | Every file of every golden matches R3-09's path rule with the three fixed names | With `README.md` as a fourth fixed name, for the `default-flavor` golden | R5-24 |
| C-BND-06 (M3) | The 15 `GOLDENS` equal the manifest | The 16, `default-flavor` added (C-FEX-14) | R5-27 |
| C-REPO-M2-03 (M2), C-GUARD4-10 (M4) | The coverage include and floors of M4's section 15 | Also section 15's new lists and folders (C-GUARD5-09) | R5-62 |

Every other M1 to M4 case stands as written (I-M5-08), among them C-MOT-02 (`motion.css` does not change), C-GEN-13
(a regenerated spec equals its source, now with custom tokens too), C-BND-01 (the bundle without flavor), every golden,
C-WORK-11 (the worker imports only `@/engine` and `./protocol`), F-CANVAS-07 (now also reached by an OS change, F-VT-07),
F-STUDIO-21 and F-SEC4-02's one worker, F-LAZY4-01 (the AI layer stays lazy), and the guards C-GUARD3-01 to 04 and
C-GUARD4-01 to 12. The canvas cases that locate `[data-template-root]` (for example `tests/e2e/canvas.spec.ts`'s
`toBeVisible` on it) stand, because the view transition adds no element (10.1); F-CANVAS-08 stands, since `MotionScope`
still passes `"user"` when nothing asks for reduced motion (10.4); and F-INSP-01, F-INSP-02, F-INSP-07 and F-INSP-14 stand
with the Scales rows at 24 px, since their cells and attributes keep M2's names inside the new buttons (10.2).

## 17. Review Focus

The five input classes most likely to bite a visitor, each with the tests that pin it:

| RF | Input | Cases |
|---|---|---|
| RF1 | Reduced motion switched while something moves: during a cross-fade, a template switch, the sheet's rise | F-HERO-RF1, F-VT-07, F-VT-02, C-FLAV-13 |
| RF2 | Links that reach the edges: a lab link with a token outside the lab's caps, a P3 design in the explorer, a bad hash on each page | F-LAB-RF2, F-EXP5-RF2, F-EXP5-05, F-LAB-09 |
| RF3 | WebGL lost or missing at a bad moment: during a fade, during a recording, before the explorer mounts | F-LOOP-RF3, F-HERO-06, F-EXP5-06, F-EXP5-07 |
| RF4 | Video jobs that race: a double click, a close during a render, two jobs at once | F-RENDER-RF4, C-DLG-RF4, F-RENDER-08 |
| RF5 | Motion tokens at their bounds: bounce 1, durations 0, easing y far outside [0, 1] | C-MOT5-RF5, C-MOT5-03, C-LAB-03 |

## 18. Deferred, and the seams for M6

| Item | Comes from | Milestone |
|---|---|---|
| The `/about` page: the math, the receipt, the licenses, the privacy note for in-browser video | umbrella §7, decision A2 | M6 |
| Landing polish: "the receipt explained in one screen" beyond the story's last step, entry points from a brief, an image or the gallery | umbrella §7, decision A2 | M6 |
| The gallery and share cards | umbrella §7, decision A2 | M6 |
| Real chunk sizes and a Lighthouse measure of `/`, `/explore` and `/motion` | R5-64 | M6 (the audits) |
| Cosine and Poline-style generators | M1 section 18, decision A3 | Not scheduled |
| Tokens for the unexpressed style traits (hard offset shadows, blur, grain) | M2 and M3 section 18, D2 of M3 | Not scheduled; each needs its own decision |
| Animations and keyframes in `theme.css` | M3 section 18 | Not scheduled; the motion files carry the motion |
| WebGL in the canvas templates | umbrella §11, decision A2 | Not scheduled |
| GIF, glTF, dotLottie, a palette nebula, WebGPU, audio in videos | decision A2 | Not scheduled |
| A motion budget and a stored reduced-motion policy | umbrella §4 and §6, decision E5 | Not scheduled |
| Remotion 5.0's terms (attribution and no upload of user code), when they take effect | R6 section 3.1 | When Remotion 5.0 ships; the header and READMEs already say "Built with Remotion" |

The seams M5 leaves: `flavorStops`, `flavorSeed` and `brandProps` give M6's share cards and gallery a design's colors and
video props; `heroDesigns()` is the first gallery's six entries; `pageHref` links any page to any design; the `motion`
section of a spec now records custom tokens, so a gallery card keeps them.

## 19. Risks

- **Software WebGL in CI.** Playwright's Chromium draws WebGL2 through SwiftShader, which is slow and may change with a
  Chromium release. The flows assert state, not frames; the render and record budgets are measured at Task 5.0 and
  scaled by 3; F-HERO-09's screenshots compare two runs of one build on one machine.
- **The usage event is the visitor's.** Each render sends the visitor's IP address and dyelot's origin to remotion.pro,
  and nothing in dyelot can stop it; the privacy note says so before the first render of a page load, and the README and
  `/about` (M6) repeat it. A blocked request (an ad blocker) is retried by Remotion three times and never fails the render,
  but the renderer sends the event without awaiting it, so the last failure leaves an unhandled rejection (and Remotion's
  retry lines) in the visitor's console; dyelot cannot catch it.
- **Remotion's license can tighten.** Remotion 5.0's draft counts contractors toward the three-person limit and adds
  attribution and download rules. dyelot stays an individual's project; the exported files already carry the header and
  the four-or-more rule.
- **Remotion 4.0.539 is 11 days old on 2026-11-06**, younger than the house's two-week habit; it is the umbrella's pin and
  the version Mediabunny 1.62.0 pairs with. By the merge it will be older than two weeks; no newer version is taken.
- **drei may drag in remote assets.** Probe 1 decides; with drei gone, `OrbitControls` comes from three's examples, which
  three versions with the core.
- **A raw `.tsx` rule is new.** Probe 3 decides; the fallback is a generated file and a test that it equals the sources.
- **Scroll-driven animations are new in Firefox and Safari** (Firefox 159, Safari 26). Older browsers show every step
  in its final state, by construction.
- **The theme bridge caps durations at 500 ms.** A lab token above 500 (only from a hand-made link) exports as 500; the
  ladder says so.
- **A custom motion token changes the spec id.** A design edited in the lab is a new design with a new lot; the studio
  shows "custom" so the visitor knows (owner approval item 4).
- **The committed hero cards can go stale.** `hero-cards.json` must be rewritten when the engine's output changes, as
  the goldens must; C-LAND5-02 fails until it is, and `DYELOT_UPDATE_HEROES=1` rewrites it.
- **The browser may refuse to autoplay the preview.** The Player is muted and has no audio tag, which browsers allow to
  autoplay; probe 4 records what headless Chromium does, and the flows assert `data-autoplay`, our own intent.
- **Three more WebGL contexts.** The hero, the explorer and the Flavor preview each hold one context; no page holds more
  than two at once (the studio's dialog and nothing else), far below the browser's cap.
- **Hand-made links with exponent numbers.** A spec whose easing holds a number `String()` writes with an exponent
  (1e-7) exports wrong numbers in `motion.css`, as in M3; the lab rounds every value to two decimals, so no lab-made link
  carries one.

## 20. Done when

- Every case in section 14 has a test that carries its id (C-GUARD5-01), and every `failure` case fails the way its row
  says.
- `pnpm gate:full` passes with section 15's floors, and `pnpm gate` passes; both times are recorded.
- Every M1 to M4 case passes except section 16's changes, every golden holds, and a design without `motionTokens` keeps
  its spec id (I-M5-08).
- Task 5.0's probe results are recorded in R5-64.
- After the merge, the hand check of R5-65 on `https://dyelot.vercel.app`, with one real render, is recorded in this
  spec's close note.
- `docs/specs/00-design.md` carries a note starting "Refined in M5" at each row of section 1's first table.
- The README states M5 with measured claims only, its Remotion section and its oklch-picker credit (11.4).
- The knowledge graph records the M5 pins and the Remotion license use (a decision or infrastructure node, per
  `.claude/rules/knowledge-graph.md`).
- The pull request merges once CI is green (the owner's ruling of 2026-11-04).

## 21. Owner approval items

Each item ends with a recommendation: the controller's for items 1 to 7, the drafter's for items 8 to 12. The owner's answers
(2026-11-06): items 1 and 7 approved as recommended (the Free License with its telemetry, `https://www.remotion.pro`
in `connect-src`, the README note, and one real render in the hand check); items 2 to 6 and 8 to 12 accepted as
recommended.

1. **Remotion.** dyelot uses Remotion under its Free License as an individual's project, with `licenseKey:
   "free-license"`; each render sends one usage event from the visitor's browser to remotion.pro (IP address and
   origin); `https://www.remotion.pro` joins `connect-src`; the README tells reusers that companies of four or more people
   need a Company License (R5-53 to R5-55, R5-58). *Recommendation: approve.*
2. **Videos are separate downloads**, not zip files; `flavor/` is text only (R5-25). *Recommendation: accept.*
3. **Cosine and Poline-style generators are not scheduled** (R5-03). *Recommendation: accept.*
4. **The lab writes custom tokens into the design** through the optional `motionTokens` parameter: a design edited in the
   lab gets a new spec id; no other design changes (R5-09 to R5-11). *Recommendation: accept.*
5. **Stack refinements.** One viewport without drei's `View`; drei limited to `OrbitControls`, or none after probe 1; no
   `postprocessing`; dyelot's own gamut mesh instead of oklch-picker's (R5-07, R5-35). *Recommendation: accept.*
6. **No WebGL in the canvas templates** (R5-02). *Recommendation: accept.*
7. **The hand check after the merge includes one real render**, one usage event from the controller's browser (R5-65).
   *Recommendation: approve.*
8. **Two inherited items are not scheduled**: tokens for the unexpressed style traits, and animations in `theme.css`;
   each would change every golden (R5-03). *Recommendation: accept, and give each its own decision later.*
9. **M2's mobile-sheet item is fixed in M5**: `MotionScope` follows the OS setting live, so an OS change settles the sheet
   as the canvas's switch does (R5-49). *Recommendation: accept; it is one small change with one flow (F-VT-07).*
10. **The lab's caps**: durations 0 to 500 ms, an easing's y −1 to 2, a spring's duration 0.05 to 2 s, each rounded to
    its field's step, inside the schema's bounds (R5-42). *Recommendation: accept; the bridge already caps durations at
    500 ms.*
11. **The six hero designs** are named after historical dyes (Madder, Weld, Verdigris, Woad, Logwood, Cochineal), with
    the seeds of R5-31; the first is the explorer's and the lab's default; their cards are committed data checked by a
    test, not six generations per server instance, because those took about 1.3 s (R5-31). *Recommendation: accept.*
12. **The Player without its own controls.** The Remotion Player's seek bar is pointer-only and its full-screen icon is
    16 px, so dyelot hides its controls and gives it one "Pause" button; there is no seek and no full screen (R5-52).
    *Recommendation: accept.*
