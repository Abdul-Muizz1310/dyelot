"use client";

import { useEffect, useId, useRef, useState } from "react";
import { EVAL_BRIEFS, type EvalVerdict, evaluateReply } from "@/features/ai/eval/briefs";
import { type AiModule, loadAi } from "@/features/ai/load";
import { type OnDeviceState, onDeviceState, promptOnDevice } from "@/features/ai/on-device";
import { LOAD_FAILED_LINE } from "@/features/ai/useAiAction";
import { BUTTON, PRIMARY_BUTTON } from "@/features/studio/chrome";

// The on-device eval (docs/specs/04-ai.md, R4-32), run by the owner on `pnpm dev` in a capable
// Chrome: each brief of EVAL_BRIEFS goes to Chrome's built-in model through `promptOnDevice`, one
// session at a time, and `evaluateReply` reads the reply. The page shows, per brief, whether the
// reply was JSON, passed the schema and passed the engine, then the pass rate, which the owner
// records in the spec's close note before "(experimental)" can leave the switch's label.

/** One brief's result: its verdict, or null when the model gave no reply (a throw or a timeout). */
type Row = { readonly brief: string; readonly verdict: EvalVerdict | null };
/** How the last run ended, or null while none has. */
type Ending = "done" | "canceled" | "load-failed";

const TOTAL = EVAL_BRIEFS.length;

/** `globalThis.LanguageModel`, or undefined where the Prompt API is absent (R4-31). */
const languageModel = (): unknown => (globalThis as { LanguageModel?: unknown }).LanguageModel;

/** Why the run cannot start in this state, or null when the model is ready. */
function reasonFor(state: OnDeviceState): string | null {
  switch (state) {
    case "available":
      return null;
    case "absent":
      return "This browser has no built-in model. Open this page in desktop Chrome 148 or later.";
    case "unavailable":
      return "Chrome's built-in model is not available on this device.";
    case "downloadable":
    case "downloading":
      return "Chrome's built-in model is not downloaded yet. Download it from AI settings in the studio, then reload this page.";
  }
}

const READY_LINE = "Chrome's built-in model is ready.";
const CHECKING_LINE = "Checking Chrome's built-in model…";

/** `count of total (percent%)`, the percent rounded to a whole number. */
const share = (count: number, total: number): string =>
  `${count} of ${total} (${Math.round((count / total) * 100)}%)`;
const yesNo = (value: boolean): string => (value ? "yes" : "no");

export function EvalRunner() {
  const [state, setState] = useState<OnDeviceState | null>(null);
  const [rows, setRows] = useState<readonly Row[]>([]);
  const [running, setRunning] = useState(false);
  const [ending, setEnding] = useState<Ending | null>(null);
  const controller = useRef<AbortController | null>(null);
  const runButton = useRef<HTMLButtonElement | null>(null);
  const statusId = useId();

  useEffect(() => {
    let live = true;
    void onDeviceState(languageModel()).then((read) => {
      if (live) setState(read);
    });
    return () => {
      live = false;
      controller.current?.abort();
    };
  }, []);

  const reason = state === null ? CHECKING_LINE : reasonFor(state);
  // While the model cannot run, the status line says why, and it describes the button.
  const blocked = reason !== null && !running;

  async function run(): Promise<void> {
    if (running || reason !== null) return;
    const own = new AbortController();
    controller.current = own;
    setRunning(true);
    setRows([]);
    setEnding(null);
    let ai: AiModule;
    try {
      ai = await loadAi();
    } catch {
      controller.current = null;
      setRunning(false);
      setEnding("load-failed");
      return;
    }
    for (const brief of EVAL_BRIEFS) {
      if (own.signal.aborted) break;
      let verdict: EvalVerdict | null;
      try {
        const text = await promptOnDevice(ai, "brief", ai.briefInput(brief, {}), {
          lm: languageModel(),
          signal: own.signal,
        });
        verdict = evaluateReply(ai, text);
      } catch {
        verdict = null;
      }
      // A reply that lands after the cancel is not counted.
      if (own.signal.aborted) break;
      setRows((done) => [...done, { brief, verdict }]);
    }
    if (controller.current === own) controller.current = null;
    setRunning(false);
    setEnding(own.signal.aborted ? "canceled" : "done");
  }

  const statusLine = (): string => {
    if (running) return `Running brief ${rows.length + 1} of ${TOTAL}…`;
    if (ending === "load-failed") return LOAD_FAILED_LINE;
    if (ending === "canceled") return `Canceled after ${rows.length} of ${TOTAL} briefs.`;
    if (ending === "done") return `Done: ${rows.length} of ${TOTAL} briefs.`;
    return reason ?? READY_LINE;
  };

  const count = (check: keyof EvalVerdict): number =>
    rows.filter((row) => row.verdict?.[check] === true).length;
  const passed = rows.filter(
    (row) => row.verdict?.json === true && row.verdict.schema && row.verdict.engine,
  ).length;

  return (
    <div className="space-y-5">
      <p className="text-foreground text-sm leading-relaxed">
        {`Sends each of the ${TOTAL} briefs of the evaluation set to Chrome's built-in model, one at a time, and checks each reply: whether it is JSON, whether it passes the schema and its checks, and whether the engine makes a design from it.`}
      </p>
      <p id={statusId} role="status" className="text-foreground text-sm">
        {statusLine()}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          ref={runButton}
          type="button"
          data-primary=""
          aria-disabled={blocked ? "true" : undefined}
          aria-busy={running ? "true" : undefined}
          aria-describedby={blocked ? statusId : undefined}
          onClick={() => void run()}
          className={`${PRIMARY_BUTTON} min-h-9 px-4 aria-disabled:cursor-not-allowed aria-disabled:opacity-70`}
        >
          Run the evaluation
        </button>
        {running && (
          <button
            type="button"
            onClick={() => {
              controller.current?.abort();
              // "Cancel" goes away with the run: focus goes back to the run's button.
              runButton.current?.focus();
            }}
            className={BUTTON}
          >
            Cancel
          </button>
        )}
      </div>
      {rows.length > 0 && (
        <div className="space-y-3">
          <p className="text-foreground text-sm">
            {`Passed every check: ${share(passed, rows.length)}.`}
          </p>
          <p className="text-fg-muted text-xs">
            {`JSON: ${count("json")} of ${rows.length}. Schema: ${count("schema")} of ${rows.length}. Engine: ${count("engine")} of ${rows.length}.`}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <caption className="sr-only">Results</caption>
              <thead>
                <tr className="border-border border-b text-fg-muted">
                  <th scope="col" className="py-1.5 pr-3 font-medium">
                    Brief
                  </th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">
                    JSON
                  </th>
                  <th scope="col" className="py-1.5 pr-3 font-medium">
                    Schema
                  </th>
                  <th scope="col" className="py-1.5 font-medium">
                    Engine
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.brief} className="border-border border-b text-foreground">
                    <th scope="row" className="py-1.5 pr-3 font-normal">
                      {row.brief}
                    </th>
                    <td className="py-1.5 pr-3">
                      {row.verdict === null ? "no reply" : yesNo(row.verdict.json)}
                    </td>
                    <td className="py-1.5 pr-3">{yesNo(row.verdict?.schema === true)}</td>
                    <td className="py-1.5">{yesNo(row.verdict?.engine === true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
