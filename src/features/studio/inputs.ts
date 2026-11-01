import {
  choosePairing,
  type DirectionParams,
  type Gamut,
  gamutMap,
  type Hex,
  LOCKABLE,
  type Lockable,
  PAIRINGS,
  toHex,
} from "@/engine";
import type { DesignSpec } from "@/spec";
import { assertOneOf, assertRecord, assertString } from "./guards";
import { lockSeed } from "./params";

// What the inputs panel shows beside its controls (spec sections 5.7 and 7.2): the color of each
// seed row, the label of the automatic pairing, the gamut names and the hex field's message. Pure.

/** The field message of an unreadable color (F-INPUT-09): it names the forms the field takes. */
export const SEED_FIELD_MESSAGE = "Enter a color like #3a6ea5 or oklch(0.6 0.15 250).";

/** The gamuts as the panel names them. */
export const GAMUT_LABELS: Readonly<Record<Gamut, string>> = Object.freeze({
  srgb: "sRGB",
  p3: "Display P3",
});

/**
 * The color a seed row shows: a locked slot's seed, or for an unlocked slot the color a lock would
 * hold (`lockSeed`, R2-17). Either is mapped into sRGB, because the hex field and the native color
 * input hold sRGB hex only.
 */
export function seedHex(spec: DesignSpec, params: DirectionParams, slot: Lockable): Hex {
  assertRecord(spec, "seedHex: spec");
  assertRecord(params, "seedHex: params");
  assertOneOf(slot, LOCKABLE, "seedHex: slot");
  return toHex(gamutMap(params[slot] ?? lockSeed(spec, slot), "srgb"));
}

/** The pairing select's first option: "Auto" and the pairing `choosePairing(seed)` picks (R2-05). */
export function autoPairingLabel(seed: string): string {
  assertString(seed, "autoPairingLabel: seed");
  const id = choosePairing(seed);
  const pairing = PAIRINGS.find((item) => item.id === id);
  // choosePairing draws from PAIRINGS, so a miss is a broken invariant, not an input error.
  if (pairing === undefined) throw new Error(`autoPairingLabel: no pairing ${id}`);
  return `Auto (${pairing.label})`;
}
