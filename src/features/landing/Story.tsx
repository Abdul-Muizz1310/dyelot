import type { DesignSpec } from "@/spec";
import "./story.css";
import { type StoryStep, storySteps } from "./story";

type Of<K extends StoryStep["kind"]> = Extract<StoryStep, { kind: K }>;

/** Each step's heading, in `storySteps`' order (7.2). */
const HEADINGS = ["One seed", "Eleven steps", "Roles", "Type and space", "A receipt"] as const;

const STEP_CLASS = "space-y-3 rounded-xl border border-border bg-panel p-5";
const SPECIMEN = "m-0 min-w-0";
const LABEL = "font-mono text-xs text-fg-muted";

function SeedSpecimen({ step }: { step: Of<"seed"> }) {
  return (
    <figure data-specimen className={SPECIMEN}>
      <div
        aria-hidden="true"
        className="h-24 w-24 rounded-lg border border-border"
        style={{ backgroundColor: step.hex }}
      />
    </figure>
  );
}

function ScaleSpecimen({ step }: { step: Of<"scale"> }) {
  return (
    <figure data-specimen className={SPECIMEN}>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-2 p-0">
        {step.steps.map((item) => (
          <li key={item.step} data-scale-step={item.step} className="min-w-0">
            <div
              aria-hidden="true"
              className="h-10 rounded-md border border-border"
              style={{ backgroundColor: item.hex }}
            />
            <div className={`${LABEL} mt-1`}>{item.step}</div>
            <div className={LABEL}>{item.contrast}</div>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function RolesSpecimen({ step }: { step: Of<"roles"> }) {
  const hex = (name: string) => step.roles.find((role) => role.name === name)?.hex;
  return (
    <figure data-specimen className={SPECIMEN}>
      <div
        className="rounded-lg border p-4"
        style={{
          backgroundColor: hex("background"),
          borderColor: hex("border"),
          color: hex("foreground"),
        }}
      >
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-3 p-0">
          {step.roles.map((role) => (
            <li key={role.name} data-role={role.name} className="min-w-0">
              <div
                aria-hidden="true"
                className="h-8 rounded-md border"
                style={{ backgroundColor: role.hex, borderColor: hex("border") }}
              />
              <div className="mt-1 font-mono text-xs [overflow-wrap:anywhere]">{role.name}</div>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

function TypeSpecimen({ step }: { step: Of<"type"> }) {
  return (
    <figure data-specimen className={SPECIMEN}>
      <dl className="m-0 space-y-1 font-mono text-sm">
        <div className="flex gap-3">
          <dt className="w-16 text-fg-muted">Display</dt>
          <dd className="m-0">{step.display}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-16 text-fg-muted">Body</dt>
          <dd className="m-0">{step.body}</dd>
        </div>
      </dl>
      <ul className="m-0 mt-4 list-none space-y-1 p-0">
        {step.space.map((px, index) => (
          // The scale can repeat a value, so the position names the row.
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of eight
          <li key={index} data-space={px} className="flex items-center gap-3">
            <span className={`${LABEL} w-12 shrink-0 text-right`}>{px} px</span>
            <span
              aria-hidden="true"
              className="h-2 max-w-full rounded-sm bg-foreground"
              style={{ width: `${px * 2}px` }}
            />
          </li>
        ))}
      </ul>
    </figure>
  );
}

function ReceiptSpecimen({ step }: { step: Of<"receipt"> }) {
  return (
    <figure data-specimen className={SPECIMEN}>
      <div className="font-mono text-3xl font-semibold">
        {step.passed} / {step.required}
      </div>
      <figcaption className={LABEL}>required checks pass</figcaption>
    </figure>
  );
}

function Paragraph({ steps, index }: { steps: readonly StoryStep[]; index: number }) {
  const step = steps[index];
  switch (step?.kind) {
    case "seed":
      return (
        <>
          It starts with one color: {step.hex}, {step.oklch}.
        </>
      );
    case "scale":
      return <>dyelot solves eleven steps of that hue, each at a set contrast against the page.</>;
    case "roles":
      return (
        <>
          The steps become the roles an interface uses: the page, its text, a primary action, a
          border and a focus ring.
        </>
      );
    case "type":
      return <>A type scale and a 4 px spacing scale come with the colors.</>;
    case "receipt":
      return (
        <>
          Every export carries a receipt. This design passes {step.passed} of {step.required}{" "}
          required contrast checks.
        </>
      );
    default:
      return null;
  }
}

function Specimen({ step }: { step: StoryStep }) {
  switch (step.kind) {
    case "seed":
      return <SeedSpecimen step={step} />;
    case "scale":
      return <ScaleSpecimen step={step} />;
    case "roles":
      return <RolesSpecimen step={step} />;
    case "type":
      return <TypeSpecimen step={step} />;
    case "receipt":
      return <ReceiptSpecimen step={step} />;
  }
}

/**
 * The scroll story (R5-33, 7.2): the first hero design assembles itself in five steps. Server
 * rendered; story.css animates each step with `animation-timeline: view()` where the browser and the
 * visitor allow it, and shows the final state everywhere else.
 */
export function Story({ spec }: { spec: DesignSpec }) {
  const steps = storySteps(spec);
  return (
    <section aria-labelledby="story-heading" data-story className="space-y-6">
      <h2 id="story-heading" className="font-mono text-2xl font-semibold tracking-tight">
        One color, five steps
      </h2>
      <ol className="m-0 list-none space-y-6 p-0">
        {steps.map((step, index) => (
          <li key={step.kind} data-story-step={step.kind} className={STEP_CLASS}>
            <h3 className="font-mono text-lg font-semibold">{HEADINGS[index]}</h3>
            <p className="m-0 text-sm text-fg-muted [overflow-wrap:anywhere]">
              <Paragraph steps={steps} index={index} />
            </p>
            <Specimen step={step} />
          </li>
        ))}
      </ol>
    </section>
  );
}
