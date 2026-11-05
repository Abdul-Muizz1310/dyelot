import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CAP_COOKIE,
  capMacInput,
  capSetCookie,
  formatCapCookie,
  parseCapCookie,
  VISITOR_CAP,
} from "@/ai/cookie";
import { TODAY } from "./fixtures";

// C-AI-21 to C-AI-23 of docs/specs/04-ai.md, section 14.2: the cap cookie's format (R4-18, section
// 11.2). The MAC itself is the server shell's (Task 4.7b); here it is any 43 base64url characters.

const MAC = "Abc_-0123456789abcdefghijklmnopqrstuvwxyzAB";

describe("C-AI-21 the cap cookie's format", () => {
  it("C-AI-21 names the cookie dyelot_ai and caps a visitor at 3", () => {
    expect(CAP_COOKIE).toBe("dyelot_ai");
    expect(VISITOR_CAP).toBe(3);
    expect(MAC).toHaveLength(43);
  });

  it('C-AI-21 capMacInput("2026-11-05", 2) is "v1.2026-11-05.2"', () => {
    expect(capMacInput("2026-11-05", 2)).toBe("v1.2026-11-05.2");
    expect(capMacInput(TODAY, 0)).toBe("v1.2026-11-05.0");
  });

  it("C-AI-21 formatCapCookie and parseCapCookie round-trip", () => {
    for (const count of [0, 1, 2, 3]) {
      const value = formatCapCookie(TODAY, count, MAC);
      expect(value).toBe(`v1.${TODAY}.${count}.${MAC}`);
      expect(parseCapCookie(value)).toEqual({
        day: TODAY,
        count,
        mac: MAC,
        signed: `v1.${TODAY}.${count}`,
      });
    }
  });

  it("C-AI-21 capSetCookie writes the Set-Cookie line of R4-18", () => {
    const value = formatCapCookie(TODAY, 1, MAC);
    expect(capSetCookie(value, 43200)).toBe(
      `dyelot_ai=${value}; Path=/api/ai; Max-Age=43200; HttpOnly; Secure; SameSite=Strict`,
    );
    expect(capSetCookie(value, 1)).toContain("Max-Age=1;");
    expect(capSetCookie(value, 86400)).toContain("Max-Age=86400;");
  });
});

describe("C-AI-22 the cap cookie's failures", () => {
  it.each([
    ["undefined", undefined],
    ["an empty string", ""],
    ["v2", `v2.${TODAY}.1.${MAC}`],
    ["a count of 4", `v1.${TODAY}.4.${MAC}`],
    ["a count of -1", `v1.${TODAY}.-1.${MAC}`],
    ["a 42-character MAC", `v1.${TODAY}.1.${MAC.slice(1)}`],
    ["a 44-character MAC", `v1.${TODAY}.1.${MAC}A`],
    ["a MAC with padding", `v1.${TODAY}.1.${MAC.slice(1)}=`],
    ["a MAC with a + or /", `v1.${TODAY}.1.${MAC.slice(2)}+/`],
    ["a fifth field", `v1.${TODAY}.1.${MAC}.x`],
    ["a day of one digit", `v1.2026-11-5.1.${MAC}`],
    ["a day with slashes", `v1.2026/11/05.1.${MAC}`],
    ["white space around", ` v1.${TODAY}.1.${MAC}`],
    ["a trailing newline", `v1.${TODAY}.1.${MAC}\n`],
    ["the cookie's name", `dyelot_ai=v1.${TODAY}.1.${MAC}`],
  ])("C-AI-22 parseCapCookie gives null for %s", (_, value) => {
    expect(parseCapCookie(value)).toBeNull();
  });

  it("C-AI-22 parseCapCookie throws TypeError for a value that is neither a string nor undefined", () => {
    expect(() => parseCapCookie(5 as unknown as string)).toThrow(TypeError);
    expect(() => parseCapCookie(null as unknown as string)).toThrow(/^parseCapCookie: /);
  });

  it("C-AI-22 capMacInput and formatCapCookie throw RangeError for such fields", () => {
    for (const [day, count] of [
      ["2026-11-5", 1],
      ["2026/11/05", 1],
      ["", 1],
      [TODAY, 4],
      [TODAY, -1],
      [TODAY, 1.5],
      [TODAY, Number.NaN],
    ] as const) {
      expect(() => capMacInput(day, count), `${day} ${count}`).toThrow(RangeError);
      expect(() => capMacInput(day, count)).toThrow(/^capMacInput: /);
      expect(() => formatCapCookie(day, count, MAC)).toThrow(RangeError);
      expect(() => formatCapCookie(day, count, MAC)).toThrow(/^formatCapCookie: /);
    }
    for (const mac of [MAC.slice(1), `${MAC}A`, `${MAC.slice(1)}=`, `${MAC.slice(1)}.`]) {
      expect(() => formatCapCookie(TODAY, 1, mac), mac).toThrow(RangeError);
    }
  });

  it("C-AI-22 capMacInput and formatCapCookie throw TypeError for a wrong type", () => {
    expect(() => capMacInput(20261105 as unknown as string, 1)).toThrow(TypeError);
    expect(() => capMacInput(TODAY, "1" as unknown as number)).toThrow(TypeError);
    expect(() => formatCapCookie(TODAY, 1, null as unknown as string)).toThrow(TypeError);
    expect(() => formatCapCookie(TODAY, 1, null as unknown as string)).toThrow(
      /^formatCapCookie: /,
    );
  });

  it("C-AI-22 capSetCookie throws RangeError for a max age of 0 or 86401 and for a value that is no cap cookie", () => {
    const value = formatCapCookie(TODAY, 1, MAC);
    for (const maxAge of [0, 86401, 1.5, -1]) {
      expect(() => capSetCookie(value, maxAge), String(maxAge)).toThrow(RangeError);
      expect(() => capSetCookie(value, maxAge)).toThrow(/^capSetCookie: /);
    }
    expect(() => capSetCookie(`${value}; Domain=evil.example`, 60)).toThrow(RangeError);
    expect(() => capSetCookie("", 60)).toThrow(RangeError);
    expect(() => capSetCookie(value, "60" as unknown as number)).toThrow(TypeError);
    expect(() => capSetCookie(5 as unknown as string, 60)).toThrow(TypeError);
  });
});

describe("C-AI-23 the cap cookie's property", () => {
  it("C-AI-23 parseCapCookie never throws for a string and reads back every value formatCapCookie writes", () => {
    const day = fc.stringMatching(/^\d{4}-\d{2}-\d{2}$/);
    const mac = fc.stringMatching(/^[A-Za-z0-9_-]{43}$/);
    fc.assert(
      fc.property(
        fc.string({ unit: "binary" }),
        day,
        fc.integer({ min: 0, max: 3 }),
        mac,
        (anything, d, count, m) => {
          const read = parseCapCookie(anything);
          expect(read === null || typeof read.count === "number").toBe(true);
          expect(parseCapCookie(formatCapCookie(d, count, m))).toEqual({
            day: d,
            count,
            mac: m,
            signed: capMacInput(d, count),
          });
        },
      ),
      { numRuns: 500, seed: 4002 },
    );
  });
});
