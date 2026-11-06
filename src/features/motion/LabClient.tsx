"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  bezierPoints,
  MOTION_DURATION_NAMES,
  MOTION_EASING_NAMES,
  MOTION_PRESET_IDS,
  MOTION_PRESETS,
  MOTION_SPRING_NAMES,
  type MotionTokens,
  motionPresetOf,
  springCurve,
  withMotion,
} from "@/engine";
import { downloadBlob } from "@/features/export/download";
import { loadExport } from "@/features/export/useBundle";
import { useOsReducedMotion } from "@/features/preview/kit/reduced";
import { PRESSED, TOGGLE_BUTTON, TOOL_BUTTON } from "@/features/studio/chrome";
import { lotTag } from "@/features/studio/lot";
import { pageHref } from "@/features/studio/pages";
import { bannerFor, readHash, writeHash } from "@/features/studio/url";
import { SITE } from "@/lib/site/config";
import { type DesignSpec, specId } from "@/spec";
import {
  curvePath,
  durationBars,
  editTokens,
  fieldText,
  presetLine,
  readField,
  type TokenPath,
} from "./lab";
import { Previews } from "./Previews";

// The motion lab (spec R5-41 to R5-45, 9.1 to 9.6): the design's motion tokens as a ladder, curves
// and fields, the live previews, and the three motion files. Every edit makes the new spec with
// `withMotion` at once; the hash follows 300 ms after the last one.

const HASH_DELAY_MS = 300;
const COPIED_MS = 2000;
const LOAD_FAILED = "This tool could not load. Reload the page to try again.";
const COPY_BLOCKED = "Copy is blocked here. The text is selected: press Ctrl+C or ⌘C.";
const CALM_NOTE =
  "The calm feel stretches each duration by a quarter, up to 500 ms, in the exported files.";
const FILE_PATHS = ["motion/motion.css", "motion/motion.ts", "motion/gsap.ts"] as const;
const EASING_PARTS = ["x1", "y1", "x2", "y2"] as const;
const FIELD =
  "h-9 w-24 rounded-md border border-control-edge bg-page px-2 font-mono text-foreground text-sm tabular-nums hover:border-fg-muted aria-invalid:border-foreground";
const HEADING = "font-mono text-fg-muted text-xs lowercase tracking-[0.08em]";

type ExportModule = Awaited<ReturnType<typeof loadExport>>;

function tokensOf(spec: DesignSpec): MotionTokens {
  const { durations, easings, springs } = spec.motion;
  return { durations, easings, springs };
}

/** One token's text field: a valid entry applies at once, an invalid one is marked and kept out. */
function TokenField({
  label,
  path,
  tokens,
  onApply,
}: {
  label: string;
  path: TokenPath;
  tokens: MotionTokens;
  onApply(path: TokenPath, value: number): void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const [draft, setDraft] = useState<{ text: string; error: string | null } | null>(null);
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-fg-muted text-xs">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={draft?.text ?? fieldText(tokens, path)}
        aria-invalid={draft?.error != null}
        aria-describedby={draft?.error != null ? errorId : undefined}
        onChange={(event) => {
          const text = event.currentTarget.value;
          const read = readField(path, text);
          if (read.ok) {
            setDraft({ text, error: null });
            onApply(path, read.value);
          } else {
            setDraft({ text, error: read.message });
          }
        }}
        onBlur={() => setDraft(null)}
        className={FIELD}
      />
      {draft?.error != null && (
        <p id={errorId} className="max-w-48 text-foreground text-xs">
          {draft.error}
        </p>
      )}
    </div>
  );
}

