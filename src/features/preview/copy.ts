import { assertOneOf } from "@/features/studio/guards";

// The canvas copy (spec R2-21, section 7.6, F-CANVAS-09): real sample copy for each template, set in
// the world of a fictional tide-reading app and an essay on natural dyes, and the one edge-case copy
// that tests a layout: a 40-character unbroken word, a 90-character title, a name with diacritics, a
// large number, an empty list and a one-character label. Places, people, prices and readings are
// fictional and labeled "sample". Pure data, deeply frozen.

export type CanvasCopy = {
  /** A card, dialog or sheet title; a template's headline. */
  readonly title: string;
  /** One word set in running text. */
  readonly word: string;
  /** A person's name: an avatar, a table cell, a quote's author. */
  readonly person: string;
  /** A number in a numeric column; a price. */
  readonly amount: string;
  /** The rows of a list. */
  readonly items: readonly string[];
  /** A short label: a badge, a chip. */
  readonly label: string;
};

/** The two copy sets of the canvas's copy group. */
export type CopyKind = "real" | "edge";

/** A string slot of `CanvasCopy` that rich text can hold. */
export type Slot = "word" | "person" | "amount";

/**
 * One run of rich text: plain text, inline code, emphasis, a link to a target inside the template,
 * a reference to a numbered note, or a slot that the template's copy fills.
 */
export type Run =
  | string
  | { readonly code: string }
  | { readonly em: string }
  | { readonly link: string; readonly to: string }
  | { readonly note: number }
  | { readonly slot: Slot };

export type Rich = readonly Run[];

/** A value and everything inside it, frozen. */
function frozen<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const inner of Object.values(value)) frozen(inner);
    Object.freeze(value);
  }
  return value;
}

const EDGE_WORD = "Spritsailbargemooringandtidecalculations";

/** The fictional places of the sample copy: the one list every template reads them from. */
export const SAMPLE_PLACES = Object.freeze([
  "Samphire Bay",
  "Heron Staithe",
  "Gull Point",
  "Wrack Quay",
] as const);

export const COPY: Readonly<Record<CopyKind, CanvasCopy>> = Object.freeze({
  real: Object.freeze({
    title: `Spring tide at ${SAMPLE_PLACES[0]}`,
    word: "saltmarsh",
    person: "Maren Holt",
    amount: "4.12",
    items: Object.freeze(SAMPLE_PLACES.slice(0, 3)),
    label: "Neap",
  }),
  edge: Object.freeze({
    title:
      "A sample tide log for the eastern saltmarsh channels, with every reading taken before dawn",
    word: EDGE_WORD,
    person: "Zoë Ångström-Nguyễn",
    amount: "1,234,567,890.12",
    items: Object.freeze([]),
    label: "N",
  }),
});

// ── The landing page: Saltmarsh, a tide-reading app (section 7.6) ──────────────────────────────

/** The landing page's in-page targets. */
export type LandingTarget = "top" | "features" | "pricing" | "faq";

type Reading = { readonly time: string; readonly meters: number };

export type LandingText = {
  readonly brand: string;
  readonly sample: string;
  readonly nav: readonly { readonly label: string; readonly to: LandingTarget }[];
  readonly signIn: string;
  readonly hero: { readonly lead: Rich; readonly start: string; readonly sampleDay: string };
  readonly today: {
    readonly place: string;
    readonly note: string;
    /** The start of the figure's name; the day's events and the "now" time follow (F-TPL-42). */
    readonly figure: string;
    readonly hours: readonly string[];
    /** The names of the two kinds of event the sample tide gives (section 6.12). */
    readonly high: string;
    readonly low: string;
    /** The word before the time on the curve's "now" line. */
    readonly now: string;
  };
  readonly features: {
    readonly title: string;
    readonly intro: string;
    readonly items: readonly { readonly title: string; readonly body: string }[];
  };
  readonly moorings: {
    readonly title: string;
    readonly note: string;
    readonly place: string;
    readonly time: string;
    readonly height: string;
    /** The meters a full level bar stands for. */
    readonly range: number;
    readonly readings: readonly Reading[];
    readonly empty: string;
  };
  readonly quote: { readonly text: string; readonly role: string };
  readonly pricing: {
    readonly title: string;
    readonly body: string;
    readonly plan: string;
    readonly currency: string;
    readonly per: string;
    readonly includes: readonly string[];
    readonly action: string;
  };
  readonly faq: {
    readonly title: string;
    readonly intro: string;
    readonly items: readonly { readonly question: string; readonly answer: string }[];
  };
  readonly footer: { readonly note: string; readonly top: string };
};

const LANDING_REAL: CanvasCopy = frozen<CanvasCopy>({
  title: "Read the water before you cast off.",
  word: "creek",
  person: "Maren Holt",
  amount: "6.50",
  items: SAMPLE_PLACES.slice(0, 3),
  label: "Neap",
});

