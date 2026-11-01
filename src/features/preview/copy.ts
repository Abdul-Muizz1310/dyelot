// The canvas copy (spec R2-21, F-CANVAS-09): real sample copy for a fictional tide-reading app, and
// the edge-case copy that tests a layout: a 40-character unbroken word, a 90-character title, a name
// with diacritics, a large number, an empty list and a one-character label. Pure data.

export type CanvasCopy = {
  /** A card, dialog or sheet title. */
  readonly title: string;
  /** One word set in running text. */
  readonly word: string;
  /** A person's name: an avatar, a table cell. */
  readonly person: string;
  /** A number in a numeric column. */
  readonly amount: string;
  /** The rows of a list. */
  readonly items: readonly string[];
  /** A short label: a badge, a chip. */
  readonly label: string;
};

const EDGE_WORD = "Spritsailbargemooringandtidecalculations";

/** The fictional places of the sample copy: the one list every template reads them from. */
export const SAMPLE_PLACES = Object.freeze([
  "Samphire Bay",
  "Heron Staithe",
  "Gull Point",
  "Wrack Quay",
] as const);

export const COPY: Readonly<Record<"real" | "edge", CanvasCopy>> = Object.freeze({
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
