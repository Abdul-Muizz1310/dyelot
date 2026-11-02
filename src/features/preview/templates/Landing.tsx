"use client";

import "./landing.css";
import { CalendarDays, Check, Waves } from "lucide-react";
import type { View } from "@/features/studio/view";
import { type CanvasCopy, copyOf, type LandingTarget, LANDING_TEXT as TEXT } from "../copy";
import {
  Accordion,
  Avatar,
  Badge,
  Button,
  Entrance,
  Level,
  RichText,
  TextLink,
  TideCurve,
} from "../kit";

// The landing page (spec section 7.6): Saltmarsh, a fictional tide-reading app, as a specimen of the
// design. An asymmetric hero (the headline large on the left, one product moment on the right on a
// block of the primary color), the features as a list beside a second product moment, a quote, a
// pricing teaser, an FAQ and a footer. No logo row, no hero metric, no icon cards (research D4); one
// orchestrated entrance, the hero's. Every part names the roles it paints (`data-roles`), and text
// takes its step from a `.kit-t-<step>` class. Under edge-case copy the slots of R2-21 swap in.

const target = (to: LandingTarget) => `saltmarsh-${to}`;

/** "Now" on the sample day's curve: 09:30. */
const NOW = 9.5;

export function Landing({ view }: { view: View }) {
  const copy = copyOf("landing", view.copy);
  return (
    <div data-template-root="landing" className="lp" data-roles="background foreground">
      <Nav />
      <section
        data-block="hero"
        aria-labelledby={target("top")}
        className="lp-hero lp-wrap"
        data-roles="background foreground"
      >
        <Entrance className="lp-hero-grid">
          <div className="lp-hero-copy">
            <h1
              id={target("top")}
              tabIndex={-1}
              className="lp-title kit-t-display kit-display"
              data-roles="foreground font-display"
            >
              {copy.title}
            </h1>
            <p className="lp-lead kit-t-lead" data-roles="muted-foreground">
              <RichText runs={TEXT.hero.lead} copy={copy} />
            </p>
            <div className="lp-actions">
              <Button variant="primary">{TEXT.hero.start}</Button>
              <Button variant="ghost" icon={<CalendarDays aria-hidden="true" />}>
                {TEXT.hero.sampleDay}
              </Button>
            </div>
          </div>
          <div className="lp-hero-moment">
            <span aria-hidden="true" className="lp-slab" data-roles="primary" />
            <Today copy={copy} />
          </div>
        </Entrance>
      </section>
      <Features copy={copy} />
      <Quote copy={copy} />
      <Pricing copy={copy} />
      <section
        data-block="faq"
        aria-labelledby={target("faq")}
        className="lp-faq lp-wrap"
        data-roles="background foreground"
      >
        <div className="lp-section-head">
          <h2
            id={target("faq")}
            tabIndex={-1}
            className="kit-t-h2 kit-display"
            data-roles="foreground font-display"
          >
            {TEXT.faq.title}
          </h2>
          <p className="kit-t-body kit-muted" data-roles="muted-foreground">
            {TEXT.faq.intro}
          </p>
        </div>
        <Accordion items={TEXT.faq.items} idPrefix="saltmarsh-question" />
      </section>
      <Footer />
    </div>
  );
}

function Brand() {
  return (
    <span className="lp-brand kit-t-body kit-display" data-roles="foreground font-display">
      <Waves aria-hidden="true" />
      {TEXT.brand}
    </span>
  );
}

function Nav() {
  return (
    <nav aria-label="Saltmarsh, sample" className="lp-nav lp-wrap" data-roles="foreground border">
      <span className="lp-nav-brand">
        <Brand />
        <Badge tone="neutral">{TEXT.sample}</Badge>
      </span>
      <ul className="lp-nav-links kit-t-body-sm">
        {TEXT.nav.map((link) => (
          <li key={link.to}>
            <TextLink to={target(link.to)} tone="quiet">
              {link.label}
            </TextLink>
          </li>
        ))}
      </ul>
      <span className="lp-nav-action">
        <Button variant="ghost">{TEXT.signIn}</Button>
      </span>
    </nav>
  );
}

