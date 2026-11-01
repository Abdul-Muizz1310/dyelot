import { Share2 } from "lucide-react";
import type { ReactNode } from "react";
import { type CanvasCopy, SAMPLE_PLACES } from "../../copy";
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
  Input,
  KIT_COMPONENTS,
  type KitComponentId,
  type KitState,
  MenuSpecimen,
  Progress,
  Radio,
  ReadingsTables,
  Select,
  SheetStage,
  Skeleton,
  Switch,
  TabSpecimen,
  TabsDemo,
  Textarea,
  Toast,
  Tooltip,
} from "../../kit";
import { Section } from "./Section";

// Every kit component of a pane in every state it supports (F-TPL-03), each in a figure labeled
// with its state.

const PLACES = SAMPLE_PLACES.slice(0, 3);
const BUTTON_LABELS: Readonly<Record<ButtonVariant, string>> = {
  primary: "Save reading",
  secondary: "Share",
  ghost: "Cancel",
  destructive: "Delete",
  link: "Tide table",
};

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

export function Components({ copy }: { copy: CanvasCopy }) {
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
