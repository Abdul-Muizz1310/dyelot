import { describe, expect, it } from "vitest";
import {
  clearDraft,
  DRAFT_KEY,
  readDraft,
  safeStorage,
  writeDraft,
} from "@/features/studio/drafts";
import { encodeSpec } from "@/spec";
import { without, withValue } from "../../spec/support";
import { FRESH_PARAMS, freshSpec, linkOfValue, memoryStorage, throwingStorage } from "./support";

// Cases are C-DRAFT-01 to C-DRAFT-09 and C-DRAFT-12 of docs/specs/02-studio.md, section 6.7
// (Review Focus 2). The store's draft cases (C-DRAFT-04's status, C-DRAFT-10, C-DRAFT-11 and
// C-DRAFT-13) live in store-persist.test.ts.

const snapshot = () => ({
  params: FRESH_PARAMS,
  seed: "seed-1",
  spec: freshSpec(),
  preset: "default" as const,
});

const stored = (value: unknown) => memoryStorage({ [DRAFT_KEY]: JSON.stringify(value) });

describe("writeDraft and readDraft", () => {
  it("C-DRAFT-01 stores { v, link, params, preset } under dyelot:draft and reads it back", () => {
    expect(DRAFT_KEY).toBe("dyelot:draft");
    const storage = memoryStorage();
    expect(writeDraft(storage, snapshot())).toEqual({ ok: true });
    const text = storage.items.get("dyelot:draft") ?? "";
    expect(JSON.parse(text)).toEqual({
      v: 1,
      link: encodeSpec(freshSpec()),
      params: FRESH_PARAMS,
      preset: "default",
    });
    expect(Object.keys(JSON.parse(text))).toEqual(["v", "link", "params", "preset"]);
    expect(text).not.toContain("pairing");
    const draft = readDraft(storage);
    expect(draft).toEqual({
      spec: freshSpec(),
      params: FRESH_PARAMS,
      seed: "seed-1",
      preset: "default",
    });
    expect(draft !== null && "pairing" in (draft.params ?? {})).toBe(false);
  });

  it("C-DRAFT-01 keeps an explicit pairing explicit, and a null preset", () => {
    const params = { ...FRESH_PARAMS, pairing: "young-onest" };
    const storage = memoryStorage();
    writeDraft(storage, { ...snapshot(), params, preset: null });
    expect(readDraft(storage)).toEqual({ spec: freshSpec(), params, seed: "seed-1", preset: null });
  });

  it("C-DRAFT-02 reads null from an empty storage", () => {
    expect(readDraft(memoryStorage())).toBeNull();
  });

  it("C-DRAFT-05 reads null from a value that is not JSON, and removes the key", () => {
    const storage = memoryStorage({ [DRAFT_KEY]: "{not json" });
    expect(readDraft(storage)).toBeNull();
    expect(storage.items.has(DRAFT_KEY)).toBe(false);
  });

  it.each([
    [
      "a stored v: 2",
      () => ({ v: 2, link: encodeSpec(freshSpec()), params: FRESH_PARAMS, preset: null }),
    ],
    [
      "a tampered link",
      () => {
        const link = encodeSpec(freshSpec());
        const at = Math.floor(link.length / 2);
        const tampered = link.slice(0, at) + (link[at] === "A" ? "B" : "A") + link.slice(at + 1);
        return { v: 1, link: tampered, params: FRESH_PARAMS, preset: null };
      },
    ],
    [
      "a link that fails the schema",
      () => ({
        v: 1,
        link: linkOfValue(without(freshSpec(), ["color", "roles", "light", "ring"])),
        params: FRESH_PARAMS,
        preset: null,
      }),
    ],
    [
      "a link from another version",
      () => ({
        v: 1,
        link: linkOfValue(withValue(freshSpec(), ["version"], "dyelot.spec/2")),
        params: FRESH_PARAMS,
        preset: null,
      }),
    ],
  ])("C-DRAFT-06 reads null from %s and removes the key", (_, value) => {
    const storage = stored(value());
    expect(readDraft(storage)).toBeNull();
    expect(storage.items.has(DRAFT_KEY)).toBe(false);
  });

  it.each([
    ["a number", 3],
    ["an array", []],
    ["an empty object", {}],
    ["a link that is not a string", { v: 1, link: 3, params: FRESH_PARAMS, preset: null }],
    ["an unknown preset", { v: 1, link: "x", params: FRESH_PARAMS, preset: "loud" }],
    ["a missing preset", { v: 1, link: "x", params: FRESH_PARAMS }],
    ["null", null],
  ])("C-DRAFT-07 reads null from a value of the wrong shape: %s", (_, value) => {
    const storage = stored(value);
    expect(readDraft(storage)).toBeNull();
    expect(storage.items.has(DRAFT_KEY)).toBe(false);
  });

  it("C-DRAFT-12 reads params with a value outside its set as params: null", () => {
    const storage = stored({
      v: 1,
      link: encodeSpec(freshSpec()),
      params: { ...FRESH_PARAMS, chroma: "loud" },
      preset: "default",
    });
    expect(readDraft(storage)).toEqual({
      spec: freshSpec(),
      params: null,
      seed: "seed-1",
      preset: "default",
    });
  });

  it("reads params that do not regenerate the stored spec as params: null (R2-14 item 2)", () => {
    const storage = stored({
      v: 1,
      link: encodeSpec(freshSpec()),
      params: { ...FRESH_PARAMS, radius: "round" },
      preset: "default",
    });
    expect(readDraft(storage)?.params).toBeNull();
  });

  it("C-DRAFT-03 and C-DRAFT-08 read null and write { ok: false } with a null storage", () => {
    expect(readDraft(null)).toBeNull();
    expect(writeDraft(null, snapshot())).toEqual({ ok: false });
    expect(() => clearDraft(null)).not.toThrow();
  });

  it("C-DRAFT-04 gives { ok: false } when setItem throws QuotaExceededError", () => {
    const storage = memoryStorage();
    storage.setItem.mockImplementationOnce(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    expect(writeDraft(storage, snapshot())).toEqual({ ok: false });
    expect(writeDraft(storage, snapshot())).toEqual({ ok: true });
  });

  it("RF2: a storage whose every method throws reads null and writes { ok: false }", () => {
    const storage = throwingStorage();
    expect(readDraft(storage)).toBeNull();
    expect(writeDraft(storage, snapshot())).toEqual({ ok: false });
    expect(() => clearDraft(storage)).not.toThrow();
  });

  it("throws TypeError for a storage that is not one, or a snapshot that is not one", () => {
    expect(() => readDraft({} as never)).toThrow(TypeError);
    expect(() => readDraft({} as never)).toThrow(/^readDraft: /);
    expect(() => writeDraft(memoryStorage(), null as never)).toThrow(/^writeDraft: /);
    expect(() => clearDraft(3 as never)).toThrow(/^clearDraft: /);
  });
});

describe("clearDraft", () => {
  it("C-DRAFT-09 removes the key and swallows a throwing storage", () => {
    const storage = memoryStorage();
    writeDraft(storage, snapshot());
    clearDraft(storage);
    expect(storage.items.has(DRAFT_KEY)).toBe(false);
    expect(() => clearDraft(throwingStorage())).not.toThrow();
  });
});

describe("safeStorage", () => {
  it("C-DRAFT-03 gives null when reading localStorage throws SecurityError", () => {
    const win = {
      get localStorage(): Storage {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    };
    expect(safeStorage(win)).toBeNull();
  });

  it("gives null with no window, a null localStorage, or one without the storage methods", () => {
    expect(safeStorage(undefined)).toBeNull();
    expect(safeStorage({})).toBeNull();
    expect(safeStorage({ localStorage: null })).toBeNull();
    expect(safeStorage({ localStorage: { getItem: () => null } })).toBeNull();
  });

  it("gives the storage when it is there", () => {
    const storage = memoryStorage();
    expect(safeStorage({ localStorage: storage })).toBe(storage);
    expect(safeStorage(window)).toBe(window.localStorage);
  });
});
