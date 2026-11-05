import { describe, expect, it } from "vitest";
import * as ai from "@/ai";
import { EVAL_BRIEFS, evaluateReply } from "@/features/ai/eval/briefs";
import { isPlainText } from "@/spec";
import { copyProblems } from "../../ai/copy-rules";
import { BRIEF_OUT } from "../../ai/fixtures";

// C-DEV-05 of docs/specs/04-ai.md, section 14.9 (R4-32): the on-device eval set, and the reader that
// says whether a reply was JSON, passed the schema (R4-38) and passed the engine (generateSystem on
// briefChange of fresh parameters).

describe("C-DEV-05 the on-device eval set", () => {
  it("C-DEV-05 holds at least 20 distinct briefs and is frozen", () => {
    expect(EVAL_BRIEFS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(EVAL_BRIEFS).size).toBe(EVAL_BRIEFS.length);
    expect(Object.isFrozen(EVAL_BRIEFS)).toBe(true);
  });

  it("C-DEV-05 holds plain text of 1 to 500 characters that briefInput accepts", () => {
    for (const brief of EVAL_BRIEFS) {
      expect(typeof brief).toBe("string");
      expect(brief.length, brief).toBeGreaterThanOrEqual(1);
      expect(brief.length, brief).toBeLessThanOrEqual(500);
      expect(isPlainText(brief), brief).toBe(true);
      expect(brief.trim(), brief).toBe(brief);
      expect(() => ai.briefInput(brief, {}), brief).not.toThrow();
    }
  });

  it("C-DEV-05 keeps the briefs to the copy rules: American English, no banned word, no ! and no emoji", () => {
    for (const brief of EVAL_BRIEFS) expect(copyProblems(brief), brief).toEqual([]);
  });

  it("C-DEV-05 evaluateReply gives false, false, false for text that is not JSON", () => {
    expect(evaluateReply(ai, "nope")).toEqual({ json: false, schema: false, engine: false });
    expect(evaluateReply(ai, "")).toEqual({ json: false, schema: false, engine: false });
    expect(evaluateReply(ai, "[1, 2]")).toEqual({ json: false, schema: false, engine: false });
  });

  it("C-DEV-05 evaluateReply gives true, false, false for {}", () => {
    expect(evaluateReply(ai, "{}")).toEqual({ json: true, schema: false, engine: false });
  });

  it("C-DEV-05 evaluateReply gives false for the schema when a value check fails", () => {
    expect(evaluateReply(ai, JSON.stringify({ ...BRIEF_OUT, name: "Teal #00ffaa" }))).toEqual({
      json: true,
      schema: false,
      engine: false,
    });
  });

  it("C-DEV-05 evaluateReply gives true, true, true for BRIEF_OUT's JSON, fenced or not", () => {
    const text = JSON.stringify(BRIEF_OUT);
    expect(evaluateReply(ai, text)).toEqual({ json: true, schema: true, engine: true });
    expect(evaluateReply(ai, `\`\`\`json\n${text}\n\`\`\``)).toEqual({
      json: true,
      schema: true,
      engine: true,
    });
  });

  it("C-DEV-05 evaluateReply passes the engine for a brief that sets only one field", () => {
    expect(evaluateReply(ai, JSON.stringify({ name: "Plain", motion: "brisk" }))).toEqual({
      json: true,
      schema: true,
      engine: true,
    });
  });

  it("C-DEV-05 evaluateReply throws TypeError naming itself for arguments of the wrong type", () => {
    expect(() => evaluateReply(ai, 5 as never)).toThrow(/^evaluateReply: text must be a string/);
    expect(() => evaluateReply(null as never, "{}")).toThrow(/^evaluateReply: ai must be/);
  });
});
