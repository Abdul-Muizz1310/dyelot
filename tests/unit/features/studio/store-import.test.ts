import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { presetOf } from "@/engine";
import { readDraft } from "@/features/studio/drafts";
import { paramsOfSpec } from "@/features/studio/params";
import { bannerFor, writeHash } from "@/features/studio/url";
import { importDesignMd, importShadcnCss } from "@/import";
import { encodeSpec, specId } from "@/spec";
import { readFixture } from "../../import/helpers";
import { lastPosted, makeStore, stubClient } from "./store-support";
import { fakeLocation, memoryStorage } from "./support";

// C-STOR3-01 to 05, 07, 11 and the import part of C-STOR3-08 of docs/specs/03-export.md, section 10.11
// (R3-33, R3-42). The store cases use M2's StubClient, a fake clock and fake timers.

const RESULT = importShadcnCss(readFixture("shadcn-neutral.css"));
if (!RESULT.ok) throw new Error("the shadcn fixture did not import");
const OK = RESULT;
const IMPORTED = OK.spec;

const countOf = (mode: "light" | "dark") =>
  OK.report.mapped.filter((entry) => entry.mode === mode).length;
/** 9.3's "colors adjusted to fit sRGB or drop alpha": the gamut and alpha entries, not a generated foreground. */
const adjustedOf = (report: typeof OK.report) =>
  report.adjusted.filter((entry) => entry.reason === "gamut" || entry.reason === "alpha").length;
const NOTICE = {
  kind: "imported",
  format: "shadcn-css",
  exact: false,
  light: countOf("light"),
  dark: countOf("dark"),
  adjusted: adjustedOf(OK.report),
} as const;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("importDesign", () => {
  it("C-STOR3-01 loads the spec as a link load: a loaded snapshot, history, no request", () => {
    const { store, stub } = makeStore();
    const before = store.getState();
    const previous = {
      params: before.params,
      seed: before.seed,
      spec: before.spec,
      preset: before.preset,
      provenance: before.provenance,
    };
    store.getState().importDesign(OK);
    const state = store.getState();
    expect(state.spec).toEqual(IMPORTED);
    expect(specId(state.spec)).toBe(specId(IMPORTED));
    expect(state.params).toEqual(paramsOfSpec(IMPORTED).params);
    expect(state.seed).toBe(IMPORTED.meta.seed);
    expect(state.preset).toBe(presetOf(IMPORTED));
    expect(state.provenance).toBe("loaded");
    expect(state.history).toHaveLength(1);
    expect(state.history[0]).toEqual(previous);
    expect(state.future).toEqual([]);
    expect(stub.posted).toHaveLength(0);
  });

  it("C-STOR3-02 sets the imported notice with the counts of the report", () => {
    const { store } = makeStore();
    store.getState().importDesign(OK);
    expect(store.getState().status.notice).toEqual(NOTICE);
    expect(store.getState().status.phase).toBe("idle");
    // Measured: 10 gamut and 3 alpha entries; the 2 foreground entries are generated, not adjusted.
    expect(NOTICE.adjusted).toBe(13);
    expect(OK.report.adjusted.filter((entry) => entry.reason === "foreground")).toHaveLength(2);
  });

  it("C-STOR3-02 counts no generated foreground as an adjusted color", () => {
    const md = importDesignMd(readFixture("design-md-readme.md"));
    if (!md.ok) throw new Error("the DESIGN.md fixture did not import");
    // Its one entry is the primary-foreground that onFill generated.
    expect(md.report.adjusted.map((entry) => entry.reason)).toEqual(["foreground"]);
    const { store } = makeStore();
    store.getState().importDesign(md);
    const notice = store.getState().status.notice;
    expect(notice).toMatchObject({ kind: "imported", adjusted: 0 });
    const { message, detail } = bannerFor(notice as never);
    expect(`${message} ${detail}`).not.toContain("adjusted");
  });

  it("C-STOR3-03 ties the notice to the snapshot: undo clears it, redo restores it, a commit clears it", () => {
    const { store, stub, clock } = makeStore();
    store.getState().importDesign(OK);
    store.getState().undo();
    expect(store.getState().status.notice).toBeNull();
    expect(store.getState().spec).not.toEqual(IMPORTED);
    store.getState().redo();
    expect(store.getState().spec).toEqual(IMPORTED);
    expect(store.getState().status.notice).toEqual(NOTICE);
    clock.advance(2_000);
    store.getState().setParams({ radius: "sharp" });
    stub.reply(lastPosted(stub).id);
    expect(store.getState().status.notice).toBeNull();
    // Undo returns to the import, and its notice comes back with it.
    store.getState().undo();
    expect(store.getState().spec).toEqual(IMPORTED);
    expect(store.getState().status.notice).toEqual(NOTICE);
  });

  it("C-STOR3-04 writes the hash and the draft 300 ms after the import, not before", () => {
    const { store, history, storage } = makeStore();
    store.getState().importDesign(OK);
    vi.advanceTimersByTime(299);
    expect(history.replaceState).not.toHaveBeenCalled();
    expect(readDraft(storage)).toBeNull();
    vi.advanceTimersByTime(1);
    expect(history.replaceState).toHaveBeenCalledOnce();
    expect(history.replaceState).toHaveBeenCalledWith(null, "", `#s=${encodeSpec(IMPORTED)}`);
    expect(readDraft(storage)?.spec).toEqual(IMPORTED);
  });

  it("C-STOR3-05 throws TypeError for a bad result and RangeError for a bad spec, changing nothing", () => {
    const { store } = makeStore();
    const before = store.getState();
    const { spec: _spec, ...noSpec } = OK;
    const badSpec = { ...OK, spec: { ...IMPORTED, version: "dyelot.spec/9" } };
    const typeBad = [
      { ok: false, error: { code: "empty", message: "x" } },
      null,
      "x",
      noSpec,
      { ...OK, spec: null },
      { ...OK, spec: "spec" },
    ];
    for (const bad of typeBad) {
      expect(() => store.getState().importDesign(bad as never)).toThrow(TypeError);
      expect(() => store.getState().importDesign(bad as never)).toThrow(/importDesign/);
    }
    expect(() => store.getState().importDesign(badSpec as never)).toThrow(RangeError);
    expect(() => store.getState().importDesign(badSpec as never)).toThrow(/importDesign/);
    const after = store.getState();
    for (const key of [
      "params",
      "seed",
      "spec",
      "preset",
      "provenance",
      "history",
      "future",
      "status",
      "view",
      "outcome",
    ] as const) {
      expect(after[key]).toBe(before[key]);
    }
  });

  it("C-STOR3-07 wins over a request in flight: the late reply changes nothing", () => {
    const { store, stub, clock } = makeStore();
    for (let i = 0; i < 6; i++) {
      clock.advance(2_000);
      store.getState().setParams({ radius: i % 2 === 0 ? "sharp" : "round" });
      stub.reply(lastPosted(stub).id);
    }
    clock.advance(2_000);
    store.getState().setParams({ radius: "soft" });
    const inFlight = lastPosted(stub).id;
    expect(inFlight).toBe(7);
    store.getState().importDesign(OK);
    expect(store.getState().status.phase).toBe("idle");
    stub.reply(7);
    expect(store.getState().spec).toEqual(IMPORTED);
    expect(store.getState().params).toEqual(paramsOfSpec(IMPORTED).params);
    expect(store.getState().status.notice).toEqual(NOTICE);
  });

  it("C-STOR3-08 marks an import loaded, through undo and redo", () => {
    const { store, stub, clock } = makeStore();
    store.getState().importDesign(OK);
    expect(store.getState().provenance).toBe("loaded");
    clock.advance(2_000);
    store.getState().setParams({ radius: "sharp" });
    stub.reply(lastPosted(stub).id);
    expect(store.getState().provenance).toBe("generated");
    store.getState().undo();
    expect(store.getState().provenance).toBe("loaded");
    store.getState().undo();
    expect(store.getState().provenance).toBe("generated");
    store.getState().redo();
    expect(store.getState().provenance).toBe("loaded");
  });

  it("C-STOR3-11 replaces the custom-fonts notice and says the fonts are a fallback", () => {
    const css = `${readFixture("shadcn-neutral.css")}\n:root { --font-sans: "Inter", sans-serif; }\n`;
    const result = importShadcnCss(css);
    if (!result.ok) throw new Error(`the custom-font CSS did not import: ${result.error.code}`);
    expect(result.report.inferred.customFonts).toBe(true);
    // The store opens on a link whose fonts are custom: its notice is `custom-fonts`.
    const { location, history } = fakeLocation(writeHash(result.spec));
    const opened = makeStore({ location, history });
    expect(opened.store.getState().status.notice).toEqual({ kind: "custom-fonts" });
    opened.store.getState().importDesign(result);
    const notice = opened.store.getState().status.notice;
    expect(notice).toMatchObject({ kind: "imported" });
    const { message, detail } = bannerFor(notice as never);
    expect(`${message} ${detail}`).toContain(
      "Its fonts are not in dyelot's catalog, so the canvas shows a fallback.",
    );
    // The neutral theme names catalog fonts: no such sentence.
    const plain = makeStore();
    plain.store.getState().importDesign(OK);
    const text = bannerFor(plain.store.getState().status.notice as never);
    expect(`${text.message} ${text.detail}`).not.toContain("catalog");
  });
});

