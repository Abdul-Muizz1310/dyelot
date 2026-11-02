"use client";

import "./dashboard.css";
import { Bell, Download, FileDown, Gauge, LayoutDashboard, Search, Waves } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { View } from "@/features/studio/view";
import { stackBars } from "../bars";
import {
  type CanvasCopy,
  copyOf,
  type DashboardTarget,
  type GaugeState,
  DASHBOARD_TEXT as TEXT,
} from "../copy";
import {
  Badge,
  BarsLegend,
  BarsTable,
  Button,
  Chip,
  Entrance,
  Level,
  RichText,
  Segmented,
  StackedBars,
  TextLink,
  Toast,
  type Tone,
} from "../kit";
import { clock, TIDE_EVENTS, TIDE_RANGE, tideAt } from "../tide";

// The dashboard (spec section 7.7): Saltmarsh's console, a fictional tide app's operator view, as a
// specimen of the design at work density. A sidebar on the sidebar roles that collapses to a rail
// below 768 px of frame, a header with the command button, filters, a KPI row (the one entrance), a
// stacked bar chart in the five chart roles, a dense table of gauges, an empty panel and a toast.
// Panels group by borders on the page, so every text sits on the fill it is paired with. Under
// edge-case copy the slots of R2-21 swap in.

const target = (to: DashboardTarget) => `console-${to}`;

/** "Now" on the sample day's tide: 09:30, as on the landing's tide card. */
const NOW = 9.5;

const ICONS: Readonly<Record<DashboardTarget, ReactNode>> = {
  top: <LayoutDashboard aria-hidden="true" />,
  alerts: <Bell aria-hidden="true" />,
  gauges: <Gauge aria-hidden="true" />,
  exports: <Download aria-hidden="true" />,
};

const STATE_TONES: Readonly<Record<GaugeState, Tone>> = {
  reporting: "success",
  late: "warning",
  offline: "destructive",
};

/** The week's alerts, stacked: one source for the bars, the figure's name and its table. */
const ALERTS = stackBars(TEXT.alerts.kinds, 5);

/** A signed change in meters with a true minus sign: "+0.2", "−0.4". */
const signed = (meters: number) =>
  `${meters > 0 ? "+" : meters < 0 ? "−" : ""}${Math.abs(meters).toFixed(1)}`;

