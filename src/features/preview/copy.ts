import { assertOneOf } from "@/features/studio/guards";

// The canvas copy (spec R2-21, sections 7.6 and 7.7, F-CANVAS-09): real sample copy for each template,
// set in the world of a fictional tide-reading app, its console and an essay on natural dyes, and the one edge-case copy
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

// ── The dashboard: Saltmarsh's console (section 7.7) ──────────────────────────────────────────

/** The dashboard's in-page targets: the sidebar's links. */
export type DashboardTarget = "top" | "alerts" | "gauges" | "exports";

/** A gauge's state in the table: its badge. */
export type GaugeState = "reporting" | "late" | "offline";

type GaugeReading = {
  /** Meters of water at the gauge. */
  readonly level: number;
  /** Meters gained (positive) or lost (negative) in the last hour. */
  readonly change: number;
  /** Battery, in percent. */
  readonly battery: number;
  /** The last report's clock time. */
  readonly report: string;
  readonly state: GaugeState;
};

export type DashboardText = {
  readonly brand: string;
  readonly sample: string;
  /** The sidebar navigation's accessible name. */
  readonly navLabel: string;
  readonly nav: readonly { readonly label: string; readonly to: DashboardTarget }[];
  readonly crew: { readonly name: string; readonly plan: string };
  readonly command: { readonly label: string; readonly hint: string };
  readonly filters: {
    readonly label: string;
    readonly range: string;
    readonly ranges: readonly string[];
    readonly chips: readonly string[];
  };
  readonly lead: {
    readonly label: string;
    readonly place: string;
    /** The sentence under the lead value; it holds the `word` slot. */
    readonly note: Rich;
    /** The word before the next event: "Falling to low water" or "Rising to high water". */
    readonly falling: string;
    readonly rising: string;
  };
  readonly stats: {
    readonly label: string;
    readonly reporting: string;
    readonly stored: string;
    readonly alerts: string;
  };
  readonly alerts: {
    readonly title: string;
    readonly intro: string;
    /** The start of the figure's name; the totals and the busiest day follow. */
    readonly figure: string;
    /** The visually hidden data table's caption. */
    readonly table: string;
    readonly days: readonly string[];
    readonly kinds: readonly { readonly name: string; readonly values: readonly number[] }[];
  };
  readonly gauges: {
    readonly title: string;
    readonly intro: string;
    readonly columns: {
      readonly place: string;
      readonly level: string;
      readonly change: string;
      readonly battery: string;
      readonly report: string;
      readonly state: string;
    };
    readonly states: Readonly<Record<GaugeState, string>>;
    readonly readings: readonly GaugeReading[];
    readonly empty: string;
  };
  readonly exports: {
    readonly title: string;
    readonly empty: { readonly title: string; readonly body: string; readonly action: string };
  };
  /** The toast's sentence, which holds the `person` slot, and its dismiss button's name. */
  readonly toast: { readonly text: Rich; readonly dismiss: string };
};

const DASHBOARD_REAL: CanvasCopy = frozen<CanvasCopy>({
  title: "Moorings this week",
  word: "hard",
  person: "Tamsin Rook",
  amount: "48,212",
  items: [...SAMPLE_PLACES],
  label: "Spring",
});

