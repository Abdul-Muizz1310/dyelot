import type { ReactNode } from "react";

// A section of a kitchen-sink pane, under its heading (spec section 7.5).

/** A section of a pane, under its heading. Not a landmark: each pane repeats every section. */
export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="sink-section">
      <h3 className="kit-t-h3">{title}</h3>
      {note !== undefined && <p className="sink-note kit-t-body-sm">{note}</p>}
      {children}
    </div>
  );
}