export const LANDING_TEXT: LandingText = frozen<LandingText>({
  brand: "Saltmarsh",
  sample: "sample",
  nav: [
    { label: "Features", to: "features" },
    { label: "Pricing", to: "pricing" },
    { label: "Questions", to: "faq" },
  ],
  signIn: "Sign in",
  hero: {
    lead: [
      "Saltmarsh reads the gauge at your mooring and tells you in plain words when the ",
      { slot: "word" },
      " floods, how high the water climbs and when it drains again.",
    ],
    start: "Start a tide log",
    sampleDay: "See a sample day",
  },
  today: {
    place: SAMPLE_PLACES[0],
    note: "Today, sample readings",
    figure: "Sample tide curve for today",
    hours: ["00:00", "06:00", "12:00", "18:00", "24:00"],
    high: "High water",
    low: "Low water",
    now: "now",
  },
  features: {
    title: "Built on the gauge, not the almanac",
    intro:
      "A printed table predicts the water a year ahead. Saltmarsh reads it as it moves, then forecasts the next six hours.",
    items: [
      {
        title: "Readings from your own gauge",
        body: "Each mooring reports its water level every ten minutes. The curve comes from those readings, not from a table printed last winter.",
      },
      {
        title: "Forecasts in plain words",
        body: "Read “the creek covers the hard at 07:10” instead of a column of heights and times.",
      },
      {
        title: "Alerts that know your keel",
        body: "Set your draft once. Saltmarsh tells you when there is water enough to leave, and when to be back.",
      },
      {
        title: "Three days kept offline",
        body: "The next three days of tides stay on your phone, so the curve still draws past the headland.",
      },
    ],
  },
  moorings: {
    title: "Your moorings",
    note: "Next high water, sample",
    place: "Mooring",
    time: "Time",
    height: "Height",
    range: 5,
    readings: [
      { time: "06:42", meters: 4.1 },
      { time: "07:05", meters: 3.6 },
      { time: "07:31", meters: 2.9 },
    ],
    empty: "No moorings saved yet. Save one from its tide table.",
  },
  quote: {
    text: "I used to check three tables and a forecast before dawn. Now I read one curve and go.",
    role: `Oyster farmer at ${SAMPLE_PLACES[3]}`,
  },
  pricing: {
    title: "One mooring is free",
    body: "Track one place at no cost. The crew plan covers every mooring you sail from.",
    plan: "Crew",
    currency: "$",
    per: "a month, sample price",
    includes: [
      "Every mooring you sail from",
      "Alerts for up to six boats",
      "Three days of tides offline",
    ],
    action: "Compare plans",
  },
  faq: {
    title: "Questions",
    intro:
      "About the sample product. Its places, gauges and readings are made up for this preview.",
    items: [
      {
        question: "Where do the readings come from?",
        answer:
          "From a gauge at each mooring that reports every ten minutes. In this sample, the gauges and their readings are fictional.",
      },
      {
        question: "Does Saltmarsh replace the official tide tables?",
        answer:
          "No. Carry the official tables too. Saltmarsh shows what the water is doing now and over the next six hours.",
      },
      {
        question: "What happens when I lose signal?",
        answer: "The app keeps three days of tides on the phone, so the curve still draws at sea.",
      },
      {
        question: "Can my crew see the same moorings?",
        answer: "Yes. Invite them by email, and they see the same curves and alerts.",
      },
    ],
  },
  footer: {
    note: "Saltmarsh is a sample product made for this preview. Its places, people, prices and readings are fictional.",
    top: "Back to top",
  },
});

// ── The editorial article: "The long thread", an essay on natural dyes (section 7.6) ──────────

/** The article's sections, the targets of its contents and links. */
export type EditorialSection = "roots" | "blue" | "record";
export type EditorialTarget = EditorialSection | "notes";

/** A block of the article's body. */
export type Block =
  | { readonly kind: "p"; readonly runs: Rich }
  | { readonly kind: "h3"; readonly text: string }
  | { readonly kind: "h4"; readonly text: string }
  | { readonly kind: "quote"; readonly runs: Rich; readonly cite: string }
  | { readonly kind: "code"; readonly title: string; readonly lines: readonly Rich[] }
  | { readonly kind: "figure"; readonly label: string; readonly caption: Rich }
  | { readonly kind: "places"; readonly title: string; readonly empty: string };

export type EditorialText = {
  readonly kicker: string;
  readonly standfirst: Rich;
  readonly by: string;
  readonly readingTime: string;
  readonly contents: string;
  readonly sections: readonly {
    readonly key: EditorialSection;
    readonly title: string;
    readonly blocks: readonly Block[];
  }[];
  readonly notes: {
    readonly title: string;
    readonly items: readonly Rich[];
    readonly back: string;
  };
};

const EDITORIAL_REAL: CanvasCopy = frozen<CanvasCopy>({
  title: "The long thread",
  word: "mordant",
  person: "Hester Vane",
  amount: "1.25",
  items: SAMPLE_PLACES.slice(1, 4),
  label: "Field notes",
});

