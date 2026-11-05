import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { imagePalette } from "@/engine";
import { vibeReason } from "@/features/ai/ImageSection";
import { type ImageReply, JPEG_MAX_BYTES, MAX_PIXELS } from "@/features/ai/image-protocol";

// The image worker's steps 2 and 4 (docs/specs/04-ai.md, 9.1, 13.3; controller rulings on Task
// 4.6b's and 4.10b's reviews), with the browser's decoder, canvas and quantizer stubbed: a decoded
// size over MAX_PIXELS is refused before any copy is drawn, whatever the header stated; a JPEG that
// stays over JPEG_MAX_BYTES at 0.85 and at 0.6 gives no JPEG, and "Read the vibe" then says the
// image is too detailed to send.

const getPalette = vi.hoisted(() => vi.fn());
vi.mock("colorthief", () => ({ getPalette }));

const FOUR_COLORS = readFileSync(
  path.join(import.meta.dirname, "../../../fixtures/ai/four-colors.png"),
);

/** What the stubs saw: the canvases drawn, the JPEG qualities asked for, the bitmaps closed. */
type Seen = { canvases: number[][]; qualities: number[]; closed: number };

/**
 * Stubs `createImageBitmap` (a bitmap of `width` × `height`), `OffscreenCanvas` (whose JPEG has the
 * byte size `jpegSizes[quality]`) and `postMessage`, and returns what they see and the posted replies.
 */
function stubBrowser(width: number, height: number, jpegSizes: Record<number, number>) {
  const seen: Seen = { canvases: [], qualities: [], closed: 0 };
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({
      width,
      height,
      close: () => {
        seen.closed += 1;
      },
    })),
  );
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      constructor(
        readonly width: number,
        readonly height: number,
      ) {
        seen.canvases.push([width, height]);
      }
      getContext() {
        return { imageSmoothingQuality: "low", drawImage: () => {} };
      }
      async convertToBlob({ quality }: { quality: number }) {
        seen.qualities.push(quality);
        const size = jpegSizes[quality] ?? 1;
        return { size, arrayBuffer: async () => new ArrayBuffer(Math.min(size, 16)) };
      }
    },
  );
  const posted = vi.fn();
  vi.stubGlobal("postMessage", posted);
  return { seen, posted };
}

/** Sends a request for `four-colors.png` (its header states 100 × 10) and waits for the reply. */
async function ask(posted: ReturnType<typeof vi.fn>, id: number): Promise<ImageReply> {
  const file = new Blob([FOUR_COLORS], { type: "image/png" });
  window.dispatchEvent(new MessageEvent("message", { data: { id, file } }));
  await vi.waitFor(() => expect(posted).toHaveBeenCalled());
  return posted.mock.calls[0]?.[0] as ImageReply;
}

beforeAll(async () => {
  await import("@/features/ai/image.worker");
});

beforeEach(() => {
  getPalette.mockReset();
  getPalette.mockResolvedValue([{ hex: () => "#B8422E", proportion: 1 }]);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("9.1 the image worker", () => {
  it("9.1 step 2 refuses a decoded size over MAX_PIXELS before any copy is drawn, whatever the header stated", async () => {
    const { seen, posted } = stubBrowser(10_000, 5_001, {});
    expect(10_000 * 5_001).toBeGreaterThan(MAX_PIXELS);
    expect(await ask(posted, 1)).toEqual({ id: 1, ok: false, error: "too-many-pixels" });
    expect(seen.canvases).toEqual([]);
    expect(getPalette).not.toHaveBeenCalled();
    expect(seen.closed).toBe(1);
  });

  it("9.1 step 2 lets exactly MAX_PIXELS decoded pixels through", async () => {
    const { seen, posted } = stubBrowser(10_000, 5_000, { 0.85: 10 });
    const reply = await ask(posted, 2);
    expect(reply).toMatchObject({ id: 2, ok: true, width: 10_000, height: 5_000 });
    expect(seen.canvases).toEqual([
      [256, 128],
      [768, 384],
    ]);
  });

  it("9.1 step 4 gives no JPEG when it is over JPEG_MAX_BYTES at 0.85 and at 0.6, and Read the vibe says the image is too detailed", async () => {
    const over = JPEG_MAX_BYTES + 1;
    const { seen, posted } = stubBrowser(100, 10, { 0.85: over, 0.6: over });
    const reply = await ask(posted, 3);
    if (!reply.ok) throw new Error(`no palette: ${reply.error}`);
    expect(reply.jpeg).toBeNull();
    expect(seen.qualities).toEqual([0.85, 0.6]);
    expect(vibeReason({ palette: imagePalette(reply.clusters), jpeg: reply.jpeg })).toBe(
      "This image is too detailed to send. Try a smaller one.",
    );
  });

  it("9.1 step 4 keeps the JPEG at 0.6 when it fits JPEG_MAX_BYTES exactly", async () => {
    const { seen, posted } = stubBrowser(100, 10, {
      0.85: JPEG_MAX_BYTES + 1,
      0.6: JPEG_MAX_BYTES,
    });
    const reply = await ask(posted, 4);
    if (!reply.ok) throw new Error(`no palette: ${reply.error}`);
    expect(reply.jpeg).toMatchObject({ width: 100, height: 10 });
    expect(seen.qualities).toEqual([0.85, 0.6]);
    expect(vibeReason({ palette: imagePalette(reply.clusters), jpeg: reply.jpeg })).toBeNull();
  });

  it("13.3 Read the vibe waits for an image first", () => {
    expect(vibeReason(null)).toBe("Choose an image first.");
  });
});