function Ladder({ spec }: { spec: DesignSpec }) {
  const bars = durationBars(spec);
  const width = 480;
  const row = 32;
  const labels = bars.map((bar) =>
    bar.exported === bar.stored
      ? `${bar.name} ${bar.stored} ms`
      : `${bar.name} ${bar.stored} ms, exported as ${bar.exported} ms`,
  );
  const changed = bars.some((bar) => bar.exported !== bar.stored);
  return (
    <div className="space-y-2">
      <svg
        role="img"
        aria-label={`Durations: ${bars.map((bar) => `${bar.name} ${bar.stored} ms`).join(", ")}`}
        viewBox={`0 0 ${width} ${row * bars.length}`}
        className="w-full max-w-xl text-foreground"
      >
        {bars.map((bar, index) => (
          <g key={bar.name} transform={`translate(0 ${index * row})`}>
            <text x="0" y="12" fontSize="12" fill="currentColor" className="font-mono">
              {labels[index]}
            </text>
            <rect x="0" y="17" width={width} height="8" fill="currentColor" opacity="0.12" />
            <rect
              x="0"
              y="17"
              width={(bar.exported / 500) * width}
              height="8"
              className="fill-foreground"
            />
          </g>
        ))}
      </svg>
      {changed && <p className="text-fg-muted text-xs">{CALM_NOTE}</p>}
    </div>
  );
}

const BOX = { width: 200, height: 200, pad: 20 } as const;

function Curve({ label, d, guide }: { label: string; d: string; guide?: string }) {
  return (
    <svg role="img" aria-label={label} viewBox="0 0 200 200" className="size-40 text-foreground">
      <rect
        x="0.5"
        y="0.5"
        width="199"
        height="199"
        fill="none"
        stroke="currentColor"
        opacity="0.2"
      />
      {guide !== undefined && (
        <path d={guide} fill="none" stroke="currentColor" strokeDasharray="4 4" opacity="0.3" />
      )}
      <path d={d} fill="none" strokeWidth="2" className="stroke-foreground" />
    </svg>
  );
}

