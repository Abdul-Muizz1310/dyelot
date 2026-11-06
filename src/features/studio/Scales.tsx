"use client";

import {
  type KeyboardEvent,
  memo,
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  ViewTransition,
} from "react";
import { type Mode, PALETTE_NAMES, type PaletteName, STEPS, type Step } from "@/engine";
import type { DesignSpec } from "@/spec";
import { PanelSection } from "./PanelSection";
import { pageHref } from "./pages";
import { swatchName, tokenRow } from "./token-row";
import type { Highlight } from "./view";

// The Scales section of the inspector (spec section 7.8, 10.2): the 8 palettes, two to a row, each as
// its 11 steps for the canvas's mode, one step per line: the number, a swatch, the hex and the WCAG
// ratio against the page. Each line is one button; choosing it opens that step's token row in place
// (R5-47), one at a time, the swatch morphing. The swatch is data (`data-swatch`), the only color
// here. A step "show me" picks carries `data-show-me-cell`, which highlight.css outlines. After the
// palettes, a link opens the design in the explorer (13.7 of docs/specs/05-motion-3d.md).

type Palette = DesignSpec["color"]["palettes"][PaletteName];
type Open = { readonly palette: PaletteName; readonly step: Step };

const COPIED_MS = 2000;
const BLOCKED = "Copy is blocked here. The text is selected: press Ctrl+C or ⌘C.";
const CELLS = "grid w-full items-center gap-x-1 rounded-[3px] text-left";
// M2's columns; the open row's swatch is 24 px, so its column is wider.
const COMPACT = "grid-cols-[1.75rem_0.75rem_minmax(0,1fr)]";
const OPENED = "grid-cols-[1.75rem_1.5rem_minmax(0,1fr)]";
// The ratio sits beside its button, not in it: the button's name is "<palette> <step>, <hex>" (R5-47),
// so a ratio inside would be visible text the name lacks (axe: label-content-name-mismatch).
const LINE = "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1";

