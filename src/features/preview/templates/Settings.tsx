"use client";

import "./settings.css";
import { Waves } from "lucide-react";
import { type ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { View } from "@/features/studio/view";
import type { DesignSpec } from "@/spec";
import { themeVars } from "@/theme/vars";
import { type CanvasCopy, copyOf, type SettingsSection, SETTINGS_TEXT as TEXT } from "../copy";
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  CheckboxGroup,
  ColorField,
  ConfirmDialog,
  Entrance,
  Input,
  RadioGroup,
  RichText,
  Select,
  Slider,
  Switch,
  Textarea,
  TextLink,
} from "../kit";

// The settings (spec section 7.7): the console's settings as an app window of its own height. The
// form scrolls inside a scroll area the template owns, and the save bar sticks to that area's
// bottom, never to the canvas region, whose scroll the fit's scale would make it drift against.
// Every input type of the section with a visible label, the text input in its six states, and a
// danger zone whose button opens a contained confirm dialog; the rest of the template is inert
// while it is open, and focus returns to the button when it closes. Under edge-case copy the slots
// of R2-21 swap in.

const target = (to: SettingsSection) => `settings-${to}`;
const TITLE = "settings-title";

/** A section's title and sentence; a key the copy does not list is a bug in the template (RangeError). */
function sectionOf(key: SettingsSection): (typeof TEXT.sections)[number] {
  const section = TEXT.sections.find((entry) => entry.key === key);
  if (section === undefined) throw new RangeError(`Settings: no section ${key} in the copy`);
  return section;
}