/** The hero's product moment: today's tide at the first sample place. */
function Today({ copy }: { copy: CanvasCopy }) {
  const { today } = TEXT;
  return (
    <div className="lp-today" data-roles="card card-foreground border">
      <div className="lp-today-head">
        <p className="lp-card-title">
          <span className="kit-t-body kit-display" data-roles="card-foreground font-display">
            {today.place}
          </span>
          <span className="kit-t-caption">{today.note}</span>
        </p>
        <Badge tone="accent" copyLabel>
          {copy.label}
        </Badge>
      </div>
      <div className="lp-curve">
        <TideCurve label={today.figure} now={NOW} />
      </div>
      <ol aria-hidden="true" className="lp-hours kit-mono kit-t-caption">
        {today.hours.map((hour) => (
          <li key={hour}>{hour}</li>
        ))}
      </ol>
      <dl className="lp-events">
        {today.events.map((event) => (
          <div key={event.time} className="lp-event">
            <dt className="kit-t-body-sm">{event.name}</dt>
            <dd className="lp-event-values kit-mono kit-t-body-sm">
              <span className="kit-num">{event.time}</span>
              <span className="kit-num">{event.meters.toFixed(1)} m</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Features({ copy }: { copy: CanvasCopy }) {
  const { features } = TEXT;
  return (
    <section
      data-block="features"
      aria-labelledby={target("features")}
      className="lp-features lp-wrap"
      data-roles="background foreground"
    >
      <div className="lp-section-head">
        <h2
          id={target("features")}
          tabIndex={-1}
          className="kit-t-h2 kit-display"
          data-roles="foreground font-display"
        >
          {features.title}
        </h2>
        <p className="kit-t-body kit-muted" data-roles="muted-foreground">
          {features.intro}
        </p>
      </div>
      <div className="lp-features-row">
        <div data-moment="" className="lp-features-moment">
          <Moorings copy={copy} />
        </div>
        <ul data-feature-list="" className="lp-feature-list" data-roles="foreground border">
          {features.items.map((item) => (
            <li key={item.title}>
              <h3 className="kit-t-h4 kit-display" data-roles="foreground font-display">
                {item.title}
              </h3>
              <p className="kit-t-body-sm" data-roles="muted-foreground">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The features' product moment: the next high water at each saved mooring. */
function Moorings({ copy }: { copy: CanvasCopy }) {
  const { moorings } = TEXT;
  return (
    <div className="lp-moorings" data-roles="card card-foreground border">
      <p className="lp-card-title">
        <span className="kit-t-body kit-display" data-roles="card-foreground font-display">
          {moorings.title}
        </span>
        <span className="kit-t-caption">{moorings.note}</span>
      </p>
      {copy.items.length === 0 ? (
        <p
          data-list=""
          data-empty=""
          className="lp-empty kit-t-body-sm"
          data-roles="muted muted-foreground"
        >
          {moorings.empty}
        </p>
      ) : (
        <table data-list="" className="lp-table kit-t-body-sm">
          <thead>
            <tr>
              <th scope="col" className="kit-t-caption">
                {moorings.place}
              </th>
              <th scope="col" className="lp-figure-col kit-t-caption">
                {moorings.time}
              </th>
              <th scope="col" className="lp-figure-col kit-t-caption">
                {moorings.height}
              </th>
            </tr>
          </thead>
          <tbody>
            {copy.items.map((place, index) => {
              const reading = moorings.readings[index];
              if (reading === undefined) {
                throw new RangeError(`Landing: no sample reading for mooring ${index + 1}`);
              }
              const next = index === 0;
              return (
                <tr
                  key={place}
                  data-list-item=""
                  data-next={next ? "" : undefined}
                  data-roles={next ? "accent accent-foreground border" : "card-foreground border"}
                >
                  <td className="lp-place">{place}</td>
                  <td className="lp-figure-col kit-num kit-mono">{reading.time}</td>
                  <td className="lp-figure-col">
                    <span className="lp-height">
                      <span className="kit-num kit-mono">{reading.meters.toFixed(1)} m</span>
                      <Level value={reading.meters} max={moorings.range} />
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Quote({ copy }: { copy: CanvasCopy }) {
  return (
    <figure className="lp-quote lp-wrap" data-roles="background foreground border">
      <span
        aria-hidden="true"
        className="lp-quote-mark kit-t-display kit-display"
        data-roles="primary font-display"
      >
        “
      </span>
      <blockquote className="lp-quote-text kit-t-h3" data-roles="foreground font-display">
        <p>{TEXT.quote.text}</p>
      </blockquote>
      <figcaption className="lp-quote-by">
        <Avatar person={copy.person} state="default" />
        <span className="lp-quote-who">
          <span className="lp-quote-name kit-t-body-sm" data-roles="foreground">
            {copy.person}
          </span>
          <span className="kit-t-caption kit-muted" data-roles="muted-foreground">
            {TEXT.quote.role}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

function Pricing({ copy }: { copy: CanvasCopy }) {
  const { pricing } = TEXT;
  return (
    <section
      data-block="pricing"
      aria-labelledby={target("pricing")}
      className="lp-pricing lp-wrap"
      data-roles="background foreground"
    >
      <div className="lp-band" data-roles="muted foreground">
        <div className="lp-pricing-copy">
          <h2
            id={target("pricing")}
            tabIndex={-1}
            className="kit-t-h2 kit-display"
            data-roles="foreground font-display"
          >
            {pricing.title}
          </h2>
          <p className="kit-t-body kit-muted" data-roles="muted-foreground">
            {pricing.body}
          </p>
        </div>
        <div className="lp-plan" data-roles="background foreground border">
          <p className="lp-plan-name kit-t-label">{pricing.plan}</p>
          <p className="lp-price">
            <span className="lp-price-figure kit-num kit-t-h3">
              {pricing.currency}
              {copy.amount}
            </span>
            <span className="kit-t-body-sm" data-roles="muted-foreground">
              {pricing.per}
            </span>
          </p>
          <ul className="lp-includes kit-t-body-sm" data-roles="foreground primary">
            {pricing.includes.map((line) => (
              <li key={line}>
                <Check aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
          <Button variant="secondary">{pricing.action}</Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="lp-footer lp-wrap" data-roles="foreground muted-foreground border">
      <Brand />
      <p className="lp-footer-note kit-t-caption">{TEXT.footer.note}</p>
      <ul className="lp-footer-links kit-t-body-sm">
        {[...TEXT.nav, { label: TEXT.footer.top, to: "top" as const }].map((link) => (
          <li key={link.to}>
            <TextLink to={target(link.to)} tone="quiet">
              {link.label}
            </TextLink>
          </li>
        ))}
      </ul>
    </footer>
  );
}
