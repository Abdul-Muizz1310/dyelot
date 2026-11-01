// The 20 vetted pairings of research D2 (spec R2-04 and section 5.2). Every pairing fills the
// three families: a row without a D2 mono takes `fragment-mono`, and row 19 takes
// `spline-sans-mono`. The ids are catalog ids. `choosePairing` picks one per seed (R2-05).

import { describeType } from "../color/guards";
import { seededRandom } from "../random";
import { FONT_CATALOG, type FontEntry, genericness } from "./catalog";

export type PairingId = string;

export type Pairing = {
  readonly id: PairingId;
  readonly label: string;
  readonly display: string;
  readonly body: string;
  readonly mono: string;
  readonly fit: readonly string[];
  readonly risk: "low" | "low-med" | "med";
};

const pairing = (
  id: string,
  label: string,
  display: string,
  body: string,
  mono: string,
  fit: readonly string[],
  risk: Pairing["risk"],
): Pairing => Object.freeze({ id, label, display, body, mono, fit: Object.freeze([...fit]), risk });

/** The pairings, in the order of the table in spec section 5.2. */
export const PAIRINGS: readonly Pairing[] = Object.freeze([
  pairing(
    "host-grotesk",
    "Host Grotesk with Fragment Mono",
    "host-grotesk",
    "host-grotesk",
    "fragment-mono",
    ["Swiss", "dev-tool"],
    "low",
  ),
  pairing(
    "schibsted-serif",
    "Schibsted Grotesk over Source Serif 4",
    "schibsted-grotesk",
    "source-serif-4",
    "fragment-mono",
    ["editorial"],
    "low-med",
  ),
  pairing(
    "gloock-albert",
    "Gloock over Albert Sans",
    "gloock",
    "albert-sans",
    "fragment-mono",
    ["luxury", "editorial minimal"],
    "low",
  ),
  pairing(
    "young-onest",
    "Young Serif over Onest",
    "young-serif",
    "onest",
    "fragment-mono",
    ["organic", "food", "consumer"],
    "low",
  ),
  pairing(
    "bodoni-familjen",
    "Bodoni Moda over Familjen Grotesk",
    "bodoni-moda",
    "familjen-grotesk",
    "fragment-mono",
    ["fashion", "luxury"],
    "med",
  ),
  pairing(
    "literata-spline",
    "Literata over Spline Sans",
    "literata",
    "spline-sans",
    "spline-sans-mono",
    ["docs", "reading apps"],
    "low",
  ),
  pairing(
    "hubot-mona",
    "Hubot Sans over Mona Sans",
    "hubot-sans",
    "mona-sans",
    "martian-mono",
    ["tech brand", "dev-tool"],
    "low",
  ),
  pairing(
    "funnel",
    "Funnel Display over Funnel Sans",
    "funnel-display",
    "funnel-sans",
    "fragment-mono",
    ["startup marketing"],
    "low",
  ),
  pairing(
    "zalando",
    "Zalando Sans Expanded over Zalando Sans",
    "zalando-sans-expanded",
    "zalando-sans",
    "fragment-mono",
    ["e-commerce"],
    "low",
  ),
  pairing(
    "unbounded-golos",
    "Unbounded over Golos Text",
    "unbounded",
    "golos-text",
    "fragment-mono",
    ["Y2K", "retro-futurism"],
    "low",
  ),
  pairing(
    "archivo-courier",
    "Archivo with Courier Prime",
    "archivo",
    "archivo",
    "courier-prime",
    ["neo-brutalism", "zine"],
    "med",
  ),
  pairing(
    "shoulders-redhat",
    "Big Shoulders over Red Hat Text",
    "big-shoulders",
    "red-hat-text",
    "fragment-mono",
    ["sports", "industrial", "events"],
    "low",
  ),
  pairing(
    "tiny5-spline",
    "Tiny5 over Spline Sans",
    "tiny5",
    "spline-sans",
    "spline-sans-mono",
    ["dithering", "pixel"],
    "low",
  ),
  pairing(
    "doto-redhat",
    "Doto over Red Hat Text",
    "doto",
    "red-hat-text",
    "red-hat-mono",
    ["retro-tech", "dashboards"],
    "low",
  ),
  pairing(
    "redaction-redhat",
    "Redaction over Red Hat Text",
    "redaction",
    "red-hat-text",
    "red-hat-mono",
    ["grain", "anti-design", "editorial"],
    "low",
  ),
  pairing(
    "commissioner",
    "Commissioner throughout",
    "commissioner",
    "commissioner",
    "fragment-mono",
    ["organic", "calm"],
    "low",
  ),
  pairing(
    "atkinson",
    "Atkinson Hyperlegible throughout",
    "atkinson-hyperlegible-next",
    "atkinson-hyperlegible-next",
    "atkinson-hyperlegible-mono",
    ["accessible", "public sector", "health"],
    "low",
  ),
  pairing(
    "google-flex",
    "Google Sans Flex with Google Sans Code",
    "google-sans-flex",
    "google-sans-flex",
    "google-sans-code",
    ["M3-Expressive-like"],
    "med",
  ),
  pairing(
    "anybody-albert",
    "Anybody over Albert Sans",
    "anybody",
    "albert-sans",
    "spline-sans-mono",
    ["kinetic typography"],
    "low",
  ),
  pairing(
    "science-hanken",
    "Science Gothic over Hanken Grotesk",
    "science-gothic",
    "hanken-grotesk",
    "fragment-mono",
    ["sci-fi", "HUD"],
    "low",
  ),
]);

/** The pairing ids, in order. */
export const PAIRING_IDS: readonly PairingId[] = Object.freeze(PAIRINGS.map((p) => p.id));

/** How strongly a generic display face is weighted down: `w = 1 - OVERUSE_PENALTY * genericness`. */
const OVERUSE_PENALTY = 0.7;

/**
 * One pairing for a seed, weighted by `1 - 0.7 * genericness(display)` (an overuse penalty, not a
 * whitelist). It draws one `u` from `seededRandom(seed + ":pairing")`, a stream apart from the
 * palette stream, and walks the cumulative weights to `u * total` (spec R2-05). The same seed gives
 * the same id on every call.
 */
export function choosePairing(
  seed: string,
  pairings: readonly Pairing[] = PAIRINGS,
  catalog: readonly FontEntry[] = FONT_CATALOG,
): PairingId {
  if (typeof seed !== "string") {
    throw new TypeError(`choosePairing: seed must be a string, got ${describeType(seed)}`);
  }
  if (!Array.isArray(pairings as unknown)) {
    throw new TypeError(`choosePairing: pairings must be an array, got ${describeType(pairings)}`);
  }
  if (!Array.isArray(catalog as unknown)) {
    throw new TypeError(`choosePairing: catalog must be an array, got ${describeType(catalog)}`);
  }
  if (pairings.length === 0) throw new RangeError("choosePairing: pairings must not be empty");
  const weights = pairings.map((item) => 1 - OVERUSE_PENALTY * genericness(item.display, catalog));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const target = seededRandom(`${seed}:pairing`)() * total;
  let cumulative = 0;
  for (let i = 0; i < pairings.length; i++) {
    cumulative += weights[i] as number;
    if (target < cumulative) return (pairings[i] as Pairing).id;
  }
  return (pairings[pairings.length - 1] as Pairing).id;
}