export const DASHBOARD_TEXT: DashboardText = frozen<DashboardText>({
  brand: "Saltmarsh",
  sample: "sample",
  navLabel: "Console, sample",
  nav: [
    { label: "Overview", to: "top" },
    { label: "Alerts", to: "alerts" },
    { label: "Gauges", to: "gauges" },
    { label: "Exports", to: "exports" },
  ],
  crew: { name: "Samphire crew", plan: "Crew plan, sample" },
  command: { label: "Search or run a command", hint: "⌘K" },
  filters: {
    label: "Filters",
    range: "Range",
    ranges: ["Week", "Month", "Season"],
    chips: ["Reporting", "Late", "Offline"],
  },
  lead: {
    label: "Water now",
    place: SAMPLE_PLACES[0],
    note: ["The ", { slot: "word" }, " dries at low water. Sample readings."],
    falling: "Falling to low water",
    rising: "Rising to high water",
  },
  stats: {
    label: "This week",
    reporting: "Gauges reporting",
    stored: "Readings stored",
    alerts: "Alerts sent",
  },
  alerts: {
    title: "Alerts this week",
    intro: "Sample alerts sent to the crew, by kind.",
    figure: "Alerts this week by kind, sample",
    table: "Alerts this week by kind and day, sample",
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    kinds: [
      { name: "High water", values: [4, 5, 3, 6, 4, 5, 3] },
      { name: "Low water", values: [3, 4, 4, 5, 3, 4, 4] },
      { name: "Draft clear", values: [5, 3, 6, 7, 2, 6, 5] },
      { name: "Gauge late", values: [1, 0, 2, 4, 1, 0, 1] },
      { name: "Battery low", values: [0, 1, 0, 2, 0, 1, 0] },
    ],
  },
  gauges: {
    title: "Gauges",
    intro: "The gauge at each saved mooring, with sample readings.",
    columns: {
      place: "Mooring",
      level: "Level, m",
      change: "1 h, m",
      battery: "Battery",
      report: "Report",
      state: "State",
    },
    states: { reporting: "Reporting", late: "Late", offline: "Offline" },
    // The first gauge is the lead KPI's place: it reads the sample tide at 09:30 (section 6.12).
    readings: [
      { level: 2.5, change: -0.8, battery: 86, report: "09:28", state: "reporting" },
      { level: 2.3, change: -0.7, battery: 72, report: "09:26", state: "reporting" },
      { level: 3.0, change: -0.6, battery: 41, report: "08:52", state: "late" },
      { level: 2.7, change: 0.9, battery: 9, report: "04:10", state: "offline" },
    ],
    empty: "No gauges at your moorings yet. Add one from a mooring's tide table.",
  },
  exports: {
    title: "Exports",
    empty: {
      title: "No exports yet",
      body: "Export a week of readings as a file to share with your harbor office.",
      action: "Export readings",
    },
  },
  toast: { text: ["Sample: ", { slot: "person" }, " saved the alert rules."], dismiss: "Dismiss" },
});

// ── The settings: the console's settings (section 7.7) ────────────────────────────────────────

/** The settings' sections, the targets of its section links. */
export type SettingsSection = "profile" | "boat" | "moorings" | "alerts" | "console" | "danger";

/** A text field's label, value and placeholder; a hint or a message where the field has one. */
type FieldText = {
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
  readonly hint?: string;
  readonly message?: string;
};

export type SettingsText = {
  readonly brand: string;
  readonly sample: string;
  readonly intro: string;
  readonly navLabel: string;
  readonly sections: readonly {
    readonly key: SettingsSection;
    readonly title: string;
    readonly intro: string;
  }[];
  readonly profile: {
    readonly role: string;
    readonly name: FieldText;
    readonly email: FieldText;
    readonly password: FieldText;
  };
  readonly boat: {
    /** Shown in the forced focus state. */
    readonly name: FieldText;
    /** Shown invalid, with its message. */
    readonly callSign: FieldText;
    readonly draft: FieldText & { readonly step: number; readonly min: number };
    /** The color input's label; its hint holds the `word` slot. */
    readonly color: { readonly label: string; readonly hint: Rich };
  };
  readonly moorings: {
    /** Shown valid, with its message. */
    readonly home: FieldText;
    readonly units: { readonly label: string; readonly options: readonly string[] };
    readonly watch: { readonly legend: string; readonly empty: string };
  };
  readonly alerts: {
    readonly lead: {
      readonly label: string;
      readonly min: number;
      readonly max: number;
      readonly step: number;
      readonly value: number;
      readonly unit: string;
    };
    readonly channel: {
      readonly legend: string;
      readonly options: readonly string[];
      readonly value: string;
    };
    readonly kinds: {
      readonly legend: string;
      readonly options: readonly string[];
      readonly checked: readonly string[];
    };
    readonly quiet: string;
    readonly season: { readonly label: string; readonly value: string };
    readonly notes: FieldText;
  };
  readonly console: {
    /** Shown read-only. */
    readonly id: FieldText;
    /** Shown disabled. */
    readonly harbor: FieldText;
    readonly plan: {
      readonly name: string;
      readonly currency: string;
      readonly per: string;
      readonly action: string;
    };
  };
  readonly danger: {
    readonly body: string;
    readonly action: string;
    readonly dialog: {
      readonly title: string;
      readonly body: string;
      readonly cancel: string;
      readonly confirm: string;
    };
  };
  readonly save: { readonly note: string; readonly discard: string; readonly save: string };
};

const SETTINGS_REAL: CanvasCopy = frozen<CanvasCopy>({
  title: "Console settings",
  word: "chart",
  person: "Maren Holt",
  amount: "6.50",
  items: SAMPLE_PLACES.slice(0, 3),
  label: "Crew",
});

