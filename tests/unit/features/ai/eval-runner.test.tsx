import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EVAL_BRIEFS } from "@/features/ai/eval/briefs";
import { EvalRunner } from "@/features/ai/eval/EvalRunner";
import { copyProblems } from "../../ai/copy-rules";
import { BRIEF_OUT } from "../../ai/fixtures";

// R4-32 of docs/specs/04-ai.md: the dev page's runner sends each brief of EVAL_BRIEFS to Chrome's
// built-in model, one session at a time, through `promptOnDevice`, reads each reply with
// `evaluateReply`, and shows, per brief, whether the reply was JSON, passed the schema and passed
// the engine, then the pass rate. A fake `LanguageModel` stands in for Chrome's.

const N = EVAL_BRIEFS.length;
const brief = (index: number) => EVAL_BRIEFS[index] as string;

/** A model that is `state` and answers each brief with `answer(brief)`, or throws what it throws. */
function fakeModel(state: string, answer: (brief: string) => Promise<string> | string) {
  const calls = { create: 0, prompt: 0, destroy: 0 };
  const model = {
    availability: async () => state,
    create: async () => {
      calls.create += 1;
      return {
        prompt: async (user: string) => {
          calls.prompt += 1;
          const asked = EVAL_BRIEFS.find((each) => user.includes(each));
          if (asked === undefined) throw new Error("the fake was asked no brief of the set");
          return answer(asked);
        },
        destroy: () => {
          calls.destroy += 1;
        },
      };
    },
  };
  vi.stubGlobal("LanguageModel", model);
  return calls;
}

const runButton = () => screen.getByRole("button", { name: "Run the evaluation" });
const status = () => screen.getByRole("status");
const rowOf = (text: string) => {
  const row = screen.getByRole("row", { name: new RegExp(`^${text}`) });
  return within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("R4-32 the on-device eval runner", () => {
  it("R4-32 shows each brief's JSON, schema and engine results and the pass rate", async () => {
    const good = JSON.stringify(BRIEF_OUT);
    const calls = fakeModel("available", (asked) => {
      if (asked === brief(1)) return "Here is a calm design.";
      if (asked === brief(2)) return "{}";
      if (asked === brief(3)) throw new Error("the model broke");
      return good;
    });
    render(<EvalRunner />);
    await waitFor(() => expect(status()).toHaveTextContent("Chrome's built-in model is ready."));
    fireEvent.click(runButton());
    await waitFor(() => expect(status()).toHaveTextContent(`Done: ${N} of ${N} briefs.`), {
      timeout: 25_000,
    });
    const table = screen.getByRole("table", { name: "Results" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Brief", "JSON", "Schema", "Engine"]);
    // One row per brief, in the set's order.
    expect(within(table).getAllByRole("row")).toHaveLength(N + 1);
    expect(rowOf(brief(0))).toEqual(["yes", "yes", "yes"]);
    expect(rowOf(brief(1))).toEqual(["no", "no", "no"]);
    expect(rowOf(brief(2))).toEqual(["yes", "no", "no"]);
    expect(rowOf(brief(3))).toEqual(["no reply", "no", "no"]);
    const passed = N - 3;
    expect(screen.getByText(/^Passed every check:/)).toHaveTextContent(
      `Passed every check: ${passed} of ${N} (${Math.round((passed / N) * 100)}%).`,
    );
    expect(screen.getByText(/^JSON:/)).toHaveTextContent(
      `JSON: ${N - 2} of ${N}. Schema: ${N - 3} of ${N}. Engine: ${N - 3} of ${N}.`,
    );
    // One session per brief, each destroyed.
    expect(calls).toEqual({ create: N, prompt: N, destroy: N });
    expect(copyProblems(document.body.textContent ?? "")).toEqual([]);
  }, 30_000);

  it.each([
    [
      "absent",
      undefined,
      "This browser has no built-in model. Open this page in desktop Chrome 148 or later.",
    ],
    ["unavailable", "unavailable", "Chrome's built-in model is not available on this device."],
    [
      "downloadable",
      "downloadable",
      "Chrome's built-in model is not downloaded yet. Download it from AI settings in the studio, then reload this page.",
    ],
  ])("R4-32 runs nothing when the model is %s, and says why", async (_name, state, sentence) => {
    let calls: { create: number } | null = null;
    if (state === undefined) vi.stubGlobal("LanguageModel", undefined);
    else calls = fakeModel(state, () => "{}");
    render(<EvalRunner />);
    await waitFor(() => expect(status()).toHaveTextContent(sentence));
    expect(runButton()).toHaveAttribute("aria-disabled", "true");
    expect(runButton()).toHaveAccessibleDescription(sentence);
    fireEvent.click(runButton());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.queryByRole("table")).toBeNull();
    if (calls !== null) expect(calls.create).toBe(0);
  });

  it("R4-32 Cancel stops the run after the brief in flight and says how far it got", async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls = fakeModel("available", async (asked) => {
      if (asked === brief(1)) await held;
      return JSON.stringify(BRIEF_OUT);
    });
    render(<EvalRunner />);
    await waitFor(() => expect(status()).toHaveTextContent("Chrome's built-in model is ready."));
    fireEvent.click(runButton());
    await waitFor(() => expect(status()).toHaveTextContent(`Running brief 2 of ${N}…`), {
      timeout: 10_000,
    });
    expect(runButton()).toHaveAttribute("aria-busy", "true");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(status()).toHaveTextContent(`Canceled after 1 of ${N} briefs.`));
    release();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(calls.prompt).toBe(2);
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(runButton()).not.toHaveAttribute("aria-disabled");
  }, 30_000);
});
