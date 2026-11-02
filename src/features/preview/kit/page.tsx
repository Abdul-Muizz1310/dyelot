import "./page.css";

// The kit's page parts (spec section 7.6): a section's head, an `h2` that in-page links can focus and
// a muted sentence under it. The layout classes `.kit-page` and `.kit-wrap` live in page.css.

export function SectionHead({
  id,
  title,
  intro,
  className,
}: {
  id: string;
  title: string;
  intro: string;
  /** A class of the template's own, for a head that sits somewhere special. */
  className?: string;
}) {
  return (
    <div className={className === undefined ? "kit-section-head" : `kit-section-head ${className}`}>
      <h2
        id={id}
        tabIndex={-1}
        className="kit-t-h2 kit-display"
        data-roles="foreground font-display"
      >
        {title}
      </h2>
      <p className="kit-t-body kit-muted" data-roles="muted-foreground">
        {intro}
      </p>
    </div>
  );
}