export function Dashboard({ view }: { view: View }) {
  const copy = copyOf("dashboard", view.copy);
  // The toast's dismissal lives here, the dashboard's root, so a view toggle keeps it (section 7.7).
  const [toast, setToast] = useState(true);
  return (
    <div data-template-root="dashboard" className="db" data-roles="background foreground">
      <Sidebar />
      <div className="db-main">
        <header className="db-header" data-roles="background foreground">
          <div className="db-title">
            <h1
              id={target("top")}
              tabIndex={-1}
              className="kit-t-h3 kit-display"
              data-roles="foreground font-display"
            >
              {copy.title}
            </h1>
            <Badge tone="neutral">{TEXT.sample}</Badge>
          </div>
          {/* The name is the label alone: the shortcut hint is text, hidden from the name, and no
              key is bound to it. */}
          <button
            type="button"
            className="db-command kit-t-body-sm"
            data-roles="background muted-foreground input muted"
          >
            <Search aria-hidden="true" />
            <span className="db-command-label">{TEXT.command.label}</span>
            <span aria-hidden="true" className="db-hint">
              <kbd className="db-kbd kit-mono kit-t-caption">{TEXT.command.hint}</kbd>
            </span>
          </button>
        </header>
        <fieldset className="db-filters">
          <legend className="kit-sr-only">{TEXT.filters.label}</legend>
          <Segmented legend={TEXT.filters.range} options={TEXT.filters.ranges} />
          <div className="db-chips">
            {TEXT.filters.chips.map((chip) => (
              <Chip key={chip} label={chip} state="default" />
            ))}
          </div>
        </fieldset>
        <Entrance className="db-kpis-wrap">
          <Kpis copy={copy} />
        </Entrance>
        <Alerts />
        <Gauges copy={copy} />
        <div className="db-foot">
          <Exports />
          <div className="db-toasts">
            {toast && (
              <Toast
                state="default"
                dismissLabel={TEXT.toast.dismiss}
                onDismiss={() => setToast(false)}
              >
                <RichText runs={TEXT.toast.text} copy={copy} />
              </Toast>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The sidebar: the brand, the page's sections and the crew; a rail of icons below 768 px. */
function Sidebar() {
  return (
    <div
      data-sidebar=""
      className="db-sidebar"
      data-roles="sidebar sidebar-foreground sidebar-border"
    >
      <span
        className="db-brand kit-t-body kit-display"
        data-roles="sidebar-foreground font-display"
      >
        <span className="db-mark" data-roles="sidebar-primary sidebar-primary-foreground">
          <Waves aria-hidden="true" />
        </span>
        <span className="db-label">{TEXT.brand}</span>
      </span>
      <nav aria-label={TEXT.navLabel} className="db-nav">
        <ul className="kit-t-body-sm">
          {TEXT.nav.map((link) => (
            <li key={link.to}>
              <TextLink
                to={target(link.to)}
                tone="sidebar"
                current={link.to === "top"}
                icon={ICONS[link.to]}
              >
                <span data-label="" className="db-label">
                  {link.label}
                </span>
              </TextLink>
            </li>
          ))}
        </ul>
      </nav>
      <p className="db-crew kit-t-caption" data-roles="sidebar-foreground sidebar-border">
        <span className="db-crew-name">{TEXT.crew.name}</span>
        <span>{TEXT.crew.plan}</span>
      </p>
    </div>
  );
}

/** The KPI row: the water now, on a card, beside the week's three values. No icon cards. */
function Kpis({ copy }: { copy: CanvasCopy }) {
  const { lead, stats, gauges } = TEXT;
  const now = tideAt(NOW);
  const next = TIDE_EVENTS.find((event) => event.hour > NOW);
  if (next === undefined) throw new RangeError("Dashboard: no tide event after now");
  const reporting = gauges.readings.filter((reading) => reading.state === "reporting").length;
  const values = [
    [stats.reporting, `${reporting} of ${gauges.readings.length}`],
    [stats.stored, copy.amount],
    [stats.alerts, String(ALERTS.total)],
  ] as const;
  return (
    <div data-kpis="" className="db-kpis">
      <div data-kpi-lead="" className="db-lead" data-roles="card card-foreground border">
        <div className="db-lead-head">
          <p className="kit-t-label">
            {lead.label}, {lead.place}
          </p>
          <Badge tone="accent" copyLabel>
            {copy.label}
          </Badge>
        </div>
        <p
          data-kpi-value=""
          className="db-lead-value kit-num kit-t-h1 kit-display"
          data-roles="card-foreground font-display"
        >
          {now.toFixed(1)} m
        </p>
        <p className="db-lead-next kit-t-body-sm">
          {next.kind === "low" ? lead.falling : lead.rising}{" "}
          <span className="kit-num">
            {clock(next.hour)}, {next.meters.toFixed(1)} m
          </span>
        </p>
        <Level value={now} max={TIDE_RANGE} />
        <p className="kit-t-caption">
          <RichText runs={lead.note} copy={copy} />
        </p>
      </div>
      <dl className="db-stats" data-roles="foreground muted-foreground border">
        {values.map(([label, value]) => (
          <div key={label} className="db-stat">
            <dt className="kit-t-body-sm kit-muted">{label}</dt>
            <dd
              data-kpi-value=""
              className="kit-num kit-t-h4 kit-display"
              data-roles="foreground font-display"
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A panel's head: an `h2` the sidebar's links can focus, and a muted sentence. */
function PanelHead({ to, title, intro }: { to: DashboardTarget; title: string; intro?: string }) {
  return (
    <div className="db-panel-head">
      <h2
        id={target(to)}
        tabIndex={-1}
        className="kit-t-h4 kit-display"
        data-roles="foreground font-display"
      >
        {title}
      </h2>
      {intro !== undefined && (
        <p className="kit-t-body-sm kit-muted" data-roles="muted-foreground">
          {intro}
        </p>
      )}
    </div>
  );
}

/** The week's alerts as stacked bars, with a legend and the data as a hidden table. */
function Alerts() {
  const { alerts } = TEXT;
  const totals = alerts.kinds.map((kind, index) => `${kind.name} ${ALERTS.seriesTotals[index]}`);
  const busiest = `${alerts.days[ALERTS.peak]}, ${ALERTS.columnTotals[ALERTS.peak]}`;
  const name = `${alerts.figure}: ${ALERTS.total} in all. ${totals.join(", ")}. Most on ${busiest}.`;
  return (
    <section
      data-chart=""
      aria-labelledby={target("alerts")}
      className="db-panel db-alerts"
      data-roles="background foreground border"
    >
      <PanelHead to="alerts" title={alerts.title} intro={alerts.intro} />
      <div className="db-chart">
        <StackedBars stack={ALERTS} columns={alerts.days} label={name} />
        <BarsLegend series={alerts.kinds} totals={ALERTS.seriesTotals} />
      </div>
      <BarsTable caption={alerts.table} columns={alerts.days} series={alerts.kinds} head="Kind" />
    </section>
  );
}

/** The dense table: the gauge at each saved mooring, or the empty list's sentence. */
function Gauges({ copy }: { copy: CanvasCopy }) {
  const { gauges } = TEXT;
  const { columns } = gauges;
  return (
    <section
      aria-labelledby={target("gauges")}
      className="db-panel db-gauges"
      data-roles="background foreground border"
    >
      <PanelHead to="gauges" title={gauges.title} intro={gauges.intro} />
      {copy.items.length === 0 ? (
        <p
          data-list=""
          data-empty=""
          className="kit-empty kit-t-body-sm"
          data-roles="muted muted-foreground"
        >
          {gauges.empty}
        </p>
      ) : (
        <table
          data-list=""
          className="db-table kit-t-body-sm"
          data-roles="foreground muted-foreground border muted"
        >
          <thead>
            <tr>
              <th scope="col">{columns.place}</th>
              <th scope="col" className="db-num">
                {columns.level}
              </th>
              <th scope="col" className="db-num db-wide">
                {columns.change}
              </th>
              <th scope="col" className="db-num db-wide">
                {columns.battery}
              </th>
              <th scope="col" className="db-num db-mid">
                {columns.report}
              </th>
              <th scope="col">{columns.state}</th>
            </tr>
          </thead>
          <tbody>
            {copy.items.map((place, index) => {
              const reading = gauges.readings[index];
              if (reading === undefined) {
                throw new RangeError(`Dashboard: no sample gauge for mooring ${index + 1}`);
              }
              return (
                <tr key={place} data-list-item="">
                  <th scope="row" className="db-place">
                    {place}
                  </th>
                  <td data-numeric="" className="db-num kit-num">
                    {reading.level.toFixed(1)}
                  </td>
                  <td data-numeric="" className="db-num db-wide kit-num">
                    {signed(reading.change)}
                  </td>
                  <td data-numeric="" className="db-num db-wide kit-num">
                    {reading.battery}%
                  </td>
                  <td className="db-num db-mid kit-num">{reading.report}</td>
                  <td>
                    <Badge tone={STATE_TONES[reading.state]}>{gauges.states[reading.state]}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** The exports panel, empty: a title, a sentence and one action. */
function Exports() {
  const { exports } = TEXT;
  return (
    <section
      aria-labelledby={target("exports")}
      className="db-panel db-exports"
      data-roles="background foreground border"
    >
      <PanelHead to="exports" title={exports.title} />
      <div data-empty-panel="" className="db-empty" data-roles="foreground muted-foreground border">
        <FileDown aria-hidden="true" className="db-empty-icon" />
        <h3 className="kit-t-body kit-display" data-roles="foreground font-display">
          {exports.empty.title}
        </h3>
        <p className="kit-t-body-sm kit-muted" data-roles="muted-foreground">
          {exports.empty.body}
        </p>
        <Button variant="secondary" icon={<Download aria-hidden="true" />}>
          {exports.empty.action}
        </Button>
      </div>
    </section>
  );
}
