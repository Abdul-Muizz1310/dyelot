import { excerptText, RECEIPT_EXCERPT, RECEIPT_LINES, receiptLines } from "./receipt";

const PRE =
  "m-0 whitespace-pre-wrap break-words rounded-lg border border-border bg-panel p-4 font-mono text-xs [overflow-wrap:anywhere]";
const CAPTION = "font-mono text-xs text-fg-muted";
const FIGURE = "m-0 min-w-0 space-y-2";

/** The landing's receipt section (R6-29, 9.2): three parts of one receipt and the checker's command. */
export function ReceiptSection() {
  const [opening, summary, contrast, finding, checker, closing] = receiptLines(RECEIPT_EXCERPT);
  return (
    <section aria-labelledby="receipt-heading" data-receipt className="space-y-5">
      <h2 id="receipt-heading" className="font-mono text-2xl font-semibold tracking-tight">
        {RECEIPT_LINES.heading}
      </h2>
      <p className="text-fg-muted">{opening}</p>
      <figure data-excerpt="summary" className={FIGURE}>
        <figcaption className={CAPTION}>{summary}</figcaption>
        <pre className={PRE}>{excerptText(RECEIPT_EXCERPT.summary)}</pre>
      </figure>
      <figure data-excerpt="contrast" className={FIGURE}>
        <figcaption className={CAPTION}>{contrast}</figcaption>
        <pre className={PRE}>{excerptText(RECEIPT_EXCERPT.contrast)}</pre>
      </figure>
      <figure data-excerpt="finding" className={FIGURE}>
        <figcaption className={CAPTION}>{finding}</figcaption>
        {RECEIPT_EXCERPT.finding === null ? null : (
          <pre className={PRE}>{excerptText(RECEIPT_EXCERPT.finding)}</pre>
        )}
      </figure>
      <p className="text-fg-muted">{checker}</p>
      <pre className={PRE}>{RECEIPT_LINES.command}</pre>
      <p className="text-fg-muted">{closing}</p>
    </section>
  );
}
