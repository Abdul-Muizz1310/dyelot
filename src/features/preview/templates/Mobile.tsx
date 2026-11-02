"use client";

import "./mobile.css";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Search,
  Share2,
  Users,
  Waves,
} from "lucide-react";
import { type ReactNode, type RefObject, useId, useLayoutEffect, useRef, useState } from "react";
import type { View } from "@/features/studio/view";
import {
  type CanvasCopy,
  copyOf,
  DASHBOARD_TEXT,
  type GaugeState,
  type MobileTab,
  SAMPLE_PLACES,
  MOBILE_TEXT as TEXT,
} from "../copy";
import { signed } from "../format";
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Entrance,
  IconButton,
  Level,
  PhoneScreen,
  RadioGroup,
  RichText,
  Switch,
  TabBar,
  TextLink,
  TideCurve,
  type Tone,
} from "../kit";
import { clock, TIDE_EVENTS, TIDE_RANGE, type TideEvent, tideAt } from "../tide";

// The mobile template (spec section 7.7): Saltmarsh's phone app, fictional and labeled "sample", as
// three 360 px screens on a board: the feed, a mooring's detail with its bottom sheet, and the app's
// tab bar. Each screen is a size container named `frame` and a touch surface, whatever the canvas
// frame holds. While the sheet is open the rest of the template is inert, the other two screens
// included and dimmed, so `aria-modal` holds and no link moves focus into the inert detail; a press
// anywhere in the template outside the sheet keeps focus in it. The sheet's open state, the lead
// time saved and the one picked, and the selected tab live here, the template's root, so a view
// toggle keeps them. Under edge-case copy the slots of R2-21 swap in.

/** "Now" on the sample day's tide: 09:30, as on the landing's tide card and the console. */
const NOW = 9.5;

const target = (to: "today" | "detail" | "alert") => `mobile-${to}`;
const ids = (key: MobileTab) => ({ tab: `mobile-tab-${key}`, panel: `mobile-panel-${key}` });

const TAB_ICONS: Readonly<Record<MobileTab, ReactNode>> = {
  today: <CalendarDays aria-hidden="true" />,
  places: <MapPin aria-hidden="true" />,
  alerts: <Bell aria-hidden="true" />,
  crew: <Users aria-hidden="true" />,
};

const STATE_TONES: Readonly<Record<GaugeState, Tone>> = {
  reporting: "success",
  late: "warning",
  offline: "destructive",
};

/** The name of a tide event's kind. */
const kindOf = (event: TideEvent) =>
  event.kind === "high" ? TEXT.feed.day.high : TEXT.feed.day.low;

/** The first tide event after now; the sample day always has one (a bug otherwise, RangeError). */
function nextEvent(): TideEvent {
  const next = TIDE_EVENTS.find((event) => event.hour > NOW);
  if (next === undefined) throw new RangeError("Mobile: no tide event after now");
  return next;
}

export function Mobile({ view }: { view: View }) {
  const copy = copyOf("mobile", view.copy);
  const [tab, setTab] = useState<MobileTab>(TEXT.tabs.selected);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(TEXT.sheet.value);
  const [picked, setPicked] = useState(TEXT.sheet.value);
  const opener = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  // Closing gives focus back to "Set an alert", once the rest of its screen is no longer inert.
  useLayoutEffect(() => {
    if (open) {
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      opener.current?.focus();
    }
  }, [open]);
  const close = (keep: boolean) => {
    if (keep) setSaved(picked);
    setOpen(false);
  };
  const time = clock(NOW);
  return (
    // While the sheet is open, a press outside it keeps focus put: the screens beside it are inert, so
    // a press there lands here, and the canvas region would take focus from the sheet.
    // biome-ignore lint/a11y/noStaticElementInteractions: the handler keeps focus put; it is no action.
    <div
      data-template-root="mobile"
      className="mb"
      data-roles="muted muted-foreground"
      onMouseDown={(event) => {
        if (!open || !(event.target instanceof Element)) return;
        if (event.target.closest(".kit-bottom-sheet") === null) event.preventDefault();
      }}
    >
      <Entrance className="mb-row">
        <PhoneScreen
          name="feed"
          number="01"
          caption={TEXT.screens.feed}
          time={time}
          inert={open}
          dimmed={open}
        >
          <Feed copy={copy} />
        </PhoneScreen>
        <PhoneScreen
          name="detail"
          number="02"
          caption={TEXT.screens.detail}
          time={time}
          inert={open}
          overlay={
            open && (
              <BottomSheet
                title={TEXT.sheet.title}
                body={TEXT.sheet.body}
                onClose={() => close(false)}
              >
                <RadioGroup
                  legend={TEXT.sheet.legend}
                  options={TEXT.sheet.options}
                  value={picked}
                  onChange={setPicked}
                  surface="popover"
                />
                <div className="kit-actions">
                  <Button variant="ghost" onPress={() => close(false)}>
                    {TEXT.sheet.cancel}
                  </Button>
                  <Button variant="primary" onPress={() => close(true)}>
                    {TEXT.sheet.save}
                  </Button>
                </div>
              </BottomSheet>
            )
          }
        >
          <Detail
            copy={copy}
            saved={saved}
            opener={opener}
            onOpen={() => {
              setPicked(saved);
              setOpen(true);
            }}
          />
        </PhoneScreen>
        <PhoneScreen
          name="tabs"
          number="03"
          caption={TEXT.screens.tabs}
          time={time}
          inert={open}
          dimmed={open}
        >
          <Tabs tab={tab} onTab={setTab} />
        </PhoneScreen>
      </Entrance>
    </div>
  );
}