export function LabClient({ initial }: { initial: DesignSpec }) {
  const [spec, setSpec] = useState(initial);
  const [notice, setNotice] = useState("");
  const [reducedChoice, setReducedChoice] = useState<boolean | null>(null);
  const osReduced = useOsReducedMotion();
  const reduced = reducedChoice ?? osReduced;
  const [exporter, setExporter] = useState<ExportModule | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [opened, setOpened] = useState<readonly string[]>([]);
  const [selectAsked, setSelectAsked] = useState<{ path: string; count: number } | null>(null);
  const specRef = useRef(spec);
  const hashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pres = useRef(new Map<string, HTMLPreElement>());
  const preparingId = useId();
  const tokens = useMemo(() => tokensOf(spec), [spec]);

  // The link in the hash opens on load, and a later `hashchange` loads another design (R5-40, 9.6).
  useEffect(() => {
    const read = (fallback: string) => {
      const result = readHash(location.hash);
      if (result.kind === "spec") {
        specRef.current = result.spec;
        setSpec(result.spec);
        setNotice("");
      } else if (result.kind === "error") {
        const link = bannerFor({
          kind: "link",
          reason: result.reason,
          ...(result.issues === undefined ? {} : { issues: result.issues }),
          fallback: "current",
        });
        setNotice(`${link.message} ${fallback}`);
      }
    };
    read("The lab shows the default design instead.");
    const onHashChange = () => read("The lab keeps the current design.");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // `@/export` loads after the first paint, never with the page (R5-44, I-M5-03).
  useEffect(() => {
    let live = true;
    loadExport().then(
      (module) => {
        if (live) setExporter(module);
      },
      () => {
        if (live) setLoadFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(
    () => () => {
      clearTimeout(hashTimer.current);
      clearTimeout(copiedTimer.current);
    },
    [],
  );

  function commit(next: MotionTokens): void {
    const made = withMotion(specRef.current, next);
    specRef.current = made;
    setSpec(made);
    clearTimeout(hashTimer.current);
    hashTimer.current = setTimeout(() => {
      history.replaceState(null, "", writeHash(specRef.current));
    }, HASH_DELAY_MS);
  }

  const files = useMemo(
    () => exporter?.motionFiles(spec, spec.meta.name, lotTag(specId(spec)), SITE.url) ?? null,
    [exporter, spec],
  );
  const ready = files !== null;

  // A blocked copy selects the file's text once its disclosure shows.
  useEffect(() => {
    if (selectAsked === null) return;
    const element = pres.current.get(selectAsked.path);
    if (element === undefined) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [selectAsked]);

  async function copy(path: string): Promise<void> {
    const file = files?.find((each) => each.path === path);
    if (file === undefined) return;
    clearTimeout(copiedTimer.current);
    try {
      await navigator.clipboard.writeText(file.text);
    } catch {
      setCopied(null);
      setOpened((paths) => (paths.includes(path) ? paths : [...paths, path]));
      setSelectAsked((last) => ({ path, count: (last?.count ?? 0) + 1 }));
      setMessage(COPY_BLOCKED);
      return;
    }
    setCopied(path);
    setMessage(`Copied ${path}.`);
    copiedTimer.current = setTimeout(() => setCopied(null), COPIED_MS);
  }

  function download(path: string): void {
    const file = files?.find((each) => each.path === path);
    if (file === undefined) return;
    const name = path.slice(path.lastIndexOf("/") + 1);
    downloadBlob(
      name,
      new TextEncoder().encode(file.text),
      path.endsWith(".css") ? "text/css" : "text/plain",
    );
    setMessage(`Downloaded ${name}.`);
  }

  const preset = motionPresetOf(tokens);
  const apply = (path: TokenPath, value: number) =>
    commit(editTokens(tokensOf(specRef.current), path, value));

  return (
    <div
      data-lab=""
      data-preset={preset ?? "custom"}
      data-lab-reduced={String(reduced)}
      className="space-y-8"
    >
      <p role="status" data-lab-notice="" className="min-h-5 text-sm">
        {notice}
      </p>

      <section aria-labelledby="lab-presets" className="space-y-3">
        <h2 id="lab-presets" className={HEADING}>
          Presets
        </h2>
        <fieldset aria-label="Presets" className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
          {MOTION_PRESET_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={preset === id}
              onClick={() => commit(MOTION_PRESETS[id].tokens)}
              className={`${TOGGLE_BUTTON} min-h-8 px-3 text-sm ${PRESSED}`}
            >
              {MOTION_PRESETS[id].label}
            </button>
          ))}
        </fieldset>
        <p data-preset-line="" className="text-fg-muted text-sm">
          {presetLine(tokens)}
        </p>
      </section>

      <section aria-labelledby="lab-durations" className="space-y-3">
        <h2 id="lab-durations" className={HEADING}>
          Durations
        </h2>
        <Ladder spec={spec} />
        <div className="flex flex-wrap gap-3">
          {MOTION_DURATION_NAMES.map((name) => (
            <TokenField
              key={name}
              label={`${name} (ms)`}
              path={{ kind: "duration", name }}
              tokens={tokens}
              onApply={apply}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="lab-easings" className="space-y-3">
        <h2 id="lab-easings" className={HEADING}>
          Easings
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {MOTION_EASING_NAMES.map((name) => {
            const easing = tokens.easings[name];
            const caption = `${name}: cubic-bezier(${easing.join(", ")})`;
            const box = { ...BOX, yMin: -1, yMax: 2 };
            return (
              <figure key={name} className="space-y-2">
                <Curve
                  label={caption}
                  d={curvePath(bezierPoints(easing, 64), box)}
                  guide={curvePath(
                    [
                      [0, 0],
                      [1, 1],
                    ],
                    box,
                  )}
                />
                <figcaption className="font-mono text-xs">{caption}</figcaption>
                <div className="flex flex-wrap gap-2">
                  {EASING_PARTS.map((part, index) => (
                    <TokenField
                      key={part}
                      label={`${name} ${part}`}
                      path={{ kind: "easing", name, index: index as 0 | 1 | 2 | 3 }}
                      tokens={tokens}
                      onApply={apply}
                    />
                  ))}
                </div>
              </figure>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="lab-springs" className="space-y-3">
        <h2 id="lab-springs" className={HEADING}>
          Springs
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {MOTION_SPRING_NAMES.map((name) => {
            const spring = tokens.springs[name];
            const curve = springCurve(spring);
            const last = curve.samples.length - 1;
            const caption = `${name}: ${spring.visualDuration} s, bounce ${spring.bounce}, settles in ${curve.settleMs} ms`;
            const points = curve.samples.map((y, index) => [index / last, y] as [number, number]);
            return (
              <figure key={name} className="space-y-2">
                <Curve label={caption} d={curvePath(points, { ...BOX, yMin: -0.2, yMax: 1.6 })} />
                <figcaption className="font-mono text-xs">{caption}</figcaption>
                <div className="flex flex-wrap gap-2">
                  <TokenField
                    label={`${name} duration (s)`}
                    path={{ kind: "spring", name, field: "visualDuration" }}
                    tokens={tokens}
                    onApply={apply}
                  />
                  <TokenField
                    label={`${name} bounce`}
                    path={{ kind: "spring", name, field: "bounce" }}
                    tokens={tokens}
                    onApply={apply}
                  />
                </div>
              </figure>
            );
          })}
        </div>
      </section>

      <Previews spec={spec} reduced={reduced} onReducedChange={setReducedChoice} />

      <section aria-labelledby="lab-files" className="space-y-3">
        <h2 id="lab-files" className={HEADING}>
          Files
        </h2>
        <span id={preparingId} hidden>
          Preparing the files…
        </span>
        <ul aria-label="Files" className="border-border border-t text-sm">
          {FILE_PATHS.map((path) => {
            const text = files?.find((file) => file.path === path)?.text ?? "";
            const disabledProps = {
              "aria-disabled": ready ? undefined : true,
              "aria-describedby": ready || loadFailed ? undefined : preparingId,
            } as const;
            return (
              <li key={path} data-file={path} className="space-y-2 border-border border-b py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 font-mono">{path}</span>
                  <button
                    type="button"
                    aria-label={`Copy ${path}`}
                    {...disabledProps}
                    onClick={() => void copy(path)}
                    className={`${TOOL_BUTTON} min-w-16 justify-center`}
                  >
                    {copied === path ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Download ${path}`}
                    {...disabledProps}
                    onClick={() => download(path)}
                    className={`${TOOL_BUTTON} justify-center`}
                  >
                    Download
                  </button>
                </div>
                <details
                  open={opened.includes(path)}
                  onToggle={(event) => {
                    const open = event.currentTarget.open;
                    setOpened((paths) =>
                      open
                        ? paths.includes(path)
                          ? paths
                          : [...paths, path]
                        : paths.filter((each) => each !== path),
                    );
                  }}
                >
                  <summary className="cursor-pointer text-fg-muted text-xs">Show {path}</summary>
                  <pre
                    ref={(element) => {
                      if (element === null) pres.current.delete(path);
                      else pres.current.set(path, element);
                    }}
                    className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-control-edge bg-page p-3 font-mono text-xs [overflow-wrap:anywhere]"
                  >
                    {text}
                    {text.endsWith("\n") && <br />}
                  </pre>
                </details>
              </li>
            );
          })}
        </ul>
        <p role="status" data-lab-files-status="" className="min-h-5 text-sm">
          {loadFailed ? LOAD_FAILED : message}
        </p>
      </section>

      <a
        href={pageHref("studio", spec)}
        className="inline-block text-foreground text-sm underline underline-offset-4 hover:text-fg-muted"
      >
        Open in the studio
      </a>
    </div>
  );
}
