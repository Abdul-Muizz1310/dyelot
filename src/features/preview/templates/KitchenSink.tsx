"use client";

import "./kitchen-sink.css";
import { RotateCcw, Share2 } from "lucide-react";
import { type ReactNode, useId, useMemo, useState } from "react";
import type { Mode } from "@/engine";
import type { View } from "@/features/studio/view";
import type { DesignSpec } from "@/spec";
import { themeVars } from "@/theme/vars";
import { type CanvasCopy, COPY } from "../copy";
import {
  Alert,
  Avatar,
  Badge,
  BUTTON_VARIANTS,
  Button,
  type ButtonVariant,
  Card,
  Checkbox,
  Chip,
  DialogStage,
  Entrance,
  Input,
  KIT_COMPONENTS,
  type KitComponentId,
  type KitState,
  MenuSpecimen,
  Progress,
  Radio,
  ReadingsTables,
  Segmented,
  Select,
  SheetStage,
  Skeleton,
  Switch,
  TabSpecimen,
  TabsDemo,
  Textarea,
  Toast,
  Tooltip,
} from "../kit";
import { swatches } from "../swatches";
import { canvasStyle } from "../vars";

// The kitchen sink (spec section 7.5): the light and dark canvases side by side, each a
// `[data-canvas]` with that mode's variables, holding every role with its hex and measured ratio,
// every type step, radius, shadow and motion token, and every kit component in every state it
// supports. Sample content is fictional: a tide-reading app called Saltmarsh.

const MODES: readonly Mode[] = ["light", "dark"];
const TYPE_ORDER = [
  "display",
  "h1",
  "h2",
  "h3",
  "h4",
  "lead",
  "body",
  "body-sm",
  "label",
  "caption",
];
const HEADINGS = new Set(["display", "h1", "h2", "h3", "h4"]);
const RADII = ["sm", "md", "lg", "xl", "2xl", "full"] as const;
const ELEVATIONS = [1, 2, 3, 4, 5] as const;
const DURATIONS = ["instant", "fast", "quick", "base", "slow", "slower", "slowest"] as const;
const EASINGS = ["standard", "decelerate", "accelerate", "emphasized"] as const;
const PLACES = ["Samphire Bay", "Heron Staithe", "Gull Point"] as const;

const BUTTON_LABELS: Readonly<Record<ButtonVariant, string>> = {
  primary: "Save reading",
  secondary: "Share",
  ghost: "Cancel",
  destructive: "Delete",
  link: "Tide table",
};

export function KitchenSink({ spec, view }: { spec: DesignSpec; view: View }) {
  const copy = COPY[view.copy];
  return (
    <div data-template-root="kitchen-sink">
      <Entrance className="sink-panes">
        {MODES.map((mode) => (
          // A new copy set remounts the pane, so the fields take their new default values.
          <Pane key={`${mode}-${view.copy}`} mode={mode} spec={spec} view={view} copy={copy} />
        ))}
      </Entrance>
    </div>
  );
}

function Pane({
  mode,
  spec,
  view,
  copy,
}: {
  mode: Mode;
  spec: DesignSpec;
  view: View;
  copy: CanvasCopy;
}) {
  const id = useId();
  const style = useMemo(
    () => canvasStyle(spec, mode, { vision: view.vision, density: view.density }),
    [spec, mode, view.vision, view.density],
  );
  const vars = useMemo(() => themeVars(spec, mode, { units: "cqi" }), [spec, mode]);
  return (
    <section
      data-canvas=""
      data-pane={mode}
      data-mode={mode}
      aria-labelledby={id}
      style={style}
      className="sink-pane"
    >
      <header className="sink-head">
        <p className="kit-mono kit-t-caption sink-muted">sample · kitchen sink · {mode}</p>
        <h2 id={id} className="kit-display kit-t-h2">
          {mode === "light" ? "Light" : "Dark"}
        </h2>
        <p className="kit-t-body sink-muted">
          Every role, type step, radius, shadow, motion token and component state of this design, in{" "}
          {mode} mode.
        </p>
      </header>
      <Swatches spec={spec} mode={mode} />
      <TypeSteps vars={vars} copy={copy} />
      <ShapeAndDepth vars={vars} copy={copy} />
      <MotionDemos vars={vars} />
      <Components copy={copy} />
    </section>
  );
}