export const Scales = memo(function Scales({
  spec,
  mode,
  cells,
}: {
  spec: DesignSpec;
  mode: Mode;
  cells: Highlight["cells"];
}) {
  const [open, setOpen] = useState<Open | null>(null);
  // The step whose compact or open button takes focus once the next commit lands.
  const focusAfter = useRef<Open | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const explorer = useMemo(() => pageHref("explore", spec), [spec]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per change of the open step.
  useLayoutEffect(() => {
    const target = focusAfter.current;
    focusAfter.current = null;
    if (target === null) return;
    root.current
      ?.querySelector<HTMLElement>(
        `[data-palette="${target.palette}"] [data-step="${target.step}"] button`,
      )
      ?.focus();
  }, [open]);

  function choose(next: Open | null, focus: Open): void {
    focusAfter.current = focus;
    startTransition(() => setOpen(next));
  }

  return (
    <PanelSection
      first
      title="Scales"
      note={`The ${mode} steps, each with its contrast against the page.`}
    >
      <div ref={root} className="grid grid-cols-2 gap-x-3 gap-y-4">
        {PALETTE_NAMES.map((name) => (
          <PaletteSteps
            key={name}
            spec={spec}
            palette={spec.color.palettes[name]}
            mode={mode}
            lit={cells.filter((cell) => cell.palette === name).map((cell) => cell.step)}
            open={open?.palette === name ? open.step : null}
            onChoose={(step) => {
              const same = open?.palette === name && open.step === step;
              choose(same ? null : { palette: name, step }, { palette: name, step });
            }}
          />
        ))}
      </div>
      <a
        href={explorer}
        className="inline-flex min-h-6 w-fit items-center text-foreground text-xs underline underline-offset-4 hover:text-fg-muted"
      >
        See these scales in the explorer
      </a>
    </PanelSection>
  );
});

function PaletteSteps({
  spec,
  palette,
  mode,
  lit,
  open,
  onChoose,
}: {
  spec: DesignSpec;
  palette: Palette;
  mode: Mode;
  lit: readonly Step[];
  open: Step | null;
  onChoose(step: Step): void;
}) {
  const seed = palette.seedStep?.[mode];
  const deviation = palette.seedDeviation;
  // The palette's one Tab stop: the step whose button last had focus (a roving tabIndex).
  const [stop, setStop] = useState<Step>(STEPS[0]);
  const list = useRef<HTMLOListElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLOListElement>): void {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.hasAttribute("data-step-button")) return;
    const index = STEPS.findIndex(
      (step) => String(step) === target.closest("li")?.getAttribute("data-step"),
    );
    const next =
      event.key === "ArrowDown"
        ? Math.min(index + 1, STEPS.length - 1)
        : event.key === "ArrowUp"
          ? Math.max(index - 1, 0)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? STEPS.length - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    list.current
      ?.querySelector<HTMLElement>(`[data-step="${STEPS[next]}"] [data-step-button]`)
      ?.focus();
  }

  return (
    <div data-palette={palette.name} className="min-w-0">
      <h4 className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
        <span className="text-foreground">{palette.name}</span>
        {seed !== undefined && <span className="text-fg-muted">seed {seed}</span>}
      </h4>
      {deviation !== undefined && (
        <p
          data-seed-deviation=""
          className="mt-0.5 font-mono text-[11px] text-fg-muted leading-snug"
        >
          Seed moved ΔE {deviation.deltaEOK.toFixed(3)} at step {deviation.step}
        </p>
      )}
      <ol ref={list} className="mt-1.5" onKeyDown={onKeyDown}>
        {palette[mode].map((step) => {
          const isSeed = step.step === seed;
          const isOpen = open === step.step;
          const label = `${palette.name} ${step.step}, ${step.hex}`;
          const name = swatchName(palette.name, step.step);
          const button = {
            type: "button" as const,
            "data-step-button": "",
            "aria-label": label,
            "aria-expanded": isOpen,
            tabIndex: stop === step.step ? 0 : -1,
            onFocus: () => setStop(step.step),
            onClick: () => onChoose(step.step),
            className: `${CELLS} ${isOpen ? OPENED : COMPACT} min-h-6 font-mono text-[11px] tabular-nums leading-5`,
          };
          const swatch = (size: string) => (
            <ViewTransition name={name} share="dyelot-morph" default="none">
              <span
                data-swatch=""
                aria-hidden="true"
                className={`${size} rounded-[2px] ${isSeed ? "shadow-[0_0_0_1px_var(--page),0_0_0_2px_var(--foreground)]" : ""}`}
                style={{ backgroundColor: step.hex }}
              />
            </ViewTransition>
          );
          return (
            <li
              key={step.step}
              data-step={step.step}
              data-seed={isSeed ? "" : undefined}
              data-show-me-cell={lit.includes(step.step) ? "" : undefined}
              data-token-row={isOpen ? "" : undefined}
              className="rounded-[3px]"
            >
              {isOpen ? (
                <OpenRow
                  spec={spec}
                  mode={mode}
                  palette={palette.name}
                  step={step.step}
                  button={button}
                  swatch={swatch("size-6")}
                  seed={isSeed}
                  onClose={() => onChoose(step.step)}
                />
              ) : (
                <div className={`${LINE} font-mono text-[11px] tabular-nums leading-5`}>
                  <button {...button}>
                    <span data-step-number="" className="text-fg-muted">
                      {step.step}
                    </span>
                    {swatch("size-3")}
                    <span data-hex="" translate="no" className="text-foreground">
                      {step.hex}
                    </span>
                    {isSeed && <span className="sr-only"> seed</span>}
                  </button>
                  <span data-ratio="" className="text-right text-fg-muted">
                    {step.contrast.toFixed(2)}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type Copy = "idle" | "copied" | "blocked";

function OpenRow({
  spec,
  mode,
  palette,
  step,
  button,
  swatch,
  seed,
  onClose,
}: {
  spec: DesignSpec;
  mode: Mode;
  palette: PaletteName;
  step: Step;
  button: Record<string, unknown>;
  swatch: React.ReactNode;
  seed: boolean;
  onClose(): void;
}) {
  const row = tokenRow(spec, mode, palette, step);
  const [copy, setCopy] = useState<Copy>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const variable = useRef<HTMLElement>(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copyVariable(): Promise<void> {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(row.cssVar);
    } catch {
      // A missing or refusing clipboard: the text is selected for the visitor.
      setCopy("blocked");
      const element = variable.current;
      if (element !== null) {
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      return;
    }
    setCopy("copied");
    timer.current = setTimeout(() => setCopy("idle"), COPIED_MS);
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape inside the row closes it; the buttons are the controls.
    <div
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        // The row takes the key: a drawer around it stays open.
        event.stopPropagation();
        onClose();
      }}
      className="my-1 rounded-[3px] border border-border bg-page px-1 py-1 font-mono text-[11px] leading-5"
    >
      <div className={LINE}>
        <button {...button}>
          <span data-step-number="" className="text-fg-muted">
            {step}
          </span>
          {swatch}
          <span data-hex="" translate="no" className="text-foreground">
            {row.hex}
          </span>
          {seed && <span className="sr-only"> seed</span>}
        </button>
        <span data-ratio="" className="text-right text-fg-muted">
          {row.contrast.slice(0, -2)}
        </span>
      </div>
      <dl className="mt-1 grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-0.5">
        <dt className="text-fg-muted">Tailwind</dt>
        <dd className="min-w-0 break-all">
          <code translate="no">{row.token}</code> <code translate="no">{row.utility}</code>
        </dd>
        <dt className="text-fg-muted">CSS</dt>
        <dd className="min-w-0 break-all">
          <code translate="no" ref={variable}>
            {row.cssVar}
          </code>
        </dd>
        <dt className="text-fg-muted">Hex</dt>
        <dd translate="no">{row.hex}</dd>
        <dt className="text-fg-muted">OKLCH</dt>
        <dd translate="no" className="break-words">
          {row.oklch}
        </dd>
        <dt className="text-fg-muted">Contrast</dt>
        <dd>{row.contrast}</dd>
      </dl>
      <p className="mt-1 break-words text-fg-muted">
        {row.roles.length > 0 ? `Roles: ${row.roles.join(", ")}` : `Roles: none in ${mode} mode.`}
      </p>
      <button
        type="button"
        aria-label={`Copy ${row.cssVar}`}
        onClick={() => void copyVariable()}
        className="mt-1 inline-flex min-h-6 items-center rounded-[3px] border border-border-bright px-2 text-foreground"
      >
        {copy === "copied" ? "Copied" : "Copy"}
      </button>
      <p role="status" className={copy === "blocked" ? "mt-1 text-fg-muted" : "sr-only"}>
        {copy === "blocked" ? BLOCKED : ""}
      </p>
    </div>
  );
}
