# 05 · Motion and 3D: the hero shader, the explorer, the motion lab, transitions and flavor (M5)

> Source note: this milestone spec refines `docs/specs/00-design.md`, the umbrella (sections 7, 8, 9, 11, 13 and 14 above
> all), and builds on `docs/specs/01-color-engine.md` (M1), `docs/specs/02-studio.md` (M2), `docs/specs/03-export.md` (M3)
> and `docs/specs/04-ai.md` (M4). Paths to `docs/research/`, `docs/plans/` and `knowledge/` point into the private `repos`
> meta-repo. Next.js facts cite the docs shipped with next 16.4.3 under `node_modules/next/dist/docs/` (written `NDOCS/`
> below), as `AGENTS.md` requires. Package facts were read from the npm registry and from the published tarballs on
> 2026-11-06; Playwright's Chromium facts come from a local probe of the same day.

Status: draft for the owner's approval, 2026-11-06.

Section 2 lists the owner's standing rulings and the controller's decisions of 2026-11-06. Section 3 turns each decision
into rulings R5-01 to R5-66. A ruling ends with **(decision X#)** when it states a controller decision, or **(drafter)**
when this spec supplies a rule the decisions leave open; a ruling that does both says which part is which. The owner can
overturn any ruling by editing this file before the task that uses it starts. Task 5.0 (R5-64) probes every external fact
this spec could not verify before any other task, and says what happens when a probe fails.

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
server: generateSystem x 6 hero params --> { name, href, stops, seed, fade } --> "/" hero (the client gets no engine)
server: the first hero's spec --storySteps--> 5 framed specimens --CSS animation-timeline: view()--> "/" story
/explore#s=<link> --decodeSpec--> spec --solidPosition--> 88 points, 8 tubes; gamutSolid(gamut, 32) --> mesh;
                                        gamutSlice(gamut, L) for 3 gamuts --> the flat SVG view (always shown)
/motion#s=<link> --decodeSpec--> spec --withMotion(spec, tokens)--> spec' --> hash, previews, motionFiles(spec', ...)
studio "Flavor" --> <Flavor> preview | <Player BrandIntro inputProps=brandProps(spec, mode)>
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
| E3: per-token number fields "with the schema's bounds" | The schema's bounds plus the lab's caps where the schema has none: durations whole milliseconds 0 to 500, an easing's y −1 to 2, a spring's duration 0.05 to 2 s, each value rounded to its field's step (R5-42) | The schema bounds no duration, y or spring duration from above; the theme bridge caps a duration at 500 ms (R2-08), so a larger value would export as 500 |
| D6: the 3D code loads "with the flat view as the loading state" | The 3D panel shows "Loading the 3D view…" while its chunk loads; the flat view beside it is always shown (R5-39) | D4 makes the flat view always present, so a loading copy would show the same figure twice |
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
Remotion project should run. No file of `src/flavor/` holds a color literal: every line scans clean with the checker's
`scanLine` (R5-26). **(decision A4; the folder list, the JSON and the scan drafter)**

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
with `c` the largest chroma that stays in the gamut at lightness `l` and that hue: M1's `maxChroma` bisection on [0, 0.5]
with 24 iterations (M1 documents that 24 land within 0.5 / 2^24 of the edge), extended to `rec2020`, and `c` rounded with
`round6`. `l` lies in [0, 1]; a gray outside the gamut gives `c` 0, as `maxChroma` does. `solidPosition` maps an OKLCH
color to the explorer's space: OKLab `(L, a, b)` becomes `x = 2a`, `y = L − 0.5`, `z = 2b`, so the solids are centered on
the origin, one unit high, and the sRGB solid's widest point lies about 0.65 from the axis. **(decision D2, D4; the
iterations and the scale drafter)**

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

