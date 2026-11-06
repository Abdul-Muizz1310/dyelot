import { describe, expect, it } from "vitest";
import { withMotion } from "@/engine";
import { writeHash } from "@/features/studio/url";
import { defaultSpec } from "../../spec/support";
import { CUSTOM_TOKENS } from "../../support/motion";
import { lastPosted, makeStore } from "./store-support";
import { fakeLocation } from "./support";

// Case C-STUD5-06 of docs/specs/05-motion-3d.md, section 14.2 (R5-10, R5-14).

const CUSTOM = withMotion(defaultSpec(), CUSTOM_TOKENS);

describe("the store with motion tokens", () => {
  it("C-STUD5-06 loads them from a link, sends them on regenerate and keeps them over setParams", () => {
    const { location, history } = fakeLocation(writeHash(CUSTOM));
    const { store, stub } = makeStore({ location, history });
    expect(store.getState().params.motionTokens).toEqual(CUSTOM_TOKENS);

    store.getState().regenerate();
    const request = lastPosted(stub);
    expect(request.params.motionTokens).toEqual(CUSTOM_TOKENS);
    stub.replyReal(request.id);
    expect(store.getState().spec.motion).toMatchObject(CUSTOM_TOKENS);

    store.getState().setParams({ motion: "calm" });
    const next = lastPosted(stub);
    expect(next.params.motionTokens).toEqual(CUSTOM_TOKENS);
    stub.replyReal(next.id);
    expect(store.getState().params.motionTokens).toEqual(CUSTOM_TOKENS);
    expect(store.getState().spec.motion).toMatchObject(CUSTOM_TOKENS);
  });
});
