import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type Hex, hexToRgb, wcagRatio } from "@/engine";

// F-A11Y-07 of docs/specs/02-studio.md, section 7.9: the chrome's own tokens meet 4.5:1 for text and
// 3:1 for the parts that identify a control, against the page (#0a0a0a) and the panel (#12121a).
// The tokens are read from the `:root` block of src/app/globals.css, so a token edit re-measures.

const css = readFileSync("src/app/globals.css", "utf8");
const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";

/** The hex of `--<name>` in the `:root` block. */
function token(name: string): Hex {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, "i").exec(root);
  if (match?.[1] === undefined) throw new Error(`no hex token --${name} in :root`);
  return match[1].toLowerCase() as Hex;
}

const ratio = (a: Hex, b: Hex) => wcagRatio(hexToRgb(a), hexToRgb(b));
const SURFACES = ["page", "panel"] as const;

describe("F-A11Y-07 the chrome tokens", () => {
  it("names the page and panel the spec measures against", () => {
    expect(token("page")).toBe("#0a0a0a");
    expect(token("panel")).toBe("#12121a");
  });

  // Text: the body text, the muted text (labels, placeholders, notes) and madder (the active state).
  it.each(["foreground", "fg-muted", "accent-madder"])(
    "--%s meets 4.5:1 as text on the page and the panel",
    (name) => {
      for (const surface of SURFACES) {
        expect(ratio(token(name), token(surface))).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  // Non-text: the edge of every form control is --control-edge (F-A11Y-09); the mode switch's thumb
  // at rest is --fg-muted; the focus ring is madder.
  it.each(["control-edge", "fg-muted", "accent-madder"])(
    "--%s meets 3:1 as a control edge on the page and the panel",
    (name) => {
      for (const surface of SURFACES) {
        expect(ratio(token(name), token(surface))).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it("the label of the primary action (page on madder) meets 4.5:1", () => {
    expect(ratio(token("page"), token("accent-madder"))).toBeGreaterThanOrEqual(4.5);
  });
});