export const SETTINGS_TEXT: SettingsText = frozen<SettingsText>({
  brand: "Saltmarsh",
  sample: "sample",
  intro: "Sample settings for one console. Nothing here leaves this preview.",
  navLabel: "Settings sections",
  sections: [
    { key: "profile", title: "Profile", intro: "How your crew sees you." },
    { key: "boat", title: "Boat", intro: "The boat the alerts are for." },
    { key: "moorings", title: "Moorings", intro: "Where you sail from." },
    { key: "alerts", title: "Alerts", intro: "When and how Saltmarsh tells you." },
    { key: "console", title: "Console", intro: "The console and its plan." },
    { key: "danger", title: "Danger zone", intro: "Changes you cannot undo." },
  ],
  profile: {
    role: "Owner of this console",
    name: { label: "Display name", value: "Maren Holt", placeholder: "Your name…" },
    email: {
      label: "Email",
      value: "maren@saltmarsh.example",
      placeholder: "name@example.com…",
    },
    password: {
      label: "Password",
      value: "sample-password",
      placeholder: "At least 12 characters…",
      hint: "At least 12 characters.",
    },
  },
  boat: {
    name: { label: "Boat name", value: "Curlew", placeholder: "Curlew…" },
    callSign: {
      label: "Call sign",
      value: "MX-45",
      placeholder: "MX4512…",
      message: "Use letters and digits only, such as MX4512.",
    },
    draft: {
      label: "Draft, in meters",
      value: "1.4",
      placeholder: "1.4…",
      hint: "The depth of the keel below the water.",
      step: 0.1,
      min: 0,
    },
    color: {
      label: "Marker color",
      hint: ["The color of your boat's marker on the ", { slot: "word" }, "."],
    },
  },
  moorings: {
    home: {
      label: "Home mooring",
      value: SAMPLE_PLACES[0],
      placeholder: "A mooring's name…",
      message: "Found on the tide map.",
    },
    units: { label: "Units", options: ["Meters", "Feet"] },
    watch: {
      legend: "Moorings to watch",
      empty: "No moorings saved yet. Save one from its tide table.",
    },
  },
  alerts: {
    lead: {
      label: "Warn me before high water",
      min: 15,
      max: 120,
      step: 15,
      value: 45,
      unit: "min",
    },
    channel: {
      legend: "Send alerts by",
      options: ["Push", "Email", "Text message"],
      value: "Push",
    },
    kinds: {
      legend: "Alert me about",
      options: ["High water", "Low water", "A gauge that goes quiet"],
      checked: ["High water", "A gauge that goes quiet"],
    },
    quiet: "Quiet hours at night",
    season: { label: "Season starts", value: "2026-03-01" },
    notes: {
      label: "Notes for the crew",
      value: "Check the forecast before you cast off.",
      placeholder: "A note your crew sees with each alert…",
    },
  },
  console: {
    id: { label: "Console ID", value: "sm-4f2a-0911", placeholder: "" },
    harbor: {
      label: "Harbor code",
      value: "HX-07",
      placeholder: "",
      hint: "Set by your harbor office.",
    },
    plan: { name: "Crew plan", currency: "$", per: "a month, sample price", action: "Change plan" },
  },
  danger: {
    body: "Delete this console, its gauges and every reading they hold. In this sample, nothing is deleted.",
    action: "Delete console",
    dialog: {
      title: "Delete this console?",
      body: "The console, its gauges and every reading go for good. In this sample, nothing is deleted.",
      cancel: "Cancel",
      confirm: "Delete console",
    },
  },
  save: {
    note: "Sample changes stay in this preview.",
    discard: "Discard",
    save: "Save changes",
  },
});

// ── Which copy a template shows ───────────────────────────────────────────────────────────────

/** The templates whose copy lives here; the mobile template joins with Task 2.10. */
export const COPY_OWNERS = Object.freeze([
  "kitchen-sink",
  "landing",
  "editorial",
  "dashboard",
  "settings",
] as const);
export type CopyOwner = (typeof COPY_OWNERS)[number];

const KINDS: readonly CopyKind[] = Object.freeze(["real", "edge"]);

const REAL: Readonly<Record<CopyOwner, CanvasCopy>> = Object.freeze({
  "kitchen-sink": COPY.real,
  landing: LANDING_REAL,
  editorial: EDITORIAL_REAL,
  dashboard: DASHBOARD_REAL,
  settings: SETTINGS_REAL,
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