export const EDITORIAL_TEXT: EditorialText = frozen<EditorialText>({
  kicker: "Sample essay",
  standfirst: [
    "A season of dyeing wool with plants: why a red takes three baths, why blue appears only in the air, and what a ",
    { slot: "word" },
    " has to do with either.",
  ],
  by: "By",
  readingTime: "Two-minute read",
  contents: "Contents",
  sections: [
    {
      key: "roots",
      title: "Roots and reds",
      blocks: [
        {
          kind: "p",
          runs: [
            "Every red in my notebook starts underground. Madder keeps its color in the root, and the root needs three summers before it holds enough to dye with. I dug the first bed at ",
            SAMPLE_PLACES[1],
            " the spring I started this record.",
            { note: 1 },
          ],
        },
        { kind: "h3", text: "The first bath" },
        {
          kind: "p",
          runs: [
            "The first bath is never the color you planned. Wool takes the brightest red early, then pulls in browns as the bath grows hot. Keep it below a simmer and lift the skein often. The color you want lives in a narrow band of heat.",
          ],
        },
        { kind: "h4", text: "A note on mordants" },
        {
          kind: "p",
          runs: [
            "A mordant is the salt that lets a dye hold to a fiber. Mine is alum, a tenth of the weight of the dry wool, dissolved in hot water before the wool goes in. Without it, madder rinses out to a ",
            { em: "tired" },
            " pink.",
          ],
        },
        {
          kind: "quote",
          runs: [
            "A dye that fades taught you nothing. A dye that holds taught you the water it came from.",
          ],
          cite: `From the dye log kept at ${SAMPLE_PLACES[2]}`,
        },
      ],
    },
    {
      key: "blue",
      title: "Blue from the air",
      blocks: [
        {
          kind: "p",
          runs: [
            "Woad does its work out of sight. The vat holds no blue at all. The cloth comes out green and turns blue in the minute it meets the air.",
            { note: 2 },
            " The first time I watched it happen, I forgot to write anything down.",
          ],
        },
        {
          kind: "p",
          runs: [
            "So now the log comes first. Every vat gets a page, and every page has the same five lines. The ",
            { code: "fiber" },
            " line holds the weight of the dry wool.",
          ],
        },
        {
          kind: "code",
          title: "A page from the dye log",
          lines: [
            ["vat     woad, third week"],
            ["fiber   ", { slot: "amount" }, " kg wool"],
            ["dips    4 × 5 min"],
            ["air     10 min between dips"],
            ["result  mid blue, even"],
          ],
        },
        {
          kind: "figure",
          label: "Five skeins of wool in a row, each in one of this design's chart colors.",
          caption: [
            "Figure 1. Five skeins from one season, shown in this design's five chart colors. A sample figure.",
          ],
        },
        {
          kind: "p",
          runs: [
            "Read the log back a year later and it tells you more than memory does. The ",
            { link: "notes", to: "notes" },
            " say why the third vat failed.",
          ],
        },
      ],
    },
    {
      key: "record",
      title: "Keeping the record",
      blocks: [
        {
          kind: "p",
          runs: [
            "A record helps only when you keep it the same way every time. I write the date, the plant, the weight of the wool and of the dyestuff, then the minutes in each bath.",
            { note: 3 },
          ],
        },
        {
          kind: "p",
          runs: [
            "The plants in this essay grew in three places. Go back to ",
            { link: "Roots and reds", to: "roots" },
            " for the bed where the madder began.",
          ],
        },
        { kind: "places", title: "Where the plants grew", empty: "No places named yet." },
      ],
    },
  ],
  notes: {
    title: "Notes",
    items: [
      [
        "Madder sold for dyeing is dried and chopped root. A fresh root gives a brighter red and a smaller harvest.",
      ],
      [
        "The blue forms as the dye meets the air. For a deeper shade, dip again rather than leave the cloth in longer.",
      ],
      ["In this sample, every weight, date and place is fictional."],
    ],
    back: "Back to the text",
  },
});

// ── Which copy a template shows ───────────────────────────────────────────────────────────────

/** The templates whose copy lives here; the later templates join with Tasks 2.9 and 2.10. */
export const COPY_OWNERS = Object.freeze(["kitchen-sink", "landing", "editorial"] as const);
export type CopyOwner = (typeof COPY_OWNERS)[number];

const KINDS: readonly CopyKind[] = Object.freeze(["real", "edge"]);

const REAL: Readonly<Record<CopyOwner, CanvasCopy>> = Object.freeze({
  "kitchen-sink": COPY.real,
  landing: LANDING_REAL,
  editorial: EDITORIAL_REAL,
});

/**
 * The copy a template shows: its own real copy, or the one edge copy of R2-21. An owner or a kind of
 * the wrong type is a TypeError, one outside its set a RangeError (R-05).
 */
export function copyOf(owner: CopyOwner, kind: CopyKind): CanvasCopy {
  assertOneOf(owner, COPY_OWNERS, "copyOf: owner");
  assertOneOf(kind, KINDS, "copyOf: kind");
  return kind === "edge" ? COPY.edge : REAL[owner];
}
