import { describe, expect, it, vi } from "vitest";
import { handleAi } from "@/server/ai/handle";
import { BRIEF_IN } from "../ai/fixtures";
import { chatAnswer, keyAnswer, makeDeps, OUTPUTS, post, read, recordingFetch } from "./support";

// C-ROUTE-02 of docs/specs/04-ai.md, section 14.7, step 4 of R4-16: the handler passes on the input
// as `inputSchema` reads it, not the raw JSON. Today's schemas transform nothing, so this file makes
// the brief's schema lowercase the brief, through a mock of the entry, to tell the two apart.

vi.mock("@/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai")>();
  return {
    ...actual,
    inputSchema: (feature: Parameters<typeof actual.inputSchema>[0]) => {
      const schema = actual.inputSchema(feature);
      return feature === "brief"
        ? schema.transform((input) => ({
            ...input,
            brief: (input as { brief: string }).brief.toLowerCase(),
          }))
        : schema;
    },
  };
});

describe("C-ROUTE-02 the checked input", () => {
  it("C-ROUTE-02 passes on the input as inputSchema reads it, not the raw JSON", async () => {
    const recording = recordingFetch({
      key: [keyAnswer(50)],
      chat: [chatAnswer(JSON.stringify(OUTPUTS.brief))],
    });
    const { deps } = makeDeps({ fetch: recording.fetch });
    expect(BRIEF_IN.brief).not.toBe(BRIEF_IN.brief.toLowerCase());
    const reply = await read(await handleAi("brief", post("brief", BRIEF_IN), deps));
    expect(reply.status).toBe(200);
    const body = JSON.parse(String(recording.chatCalls()[0]?.init.body));
    const user = JSON.parse(body.messages[1].content);
    expect(user.brief).toBe(BRIEF_IN.brief.toLowerCase());
  });
});
