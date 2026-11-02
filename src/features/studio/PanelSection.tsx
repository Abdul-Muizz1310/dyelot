import { type ReactNode, type RefObject, useId } from "react";

// One labeled region of the inspector (spec section 7.8): a heading in the house's small mono caps,
// an optional note under it, and the section's content. The region takes the heading's text as its
// name, so "Scales" is a region named "Scales".

export function PanelSection({
  title,
  note,
  sectionRef,
  headingRef,
  first = false,
  children,
}: {
  title: string;
  note?: ReactNode;
  sectionRef?: RefObject<HTMLElement | null>;
  /** A heading that can take focus (`tabindex="-1"`), for a section that hands focus back to it. */
  headingRef?: RefObject<HTMLHeadingElement | null>;
  /** The panel's first section: no rule and no space above it. */
  first?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      ref={sectionRef}
      aria-labelledby={id}
      className={first ? "space-y-3" : "mt-5 space-y-3 border-border border-t pt-4"}
    >
      <div className="space-y-1">
        <h3
          id={id}
          ref={headingRef}
          tabIndex={headingRef === undefined ? undefined : -1}
          className="font-mono text-fg-muted text-xs lowercase tracking-[0.08em]"
        >
          {title}
        </h3>
        {note !== undefined && (
          <p className="text-[11px] text-fg-muted leading-snug text-pretty">{note}</p>
        )}
      </div>
      {children}
    </section>
  );
}