describe("the imported notice's words (section 9.3)", () => {
  const words = (notice: Parameters<typeof bannerFor>[0]) => {
    const { message, detail } = bannerFor(notice);
    return `${message} ${detail}`.trim();
  };

  it("reads the counts, the adjusted colors and the undo sentence", () => {
    expect(words({ ...NOTICE, light: 31, dark: 29, adjusted: 0 })).toBe(
      "Imported a shadcn theme: 31 of 46 light roles and 29 of 46 dark roles came from the file. Undo returns to the design before.",
    );
    expect(words({ ...NOTICE, format: "design-md", light: 3, dark: 0, adjusted: 2 })).toBe(
      "Imported a DESIGN.md: 3 of 46 light roles and 0 of 46 dark roles came from the file. 2 colors were adjusted to fit sRGB or drop alpha. Undo returns to the design before.",
    );
    expect(words({ ...NOTICE, adjusted: 1, customFonts: true })).toContain(
      "1 color was adjusted to fit sRGB or drop alpha. Its fonts are not in dyelot's catalog, so the canvas shows a fallback. Undo returns to the design before.",
    );
  });

  it("reads an exact import in one sentence", () => {
    expect(
      words({
        kind: "imported",
        format: "design-md",
        exact: true,
        light: 46,
        dark: 46,
        adjusted: 0,
      }),
    ).toBe(
      "Imported the DESIGN.md exactly, from its edit link. Undo returns to the design before.",
    );
  });
});

describe("an exact DESIGN.md import", () => {
  it("is not a store concern: the notice carries `exact` from the report", () => {
    const md = importDesignMd(readFixture("design-md-readme.md"));
    if (!md.ok) throw new Error("the DESIGN.md fixture did not import");
    const { store } = makeStore({ storage: memoryStorage(), client: stubClient().client });
    store.getState().importDesign(md);
    expect(store.getState().status.notice).toMatchObject({
      kind: "imported",
      format: "design-md",
      exact: md.report.exact,
    });
  });
});
