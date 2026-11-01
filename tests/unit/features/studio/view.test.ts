import { describe, expect, it } from "vitest";
import { DEFAULT_VIEW, mergeView, TEMPLATE_IDS } from "@/features/studio/view";

// The canvas view settings of docs/specs/02-studio.md, section 5.7 (`View`, `setView`): not in a
// snapshot and not in the link (R2-13 item 7). The store's cases are C-STORE-07, 29 and 35.

describe("DEFAULT_VIEW", () => {
  it("is light, comfortable, 1280 px, the landing page, real copy, no vision filter, no highlight", () => {
    expect(DEFAULT_VIEW).toEqual({
      mode: "light",
      density: "comfortable",
      frame: 1280,
      template: "landing",
      reducedMotion: false,
      copy: "real",
      vision: "none",
      highlight: null,
    });
    expect(Object.isFrozen(DEFAULT_VIEW)).toBe(true);
  });

  it("lists the six templates of section 5.7", () => {
    expect(TEMPLATE_IDS).toEqual([
      "landing",
      "dashboard",
      "settings",
      "mobile",
      "editorial",
      "kitchen-sink",
    ]);
  });
});

describe("mergeView", () => {
  it("returns a new view with the patch applied, every setting checked", () => {
    const patch = {
      mode: "dark",
      density: "compact",
      frame: 360,
      template: "kitchen-sink",
      reducedMotion: true,
      copy: "edge",
      vision: "tritan",
      highlight: { roles: ["ring", "background"], cells: [{ palette: "primary", step: 600 }] },
    } as const;
    const next = mergeView(DEFAULT_VIEW, patch);
    expect(next).toEqual(patch);
    expect(next).not.toBe(DEFAULT_VIEW);
    expect(mergeView(next, { highlight: null }).highlight).toBeNull();
    expect(mergeView(DEFAULT_VIEW, {})).toEqual(DEFAULT_VIEW);
  });

  it.each([
    ["frame", { frame: 500 }, RangeError],
    ["mode", { mode: "dim" }, RangeError],
    ["density", { density: "airy" }, RangeError],
    ["vision", { vision: "x" }, RangeError],
    ["template", { template: "blog" }, RangeError],
    ["copy", { copy: "lorem" }, RangeError],
    ["reducedMotion", { reducedMotion: "yes" }, TypeError],
    ["highlight", { highlight: { roles: "ring" } }, TypeError],
    ["highlight", { highlight: "ring" }, TypeError],
    ["zoom", { zoom: 2 }, RangeError],
  ])("rejects a bad %s, naming the caller", (key, patch, kind) => {
    expect(() => mergeView(DEFAULT_VIEW, patch as never)).toThrow(kind);
    expect(() => mergeView(DEFAULT_VIEW, patch as never)).toThrow(
      new RegExp(`^mergeView: patch.${key}`),
    );
    expect(() => mergeView(DEFAULT_VIEW, patch as never, "setView")).toThrow(/^setView: /);
  });

  it("rejects a patch that is not an object", () => {
    expect(() => mergeView(DEFAULT_VIEW, null as never)).toThrow(TypeError);
  });
});