/** A screen section: a heading the screen's region holds, and its content. */
function Section({
  title,
  level,
  children,
}: {
  title: string;
  level: "h2" | "h3";
  children: ReactNode;
}) {
  const id = useId();
  const Heading = level;
  return (
    <section aria-labelledby={id} className="mb-section">
      <Heading id={id} className="kit-t-h4 kit-display" data-roles="foreground font-display">
        {title}
      </Heading>
      {children}
    </section>
  );
}

/** The feed: the water now, the day in time order and the saved moorings. */
function Feed({ copy }: { copy: CanvasCopy }) {
  const { feed } = TEXT;
  const now = tideAt(NOW);
  const next = nextEvent();
  return (
    <div className="mb-screen">
      <header className="mb-appbar" data-roles="background foreground">
        <span className="mb-brand kit-t-body kit-display" data-roles="foreground font-display">
          <span className="mb-mark" data-roles="primary primary-foreground">
            <Waves aria-hidden="true" />
          </span>
          {TEXT.brand}
        </span>
        <Badge tone="neutral">{TEXT.sample}</Badge>
        <IconButton label={feed.search} icon={<Search aria-hidden="true" />} />
      </header>
      <div className="mb-title">
        <h1
          id={target("today")}
          tabIndex={-1}
          className="kit-t-h3 kit-display"
          data-roles="foreground font-display"
        >
          {copy.title}
        </h1>
        <p className="kit-t-body-sm kit-muted" data-roles="muted-foreground font-body">
          {feed.intro}
        </p>
      </div>
      <div className="mb-now">
        <div className="mb-now-card" data-roles="card card-foreground border font-body">
          <p className="kit-t-label">
            {feed.now.label}, {feed.now.place}
          </p>
          <p
            className="mb-now-value kit-num kit-t-h2 kit-display"
            data-roles="card-foreground font-display"
          >
            {now.toFixed(1)} m
          </p>
          <p className="kit-t-body-sm">
            {next.kind === "low" ? feed.now.falling : feed.now.rising}{" "}
            <span className="kit-num">
              {clock(next.hour)}, {next.meters.toFixed(1)} m
            </span>
          </p>
          <Level value={now} max={TIDE_RANGE} />
        </div>
        <TextLink to={target("detail")} tone="touch">
          {feed.now.open}
          <ChevronRight aria-hidden="true" />
        </TextLink>
      </div>
      <Section title={feed.day.title} level="h2">
        <Day copy={copy} next={next} />
      </Section>
      <Section title={feed.moorings.title} level="h2">
        <Moorings copy={copy} />
      </Section>
    </div>
  );
}

/** One entry of the day: a tide event or a crew entry, at its hour. */
type DayEntry = { readonly hour: number; readonly key: string; readonly body: ReactNode };

/** The day in time order: the sample tide's events and two crew entries. */
function Day({ copy, next }: { copy: CanvasCopy; next: TideEvent }) {
  const { day } = TEXT.feed;
  const entries: DayEntry[] = [
    ...TIDE_EVENTS.map((event) => ({
      hour: event.hour,
      key: `tide-${event.hour}`,
      body: (
        <>
          <p className="kit-t-body-sm">
            {kindOf(event)} at {SAMPLE_PLACES[0]},{" "}
            <span className="kit-num">{event.meters.toFixed(1)} m</span>
          </p>
          {event === next && <Badge tone="primary">{day.next}</Badge>}
        </>
      ),
    })),
    {
      hour: day.crew.hour,
      key: "crew",
      body: (
        <>
          <Avatar person={copy.person} state="default" />
          <p className="kit-t-body-sm">
            <RichText runs={day.crew.text} copy={copy} />
          </p>
        </>
      ),
    },
    {
      hour: day.late.hour,
      key: "late",
      body: (
        <>
          <p className="kit-t-body-sm">{day.late.text}</p>
          <Badge tone="warning">{day.late.badge}</Badge>
        </>
      ),
    },
  ].sort((a, b) => a.hour - b.hour);
  return (
    <ol className="mb-day" data-roles="foreground muted-foreground border font-body">
      {entries.map((entry) => (
        <li key={entry.key} className="mb-day-entry" data-past={entry.hour < NOW ? "" : undefined}>
          <span className="mb-day-time kit-num kit-mono kit-t-label" data-roles="muted-foreground">
            {clock(entry.hour)}
          </span>
          <span aria-hidden="true" className="mb-day-rail" data-roles="border" />
          <span
            aria-hidden="true"
            className="mb-day-dot"
            data-roles={entry.hour < NOW ? "background border" : "background primary"}
          />
          <div className="mb-day-body">{entry.body}</div>
        </li>
      ))}
    </ol>
  );
}

