import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isPlainText, toPlainText } from "@/spec/text";

// Cases C-SPEC3-01 to C-SPEC3-06 of docs/specs/03-export.md, section 10.1 (R3-02). Invisible
// characters are written as escapes, never as raw characters.

describe("isPlainText", () => {
  it("C-SPEC3-01 accepts ordinary text", () => {
    for (const text of ["Saltmarsh", "a b", "Crème brûlée", "日本語", "😀", "x".repeat(280)]) {
      expect(isPlainText(text), text).toBe(true);
    }
  });

  it("C-SPEC3-02 rejects empty text, controls, bidirectional marks, edge white space, NFD and lone surrogates", () => {
    const rejected = [
      "",
      " a",
      "a ",
      "a\tb",
      "a\u0000b",
      "a\u007fb",
      "a\u0085b",
      "a\u2028b",
      "a\u2029b",
      "a\u061cb",
      "a\u200eb",
      "a\u200fb",
      "e\u0301",
      "a\ud800b",
      "\udc00",
    ];
    for (let code = 0x202a; code <= 0x202e; code++) rejected.push(`a${String.fromCharCode(code)}b`);
    for (let code = 0x2066; code <= 0x2069; code++) rejected.push(`a${String.fromCharCode(code)}b`);
    for (const text of rejected) expect(isPlainText(text), JSON.stringify(text)).toBe(false);
  });

  it("C-SPEC3-06 throws TypeError naming isPlainText for a non-string", () => {
    expect(() => isPlainText(5 as never)).toThrow(TypeError);
    expect(() => isPlainText(5 as never)).toThrow(/^isPlainText: /);
  });
});

describe("toPlainText", () => {
  it("C-SPEC3-03 follows the order of R3-02", () => {
    expect(toPlainText("  a\t\tb  ", 80)).toEqual({ text: "a b", truncated: false });
    expect(toPlainText("e\u0301", 80)?.text).toBe("é");
    expect(toPlainText("a\u202eb", 80)?.text).toBe("ab");
    expect(toPlainText("a\u2028\u2029b", 80)?.text).toBe("a b");
    expect(toPlainText("a\u0000\u0001b", 80)?.text).toBe("a b");
    expect(toPlainText("\u0000", 80)).toBeNull();
    expect(toPlainText("   ", 80)).toBeNull();
    expect(toPlainText("", 80)).toBeNull();
    // The control goes before NFC, so the pair composes.
    expect(toPlainText("e\u200e\u0301", 80)?.text).toBe("é");
    expect(toPlainText("a\ud800b", 80)?.text).toBe("ab");
  });

  it("C-SPEC3-04 cuts to whole code points that fit and trims the cut", () => {
    expect(toPlainText("abcdef", 3)).toEqual({ text: "abc", truncated: true });
    expect(toPlainText("ab cd", 3)).toEqual({ text: "ab", truncated: true });
    expect(toPlainText("ab\u{1f600}", 3)).toEqual({ text: "ab", truncated: true });
    expect(toPlainText("abc", 3)).toEqual({ text: "abc", truncated: false });
  });

  it("C-SPEC3-05 gives null or text that is plain, fits and is a fixed point", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: "binary", maxLength: 400 }),
        fc.integer({ min: 1, max: 300 }),
        (raw, max) => {
          const result = toPlainText(raw, max);
          if (result === null) return;
          expect(isPlainText(result.text)).toBe(true);
          expect(result.text.length).toBeLessThanOrEqual(max);
          expect(toPlainText(result.text, max)).toEqual({ text: result.text, truncated: false });
        },
      ),
      { numRuns: 1000, seed: 3002 },
    );
  });

  it("C-SPEC3-06 throws TypeError for a wrong type and RangeError for a bad max, naming toPlainText", () => {
    expect(() => toPlainText(5 as never, 3)).toThrow(TypeError);
    expect(() => toPlainText("a", "3" as never)).toThrow(TypeError);
    for (const max of [0, 1.5, Number.NaN]) {
      expect(() => toPlainText("a", max)).toThrow(RangeError);
      expect(() => toPlainText("a", max)).toThrow(/^toPlainText: /);
    }
    expect(() => toPlainText(5 as never, 3)).toThrow(/^toPlainText: /);
  });
});
