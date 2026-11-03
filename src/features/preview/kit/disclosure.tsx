"use client";

import "./disclosure.css";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

// The kit's accordion (spec section 7.6, F-TPL-21): each question is a button in an `h3` with
// `aria-expanded` and `aria-controls`, and its answer a panel that is hidden while closed. The open
// items are the accordion's own state (R2-20), kept here, the parent of every item, so a view toggle
// never resets them. Only the chevron moves, by a CSS transition the reduced-motion rules stop.

export type AccordionItem = { readonly question: string; readonly answer: string };

/** An accordion whose first item starts open; `idPrefix` makes its ids unique in the template. */
export function Accordion({
  items,
  idPrefix,
}: {
  items: readonly AccordionItem[];
  idPrefix: string;
}) {
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([0]));
  const toggle = (index: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (!next.delete(index)) next.add(index);
      return next;
    });
  return (
    <div className="kit-accordion" data-roles="border">
      {items.map((item, index) => {
        const expanded = open.has(index);
        const trigger = `${idPrefix}-q${index}`;
        const panel = `${idPrefix}-a${index}`;
        return (
          <div key={item.question} className="kit-accordion-item">
            <h3 className="kit-accordion-heading">
              <button
                type="button"
                id={trigger}
                aria-expanded={expanded}
                aria-controls={panel}
                className="kit-accordion-trigger kit-t-h4 kit-display"
                data-roles="foreground muted font-display"
                onClick={() => toggle(index)}
              >
                <span>{item.question}</span>
                <ChevronDown aria-hidden="true" />
              </button>
            </h3>
            <div
              id={panel}
              hidden={!expanded}
              className="kit-accordion-panel kit-t-body"
              data-roles="muted-foreground font-body"
            >
              <p>{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