where `snoise` is 2D simplex noise adapted from stegu/webgl-noise (MIT), whose copyright lines and permission notice stay
in a comment above it and so in the export. `n` picks a place on the five stops: segment `k = min(3, floor(n × 4))` and
`f = n × 4 − k`; the color is the OKLab mix of stops `k` and `k + 1` by `f`, for the `u_from` set and for the `u_to` set,
then the OKLab mix of those two by `u_mix`, converted back to sRGB. sRGB to OKLab inside GLSL is the sRGB decode, the
matrix to LMS, the cube root and the matrix to OKLab, and back the reverse, with M1's matrices, so no lookup texture
exists. A grain of `(hash(floor(gl_FragCoord.xy)) − 0.5) × u_grain` is added to each channel, then clamped to [0, 1];
`u_grain` is `GRAIN`, 0.035 (3.5%, inside the research's 2 to 5%), and does not depend on time. Time enters only through θ
= 2π × (t mod 10) / 10 (`LOOP_SECONDS` 10): every noise sample moves on a circle with a whole number of turns per loop
(1, 2 and 3), so a draw at phase 0 and one at phase 2π are the same image, and the 300 frames of one loop at 30 frames a
second join without a seam. **(decision B1, B2, B3, B4; the field's constants drafter)**

**R5-18 · The runtime's behavior.** The drawing buffer follows the canvas's CSS size times the device pixel ratio, capped
at `MAX_DPR` 1.5, then scaled down as a whole to fit within 1920 × 1080 (`bufferSize`); a `ResizeObserver` keeps it
current. The loop is one `requestAnimationFrame` chain that advances the phase only while it runs, so a pause freezes
the image and a resume continues from the frozen phase. It pauses while the canvas is off-screen (an
`IntersectionObserver` with threshold 0) and while the page is hidden (`visibilitychange`). Under reduced motion (the OS
setting `prefers-reduced-motion: reduce`, followed live through `matchMedia`'s `change` event, or `reducedMotion: true`)
it draws one still frame at phase 0 and runs no loop. `setStops` cross-fades from the shown stops to the new ones over
`fade.durationMs` with `fade.easing` (by default the `dyelot` preset's `base` 200 ms and `standard` [0.2, 0, 0, 1]), by
moving `u_mix` from 0 to 1; a new `setStops` during a fade starts from the colors shown at that moment; under reduced
motion the swap is at once. The runtime writes its state on the canvas: `data-flavor` is one of `running`, `paused`,
`offscreen`, `hidden`, `still` or `fallback` (the first that holds, in the order `fallback`, `still`, `paused`, `hidden`,
`offscreen`, `running`), `data-flavor-reason` the fallback's reason while `fallback`, and `data-flavor-stops` the target
stops joined by commas. Wherever it loops, the host shows a Pause button with `aria-pressed` (WCAG 2.2.2, moving content
over 5 s); where it does not loop (still, fallback), the host shows no Pause button. **(decision B5; the attributes, the
precedence and the fade's defaults drafter)**

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
0 and waits for `drawAt`) and `onFallback(reason)`. `drawAt(fraction)` draws one frame at phase 2π × fraction with no
fade, `fraction` in [0, 1], and stops the loop. `destroy()` stops everything, removes every listener and observer and
releases the context with `WEBGL_lose_context` when the extension exists; a call on a destroyed handle is a no-op.
`flavor-react.tsx` exports `<Flavor stops seed paused reducedMotion fade onFallback className />`, one `<canvas
aria-hidden="true">` that mounts in an effect, calls `setStops` and `setPaused` when those props change, and destroys on
unmount; a host restarts it by changing its `key`. Every function checks its arguments by R-05 and names itself.
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

**R5-31 · Six hero designs, made on the server.** `src/features/landing/heroes.ts` holds `HERO_PARAMS` and
`heroDesigns()`, which runs `generateSystem({ ...freshParams(), primary, name }, seed)` for each, once per server instance
(a module-scope memo), and gives each design's spec and its `HeroCard`: the name, `href` `/studio#s=<encodeSpec(spec)>`,
`stops` `flavorStops(spec, "dark")` (the page is dark), `seed` `flavorSeed(specId(spec))` and `fade` `{ durationMs:
motion.durations.base, easing: motion.easings.standard }`.

| # | Name | Seed | Primary seed (OKLCH) | Its hex |
|---|---|---|---|---|
| 1 | Madder | `hero-madder` | 0.70 0.17 22 | `#f66c6d` |
| 2 | Weld | `hero-weld` | 0.82 0.15 95 | `#e3c23b` |
| 3 | Verdigris | `hero-verdigris` | 0.68 0.11 165 | `#4bae87` |
| 4 | Woad | `hero-woad` | 0.58 0.12 235 | `#0e84b7` |
| 5 | Logwood | `hero-logwood` | 0.52 0.14 300 | `#7652ac` |
| 6 | Cochineal | `hero-cochineal` | 0.60 0.20 345 | `#cd3f9b` |

Each is a historical dye, like madder, and each seed is inside sRGB. Only `src/app/page.tsx`, `src/app/explore/page.tsx`
and `src/app/motion/page.tsx` import `heroes.ts`; the landing's client bundle gets `HeroCard`s and no engine code
(C-GUARD5-05, F-LAZY5-01). The explorer's and the lab's "server default" is the first design. **(decision C1; the five
hues, names and seeds drafter)**

**R5-32 · The hero.** `/` keeps the house terminal look and its one `h1`. Below the heading, a `TerminalWindow` titled
`<name, lowercase>.flavor` whose body is `<Flavor>` for the current hero card at a 16:9 ratio, with no text on the shader.
Under the window, in this order: the line "Palette <i> of 6: <name>."; "Next palette", which moves to the next card (6
wraps to 1) and cross-fades the stops by R5-18; "Pause" with `aria-pressed`, shown only while the shader loops; and the
link "Open this palette in the studio" to the card's `href`. The fallback sentences and "Restart the animation" of 6.4
sit under the controls. **(decision C1; the window title, the line and the order drafter)**

**R5-33 · The scroll story.** Below the hero, a server-rendered story of five steps in which the first hero design
assembles itself: a seed swatch; its eleven-step primary scale; the roles; type and space; the receipt's check count
(7.2 fixes every string). Each step animates with CSS `animation-timeline: view()` only inside `@supports
(animation-timeline: view())` nested in `@media (prefers-reduced-motion: no-preference)`; outside both, every step shows
its final state, so no content waits on an animation. Movement is `opacity` and `translate` only, at most 24 px, with no
parallax. Colors appear only inside framed specimens (`[data-specimen]`). **(decision C2)**

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
drei, `OrbitControls` from `three/examples/jsm/controls/OrbitControls.js` (C-GUARD5-03). **(decision D1; the allow-list
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
chroma, 0.4 at the edge of the plot), and the steps within ±0.04 of L as dots at their hue and chroma. It is the
accessible form of the 3D view: its caption and the list beside it name what it shows (8.3). The 3D canvas is
`aria-hidden="true"`, and a one-line summary under it says what it draws. **(decision D4)**

**R5-38 · Controls.** Pointer orbit and zoom on the canvas; for the keyboard and screen readers, the labeled sliders
"Turn" (−180° to 180°, step 1, start 35), "Tilt" (0° to 90°, step 1, start 25) and "Zoom" (0.5× to 2×, step 0.05, start
1), and the button "Reset view", which sets 35, 25 and 1. The camera looks at the origin from the distance 3.2 / zoom,
with "Turn" the angle around the vertical axis and "Tilt" the angle above the horizontal plane; a pointer gesture
writes the sliders back (rounded to whole degrees and to 0.05), so the two always agree. `frameloop="demand"`, with
`invalidate()` on every control change. No auto-rotate. Damping (factor 0.1) is on unless the OS asks for reduced motion.
**(decision D5; the ranges, steps, starts and the camera model drafter)**

**R5-39 · Fallbacks and loading.** `ExploreClient` (a client component) loads `Explorer3D` with `next/dynamic(() =>
import("./Explorer3D"), { ssr: false, loading })`, whose loading state is a box of the panel's size reading "Loading the
3D view…". Before it mounts the 3D view, it checks `supportsWebgl2()`; false shows no canvas, the flat view and the
sentence "This browser cannot draw the 3D view, so the flat view below shows the same slice." A
`webglcontextlost` on the canvas unmounts the 3D view and shows "The 3D view stopped, so the flat view shows the same
slice." and "Restart the 3D view", which mounts a new canvas. An error while creating the renderer counts as no WebGL2.
**(decision D6; the loading text departs, section 1; the sentences drafter)**

**R5-40 · The data.** `/explore#s=<link>` reads the hash with `readHash`; with no hash the explorer shows the server
default (R5-31). A bad hash shows the default with the studio's decode sentence (`bannerFor`'s message) followed by "The
explorer shows the default design instead." A `hashchange` loads the new design, or keeps the current one with the
sentence. The studio's inspector links to `/explore#s=<current link>` ("See these scales in the explorer"), and the
explorer links back with "Open in the studio". **(decision D7; `hashchange` and the link texts drafter)**

### Motion lab and motion tokens (Task 5.7)

**R5-41 · The lab.** `/motion#s=<link>` (or the server default) shows the design's motion tokens: the seven durations as
a ladder, the four easings as SVG curves (`bezierPoints`, 64 segments), and the three springs as SVG curves
(`springCurve`); the five preset buttons; a number field per token; live previews; Copy and Download for the three motion
files; and "Open in the studio" with the edited link. Every edit makes the new spec with `withMotion` (no solver) and,
300 ms after the last change, writes `#s=<encodeSpec(spec)>` with `history.replaceState`, as the studio does. A bad hash
reads as in R5-40, with "The lab shows the default design instead.". **(decision E3; the debounce drafter)**

**R5-42 · Fields and bounds.** Each token has a number field: the seven durations ("instant" to "slowest", whole ms from
0 to 500), the four easings' `x1`, `y1`, `x2` and `y2` (x from 0 to 1, y from −1 to 2, step 0.01), and the three springs'
"Duration" (0.05 to 2 s, step 0.01) and "Bounce" (0 to 1, step 0.01). A valid entry is rounded to its step and applied.
An invalid one (empty, not a number, out of range) marks the field `aria-invalid="true"`, shows its sentence (9.3) and
keeps the last valid value in the design; leaving the field restores the shown text to that value. A token loaded from a
link outside the lab's caps but inside the schema's bounds is shown as it is and stays until edited. **(decision E3; the
caps depart, section 1; the steps and the restore drafter)**

**R5-43 · Previews.** Five previews with the existing `motion` 14.3.0 kit (`m`, `LazyMotion` with `domAnimation`,
`MotionConfig`), each in a framed specimen painted with the design's light roles, each with a Replay button: a dialog
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

**R5-46 · The template switch cross-fades.** `Canvas` renders `useDeferredValue(view.template)` and wraps `<Template>` in
`<ViewTransition key={template} name="dyelot-template" share enter exit default="none">`, with `share`, `enter` and
`exit` from `templateTransition(reduced)`: `"auto"` each, or `"none"` each while the canvas's "Reduce motion" is on.
The props change and the element never does, so turning the switch keeps the templates' state (F-CANVAS-07). If probe 2
finds no transition for a deferred value of the store, `Canvas` instead holds the shown template in local state set
inside `startTransition` from an effect on `view.template`. `data-template` reads the shown template. **(decision F1, F2;
the name and the reduced props drafter)**

**R5-47 · A swatch becomes its token row.** In the inspector's Scales each step's row is a button named "<palette>
<step>, <hex>" with `aria-expanded="false"`. Choosing it, inside `startTransition`, opens that step's token row in place
(local React state; one open row at a time; opening another closes the first). The compact row unmounts as the token row
mounts, and the two swatches share `<ViewTransition name="dyelot-swatch-<palette>-<step>" share="dyelot-morph"
default="none">`, so the swatch morphs. The token row shows its button (`aria-expanded="true"`, which closes it), the
variable `--color-<palette>-<step>`, the hex, `formatOklch` of the step, the contrast `<ratio to 2 decimals>:1`, "Roles:
<names>" (each role whose hex in the shown mode equals the step's, in `ROLE_NAMES` order) or "Roles: none in <mode>
mode.", and "Copy" (`aria-label` "Copy --color-<palette>-<step>"), which copies the variable's name. Escape inside the
row closes it; focus goes to the opened row's button on open and back to the compact row's button on close.
**(decision F1, F2; the row's fields and the focus drafter)**

**R5-48 · Reduced motion.** `src/app/globals.css` sets, under `@media (prefers-reduced-motion: reduce)`,
`animation-duration: 0s !important` and `animation-delay: 0s !important` on `::view-transition-group(*)`,
`::view-transition-old(*)` and `::view-transition-new(*)` (`NDOCS/01-app/02-guides/view-transitions.md`, "Respecting
reduced motion"), and always `::view-transition { pointer-events: none; }` ("Keeping the page interactive"). The morph
class sets `::view-transition-group(.dyelot-morph) { animation-duration: 250ms; animation-timing-function:
cubic-bezier(0.2, 0, 0, 1); }`. The template switch also skips its cross-fade under the canvas's own toggle (R5-46).
Nothing calls `flushSync` inside a transition. **(decision F3; the morph timing drafter)**

**R5-49 · The mobile sheet under a mid-animation OS change.** M2 deferred to M5 that switching the OS setting to reduce
while the mobile template's sheet rises leaves the sheet unsettled (`02-studio.md`, section 18). `MotionScope` follows the
OS setting live (`matchMedia("(prefers-reduced-motion: reduce)")` and its `change` event) and passes
`reducedMotion="always"` when the canvas's switch or the OS asks, else `"never"`, so an OS change takes the path the
canvas's switch already settles (F-CANVAS-07). **(drafter; owner approval item 9)**

### Remotion: the Flavor dialog and the brand video (Task 5.9)

**R5-50 · Pins.** Exactly `remotion`, `@remotion/player` and `@remotion/web-renderer` 4.0.539, in lockstep (the
renderer depends on `remotion` and `@remotion/licensing` at exactly 4.0.539), and exactly `mediabunny` 1.62.0, the
version the renderer depends on, so one copy ships. **(decision G1)**

**R5-51 · The Flavor dialog.** The toolbar gains "Flavor" (`aria-haspopup="dialog"`) right after "Export". It opens a
modal dialog named "Flavor" on R3-34's rules (an inert page, focus to the heading, Escape and "Close" shut it, focus
returns to "Flavor"). The dialog component loads with `next/dynamic` on the first open, and on open it loads `@/export`
for `brandProps` and `mediaName`. Its three sections, "Background", "Brand video" and "Shader loop", follow the canvas's
mode, and its state (a running video job included) ends when it closes: closing aborts a render or a recording.
**(decision A1, G3; the placement, the sections and the close rule drafter)**

**R5-52 · The preview.** In "Brand video", `<Player>` (from `src/features/flavor/BrandPlayer.tsx`, loaded with
`next/dynamic(..., { ssr: false })` inside the client dialog) shows `BrandIntro` with `inputProps` memoized on the spec
and the mode, `acknowledgeRemotionLicense`, `controls`, `loop`, `style={{ width: "100%" }}`, `renderLoading` reading
"Loading the preview…", and `errorFallback` reading "The preview could not play here.". Under reduced motion (the OS or
the canvas's switch) it does not autoplay and opens on frame 179, the finished picture; otherwise it autoplays, muted
(no audio exists). The Player makes no network call (its published code holds none). **(decision G3; the strings and the
initial frame drafter)**

**R5-53 · The render.** "Render the brand video" shows when the browser has WebCodecs (`typeof VideoEncoder ===
"function"`); else the sentence "This browser cannot make videos. Try a recent Chrome, Edge or Firefox." stands in its
place. A click loads `@remotion/web-renderer` with `import()` and asks `canRenderMediaOnWeb({ width: 1280, height: 720,
container: "mp4", videoCodec: "h264", muted: true })`, then `{ ..., container: "webm", videoCodec: "vp8" }`; when neither
can render, "This browser cannot render the brand video." replaces the button. Before the first render of a page load the
privacy note shows (R5-54). The render is `renderMediaOnWeb({ composition: { id: "brand-intro", component: BrandIntro,
...BRAND_INTRO }, inputProps, container, videoCodec, muted: true, licenseKey: "free-license", outputTarget:
"arraybuffer", signal, onProgress })`; its `getBlob()` downloads as `mediaName(spec, "brand", container)` through
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
and mode on a detached 1280 × 720 canvas (`size`, `autoplay: false`, `preserveDrawingBuffer`), and for `i` = 0 to 299
calls `drawAt(i / 300)` and `await source.add(i / 30, 1 / 30)` on a `CanvasSource` with the codec and a bitrate of
4,000,000 bits per second in the form 1.62.0 takes (probe 5 records it), into an `Output` with `Mp4OutputFormat` or
`WebMOutputFormat` and a `BufferTarget`, then `finalize()`. Cancel calls `output.cancel()` and discards everything. The
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
console errors, a render included. Every flow that renders answers `POST https://www.remotion.pro/**` with `page.route`
(200, `{}`), so no test reaches remotion.pro; the route also counts the requests. No test touches the network (R4-58).
**(decision J2, J3)**

### Repository rules (every task)

**R5-60 · Pins, exclusions and import boundaries.** Exactly: three 0.186.1, `@react-three/fiber` 9.8.2,
`@react-three/drei` 10.7.9 (unless probe 1 drops it), `remotion`, `@remotion/player` and `@remotion/web-renderer`
4.0.539, `mediabunny` 1.62.0, and dev `@types/three` 0.186.0. `motion` stays 14.3.0. Never: `postprocessing`,
`@react-three/postprocessing`, `gsap`, `@remotion/cli`, `@remotion/three`, `lenis`, `@paper-design/shaders` or
`detect-gpu`. Imports: `three`, `three/*` and `@react-three/*` only under `src/features/explore/`; `remotion` and
`@remotion/player` only under `src/flavor/remotion/` and `src/features/flavor/`; `@remotion/web-renderer` and
`mediabunny` only through `import()` in `src/features/flavor/`. A Dependabot group keeps the three Remotion packages
together, and one keeps three, `@types/three` and the two `@react-three` packages together. **(decision K2; the
Dependabot groups drafter)**

**R5-61 · Laziness.** The first load of `/studio` fetches no chunk that holds three, R3F, Remotion or Mediabunny code;
`/` fetches none of three, R3F, Remotion or the engine; `/explore` none of Remotion or Mediabunny; opening the Flavor
dialog loads the Player but not the web renderer or Mediabunny, each of which loads on its own click. The flows tell
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
   `useDeferredValue(view.template)`; an init script wraps `document.startViewTransition` and counts its calls. Passes
   when one template switch from the toolbar makes one call. If it makes none: R5-46's local state set in
   `startTransition` replaces the deferred value, and the probe runs again on that form; if that fails too, the template
   switch ships without a transition and the owner decides.

   Result (date):
3. **A raw rule for `*.tsx`.** With R5-23's rule and declaration, a client component and `src/export` each import a
   `.tsx` file with `?raw`; `next build` serves its text byte for byte (same SHA-256), Vitest in `core` and in `web`
   reads the same text, and every other `.tsx` import still compiles and renders. If it fails: a `prebuild` script writes
   `src/export/flavor-sources.generated.ts` holding the four sources as strings, a unit test checks it equals the files,
   and `?raw` is used for `.mjs` only.

   Result (date):
4. **The Player and the web renderer.** `<Player>` mounts through `dynamic(..., { ssr: false })` in a client component
   with no hydration warning; `renderMediaOnWeb` renders a draft of `BrandIntro` (muted MP4, H.264, 1280 × 720, 180
   frames) in Playwright's headless Chromium under the CSP with `https://www.remotion.pro` in `connect-src` and the
   usage POST answered by `page.route`: zero violations, one POST, a downloadable MP4. It records the render's time `T`
   (F-RENDER's timeout is 3 × `T`) and the marker strings of `remotion` or `@remotion/player` and of
   `@remotion/web-renderer` (candidate: `register-usage-point`). If a violation names a directive, nothing is added to
   the CSP without the owner. If the render fails headless for a reason of the browser, the render flows stop at the
   privacy note and the call's start, and the hand check (R5-65) proves the rest.

   Result (date):
5. **Mediabunny.** `mediabunny` 1.62.0's `CanvasSource` records 300 frames of a WebGL2 canvas drawn with `drawAt` to
   an MP4 under the CSP, with no violation; the probe records the time (F-LOOP's timeout is 3 × that), the exact form of
   the 4,000,000 bits-per-second option in 1.62.0 (`bitrate: 4_000_000` or `quality: new Quality(...)`), and a marker
   string. If `preserveDrawingBuffer` is not needed for a correct frame, R5-56 keeps it anyway.

   Result (date):
6. **Scroll-driven animations.** In Playwright's Chromium, `CSS.supports("animation-timeline: view()")` is true, a
   story step has a computed `animation-timeline` of `view()`, and `page.emulateMedia({ reducedMotion: "reduce" })` leaves
   every step with `animation-name: none`, opacity 1 and no translate. If `supports` is false, F-STORY-01 is skipped with
   that reason and the final-state cases stand.

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

- **I-M5-01 · Colors come from the scales.** Every color the shader, its CSS fallback, the story, the brand video and
  the explorer's points and tubes show is a step or role hex of the design; only the gamut solids show other colors, the
  sRGB images of their surfaces.
- **I-M5-02 · Reduced motion is honored.** Under the OS setting or the page's own switch nothing loops or moves by
  itself: the shader draws one still frame, the story shows final states, view transitions take 0 s, the Player does not
  autoplay, the explorer has no damping. Recording a file stays possible.
- **I-M5-03 · Every fallback is a sentence.** No raw error, stack or library message reaches the page.
- **I-M5-04 · Heavy code stays lazy** (R5-61).
- **I-M5-05 · The new cores are pure.** `src/engine/**` and `src/export/**` read no DOM, storage, network, clock,
  randomness, environment, locale or Web Crypto.
- **I-M5-06 · The shipped sources are the run sources.** The four raw files of `flavor/` equal `src/flavor/`'s byte for
  byte, and `src/flavor/` imports nothing outside itself but `react` and `remotion`.
- **I-M5-07 · The loop is seamless and deterministic.** A draw at fraction 0 and at fraction 1 give the same pixels, and
  the same stops and seed give the same pixels on any mount.
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
- `FLAVOR_BUNDLE` is `buildBundle({ spec: SPEC, origin: ORIGIN, flavor: true })`; `FLAVOR_APP` is M3's `APP()` fixture
  with `FLAVOR_BUNDLE`'s files at their paths and the four moved copies of R5-26.
- Init scripts (`tests/e2e/flavor-support.ts`): `NO_WEBGL` (`getContext` gives null for `/webgl/`), `NO_WEBCODECS`
  (`delete window.VideoEncoder`), `NO_ENCODE` (`VideoEncoder.isConfigSupported` resolves `{ supported: false }`),
  `VT_RECORD` (wraps `document.startViewTransition`, counts calls, and on each `ready` records the duration of every
  animation whose `pseudoElement` starts with `::view-transition`, with its `pseudoElement`), and `TELEMETRY(page)`
  (routes `https://www.remotion.pro/**` to 200 `{}` and keeps each request's method, URL and JSON body).
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
export function Flavor(props: FlavorProps): React.JSX.Element;   // <canvas aria-hidden="true" className>

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
  readonly variable: string;            // "--color-primary-500"
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
function useOsReducedMotion(): boolean;   // false on the server and before the first effect
```

### 5.5 The landing (Task 5.5)

```ts
// src/features/landing/heroes.ts (R5-31): imported only by the three page files
type HeroParams = { readonly name: string; readonly seed: string; readonly primary: Oklch };
const HERO_PARAMS: readonly HeroParams[];   // R5-31's six, frozen
type HeroCard = { readonly name: string; readonly href: string; readonly stops: FlavorStops;
  readonly seed: readonly [number, number]; readonly fade: { readonly durationMs: number; readonly easing: Bezier } };
function heroDesigns(): readonly { readonly card: HeroCard; readonly spec: DesignSpec }[];   // memoized per instance
function defaultDesign(): DesignSpec;   // heroDesigns()[0].spec

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

`Hero.tsx` is a client component taking `cards: readonly HeroCard[]`; `Story.tsx` is a server component taking the
spec; `story.css` holds the story's rules.

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
function cameraOf(position: readonly [number, number, number]): Camera;       // the inverse, rounded, clamped
function slicePath(points: readonly SlicePoint[], size: number): string;      // the SVG path of one outline
function dotAt(oklch: Oklch, size: number): readonly [x: number, y: number];   // a step's place in the flat view
function sceneSummary(name: string, mode: Mode, gamut: SolidGamut, l: number): string;   // 8.3

// src/features/explore/webgl.ts
function supportsWebgl2(create?: () => HTMLCanvasElement): boolean;
```

`ExploreClient.tsx` (client) holds the state; `Explorer3D.tsx` (client, loaded by `dynamic`) holds every three and R3F
import; `FlatView.tsx` renders on the server and the client.

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
`load()` gives `load-failed`; an `AbortError` gives `canceled`; any other throw gives `failed` and is never shown.

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
the phase to 2π × `f`. A pause, an off-screen canvas or a hidden page cancels the frame request; returning to `running`
starts a new chain from the kept `t`. While nothing runs (paused, off-screen, hidden, still), `setStops` draws one frame at
once at the kept phase with the new stops, and no fade. A fade's `u_mix` is `easeAt(fade.easing, elapsed /
fade.durationMs)`, clamped to 1; a fade of 0 ms swaps at once.

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

1. The hero (`Hero.tsx`, a client component given the six `HeroCard`s): a `TerminalWindow` titled `madder.flavor` (the
   current card's name in lowercase, then `.flavor`), whose body is a 16:9 box holding `<Flavor>` with the card's
   `stops`, `seed` and `fade`, `paused` from the Pause button and `reducedMotion` from `useOsReducedMotion()`. The wrapper
   is `[data-hero]` with `data-hero-index` (1 to 6).
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
`HERO` they read `#f66c6d` and `oklch(0.7000 0.1700 22.00)`. A family name is the catalog's `family`, or the id for a family
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
      animation-range: entry 10% cover 30%;
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
`cameraOf` inverts it, rounding turn and tilt to whole degrees (turn wrapped into −180 to 180, tilt clamped to 0 to 90)
and zoom to 0.05 (clamped to 0.5 to 2). `OrbitControls` takes the target (0, 0, 0), `minPolarAngle` 0, `maxPolarAngle`
π / 2, `minDistance` 1.6, `maxDistance` 6.4, `enablePan` false, `enableDamping` unless the OS asks for reduced motion,
`dampingFactor` 0.1; its `change` event writes `cameraOf(camera.position)` into the sliders and calls `invalidate()`.

### 8.3 The 3D panel and the flat view

The 3D panel is `[data-explorer]`, a 4:3 box with the attributes `data-explorer-state` (`loading`, `3d` or `flat`),
`data-explorer-reason` (`no-webgl2` or `context-lost`, while `flat`), `data-gamut`, `data-mode`, `data-slice` (2
decimals), `data-turn`, `data-tilt`, `data-zoom` (2 decimals), `data-points` (88), `data-tubes` (8) and
`data-solid-vertices` (6 534 for 32 steps). `<Canvas frameloop="demand" dpr={[1, 1.5]} gl={{ antialias: true, alpha: true
}} camera={{ fov: 40, near: 0.1, far: 20, position }}>` sits in an `aria-hidden="true"` wrapper; `onCreated` sets
`gl.localClippingEnabled = true` and listens for `webglcontextlost`. Under the panel, the summary
`sceneSummary(name, mode, gamut, l)`: "Madder: 88 steps of the light scales in OKLab, inside the sRGB gamut solid, cut at
L 0.60." (the gamut named "sRGB", "Display P3" or "Rec. 2020").

The flat view is `figure[data-flat-view]`: an `svg` of 320 × 320 (`role="img"`, `aria-labelledby` its caption) on the
panel color, with the three outlines of `slicePath(gamutSlice(gamut, l), 320)` (sRGB a solid line in the foreground
color, Display P3 dashed in the muted foreground, Rec. 2020 dotted in the border color: chrome stays achromatic) and one
dot of radius 4 per step of `sliceSteps`, filled with its hex. The plot's center is (160, 160); chroma 0.4 sits at radius
150; a hue `h` lies at the angle `h` from the right, counterclockwise: `x = 160 + r cos h`, `y = 160 − r sin h`, each to 2
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
| `bad-link` | The explorer shows the default design instead. |

The bad-link line is `bannerFor({ kind: "link", reason, issues, fallback: "current" }).message` + " " +
`EXPLORE_LINES["bad-link"]`.

## 9. The motion lab and motion tokens (Task 5.7)

### 9.1 The page

`src/app/motion/page.tsx`: `pageMetadata(SITE, "/motion", { title: "Motion lab", description: "Edit a design's motion:
durations, easing curves and springs, with live previews and files for CSS, Motion and GSAP." })` (116 characters);
`PageFrame active="motion" statusLeft="dyelot ~/motion" statusRight="muizz-lab · MIT"`; `<Prompt>dyelot motion</Prompt>`;
the `h1` "The motion lab"; the paragraph "Change a design's durations, curves and springs, watch them on five small previews,
then take the files or open the design in the studio."; then `LabClient` given `defaultDesign()`. Its parts, in DOM and
Tab order: the `role="status"` line (empty, or the bad-hash sentence with "The lab shows the default design instead.");
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

`LAB_BOUNDS` and `readField`'s sentences:

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

A group labeled "Previews" inside `[data-specimen][data-lab-previews]`, painted with `canvasStyle(spec, "light")`. The
switch "Reduced motion" (`role="switch"`) comes first, described by "Shows what the exported reduced-motion rules do.";
it starts on when the OS asks for reduced motion. Then five `figure`s:

| Preview | Caption | Tokens | Replay |
|---|---|---|---|
| Dialog | Dialog: slow and decelerate in, base and accelerate out | opacity and scale 0.96 to 1 | Replay the dialog |
| Toast | Toast: the smooth spring | rises 24 px | Replay the toast |
| Switch | Switch: the snappy spring | the thumb slides | Replay the switch |
| Tab indicator | Tab indicator: the bouncy spring | the bar slides under the tabs "One", "Two" and "Three" | Replay the tab indicator |
| Hover | Hover: fast and standard | lifts 2 px | Replay the hover |

"Replay" remounts its preview with a new key (the switch and the tab indicator move to their next state). The switch
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
"#s=" + encodeSpec(spec))`; a `hashchange` loads the new design. Reloading the page shows the edited tokens.

## 10. View transitions (Task 5.8)

### 10.1 The template switch

In `Canvas`:

```tsx
const template = useDeferredValue(view.template);
const transition = templateTransition(view.reducedMotion);
// … inside MotionScope, which renders no element:
<ViewTransition key={template} name="dyelot-template" share={transition.share} enter={transition.enter}
  exit={transition.exit} default="none">
  <div data-template-root="">
    <Template spec={spec} view={{ ...view, template }} />
  </div>
</ViewTransition>
```

`[data-canvas]`'s `data-template` reads `template`. `templateTransition(false)` is `{ share: "auto", enter: "auto",
exit: "auto", default: "none" }` and `templateTransition(true)` the same with `"none"` for the first three; a non-boolean
is a `TypeError` naming `templateTransition`.

### 10.2 The token row

`Scales` keeps one piece of local state, the open step `{ palette, step } | null`, set inside `startTransition`. A
compact row is `<li data-step>` holding one `<button type="button" aria-expanded="false" aria-label="<palette> <step>,
<hex>">` whose content is the step number, the swatch (inside `<ViewTransition name={swatchName(palette, step)}
share="dyelot-morph" default="none">`), the hex and the ratio, as M2 draws them. The open row replaces it in the same
`li`, which gains `data-token-row`:

- the button `aria-expanded="true"` with the same name, which closes the row;
- the swatch, at 24 px, inside the `ViewTransition` of the same name;
- `<code>` with `--color-<palette>-<step>`;
- the hex, `formatOklch` of the step, and the contrast "<ratio to 2 decimals>:1", each labeled "Hex", "OKLCH" and
  "Contrast" in a description list;
- "Roles: <names joined by ", ">" or "Roles: none in <mode> mode.";
- "Copy" (`aria-label` "Copy --color-<palette>-<step>"), which writes the variable's name and reads "Copied" for 2 s; a
  blocked copy selects the `code` text and shows "Copy is blocked here. The text is selected: press Ctrl+C or ⌘C."

Escape with focus inside the row closes it. After it opens, focus is on its button; after it closes (button, Escape, or
another row opening), focus is on the compact button of the step it showed. A design change that keeps the step keeps the
row open with the new values; a mode toggle keeps it open in the new mode.

### 10.3 The CSS

`src/app/globals.css` gains, after its reduced-motion block:

```css
::view-transition {
  pointer-events: none;
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

`MotionScope` reads `useOsReducedMotion()` (a `matchMedia("(prefers-reduced-motion: reduce)")` subscription through
`watchReducedMotion`, false on the server) and passes `reducedMotion={reduced || osReduced ? "always" : "never"}`;
`useKitMotion` and `Entrance` read `useReducedMotionConfig()` as before, so the leaf remount and the sheet's settling rules
of F-CANVAS-07 now run for an OS change too.

## 11. Remotion and Mediabunny (Tasks 5.9 and 5.10)

### 11.1 The Player

`BrandPlayer.tsx` (`"use client"`) renders:

```tsx
<Player component={BrandIntro} inputProps={props} durationInFrames={180} fps={30} compositionWidth={1280}
  compositionHeight={720} controls loop acknowledgeRemotionLicense autoPlay={!reduced} initialFrame={reduced ? 179 : 0}
  style={{ width: "100%" }} renderLoading={() => <p>Loading the preview…</p>}
  errorFallback={() => <p>The preview could not play here.</p>} />
```

`props` is `useMemo(() => brand.brandProps(spec, mode), [spec, mode])`, `brand` the loaded `@/export`; `reduced` is the OS
setting or the canvas's "Reduce motion". The Player has no `audio`, so `muted` changes nothing; it autoplays only when
`reduced` is false. The dialog loads `BrandPlayer` with `dynamic(() => import("./BrandPlayer"), { ssr: false, loading:
() => <p>Loading the preview…</p> })`.

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
muted: true }` and then `{ …, container: "webm", videoCodec: "vp8" }`, and gives the first with `canRender` true, else
null; a throw counts as false. `renderBrandVideo` passes R5-53's options, reads `progress` from `onProgress` (0 to 1),
awaits `getBlob()`, and gives the bytes. The live line announces 10%, 20%, … 100% at most once each (`nextAnnounced`).

### 11.3 The shader loop

The "Shader loop" section runs the same states without `confirm`: `idle` ("Record the shader loop", or "This browser
cannot record the shader loop." in its place without WebCodecs or WebGL2), `checking` (Mediabunny loads and `pickCodec`
runs), `unsupported`, `recording` ("Recording…", "Cancel", the bar and the live line, progress `(i + 1) / 300`), and the
outcomes. `recordLoop` creates the detached canvas, mounts the flavor with `{ stops, seed, size: { width: 1280, height:
720 }, autoplay: false }` (the runtime asks for `preserveDrawingBuffer: true` when `autoplay` is false), runs R5-56's
300 steps, destroys the handle in every outcome, and gives the bytes of `output.target.buffer`. A video job holds the
other section's button `aria-disabled`, described by "Wait for the current video to finish."

### 11.4 The license texts

The README of the repository gains a section "Remotion" saying: dyelot renders its brand video with Remotion under
Remotion's Free License, as an individual's project; Remotion is source-available, not open source; each in-browser render
sends one usage event to remotion.pro; anyone who reuses the video code needs Remotion's license, and companies of four
or more people need a Company License (`https://remotion.pro/license`). `flavor/remotion/README.md` (12.1) and the
composition's header (R5-22) say the same to the export's reader.

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

const flavor = mountFlavor(document.querySelector("canvas"), { stops, seed });
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

Under its Free License, individuals, non-profit organizations and companies of up to three people may use Remotion at no
cost. Companies of four or more people need a Remotion Company License.

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
`"*.md?raw"` and `"*.tsx?raw"`, each a default `string`. `tsconfig.json`'s `include` adds `src/flavor/*.mjs`.
`.github/dependabot.yml` (created if absent) groups `remotion`, `@remotion/player` and `@remotion/web-renderer` as
`remotion`, and `three`, `@types/three`, `@react-three/fiber` and `@react-three/drei` as `three`.

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

**Brand video.** The Player (11.1), then "Render the brand video", described by "Makes a 6-second video at 1280 × 720 in
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
lab" follows "Motion feel" and precedes the Steer section. In the inspector, each Scales step button is a stop, in
palette order, then "See these scales in the explorer"; an open token row's stops are its button, then "Copy". The Flavor
dialog's order is the Background section's Pause (when shown) and "Restart the animation" (when shown), the Player's
controls, the render button or the note's buttons, "Cancel" while busy, the record button, "Cancel" while busy, and
"Close". Space, ← and → in the lab's and the explorer's fields type or move the slider as the control does; the studio's
shortcuts do not run outside the studio.
