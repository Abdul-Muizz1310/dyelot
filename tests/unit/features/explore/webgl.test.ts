import { describe, expect, it, vi } from "vitest";
import { supportsWebgl2 } from "@/features/explore/webgl";

// C-EXPL5-08 of docs/specs/05-motion-3d.md, section 14.5 (R5-39).

const canvasWith = (getContext: (id: string) => unknown) =>
  (() => ({ getContext })) as unknown as () => HTMLCanvasElement;

describe("supportsWebgl2 (R5-39)", () => {
  it("C-EXPL5-08 is true when the canvas gives a context", () => {
    const asked: string[] = [];
    const create = canvasWith((id) => {
      asked.push(id);
      return {};
    });
    expect(supportsWebgl2(create)).toBe(true);
    expect(asked).toEqual(["webgl2"]);
  });

  it("C-EXPL5-08 is false when the canvas gives null", () => {
    expect(supportsWebgl2(canvasWith(() => null))).toBe(false);
  });

  it("C-EXPL5-08 is false, without a throw, when getContext throws", () => {
    expect(
      supportsWebgl2(
        canvasWith(() => {
          throw new Error("blocked");
        }),
      ),
    ).toBe(false);
  });

  it("C-EXPL5-08 is false when making the canvas throws", () => {
    expect(
      supportsWebgl2(() => {
        throw new Error("no document");
      }),
    ).toBe(false);
  });

  it("C-EXPL5-08 makes its own canvas by default", () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(supportsWebgl2()).toBe(false);
    expect(spy).toHaveBeenCalledWith("webgl2");
    spy.mockRestore();
  });
});
