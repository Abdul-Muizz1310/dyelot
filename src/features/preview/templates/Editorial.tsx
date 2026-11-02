"use client";

import "./editorial.css";
import { CornerLeftUp, MapPin } from "lucide-react";
import { Fragment } from "react";
import { assertOneOf } from "@/features/studio/guards";
import type { View } from "@/features/studio/view";
import {
  type Block,
  type CanvasCopy,
  copyOf,
  type EditorialTarget,
  EDITORIAL_TEXT as TEXT,
} from "../copy";
import { Avatar, Badge, Entrance, type NoteIds, RichText, Skeins, TextLink } from "../kit";

// The editorial article (spec section 7.6): "The long thread", a sample essay on natural dyes, as a
// specimen of the design's reading type. A header that rises once (the one entrance), a table of
// contents, then the body at a 65-character measure with H2 to H4, a blockquote, inline code and a
// code block, a figure in the chart colors, footnotes and links (`primary`, underlined). A link moves
// focus inside the template and never touches the address bar (R2-20). Under edge-case copy the
// slots of R2-21 swap in.

const TARGETS: readonly EditorialTarget[] = ["roots", "blue", "record", "notes"];
const CONTENTS = "thread-contents";

const target = (to: EditorialTarget) => `thread-${to}`;
const noteIds = (n: number): NoteIds => ({ ref: `thread-ref-${n}`, note: `thread-note-${n}` });

/** The id a link in the article's text points at; a target outside the article is a RangeError. */
function link(to: string): string {
  assertOneOf(to, TARGETS, "Editorial: link target");
  return target(to);
}

export function Editorial({ view }: { view: View }) {
  const copy = copyOf("editorial", view.copy);
  return (
    <article
      data-template-root="editorial"
      className="ed kit-page"
      data-roles="background foreground"
    >
      <Entrance className="ed-head kit-wrap">
        <header className="ed-header">
          <p className="ed-kicker kit-t-label" data-roles="muted-foreground">
            <Badge tone="accent" copyLabel>
              {copy.label}
            </Badge>
            <span>{TEXT.kicker}</span>
          </p>
          <h1 className="ed-title kit-t-display kit-display" data-roles="foreground font-display">
            {copy.title}
          </h1>
          <p className="ed-standfirst kit-t-lead" data-roles="muted-foreground">
            <RichText runs={TEXT.standfirst} copy={copy} />
          </p>
          <div className="ed-byline" data-roles="foreground muted-foreground border">
            <Avatar person={copy.person} state="default" />
            <p className="ed-byline-text">
              <span className="ed-author kit-t-body-sm">
                {TEXT.by} {copy.person}
              </span>
              <span className="kit-t-caption">{TEXT.readingTime}</span>
            </p>
          </div>
        </header>
      </Entrance>
      <div className="ed-layout kit-wrap">
        <nav
          aria-labelledby={CONTENTS}
          className="ed-toc"
          data-roles="foreground muted-foreground border"
        >
          <h2 id={CONTENTS} className="ed-toc-title kit-t-label">
            {TEXT.contents}
          </h2>
          <ol className="ed-toc-list kit-t-body-sm">
            {TEXT.sections.map((section) => (
              <li key={section.key}>
                <TextLink to={target(section.key)}>{section.title}</TextLink>
              </li>
            ))}
            <li>
              <TextLink to={target("notes")}>{TEXT.notes.title}</TextLink>
            </li>
          </ol>
        </nav>
        <div className="ed-body" data-prose="">
          {TEXT.sections.map((section) => (
            <section key={section.key} aria-labelledby={target(section.key)} className="ed-section">
              <h2
                id={target(section.key)}
                tabIndex={-1}
                className="kit-t-h2 kit-display"
                data-roles="foreground font-display"
              >
                {section.title}
              </h2>
              {section.blocks.map((block, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the article is fixed copy; its blocks never move.
                <Fragment key={index}>
                  <BlockView block={block} copy={copy} />
                </Fragment>
              ))}
            </section>
          ))}
          <section
            aria-labelledby={target("notes")}
            className="ed-notes"
            data-roles="foreground border"
          >
            <h2
              id={target("notes")}
              tabIndex={-1}
              className="kit-t-h3 kit-display"
              data-roles="foreground font-display"
            >
              {TEXT.notes.title}
            </h2>
            <ol className="ed-note-list kit-t-body-sm" data-roles="muted-foreground">
              {TEXT.notes.items.map((runs, index) => {
                const ids = noteIds(index + 1);
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the notes are fixed copy, numbered by their place.
                  <li key={index} id={ids.note} tabIndex={-1}>
                    <RichText runs={runs} copy={copy} />{" "}
                    <TextLink
                      to={ids.ref}
                      label={`${TEXT.notes.back}, from note ${index + 1}`}
                      icon={<CornerLeftUp aria-hidden="true" />}
                    >
                      {TEXT.notes.back}
                    </TextLink>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>
      </div>
    </article>
  );
}

/** One block of the article's body; every kind of `Block` has its view. */
function BlockView({ block, copy }: { block: Block; copy: CanvasCopy }) {
  switch (block.kind) {
    case "p":
      return (
        <p className="ed-p kit-t-body">
          <RichText runs={block.runs} copy={copy} link={link} note={noteIds} />
        </p>
      );
    case "h3":
      return (
        <h3 className="ed-h3 kit-t-h3 kit-display" data-roles="foreground font-display">
          {block.text}
        </h3>
      );
    case "h4":
      return (
        <h4 className="ed-h4 kit-t-h4 kit-display" data-roles="foreground font-display">
          {block.text}
        </h4>
      );
    case "quote":
      return (
        <figure className="ed-quote" data-roles="foreground muted-foreground primary">
          <blockquote className="ed-quote-text kit-t-h3" data-roles="foreground font-display">
            <p>
              <RichText runs={block.runs} copy={copy} />
            </p>
          </blockquote>
          <figcaption className="kit-t-caption">{block.cite}</figcaption>
        </figure>
      );
    case "code":
      return (
        <figure className="ed-code" data-roles="muted-foreground">
          <figcaption className="kit-t-caption">{block.title}</figcaption>
          <pre className="kit-t-body-sm" data-roles="muted foreground border">
            <code>
              {block.lines.map((line, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a code block is fixed copy; its lines never move.
                <Fragment key={index}>
                  {index > 0 && "\n"}
                  <RichText runs={line} copy={copy} />
                </Fragment>
              ))}
            </code>
          </pre>
        </figure>
      );
    case "figure":
      return (
        <figure className="ed-figure">
          <Skeins label={block.label} />
          <figcaption className="kit-t-caption" data-roles="muted-foreground">
            <RichText runs={block.caption} copy={copy} />
          </figcaption>
        </figure>
      );
    case "places":
      return (
        <div className="ed-places">
          <h3 className="ed-h3 kit-t-h3 kit-display" data-roles="foreground font-display">
            {block.title}
          </h3>
          {copy.items.length === 0 ? (
            <p
              data-list=""
              data-empty=""
              className="kit-empty kit-t-body-sm"
              data-roles="muted muted-foreground"
            >
              {block.empty}
            </p>
          ) : (
            <ul
              data-list=""
              className="ed-place-list kit-t-body"
              data-roles="foreground primary border"
            >
              {copy.items.map((place) => (
                <li key={place} data-list-item="">
                  <MapPin aria-hidden="true" />
                  {place}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    default: {
      const unknown: never = block;
      throw new RangeError(`Editorial: no view for the block ${JSON.stringify(unknown)}`);
    }
  }
}
