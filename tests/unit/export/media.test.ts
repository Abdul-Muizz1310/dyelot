import { describe, expect, it } from "vitest";
import { mediaName } from "@/export/media";
import { specId } from "@/spec";
import { SPEC } from "./golden-support";

// C-FEX-09 and C-FEX-10 of docs/specs/05-motion-3d.md, section 14.4 (R5-28).

const HEX8 = specId(SPEC).slice(0, 8);

describe("C-FEX-09 mediaName", () => {
  it("C-FEX-09 joins the slug, the first 8 hex digits, the kind and the container", () => {
    expect(HEX8).toMatch(/^[0-9a-f]{8}$/);
    expect(mediaName(SPEC, "brand", "mp4")).toBe(`untitled-${HEX8}-brand.mp4`);
    expect(mediaName(SPEC, "loop", "webm")).toBe(`untitled-${HEX8}-loop.webm`);
  });

  it("C-FEX-09 folds a name such as Café Crème", () => {
    const named = { ...SPEC, meta: { ...SPEC.meta, name: "Café Crème" } };
    expect(mediaName(named, "brand", "mp4")).toBe(
      `cafe-creme-${specId(named).slice(0, 8)}-brand.mp4`,
    );
  });
});

describe("C-FEX-10 mediaName checks its arguments", () => {
  it("C-FEX-10 throws RangeError for a kind or container outside the lists", () => {
    expect(() => mediaName(SPEC, "poster" as never, "mp4")).toThrow(RangeError);
    expect(() => mediaName(SPEC, "brand", "mov" as never)).toThrow(RangeError);
    expect(() => mediaName(SPEC, "poster" as never, "mp4")).toThrow(/^mediaName/);
    expect(() => mediaName(SPEC, "brand", "mov" as never)).toThrow(/^mediaName/);
  });

  it("C-FEX-10 throws TypeError for a wrong type, before any domain", () => {
    expect(() => mediaName(SPEC, 1 as never, "mp4")).toThrow(TypeError);
    expect(() => mediaName(null as never, "brand", "mp4")).toThrow(TypeError);
    expect(() => mediaName(SPEC, "brand", 2 as never)).toThrow(TypeError);
    expect(() => mediaName(null as never, "brand", "mp4")).toThrow(/^mediaName/);
    expect(() => mediaName(SPEC, 1 as never, "mp4")).toThrow(/^mediaName/);
    expect(() => mediaName(null as never, "poster" as never, "mp4")).toThrow(TypeError);
  });
});