export function Settings({ spec, view }: { spec: DesignSpec; view: View }) {
  const copy = copyOf("settings", view.copy);
  const [confirming, setConfirming] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  // Closing gives focus back to the danger zone's button, once the rest is no longer inert.
  useLayoutEffect(() => {
    if (confirming) {
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      opener.current?.focus();
    }
  }, [confirming]);
  return (
    <div data-template-root="settings" className="st" data-roles="background foreground">
      <div className="st-shell" inert={confirming}>
        <header className="st-top" data-roles="background foreground border">
          <span className="st-brand kit-t-body kit-display" data-roles="foreground font-display">
            <Waves aria-hidden="true" />
            {TEXT.brand}
          </span>
          <Badge tone="neutral">{TEXT.sample}</Badge>
        </header>
        <div className="st-body">
          <nav aria-label={TEXT.navLabel} className="st-nav" data-roles="foreground border">
            <ul className="kit-t-body-sm">
              {TEXT.sections.map((section) => (
                <li key={section.key}>
                  <TextLink to={target(section.key)} tone="quiet">
                    {section.title}
                  </TextLink>
                </li>
              ))}
            </ul>
          </nav>
          <div data-scroll-area="" className="st-scroll">
            <Entrance className="st-intro">
              <h1
                id={TITLE}
                tabIndex={-1}
                className="kit-t-h3 kit-display"
                data-roles="foreground font-display"
              >
                {copy.title}
              </h1>
              <p className="kit-t-body-sm kit-muted" data-roles="muted-foreground font-body">
                {TEXT.intro}
              </p>
            </Entrance>
            <form
              aria-labelledby={TITLE}
              className="st-form"
              noValidate
              onSubmit={(event) => event.preventDefault()}
            >
              <Profile copy={copy} />
              <Boat copy={copy} spec={spec} view={view} />
              <Moorings copy={copy} />
              <Alerts />
              <Console copy={copy} />
              <Section
                to="danger"
                className="st-danger"
                roles="background foreground border destructive"
              >
                <p className="kit-t-body-sm" data-roles="foreground font-body">
                  {TEXT.danger.body}
                </p>
                <Button variant="destructive" ref={opener} onPress={() => setConfirming(true)}>
                  {TEXT.danger.action}
                </Button>
              </Section>
              <div
                data-save-bar=""
                className="st-save-bar"
                data-roles="background foreground muted-foreground border font-body"
              >
                <p className="kit-t-body-sm kit-muted">{TEXT.save.note}</p>
                <span className="st-save-actions">
                  <Button variant="ghost">{TEXT.save.discard}</Button>
                  <Button variant="primary">{TEXT.save.save}</Button>
                </span>
              </div>
            </form>
          </div>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog
          title={TEXT.danger.dialog.title}
          body={TEXT.danger.dialog.body}
          cancel={TEXT.danger.dialog.cancel}
          confirm={TEXT.danger.dialog.confirm}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

/** A section of the form: an `h2` the section links focus, its muted sentence and its fields. */
function Section({
  to,
  className,
  roles = "background foreground border",
  children,
}: {
  to: SettingsSection;
  className?: string;
  roles?: string;
  children: ReactNode;
}) {
  const { title, intro } = sectionOf(to);
  return (
    <section
      aria-labelledby={target(to)}
      className={className === undefined ? "st-section" : `st-section ${className}`}
      data-roles={roles}
    >
      <div className="st-section-head">
        <h2
          id={target(to)}
          tabIndex={-1}
          className="kit-t-h4 kit-display"
          data-roles="foreground font-display"
        >
          {title}
        </h2>
        <p className="kit-t-body-sm kit-muted" data-roles="muted-foreground font-body">
          {intro}
        </p>
      </div>
      {children}
    </section>
  );
}

function Profile({ copy }: { copy: CanvasCopy }) {
  const { profile } = TEXT;
  return (
    <Section to="profile">
      <div className="st-person" data-roles="foreground muted-foreground font-body">
        <Avatar person={copy.person} state="default" />
        <p className="st-person-text">
          <span className="st-person-name kit-t-body">{copy.person}</span>
          <span className="kit-t-caption kit-muted">{profile.role}</span>
        </p>
      </div>
      <div className="st-fields">
        <Input {...profile.name} state="default" name="display-name" autoComplete="name" />
        <Input
          {...profile.email}
          type="email"
          state="default"
          name="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
        />
        <Input
          {...profile.password}
          type="password"
          state="default"
          name="password"
          autoComplete="current-password"
        />
      </div>
    </Section>
  );
}

function Boat({ copy, spec, view }: { copy: CanvasCopy; spec: DesignSpec; view: View }) {
  const { boat } = TEXT;
  // The marker starts at the design's first chart color, under the view's vision, until the reader
  // picks one; the picked color is the field's own state (R2-20).
  const chart = useMemo(
    () =>
      themeVars(spec, view.mode, view.vision === "none" ? {} : { vision: view.vision })[
        "--chart-1"
      ],
    [spec, view.mode, view.vision],
  );
  const [picked, setPicked] = useState<string | null>(null);
  if (chart === undefined) throw new RangeError("Settings: the design has no --chart-1");
  return (
    <Section to="boat">
      <div className="st-fields">
        <Input {...boat.name} state="focus-visible" name="boat-name" autoComplete="off" />
        <Input
          {...boat.callSign}
          state="invalid"
          name="call-sign"
          autoComplete="off"
          spellCheck={false}
          messages={{ invalid: boat.callSign.message }}
        />
        <Input
          {...boat.draft}
          type="number"
          state="default"
          name="draft"
          inputMode="decimal"
          autoComplete="off"
        />
        <ColorField
          label={boat.color.label}
          value={picked ?? chart}
          swatchRole={picked === null ? "chart-1" : undefined}
          hint={<RichText runs={boat.color.hint} copy={copy} />}
          onChange={setPicked}
        />
      </div>
    </Section>
  );
}

function Moorings({ copy }: { copy: CanvasCopy }) {
  const { moorings } = TEXT;
  return (
    <Section to="moorings">
      <div className="st-fields">
        <Input
          {...moorings.home}
          state="success"
          name="home-mooring"
          autoComplete="off"
          messages={{ success: moorings.home.message }}
        />
        <Select label={moorings.units.label} state="default" options={moorings.units.options} />
      </div>
      <fieldset className="kit-fieldset">
        <legend className="kit-legend kit-t-label" data-roles="foreground font-body">
          {moorings.watch.legend}
        </legend>
        {copy.items.length === 0 ? (
          <p
            data-list=""
            data-empty=""
            className="kit-empty kit-t-body-sm"
            data-roles="muted muted-foreground"
          >
            {moorings.watch.empty}
          </p>
        ) : (
          <ul data-list="" className="st-watch">
            {copy.items.map((place, index) => (
              <li key={place} data-list-item="">
                <Checkbox label={place} state={index < 2 ? "selected" : "default"} />
              </li>
            ))}
          </ul>
        )}
      </fieldset>
    </Section>
  );
}

function Alerts() {
  const { alerts } = TEXT;
  return (
    <Section to="alerts">
      <div className="st-fields">
        <Slider {...alerts.lead} />
        <Input
          label={alerts.season.label}
          value={alerts.season.value}
          placeholder=""
          type="date"
          state="default"
          name="season"
          autoComplete="off"
        />
        <RadioGroup {...alerts.channel} />
        <CheckboxGroup {...alerts.kinds} />
        <div className="st-switch">
          <Switch label={alerts.quiet} state="selected" />
        </div>
        <Textarea {...alerts.notes} state="default" />
      </div>
    </Section>
  );
}

function Console({ copy }: { copy: CanvasCopy }) {
  const { console: settings } = TEXT;
  const { plan } = settings;
  return (
    <Section to="console">
      <div className="st-fields">
        <Input {...settings.id} state="read-only" name="console-id" autoComplete="off" />
        <Input {...settings.harbor} state="disabled" name="harbor-code" autoComplete="off" />
      </div>
      <div className="st-plan" data-roles="foreground muted-foreground border">
        <p className="st-plan-name kit-t-body" data-roles="foreground font-body">
          {plan.name}
          <Badge tone="accent" copyLabel>
            {copy.label}
          </Badge>
        </p>
        <p className="st-price">
          <span className="kit-num kit-t-h4 kit-display" data-roles="foreground font-display">
            {plan.currency}
            {copy.amount}
          </span>
          <span className="kit-t-body-sm kit-muted" data-roles="muted-foreground font-body">
            {plan.per}
          </span>
        </p>
        <Button variant="secondary">{plan.action}</Button>
      </div>
    </Section>
  );
}