/** A section of a pane, under its heading. Not a landmark: each pane repeats every section. */
function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="sink-section">
      <h3>{title}</h3>
      {note !== undefined && <p className="sink-note">{note}</p>}
      {children}
    </div>
  );
}

function Swatches({ spec, mode }: { spec: DesignSpec; mode: Mode }) {
  const rows = useMemo(() => swatches(spec, mode), [spec, mode]);
  return (
    <Section
      title="Color roles"
      note="All 46 roles with their stored hex. A text role shows its WCAG ratio on the fill it sits on."
    >
      <ul className="sink-swatches">
        {rows.map(({ role, hex, pair }) => (
          <li
            key={role}
            className="sink-swatch"
            data-swatch={role}
            data-roles={pair === null ? role : `${role} ${pair.fill}`}
          >
            <span
              aria-hidden="true"
              className="sink-chip"
              style={
                pair === null
                  ? { backgroundColor: `var(--${role})` }
                  : { backgroundColor: `var(--${pair.fill})`, color: `var(--${role})` }
              }
            >
              {pair === null ? null : "Aa"}
            </span>
            <span className="kit-mono kit-t-caption">{role}</span>
            <span className="kit-mono kit-t-caption sink-muted" data-hex="">
              {hex}
            </span>
            {pair !== null && (
              <span className="kit-mono kit-t-caption sink-muted">
                <span data-ratio="">{pair.ratio.toFixed(2)}</span>:1 on {pair.fill}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function TypeSteps({ vars, copy }: { vars: Readonly<Record<string, string>>; copy: CanvasCopy }) {
  const samples: Readonly<Record<string, string>> = {
    display: "Read the water",
    h1: "Tides of the eastern marsh",
    h2: "Spring and neap",
    h3: copy.title,
    h4: "Gauge readings",
    lead: "Sample: a tide table for the saltmarsh, set in this design's type.",
    body: `Sample: the flood fills the ${copy.word} an hour before high water, and the marsh drains slowly on the ebb.`,
    "body-sm": "Sample: readings in meters above chart datum.",
    label: "Save reading",
    caption: "Updated 06:42 · Samphire gauge",
  };
  return (
    <Section title="Type" note="The ten steps of the scale, largest first, with size and leading.">
      <div className="sink-type">
        {TYPE_ORDER.map((step) => {
          const size = vars[`--text-${step}`] ?? "";
          return (
            <div key={step} className="sink-type-row">
              <p className="kit-mono kit-t-caption sink-type-meta">
                <span>{step}</span>
                <span>
                  {size.startsWith("clamp") ? "fluid" : size} / {vars[`--leading-${step}`]}
                </span>
              </p>
              <p
                data-token={`text-${step}`}
                data-roles={HEADINGS.has(step) ? "font-display" : "font-body"}
                className={`kit-t-${step}${HEADINGS.has(step) ? " kit-display" : ""}`}
              >
                {samples[step]}
              </p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function ShapeAndDepth({
  vars,
  copy,
}: {
  vars: Readonly<Record<string, string>>;
  copy: CanvasCopy;
}) {
  return (
    <Section
      title="Radius and depth"
      note="Six radii and five elevations. A nested shape keeps one center: the inner radius is the outer radius minus the padding."
    >
      <div className="sink-tiles">
        {RADII.map((name) => (
          <figure key={name} className="sink-tile">
            <span
              data-token={`radius-${name}`}
              className="sink-radius"
              style={{ borderRadius: `var(--radius-${name})` }}
            />
            <figcaption className="kit-mono kit-t-caption">
              {name} · {vars[`--radius-${name}`]}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="sink-tiles">
        {ELEVATIONS.map((level) => (
          <figure key={level} className="sink-tile">
            <span
              data-token={`shadow-${level}`}
              className="sink-shadow"
              style={{ boxShadow: `var(--shadow-${level})` }}
            />
            <figcaption className="kit-mono kit-t-caption">shadow {level}</figcaption>
          </figure>
        ))}
      </div>
      <div className="sink-concentric">
        <Card title={copy.title} meta="Sample · four readings today" />
        <Segmented legend="Tide range" options={["Neap", "Mean", "Spring"]} />
      </div>
    </Section>
  );
}

function MotionDemos({ vars }: { vars: Readonly<Record<string, string>> }) {
  const [run, setRun] = useState(0);
  return (
    <Section title="Motion">
      <div className="sink-motion-head">
        <p className="sink-note">
          Durations run on the standard easing; easings run over the slow duration.
        </p>
        <Button
          variant="secondary"
          icon={<RotateCcw aria-hidden="true" />}
          onPress={() => setRun((count) => count + 1)}
        >
          Replay
        </Button>
      </div>
      <ul className="sink-tracks">
        {DURATIONS.map((name) => (
          <Track
            key={name}
            token={`duration-${name}`}
            label={name}
            printed={vars[`--duration-${name}`] ?? ""}
            duration={`var(--duration-${name})`}
            easing="var(--ease-standard)"
            run={run}
          />
        ))}
        {EASINGS.map((name) => (
          <Track
            key={name}
            token={`ease-${name}`}
            label={name}
            printed={vars[`--ease-${name}`] ?? ""}
            duration="var(--duration-slow)"
            easing={`var(--ease-${name})`}
            run={run}
          />
        ))}
      </ul>
      <div className="sink-spring">
        <p className="kit-mono kit-t-caption">
          spring · {vars["--spring-duration"]} s · bounce {vars["--spring-bounce"]}
        </p>
        <Switch label="Follow the tide" />
      </div>
    </Section>
  );
}

function Track({
  token,
  label,
  printed,
  duration,
  easing,
  run,
}: {
  token: string;
  label: string;
  printed: string;
  duration: string;
  easing: string;
  run: number;
}) {
  return (
    <li className="sink-track-row kit-mono kit-t-caption" data-token={token}>
      <span>{label}</span>
      <span data-printed="">{printed}</span>
      <span className="sink-track" aria-hidden="true">
        <span
          key={run}
          data-runner=""
          className="sink-runner"
          style={{ animationDuration: duration, animationTimingFunction: easing }}
        >
          <span className="sink-dot" />
        </span>
      </span>
    </li>
  );
}

function Specimen({
  state,
  wide = false,
  children,
}: {
  state: KitState;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <figure data-specimen="" data-wide={wide ? "" : undefined} className="sink-specimen">
      {/* A forced state is a picture of the part: it takes no focus and no pointer, so the
          kitchen sink keeps a short Tab order. The default specimen stays live. */}
      <div className="sink-specimen-part" inert={state !== "default"}>
        {children}
      </div>
      <figcaption data-state-label="" className="kit-mono kit-t-caption">
        {state}
      </figcaption>
    </figure>
  );
}

/** The specimens of one component, one per state it supports. */
function specimensOf(id: KitComponentId, states: readonly KitState[], copy: CanvasCopy): ReactNode {
  const each = (render: (state: KitState) => ReactNode, wide = false) =>
    states.map((state) => (
      <Specimen key={state} state={state} wide={wide}>
        {render(state)}
      </Specimen>
    ));
  switch (id) {
    case "button":
      return BUTTON_VARIANTS.map((variant) => (
        <div key={variant} className="sink-component">
          <p className="kit-mono kit-t-caption sink-variant">{variant}</p>
          <div className="sink-specimens">
            {each((state) => (
              <Button
                variant={variant}
                state={state}
                icon={variant === "secondary" ? <Share2 aria-hidden="true" /> : undefined}
              >
                {state === "loading" ? "Saving" : BUTTON_LABELS[variant]}
              </Button>
            ))}
          </div>
        </div>
      ));
    case "input":
      return (
        <div className="sink-specimens" data-fill="">
          {each((state) => (
            <Input
              label="Observer"
              state={state}
              value={copy.person}
              placeholder="Your name"
              messages={{ invalid: "Enter the observer's name.", success: "Observer saved." }}
            />
          ))}
        </div>
      );
    case "textarea":
      return (
        <div className="sink-specimens" data-fill="">
          {each((state) => (
            <Textarea
              label="Notes"
              state={state}
              value={`Sample: the ${copy.word} flooded at dawn.`}
              placeholder="What did the water do?"
              messages={{ invalid: "Write a note about the water.", success: "Note saved." }}
            />
          ))}
        </div>
      );
    case "select":
      return (
        <div className="sink-specimens" data-fill="">
          {each((state) => (
            <Select
              label="Place"
              state={state}
              options={PLACES}
              invalid="Choose a place for the reading."
            />
          ))}
        </div>
      );
    case "checkbox":
      return (
        <div className="sink-specimens">
          {each((state) => (
            <Checkbox label="Spring tides only" state={state} />
          ))}
        </div>
      );
    case "radio":
      return (
        <div className="sink-specimens">
          {each((state) => (
            <Radio label="Meters" state={state} />
          ))}
        </div>
      );
    case "switch":
      return (
        <div className="sink-specimens">
          {each((state) => (
            <Switch label="Alerts" state={state} />
          ))}
        </div>
      );
    case "tab":
      return (
        <>
          <div className="sink-specimens">
            {each((state) => (
              <TabSpecimen label="Tides" state={state} />
            ))}
          </div>
          <TabsDemo />
        </>
      );
    case "menu-item":
      return (
        <div className="sink-specimens" data-fill="">
          {each((state) => (
            <MenuSpecimen state={state} />
          ))}
        </div>
      );
    case "table-row":
      return <ReadingsTables states={states} person={copy.person} amount={copy.amount} />;
    case "card":
      return (
        <div className="sink-specimens" data-fill="">
          {each((state) => (
            <Card title={copy.title} meta="Sample · four readings today" state={state} />
          ))}
        </div>
      );
    case "badge":
      return (
        <div className="sink-specimens">
          <Specimen state="default" wide>
            <div className="sink-row">
              <Badge tone="neutral">Draft</Badge>
              <Badge tone="primary">Live</Badge>
              <Badge tone="accent" copyLabel>
                {copy.label}
              </Badge>
              <Badge tone="success">Synced</Badge>
              <Badge tone="warning">Low battery</Badge>
              <Badge tone="destructive">Offline</Badge>
              <Badge tone="info">Forecast</Badge>
            </div>
          </Specimen>
        </div>
      );
    case "alert":
      return (
        <div className="sink-specimens" data-fill="">
          {each((state) => (
            <Alert state={state === "success" || state === "invalid" ? state : "default"} />
          ))}
        </div>
      );
    case "tooltip":
      return (
        <div className="sink-specimens">
          {each(() => (
            <Tooltip />
          ))}
        </div>
      );
    case "dialog":
      return (
        <div className="sink-specimens">
          {each(
            () => (
              <DialogStage title={copy.title} />
            ),
            true,
          )}
        </div>
      );
    case "sheet":
      return (
        <div className="sink-specimens">
          {each(
            () => (
              <SheetStage items={copy.items} />
            ),
            true,
          )}
        </div>
      );
    case "toast":
      return (
        <div className="sink-specimens" data-fill="">
          {each((state) => (
            <Toast
              state={
                state === "success" || state === "invalid" || state === "loading"
                  ? state
                  : "default"
              }
            />
          ))}
        </div>
      );
    case "avatar":
      return (
        <div className="sink-specimens">
          {each((state) => (
            <Avatar person={copy.person} state={state} />
          ))}
        </div>
      );
    case "chip":
      return (
        <div className="sink-specimens">
          {each((state) => (
            <Chip label="High water" state={state} />
          ))}
        </div>
      );
    case "skeleton":
      return (
        <div className="sink-specimens">
          {each(() => (
            <Skeleton />
          ))}
        </div>
      );
    case "progress":
      return (
        <div className="sink-specimens">
          {each((state) => (
            <Progress state={state} />
          ))}
        </div>
      );
    default: {
      const unknown: never = id;
      throw new RangeError(`specimensOf: no specimens for ${String(unknown)}`);
    }
  }
}

function Components({ copy }: { copy: CanvasCopy }) {
  return (
    <Section
      title="Components"
      note="Every component of the kit in every state it supports. A forced state is marked on the component."
    >
      <div className="sink-components">
        {KIT_COMPONENTS.map((component) => (
          <Component key={component.id} title={component.label}>
            {specimensOf(component.id, component.states, copy)}
          </Component>
        ))}
      </div>
    </Section>
  );
}

function Component({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="sink-component">
      <h4>{title}</h4>
      {children}
    </div>
  );
}
