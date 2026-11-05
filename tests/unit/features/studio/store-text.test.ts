import { describe, expect, it } from "vitest";
import { runGenerate } from "@/features/studio/protocol";
import { lastPosted, makeStore } from "./store-support";

// Case C-STOR3-06 of docs/specs/03-export.md, section 10.11 (R3-33): the About path through the
// store, with the real generator answering every request.

type Made = ReturnType<typeof makeStore>;

/** Calls `action`, then answers the request it posted with the real generator. */
function commit(made: Made, action: () => void): void {
  const before = made.stub.posted.length;
  action();
  expect(made.stub.posted.length, "the action posts one request").toBe(before + 1);
  made.stub.deliver(runGenerate(lastPosted(made.stub)));
}

describe("the About path", () => {
  it("C-STOR3-06 commits a burst of name changes as one entry named Salts", () => {
    const made = makeStore();
    const { store, clock } = made;
    for (const name of ["S", "Sa", "Sal", "Salt", "Salts"]) {
      commit(made, () => store.getState().setParams({ name }, { coalesce: "about-name" }));
      clock.advance(200);
    }
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().spec.meta.name).toBe("Salts");
    expect(store.getState().params.name).toBe("Salts");
  });

  it("C-STOR3-06 returns the name to untitled when the field clears, with no name in params", () => {
    const made = makeStore();
    const { store } = made;
    commit(made, () => store.getState().setParams({ name: "Salts" }));
    commit(made, () => store.getState().setParams({ name: undefined }));
    expect(store.getState().spec.meta.name).toBe("untitled");
    expect("name" in store.getState().params).toBe(false);
  });

  it("C-STOR3-06 sets the one-liner under its own coalesce key", () => {
    const made = makeStore();
    const { store } = made;
    commit(made, () =>
      store.getState().setParams({ oneLiner: "Reads the tide" }, { coalesce: "about-one-liner" }),
    );
    expect(store.getState().spec.meta.oneLiner).toBe("Reads the tide");
  });

  it("C-STOR3-06 ends a name that is not plain text in a generation notice and keeps the spec", () => {
    const made = makeStore();
    const { store } = made;
    const held = store.getState().spec;
    commit(made, () => store.getState().setParams({ name: " a" }));
    const { status } = store.getState();
    expect(status.notice?.kind).toBe("generation");
    expect(status.notice).toMatchObject({
      message: expect.stringContaining("generateSystem: params.name"),
    });
    expect(store.getState().spec).toBe(held);
  });
});
