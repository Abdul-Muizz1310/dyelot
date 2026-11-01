import { describe, expect, it, vi } from "vitest";
import {
  choosePairing,
  gamutMap,
  LOCKABLE,
  normalizeSeed,
  PAIRINGS,
  parseColor,
  toHex,
} from "@/engine";
import {
  autoPairingLabel,
  GAMUT_LABELS,
  SEED_FIELD_MESSAGE,
  seedHex,
} from "@/features/studio/inputs";
import { lockSeed } from "@/features/studio/params";
import { FRESH_PARAMS, freshSpec } from "./support";

// Cases C-INPUTS-01 to C-INPUTS-05 of docs/specs/02-studio.md, section 6.11: the labels and the seed
// colors the inputs panel shows.

// The real choosePairing, wrapped so one case can make it break its contract.
vi.mock("@/engine", async (importOriginal) => {
  const engine = await importOriginal<typeof import("@/engine")>();
  return { ...engine, choosePairing: vi.fn(engine.choosePairing) };
});

describe("seedHex", () => {
  it.each(LOCKABLE)("C-INPUTS-01 shows the color a lock would hold for an unlocked %s", (slot) => {
    const spec = freshSpec();
    expect(seedHex(spec, FRESH_PARAMS, slot)).toBe(toHex(gamutMap(lockSeed(spec, slot), "srgb")));
  });

  it("C-INPUTS-02 shows a locked seed mapped into sRGB, and #1f6f5b reads back", () => {
    const seed = normalizeSeed(parseColor("#1f6f5b"));
    const params = { ...FRESH_PARAMS, primary: seed };
    expect(seedHex(freshSpec(), params, "primary")).toBe("#1f6f5b");
    const vivid = normalizeSeed({ l: 0.7, c: 0.3, h: 150 });
    expect(seedHex(freshSpec(), { ...FRESH_PARAMS, accent: vivid }, "accent")).toBe(
      toHex(gamutMap(vivid, "srgb")),
    );
  });

  it("C-INPUTS-03 throws RangeError for a slot outside LOCKABLE", () => {
    expect(() => seedHex(freshSpec(), FRESH_PARAMS, "neutral" as never)).toThrow(RangeError);
    expect(() => seedHex(freshSpec(), FRESH_PARAMS, "neutral" as never)).toThrow(/^seedHex: /);
  });

  it("C-INPUTS-03 throws TypeError for a spec or params that are not objects", () => {
    expect(() => seedHex(null as never, FRESH_PARAMS, "primary")).toThrow(
      "seedHex: spec must be an object, got null",
    );
    expect(() => seedHex(freshSpec(), [] as never, "primary")).toThrow(
      "seedHex: params must be an object, got array",
    );
  });
});

describe("autoPairingLabel", () => {
  it.each([["seed-1"], ["10"], ["s7"]])(
    "C-INPUTS-04 names the pairing choosePairing(%j) picks",
    (seed) => {
      const label = PAIRINGS.find((pairing) => pairing.id === choosePairing(seed))?.label;
      expect(label).toBeDefined();
      expect(autoPairingLabel(seed)).toBe(`Auto (${label})`);
    },
  );

  it("C-INPUTS-04 fails loudly when choosePairing names a pairing outside PAIRINGS", () => {
    vi.mocked(choosePairing).mockReturnValueOnce("no-such-pairing" as never);
    expect(() => autoPairingLabel("seed-1")).toThrow(
      "autoPairingLabel: no pairing no-such-pairing",
    );
  });

  it("C-INPUTS-04 throws TypeError naming autoPairingLabel for a non-string seed", () => {
    expect(() => autoPairingLabel(7 as never)).toThrow(
      "autoPairingLabel: seed must be a string, got number",
    );
  });
});

describe("labels", () => {
  it("C-INPUTS-05 names the gamuts and the hex field message of F-INPUT-09", () => {
    expect(GAMUT_LABELS).toEqual({ srgb: "sRGB", p3: "Display P3" });
    expect(Object.isFrozen(GAMUT_LABELS)).toBe(true);
    expect(SEED_FIELD_MESSAGE).toBe("Enter a color like #3a6ea5 or oklch(0.6 0.15 250).");
  });
});