/** The saved moorings with their level now, or the empty list's sentence. */
function Moorings({ copy }: { copy: CanvasCopy }) {
  const { moorings } = TEXT.feed;
  if (copy.items.length === 0) {
    return (
      <p
        data-list=""
        data-empty=""
        className="kit-empty kit-t-body-sm"
        data-roles="muted muted-foreground"
      >
        {moorings.empty}
      </p>
    );
  }
  return (
    <ul data-list="" className="mb-list" data-roles="foreground border font-body">
      {copy.items.map((place, index) => {
        const level = moorings.levels[index];
        if (level === undefined) {
          throw new RangeError(`Mobile: no sample level for mooring ${index + 1}`);
        }
        return (
          <li key={place} data-list-item="" className="mb-list-item">
            <span className="kit-t-body">{place}</span>
            <span className="mb-list-level">
              <span className="kit-num kit-t-body-sm">{level.toFixed(1)} m</span>
              <Level value={level} max={TIDE_RANGE} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** A mooring's detail: the level now, the day's curve and events, and the alert row. */
function Detail({
  copy,
  saved,
  opener,
  onOpen,
}: {
  copy: CanvasCopy;
  saved: string;
  opener: RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
}) {
  const { detail } = TEXT;
  const now = tideAt(NOW);
  const next = nextEvent();
  const events = TIDE_EVENTS.map(
    (event) => `${kindOf(event)} ${clock(event.hour)}, ${event.meters.toFixed(1)} m`,
  );
  const name = `${detail.figure}: ${events.join("; ")}; ${detail.now} ${clock(NOW)}.`;
  return (
    <div className="mb-screen">
      <header className="mb-topbar" data-roles="background foreground">
        <TextLink to={target("today")} tone="touch" icon={<ChevronLeft aria-hidden="true" />}>
          {detail.back}
        </TextLink>
        <IconButton label={detail.share} icon={<Share2 aria-hidden="true" />} />
      </header>
      <div className="mb-place">
        <div className="mb-place-head">
          <h2
            id={target("detail")}
            tabIndex={-1}
            className="kit-t-h3 kit-display"
            data-roles="foreground font-display"
          >
            {detail.place}
          </h2>
          <Badge tone="accent" copyLabel>
            {copy.label}
          </Badge>
        </div>
        <p className="kit-t-body-sm kit-muted" data-roles="muted-foreground font-body">
          {detail.gauge}
        </p>
      </div>
      <div className="mb-reading">
        <p className="kit-num kit-t-h2 kit-display" data-roles="foreground font-display">
          {now.toFixed(1)} m
        </p>
        <p className="kit-t-body-sm kit-muted" data-roles="muted-foreground font-body">
          <span className="kit-num">{signed(now - tideAt(NOW - 1))} m</span> {detail.change}.{" "}
          {next.kind === "low" ? TEXT.feed.now.falling : TEXT.feed.now.rising}{" "}
          <span className="kit-num">{clock(next.hour)}</span>.
        </p>
      </div>
      <div className="mb-curve" data-roles="card card-foreground border">
        <TideCurve label={name} now={NOW} nowLabel={`${detail.now} ${clock(NOW)}`} />
      </div>
      <Section title={detail.events} level="h3">
        <dl className="mb-events" data-roles="foreground muted-foreground border font-body">
          {TIDE_EVENTS.map((event) => (
            <div key={event.hour} className="mb-event">
              <dt className="kit-t-body-sm">{kindOf(event)}</dt>
              <dd className="kit-num kit-t-body-sm kit-muted">{clock(event.hour)}</dd>
              <dd className="kit-num kit-t-body-sm">{event.meters.toFixed(1)} m</dd>
            </div>
          ))}
        </dl>
      </Section>
      <div className="mb-stored">
        <p className="kit-t-body-sm kit-muted" data-roles="muted-foreground font-body">
          {detail.stored}
        </p>
        <p className="kit-num kit-t-h4 kit-display" data-roles="foreground font-display">
          {copy.amount}
        </p>
      </div>
      <div
        data-alert-row=""
        className="mb-alert"
        data-roles="background foreground border font-body"
      >
        <p className="kit-t-body">
          {detail.alert.label}: <strong className="kit-num">{saved}</strong>
        </p>
        <p className="kit-t-body-sm kit-muted" data-roles="muted-foreground font-body">
          <RichText runs={detail.alert.note} copy={copy} />
        </p>
        <Button
          variant="primary"
          ref={opener}
          id={target("alert")}
          icon={<Bell aria-hidden="true" />}
          onPress={onOpen}
        >
          {detail.alert.action}
        </Button>
      </div>
    </div>
  );
}

/** The app's root screen: the selected tab's panel above the tab bar. */
function Tabs({ tab, onTab }: { tab: MobileTab; onTab: (tab: MobileTab) => void }) {
  return (
    <div className="mb-screen mb-tabs">
      {TEXT.tabs.items.map((item) => (
        <div
          key={item.key}
          role="tabpanel"
          id={ids(item.key).panel}
          aria-labelledby={ids(item.key).tab}
          hidden={item.key !== tab}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a tab panel takes focus, as the ARIA tabs pattern asks, so its text is reachable.
          tabIndex={0}
          className="mb-panel"
        >
          <Panel tab={item.key} />
        </div>
      ))}
      <TabBar
        label={TEXT.tabs.label}
        items={TEXT.tabs.items.map((item) => ({ ...item, icon: TAB_ICONS[item.key] }))}
        selected={tab}
        onSelect={onTab}
        ids={ids}
      />
    </div>
  );
}

/** A panel's title, as the screen's large title. */
function PanelTitle({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="mb-title">
      <h2 className="kit-t-h3 kit-display" data-roles="foreground font-display">
        {title}
      </h2>
      {intro !== undefined && (
        <p className="kit-t-body-sm kit-muted" data-roles="muted-foreground font-body">
          {intro}
        </p>
      )}
    </div>
  );
}

/** The content of each tab's panel. */
function Panel({ tab }: { tab: MobileTab }) {
  const { tabs } = TEXT;
  switch (tab) {
    case "today":
      return (
        <>
          <PanelTitle title={tabs.today.title} intro={tabs.today.intro} />
          <ul className="mb-list" data-roles="foreground muted-foreground border font-body">
            {TIDE_EVENTS.filter((event) => event.hour > NOW).map((event) => (
              <li key={event.hour} className="mb-list-item">
                <span className="kit-t-body">{kindOf(event)}</span>
                <span className="kit-num kit-t-body-sm">
                  {clock(event.hour)}, {event.meters.toFixed(1)} m
                </span>
              </li>
            ))}
          </ul>
        </>
      );
    case "places":
      return (
        <>
          <PanelTitle title={tabs.places.title} intro={tabs.places.intro} />
          <ul className="mb-list" data-roles="foreground border font-body">
            {SAMPLE_PLACES.map((place, index) => {
              const reading = DASHBOARD_TEXT.gauges.readings[index];
              if (reading === undefined) {
                throw new RangeError(`Mobile: no sample gauge for ${place}`);
              }
              return (
                <li key={place} className="mb-list-item">
                  <span className="kit-t-body">{place}</span>
                  <Badge tone={STATE_TONES[reading.state]}>
                    {DASHBOARD_TEXT.gauges.states[reading.state]}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </>
      );
    case "alerts":
      return (
        <>
          <PanelTitle title={tabs.alerts.title} />
          <div className="mb-rules">
            {tabs.alerts.rules.map((rule) => (
              <Switch
                key={rule.label}
                label={rule.label}
                state={rule.on ? "selected" : "default"}
              />
            ))}
          </div>
          <p className="kit-t-body-sm kit-muted" data-roles="muted-foreground font-body">
            {tabs.alerts.note}
          </p>
          <TextLink to={target("alert")} tone="touch">
            {tabs.alerts.link}
            <ChevronRight aria-hidden="true" />
          </TextLink>
        </>
      );
    case "crew":
      return (
        <>
          <PanelTitle title={tabs.crew.title} />
          <ul className="mb-list" data-roles="foreground muted-foreground border font-body">
            {tabs.crew.people.map((person) => (
              <li key={person.name} className="mb-list-item mb-person">
                <Avatar person={person.name} state="default" />
                <span className="mb-person-text">
                  <span className="kit-t-body">{person.name}</span>
                  <span className="kit-t-body-sm kit-muted">{person.role}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      );
    default: {
      const unknown: never = tab;
      throw new RangeError(`Mobile: no panel ${JSON.stringify(unknown)}`);
    }
  }
}
