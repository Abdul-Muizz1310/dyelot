import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "@/features/export/download";

// C-FEX-18 of docs/specs/05-motion-3d.md, section 14.4 (R5-28).

const blobs: Blob[] = [];
const clicked: string[] = [];

beforeEach(() => {
  blobs.length = 0;
  clicked.length = 0;
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn((blob: Blob) => {
        blobs.push(blob);
        return "blob:x";
      }),
      revokeObjectURL: vi.fn(),
    }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicked.push(`${this.download}|${this.href}`);
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("C-FEX-18 downloadBlob types", () => {
  const bytes = new Uint8Array([1, 2, 3]);

  it("C-FEX-18 clicks a link to a Blob of the given type", () => {
    downloadBlob("a.mp4", bytes, "video/mp4");
    expect(clicked).toEqual(["a.mp4|blob:x"]);
    expect(blobs[0]?.type).toBe("video/mp4");
  });

  it("C-FEX-18 defaults to application/zip", () => {
    downloadBlob("a.zip", bytes);
    expect(blobs[0]?.type).toBe("application/zip");
  });

  it("C-FEX-18 throws TypeError for a type that is not a string and RangeError for an empty one", () => {
    expect(() => downloadBlob("a.mp4", bytes, 5 as never)).toThrow(TypeError);
    expect(() => downloadBlob("a.mp4", bytes, 5 as never)).toThrow(/^downloadBlob/);
    expect(() => downloadBlob("a.mp4", bytes, "")).toThrow(RangeError);
    expect(() => downloadBlob("a.mp4", bytes, "")).toThrow(/^downloadBlob/);
    expect(blobs).toHaveLength(0);
  });
});
