import { describe, expect, it } from "vitest";
import { chosenFormat, fileAccepted } from "@/features/import/form";
import { IMPORT_MAX_BYTES } from "@/import";

// C-EXPUI-04 and C-EXPUI-07 of docs/specs/03-export.md, section 10.11 (R3-33, R3-38, section 9.3).

const TOO_LARGE =
  "That is larger than 256 KB. Import a DESIGN.md or a theme stylesheet of at most 256 KB.";

describe("chosenFormat", () => {
  it("C-EXPUI-04 lets a picked format win over any detection", () => {
    expect(chosenFormat("design-md", "shadcn-css")).toBe("design-md");
    expect(chosenFormat("shadcn-css", "design-md")).toBe("shadcn-css");
    expect(chosenFormat("shadcn-css", null)).toBe("shadcn-css");
  });

  it("C-EXPUI-04 follows the detected format when none is picked, and is null for neither", () => {
    expect(chosenFormat(null, "shadcn-css")).toBe("shadcn-css");
    expect(chosenFormat(null, "design-md")).toBe("design-md");
    expect(chosenFormat(null, null)).toBeNull();
  });

  it("C-EXPUI-07 throws RangeError for a format outside the two, naming chosenFormat", () => {
    expect(() => chosenFormat("pdf" as never, null)).toThrow(RangeError);
    expect(() => chosenFormat("pdf" as never, null)).toThrow(/chosenFormat/);
    expect(() => chosenFormat(null, "x" as never)).toThrow(RangeError);
    expect(() => chosenFormat(null, "x" as never)).toThrow(/chosenFormat/);
  });

  it("C-EXPUI-07 throws TypeError for a value that is neither a string nor null", () => {
    expect(() => chosenFormat(5 as never, null)).toThrow(TypeError);
    expect(() => chosenFormat(5 as never, null)).toThrow(/chosenFormat/);
    expect(() => chosenFormat(null, undefined as never)).toThrow(TypeError);
  });
});

describe("fileAccepted", () => {
  it("C-EXPUI-04 accepts .md, .markdown, .css and .txt of any case up to the limit", () => {
    expect(IMPORT_MAX_BYTES).toBe(262_144);
    for (const name of ["a.md", "a.MARKDOWN", "a.css", "a.txt", "A.Css"]) {
      expect(fileAccepted(name, 262_144)).toEqual({ ok: true });
    }
    expect(fileAccepted("a.md", 0)).toEqual({ ok: true });
  });

  it("C-EXPUI-04 refuses another extension and a size over the limit, before reading", () => {
    expect(fileAccepted("a.json", 10)).toEqual({
      ok: false,
      message: "Choose a .md or a .css file.",
    });
    expect(fileAccepted("noextension", 10)).toEqual({
      ok: false,
      message: "Choose a .md or a .css file.",
    });
    expect(fileAccepted("a.css", 262_145)).toEqual({ ok: false, message: TOO_LARGE });
    expect(fileAccepted("a.json", 262_145).ok).toBe(false);
  });

  it("C-EXPUI-04 throws RangeError for a negative or fractional size, TypeError for a bad type", () => {
    for (const size of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => fileAccepted("a.md", size)).toThrow(RangeError);
      expect(() => fileAccepted("a.md", size)).toThrow(/fileAccepted/);
    }
    expect(() => fileAccepted(5 as never, 1)).toThrow(TypeError);
    expect(() => fileAccepted(5 as never, 1)).toThrow(/fileAccepted/);
    expect(() => fileAccepted("a.md", "1" as never)).toThrow(TypeError);
    expect(() => fileAccepted("a.md", "1" as never)).toThrow(/fileAccepted/);
  });
});
